import 'source-map-support/register'
import { config as envConfig } from 'dotenv'
import { prompt, Separator, registerPrompt } from 'inquirer'
import autocomplete from "inquirer-autocomplete-prompt"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, Journey,  Scrubbed, Session } from './types/types'
import { createAuthorisationCaseEvent, createAuthorisationCaseFields, createNewCaseEvent, createNewCaseEventToField, createNewCaseField, createNewEventToComplexType, createNewSession, trimCaseEventToField, trimCaseField } from './objects'
import { addNewScrubbed, addToInMemoryConfig, execGenerateSpreadsheet, getScrubbedOpts, upsertNewCaseEvent, readInCurrentConfig, saveBackToProject, getCaseEventIDOpts, getEnglandWales, getScotland, execImportConfig } from './et/configs'
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

async function start() {
  ensurePathExists(SESSION_DIR)
  checkEnvVars()
  readInCurrentConfig()

  const extraJourneys = await discoverJourneys()

  while (true) {
    const journeySplitSessionOpt = `Split current session (${getFieldCount()} fields across ${getPageCount().length} pages)`

    let choices: Journey[] = [
      { group: 'program', text: 'Exit', fn: async () => { console.log(`Bye!`); process.exit(0) } },
    ]

    extraJourneys.forEach(o => choices.push(o))

    choices.sort((a, b) => (a.group || 'default') > (b.group || 'default') ? -1 : 1)

    for (let i = 1; i < choices.length; i++) {
      const journey = choices[i]
      const previous = choices[i - 1]

      if (journey.group !== previous.group) {
        choices.splice(i, 0, { text: new Separator() })
        i++
      }
    }

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
      throw new Error(`Uh-oh, unable to find your selected option. Probably a dev error`)
    }

    if (selectedFn.fn) {
      await selectedFn.fn()
    }

    saveSession(session)
  }
}

async function journeyValidateAuthorisationCaseFields() {
  const OTHER = "Other..."

  const answers = await prompt(
    [
      { name: 'caseTypeId', message: `What is the caseTypeId?`, type: 'list', choices: ["ET_EnglandWales", "ET_Scotland", OTHER] },
    ]
  )

  if (answers.caseTypeId === OTHER) {
    const followup = await prompt(
      [
        { name: 'caseTypeId', message: `Enter a custom caseTypeId` },
      ]
    )
    answers.caseTypeId = followup.caseTypeId
  }

  const region = answers.caseTypeId.startsWith("ET_EnglandWales") ? getEnglandWales() : getScotland()

  const uniqueCaseFields = region.AuthorisationCaseField.filter(o => o.CaseTypeId === answers.caseTypeId).reduce((acc: any, obj) => {
    acc[obj.CaseFieldID] = true
    return acc
  }, {})

  const standardizedRoles = Object.keys(uniqueCaseFields).flatMap(o => createAuthorisationCaseFields(answers.caseTypeId, o))
    .filter(o => o.UserRole === "caseworker-employment-legalrep-solicitor")

  for (const auth of standardizedRoles) {
    const alreadyExists = region.AuthorisationCaseField.find(o => o.CaseFieldID === auth.CaseFieldID && o.UserRole === auth.UserRole && o.CaseTypeId === auth.CaseTypeId)
    if (alreadyExists) continue

    const insertIndex = region.AuthorisationCaseField.findIndex(o => o.CaseFieldID === auth.CaseFieldID)
    region.AuthorisationCaseField.splice(insertIndex, 0, auth)
  }
}

start()