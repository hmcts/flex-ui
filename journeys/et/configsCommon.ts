import { session } from 'app/session'
import { Journey } from 'types/journey'
import { prompt } from 'inquirer'
import { Region, saveBackToProject } from 'app/et/configs'
import { setIPToHostDockerInternal, setIPToWslHostAddress } from './dockerUpdateIP'
import { execCommand, format, getFiles, getIdealSizeForInquirer, isRunningInWsl, temporaryLog, wait } from 'app/helpers'
import { createReadStream, statSync } from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { YES, YES_OR_NO } from 'app/constants'
import { cookieJarToString, loginToIdam } from './webCreateCase'
import { sep } from 'path'
import { fixExitedContainers } from 'app/et/docker'

const QUESTION_TASK = 'What stages of import are you interested in?'
const QUESTION_ENVIRONMENT = 'What environment should we generate spreadsheets for?'
const QUESTION_IP = 'What IP should be used for ExUI to talk to callbacks?'
const QUESTION_UPLOAD = 'Would you like to upload configs to the {0} environment?'

const CHOICE_SAVE = 'Save in-memory config'
const CHOICE_GENERATE = 'Generate spreadsheets from JSON files'
const CHOICE_IMPORT = 'Import spreadsheet configs into local CCD'

const IMPORT_SCRIPT = `${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh`

const IP_OPTS = [
  '<- Cancel and go back to main menu',
  'host.docker.internal (if callbacks runs on Windows/Mac)',
  'WSL IP (if callbacks runs inside WSL)'
]

const ENV_CONFIG = {
  USER: '',
  PASS: '',
  BASE_URL: '',
  IDAM_LOGIN_START_URL: ''
}

export function getConfigChoices() {
  return {
    SAVE_TO_JSON: `${CHOICE_SAVE} (${session.name}) back to JSON files`,
    GENERATE: CHOICE_GENERATE,
    IMPORT: CHOICE_IMPORT
  }
}

export async function askConfigTasks() {
  const TASK_CHOICES = getConfigChoices()

  let answers = await prompt([
    { name: 'tasks', message: QUESTION_TASK, type: 'checkbox', choices: Object.values(TASK_CHOICES), default: Object.values(TASK_CHOICES).slice(0, 3), pageSize: getIdealSizeForInquirer() }
  ])

  if (answers.tasks.includes(TASK_CHOICES.GENERATE) && !answers.tasks.includes(TASK_CHOICES.IMPORT)) {
    answers = await prompt([{ name: 'env', message: QUESTION_ENVIRONMENT, default: 'local', filter: (input: string) => input.toLowerCase() }], answers)
  } else {
    answers.env = 'local'
  }

  const isInWsl = await isRunningInWsl() ? IP_OPTS[2] : IP_OPTS[1]

  if (answers.tasks.includes(TASK_CHOICES.GENERATE) && answers.env === 'local') {
    answers = await prompt([{ name: 'ip', message: QUESTION_IP, type: 'list', choices: IP_OPTS, default: isInWsl }], answers)
  }

  if (answers.ip === IP_OPTS[0]) {
    return answers
  }

  if (answers.env !== 'local') {
    answers = await prompt([{ name: 'upload', message: format(QUESTION_UPLOAD, answers.env), type: 'list', choices: YES_OR_NO, default: YES }], answers)
  }

  return answers
}

export async function configsJourney() {
  const answers = await askConfigTasks()
  return await execConfigTasks(answers)
}

export async function execConfigTasks(answers: Record<string, any>) {
  const choices = getConfigChoices()
  const tasks = answers.tasks as string[]
  const env = answers.env

  if (answers.ip === IP_OPTS[0]) {
    return
  }

  if (tasks.find(o => o.startsWith(CHOICE_SAVE))) {
    await saveBackToProject()
  }

  if (answers.ip?.startsWith("host")) {
    await setIPToHostDockerInternal()
  } else if (answers.ip?.startsWith("WSL")) {
    await setIPToWslHostAddress()
  }

  if (tasks.includes(choices.GENERATE)) {
    await generateSpreadsheets(env)
  }

  if (tasks.includes(choices.IMPORT)) {
    await importConfigs()
  }

  if (answers.upload === YES) {
    setCredentialsForEnvironment(answers.env)
    const cookieJar = await loginToIdam(ENV_CONFIG.USER, ENV_CONFIG.PASS, ENV_CONFIG.BASE_URL)
    const cookie = cookieJarToString(cookieJar)
    temporaryLog(`Uploading ${answers.env} configs for ET_EnglandWales... `)
    await uploadConfig(process.env.ENGWALES_DEF_DIR, answers.env, cookie)
    temporaryLog(`Uploading ${answers.env} configs for ET_Scotland... `)
    await uploadConfig(process.env.SCOTLAND_DEF_DIR, answers.env, cookie)
  }
}

