import { Journey } from 'types/journey'
import fetch, { RequestInit } from 'node-fetch'
import { resolve } from 'path'
import { prompt } from 'inquirer'

const IDAM_LOGIN_START_URL = 'http://localhost:3455/auth/login'

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

  return {
    location: res.headers.get('location') || '',
    cookieJar: addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'])
  }
}

export async function loginToIdam(username = 'et.dev@hmcts.net', password = 'Pa55word11') {
  const body = objToFormData({ username, password, save: '' })
  const { location: authUrl, cookieJar } = await getInitialLoginUrl()

  const res = await fetch(authUrl, {
    method: 'POST',
    body,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
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
  return Object.keys(obj).map(o => `${o}=${encodeURIComponent(obj[o])}`).join('&')
}

function cookieJarToString(jar: Record<string, string>) {
  return Object.keys(jar).map(o => `${o}=${jar[o]}`).join('; ')
}

function addToCookieJarFromRawSetCookieHeader(rawHeader: string[], jar: Record<string, string> = {}) {
  return rawHeader.reduce((acc, obj) => {
    const [, key, value] = /(.+?)=((.+?);|(.+))/g.exec(obj) || []
    acc[key] = value.replace(';', '')
    return acc
  }, jar)
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
    Referer: 'http://localhost:3455/',
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
  const cookieJar = await loginToIdam()
  let eventToken = await createCaseInit(cookieJar, region)

  const caseId = await postCase(cookieJar, eventToken, region)
  eventToken = await pingEventTrigger(caseId, 'et1Vetting', cookieJar)
  await postGeneric('et1Vetting', caseId, cookieJar, eventToken)

  eventToken = await pingEventTrigger(caseId, 'preAcceptanceCase', cookieJar)
  await postGeneric('preAcceptanceCase', caseId, cookieJar, eventToken)

  eventToken = await pingEventTrigger(caseId, 'et3Response', cookieJar)
  await postGeneric('et3Response', caseId, cookieJar, eventToken)
}

async function createCaseInit(cookieJar: Record<string, string>, region = 'ET_EnglandWales') {
  const url = `http://localhost:3455/data/internal/case-types/${region}/event-triggers/initiateCase?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.event_token
}

async function postGeneric(jsonResourcePath: string, caseId: string, cookieJar: Record<string, string>, eventToken: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, `../et/resources/${jsonResourcePath}.json`)), event_token: eventToken }
  const url = `http://localhost:3455/data/cases/${caseId}/events`

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: JSON.stringify(caseData),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  console.log(`POST case status: ${res.status}`)
  return json.id
}

async function postCase(cookieJar: Record<string, string>, eventToken: string, region: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, '../et/resources/initiateCaseFinal.json')), event_token: eventToken }
  const url = `http://localhost:3455/data/case-types/${region}/cases?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: JSON.stringify(caseData),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  console.log(`POST case status: ${res.status}`)
  return json.id
}

async function pingEventTrigger(caseId: string, eventName: string, cookieJar: Record<string, string>) {
  const url = `http://localhost:3455/data/internal/cases/${caseId}/event-triggers/${eventName}?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.event_token
}

export default {
  group: 'et-web',
  text: 'Create default case in CCD',
  fn: askQuestions
} as Journey
