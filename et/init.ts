import { COMPOUND_KEYS } from 'app/constants'
import { readInCurrentConfig } from 'app/et/configs'
import { ComplexType, EventToComplexType, Scrubbed } from 'app/types/ccd'

async function init() {
  checkEnvVars()
  updateCompoundKeys()
  readInCurrentConfig()
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
  COMPOUND_KEYS.EventToComplexTypes = ['ID', 'ListElementCode', 'flexRegion'] as Array<(keyof EventToComplexType)>
  COMPOUND_KEYS.Scrubbed = ['ID', 'ListElementCode', 'flexRegion'] as Array<(keyof Scrubbed)>
}

export default init
