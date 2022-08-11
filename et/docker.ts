import { execCommand } from "app/helpers";
const { exec } = require("child_process");

export async function ensureUp() {
  await ccdLogin()
  await ccdComposePull()
  await ccdInit()
  await ccdComposeUp()
  await initEcm()
  await initDb()
}

export async function tearDown() {
  await dockerKillAll()
  await dockerRmAll()
  await dockerSystemPrune()
  await dockerImageRm()
}

async function ccdLogin() {
  return execCommand('./ccd login', process.env.ECM_DOCKER_DIR)
}

function ccdComposePull() {
  return execCommand('./ccd compose pull', process.env.ECM_DOCKER_DIR)
}

function ccdInit() {
  return execCommand('./ccd init', process.env.ECM_DOCKER_DIR)
}

function ccdComposeUp() {
  return execCommand('./ccd compose up -d', process.env.ECM_DOCKER_DIR)
}

function initEcm() {
  return new Promise(resolve => {
    exec("./bin/ecm/init-ecm.sh", { cwd: process.env.ECM_DOCKER_DIR }, (error: any) => {
      if (error.message.indexOf("Empty reply from server") > -1) {
        console.log(`Failed with empty reply, waiting for 30s and trying again`)
        return setTimeout(() => initEcm().then(() => resolve('')).catch(() => { }), 1000 * 30)
      }
      resolve('')
    });
  })
}

function initDb() {
  return execCommand('./bin/init-db.sh', process.env.ET_CCD_CALLBACKS_DIR)
}

function dockerKillAll() {
  return execCommand('docker kill $(docker ps -qa)', null, null, true)
}

function dockerRmAll() {
  return execCommand('docker rm $(docker ps -qa)', null, null, true)
}

function dockerSystemPrune() {
  return execCommand('docker system prune --volumes -f', null, null, true)
}

function dockerImageRm() {
  return execCommand('docker image rm \$(docker image ls)', null, null, true)
}