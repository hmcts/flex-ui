import { readFileSync, writeFileSync } from "fs"
import { readdir } from "fs/promises"
import { sep } from "path"
import { addNewScrubbed, addToInMemoryConfig } from "./configs"
import { createNewSession } from "./objects"
import { AuthorisationCaseField, CaseEventToField, CaseField, ConfigSheets, Scrubbed, Session } from "./types/types"

export const SESSION_DIR = 'sessions'
export const SESSION_EXT = '.session.json'

export const session: Session = createNewSession(`sesssion_${Date.now()}`)

export function setCurrentSessionName(name: string) {
  session.name = name
}

export function getCurrentSessionName() {
  return session.name
}

export function saveSession() {
  writeFileSync(`${SESSION_DIR}${sep}${getCurrentSessionName()}${SESSION_EXT}`, JSON.stringify(session, null, 2))
}

export function restorePreviousSession(sessionName: string) {
  const read = readFileSync(`${SESSION_DIR}${sep}${sessionName}`)
  const json = JSON.parse(read.toString())

  session.added = json.added
  session.date = json.date
  session.name = json.name

  addToInMemoryConfig(session.added.CaseField, session.added.CaseEventToFields, session.added.AuthorisationCaseField)
  addNewScrubbed(session.added.Scrubbed)
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
}

function deduplicateAddFields<T>(arr1: T[], arr2: T[], keys: (keyof (T))[]) {
  for (const obj of arr2) {
    const existing = arr1.find(o => matcher(o, obj, keys))
    if (existing) continue
    arr1.push(obj)
  }
}

function matcher<T>(item1: T, item2: T, keys: (keyof (T))[]) {
  for (const key of keys) {
    if (item1[key] !== item2[key]) {
      return false
    }
  }
  return true
}