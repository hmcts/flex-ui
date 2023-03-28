import { findPreviousSessions, restorePreviousSession, session } from 'app/session'
import { Journey } from 'types/journey'
import { askAutoComplete } from 'app/questions'
import { CANCEL, COMPOUND_KEYS } from 'app/constants'
import { sheets } from 'app/configs'
import { upsertFields } from 'app/helpers'

const QUESTION_PREVIOUS_SESSION = 'Select a previous session'

export async function restoreSession() {
  const prevSessions = await findPreviousSessions()

  if (!prevSessions.length) {
    console.warn('There are no previous sessions found')
    return
  }

  // Sink unnamed sessions to the end (keeping them alpha)
  prevSessions.sort((a, b) => {
    const aDefault = !!a.match(/^session_\d+/)
    const bDefault = !!b.match(/^session_\d+/)

    if (aDefault === bDefault) {
      return a.toLowerCase() > b.toLowerCase() ? 1 : -1
    }

    return aDefault ? 1 : -1
  })

  const answers = await askAutoComplete({}, { name: 'name', message: QUESTION_PREVIOUS_SESSION, default: CANCEL, choices: [CANCEL, ...prevSessions], sort: false })

  if (answers.name === CANCEL) {
    return
  }

  restorePreviousSession(answers.name)
}

export async function restoreSessionJourney() {
  await restoreSession()

  for (const sheetName in sheets) {
    upsertFields(sheets[sheetName], session.added[sheetName], COMPOUND_KEYS[sheetName])
  }
}

export default {
  group: 'session',
  text: 'Restore a previous session',
  fn: restoreSessionJourney,
  alias: 'SessionRestore'
} as Journey
