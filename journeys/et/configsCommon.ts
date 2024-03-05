import { session } from 'app/session'
import { Journey } from 'types/journey'
import { prompt } from 'inquirer'
import { Region, saveBackToProject } from 'app/et/configs'
import { setIPToHostDockerInternal, setIPToWslHostAddress } from './dockerUpdateIP'
import { execCommand, format, getFiles, getIdealSizeForInquirer, isRunningInWsl, retryFetch, temporaryLog, unescapeHtml, wait } from 'app/helpers'
import { createReadStream, readFileSync, statSync } from 'fs'
import FormData from 'form-data'
import { YES, YES_OR_NO } from 'app/constants'
import { ENV_CONFIG, loginToIdam, setCredentialsForEnvironment } from './webCreateCase'
import { sep } from 'path'
import { fixExitedContainers } from 'app/et/docker'
import { writeFile } from 'fs/promises'
import fetch from 'node-fetch'
import { cookieJarToString } from 'app/cookieJar'
import { askAutoComplete } from 'app/questions'

const QUESTION_TASK = 'What stages of import are you interested in?'
const QUESTION_ENVIRONMENT = 'What environment should we generate spreadsheets for?'
const QUESTION_IP = 'What IP should be used for ExUI to talk to callbacks?'
const QUESTION_UPLOAD = 'Would you like to upload configs to the {0} environment?'
const QUESTION_PR = 'What PR number are we using for preview?'

const CHOICE_SAVE = 'Save in-memory config'
export const CHOICE_GENERATE = 'Generate spreadsheets from JSON files'
const CHOICE_IMPORT = 'Import spreadsheet configs into local CCD'

const IMPORT_SCRIPT = `${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh`
const IMPORT_SCRIPT_CFTLIB = `${process.env.ET_CCD_CALLBACKS_DIR}/bin/utils/ccd-import-definition.sh`

const IP_OPTS = [
  '<- Cancel and go back to main menu',
  'host.docker.internal (if callbacks runs on Windows/Mac)',
  'WSL IP (if callbacks runs inside WSL)'
]

async function getEnvOptionsFromPackage() {
  const { stdout } = await execCommand('cat package.json', process.env.ENGWALES_DEF_DIR, true)
  const json = JSON.parse(stdout)
  return Object.keys(json.scripts).filter(o => o.startsWith('generate-excel-')).map(o => o.replace('generate-excel-', '').toLowerCase())
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
    const opts = await getEnvOptionsFromPackage()
    answers = await askAutoComplete(answers, { name: 'env', message: QUESTION_ENVIRONMENT, choices: opts, default: 'local', filter: (input: string) => input.toLowerCase() })
  } else {
    answers.env = process.env.CFTLIB ? 'cftlib' : 'local'
  }

  const isInWsl = await isRunningInWsl() ? IP_OPTS[2] : IP_OPTS[1]

  if (answers.tasks.includes(TASK_CHOICES.GENERATE) && answers.env === 'local') {
    answers = await prompt([{ name: 'ip', message: QUESTION_IP, type: 'list', choices: IP_OPTS, default: isInWsl }], answers)
  }

  if (answers.ip === IP_OPTS[0]) {
    return answers
  }

  if (!['local', 'cftlib'].includes(answers.env)) {
    answers = await prompt([{ name: 'upload', message: format(QUESTION_UPLOAD, answers.env), type: 'list', choices: YES_OR_NO, default: YES }], answers)
  }

  if (answers.env === 'preview') {
    const currentPR = await getCurrentPreviewPRNumber()
    answers = await prompt([{ name: 'pr', message: QUESTION_PR, default: currentPR }], answers)
  }

  return answers
}

export async function changePreviewPRForEnv(defPath: string, prNumber: string) {
  const envJsonPath = `${defPath}${sep}env.json`
  const envJson = JSON.parse(readFileSync(envJsonPath, 'utf-8'))
  const adminUrlSuffix = `et-ccd-definitions-admin-pr-${prNumber}.preview.platform.hmcts.net`
  envJson.preview.ET_COS_URL = `https://et-cos-${adminUrlSuffix}`
  envJson.preview.CCD_DEF_URL = `https://ccd-data-store-api-${adminUrlSuffix}`
  envJson.preview.CCD_DEF_AAC_URL = `https://aac-${adminUrlSuffix}`
  await writeFile(envJsonPath, JSON.stringify(envJson, null, 2))
}

