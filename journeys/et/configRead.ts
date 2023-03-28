import { Journey } from 'types/journey'
import { getReadTime, loadCurrentSessionIntoMemory, readInCurrentConfig } from 'app/et/configs'
import { formatMsSpanNearestUnit } from '@spacepumpkin/format-timespan'
import { restorePreviousSession, session, SESSION_EXT } from 'app/session'

const STATIC_TEXT = 'Flush memory and read in configs'

function getText() {
  const dateLoaded = getReadTime()
  const timeAgo = `${formatMsSpanNearestUnit(Date.now() - getReadTime())} ago`
  return `${STATIC_TEXT} (${dateLoaded ? timeAgo : 'NOT LOADED'})`
}

function matchText(text: string) {
  return text.startsWith(STATIC_TEXT)
}

function readConfig() {
  readInCurrentConfig()
  // Reload the session to sync up in-memory config with session data
  restorePreviousSession(session.name + SESSION_EXT)
  loadCurrentSessionIntoMemory()
}

export default {
  group: 'configs',
  text: getText,
  matchText,
  fn: readConfig,
  alias: 'ConfigRead'
} as Journey
