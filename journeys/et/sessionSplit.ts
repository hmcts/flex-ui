import { prompt, Separator } from "inquirer";
import { createNewSession, getFieldCount, getFieldsPerPage, getPageCount, saveSession, session } from "app/session";
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, Journey, Scrubbed, Session } from "types/types";
import { getObjectsReferencedByCaseFields } from "app/et/duplicateCaseField";
import { format, upsertFields } from "app/helpers";
import { COMPOUND_KEYS } from "app/constants";

const QUESTION_PAGE_ID = `Export fields from what page?`;
const QUESTION_PAGE_ID_START = 'Starting from (including) what page ID?';
const QUESTION_PAGE_ID_END = `Up to (including) what page ID?`;
const QUESTION_NAME = "What's the name of the session to export {0} fields to?"
const QUESTION_NAME_BY_PAGE = `What's the name of the session to export page {0} ({1} fields) to?`
const QUESTION_NAME_NO_COUNT = 'Whats the name for this session file?';

/**
 * Asks how the current session file should be split
 */
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
      { name: 'PageID', message: QUESTION_PAGE_ID, type: 'list', choices: [...pageChoices, new Separator(), RANGE, ALL, new Separator()] },
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
    { name: 'sessionName', message: format(QUESTION_NAME, fieldCountOnPage), type: 'input' },
  ])

  createSessionFromPage(answers.PageID, followup.sessionName)
}

/**
 * Flow for splitting each page into its own session file
 */
async function splitPageByPage(fieldCountByPage: Record<number, number>) {
  const totalPages = Object.keys(fieldCountByPage).length

  for (let i = 1; i < totalPages + 1; i++) {
    const fieldCountOnPage = fieldCountByPage[i]

    const answers = await prompt([
      { name: 'sessionName', message:format(QUESTION_NAME_BY_PAGE, i, fieldCountOnPage), type: 'input' },
    ])

    createSessionFromPage(i, answers.sessionName)
  }
}

/**
 * Flow for splitting a range of pages into one session file
 */
async function splitRangePage(pageChoices: { name: string; value: number; }[]) {
  let answers = await prompt([
    { name: 'startPage', message: QUESTION_PAGE_ID_START, type: 'list', choices: pageChoices },
  ])

  const lastPageChoice = pageChoices.filter(o => o.value > Number(answers.startPage)).sort()

  answers = await prompt([
    { name: 'lastPage', message: QUESTION_PAGE_ID_END, type: 'list', choices: [...lastPageChoice, new Separator()] },
    { name: 'sessionName', message: QUESTION_NAME_NO_COUNT, type: 'input' }
  ], answers)

  const newSession = createNewSession(answers.sessionName)

  for (let i = 1; i < Number(answers.lastPage) + 1; i++) {
    addPageToSession(i, newSession)
  }
}

/**
 * Creates a new session from a single page
 */
function createSessionFromPage(pageId: number, sessionName: string) {
  const full: Session['added'] = JSON.parse(JSON.stringify(session.added))

  const fieldsOnPage = full.CaseEventToFields.filter(o => o.PageID === pageId)
  const newSession = createNewSession(sessionName)

  newSession.added = getObjectsReferencedByCaseFields(full, full.CaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.ID)))
  newSession.date = new Date()

  saveSession(newSession)
}

/**
 * Adds a page's fields and related objects from the current session to a passed in session
 */
function addPageToSession(pageId: number, newSession: Session) {
  const full: ConfigSheets = JSON.parse(JSON.stringify(session.added))

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