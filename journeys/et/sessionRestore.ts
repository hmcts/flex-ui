import { prompt } from "inquirer"
import { findPreviousSessions, restorePreviousSession } from "app/session"
import { Journey } from "types/journey"
import { getIdealSizeForInquirer } from "app/helpers"

const QUESTION_PREVIOUS_SESSION = "Select a previous session"

async function restoreSession() {
  const prevSessions = await findPreviousSessions()

  if (!prevSessions.length) {
    console.warn(`There are no previous sessions found`)
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

  const answers = await prompt([
    { name: 'name', message: QUESTION_PREVIOUS_SESSION, type: 'list', choices: ['Cancel', ...prevSessions], pageSize: getIdealSizeForInquirer() }
  ])

  if (answers.name === 'Cancel') {
    return
  }

  restorePreviousSession(answers.name)
}

export default {
  group: 'et-session',
  text: 'Restore a previous session',
  fn: restoreSession
} as Journey