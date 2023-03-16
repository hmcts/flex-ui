import { Journey } from 'types/journey'
import { prompt } from 'inquirer'
import { ccdComposePull, ccdComposeUp, ccdInit, ccdLogin, doAllContainersExist, dockerDeleteVolumes, dockerSystemPrune, getExitedContainers, initDb, initEcm, isContainerRunning, isDmStoreReady, killAndRemoveContainers, rebootDmStore, recreateWslUptimeContainer, WSL_UPTIME_CONTAINER_NAME } from 'app/et/docker'
import { askConfigTasks, execConfigTasks } from './configsCommon'
import { execCommand, getIdealSizeForInquirer, temporaryLog, wait } from 'app/helpers'
import { askCreateCaseQuestions, doCreateCaseTasks } from './webCreateCase'
import { NO, YES } from 'app/constants'
import { getHostnameIP } from './dockerUpdateIP'

const QUESTION_TASK = 'What stages of setup are you interested in?'

interface TASK_CHOICES {
  RESTART_WSL_UPTIME: string
  DOWN_CONTAINERS: string
  REMOVE_VOLUMES: string
  PRUNE: string
  PULL: string
  INIT_CCD: string
  UP: string
  INIT_ECM: string
  INIT_CALLBACKS: string
  CONFIGS: string
  CREATE_CASE: string
}

async function getDefaultTasks(tasks: TASK_CHOICES) {
  const defaults = [
    tasks.UP
  ]

  if (!await doAllContainersExist(['ethos-logstash'])) {
    return Object.values(tasks).slice(1)
  }

  if (await hasWslIPChanged() || !await isContainerRunning(WSL_UPTIME_CONTAINER_NAME)) {
    defaults.push(tasks.RESTART_WSL_UPTIME)
    defaults.push(tasks.CONFIGS)
  }

  const exitedContainers = await getExitedContainers()
  if (exitedContainers.length > 0) {
    const minUpContainers = [tasks.INIT_ECM, tasks.INIT_CALLBACKS, tasks.CONFIGS]
    minUpContainers.forEach(o => defaults.push(o))
  }

  return defaults
}

export async function configsJourney() {
  const { stdout } = await execCommand('docker info', undefined, false)
  if (stdout.includes("The command 'docker' could not be found")) {
    throw new Error('Connection with docker failed, restart docker')
  }

  const wslAddon = await hasWslIPChanged() ? 'RECOMMENDED - IP MISMATCH' : await isContainerRunning(WSL_UPTIME_CONTAINER_NAME) ? 'Not needed' : 'CONTAINER EXITED'

  const TASK_CHOICES = {
    RESTART_WSL_UPTIME: `Restart the wsl-uptime container (${wslAddon})`,
    DOWN_CONTAINERS: `Kill and remove docker containers associated with ExUI`,
    REMOVE_VOLUMES: 'Delete volumes associated with old containers (useful for clearing elastic search errors)',
    PRUNE: 'Docker prune to get rid of everything not currently in use (docker system prune --volumes -f && docker image prune -f -a)',
    PULL: 'Pull the latest images (./ccd compose pull)',
    INIT_CCD: 'Create ccd network in docker (only needed if docker was destroyed) (./ccd init)',
    UP: 'Run up/build containers from existing images (./ccd compose up -d)',
    INIT_ECM: 'Add users and ccd roles (./bin/ecm/init-ecm.sh)',
    INIT_CALLBACKS: 'Initialize database (./bin/init-db.sh)',
    CONFIGS: 'Choose what to do with configs...',
    CREATE_CASE: 'Create a case...'
  } as TASK_CHOICES

  const defaults = await getDefaultTasks(TASK_CHOICES)

  const answers = await prompt([
    { name: 'tasks', message: QUESTION_TASK, type: 'checkbox', choices: Object.values(TASK_CHOICES), default: defaults, pageSize: getIdealSizeForInquirer() }
  ])

  let configAnswers: any = {}
  let createAnswers: any = { callbacks: answers.tasks.includes(TASK_CHOICES.INIT_CALLBACKS) ? YES : NO }

  if (answers.tasks.includes(TASK_CHOICES.CONFIGS)) {
    configAnswers = await askConfigTasks()
  }

  if (answers.tasks.includes(TASK_CHOICES.CREATE_CASE)) {
    createAnswers = await askCreateCaseQuestions(createAnswers)
  }

  if (answers.tasks.includes(TASK_CHOICES.RESTART_WSL_UPTIME)) {
    await recreateWslUptimeContainer()
  }

  if (answers.tasks.includes(TASK_CHOICES.DOWN_CONTAINERS)) {
    await killAndRemoveContainers()
  }

  if (answers.tasks.includes(TASK_CHOICES.REMOVE_VOLUMES)) {
    await dockerDeleteVolumes()
  }

  if (answers.tasks.includes(TASK_CHOICES.PRUNE)) {
    await dockerSystemPrune()
  }

  if (answers.tasks.includes(TASK_CHOICES.PULL)) {
    await ccdLogin()
    await ccdComposePull()
  }

  if (answers.tasks.includes(TASK_CHOICES.INIT_CCD)) {
    await ccdInit()
  }

  if (answers.tasks.includes(TASK_CHOICES.UP)) {
    await ccdComposeUp()
    await waitForDmStore()
  }

  if (answers.tasks.includes(TASK_CHOICES.INIT_ECM)) {
    await initEcm()
  }

  if (answers.tasks.includes(TASK_CHOICES.INIT_CALLBACKS)) {
    await initDb()
  }

  if (answers.tasks.includes(TASK_CHOICES.CONFIGS)) {
    await execConfigTasks(configAnswers)
  }

  if (answers.tasks.includes(TASK_CHOICES.CREATE_CASE)) {
    await doCreateCaseTasks(createAnswers)
  }
}

export async function getWslUptimeContainerIP() {
  const { stdout } = await execCommand('docker container inspect wsl_uptime | grep WSL_HOSTNAME=', undefined, false)
  const ip = /WSL_HOSTNAME=([0-9.]+)/.exec(stdout)?.[1]
  return ip
}

async function hasWslIPChanged() {
  const containerIP = await getWslUptimeContainerIP()
  const actualIP = await getHostnameIP()
  return containerIP !== actualIP
}

async function waitForDmStore() {
  let timeout = 45
  let left = timeout

  while (!(await isDmStoreReady())) {
    temporaryLog(`Waiting for dm-store to be ready (or will restart in ${Math.round(left)} seconds)`)

    if (left <= 0) {
      // Makeshift backoff (45, 68, 102, 152 etc...)
      timeout *= 1.5
      left = timeout
      temporaryLog(`Restarting dm-store container`)
      await rebootDmStore()
    }

    await wait(10000)
    left -= 10
  }
}

export default {
  group: 'et-docker',
  text: 'Docker / ECM Setup',
  fn: configsJourney
} as Journey
