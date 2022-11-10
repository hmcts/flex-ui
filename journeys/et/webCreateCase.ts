import { Journey } from 'types/journey'
import fetch, { RequestInit } from 'node-fetch'
import { resolve } from 'path'
import { prompt } from 'inquirer'
import https from 'node:https'
import { exists, existsSync } from 'fs'
import { YES, YES_OR_NO } from 'app/constants'
import { execCommand, getEnvVarsFromFile, temporaryLog } from 'app/helpers'
import { ChildProcess, exec } from 'child_process'
import { kill } from 'process'
import { getWslHostIP, setIPToHostDockerInternal, setIPToWslHostAddress } from './dockerUpdateIP'
import { generateSpreadsheets } from './configsGenerateSpreadsheet'
import { importConfigs } from './configsImportCcd'

https.globalAgent.options.rejectUnauthorized = false

// These login credentials are public and will only work when running the stack locally #secops
const USER = 'et.dev@hmcts.net'
const PASS = 'Pa55word11'
const BASE_URL = 'http://localhost:3455'
const IDAM_LOGIN_START_URL = `${BASE_URL}/auth/login`

const QUESTION_STEPS = 'What events are we interested in running?'
const QUESTION_CALLBACKS = 'Do we need to spin up callbacks before creating the case?'

const EVENT_OPTS = [
  'et1Vetting',
  'preAcceptanceCase',
  'et3Response',
  'addAmendHearing'
]

const REGION_OPTS = [
  'ET_EnglandWales',
  'ET_Scotland'
]

async function journey() {
  await doCreateCaseTasks(await askCreateCaseQuestions())
}

export async function askCreateCaseQuestions() {
  return await prompt([
    { name: 'region', message: 'What region are we creating for?', type: 'checkbox', choices: REGION_OPTS, default: REGION_OPTS },
    { name: 'events', message: QUESTION_STEPS, type: 'checkbox', choices: EVENT_OPTS, default: EVENT_OPTS },
    { name: 'callbacks', message: QUESTION_CALLBACKS, type: 'list', choices: YES_OR_NO, default: YES },
    { name: 'kill', message: 'Do you want to kill callbacks after?', type: 'list', choices: YES_OR_NO, default: YES, when: (ans) => ans.callbacks === YES }
  ])
}

async function killProcessesOnPort8081(){
  return await execCommand(`lsof -i:8081 -Fp | head -n 1 | sed 's/^p//' | xargs kill`, undefined, false)
}

export async function doCreateCaseTasks(answers: Record<string, any>) {
  let needToRevert = getWslHostIP() === 'host.docker.internal'

  if (answers.callbacks === YES) {
    await killProcessesOnPort8081()
    await setIPToWslHostAddress()
    await generateSpreadsheets('local')
    await importConfigs()
    await startAndWaitForCallbacksToBeReady()
  }

  for (const region of answers.region) {
    await createNewCase(region, answers.events)
  }

  if (answers.kill) {
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

export async function getInitialLoginUrl(url: string = IDAM_LOGIN_START_URL) {
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

export async function getCsrfTokenFromLoginPage(authUrl: string, cookieJar: Record<string, string>) {
  const res = await fetch(authUrl)
  const html = await res.text()
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  return /name="_csrf" value="([0-9a-f-]+)"/.exec(html)?.[1]
}

export async function loginToIdam(username = USER, password = PASS, unauthorisedUrl: string = IDAM_LOGIN_START_URL) {
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

  return cookieJar
}

function objToFormData(obj: Record<string, string>) {
  return Object.keys(obj).map(o => `${o}=${encodeURIComponent(obj[o])}`).join('&').replace(/%20/g, '+')
}

export function cookieJarToString(jar: Record<string, string>) {
  return Object.keys(jar).map(o => `${o}=${jar[o]}`).join('; ')
}

function addToCookieJarFromRawSetCookieHeader(rawHeader: string[], jar: Record<string, string> = {}) {
  return rawHeader?.reduce((acc, obj) => {
    const [, key, value] = /(.+?)=((.+?);|(.+))/g.exec(obj) || []
    if (!key || !value) return acc
    acc[key] = value.replace(';', '')
    return acc
  }, jar) || jar
}

async function makeAuthorisedRequest(url: string, cookieJar: Record<string, string>, opts: RequestInit = {}) {
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
    Referer: BASE_URL,
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

export async function createNewCase(region: string, events: string[]) {
  const cookieJar = await loginToIdam(USER, PASS)
  let eventToken = await createCaseInit(cookieJar, region)

  const caseId = await postCase(cookieJar, eventToken, region)

  for (const event of events) {
    eventToken = await pingEventTrigger(caseId, event, cookieJar)
    await postGeneric(event, caseId, cookieJar, eventToken, region)
  }
}

async function createCaseInit(cookieJar: Record<string, string>, region = 'ET_EnglandWales') {
  const url = `${BASE_URL}/data/internal/case-types/${region}/event-triggers/initiateCase?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  if (res.status !== 200) {
    throw new Error(`Failed event trigger to initiate new case. Are callbacks running? (${json?.message || ''} - ${res.status})`)
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

async function postGeneric(jsonResourcePath: string, caseId: string, cookieJar: Record<string, string>, eventToken: string, region: string) {
  const caseData = { ...require(tryGetResource(jsonResourcePath, region)), event_token: eventToken }
  const url = `${BASE_URL}/data/cases/${caseId}/events`
  const body = JSON.stringify(caseData)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: region === 'ET_Scotland' ? body : jankConvertScotlandToEngland(body),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  temporaryLog(`POST for ${jsonResourcePath} case status: ${res.status}`)
  return json.id
}

async function postCase(cookieJar: Record<string, string>, eventToken: string, region: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, '../et/resources/initiateCase.json')), event_token: eventToken }
  const url = `${BASE_URL}/data/case-types/${region}/cases?ignore-warning=false`
  const body = JSON.stringify(caseData)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: region === 'ET_Scotland' ? body : jankConvertScotlandToEngland(body),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  console.log(`POST case status: ${res.status}`)
  return json.id
}

async function pingEventTrigger(caseId: string, eventName: string, cookieJar: Record<string, string>) {
  const url = `${BASE_URL}/data/internal/cases/${caseId}/event-triggers/${eventName}?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.event_token
}

function jankConvertScotlandToEngland(data: string) {
  return data.replace(/Scotland/g, 'England').replace(/Aberdeen/g, 'Bristol')
}

export default {
  group: 'et-web',
  text: 'Create default case in CCD',
  fn: journey
} as Journey
