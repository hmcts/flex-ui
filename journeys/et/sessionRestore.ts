import { Journey } from 'types/journey'
import { loadCurrentSessionIntoMemory } from 'app/et/configs'
import { restoreSession } from '../base/sessionRestore'

async function restoreETSession() {
  await restoreSession()
  loadCurrentSessionIntoMemory()
}

export default {
  group: 'session',
  text: 'Restore a previous session',
  fn: restoreETSession,
  alias: 'SessionRestore'
} as Journey
