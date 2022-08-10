import 'source-map-support/register'
import { config as envConfig } from 'dotenv'
import { prompt, Separator, registerPrompt } from 'inquirer'
import autocomplete from "inquirer-autocomplete-prompt"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, Journey, Scrubbed, Session } from './types/types'
import { createAuthorisationCaseEvent, createAuthorisationCaseFields, createNewCaseEvent, createNewCaseEventToField, createNewCaseField, createNewEventToComplexType, createNewSession, trimCaseEventToField, trimCaseField } from './objects'
import { addNewScrubbed, addToInMemoryConfig, execGenerateSpreadsheet, getScrubbedOpts, upsertNewCaseEvent, readInCurrentConfig, saveBackToProject, getCaseEventIDOpts, execImportConfig, getConfigSheetsForCaseTypeId } from './et/configs'
import { ensurePathExists, getFiles, upsertFields } from './helpers'
import { findPreviousSessions, getFieldCount, getFieldsPerPage, getPageCount, restorePreviousSession, saveSession, session, SESSION_DIR } from './session'
import { ensureUp, tearDown } from './setup'
import { askYesNo, listOrFreeType, requestCaseTypeID } from './questions'
import { CASE_FIELD_TYPES, DIST_JOURNEY_DIR, JOURNEY_DIR, NO_DUPLICATE } from './constants'
import fuzzy from "fuzzy"
import { readdir } from 'fs/promises'
import { sep } from 'path'
// https://dev.to/larswaechter/path-aliases-with-typescript-in-nodejs-4353
import 'module-alias/register';
import { addOnDuplicateQuestion } from './journeys/et/manageDuplicateField'
import { getObjectsReferencedByCaseFields } from './et/duplicateCaseField'
import { createNewCase } from './web'

envConfig()

registerPrompt('autocomplete', autocomplete);

function checkEnvVars() {
  const needed = [process.env.ENGWALES_DEF_DIR, process.env.SCOTLAND_DEF_DIR]
  const missing = needed.filter(o => !o)
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

const NEW = "New..."

function isJourneyValid(journey: any) {
  if (!journey.text || !['function', 'string'].includes(typeof (journey.text))) {
    return false
  }

  if (journey.fn && typeof (journey.fn) !== 'function') {
    return false
  }

  return true
}

async function discoverJourneys() {
  const files = (await getFiles(DIST_JOURNEY_DIR)).filter(o => o.endsWith('.js'))
  return files.map(o => require(o).default).filter(o => isJourneyValid(o)) as Journey[]
}

async function createMainMenuChoices() {
  const remoteJourneys = await discoverJourneys()

  let choices: Journey[] = []

  remoteJourneys.forEach(o => choices.push(o))

  choices.sort((a, b) => (a.group || 'default') > (b.group || 'default') ? -1 : 1)

  for (let i = 1; i < choices.length; i++) {
    const journey = choices[i]
    const previous = choices[i - 1]

    if (journey.group !== previous.group) {
      choices.splice(i, 0, { text: new Separator() })
      i++
    }
  }

  return [
    ...choices,
    { group: 'program', text: 'Exit', fn: async () => { console.log(`Bye!`); process.exit(0) } },
    { text: new Separator() }
  ]
}

async function start() {
  ensurePathExists(SESSION_DIR)
  checkEnvVars()
  readInCurrentConfig()

  while (true) {
    let choices: Journey[] = await createMainMenuChoices()

    const answers = await prompt([
      {
        name: 'Journey',
        message: "What do you want to do?",
        type: 'list',
        choices: choices.map(o => typeof (o.text) === 'function' ? o.text() : o.text)
      }
    ])

    const selectedFn = choices.find(o => (typeof (o.text) === 'function' ? o.text() : o.text) === answers.Journey)

    if (!selectedFn) {
      throw new Error(`Unable to find a function for "${answers.Journey}"`)
    }

    if (!selectedFn.fn || typeof (selectedFn.fn) !== 'function') {
      throw new Error(`Journey ${answers.Journey} does not have a callable function attached to it`)
    }

    await selectedFn.fn()

    saveSession(session)
  }
}

start()