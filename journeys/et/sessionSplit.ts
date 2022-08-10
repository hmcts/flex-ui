import { prompt, Separator } from "inquirer";
import { getFieldCount, getFieldsPerPage, getPageCount, saveSession, session } from "app/session";
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, Journey, Scrubbed, Session } from "types/types";
import { createNewSession } from "app/objects";
import { getObjectsReferencedByCaseFields } from "app/et/duplicateCaseField";
import { upsertFields } from "app/helpers";
import { COMPOUND_KEYS } from "app/et/constants";

async function splitSession() {
  const ALL = "ALL"
  const RANGE = "RANGE"

  const validPages = getFieldsPerPage()
  const largestNumberLength = Object.keys(validPages).reduce((acc: number, obj) => Math.max(acc, obj.length), 0)

  //TODO: Potentially bring page any custom page names for these pages to make identifying them easier
  const pageChoices = Object.keys(validPages).map(o => {
    return {
      name: o.padStart(largestNumberLength, '0'),
      value: Number(o)
    }
  })

  const answers = await prompt(
    [
      { name: 'PageID', message: `Export fields from what page?`, type: 'list', choices: [...pageChoices, new Separator(), RANGE, ALL, new Separator()] },
    ]
  )

  if (answers.PageID === ALL) {
    return splitPageByPage(validPages)
  }

  if (answers.PageID === RANGE) {
    return splitRangePage(pageChoices)
  }

  const fieldCountOnPage = validPages[answers.PageID]

  const followup = await prompt([
    { name: 'sessionName', message: `What's the name of the session to export ${fieldCountOnPage} fields to?`, type: 'input' },
  ])

  createSessionFromPage(answers.PageID, followup.sessionName)
}

async function splitPageByPage(fieldCountByPage: Record<number, number>) {
  const totalPages = Object.keys(fieldCountByPage).length

  for (let i = 1; i < totalPages + 1; i++) {
    const fieldCountOnPage = fieldCountByPage[i]

    const answers = await prompt([
      { name: 'sessionName', message: `What's the name of the session to export page ${i} (${fieldCountOnPage} fields) to?`, type: 'input' },
    ])

    createSessionFromPage(i, answers.sessionName)
  }
}

async function splitRangePage(pageChoices: { name: string; value: number; }[]) {
  let answers = await prompt([
    { name: 'startPage', message: 'Starting from (including) what page ID?', type: 'list', choices: pageChoices },
  ])

  const lastPageChoice = pageChoices.filter(o => o.value > Number(answers.startPage)).sort()

  answers = await prompt([
    { name: 'lastPage', message: `Up to (including) what page ID?`, type: 'list', choices: [...lastPageChoice, new Separator()] },
    { name: 'sessionName', message: 'Whats the name for this session file?', type: 'input' }
  ], answers)

  const newSession = createNewSession(answers.sessionName)

  for (let i = 1; i < Number(answers.lastPage) + 1; i++) {
    addPageToSession(i, newSession)
  }
}

function createSessionFromPage(pageId: number, sessionName: string) {
  const full: Session['added'] = JSON.parse(JSON.stringify(session.added))

  const fieldsOnPage = full.CaseEventToFields.filter(o => o.PageID === pageId)
  const newSession = createNewSession(sessionName)

  newSession.added = getObjectsReferencedByCaseFields(full, full.CaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.ID)))
  newSession.date = new Date()

  saveSession(newSession)
}

function addPageToSession(pageId: number, newSession: Session) {
  const full: Session['added'] = JSON.parse(JSON.stringify(session.added))

  const fieldsOnPage = full.CaseEventToFields.filter(o => o.PageID === pageId)

  upsertFields<AuthorisationCaseEvent>(
    newSession.added.AuthorisationCaseEvent,
    full.AuthorisationCaseEvent.filter(o => newSession.added.CaseEvent.find(x => x.ID === o.CaseEventID)),
    COMPOUND_KEYS.AuthorisationCaseEvent
  )

  upsertFields<AuthorisationCaseField>(
    newSession.added.AuthorisationCaseField,
    full.AuthorisationCaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.CaseFieldID)),
    COMPOUND_KEYS.AuthorisationCaseField
  )

  upsertFields<CaseEvent>(
    newSession.added.CaseEvent,
    full.CaseEvent.filter(o => fieldsOnPage.find(x => x.CaseEventID === o.ID)),
    COMPOUND_KEYS.CaseEvent
  )

  upsertFields<CaseEventToField>(
    newSession.added.CaseEventToFields,
    fieldsOnPage,
    COMPOUND_KEYS.CaseEventToField
  )

  upsertFields<CaseField>(
    newSession.added.CaseField,
    full.CaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.ID)),
    COMPOUND_KEYS.CaseField
  )

  upsertFields<Scrubbed>(
    newSession.added.Scrubbed,
    full.Scrubbed.filter(o => newSession.added.CaseField.find(x => x.FieldTypeParameter === o.ID)),
    COMPOUND_KEYS.Scrubbed
  )

  newSession.date = new Date()

  saveSession(newSession)
}


function getText() {
  return `Split current session (${getFieldCount()} fields across ${getPageCount().length} pages)`
}

export default {
  group: 'et-session',
  text: getText,
  fn: splitSession
} as Journey