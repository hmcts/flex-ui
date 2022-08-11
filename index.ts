import 'source-map-support/register'
// https://dev.to/larswaechter/path-aliases-with-typescript-in-nodejs-4353
import 'module-alias/register';
import { config as envConfig } from 'dotenv'
import { prompt, Separator, registerPrompt } from 'inquirer'
import autocomplete from "inquirer-autocomplete-prompt"
import { Journey } from 'types/types'
import { readInCurrentConfig } from 'app/et/configs'
import { ensurePathExists, getFiles } from 'app/helpers'
import { saveSession, session, SESSION_DIR } from 'app/session'
import { DIST_JOURNEY_DIR } from 'app/constants'

envConfig()
registerPrompt('autocomplete', autocomplete);

/**
 * Check required environment variables are present.
 * TOOD: This is ET specific logic and should be refactored
 */
function checkEnvVars() {
  const needed = [process.env.ENGWALES_DEF_DIR, process.env.SCOTLAND_DEF_DIR]
  const missing = needed.filter(o => !o)
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

/**
 * Checks that a journey is well-formed (has a "text" string/function and a "fn" function)
 */
function isJourneyValid(journey: any) {
  if (!journey.text || !['function', 'string'].includes(typeof (journey.text))) {
    return false
  }

  return typeof (journey.fn) === 'function';
}

/**
 * Search the journeys folder for valid journeys to use on the main menu
 */
async function discoverJourneys() {
  const files = (await getFiles(DIST_JOURNEY_DIR)).filter(o => o.endsWith('.js'))
  return files.map(o => require(o).default).filter(o => isJourneyValid(o)) as Journey[]
}

/**
 * Create the main menu question containing all discovered journeys
 */
async function createMainMenuChoices() {
  const remoteJourneys = await discoverJourneys()

  let choices: Journey[] = []

  remoteJourneys.forEach(o => choices.push(o))

  choices.sort((a, b) => (a.group || 'default') > (b.group || 'default') ? -1 : 1)

  for (let i = 1; i < choices.length; i++) {
    const journey = choices[i]
    const previous = choices[i - 1]

    if (journey.group !== previous.group) {
      choices.splice(i, 0, { text: new Separator() })
      i++
    }
  }

  return [
    ...choices,
    { group: 'program', text: 'Exit', fn: async () => { console.log(`Bye!`); process.exit(0) } },
    { text: new Separator() }
  ]
}

/**
 * The main program loop. Initializes program and asks questions until "Exit" is selected
 */
async function start() {
  ensurePathExists(SESSION_DIR)
  checkEnvVars()
  // TODO: This is ET specific logic and exists in its own journey, but its here now for convenience 
  readInCurrentConfig()

  while (true) {
    let choices: Journey[] = await createMainMenuChoices()

    const answers = await prompt([
      {
        name: 'Journey',
        message: "What do you want to do?",
        type: 'list',
        choices: choices.map(o => typeof (o.text) === 'function' ? o.text() : o.text)
      }
    ])

    const selectedFn = choices.find(o => {
      if (o.matchText?.(answers.Journey)) {
        return true
      }
      return (typeof (o.text) === 'function' ? o.text() : o.text) === answers.Journey
    })

    if (!selectedFn) {
      throw new Error(`Unable to find a function for "${answers.Journey}"`)
    }

    if (!selectedFn.fn || typeof (selectedFn.fn) !== 'function') {
      throw new Error(`Journey ${answers.Journey} does not have a callable function attached to it`)
    }

    await selectedFn.fn()

    saveSession(session)
  }
}

start()