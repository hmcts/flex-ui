import { prompt } from "inquirer";
import { session } from "app/session";
import { Journey } from "types/types";

async function setSessionName() {
  const answers = await prompt([{ name: 'name', message: "What should we called this session?" }])

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