import { sep } from "path";

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

function ccdLogin() {
  return new Promise((resolve, reject) => {
    exec("./ccd login", { cwd: process.env.ECM_DOCKER_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error) {
          return reject(new Error('Failed to generate spreadsheet for engwales'))
        }
        resolve('')
      });
  })
}

function ccdComposePull() {
  return new Promise((resolve, reject) => {
    exec("./ccd compose pull", { cwd: process.env.ECM_DOCKER_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error) {
          return reject(new Error('Failed to generate spreadsheet for engwales'))
        }
        resolve('')
      });
  })
}

function ccdInit() {
  return new Promise((resolve, reject) => {
    exec("./ccd init", { cwd: process.env.ECM_DOCKER_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error?.message?.indexOf("already exists") === -1) {
          return reject(new Error('Failed to generate spreadsheet for engwales'))
        }
        resolve('')
      });
  })
}

function ccdComposeUp() {
  return new Promise((resolve, reject) => {
    exec("./ccd compose up -d", { cwd: process.env.ECM_DOCKER_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error) {
          return reject(new Error('Failed to generate spreadsheet for engwales'))
        }
        resolve('')
      });
  })
}

function initEcm() {
  return new Promise((resolve, reject) => {
    exec("./bin/ecm/init-ecm.sh", { cwd: process.env.ECM_DOCKER_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error.message.indexOf("Empty reply from server") > -1) {
          console.log(`Failed with empty reply, waiting for 30s and trying again`)
          return setTimeout(() => initEcm().then(() => resolve('')).catch(() => {}), 1000 * 30)
        }
        resolve('')
      });
  })
}

function initDb() {
  return new Promise((resolve, reject) => {
    exec("./bin/init-db.sh", { cwd: process.env.ET_CCD_CALLBACKS_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error) {
          return reject(new Error('Failed to generate spreadsheet for engwales'))
        }
        resolve('')
      });
  })
}

function dockerKillAll() {
  return new Promise((resolve, reject) => {
    exec("docker kill $(docker ps -qa)", { },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        // if (error) {
        //   return reject(new Error('Failed to generate spreadsheet for engwales'))
        // }
        resolve('')
      });
  })
}

function dockerRmAll() {
  return new Promise((resolve, reject) => {
    exec("docker rm $(docker ps -qa)", { },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        // if (error) {
        //   return reject(new Error('Failed to generate spreadsheet for engwales'))
        // }
        resolve('')
      });
  })
}

function dockerSystemPrune() {
  return new Promise((resolve, reject) => {
    exec("docker system prune --volumes -f", { },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        // if (error) {
        //   return reject(new Error('Failed to generate spreadsheet for engwales'))
        // }
        resolve('')
      });
  })
}

function dockerImageRm() {
  return new Promise((resolve, reject) => {
    exec("docker image rm \$(docker image ls)", { },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        // if (error) {
        //   return reject(new Error('Failed to generate spreadsheet for engwales'))
        // }
        resolve('')
      });
  })
}