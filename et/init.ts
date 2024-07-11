import { COMPOUND_KEYS } from 'app/constants'
import { readInCurrentConfig } from 'app/et/configs'
import createSingleField from 'app/journeys/base/createSingleField'
import createEvent from 'app/journeys/et/createEvent'
import createScrubbed from 'app/journeys/et/createScrubbed'
import { createJourneys } from 'app/questions'
import { ComplexType, EventToComplexType, Scrubbed } from 'app/types/ccd'

async function init() {
  checkEnvVars()
  updateCompoundKeys()
  updateCreateJourneys()
  await readInCurrentConfig(undefined, process.env.ENGWALES_DEF_DIR, process.env.SCOTLAND_DEF_DIR)
}

/**
 * Check required environment variables are present.
 */
export function checkEnvVars() {
  const needed = ['ENGWALES_DEF_DIR', 'SCOTLAND_DEF_DIR']
  const missing = needed.filter(o => !process.env[o])
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

/** Add ET's custom flexRegion as part of COMPOUND_KEYS */
function updateCompoundKeys() {
  COMPOUND_KEYS.ComplexTypes = ['ID', 'ListElementCode', 'flexRegion'] as Array<(keyof ComplexType)>
  COMPOUND_KEYS.EventToComplexTypes = ['ID', 'CaseEventID', 'CaseFieldID', 'ListElementCode', 'flexRegion'] as Array<(keyof EventToComplexType)>
  COMPOUND_KEYS.Scrubbed = ['ID', 'ListElementCode', 'flexRegion'] as Array<(keyof Scrubbed)>
}

/** Add ET's custom create journeys */
function updateCreateJourneys() {
  createJourneys.createEvent = createEvent.fn
  createJourneys.createScrubbed = createScrubbed.fn
  createJourneys.createField = createSingleField.fn
}

export default init
