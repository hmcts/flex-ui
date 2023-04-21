import { Journey } from 'types/journey'
import fetch, { RequestInit } from 'node-fetch'
import { resolve } from 'path'
import { prompt } from 'inquirer'
import https from 'node:https'
// eslint-disable-next-line n/no-deprecated-api
import { createReadStream, existsSync, statSync } from 'fs'
import { NO, YES, YES_OR_NO } from 'app/constants'
import { execCommand, getEnvVarsFromFile, getIdealSizeForInquirer, temporaryLog, wait } from 'app/helpers'
import { ChildProcess, exec } from 'child_process'
import { getWslHostIP, setIPToHostDockerInternal, setIPToWslHostAddress } from './dockerUpdateIP'
import { generateSpreadsheets, importConfigs } from './configsCommon'
import { fixExitedContainers } from 'app/et/docker'
import FormData from 'form-data'
import { Answers } from 'app/questions'
import { EOL } from 'os'

type CookieJar = Record<string, string>

https.globalAgent.options.rejectUnauthorized = false

// These login credentials are public and will only work when running the stack locally #secops
const USER_ORG = 'superuser@etorganisation1.com'
const PASS_ORG = 'Pa55word11'
const BASE_URL_ORG = 'http://localhost:3456'
const IDAM_LOGIN_START_URL_ORG = `${BASE_URL_ORG}/auth/login`

const ENV_CONFIG = {
  USER: 'et.dev@hmcts.net',
  PASS: 'Pa55word11',
  BASE_URL: 'http://localhost:3455',
  IDAM_LOGIN_START_URL: 'http://localhost:3455/auth/login'
}

const QUESTION_STEPS = 'What events are we interested in running?'
const QUESTION_CALLBACKS = 'Do we need to spin up callbacks first?'
const QUESTION_SHARE = 'Would you like to share this case with solicitor1@etorganisation1.com?'

const EVENT_OPTS = [
  'et1Vetting',
  'preAcceptanceCase',
  'et3Response',
  'addAmendHearing',
  'respondentTSE',
  'tseRespond',
  'tseAdmin',
  'tseAdmReply',
  'amendRespondentRepresentative',
  'sendNotification',
  'respondNotification',
  'pseRespondentRespondToTribunal'
]

const REGION_OPTS = [
  'ET_EnglandWales',
  'ET_Scotland'
]

const CREATE_OPTS = [
  'Create a new case',
  'Choose an existing case'
]

const ENV_OPTS = [
  'Local',
  'Preview',
  'Demo',
  'ITHC'
]

async function journey() {
  await askCreateOrExistingCase()
}

function setCredentialsForEnvironment(env: string) {
  const user = process.env[`${env.toUpperCase()}_IDAM_USER`]
  const pass = process.env[`${env.toUpperCase()}_IDAM_PASS`]
  const url = process.env[`${env.toUpperCase()}_EXUI_URL`]

  if (!user || !pass || !url) {
    throw new Error(`Could not find credentials for environment - Please make sure ${env.toUpperCase()}_IDAM_USER, ${env.toUpperCase()}_IDAM_PASS and ${env.toUpperCase()}_EXUI_URL are set as environment variables`)
  }

  ENV_CONFIG.USER = user
  ENV_CONFIG.PASS = pass
  ENV_CONFIG.BASE_URL = url
  ENV_CONFIG.IDAM_LOGIN_START_URL = `${url}/auth/login`
}

async function askCreateOrExistingCase() {
  let answers = await prompt([
    { name: 'env', message: 'Which environment are we targeting?', type: 'list', choices: ENV_OPTS, default: ENV_OPTS[0] },
    { name: 'create', message: 'Do you want to create a new case or run an event on an existing case?', type: 'list', choices: CREATE_OPTS }
  ])

  setCredentialsForEnvironment(answers.env)

  if (answers.create === CREATE_OPTS[0]) {
    return await doCreateCaseTasks(await askCreateCaseQuestions())
  }

  temporaryLog(`Fetching existing cases...`)

  const cookieJar = await loginToIdam()

  const cases = [
    ...await findExistingCases('ET_EnglandWales', cookieJar),
    ...await findExistingCases('ET_Scotland', cookieJar)
  ]

  if (!cases.length) {
    // There are no cases - this may or may not be truthful (known issue with exui)
    // TODO: How does CitUI get this data?
    console.log(`There were no cases returned by ExUI. Aborting...`)
    return
  }

  answers = await prompt([{ name: 'cases', message: 'Select a case', type: 'list', choices: cases.map(o => o.alias), pageSize: getIdealSizeForInquirer() }])
  const selectedCase = cases.find(o => o.alias === answers.cases)
  const region = selectedCase.case_fields['[CASE_TYPE]']

  const followup = await askCreateCaseQuestions({ region: [region], caseId: selectedCase.caseId })
  return await doCreateCaseTasks(followup)
}

