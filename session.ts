import { readFileSync, rmSync, writeFileSync } from 'fs'
import { readdir } from 'fs/promises'
import { resolve, sep } from 'path'
import { COMPOUND_KEYS } from 'app/constants'
import { getUniqueByKey, upsertFields } from 'app/helpers'
import { ConfigSheets, createNewConfigSheets, sheets } from 'types/ccd'
import { Answers } from 'app/questions'

export interface Session {
  name: string
  date: Date | string
  added: ConfigSheets
  lastAnswers: Answers
  file?: string
}

export const SESSION_DIR = 'sessions'
export const SESSION_EXT = '.session.json'

export const session: Session = createNewSession(`session_${Math.floor(Date.now() / 1000)}`)
saveSession(session)

/**
 * Save session to the sessions folder
 */
export function saveSession(session: Session) {
  const file = resolve(`.${sep}${SESSION_DIR}${sep}${session.name}${SESSION_EXT}`)
  session.file = file
  writeFileSync(file, JSON.stringify(session, null, 2))
}

/**
 * Delete a session if the file still exists in the session folder
 */
export async function deleteSession(file: string) {
  try {
    rmSync(file)
  } catch (e) {
    // Do Nothing
  }
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
  const file = resolve(`.${sep}${SESSION_DIR}${sep}${sessionFileName}`)
  const read = readFileSync(file)
  const json: Session = JSON.parse(read.toString())

  for (const sheet of sheets) {
    // We don't get type safety here - it doesn't recognise that these types are the same
    session.added[sheet] = json.added[sheet] || [] as any
  }

  session.date = json.date
  session.name = json.name

  if (!json.lastAnswers) return

  for (const key in json.lastAnswers) {
    session.lastAnswers[key] = json.lastAnswers[key]
  }

  session.file = file
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
export function addToSession(fields: Partial<ConfigSheets>) {
  for (const sheet of sheets) {
    if (fields[sheet]?.length) {
      // We don't get type safey here - there seems to be no way to tell TS that all these types align
      upsertFields<any>(session.added[sheet], fields[sheet] || [], COMPOUND_KEYS[sheet])
    }
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
  return getUniqueByKey(session.added.CaseEventToFields, 'PageID')
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
export function addToLastAnswers(answers: Answers = {}) {
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
    added: createNewConfigSheets()
  }
}

/** Check if any objects exist in any sheets */
export function isCurrentSessionEmpty() {
  return !Object.values(session.added).some(o => o.length)
}

/** Deletes empty previous sessions */
export async function cleanupEmptySessions() {
  const previous = await findPreviousSessions()

  for (const prev of previous) {
    const filename = `${SESSION_DIR}${sep}${prev}`
    const loaded: Session = JSON.parse(readFileSync(filename, 'utf-8'))

    if (loaded.name === session.name) continue

    // if any array inside session.added is not empty - don't delete
    if (Object.values(loaded.added).some(o => o.length)) {
      continue
    }

    rmSync(filename)
  }
}
