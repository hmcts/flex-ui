import { createAndLoadNewSession } from 'app/session'
import { Journey } from 'types/journey'
import { setSessionName } from './sessionSetName'

async function newSession() {
  createAndLoadNewSession('temp')
  return await setSessionName()
}

export default {
  group: 'et-session',
  text: 'Create new session',
  fn: newSession
} as Journey
