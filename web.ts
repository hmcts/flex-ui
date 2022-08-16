import fetch, { RequestInit } from "node-fetch"

const IDAM_LOGIN_URL = 'http://localhost:5000/login?client_id=xui_webapp&redirect_uri=http://localhost:3455/oauth2/callback&ui_local=en&response_type=code&state=4mndodZxWLtfLL-S_-8l6aJx2sYTa6ZQFupCJt42hZw'
const IDAM_LOGIN_START_URL = 'http://localhost:3455/auth/login'

async function getInitialLoginUrl() {
  const res = await fetch(IDAM_LOGIN_START_URL, { redirect: 'manual' })

  if (res.status !== 302) {
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status}`)
  }

  return {
    location: res.headers.get('location')!,
    cookieJar: addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'])
  }
}

export async function loginToIdam(username = "et.dev@hmcts.net", password = "Pa55word11") {
  const body = objToFormData({ username, password, save: "" })
  const { location: authUrl, cookieJar } = await getInitialLoginUrl()

  const res = await fetch(authUrl, {
    method: 'POST', body, headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }, redirect: 'manual'
  })

  // Responds with set cookies and a redirect url that we'll need to extract values from

  if (res.status !== 302) {
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status}`)
  }

  const redirectUrl = res.headers.get('location')!
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  const cookieHeader = cookieJarToString(cookieJar)

  const callbackRes = await fetch(redirectUrl, {
    method: 'get',
    headers: {
      // 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:102.0) Gecko/20100101 Firefox/102.0',
      // 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      // 'Accept-Language': 'en-GB,en;q=0.5',
      // 'Accept-Encoding': 'gzip, deflate, br',
      // 'Referer': 'http://localhost:5000/',
      // 'Connection': 'keep-alive',
      // 'Upgrade-Insecure-Requests': '1',
      // 'Sec-Fetch-Dest': 'document',
      // 'Sec-Fetch-Mode': 'navigate',
      // 'Sec-Fetch-Site': 'cross-site',
      // 'Sec-Fetch-User': '?1',
      // 'Pragma': 'no-cache',
      // 'Host': 'localhost:3455',
      Cookie: cookieHeader
    }, redirect: 'manual'
  })

  addToCookieJarFromRawSetCookieHeader(callbackRes.headers.raw()['set-cookie'], cookieJar)

  return cookieJar
}

function objToFormData(obj: Record<string, string>) {
  return Object.keys(obj).map(o => `${o}=${encodeURIComponent(obj[o])}`).join("&")
}

function cookieJarToString(jar: Record<string, string>) {
  return Object.keys(jar).map(o => `${o}=${jar[o]}`).join("; ")
}

function addToCookieJarFromRawSetCookieHeader(rawHeader: string[], jar: Record<string, string> = {}) {
  return rawHeader.reduce((acc, obj) => {
    const [_, key, value] = /(.+?)=((.+?);|(.+))/g.exec(obj) || []
    acc[key] = value.replace(';', '')
    return acc
  }, jar)
}

async function makeAuthorisedRequest(url: string, cookieJar: Record<string, string>, opts: RequestInit = {}) {
  if (!opts.headers) {
    opts.headers = {}
  }

  if (!(opts.headers as any)['Cookie']) {
    (opts.headers as any).Cookie = cookieJarToString(cookieJar)
  }

  const defaultHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:102.0) Gecko/20100101 Firefox/102.0',
    'Accept': '*/*',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': 'http://localhost:3455/',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'Pragma': 'no-cache',
    'Cache-Control': 'no-cache',
    'X-XSRF-TOKEN': cookieJar['XSRF-TOKEN'],
    'experimental': 'true'
  }

  for (const headerName in defaultHeaders) {
    if ((opts.headers as any)[headerName]) continue

    (opts.headers as any)[headerName] = defaultHeaders[headerName]
  }

  const res = await fetch(url, opts)
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'])

  return res
}

export async function createNewCase() {
  const cookieJar = await loginToIdam()
  const eventToken = await createCaseInit(cookieJar)

  await createCasePages(eventToken, cookieJar)
}

async function createCaseInit(cookieJar: Record<string, string>) {
  const url = `http://localhost:3455/data/internal/case-types/ET_EnglandWales/event-triggers/initiateCase?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.event_token
}

async function createCasePages(eventToken: string, cookieJar: Record<string, string>) {
  const jsons: Record<string, any> = {
    "initiateCase1": require('../resources/initiateCase1.json'),
    "initiateCase2": require('../resources/initiateCase2.json'),
    "initiateCase3": require('../resources/initiateCase3.json'),
    "initiateCase4": require('../resources/initiateCase4.json'),
    "initiateCase7": require('../resources/initiateCase7.json'),
    "initiateCase8": require('../resources/initiateCase8.json'),
    "initiateCase9": require('../resources/initiateCase9.json')
  }

  for (const name in jsons) {
    const json = jsons[name]

    const url = `http://localhost:3455/data/case-types/ET_EnglandWales/validate?pageId=${name}`
    const body = { ...json, event_token: eventToken }
    const res = await makeAuthorisedRequest(url, cookieJar, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
    console.log(`${name} status: ${res.status}`)
  }

  const finalCaseData = { ...require('../resources/initiateCaseFinal.json'), event_token: eventToken }
  await postCase(finalCaseData, cookieJar)
}

async function postCase(caseData: any, cookieJar: Record<string, string>) {
  const url = `http://localhost:3455/data/case-types/ET_EnglandWales/cases?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: JSON.stringify(caseData),
    headers: { 'Content-Type': 'application/json' }
  })

  console.log(`POST case status: ${res.status}`)
}