import { clearCurrentLine, execCommand, temporaryLog } from "app/helpers"
import { exec } from "child_process"

/**
 * Commands for ensuring all docker containers are spun up
 */
export async function ensureUp() {
  await ccdLogin()
  await ccdComposePull()
  await ccdInit()
  await ccdComposeUp()
  await initEcm()
  await initDb()
  clearCurrentLine()
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
  return execCommand('./ccd login', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd init in the ecm-ccd-docker repo
 */
function ccdInit() {
  temporaryLog('Running ./ccd init')
  return execCommand('./ccd init', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd compose up -d in the ecm-ccd-docker repo
 */
function ccdComposeUp() {
  temporaryLog('Running ./compose up -d')
  return execCommand('./ccd compose up -d', process.env.ECM_DOCKER_DIR)
}

/**
 * Run the init-ecm command responsible for creating roles and loading data. 
 * This command will automatically retry every 30 seconds (if the usual error messages occur)
 * until it is successful (can take around 5 mins depending on hardware)
 */
function initEcm() {
  temporaryLog("Running init-ecm.sh")
  const promise = () => {
    return new Promise(resolve => {
      exec("./bin/ecm/init-ecm.sh", { cwd: process.env.ECM_DOCKER_DIR }, (error: any) => {
        if (error.message.indexOf("Empty reply from server") > -1) {
          temporaryLog(`init-ecm.sh failed with empty reply, waiting for 30s and trying again\r`)
          return setTimeout(() => promise().then(() => resolve('')).catch(() => undefined), 1000 * 30)
        }
        temporaryLog(`init-ecm.sh successful`)
        resolve('')
      })
    })
  }
  return promise()
}

/**
 * Runs init-db.sh in the et-ccd-callbacks repo
 */
function initDb() {
  temporaryLog('Running init-db.sh')
  return execCommand('./bin/init-db.sh', process.env.ET_CCD_CALLBACKS_DIR)
}

/**
 * Docker Kill All. This kills all running containers regardless of hmcts or not.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
function dockerKillAll() {
  const command = 'docker kill $(docker ps -qa)'
  temporaryLog(`Running ${command}`)
  return execCommand(command, undefined, false)
}

/**
 * Docker Remove All Containers.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
function dockerRmAll() {
  const command = 'docker rm $(docker ps -qa)'
  return execCommand(command, undefined, false)
}

/**
 * Docker system prune (including volumes). This will delete any case data.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
function dockerSystemPrune() {
  const command = 'docker system prune --volumes -f'
  return execCommand(command, undefined, false)
}

/**
 * Docker remove all images.
 * TODO: Improve this so it doesnt affect unrelated images
 */
function dockerImageRm() {
  const command = 'docker image rm \$(docker image ls)'
  return execCommand(command, undefined, false)
}

/**
 * Runs ccd compose pull to download all related images, this can take a long time and output is not available until exit.
 */
function ccdComposePull() {
  const command = './ccd compose pull'
  return new Promise((resolve, reject) => {
    let stdout: string[] = []
    let stderr: string[] = []
    let timeout = 6

    let progress: { [image: string]: string } = {}

    const regex = /Pulling (.+?)\s*\.\.\. (.+)/
    let lastProgress: string = ''

    const checkProgress = setInterval(() => {
      const progressJson = JSON.stringify(progress)
      if (lastProgress === progressJson) {
        // No progress has been made in the last 10 seconds. sus
        console.warn('!No progress has been made in the last 10 seconds!')
        console.warn(progress)
        timeout--
        if (!timeout) {
          try { child.kill() }
          catch (e) { }
          cleanupAndExit(() => reject(new Error('Progress has stalled')))
        }
        return
      }
      lastProgress = progressJson
      temporaryLog(`pulling images... ${Object.values(progress).filter(o => o !== "done").length} left`)
    }, 10000)

    const cleanupAndExit = (fn: () => any) => {
      clearInterval(checkProgress)
      fn()
    }

    temporaryLog(`Running ${command}`)

    const child = exec(command, { cwd: process.env.ECM_DOCKER_DIR }, (err => {
      if (err) {
        return cleanupAndExit(() => reject(err))
      }

      if (Object.values(progress).some(o => o !== "done")) {
        // If one of these are not done then its possible an error occured
        return cleanupAndExit(() => reject({ stdout, stderr, progress }))
      }

      temporaryLog(`${command} successful`)
      return cleanupAndExit(() => resolve(null))
    }))

    child.stdout?.on('data', data => {
      stdout.push(data)
    })

    child.stderr?.on('data', data => {
      const results = regex.exec(data)
      if (results) {
        progress[results[1]] = results[2]
        return
      }
      stdout.push(data)
    })
  })
}