export async function askCreateCaseQuestions(answers: Answers = {}) {
  const whenLocalEnv = () => ENV_CONFIG.BASE_URL.includes('localhost')
  return await prompt([
    { name: 'region', message: 'What regions are we creating for?', type: 'checkbox', choices: REGION_OPTS, default: REGION_OPTS, pageSize: getIdealSizeForInquirer() },
    { name: 'events', message: QUESTION_STEPS, type: 'checkbox', choices: EVENT_OPTS, default: EVENT_OPTS, pageSize: getIdealSizeForInquirer() },
    { name: 'share', message: QUESTION_SHARE, type: 'list', choices: YES_OR_NO, default: NO, when: whenLocalEnv },
    { name: 'callbacks', message: QUESTION_CALLBACKS, type: 'list', choices: YES_OR_NO, default: answers.callbacks || NO, askAnswered: true, when: whenLocalEnv },
    { name: 'kill', message: 'Do you want to kill callbacks after?', type: 'list', choices: YES_OR_NO, default: YES, when: (ans) => ans.callbacks === YES }
  ], answers)
}

async function killProcessesOnPort8081() {
  return await execCommand(`lsof -i:8081 -Fp | head -n 1 | sed 's/^p//' | xargs kill`, undefined, false)
}

export async function doCreateCaseTasks(answers: Record<string, any>) {
  const needToRevert = getWslHostIP() === 'host.docker.internal'

  if (answers.callbacks === YES) {
    await killProcessesOnPort8081()
    await setIPToWslHostAddress()
    await generateSpreadsheets('local')
    await importConfigs()
    try {
      await startAndWaitForCallbacksToBeReady()
    } catch (e) {
      console.log(e.message)
      console.log(`Failed to start callbacks - aborting journey :(`)
      return
    }
    temporaryLog('Callbacks has started up')
  }

  if (answers.share === YES && !answers.events.includes('amendRespondentRepresentative')) {
    answers.events.push('amendRespondentRepresentative')
  }

  if (ENV_CONFIG.BASE_URL.includes('localhost')) {
    await fixExitedContainers()
  }

  const cookieJar = await loginToIdam()

  for (const region of answers.region) {
    try {
      const caseId = answers.caseId ?? await createNewCase(region, cookieJar)
      await executeEventsOnCase(cookieJar, caseId, region, answers.events)

      if (answers.share === YES) {
        temporaryLog(`Finializing sharing case...`)

        const result = await shareACase(caseId, region)
        if (result === 201) {
          console.log(`✓`)
        } else {
          console.log(`✕ (returned ${result})`)
        }
      }
    } catch (e) {
      console.log(`Failed on ${region} because ${e.message}`)
    }
  }

  if (answers.kill === YES) {
    await killProcessesOnPort8081()
    if (needToRevert) {
      await setIPToHostDockerInternal()
      await generateSpreadsheets('local')
      await importConfigs()
    }
  }
}

export async function startAndWaitForCallbacksToBeReady(): Promise<ChildProcess> {
  const command = `./gradlew bootRun --args='--spring.profiles.active=dev'`
  return await new Promise((resolve, reject) => {
    const stdout: string[] = []
    const stderr: string[] = []
    const start = Date.now()

    const cleanupAndExit = (fn: () => void) => {
      clearInterval(interval)
      fn()
    }

    const interval = setInterval(() => {
      if (stdout.find(o => o.includes("Started DocmosisApplication"))) {
        cleanupAndExit(() => resolve(child))
      }

      if (stdout.find(o => o.includes("APPLICATION FAILED TO START"))) {
        cleanupAndExit(() => reject(stdout.join('')))
      }

      temporaryLog(`Waiting for Callbacks to start up (${Math.round(((Date.now() - start) / 1000))} seconds)`)
    }, 1000)

    const child: ChildProcess = exec(command, { cwd: process.env.ET_CCD_CALLBACKS_DIR, env: { ...process.env, ...getEnvVarsFromFile() } }, err => {
      if (err) {
        return cleanupAndExit(() => reject(err))
      }

      return cleanupAndExit(() => resolve(child))
    })

    child.stdout?.on('data', data => {
      stdout.push(data)
    })

    child.stderr?.on('data', data => {
      stderr.push(data)
    })
  })
}

