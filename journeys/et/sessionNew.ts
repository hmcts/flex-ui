import { prompt } from "inquirer";
import { createAndLoadNewSession} from "app/session";
import { Journey } from "types/types";
import { setSessionName } from "./sessionSetName";

const QUESTION_NAME = "What should we called this session?";

async function newSession() {
  createAndLoadNewSession('temp')
  return setSessionName()
}

export default {
  group: 'et-session',
  text: 'Create new session',
  fn: newSession
} as Journey