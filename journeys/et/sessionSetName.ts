import { prompt } from 'inquirer'
import { deleteSession, saveSession, session } from 'app/session'
import { Journey } from 'types/journey'

const QUESTION_NAME = 'What should we called this session?'

export async function setSessionName() {
  const answers = await prompt([{ name: 'name', message: QUESTION_NAME }])

  if (!answers.name) {
    return
  }

  session.name = answers.name

  const oldFile = session.file
  saveSession(session)
  deleteSession(oldFile)
}

function getText() {
  return `Rename current session (${session.name})`
}

export default {
  group: 'et-session',
  text: getText,
  fn: setSessionName
} as Journey
