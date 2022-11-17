import 'source-map-support/register'
// https://dev.to/larswaechter/path-aliases-with-typescript-in-nodejs-4353
import 'module-alias/register'
import { config as envConfig } from 'dotenv'
import { prompt, Separator, registerPrompt } from 'inquirer'
import autocomplete from 'inquirer-autocomplete-prompt'
import { readInCurrentConfig } from 'app/et/configs'
import { ensurePathExists, format, getFiles, getIdealSizeForInquirer } from 'app/helpers'
import { cleanupEmptySessions, isCurrentSessionEmpty, saveSession, session, SESSION_DIR } from 'app/session'
import { DIST_JOURNEY_DIR, YES, YES_OR_NO } from 'app/constants'
import { setSessionName } from 'app/journeys/et/sessionSetName'
import { Journey } from 'types/journey'
import { resolve } from 'path'

envConfig()
process.env.APP_ROOT = resolve(__dirname)
registerPrompt('autocomplete', autocomplete)

/**
 * Check required environment variables are present.
 * TOOD: This is ET specific logic and should be refactored
 */
export function checkEnvVars() {
  const needed = ['ENGWALES_DEF_DIR', 'SCOTLAND_DEF_DIR']
  const missing = needed.filter(o => !process.env[o])
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

/**
 * Checks that a journey is well-formed (has a "text" string/function and a "fn" function)
 */
function isJourneyValid(journey: Journey, fileName: string) {
  const excludeMessage = `Excluding ${fileName.replace(__dirname, '')} because {0}`
  if (typeof (journey.text) === 'function') {
    try {
      journey.text()
    } catch (e: unknown) {
      console.warn(format(excludeMessage, `its text function threw ${(e as Error).stack}`))
      return false
    }
  }

  if (!journey.text || !['function', 'string'].includes(typeof (journey.text))) {
    console.warn(format(excludeMessage, 'its text property was not a string or a function'))
    return false
  }

  if (typeof (journey.fn) !== 'function') {
    console.warn(format(excludeMessage, "it doesn't have a valid fn function"))
    return false
  }

  return true
}

/**
 * Search the journeys folder for valid journeys to use on the main menu
 */
async function discoverJourneys() {
  const files = (await getFiles(DIST_JOURNEY_DIR)).filter(o => o.endsWith('.js'))
  return files.map(o => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require(o).default
    return module && isJourneyValid(module, o) ? module : undefined
  }).filter(o => o && !o.disabled) as Journey[]
}

/**
 * Create the main menu question containing all discovered journeys
 */
async function createMainMenuChoices(remoteJourneys: Journey[]) {
  const choices: Journey[] = []

  remoteJourneys.forEach(o => choices.push(o))

  choices.sort((a, b) => (a.group || 'default') > (b.group || 'default') ? -1 : 1)

  const menu = [...choices]
  let addedSeparators = 0
  for (let i = 1; i < choices.length; i++) {
    const journey = choices[i]
    const previous = choices[i - 1]

    if (journey.group !== previous.group) {
      menu.splice(i + addedSeparators++, 0, { text: new Separator() })
    }
  }

  return menu
}

function findSelectedJourney(choices: Journey[], selected: string) {
  return choices.find(o => {
    if ((typeof (o.text) === 'function' ? o.text() : o.text) === selected) {
      return true
    }
    return o.matchText?.(selected)
  })
}

/**
 * Ask the user for a session name if the current session has a default name (session_TIME) and has data in it
 */
async function conditionalAskForSessionName() {
  const isDefaultName = session.name.match(/^session_\d+$/)
  if (isCurrentSessionEmpty() || !isDefaultName) {
    return
  }

  const notEmptyQuestion = `Current session (${session.name}) is not empty but has not had a name set. Would you like to do that now?`
  const answers = await prompt([
    { name: 'name', message: notEmptyQuestion, type: 'list', choices: YES_OR_NO }
  ])

  if (answers.name === YES) {
    await setSessionName()
    saveSession(session)
  }
}

/**
 * The main program loop. Initializes program and asks questions until "Exit" is selected
 */
async function start() {
  ensurePathExists(SESSION_DIR)
  checkEnvVars()
  // TODO: This is ET specific logic and exists in its own journey, but its here now for convenience
  readInCurrentConfig()
  await cleanupEmptySessions()

  while (true) {
    const discovered = await discoverJourneys()
    const choices: Journey[] = await createMainMenuChoices(discovered)

    const answers = await prompt([
      {
        name: 'Journey',
        message: 'What do you want to do?',
        type: 'list',
        choices: [
          new Separator(),
          ...choices.map(o => typeof (o.text) === 'function' ? o.text() : o.text),
          'Exit',
          new Separator()
        ],
        pageSize: getIdealSizeForInquirer()
      }
    ])

    if (answers.Journey === 'Exit') {
      break
    }

    const selectedFn = findSelectedJourney(choices, answers.Journey)

    if (!selectedFn) {
      throw new Error(`Unable to find a function for "${answers.Journey}"`)
    }

    if (!selectedFn.fn || typeof (selectedFn.fn) !== 'function') {
      throw new Error(`Journey ${answers.Journey} does not have a callable function attached to it`)
    }

    try { await selectedFn.fn() } catch (e) {
      console.error('An error occured on the selected journey:')
      console.error(e)
      break
    }

    saveSession(session)
    await conditionalAskForSessionName()
  }
  console.log('Bye!')
}

console.log(process.env.APP_ROOT)

void start()
