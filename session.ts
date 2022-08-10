import { readFileSync, writeFileSync } from "fs"
import { readdir } from "fs/promises"
import { sep } from "path"
import { addNewScrubbed, addToInMemoryConfig, upsertNewCaseEvent } from "./et/configs"
import { COMPOUND_KEYS } from "./et/constants"
import { upsertFields } from "./helpers"
import { createNewSession, trimCaseEventToField, trimCaseField } from "./objects"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, EventToComplexType, Scrubbed, Session } from "./types/types"

export const SESSION_DIR = 'sessions'
export const SESSION_EXT = '.session.json'

export const session: Session = createNewSession(`sesssion_${Date.now()}`)

export function saveSession(session: Session) {
  writeFileSync(`${SESSION_DIR}${sep}${session.name}${SESSION_EXT}`, JSON.stringify(session, null, 2))
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
    session.lastAnswers[key as keyof (Session['lastAnswers'])] = json.lastAnswers[key as keyof (Session['lastAnswers'])]
  }

}

export async function findPreviousSessions() {
  const files = await readdir(SESSION_DIR, { withFileTypes: true })
  return files.filter(o => o.name.endsWith(SESSION_EXT)).map(o => o.name)
}

export function addToSession(fields: ConfigSheets) {
  if (fields.AuthorisationCaseField.length) {
    upsertFields<AuthorisationCaseField>(session.added.AuthorisationCaseField, fields.AuthorisationCaseField, COMPOUND_KEYS.AuthorisationCaseField)
  }

  if (fields.CaseField.length) {
    upsertFields<CaseField>(session.added.CaseField, fields.CaseField, COMPOUND_KEYS.CaseField)
  }

  if (fields.CaseEventToFields.length) {
    upsertFields<CaseEventToField>(session.added.CaseEventToFields, fields.CaseEventToFields, COMPOUND_KEYS.CaseEventToField)
  }

  if (fields.Scrubbed.length) {
    upsertFields<Scrubbed>(session.added.Scrubbed, fields.Scrubbed, COMPOUND_KEYS.Scrubbed)
  }

  if (fields.CaseEvent.length) {
    upsertFields<CaseEvent>(session.added.CaseEvent, fields.CaseEvent, COMPOUND_KEYS.CaseEvent)
  }

  if (fields.AuthorisationCaseEvent.length) {
    upsertFields<AuthorisationCaseEvent>(session.added.AuthorisationCaseEvent, fields.AuthorisationCaseEvent, COMPOUND_KEYS.AuthorisationCaseEvent)
  }

  if (fields.EventToComplexTypes.length) {
    upsertFields<EventToComplexType>(session.added.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexType)
  }
}

export function getFieldCount() {
  return session.added.CaseField.length
}

export function getFieldsPerPage(): Record<number, number> {
  return session.added.CaseEventToFields.reduce((acc: any, obj) => {
    if (!acc[obj.PageID]) {
      acc[obj.PageID] = 0
    }
    acc[obj.PageID]++
    return acc
  }, {})
}

export function getPageCount() {
  return Object.keys(getFieldsPerPage())
}

export function addToLastAnswers(answers: any) {
  session.lastAnswers = {
    ...session.lastAnswers,
    ...answers
  }
}