import { Journey } from 'types/journey'
import { RequestInit } from 'node-fetch'
import { resolve } from 'path'
import { prompt } from 'inquirer'
import https from 'node:https'
// eslint-disable-next-line n/no-deprecated-api
import { createReadStream, existsSync, statSync } from 'fs'
import { CUSTOM, NO, YES, YES_OR_NO } from 'app/constants'
import { getEnvVarsFromFile, getIdealSizeForInquirer, killOn, retryFetch, temporaryLog, wait } from 'app/helpers'
import { ChildProcess, exec } from 'child_process'
import { getWslHostIP, setIPToHostDockerInternal } from './dockerUpdateIP'
import { generateSpreadsheetsForBothRepos, getCurrentPreviewPRNumber, importConfigs } from './configsCommon'
import { fixExitedContainers } from 'app/et/docker'
import FormData from 'form-data'
import { Answers } from 'app/questions'
import { Region } from 'app/et/configs'
import { CookieJar, addToCookieJarFromRawSetCookieHeader, cookieJarToString } from 'app/cookieJar'
import { randomUUID } from 'crypto'

https.globalAgent.options.rejectUnauthorized = false

export const ENV_CONFIG = {
  EXUI_USER: '',
  EXUI_PASS: '',
  EXUI_URL: '',
  CUI_BASE_URL: '',
  CUI_USER: '',
  CUI_PASS: '',
  IMPORT_URL: '',
  IMPORT_USER: '',
  IMPORT_PASS: '',
  LEGALREP_USER: '',
  LEGALREP_PASS: ''
}

const QUESTION_STEPS = 'What events are we interested in running?'
const QUESTION_CALLBACKS = 'Do we need to spin up callbacks first?'
const QUESTION_SHARE = 'Would you like to share this case with solicitor1@etorganisation1.com?'

const EVENT_OPTS = [
  'et1Vetting',
  'preAcceptanceCase',
  'amendCaseDetails',
  'et3Response',
  'et3Processing',
  'createCaseECC',
  'addAmendHearing',
  'addAmendJudgment',
  'addAmendJurisdiction',
  'amendRespondentRepresentative',
  'broughtForward',
  'initialConsideration',
  'recordDeposit',
  'restrictedCases',
  'uploadDocument',
  'respondentTSE',
  'tseRespond',
  'tseAdmin',
  'tseAdmReply',
  'sendNotification',
  'respondNotification',
  'pseRespondentRespondToTribunal',
  'createReferral'
]

export const REGION_OPTS = [
  'ET_EnglandWales',
  'ET_Scotland'
]

const CREATE_OPTS = [
  'Create a new case',
  'Choose an existing case'
]

export const ENV_OPTS = [
  'Local',
  'Preview',
  'Demo',
  'ITHC',
  'AAT',
  'PERFTEST'
]

async function journey() {
  await askCreateOrExistingCase()
}

export function setCredentialsForEnvironment(env: string, pr?: string) {
  env = env.replace('-prod', '')
  const requiredArgs = Object.keys(ENV_CONFIG)
  const missingArgs = requiredArgs.map(o => !process.env[`${env.toUpperCase()}_${o}`] && !o.startsWith("LEGALREP") ? `${env.toUpperCase()}_${o}` : null).filter(o => o)

  if (missingArgs.length) {
    throw new Error(`The following environment variables are missing for ${env}: ${missingArgs.join(', ')}`)
  }

  requiredArgs.forEach(o => {
    ENV_CONFIG[o] = process.env[`${env.toUpperCase()}_${o}`]
  })

  ENV_CONFIG.EXUI_URL = ENV_CONFIG.EXUI_URL.endsWith('/') ? ENV_CONFIG.EXUI_URL.slice(0, -1) : ENV_CONFIG.EXUI_URL

  if (pr) {
    ENV_CONFIG.EXUI_URL = `https://xui-et-ccd-definitions-admin-pr-${pr}.preview.platform.hmcts.net`
    ENV_CONFIG.CUI_BASE_URL = `https://et-sya-et-ccd-definitions-admin-pr-${pr}.preview.platform.hmcts.net`
    ENV_CONFIG.IMPORT_URL = `https://admin-web-et-ccd-definitions-admin-pr-${pr}.preview.platform.hmcts.net`
  }
}

