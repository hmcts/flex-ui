import { readInCurrentConfig } from 'app/et/configs'

async function init() {
  checkEnvVars()
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

export default init
