import { prompt } from "inquirer";
import { findPreviousSessions, restorePreviousSession } from "app/session";
import { Journey } from "types/types";

const QUESTION_PREVIOUS_SESSION = "Select a previous session";

async function restoreSession() {
  const prevSessions = await findPreviousSessions()

  if (!prevSessions.length) {
    console.warn(`There are no previous sessions found`)
    return
  }

  const answers = await prompt([
    { name: 'name', message: QUESTION_PREVIOUS_SESSION, type: 'list', choices: ['Cancel', ...prevSessions] }
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