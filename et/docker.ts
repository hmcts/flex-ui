import { clearCurrentLine, execCommand, getEnvVarsFromFile, temporaryLog } from 'app/helpers'
import { exec, ExecException } from 'child_process'

/**
 * Commands for ensuring all docker containers are spun up
 */
export async function ensureUp() {
  await ccdLogin()
  await ccdComposePull()
  await ccdInit()
  await startContainers()
  await initDb()
  clearCurrentLine()
}

/**
 * Start and setup containers from existing images
 */
export async function startContainers() {
  await ccdComposeUp()
  await initEcm()
}

/**
 * Commands for destroying everything in docker (containers/images/volumes/etc...)
 */
export async function destroyEverything() {
  await dockerKillAll()
  await dockerRmAll()
  await dockerSystemPrune()
  await dockerImageRm()
}

/**
 * Runs ccd login in the ecm-ccd-docker repo (may require an interactive az login first)
 * TODO: Catch login failures and prompt user to manually run az login (rare)
 */
async function ccdLogin() {
  temporaryLog('Running ./ccd login')
  return await execCommand('./ccd login', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd init in the ecm-ccd-docker repo
 */
async function ccdInit() {
  temporaryLog('Running ./ccd init')
  const { stderr, code } = await execCommand('./ccd init', process.env.ECM_DOCKER_DIR, false)
  if (stderr && !stderr.includes('network with name ccd-network already exists')) {
    throw new Error(`./ccd init failed with exit code ${code}:  ${stderr}`)
  }
}

/**
 * Runs ccd compose up -d in the ecm-ccd-docker repo
 */
async function ccdComposeUp() {
  temporaryLog('Running ./compose up -d')
  return await execCommand('./ccd compose up -d', process.env.ECM_DOCKER_DIR)
}

/**
 * Run the init-ecm command responsible for creating roles and loading data.
 * This command will automatically retry every 30 seconds (if the usual error messages occur)
 * until it is successful (can take around 5 mins depending on hardware)
 */
async function initEcm() {
  temporaryLog('Running init-ecm.sh')
  const promise = async () => {
    return await new Promise(resolve => {
      exec('./bin/ecm/init-ecm.sh', { cwd: process.env.ECM_DOCKER_DIR }, (error?: ExecException) => {
        if (error?.message?.includes('Empty reply from server')) {
          temporaryLog('init-ecm.sh failed with empty reply, waiting for 30s and trying again\r')
          return setTimeout(() => { promise().then(() => resolve('')).catch(() => undefined) }, 1000 * 30)
        }
        temporaryLog('init-ecm.sh successful')
        resolve('')
      })
    })
  }
  return await promise()
}

/**
 * Runs init-db.sh in the et-ccd-callbacks repo
 */
async function initDb() {
  temporaryLog('Running init-db.sh')
  const { stderr, code } = await execCommand('./bin/init-db.sh', process.env.ET_CCD_CALLBACKS_DIR, false)
  if (stderr && !stderr.includes('already exists')) {
    throw new Error(`./init-db.sh failed with exit code ${code}: ${stderr}`)
  }
}

/**
 * Docker Kill All. This kills all running containers regardless of hmcts or not.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
async function dockerKillAll() {
  const command = 'docker kill $(docker ps -qa)'
  temporaryLog(`Running ${command}`)
  return await execCommand(command, undefined, false)
}

/**
 * Docker Remove All Containers.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
async function dockerRmAll() {
  const command = 'docker rm $(docker ps -qa)'
  return await execCommand(command, undefined, false)
}

/**
 * Docker system prune (including volumes). This will delete any case data.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
async function dockerSystemPrune() {
  const command = 'docker system prune --volumes -f'
  return await execCommand(command, undefined, false)
}

/**
 * Docker remove all images.
 * TODO: Improve this so it doesnt affect unrelated images
 */
async function dockerImageRm() {
  const command = 'docker image rm $(docker image ls)'
  return await execCommand(command, undefined, false)
}

/**
 * Runs ccd compose pull to download all related images, this can take a long time and output is not available until exit.
 */
async function ccdComposePull() {
  const command = './ccd compose pull'
  return await new Promise((resolve, reject) => {
    const stdout: string[] = []
    const stderr: string[] = []
    let timeout = 6

    const progress: { [image: string]: string } = {}

    const regex = /Pulling (.+?)\s*\.\.\. (.+)/
    let lastProgress = ''

    const checkProgress = setInterval(() => {
      const progressJson = JSON.stringify(progress)
      if (lastProgress === progressJson) {
        // No progress has been made in the last 10 seconds. sus
        console.warn('!No progress has been made in the last 10 seconds!')
        console.warn(progress)
        timeout--
        if (!timeout) {
          try { child.kill() } catch (e) { }
          cleanupAndExit(() => reject(new Error('Progress has stalled')))
        }
        return
      }
      lastProgress = progressJson
      temporaryLog(`pulling images... ${Object.values(progress).filter(o => o !== 'done').length} left`)
    }, 10000)

    const cleanupAndExit = (fn: () => void) => {
      clearInterval(checkProgress)
      fn()
    }

    temporaryLog(`Running ${command}`)

    const child = exec(command, { cwd: process.env.ECM_DOCKER_DIR, env: { ...process.env, ...getEnvVarsFromFile() } }, err => {
      if (err) {
        return cleanupAndExit(() => reject(err))
      }

      if (Object.values(progress).some(o => o !== 'done')) {
        // If one of these are not done then its possible an error occured
        console.warn(stdout)
        console.warn(stderr)
        return cleanupAndExit(() => reject(new Error('Not all images are at status "done"')))
      }

      temporaryLog(`${command} successful`)
      return cleanupAndExit(() => resolve(null))
    })

    child.stdout?.on('data', data => {
      stdout.push(data)
    })

    child.stderr?.on('data', data => {
      const results = regex.exec(data)
      if (results) {
        progress[results[1]] = results[2]
        return
      }
      stderr.push(data)
    })
  })
}
