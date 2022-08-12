import { createAndLoadNewSession} from "app/session"
import { Journey } from "types/types"
import { setSessionName } from "./sessionSetName"

async function newSession() {
  createAndLoadNewSession('temp')
  return setSessionName()
}

export default {
  group: 'et-session',
  text: 'Create new session',
  fn: newSession
} as Journey