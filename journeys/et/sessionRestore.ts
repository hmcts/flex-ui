import { findPreviousSessions, restorePreviousSession } from 'app/session'
import { Journey } from 'types/journey'
import { loadCurrentSessionIntoMemory } from 'app/et/configs'
import { askAutoComplete } from 'app/questions'
import { CANCEL } from 'app/constants'

const QUESTION_PREVIOUS_SESSION = 'Select a previous session'

async function restoreSession() {
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

  const answers = await askAutoComplete('name', QUESTION_PREVIOUS_SESSION, CANCEL, [CANCEL, ...prevSessions], true, false)

  if (answers.name === CANCEL) {
    return
  }

  restorePreviousSession(answers.name)
  loadCurrentSessionIntoMemory()
}

export default {
  group: 'et-session',
  text: 'Restore a previous session',
  fn: restoreSession
} as Journey