export async function getInitialLoginUrl(url: string = ENV_CONFIG.IDAM_LOGIN_START_URL) {
  const res = await fetch(url, { redirect: 'manual' })

  if (res.status !== 302) {
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status}`)
  }

  const cookieJar = { seen_cookie_message: 'yes', cookies_policy: '{ "essential": true, "analytics": false, "apm": false }', cookies_preferences_set: 'false' }

  return {
    location: res.headers.get('location') || '',
    cookieJar: addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  }
}

export async function getCsrfTokenFromLoginPage(authUrl: string, cookieJar: CookieJar) {
  const res = await fetch(authUrl)
  const html = await res.text()
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  return /name="_csrf" value="([0-9a-f-]+)"/.exec(html)?.[1]
}

export async function loginToIdam(username = ENV_CONFIG.USER, password = ENV_CONFIG.PASS, unauthorisedUrl = ENV_CONFIG.IDAM_LOGIN_START_URL) {
  const { location: authUrl, cookieJar } = await getInitialLoginUrl(unauthorisedUrl)
  const csrf = await getCsrfTokenFromLoginPage(authUrl, cookieJar)

  const body = objToFormData({ username, password, save: 'Sign in', selfRegistrationEnabled: 'true', azureLoginEnabled: 'true', mojLoginEnabled: 'true', _csrf: csrf })

  const res = await fetch(authUrl, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      referrer: authUrl,
      Cookie: cookieJarToString(cookieJar),
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    },
    redirect: 'manual'
  })

  // Responds with set cookies and a redirect url that we'll need to extract values from

  if (res.status !== 302) {
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status}`)
  }

  const redirectUrl = res.headers.get('location') || ''
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  const cookieHeader = cookieJarToString(cookieJar)

  const callbackRes = await fetch(redirectUrl, {
    method: 'get',
    headers: {
      Cookie: cookieHeader
    },
    redirect: 'manual'
  })

  addToCookieJarFromRawSetCookieHeader(callbackRes.headers.raw()['set-cookie'], cookieJar)

  // Artifical wait here because authenticated requests tend to fail if made too soon
  await wait(5000)
  return cookieJar
}

function objToFormData(obj: Record<string, string>) {
  return Object.keys(obj).map(o => `${o}=${encodeURIComponent(obj[o])}`).join('&').replace(/%20/g, '+')
}

export function cookieJarToString(jar: Record<string, string>) {
  return Object.keys(jar).map(o => `${o}=${jar[o]}`).join('; ')
}

function addToCookieJarFromRawSetCookieHeader(rawHeader: string[], jar: CookieJar = {}) {
  return rawHeader?.reduce((acc, obj) => {
    const [, key, value] = /(.+?)=((.+?);|(.+))/g.exec(obj) || []
    if (!key || !value) return acc
    acc[key] = value.replace(';', '')
    return acc
  }, jar) || jar
}

async function makeAuthorisedRequest(url: string, cookieJar: CookieJar, opts: RequestInit = {}) {
  if (!opts.headers) {
    opts.headers = {}
  }

  if (!(opts.headers as any).Cookie) {
    (opts.headers as any).Cookie = cookieJarToString(cookieJar)
  }

  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:102.0) Gecko/20100101 Firefox/102.0',
    Accept: '*/*',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Referer: ENV_CONFIG.BASE_URL,
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    Pragma: 'no-cache',
    'Cache-Control': 'no-cache',
    'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
    experimental: 'true'
  }

  for (const headerName in defaultHeaders) {
    if ((opts.headers as any)[headerName]) continue

    (opts.headers as any)[headerName] = defaultHeaders[headerName]
  }

  const res = await fetch(url, opts)
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'])

  return res
}

export async function createNewCase(region: string, cookieJar: CookieJar) {
  const eventToken = await createCaseInit(cookieJar, region)
  return await postCase(cookieJar, eventToken, region)
}

async function executeEventsOnCase(cookieJar: CookieJar, caseId: string, region: string, events: string[]) {
  const uuidDoc = await uploadTestFile(cookieJar)

  for (const event of events) {
    temporaryLog(`${event}... `)
    const eventToken = await pingEventTrigger(caseId, event, cookieJar)
    const result = await postGeneric(event, caseId, cookieJar, eventToken, region, uuidDoc)

    if (result === 201) {
      console.log(`✓`)
    } else if (typeof (result) === 'number') {
      console.log(`✕ (returned ${result})`)
    } else {
      console.log(`✕ ${EOL}${result.join(EOL)}${EOL}`)
    }
  }
}

