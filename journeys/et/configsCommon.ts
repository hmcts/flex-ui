import { session } from 'app/session'
import { Journey } from 'types/journey'
import { prompt } from 'inquirer'
import { saveBackToProject } from 'app/et/configs'
import { generateSpreadsheets } from './configsGenerateSpreadsheet'
import { importConfigs } from './configsImportCcd'
import { setIPToHostDockerInternal, setIPToWslHostAddress } from './dockerUpdateIP'
import { getFiles, temporaryLog } from 'app/helpers'
import { createReadStream, statSync } from 'fs'
import FormData from 'form-data'
import fetch from 'node-fetch'
import { YES, YES_OR_NO } from 'app/constants'
import { cookieJarToString, loginToIdam } from './webCreateCase'

const QUESTION_TASK = 'What stages of import are you interested in?'
const QUESTION_ENVIRONMENT = 'What environment should we generate spreadsheets for?'
const QUESTION_IP = 'What IP should be used for ExUI to talk to callbacks?'
const QUESTION_UPLOAD = 'Would you like to upload demo configs to the demo environment?'

const CHOICE_SAVE = 'Save in-memory config'
const CHOICE_GENERATE = 'Generate spreadsheets from JSON files'
const CHOICE_IMPORT = 'Import spreadsheet configs into local CCD'

const IP_OPTS = [
  'host.docker.internal (if callbacks runs on Windows/Mac)',
  'WSL IP (if callbacks runs inside WSL)'
]

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
    { name: 'tasks', message: QUESTION_TASK, type: 'checkbox', choices: Object.values(TASK_CHOICES), default: Object.values(TASK_CHOICES).slice(0, 3) },
  ])

  if (answers.tasks.includes(TASK_CHOICES.GENERATE) && !answers.tasks.includes(TASK_CHOICES.IMPORT)) {
    answers = await prompt([{ name: 'env', message: QUESTION_ENVIRONMENT, default: 'local' }], answers)
  } else {
    answers.env = 'local'
  }

  if (answers.tasks.includes(TASK_CHOICES.GENERATE) && answers.env === 'local') {
    answers = await prompt([{ name: 'ip', message: QUESTION_IP, type: 'list', choices: IP_OPTS, default: IP_OPTS[0] }], answers)
  }

  if (answers.env === 'demo') {
    answers = await prompt([{ name: 'upload', message: QUESTION_UPLOAD, type: 'list', choices: YES_OR_NO, default: YES }], answers)
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
    const cookieJar = await loginToIdam(process.env.DEMO_ADMIN_USER, process.env.DEMO_ADMIN_PASS, 'https://ccd-admin-web.demo.platform.hmcts.net')
    const cookie = cookieJarToString(cookieJar)
    await uploadConfig(process.env.ENGWALES_DEF_DIR, cookie)
    await uploadConfig(process.env.SCOTLAND_DEF_DIR, cookie)
  }
}

async function getCookieForDemoAdminInterface(user: string, pass: string) {
  // TODO lol
  return ''
}

async function uploadConfig(dir: string, cookie: string) {
  const files = await getFiles(`${dir}/definitions/xlsx`)
  const configFile = files.find(o => o.match(/et-(englandwales|scotland)-ccd-config-demo\.xlsx/))

  if (!configFile) {
    return temporaryLog(`Could not find a demo config file in ${dir}/definitions/xlsx`)
  }

  const form = new FormData();
  const stats = statSync(configFile);
  const fileSizeInBytes = stats.size;
  const fileStream = createReadStream(configFile);
  form.append('file', fileStream, { knownLength: fileSizeInBytes });

  await fetch('https://ccd-admin-web.demo.platform.hmcts.net/import', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      referrer: ' https://ccd-admin-web.demo.platform.hmcts.net/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    },
    body: form
  })

  return await verifyUpload(cookie)
}

async function verifyUpload(cookie: string) {
  const res = await fetch('https://ccd-admin-web.demo.platform.hmcts.net/import', {
    method: 'GET',
    headers: {
      Cookie: cookie,
      referrer: ' https://ccd-admin-web.demo.platform.hmcts.net/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    }
  })

  const text = await res.text()

  const matchResults = text.match(/(\d+)_et-(englandwales|scotland)-ccd-config-demo\.xlsx/)
  const firstMatch = matchResults?.[0]

  const date = new Date(firstMatch?.substring(0, 14).replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6') || 0)

  if (Date.now() - date.getTime() > 1000 * 60) {
    console.warn('Could not find an entry for our uploaded file ((\\d+)_et-(englandwales|scotland)-ccd-config-demo\\.xlsx) in the last 60 seconds - it may not have uploaded')
    return false
  }

  return true
}

export default {
  group: 'et-configs',
  text: 'Config (JSON/XLSX) Manipulation',
  fn: configsJourney
} as Journey
