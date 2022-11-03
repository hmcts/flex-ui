import { Journey } from 'types/journey'
import fetch, { RequestInit } from 'node-fetch'
import { resolve } from 'path'
import { prompt } from 'inquirer'
import https from 'node:https'

https.globalAgent.options.rejectUnauthorized = false

// These login credentials are public and will only work when running the stack locally #secops
const USER = 'et.dev@hmcts.net'
const PASS = 'Pa55word11'
const BASE_URL = 'http://localhost:3455'
const IDAM_LOGIN_START_URL = `${BASE_URL}/auth/login`

async function askQuestions() {
  const answers = await prompt([
    { name: 'region', message: 'What region are we creating for?', type: 'list', choices: ['ET_EnglandWales', 'ET_Scotland'] }
  ])

  await createNewCase(answers.region)
}

async function getInitialLoginUrl() {
  const res = await fetch(IDAM_LOGIN_START_URL, { redirect: 'manual' })

  if (res.status !== 302) {
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status}`)
  }

  const cookieJar = { seen_cookie_message: 'yes', cookies_policy: '{ "essential": true, "analytics": false, "apm": false }', cookies_preferences_set: 'false' }

  return {
    location: res.headers.get('location') || '',
    cookieJar: addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  }
}

async function getCsrfTokenFromLoginPage(authUrl: string, cookieJar: Record<string, string>) {
  const res = await fetch(authUrl)
  const html = await res.text()
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  return /name="_csrf" value="([0-9a-f-]+)"/.exec(html)?.[1]
}

export async function loginToIdam(username = 'et.dev@hmcts.net', password = 'Pa55word11') {
  const { location: authUrl, cookieJar } = await getInitialLoginUrl()
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

function cookieJarToString(jar: Record<string, string>) {
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

export async function createNewCase(region: string) {
  const cookieJar = await loginToIdam(USER, PASS)
  let eventToken = await createCaseInit(cookieJar, region)

  const caseId = await postCase(cookieJar, eventToken, region)
  eventToken = await pingEventTrigger(caseId, 'et1Vetting', cookieJar)
  await postGeneric('et1Vetting', caseId, cookieJar, eventToken, region)

  eventToken = await pingEventTrigger(caseId, 'preAcceptanceCase', cookieJar)
  await postGeneric('preAcceptanceCase', caseId, cookieJar, eventToken, region)

  eventToken = await pingEventTrigger(caseId, 'et3Response', cookieJar)
  await postGeneric('et3Response', caseId, cookieJar, eventToken, region)
}

async function createCaseInit(cookieJar: Record<string, string>, region = 'ET_EnglandWales') {
  const url = `${BASE_URL}/data/internal/case-types/${region}/event-triggers/initiateCase?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  if (res.status !== 200) {
    throw new Error(`Failed event trigger to initiate new case (${json?.message || ''} - ${res.status})`)
  }

  return json.event_token
}

async function postGeneric(jsonResourcePath: string, caseId: string, cookieJar: Record<string, string>, eventToken: string, region: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, `../et/resources/${jsonResourcePath}.json`)), event_token: eventToken }
  const url = `${BASE_URL}/data/cases/${caseId}/events`
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

async function postCase(cookieJar: Record<string, string>, eventToken: string, region: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, '../et/resources/initiateCaseFinal.json')), event_token: eventToken }
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
  fn: askQuestions
} as Journey
