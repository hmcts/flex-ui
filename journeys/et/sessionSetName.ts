import { prompt } from "inquirer"
import { session } from "app/session"
import { Journey } from "types/journey"

const QUESTION_NAME = "What should we called this session?"

export async function setSessionName() {
  const answers = await prompt([{ name: 'name', message: QUESTION_NAME }])

  session.name = answers.name
}

function getText() {
  return `Rename current session (${session.name})`
}

export default {
  group: 'et-session',
  text: getText,
  fn: setSessionName
} as Journey