export async function generateSpreadsheets(env = 'local') {
  await execCommand(`yarn generate-excel-${env}`, process.env.ENGWALES_DEF_DIR)
  temporaryLog(`Spreadsheets generated successfully for ET_EnglandWales - ${env}`)
  await execCommand(`yarn generate-excel-${env}`, process.env.SCOTLAND_DEF_DIR)
  temporaryLog(`Spreadsheets generated successfully for ET_Scotland - ${env}`)
}

function getDefinitionPath(region: Region, env = 'local') {
  if (region === Region.EnglandWales) {
    return `${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-${env}.xlsx`
  }
  return `${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-${env}.xlsx`
}

export async function ccdImport(region: Region, env = 'local') {
  const definitionFile = getDefinitionPath(region, env)
  temporaryLog(`Importing for ${region}`)
  const { stdout } = await execCommand(`${IMPORT_SCRIPT} ${definitionFile}`)
  if (stdout.includes('Case Definition data successfully imported')) {
    return
  }

  if (stdout.includes('transaction timeout')) {
    temporaryLog(`Got transaction timeout when importing ${region} - Waiting for 5 seconds before trying again...`)
    await wait(5000)
    return ccdImport(region, env)
  }
  console.error(`ERROR for ${region}: ${stdout}`)
}

export async function importConfigs() {
  await fixExitedContainers()
  await ccdImport(Region.EnglandWales)
  await ccdImport(Region.Scotland)
}

async function uploadConfig(dir: string, env: string, cookie: string) {
  const files = await getFiles(`${dir}/definitions/xlsx`)
  const configFile = files.find(o => o.match(new RegExp(`et-(englandwales|scotland)-ccd-config-${env}\\.xlsx`)))

  if (!configFile) {
    return console.log(`✕ (could not find generated config file)`)
  }

  const form = new FormData()
  const stats = statSync(configFile)
  const fileSizeInBytes = stats.size
  const fileStream = createReadStream(configFile)
  form.append('file', fileStream, { knownLength: fileSizeInBytes })

  const res = await fetch(`${ENV_CONFIG.BASE_URL}/import`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      referrer: ENV_CONFIG.BASE_URL,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    },
    body: form
  })

  const text = await res.text()

  if (text.includes('Case Definition data successfully imported')) {
    return console.log(`✓`)
  }

  if (await verifyUpload(cookie)) {
    return console.log(`✓`)
  }

  return console.log(`✕ (returned ${res.status} and could not find history record)`)
}

async function verifyUpload(cookie: string) {
  const res = await fetch(`${ENV_CONFIG.BASE_URL}/import`, {
    method: 'GET',
    headers: {
      Cookie: cookie,
      referrer: ENV_CONFIG.BASE_URL,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    }
  })

  const text = await res.text()

  const matchResults = text.match(/(\d+)_et-(englandwales|scotland)-ccd-config-demo\.xlsx/)
  const firstMatch = matchResults?.[0]

  const date = new Date(firstMatch?.substring(0, 14).replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6') || 0)

  if (Date.now() - date.getTime() > 1000 * 60) {
    return false
  }

  return true
}

function setCredentialsForEnvironment(env: string) {
  const user = process.env[`${env.toUpperCase()}_IMPORT_USER`]
  const pass = process.env[`${env.toUpperCase()}_IMPORT_PASS`]
  const url = process.env[`${env.toUpperCase()}_IMPORT_URL`]

  if (!user || !pass || !url) {
    throw new Error(`Could not find credentials for environment - Please make sure ${env.toUpperCase()}_IMPORT_USER, ${env.toUpperCase()}_IMPORT_PASS and ${env.toUpperCase()}_IMPORT_URL are set as environment variables`)
  }

  ENV_CONFIG.USER = user
  ENV_CONFIG.PASS = pass
  ENV_CONFIG.BASE_URL = url.endsWith('/') ? url.slice(0, -1) : url
  ENV_CONFIG.IDAM_LOGIN_START_URL = `${ENV_CONFIG.BASE_URL}/auth/login`
}

export default {
  group: 'et-configs',
  text: 'Config (JSON/XLSX) Manipulation',
  fn: configsJourney,
  alias: 'ConfigCommon'
} as Journey
