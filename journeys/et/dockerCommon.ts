import { Journey } from 'types/journey'
import { prompt } from 'inquirer'
import { ccdComposePull, ccdComposeUp, ccdInit, ccdLogin, doAllContainersExist, dockerDeleteVolumes, dockerSystemPrune, initDb, initEcm, isDmStoreReady, killAndRemoveContainers, rebootDmStore, recreateWslUptimeContainer } from 'app/et/docker'
import { askConfigTasks, execConfigTasks } from './configsCommon'
import { execCommand, getIdealSizeForInquirer, temporaryLog, wait } from 'app/helpers'
import { askCreateCaseQuestions, doCreateCaseTasks } from './webCreateCase'
import { NO, YES } from 'app/constants'
import { getWslHostIP } from './dockerUpdateIP'

const QUESTION_TASK = 'What stages of setup are you interested in?'

export async function configsJourney() {
  const TASK_CHOICES = {
    RESTART_WSL_UPTIME: `Restart the wsl-uptime container (${(await hasWslIPChanged()) ? 'RECOMMENDED - IP MISMATCH' : 'not needed'})`,
    DOWN_CONTAINERS: `Kill and remove docker containers associated with ExUI`,
    REMOVE_VOLUMES: 'Delete volumes associated with old containers (useful for clearing elastic search errors)',
    PRUNE: 'Docker prune to get rid of everything not currently in use (docker system prune --volumes -f)',
    PULL: 'Pull the latest images (./ccd compose pull)',
    INIT_CCD: 'Create ccd network in docker (only needed if docker was destroyed) (./ccd init)',
    UP: 'Run up/build containers from existing images (./ccd compose up -d)',
    INIT_ECM: 'Add users and ccd roles (./bin/ecm/init-ecm.sh)',
    INIT_CALLBACKS: 'Initialize database (./bin/init-db.sh)',
    CONFIGS: 'Choose what to do with configs...',
    CREATE_CASE: 'Create a case...'
  }

  const defaults = [
    TASK_CHOICES.UP
  ]

  if (await hasWslIPChanged()) {
    defaults.push(TASK_CHOICES.RESTART_WSL_UPTIME)
  }

  if (!await doAllContainersExist()) {
    Object.values(TASK_CHOICES).slice(1).forEach(o => defaults.push(o))
  }

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
  const ip = /WSL_HOSTNAME=([0-9.]+)/.exec(stdout)[1]
  return ip
}

async function hasWslIPChanged() {
  const containerIP = await getWslUptimeContainerIP()
  const actualIP = await getWslHostIP()
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
