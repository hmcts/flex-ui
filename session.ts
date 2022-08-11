import { readFileSync, writeFileSync } from "fs"
import { readdir } from "fs/promises"
import { sep } from "path"
import { addNewScrubbed, addToInMemoryConfig, upsertNewCaseEvent } from "app/et/configs"
import { COMPOUND_KEYS } from "app/constants"
import { upsertFields } from "app/helpers"
import { trimCaseEventToField, trimCaseField } from "app/objects"
import { Answers, ConfigSheets, Session } from "types/types"

export const SESSION_DIR = 'sessions'
export const SESSION_EXT = '.session.json'

export const session: Session = createNewSession(`session_${Math.floor(Date.now() / 1000)}`)
saveSession(session)

/**
 * Save session to the sessions folder
 */
export function saveSession(session: Session) {
  writeFileSync(`${SESSION_DIR}${sep}${session.name}${SESSION_EXT}`, JSON.stringify(session, null, 2))
}

/**
 * Creates a new session and sets singleton
 * @param name Name for the session (don't include the extension)
 * @returns the new session
 */
export function createAndLoadNewSession(name: string) {
  const newSession = createNewSession(name)

  for (const key in newSession) {
    session[key] = newSession[key]
  }

  saveSession(session)
  return session
}

/**
 * Reads specific session file from file and loads it into the singleton. Loads contents into in-memory configs
 * @param sessionFileName Name of the session on disk (must include the extension)
 */
export function restorePreviousSession(sessionFileName: string) {
  const read = readFileSync(`${SESSION_DIR}${sep}${sessionFileName}`)
  const json: Session = JSON.parse(read.toString())

  session.added = {
    AuthorisationCaseField: json.added.AuthorisationCaseField || [],
    CaseEvent: json.added.CaseEvent || [],
    CaseEventToFields: json.added.CaseEventToFields.map(o => trimCaseEventToField(o)) || [],
    CaseField: json.added.CaseField.map(o => trimCaseField(o)) || [],
    Scrubbed: json.added.Scrubbed || [],
    AuthorisationCaseEvent: json.added.AuthorisationCaseEvent || [],
    EventToComplexTypes: json.added.EventToComplexTypes || []
  }
  session.date = json.date
  session.name = json.name

  addToInMemoryConfig({
    AuthorisationCaseField: session.added.AuthorisationCaseField,
    CaseField: session.added.CaseField,
    CaseEventToFields: session.added.CaseEventToFields,
    AuthorisationCaseEvent: session.added.AuthorisationCaseEvent,
    EventToComplexTypes: session.added.EventToComplexTypes,
  })
  addNewScrubbed(session.added.Scrubbed)

  for (const event of session.added.CaseEvent) {
    upsertNewCaseEvent(event)
  }

  if (!json.lastAnswers) return

  for (const key in json.lastAnswers) {
    session.lastAnswers[key as keyof (Answers)] = json.lastAnswers[key as keyof (Answers)]
  }
}

/**
 * Finds all saved session files in the session folder
 * @returns array of session file names
 */
export async function findPreviousSessions() {
  const files = await readdir(SESSION_DIR, { withFileTypes: true })
  return files.filter(o => o.name.endsWith(SESSION_EXT)).map(o => o.name)
}

/**
 * Upserts objects into the current session
 * @param fields object containing supported ccd config fields
 */
export function addToSession(fields: ConfigSheets) {
  if (fields.AuthorisationCaseField.length) {
    upsertFields(session.added.AuthorisationCaseField, fields.AuthorisationCaseField, COMPOUND_KEYS.AuthorisationCaseField)
  }

  if (fields.CaseField.length) {
    upsertFields(session.added.CaseField, fields.CaseField, COMPOUND_KEYS.CaseField)
  }

  if (fields.CaseEventToFields.length) {
    upsertFields(session.added.CaseEventToFields, fields.CaseEventToFields, COMPOUND_KEYS.CaseEventToField)
  }

  if (fields.Scrubbed.length) {
    upsertFields(session.added.Scrubbed, fields.Scrubbed, COMPOUND_KEYS.Scrubbed)
  }

  if (fields.CaseEvent.length) {
    upsertFields(session.added.CaseEvent, fields.CaseEvent, COMPOUND_KEYS.CaseEvent)
  }

  if (fields.AuthorisationCaseEvent.length) {
    upsertFields(session.added.AuthorisationCaseEvent, fields.AuthorisationCaseEvent, COMPOUND_KEYS.AuthorisationCaseEvent)
  }

  if (fields.EventToComplexTypes.length) {
    upsertFields(session.added.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexType)
  }
}

/**
 * Gets the count of CaseFields in the current session
 */
export function getFieldCount() {
  return session.added.CaseField.length
}

/**
 * Gets a record of Fields by Page
 */
export function getFieldsPerPage(): Record<number, number> {
  return session.added.CaseEventToFields.reduce((acc: any, obj) => {
    if (!acc[obj.PageID]) {
      acc[obj.PageID] = 0
    }
    acc[obj.PageID]++
    return acc
  }, {})
}

/**
 * Gets a count of pages in the current session
 */
export function getPageCount() {
  return Object.keys(getFieldsPerPage())
}

/**
 * Adds to the lastAnswers object for this session
 */
export function addToLastAnswers(answers: any) {
  session.lastAnswers = {
    ...session.lastAnswers,
    ...answers
  }
}

/**
 * Creates a new blank object for a session
 */
export function createNewSession(name: string): Session {
  return {
    name,
    date: new Date(),
    lastAnswers: {},
    added: {
      AuthorisationCaseField: [],
      CaseEventToFields: [],
      CaseField: [],
      Scrubbed: [],
      CaseEvent: [],
      AuthorisationCaseEvent: [],
      EventToComplexTypes: [],
    }
  }
}