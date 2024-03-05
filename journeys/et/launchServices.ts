import { ensurePathExists, execCommand, getEnvVarsFromFile, killOn, temporaryLog } from 'app/helpers'
import { prompt } from 'inquirer'
import { ChildProcess, exec } from 'node:child_process'
import { Journey } from 'types/journey'
import { createWriteStream, existsSync, rmSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { sep } from 'node:path'
import { NO, YES, YES_OR_NO } from 'app/constants'

const runningApps: Record<string, ChildProcess> = {}

const gradleBootRunDev = `./gradlew bootRun --args='--spring.profiles.active=dev'`

const SERVICES: Record<string, { port: number, cmd: string, successRegex?: RegExp }> = {
  'et-sya-frontend': { port: 3002, cmd: 'yarn start:dev-red', successRegex: /webpack [\d.]+ compiled with \d+ warnings in \d+ ms/g },
  'et-sya-api': { port: 4550, cmd: gradleBootRunDev }
}

const OPTS = {
  BACK: '<-- Back to main menu',
  LOCAL: 'Apply local changes to et-sya-frontend',
  REVERT: 'Revert local changes to et-sya-frontend',
  START: 'Start et-sya-api and et-sya-frontend',
  STOP: 'Stop et-sya-api and et-sya-frontend',
}

const files = [
  `${process.env.ET_SYA_FRONTEND_DIR}${sep}config${sep}development.json`,
  `${process.env.ET_SYA_FRONTEND_DIR}${sep}src${sep}main${sep}auth${sep}index.ts`,
  `${process.env.ET_SYA_FRONTEND_DIR}${sep}src${sep}main${sep}modules${sep}helmet${sep}index.ts`,
  `${process.env.ET_SYA_FRONTEND_DIR}${sep}src${sep}main${sep}modules${sep}oidc${sep}index.ts`,
]

async function journey() {
  const answers = await prompt([{ name: 'task', message: 'What do we want to do?', type: 'list', choices: Object.values(OPTS) }])

  if (answers.task === OPTS.BACK) {
    return
  }

  if (answers.task === OPTS.LOCAL) {
    const changesAlreadyMade = localChangesExist()
    if (changesAlreadyMade) {
      const answers = await prompt([{ name: 'confirm', message: 'Local changes already exist. Doing this again is not advised, continue?', type: 'list', choices: YES_OR_NO, default: NO }])
      if (answers.confirm === NO) {
        return
      }
    }
    return await makeLocalChangesForFrontend()
  }

  if (answers.task === OPTS.REVERT) {
    return await restoreLocalChangesForFrontend()
  }

  if (answers.task === OPTS.START) {
    await startFrontendServices()
  }

  if (answers.task === OPTS.STOP) {
    await killFrontendServices()
  }

  await journey()
}

export async function startFrontendServices() {
  for (const service in SERVICES) {
    temporaryLog(`Starting ${service}...`)
    await ensureServiceIsUp(service)
  }
}

export async function killFrontendServices() {
  for (const service in SERVICES) {
    temporaryLog(`Killing ${service}...`)

    if (runningApps[service]) {
      try {
        runningApps[service].kill()
      }
      catch (e) { }
      runningApps[service] = undefined
    }

    await killOn(SERVICES[service].port)
  }
}

export function localChangesExist() {
  for (const file of files) {
    if (existsSync(`${file}.iml`)) {
      return true
    }
  }

  return false
}

async function restoreLocalChangesForFrontend() {
  for (const file of files) {
    try {
      const flexFile = `${file}.iml`
      const fileContents = await readFile(flexFile, 'utf8')
      await writeFile(file, fileContents)
      rmSync(flexFile)
    } catch (e) { }
  }
}

export async function makeLocalChangesForFrontend() {
  await restoreLocalChangesForFrontend()
  if (process.env.LAUNCH_DARKLY_SDK_KEY) {
    const devJsonFilePath = `${process.env.ET_SYA_FRONTEND_DIR}${sep}config${sep}development.json`
    const devJsonFile = await readFile(devJsonFilePath, 'utf8')

    if (!existsSync(`${devJsonFilePath}.iml`)) {
      await writeFile(`${devJsonFilePath}.iml`, devJsonFile)
    }

    const devJson = JSON.parse(devJsonFile)
    devJson.services.launchDarkly.key = process.env.LAUNCH_DARKLY_SDK_KEY
    await writeFile(devJsonFilePath, JSON.stringify(devJson, null, 2))
  }

  const authFilePath = `${process.env.ET_SYA_FRONTEND_DIR}${sep}src${sep}main${sep}auth${sep}index.ts`
  const authFile = await readFile(authFilePath, 'utf8')
  if (!existsSync(`${authFilePath}.iml`)) {
    await writeFile(`${authFilePath}.iml`, authFile)
  }

  let newAuthFile = authFile.replace(/(const code = encodeURIComponent\(rawCode\).*)/g, `// $1\n`)
  newAuthFile = newAuthFile.replace(/const data = `client_id=.*/g, 'const data = `client_id=${id}&client_secret=${secret}&grant_type=authorization_code&redirect_uri=${callbackUrl}&scope=roles&username=citizen@gmail.com&password=Password`\n')

  await writeFile(authFilePath, newAuthFile)

  const helmetFilePath = `${process.env.ET_SYA_FRONTEND_DIR}${sep}src${sep}main${sep}modules${sep}helmet${sep}index.ts`
  const helmetFile = await readFile(helmetFilePath, 'utf8')
  if (!existsSync(`${helmetFilePath}.iml`)) {
    await writeFile(`${helmetFilePath}.iml`, helmetFile)
  }

  const newHelmetFile = helmetFile.replace(/localhost:5000/g, 'localhost:5062')

  await writeFile(helmetFilePath, newHelmetFile)

  const oidcFilePath = `${process.env.ET_SYA_FRONTEND_DIR}${sep}src${sep}main${sep}modules${sep}oidc${sep}index.ts`
  const oidcFile = await readFile(oidcFilePath, 'utf8')
  if (!existsSync(`${oidcFilePath}.iml`)) {
    await writeFile(`${oidcFilePath}.iml`, oidcFile)
  }

  const newOidcFile = oidcFile.replace(/  \/\/.*?\n  if \(!req.session.user\?.isCitizen\) {\n\s*.*?\s*}\n/m, '')

  await writeFile(oidcFilePath, newOidcFile)
}

async function ensureServiceIsUp(serviceName: string) {
  const envName = `${serviceName.toUpperCase().replace(/-/g, '_')}_DIR`
  const dir = process.env[envName]
  const port = SERVICES[serviceName].port

  if (await getPidRunningOnPort(port)) {
    return console.log(`already running - no action taken`)
  }

  if (!dir) {
    return console.error(`Could not find directory for ${serviceName} (is ${envName} set?)`)
  }

  const { cmd, successRegex } = SERVICES[serviceName]

  if (!cmd) {
    return console.error(`Not sure how to start ${serviceName}. This is a bug.`)
  }

  try {
    await startService({ name: serviceName, dir, cmd, successRegex, timeoutMs: 60000 })
    return console.log(`OK!`)
  } catch (e: any) {
    return console.error(e)
  }
}

/**
 * Get the process id running on a port (lsof -ti:PORT)
 */
async function getPidRunningOnPort(port: number = 0) {
  const { stdout } = await execCommand(`lsof -ti:${port}`, undefined, false)
  return Number(stdout || '0')
}

export async function startService(opts: { name: string, dir: string, cmd: string, successRegex: RegExp, timeoutMs: number }) {
  opts.timeoutMs ||= 60000
  opts.successRegex ||= /Started (.+?) in [\d.]+ seconds \(JVM/g

  return await new Promise((resolve, reject) => {
    const stdout: string[] = []
    const logFile = `./logs/${opts.name}-stdout.log`
    ensurePathExists(`./logs`)
    try { rmSync(logFile) } catch (e) { }
    const outStream = createWriteStream(logFile, { flags: 'a' })

    const start = Date.now()
    let hasStarted = false

    const cleanupAndExit = (fn: () => void) => {
      clearInterval(interval)
      fn()
    }

    const interval = setInterval(() => {
      if (stdout.find(o => o.match(opts.successRegex))) {
        hasStarted = true
        stdout.length = 0
        cleanupAndExit(() => resolve(child))
      }

      if (stdout.find(o => o.includes("APPLICATION FAILED TO START"))) {
        cleanupAndExit(() => reject(stdout.join('')))
      }

      if (Date.now() - start > opts.timeoutMs) {
        cleanupAndExit(() => reject(`Failed to start within ${opts.timeoutMs / 1000} seconds`))
      }
    }, 1000)

    const child: ChildProcess = exec(opts.cmd, { cwd: opts.dir, env: { ...process.env, ...getEnvVarsFromFile() } }, err => {
      if (err) {
        return cleanupAndExit(() => reject(err))
      }

      return cleanupAndExit(() => resolve(child))
    })

    runningApps[opts.name] = child

    child.stdout?.on('data', data => {
      if (!hasStarted) {
        // Don't store after app has started - this will kill memory
        stdout.push(data)
      }
      outStream.write(data)
    })

    child.stderr?.on('data', data => {
      outStream.write(data)
    })
  })
}

export default {
  disabled: false,
  group: 'et-wip',
  text: '[WIP] Manage frontend services (et-sya-frontend / et-sya-api)',
  fn: journey,
  alias: 'Services'
} as Journey

