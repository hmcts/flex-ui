import { clearCurrentLine, execCommand, getEnvVarsFromFile, temporaryLog } from 'app/helpers'
import { exec, ExecException } from 'child_process'
import { EOL } from 'os'

export const WSL_UPTIME_CONTAINER_NAME = 'wsl_uptime'

const DOCKER_VOLUMES = [
  'compose_ccd-docker-azure-blob-data',
  'compose_ccd-docker-ccd-shared-database-data-v11',
  'compose_esdata1'
]

const DOCKER_CONTAINERS = [
  'ethos-logstash',
  'xui-manage-cases',
  'compose-ccd-case-document-am-api-1',
  'ccd-api-gateway-web',
  'compose-am-role-assignment-service-1',
  'ccd-elasticsearch',
  'compose-ccd-data-store-api-1',
  'compose-ccd-definition-store-api-1',
  'compose-dm-store-1',
  'compose-ccd-user-profile-api-1',
  'compose-service-auth-provider-api-1',
  'compose-ccd-shared-database-v11-1',
  'compose-azure-storage-emulator-azurite-1',
  'rse-idam-simulator',
  'manage-case-assignment',
  'compose-xui-manage-org-1',
  'compose-rd-professional-reference-data-1'
]

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
export async function ccdLogin() {
  temporaryLog('Running ./ccd login')
  return await execCommand('./ccd login', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd init in the ecm-ccd-docker repo
 */
export async function ccdInit() {
  temporaryLog('Running ./ccd init')
  const { stderr, code } = await execCommand('./ccd init', process.env.ECM_DOCKER_DIR, false)
  if (stderr && !stderr.includes('network with name ccd-network already exists')) {
    throw new Error(`./ccd init failed with exit code ${code}:  ${stderr}`)
  }
}

/**
 * Runs ccd compose up -d in the ecm-ccd-docker repo
 */
export async function ccdComposeUp() {
  temporaryLog('Running ./compose up -d')
  await execCommand('./ccd wsl', process.env.ECM_DOCKER_DIR, false)
  return await execCommand('./ccd compose up -d', process.env.ECM_DOCKER_DIR)
}

/**
 * Run the init-ecm command responsible for creating roles and loading data.
 * This command will automatically retry every 5 seconds (if the usual error messages occur)
 * until it is successful (can take around 5 mins depending on hardware)
 */
export async function initEcm() {
  temporaryLog('Running init-ecm.sh')
  const promise = async () => {
    return await new Promise(resolve => {
      const env = getEnvVarsFromFile()
      exec('./bin/ecm/init-ecm.sh', { cwd: process.env.ECM_DOCKER_DIR, env: { ...process.env, ...env } }, (error?: ExecException) => {
        if (error?.message?.includes('Empty reply from server')) {
          temporaryLog('init-ecm.sh failed with empty reply, waiting for 10s and trying again\r')
          return setTimeout(() => { promise().then(() => resolve('')).catch(() => undefined) }, 1000 * 10)
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
export async function initDb() {
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
export async function dockerSystemPrune() {
  const command = 'docker system prune --volumes -f && docker image prune -f -a'
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

export async function killAndRemoveContainers() {
  return await Promise.allSettled(DOCKER_CONTAINERS.map(async o => {
    await execCommand(`docker container rm ${o} --force`, undefined, false)
  }))
}

export async function dockerDeleteVolumes() {
  return await Promise.allSettled(DOCKER_VOLUMES.map(async o => {
    await execCommand(`docker volume rm ${o}`, undefined, false)
  }))
}

export async function ecmAddUsersAndCcdRoles() {
  await execCommand('./bin/add-users.sh', process.env.ECM_DOCKER_DIR, false)
  await execCommand('./bin/add-ccd-roles.sh', process.env.ECM_DOCKER_DIR, false)
}

function getLayersLeft(includeSkippable = false, progress: Record<string, string>) {
  const statuses = ['done', 'pulled', 'pull complete', 'already exists', 'skipped']

  if (includeSkippable) {
    statuses.push('extracting')
  }

  return Object.values(progress).filter(o => !statuses.find(x => o.toLowerCase().includes(x)))
}

/**
 * Runs ccd compose pull to download all related images, this can take a long time and output is not available until exit.
 */
export async function ccdComposePull() {
  const command = './ccd compose pull'
  return await new Promise((resolve, reject) => {
    const stdout: string[] = []
    const stderr: string[] = []
    let noProgressFor = 0
    const progressInterval = 10

    const progress: { [image: string]: string } = {}

    let lastProgress = ''

    const checkProgress = setInterval(() => {
      const progressJson = JSON.stringify(progress)
      if (lastProgress === progressJson) {
        noProgressFor += progressInterval
        return temporaryLog(`./ccd compose pull - No progress has been made in the last ${noProgressFor} seconds`)
      }
      lastProgress = progressJson
      temporaryLog(`pulling image layers... ${getLayersLeft(false, progress).length} in progress`)
    }, progressInterval * 1000)

    const cleanupAndExit = (fn: () => void) => {
      clearInterval(checkProgress)
      fn()
    }

    temporaryLog(`Running ${command}`)

    const child = exec(command, { maxBuffer: 1024 * 1024 * 5, cwd: process.env.ECM_DOCKER_DIR, env: { ...process.env, ...getEnvVarsFromFile() } }, err => {
      if (err) {
        return cleanupAndExit(() => reject(err))
      }

      const layersLeft = getLayersLeft(true, progress)
      if (layersLeft.length) {
        return cleanupAndExit(() => {
          const status = `${Object.keys(layersLeft).map(o => `${o}: ${progress[o]}`).join(EOL)}`
          console.warn(`Not all layers are at a known done status:${EOL}${status}`)
          return resolve(null)
        })
      }

      temporaryLog(`${command} successful`)
      return cleanupAndExit(() => resolve(null))
    })

    child.stdout?.on('data', data => {
      stdout.push(data)
    })

    child.stderr?.on('data', data => {
      const results = /(.+?) ([A-Za-z0-9 -]+)(\[[=>]+]\s+(([0-9.]+.{2})\/([0-9.]+.{2})))?/.exec(data)
      if (results) {
        /* eslint-disable */
        let [_, name, state, __, ___, bytesDone, bytesTotal] = results
        /* eslint-enable */
        if (state === 'Extracting' && bytesDone === bytesTotal && !!bytesDone) {
          state = 'pull complete'
        }
        progress[name] = state
      }
      stderr.push(data)
    })
  })
}

/**
 * Checks for containers that have exited and restarts them if the name is included in the list at the top
 */
export async function fixExitedContainers() {
  const down = await getExitedContainers()
  await Promise.allSettled(down.map(async o => await execCommand(`docker start ${o}`)))
}

export async function getExitedContainers() {
  const { stdout } = await execCommand('docker ps -a --format "table {{.Names}}\t{{.Status}}" | grep -v " Up "', undefined, false)
  return stdout.split(EOL).map(o => DOCKER_CONTAINERS.find(x => o.includes(x))).filter(o => !!o)
}

export async function recreateWslUptimeContainer() {
  await execCommand('docker kill wsl_uptime', null, false)
  await execCommand('docker rm wsl_uptime', null, false)
  await execCommand('docker run -e "WSL_HOSTNAME=$(hostname -I)" -d --name "wsl_uptime" jackreeve532/wsluptimechecker:latest', null, false)
}

export async function isDmStoreReady() {
  const { stdout } = await execCommand('docker logs compose-dm-store-1', undefined, false)
  const logs = (stdout || '').split('\n')
  const currentSessionLogs = logs.slice(logs.findIndex(o => o.startsWith(' :: Spring Boot ::')))
  return currentSessionLogs.some(o => o.match(/Started DmApp in [\d.]+ seconds/))
}

export async function rebootDmStore() {
  return await execCommand('docker restart compose-dm-store-1')
}

export async function doAllContainersExist(exclude: string[] = []) {
  const { stdout } = await execCommand('docker ps -a', undefined, false)
  const states = stdout.split(EOL)
  const requiredContainers = DOCKER_CONTAINERS.reduce((acc, obj) => {
    if (!exclude.includes(obj)) {
      acc.push(obj)
    }
    return acc
  }, [])

  return !requiredContainers.some(o => !states.find(x => x.includes(o)))
}

export async function isContainerRunning(name: string) {
  const { stdout } = await execCommand(`docker container inspect --format='{{.State.Status}}' ${name}`, undefined, false)
  return stdout.replace(EOL, '') === 'running'
}

export async function getRunningContainers(names?: string[]) {
  const { stdout } = await execCommand('docker ps --format \'{{.Names}}\'', undefined, false)
  const running = stdout.split(EOL)

  if (!names) {
    return running
  }
  
  return names.filter(o => running.includes(o))
}

export async function stopContainers(names: string[]) {
  await Promise.allSettled(names.map(async o => await execCommand(`docker stop ${o}`, undefined, false)))
}