async function askCreateOrExistingCase() {
  const currentPr = await getCurrentPreviewPRNumber()
  let answers = await prompt([
    { name: 'env', message: 'Which environment are we targeting?', type: 'list', choices: ENV_OPTS, default: ENV_OPTS[0] },
    { name: 'pr', message: 'What PR number are we targetting?', default: currentPr, when: (answers: Answers) => answers.env === ENV_OPTS[1] },
    { name: 'create', message: 'Do you want to create a new case or run an event on an existing case?', type: 'list', choices: CREATE_OPTS }
  ])

  setCredentialsForEnvironment(answers.env, answers.pr)

  if (answers.create === CREATE_OPTS[0]) {
    return await doCreateCaseTasks(await askCreateCaseQuestions())
  }

  temporaryLog(`Fetching existing cases...`)

  const cookieJar = await loginToIdam()

  const cases: Array<Record<string, any> & { caseId: string, alias: string }> = [
    { caseId: CUSTOM, alias: CUSTOM },
    ...await findExistingCases('ET_EnglandWales', cookieJar),
    ...await findExistingCases('ET_Scotland', cookieJar)
  ]

  answers = await prompt([{ name: 'cases', message: 'Select a case', type: 'list', choices: cases.map(o => o.alias), pageSize: getIdealSizeForInquirer() }])

  if (answers.cases === CUSTOM) {
    answers = await prompt([{ name: 'id', message: 'Enter a case id', default: '1692695354512046' }], answers)

    const foundCase = await lookupExistingCase(answers.id, cookieJar)
    if (!foundCase) {
      return console.warn(`Case ${answers.id} was not found. Aborting journey...`)
    }
    cases.splice(0, 1)
    cases.push({ caseId: answers.id, alias: CUSTOM, case_fields: { '[CASE_TYPE]': foundCase.case_type.id } })
  }

  const selectedCase = cases.find(o => o.alias === answers.cases)
  const region = selectedCase.case_fields['[CASE_TYPE]']

  const followup = await askCreateCaseQuestions({ region: [region], caseId: selectedCase.caseId })
  return await doCreateCaseTasks(followup)
}

export async function lookupExistingCase(caseId: string, cookieJar: CookieJar) {
  const url = `${ENV_CONFIG.EXUI_URL}/data/internal/cases/${caseId}`
  const res = await makeAuthorisedRequest(url, cookieJar)

  if (res.status !== 200) {
    throw new Error(`Failed to lookup case ${caseId} (${res.status})`)
  }

  const json = await res.json()

  return json
}

export async function askCreateCaseQuestions(answers: Answers = {}) {
  const whenLocalEnv = () => ENV_CONFIG.EXUI_URL.includes('localhost') && !process.env.CFTLIB
  return await prompt([
    { name: 'region', message: 'What regions are we creating for?', type: 'checkbox', choices: REGION_OPTS, default: REGION_OPTS, pageSize: getIdealSizeForInquirer() },
    { name: 'events', message: QUESTION_STEPS, type: 'checkbox', choices: EVENT_OPTS, default: EVENT_OPTS.slice(0, 2), pageSize: getIdealSizeForInquirer() },
    { name: 'share', message: QUESTION_SHARE, type: 'list', choices: YES_OR_NO, default: YES },
    { name: 'multiple', message: 'Would you like to add this to a new Multiple case?', type: 'list', choices: YES_OR_NO, default: YES, when: whenLocalEnv },
    { name: 'callbacks', message: QUESTION_CALLBACKS, type: 'list', choices: YES_OR_NO, default: answers.callbacks || NO, askAnswered: true, when: whenLocalEnv },
    { name: 'kill', message: 'Do you want to kill callbacks after?', type: 'list', choices: YES_OR_NO, default: YES, when: (ans) => ans.callbacks === YES }
  ], answers)
}

async function killProcessesOnPort8081() {
  return killOn(8081)
}

