import { ensurePathExists, execCommand } from 'app/helpers'
import { writeFileSync } from 'fs'
import { prompt } from 'inquirer'
import { sep } from 'path'
import { Journey } from 'types/journey'
import { getPostgresIPFromPod } from './previewEnvironment'

async function journey() {

  const OPTS = {
    MULTIPLES_XLSX: 'Get Multiples XLSX Link (local environment only)',
    NOTIFICATIONS_EXTRACT: 'Get the notifications extract (local environment only)',
    JSON: 'Open Case Data JSON in VSCode',
  }

  const answers = await prompt([{ name: 'task', message: 'What do we want to do?', type: 'list', choices: Object.values(OPTS) }])

  if (answers.task === OPTS.JSON) {
    await getCaseData()
  }

  if (answers.task === OPTS.MULTIPLES_XLSX) {
    await getMultiplesXlsx()
  }

  if (answers.task === OPTS.NOTIFICATIONS_EXTRACT) {
    await getMultiplesNotificationExtract()
  }
}

async function getMultiplesXlsx() {
  const answers = await prompt([{ name: 'id', message: 'Enter a case reference', default: '1700471689475915' }])

  // Default credentials are only for local environments and will not work anywhere else - secops
  const out = await execCommand(`PGPASSWORD="postgres" PGHOST="localhost" PGPORT=6432 psql -U postgres -d datastore -c "SELECT row_to_json(t) FROM (SELECT * from case_data WHERE reference = ${answers.id}) t"`, null, false)
  const contents = out.stdout.split('\n')?.[2]?.trim()

  try {
    const json = JSON.parse(contents)
    const excelUuid = json.data.caseImporterFile.uploadedDocument.document_url.split('/').pop()

    console.log(`Multiples XLSX: ${process.env.LOCAL_EXUI_URL}/documents/${excelUuid}/binary (CTRL+Click to open)`)
  } catch (e) {
    console.error(`Error parsing JSON, does the case exist?`)
  }
}

async function getMultiplesNotificationExtract() {
  const answers = await prompt([{ name: 'id', message: 'Enter a case reference', default: '1700471689475915' }])

  // Default credentials are only for local environments and will not work anywhere else - secops
  const out = await execCommand(`PGPASSWORD="postgres" PGHOST="localhost" PGPORT=6432 psql -U postgres -d datastore -c "SELECT row_to_json(t) FROM (SELECT * from case_data WHERE reference = ${answers.id}) t"`, null, false)
  const contents = out.stdout.split('\n')?.[2]?.trim()

  try {
    const json = JSON.parse(contents)
    const excelUuid = json.data.notificationsExtract.notificationsExtractFile.document_url.split('/').pop()

    console.log(`Notifications Extract XLSX: ${process.env.LOCAL_EXUI_URL}/documents/${excelUuid}/binary (CTRL+Click to open)`)
  } catch (e) {
    console.error(`Error parsing JSON, does the case exist or is the extract genertated?`)
  }
}

async function getCaseData() {
  const OPTS = ['AAT', 'DEMO', 'ITHC', 'LOCAL', 'PREVIEW']

  const answers = await prompt([
    { name: 'env', message: 'What environment?', type: 'list', choices: OPTS },
    { name: 'pr', message: 'What PR number?', default: '316', when: answers => answers.env === 'PREVIEW' },
    { name: 'id', message: 'Enter a case reference', default: '1700471689475915' }
  ])

  const pgLogin = {
    // Default credentials are only for local environments and will not work anywhere else - secops
    user: process.env[`${answers.env}_DB_DATA_STORE_USER`] || 'postgres',
    pass: process.env[`${answers.env}_DB_DATA_STORE_PASS`] || 'postgres',
    host: process.env[`${answers.env}_DB_DATA_STORE_HOST`] || 'localhost',
    port: process.env[`${answers.env}_DB_DATA_STORE_PORT`] || 6432,
    database: answers.env === 'LOCAL' ? 'datastore' : 'ccd_data_store'
  }

  if (answers.pr) {
    const ip = await getPostgresIPFromPod(answers.pr)
    pgLogin.host = ip
    pgLogin.database = 'data-store'
  }

  if (!process.env[`${answers.env}_DB_DATA_STORE_USER`]) {
    return console.warn(`No environment variables found for ${answers.env} - expecting ${answers.env}_DB_DATA_STORE_USER, ${answers.env}_DB_DATA_STORE_PASS, ${answers.env}_DB_DATA_STORE_HOST, ${answers.env}_DB_DATA_STORE_PORT`)
  }

  const out = await execCommand(`PGPASSWORD="${pgLogin.pass}" PGHOST="${pgLogin.host}" PGPORT=${pgLogin.port} psql -U ${pgLogin.user} -d ${pgLogin.database} -c "SELECT row_to_json(t) FROM (SELECT * from case_data WHERE reference = ${answers.id}) t"`, null, false)
  const contents = out.stdout.split('\n')?.[2]?.trim()
  try {
    ensurePathExists('tmp')
    const file = `tmp${sep}${answers.id}.json`

    writeFileSync(file, JSON.stringify(JSON.parse(contents), null, 2))
    await execCommand(`code ${file}`, null, false)
  } catch (e) {
    console.error(`Error parsing JSON, does the case exist?`)
  }
}

export default {
  disabled: false,
  group: 'et-db',
  text: '[WIP] Database commands',
  fn: journey,
  alias: 'DB'
} as Journey