export async function getCurrentPreviewPRNumber() {
  const envJsonPath = `${process.env.ENGWALES_DEF_DIR}${sep}env.json`
  const envJson = JSON.parse(readFileSync(envJsonPath, 'utf-8'))
  const regex = /https:\/\/et-cos-et-ccd-definitions-admin-pr-(\d+).preview.platform.hmcts.net/g
  return regex.exec(envJson.preview.ET_COS_URL)?.[1] || '121' // Default to 121 (Release-2.2)
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

  if (answers.ip?.startsWith("WSL")) {
    await setIPToWslHostAddress()
  } else {
    await setIPToHostDockerInternal()
  }

  if (tasks.includes(choices.GENERATE)) {
    if (answers.pr) {
      await changePreviewPRForEnv(process.env.ENGWALES_DEF_DIR, answers.pr)
      await changePreviewPRForEnv(process.env.SCOTLAND_DEF_DIR, answers.pr)
    }
    await generateSpreadsheetsForBothRepos(env, answers.pr)
  }

  if (tasks.includes(choices.IMPORT)) {
    await importConfigs()
  }

  if (answers.upload === YES) {
    await uploadToEnvironment(env, answers.pr)
  }
}

export async function uploadToEnvironment(env: string, pr?: string) {
  setCredentialsForEnvironment(env, pr)
  const cookieJar = await loginToIdam(ENV_CONFIG.IMPORT_USER, ENV_CONFIG.IMPORT_PASS, ENV_CONFIG.IMPORT_URL)
  const cookie = cookieJarToString(cookieJar)
  temporaryLog(`Uploading ${env} configs for ET_EnglandWales... `)
  await uploadConfig(process.env.ENGWALES_DEF_DIR, env, cookie)
  temporaryLog(`Uploading ${env} configs for ET_Scotland... `)
  await uploadConfig(process.env.SCOTLAND_DEF_DIR, env, cookie)
}

export async function generateSpreadsheetsForBothRepos(env = 'local', pr?: string) {
  await generateSpreadsheets(Region.EnglandWales, env, pr)
  await generateSpreadsheets(Region.Scotland, env, pr)
}

export async function generateSpreadsheets(region: Region, env = 'local', pr?: string) {
  temporaryLog(`Generating spreadsheets for ${region} - ${env}`)
  const definitionPath = getDefinitionRepo(region)
  const command = `yarn generate-excel-${env} ${pr || ''}`
  const ew = await execCommand(command, definitionPath, false)
  if (!ew.err) {
    return
  }

  // Run npm install and retry
  temporaryLog(`yarn generate failed - running yarn install and retrying`)
  await execCommand('yarn install', definitionPath)
  await execCommand(command, definitionPath, false)
  return temporaryLog(`Spreadsheets generated successfully for ${region} - ${env} ${pr || ''}`)
}

function getDefinitionRepo(region: Region) {
  return region === Region.EnglandWales ? process.env.ENGWALES_DEF_DIR : process.env.SCOTLAND_DEF_DIR
}

function getDefinitionSpreadsheetFile(region: Region, env = 'local') {
  if (region === Region.EnglandWales) {
    return `${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-${env}.xlsx`
  }
  return `${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-${env}.xlsx`
}

export async function ccdImport(region: Region, env = process.env.CFTLIB ? 'cftlib' : 'local') {
  const definitionFile = getDefinitionSpreadsheetFile(region, env)
  temporaryLog(`Importing for ${region}`)
  const script = process.env.CFTLIB ? IMPORT_SCRIPT_CFTLIB : IMPORT_SCRIPT
  const { stdout } = await execCommand(`${script} ${definitionFile}`)
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
  env = env.replace('-prod', '')
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

  const res = await fetch(`${ENV_CONFIG.IMPORT_URL}/import`, {
    method: 'POST',
    headers: {
      Cookie: cookie,
      referrer: ENV_CONFIG.IMPORT_URL,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    },
    body: form
  })

  const text = await res.text()

  if (text.includes('Case Definition data successfully imported')) {
    return console.log(`✓`)
  }

  if (text.includes('govuk-error-message')) {
    const error = extractErrorMessageFromHtml(text)
    return console.log(`✕ (returned ${error.code} with ${error.message})`)
  }

  if (await verifyUpload(cookie)) {
    return console.log(`✓`)
  }

  return console.log(`✕ (returned ${res.status} and could not find history record)`)
}

function extractErrorMessageFromHtml(text: string) {
  let error = unescapeHtml(text.substring(text.indexOf('govuk-error-message'))).replace(/\n/g, '').replace(/  /g, '')

  const regex = /govuk-error-message.+?<p>(.+?)<\/p><p>(.+?)<\/p>/gm.exec(error)

  if (!regex) {
    return { code: 0, message: error }
  }

  const message = regex[2]

  if (message.startsWith('{"message"')) {
    try {
      const json = JSON.parse(message)
      return { code: regex[1], message: json.message }
    } catch (e) { }
  }

  return { code: regex[1], message }
}

async function verifyUpload(cookie: string) {
  const res = await retryFetch(`${ENV_CONFIG.EXUI_URL}/import`, {
    method: 'GET',
    headers: {
      Cookie: cookie,
      referrer: ENV_CONFIG.EXUI_URL,
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

export default {
  group: 'et-configs',
  text: 'Config (JSON/XLSX) Manipulation',
  fn: configsJourney,
  alias: 'ConfigCommon'
} as Journey
