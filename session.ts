import { readFileSync, writeFileSync } from "fs"
import { readdir } from "fs/promises"
import { sep } from "path"
import { addNewScrubbed, addToInMemoryConfig, doesEventExist, insertNewCaseEvent } from "./configs"
import { deduplicateAddFields } from "./helpers"
import { createNewSession, trimCaseEventToField, trimCaseField } from "./objects"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, Scrubbed, Session } from "./types/types"

export const SESSION_DIR = 'sessions'
export const SESSION_EXT = '.session.json'

export const session: Session = createNewSession(`sesssion_${Date.now()}`)

export const lastAnswers: Partial<Record<keyof (CaseField) | keyof (CaseEventToField), any>> = {}

export function setCurrentSessionName(name: string) {
  session.name = name
}

export function getCurrentSessionName() {
  return session.name
}

export function saveSession() {
  session.lastAnswers = lastAnswers
  writeFileSync(`${SESSION_DIR}${sep}${getCurrentSessionName()}${SESSION_EXT}`, JSON.stringify(session, null, 2))
}

export function restorePreviousSession(sessionName: string) {
  const read = readFileSync(`${SESSION_DIR}${sep}${sessionName}`)
  const json: Session = JSON.parse(read.toString())

  session.added = {
    AuthorisationCaseField: json.added.AuthorisationCaseField || [],
    CaseEvent: json.added.CaseEvent || [],
    CaseEventToFields: json.added.CaseEventToFields.map(o => trimCaseEventToField(o)) || [],
    CaseField: json.added.CaseField.map(o => trimCaseField(o)) || [],
    Scrubbed: json.added.Scrubbed || [],
    AuthorisationCaseEvent: json.added.AuthorisationCaseEvent || []
  }
  session.date = json.date
  session.name = json.name

  addToInMemoryConfig({
    AuthorisationCaseField: session.added.AuthorisationCaseField,
    CaseField: session.added.CaseField,
    CaseEventToFields: session.added.CaseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: session.added.AuthorisationCaseEvent
  })
  addNewScrubbed(session.added.Scrubbed)

  for (const event of session.added.CaseEvent) {
    if (doesEventExist(event)) continue
    insertNewCaseEvent(event)
  }

  if (!json.lastAnswers) return

  for (const key in json.lastAnswers) {
    //@ts-ignore
    lastAnswers[key] = json.lastAnswers[key]
  }

}

export async function findPreviousSessions() {
  const files = await readdir(SESSION_DIR, { withFileTypes: true })
  return files.filter(o => o.name.endsWith(SESSION_EXT)).map(o => o.name)
}

export function addToConfig(fields: ConfigSheets) {
  if (fields.AuthorisationCaseField.length) {
    deduplicateAddFields<AuthorisationCaseField>(session.added.AuthorisationCaseField, fields.AuthorisationCaseField, ['CaseFieldID', 'CaseTypeId', 'UserRole'])
  }

  if (fields.CaseField.length) {
    deduplicateAddFields<CaseField>(session.added.CaseField, fields.CaseField, ['ID', 'CaseTypeID'])
  }

  if (fields.CaseEventToFields.length) {
    deduplicateAddFields<CaseEventToField>(session.added.CaseEventToFields, fields.CaseEventToFields, ['CaseFieldID', 'CaseEventID', 'CaseTypeID'])
  }

  if (fields.Scrubbed.length) {
    deduplicateAddFields<Scrubbed>(session.added.Scrubbed, fields.Scrubbed, ['ID', 'ListElementCode'])
  }

  if (fields.CaseEvent.length) {
    deduplicateAddFields<CaseEvent>(session.added.CaseEvent, fields.CaseEvent, ['ID', 'CaseTypeID'])
  }

  if (fields.AuthorisationCaseEvent.length) {
    deduplicateAddFields<AuthorisationCaseEvent>(session.added.AuthorisationCaseEvent, fields.AuthorisationCaseEvent, ['CaseEventID', 'CaseTypeId', 'UserRole'])
  }
}