async function createCaseInit(cookieJar: CookieJar, region = 'ET_EnglandWales') {
  const url = `${ENV_CONFIG.BASE_URL}/data/internal/case-types/${region}/event-triggers/initiateCase?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  if (res.status !== 200) {
    throw new Error(`Failed event trigger to initiate new case for ${region}. (${json?.message || ''} - ${res.status})`)
  }

  return json.event_token
}

function tryGetResource(jsonResourcePath: string, region: string) {
  const genericJson = resolve(process.env.APP_ROOT, `../et/resources/${jsonResourcePath}.json`)
  const regionJson = resolve(process.env.APP_ROOT, `../et/resources/${jsonResourcePath}.${region === 'ET_Scotland' ? 'scotland' : 'england'}.json`)
  if (existsSync(regionJson)) {
    return regionJson
  }

  if (existsSync(genericJson)) {
    return genericJson
  }

  throw new Error(`Could not find requested file ${genericJson} or ${regionJson}`)
}

async function postGeneric(jsonResourcePath: string, caseId: string, cookieJar: CookieJar, eventToken: string, region: string, testFileId: string): Promise<number | string[]> {
  const caseData = { ...require(tryGetResource(jsonResourcePath, region)), event_token: eventToken }
  const url = `${ENV_CONFIG.BASE_URL}/data/cases/${caseId}/events`
  const body = JSON.stringify(caseData).replace(/<FLEX_DOC_UUID>/g, testFileId)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: region === 'ET_Scotland' ? body : jankConvertScotlandToEngland(body),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  if (res.status === 422) {
    return json.details?.field_errors.map(o => `${o.id} - ${o.message}`)
  }

  return res.status
}

async function postCase(cookieJar: CookieJar, eventToken: string, region: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, '../et/resources/initiateCase.json')), event_token: eventToken }
  const url = `${ENV_CONFIG.BASE_URL}/data/case-types/${region}/cases?ignore-warning=false`
  const body = JSON.stringify(caseData)

  temporaryLog(`Creating new ${region} case... `)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: region === 'ET_Scotland' ? body : jankConvertScotlandToEngland(body),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  if (res.status === 201) {
    console.log(`${json.id} ✓`)
  } else {
    console.log(`✕ (returned ${res.status})`)
  }

  return json.id as string
}

async function pingEventTrigger(caseId: string, eventName: string, cookieJar: CookieJar) {
  const url = `${ENV_CONFIG.BASE_URL}/data/internal/cases/${caseId}/event-triggers/${eventName}?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.event_token
}

async function getOrgUsers(cookieJar: CookieJar) {
  const url = `${BASE_URL_ORG}/api/userList?pageNumber=0`
  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.users
}

async function shareACase(caseId: string, region: string, userEmail = 'solicitor1@etorganisation1.com') {
  const cookieJar = await loginToIdam(USER_ORG, PASS_ORG, IDAM_LOGIN_START_URL_ORG)
  const users = await getOrgUsers(cookieJar)
  const solicitor1 = users.find(o => o.email === userEmail)
  const url = `${BASE_URL_ORG}/api/caseshare/case-assignments`

  const body = {
    sharedCases: [
      {
        caseId,
        caseTitle: caseId,
        caseTypeId: region,
        pendingShares: [
          {
            email: userEmail,
            firstName: solicitor1.firstName,
            idamId: solicitor1.userIdentifier,
            lastName: solicitor1.lastName
          }
        ],
        pendingUnshares: []
      }
    ]
  }

  const res = await makeAuthorisedRequest(url, cookieJar, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST'
  })

  return res.status
}

function jankConvertScotlandToEngland(data: string) {
  return data.replace(/Scotland/g, 'England').replace(/Aberdeen/g, 'Bristol')
}

async function uploadTestFile(cookieJar: CookieJar) {
  const file = resolve(process.env.APP_ROOT, `../et/resources/file.txt`)
  const form = new FormData()
  const stats = statSync(file)
  const fileSizeInBytes = stats.size
  const fileStream = createReadStream(file)
  form.append('files', fileStream, { knownLength: fileSizeInBytes })
  form.append('classification', 'PUBLIC')

  const res = await makeAuthorisedRequest(`${ENV_CONFIG.BASE_URL}/documents`, cookieJar, {
    method: 'POST',
    headers: {
      referrer: `${ENV_CONFIG.BASE_URL}/cases/case-details/1672844316015433/trigger/tseRespond/tseRespond3`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    },
    body: form
  })

  const json = await res.json()
  return json._embedded?.documents[0]?._links.self.href.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)?.[0]
}

async function findExistingCases(region: string, cookieJar: CookieJar) {
  const url = `${ENV_CONFIG.BASE_URL}/data/internal/searchCases?ctid=${region}&use_case=WORKBASKET&view=WORKBASKET&page=1`
  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'post'
  })

  if (res.status > 299) {
    console.log(`Unexpected return when getting cases for ${region} - ${res.status} ${res.statusText}`)
    return []
  }

  const json = await res.json()
  return json.results?.map(o => {
    return {
      ...o,
      caseId: o.case_id,
      alias: `${o.case_fields['[CASE_TYPE]']} - ${o.case_fields.ethosCaseReference} - ${o.case_id} (${o.case_fields.claimant} vs ${o.case_fields.respondent})`
    }
  }) || [] as Array<Record<string, any> & { caseId: string, alias: string }>
}

export default {
  group: 'et-web',
  text: 'Create Case / Run Case Events',
  fn: journey,
  alias: 'WebUpsertCase'
} as Journey
