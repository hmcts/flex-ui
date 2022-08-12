import { execCommand } from "app/helpers"
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
}

/**
 * Commands for destroying everything in docker (containers/images/volumes/etc...)
 */
export async function tearDown() {
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
  return execCommand('./ccd login', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd compose pull to download all related images, this can take a long time and output is not available until exit.
 * TODO: Hook into stdout to monitor output or include a timeout feature
 */
function ccdComposePull() {
  console.log(`This can take a long time without any output, please be patient`)
  return execCommand('./ccd compose pull', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd init in the ecm-ccd-docker repo
 */
function ccdInit() {
  return execCommand('./ccd init', process.env.ECM_DOCKER_DIR)
}

/**
 * Runs ccd compose up -d in the ecm-ccd-docker repo
 */
function ccdComposeUp() {
  return execCommand('./ccd compose up -d', process.env.ECM_DOCKER_DIR)
}

/**
 * Run the init-ecm command responsible for creating roles and loading data. 
 * This command will automatically retry every 30 seconds (if the usual error messages occur)
 * until it is successful (usually takes 5 mins depending on hardware)
 */
function initEcm() {
  return new Promise(resolve => {
    exec("./bin/ecm/init-ecm.sh", { cwd: process.env.ECM_DOCKER_DIR }, (error: any) => {
      if (error.message.indexOf("Empty reply from server") > -1) {
        console.log(`Failed with empty reply, waiting for 30s and trying again`)
        return setTimeout(() => initEcm().then(() => resolve('')).catch(() => undefined), 1000 * 30)
      }
      resolve('')
    })
  })
}

/**
 * Runs init-db.sh in the et-ccd-callbacks repo
 */
function initDb() {
  return execCommand('./bin/init-db.sh', process.env.ET_CCD_CALLBACKS_DIR)
}

/**
 * Docker Kill All. This kills all running containers regardless of hmcts or not.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
function dockerKillAll() {
  return execCommand('docker kill $(docker ps -qa)', null, null, true)
}

/**
 * Docker Remove All Containers.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
function dockerRmAll() {
  return execCommand('docker rm $(docker ps -qa)', null, null, true)
}

/**
 * Docker system prune (including volumes). This will delete any case data.
 * TODO: Improve this so it doesnt affect unrelated containers
 */
function dockerSystemPrune() {
  return execCommand('docker system prune --volumes -f', null, null, true)
}

/**
 * Docker remove all images.
 * TODO: Improve this so it doesnt affect unrelated images
 */
function dockerImageRm() {
  return execCommand('docker image rm \$(docker image ls)', null, null, true)
}