export async function doCreateCaseTasks(answers: Record<string, any>) {
  const needToRevert = getWslHostIP() === 'host.docker.internal'

  if (answers.callbacks === YES) {
    await killProcessesOnPort8081()
    await generateSpreadsheetsForBothRepos('local')
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

  if (ENV_CONFIG.EXUI_URL.includes('localhost')) {
    await fixExitedContainers()
  }

  const cookieJar = await loginToIdam()

  for (const region of answers.region) {
    try {
      const caseId = answers.caseId ?? await createNewCase(region, cookieJar)
      console.log(`View case: ${ENV_CONFIG.EXUI_URL}/cases/case-details/${caseId}`)
      await executeEventsOnCase(cookieJar, caseId, region, answers.events, answers.share === YES)
    } catch (e) {
      console.log(`Failed on ${region} because ${e}`)
    }
  }

  if (answers.kill === YES) {
    await killProcessesOnPort8081()
    if (needToRevert) {
      await setIPToHostDockerInternal()
      await generateSpreadsheetsForBothRepos('local')
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

export async function getInitialLoginUrl(url: string = `${ENV_CONFIG.EXUI_URL}/auth/login`, cookieJar: CookieJar = { seen_cookie_message: 'yes', cookies_policy: '{ "essential": true, "analytics": false, "apm": false }', cookies_preferences_set: 'false' }) {
  const res = await retryFetch(url, { redirect: 'manual' })

  if (res.status !== 302) {
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status}`)
  }

  return {
    location: res.headers.get('location') || '',
    cookieJar: addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  }
}

export async function getCsrfTokenFromLoginPage(authUrl: string, cookieJar: CookieJar) {
  const res = await retryFetch(authUrl)
  const html = await res.text()
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  return /name="_csrf" value="([0-9a-f-]+)"/.exec(html)?.[1]
}

export async function loginToIdam(username = ENV_CONFIG.EXUI_USER, password = ENV_CONFIG.EXUI_PASS, unauthorisedUrl = `${ENV_CONFIG.EXUI_URL}/auth/login`) {
  let { location: authUrl, cookieJar } = await getInitialLoginUrl(unauthorisedUrl)
  if (authUrl.includes('/o/authorize?')) {
    const authorize = await getInitialLoginUrl(authUrl, cookieJar)
    authUrl = authorize.location
    cookieJar = authorize.cookieJar
  }
  const csrf = await getCsrfTokenFromLoginPage(authUrl, cookieJar)

  const body = objToFormData({ username, password, selfRegistrationEnabled: 'false', azureLoginEnabled: 'true', mojLoginEnabled: 'true', _csrf: csrf })

  const res = await retryFetch(authUrl, {
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
    throw new Error(`Something went wrong calling IDAM LOGIN - expected 302 but got ${res.status} (are credentials correct?)`)
  }

  const redirectUrl = res.headers.get('location') || ''
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)
  const cookieHeader = cookieJarToString(cookieJar)

  const callbackRes = await retryFetch(redirectUrl, {
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
    Referer: ENV_CONFIG.EXUI_URL,
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

  const res = await retryFetch(url, opts)
  addToCookieJarFromRawSetCookieHeader(res.headers.raw()['set-cookie'], cookieJar)

  return res
}

export async function createNewCase(region: string, cookieJar: CookieJar) {
  const eventToken = await createCaseInit(cookieJar, region)
  return await postCase(cookieJar, eventToken, region)
}

async function executeEventsOnCase(cookieJar: CookieJar, caseId: string, region: string, events: string[], noc: boolean) {
  const docLink = await uploadTestFile(cookieJar)
  const existingCase = await lookupExistingCase(caseId, cookieJar)
  let caseData = existingCase.tabs.reduce((acc, tab) => {
    tab.fields.forEach(o => acc[o.id] = o.value)
    return acc
  }, {})

  if (events.includes('et3Processing')) {
    const indexOf = events.indexOf('et3Processing')
    events.splice(indexOf, 0, 'et3Response')
    events.splice(indexOf, 0, 'amendCaseDetails')
  }

  if (events.includes('et3Response')) {
    const indexOf = events.indexOf('et3Response')
    events.splice(indexOf + 1, 0, 'submitEt3')
    events.splice(indexOf + 1, 0, 'et3ResponseDetails')
    events.splice(indexOf + 1, 0, 'et3ResponseEmploymentDetails')
  }

  console.log(`Chosen events: ${events.join(', ')}`)

  for (const event of events) {
    temporaryLog(`${event}... `)

    if (event === 'createCaseECC') {
      await createCaseECC(cookieJar, region, caseData)
      continue
    }

    const eventToken = await pingEventTrigger(caseId, event, cookieJar)
    const res = await postGeneric(event, caseId, cookieJar, eventToken, region, docLink, caseData)

    if (res.status === 201) {
      console.log(`✓`)
      caseData = { ...caseData, ...res.data }
    } else {
      console.log(`✕ (returned ${res.status} - ${res.data})`)
    }
  }
  if (noc) {
    await performNoc(caseId, caseData)
  }
}

async function createCaseECC(cookieJar: CookieJar, region = 'ET_EnglandWales', caseData: any) {
  const eventToken = await createCaseInit(cookieJar, region, 'createCaseECC')
  const payload = { ...require(tryGetResource('createCaseECC', region)), event_token: eventToken }
  const url = `${ENV_CONFIG.EXUI_URL}/data/case-types/${region}/cases?ignore-warning=false`
  const body = resolvePayloadReferences(JSON.stringify(payload), caseData)

  temporaryLog(`Creating new ${region} ECC case...`)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  if (res.status === 201) {
    console.log(`${json.id} ✓`)
  } else {
    console.log(`✕ (returned ${res.status} - ${JSON.stringify(json)})`)
  }

  return json.id as string
}

export async function doMultiple(name: string, region: string, caseIds: string[]) {
  const cookieJar = await loginToIdam()
  const regionMultiple = `${region}_Multiple`
  const token = await createCaseInit(cookieJar, regionMultiple, 'createMultiple')

  const existingCases = await findExistingCases(region, cookieJar)
  const caseEthosRefs = caseIds.map(o => existingCases.find(p => p.caseId === o)?.ethos)

  console.log(`Found ${caseEthosRefs.length} cases. ${caseEthosRefs.join(', ')}`)

  const caseData = { ...require(resolve(process.env.APP_ROOT, '../et/resources/createMultiple.json')), event_token: token }
  const url = `${ENV_CONFIG.EXUI_URL}/data/case-types/${regionMultiple}/cases?ignore-warning=false`

  caseData.data.caseIdCollection = caseEthosRefs.map(o => ({ value: { ethos_CaseReference: o }, id: randomUUID() }))
  caseData.data.leadCase = caseEthosRefs[0]
  caseData.data.multipleName = name

  if (region.startsWith(Region.Scotland)) {
    caseData.data.managingOffice = 'Aberdeen'
  }

  const body = JSON.stringify(caseData)

  console.log(body)

  temporaryLog(`Creating new ${regionMultiple} case... `)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  if (res.status === 201) {
    console.log(`${json.id} ✓`)
  } else {
    console.log(`✕ (returned ${res.status} - ${JSON.stringify(json)})`)
  }

  return json.id as string
}

async function createCaseInit(cookieJar: CookieJar, region = 'ET_EnglandWales', event: string = 'initiateCase') {
  const url = `${ENV_CONFIG.EXUI_URL}/data/internal/case-types/${region}/event-triggers/${event}?ignore-warning=false`

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

function resolvePayloadReferences(payload: string, caseData: any) {
  const refs = payload.match(/{{.+?}}/g)
  if (!refs) {
    return payload
  }

  for (const ref of refs) {
    const path = ref.substring(2, ref.length - 2)
    const replacer = path.split('.').reduce((acc, obj) => acc[obj], caseData)

    payload = payload.replace(ref, replacer)
  }

  return payload
}

async function postGeneric(jsonResourcePath: string, caseId: string, cookieJar: CookieJar, eventToken: string, region: string, testFileId: string, caseData: any) {
  const payload = { ...require(tryGetResource(jsonResourcePath, region)), event_token: eventToken }
  const url = `${ENV_CONFIG.EXUI_URL}/data/cases/${caseId}/events`
  const resolvedPayload = resolvePayloadReferences(JSON.stringify(payload), caseData)
  const body = resolvedPayload.replace(/<FLEX_DOC_UUID>/g, testFileId)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: region === 'ET_Scotland' ? body : jankConvertScotlandToEngland(body),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await res.json()

  if (res.status === 422) {
    return {
      status: res.status,
      data: JSON.stringify(json.details?.field_errors.map(o => `${o.id} - ${o.message}`) || json.callbackErrors || json)
    }
  }

  return {
    status: res.status,
    data: json.data
  }
}

async function postCase(cookieJar: CookieJar, eventToken: string, region: string) {
  const caseData = { ...require(resolve(process.env.APP_ROOT, '../et/resources/initiateCase.json')), event_token: eventToken }
  const url = `${ENV_CONFIG.EXUI_URL}/data/case-types/${region}/cases?ignore-warning=false`
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
    console.log(`✕ (returned ${res.status} - ${JSON.stringify(json)})`)
  }

  return json.id as string
}

async function pingEventTrigger(caseId: string, eventName: string, cookieJar: CookieJar) {
  const url = `${ENV_CONFIG.EXUI_URL}/data/internal/cases/${caseId}/event-triggers/${eventName}?ignore-warning=false`

  const res = await makeAuthorisedRequest(url, cookieJar)
  const json = await res.json()

  return json.event_token
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
  form.append('caseTypeId', Region.EnglandWales)
  form.append('jurisdictionId', 'EMPLOYMENT')

  const res = await makeAuthorisedRequest(`${ENV_CONFIG.EXUI_URL}/documentsv2`, cookieJar, {
    method: 'POST',
    headers: {
      referrer: `${ENV_CONFIG.EXUI_URL}/cases/case-details/1672844316015433/trigger/tseRespond/tseRespond3`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36'
    },
    body: form
  })

  const json = await res.json()

  if (!json.documents?.[0]) {
    throw new Error(`Failed to upload test file - ${json.error}}`)
  }
  return json.documents[0]?._links.self.href || "http://localhost:5005/documents/08fb1f10-43a7-4cc8-8fc1-37f9c4d823ee"
}

export async function findExistingCases(region: string, cookieJar: CookieJar): Promise<Array<Record<string, any> & { caseId: string, ethos: string, alias: string }>> {
  const url = `${ENV_CONFIG.EXUI_URL}/data/internal/searchCases?ctid=${region}&use_case=WORKBASKET&view=WORKBASKET&page=1`
  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'post',
    body: '{"size":100}',
    headers: { 'Content-Type': 'application/json' }
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
      ethos: o.case_fields.ethosCaseReference,
      alias: `${o.case_fields['[CASE_TYPE]']} - ${o.case_fields.ethosCaseReference} - ${o.case_id} (${o.case_fields.claimant} vs ${o.case_fields.respondent})`
    }
  }) || [] as Array<Record<string, any> & { ethos: string, caseId: string, alias: string }>
}

export async function createCaseOnCitizenUI(answers: Answers) {
  setCredentialsForEnvironment(answers.env as string, answers.pr as string)
  const cookieJar = await loginToIdam(ENV_CONFIG.CUI_USER, ENV_CONFIG.CUI_PASS, `${ENV_CONFIG.CUI_BASE_URL}/login`)

  const postCode = answers.region === REGION_OPTS[0] ? 'HU5 3UD' : 'EH12 7TB'

  await citizenUIPage(cookieJar, 'work-postcode', { workPostcode: postCode })
  await citizenUIPage(cookieJar, 'lip-or-representative', { claimantRepresentedQuestion: NO })
  await citizenUIPage(cookieJar, 'single-or-multiple-claim', { caseType: 'Single' })
  await citizenUIPage(cookieJar, 'do-you-have-an-acas-no-many-resps', { acasMultiple: YES })
  await citizenUIPage(cookieJar, 'type-of-claim', { typeOfClaim: 'discrimination', otherClaim: '' })

  // Step 1
  await makeAuthorisedRequest(`${ENV_CONFIG.CUI_BASE_URL}/steps-to-making-your-claim`, cookieJar)
  await citizenUIPage(cookieJar, 'dob-details', { 'dobDate-day': '16', 'dobDate-month': '01', 'dobDate-year': '1989' })

  await citizenUIPage(cookieJar, 'sex-and-title', { claimantSex: 'Male', preferredTitle: 'Doctor Professor' })
  await citizenUIPage(cookieJar, 'address-postcode-enter', { addressEnterPostcode: postCode })
  await citizenUIPage(cookieJar, 'address-postcode-select', { addressAddressTypes: '0' })
  await citizenUIPage(cookieJar, 'address-details', { address1: 'I', address2: 'hope', addressTown: 'this', addressCountry: 'isnt', addressPostCode: postCode })
  await citizenUIPage(cookieJar, 'telephone-number', { telNumber: '07111111111' })
  await citizenUIPage(cookieJar, 'how-would-you-like-to-be-updated-about-your-claim', { claimantContactPreference: 'Email', claimantContactLanguagePreference: 'English', claimantHearingLanguagePreference: 'English' })
  await citizenUIPage(cookieJar, 'would-you-want-to-take-part-in-video-hearings', { hearingPreferences: 'Video', hearingAssistance: '' })
  await citizenUIPage(cookieJar, 'reasonable-adjustments', { reasonableAdjustments: NO, reasonableAdjustmentsDetail: '' })
  await citizenUIPage(cookieJar, 'personal-details-check', { personalDetailsCheck: YES })

  // Step 2
  await citizenUIPage(cookieJar, 'past-employer', { pastEmployer: YES })
  // The following are not needed when pastEmployer is "No"
  await citizenUIPage(cookieJar, 'are-you-still-working', { isStillWorking: 'No longer working' })
  await citizenUIPage(cookieJar, 'job-title', { jobTitle: 'Fall Guy' })
  await citizenUIPage(cookieJar, 'start-date', { 'startDate-day': '01', 'startDate-month': '01', 'startDate-year': '1989' })
  await citizenUIPage(cookieJar, 'end-date', { 'endDate-day': '01', 'endDate-month': '01', 'endDate-year': '2023' })
  await citizenUIPage(cookieJar, 'got-a-notice-period', {})
  await citizenUIPage(cookieJar, 'average-weekly-hours', { avgWeeklyHrs: '69' })
  await citizenUIPage(cookieJar, 'pay', { payBeforeTax: '420000', payAfterTax: '69000' })
  await citizenUIPage(cookieJar, 'respondent/1/respondent-name', { respondentName: `Badman${getCurrentYYMMDD()}` })
  await citizenUIPage(cookieJar, 'respondent/1/respondent-postcode-enter', { respondentEnterPostcode: postCode })
  await citizenUIPage(cookieJar, 'respondent/1/respondent-postcode-select', { respondentAddressTypes: '1' })
  await citizenUIPage(cookieJar, 'respondent/1/respondent-address', { respondentAddress1: 'I', respondentAddress2: 'hope', respondentAddressTown: 'this', respondentAddressCountry: 'isnt', respondentAddressPostcode: postCode })
  await citizenUIPage(cookieJar, 'respondent/1/work-address', { claimantWorkAddressQuestion: YES })
  await citizenUIPage(cookieJar, 'respondent/1/acas-cert-num', { acasCert: YES, acasCertNum: 'R123456/12/34' })
  await citizenUIPage(cookieJar, 'respondent-details-check', { personalDetailsCheck: YES })
  await citizenUIPage(cookieJar, 'employment-respondent-task-check', { employmentAndRespondentCheck: YES })

  // Step 3
  await citizenUIPage(cookieJar, 'claim-type-discrimination', { claimTypeDiscrimination: 'Age' })
  await citizenUIPage(cookieJar, 'describe-what-happened', { claimSummaryText: 'idklol' })
  await citizenUIPage(cookieJar, 'claim-details-check', { claimDetailsCheck: YES })

  // Step 4
  temporaryLog(`Submitting case...`)
  const res = await makeAuthorisedRequest(`${ENV_CONFIG.CUI_BASE_URL}/submitDraftCase`, cookieJar, { redirect: 'manual' })
  const location = res.headers.get('location')
  if (res.status === 302) {
    const redirectUrl = location
    if (redirectUrl.endsWith('check-your-answers')) {
      return console.log(`Fail - Redirected back to check your answers page`)
    }
    console.log(`Redirected to ${location}`)
    const complete = await makeAuthorisedRequest(location, cookieJar, { redirect: 'manual' })
    const text = await complete.text()
    const submissionReference = /<dt class="govuk-summary-list__key">\W*Submission reference\W*<\/dt>\W*<dd class="govuk-summary-list__value">\W*(\d+)\W*<\/dd>/g.exec(text)?.[1]
    console.log(`OK! - ${submissionReference}`)
    return submissionReference
  }

  return console.log(`Fail - ${res.status}`)
}

function getCurrentYYMMDD() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()

  const nonce = Math.floor(Math.random() * 1000)

  return `${year}-${month}-${day}-${nonce}`
}


async function citizenUIPage(cookieJar: CookieJar, urlPart: string, data: any) {
  const base = `${ENV_CONFIG.CUI_BASE_URL}`
  const url = `${base}/${urlPart}`
  const getPage = await makeAuthorisedRequest(url, cookieJar)

  const text = await getPage.text()
  const csrf = getCsrf(text)

  const formData = Object.keys(data).reduce((formData, key) => {
    formData.append(key, data[key])
    return formData;
  }, new URLSearchParams({ _csrf: csrf }))

  temporaryLog(`Calling ${urlPart}...`)

  const res = await makeAuthorisedRequest(url, cookieJar, {
    method: 'POST',
    body: formData.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual'
  })

  const redirectTo = res.headers.get('Location')
  if (res.status === 302 && !redirectTo.includes('not-found')) {
    return console.log(`OK!`)
  }

  if (res.status === 302) {
    return console.log(`Fail - Redirected to ${redirectTo}`)
  }

  return console.log(`Fail - ${res.status}`)
}

function getCsrf(html: string) {
  return /name=._csrf. value=(.+?)>/.exec(html)?.[1]
}

async function performNoc(caseId: string, caseData: any) {
  if (!ENV_CONFIG.LEGALREP_USER || !ENV_CONFIG.LEGALREP_PASS) {
    return console.error(`LEGALREP_USER or LEGALREP_PASS not set`)
  }

  const cookieJar = await loginToIdam(ENV_CONFIG.LEGALREP_USER, ENV_CONFIG.LEGALREP_PASS, `${ENV_CONFIG.EXUI_URL}/auth/login`)
  const data = {
    "case_id": caseId,
    "answers": [
      { "question_id": "respondentName", "value": caseData.respondent },
      { "question_id": "claimantFirstName", "value": caseData.claimantIndType.claimant_first_names },
      { "question_id": "claimantLastName", "value": caseData.claimantIndType.claimant_last_name }]
  }

  const submit = await makeAuthorisedRequest(`${ENV_CONFIG.EXUI_URL}/api/noc/submitNoCEvents`, cookieJar, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  })

  const json = await submit.json()
  if (submit.status !== 200) {
    // Something went wrong
    return console.error(JSON.stringify(json))
  }

  if (json.status_message?.includes('successfully submitted')) {
    return console.log(`NOC submitted successfully`)
  }

  console.log(JSON.stringify(json))
}


const ROLES = [
  'caseworker',
  'caseworker-employment',
  'caseworker-employment-api',
  'caseworker-employment-englandwales',
  'caseworker-employment-scotland',
  'caseworker-employment-etjudge',
  'caseworker-employment-etjudge-englandwales',
  'caseworker-employment-etjudge-scotland',
  'caseworker-et-pcq-extractor',
  'caseworker-et-pcqextractor',
  'citizen',
  'caseworker-employment-legalrep-solicitor',
  'caseworker-approver',
  'caseworker-caa',
  'et-acas-api',
  'GS_profile',
  'caseworker-wa-task-configuration',
  'caseworker-ras-validation'
]

export async function createRoles(prNumber: string) {
  setCredentialsForEnvironment('preview', prNumber)
  const cookieJar = await loginToIdam(ENV_CONFIG.IMPORT_USER, ENV_CONFIG.IMPORT_PASS, `${ENV_CONFIG.IMPORT_URL}`)

  const url = `https://admin-web-et-ccd-definitions-admin-pr-${prNumber}.preview.platform.hmcts.net`

  for (const role of ROLES) {
    await makeAuthorisedRequest(`${url}/createuserrole`, cookieJar, {
      method: 'POST',
      body: `_csrf=&role=${role}&classification=PUBLIC`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })
  }

  const res = await makeAuthorisedRequest(`${url}/user-roles-list`, cookieJar)
  const html = await res.text()

  const missingRoles = ROLES.filter(o => !html.includes(o))

  if (missingRoles.length) {
    console.log(`Missing roles: ${missingRoles.join(', ')}`)
  }
}

export default {
  group: 'et-web',
  text: 'Create Case / Run Case Events',
  fn: journey,
  alias: 'WebUpsertCase'
} as Journey
