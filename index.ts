import 'source-map-support/register'
// https://dev.to/larswaechter/path-aliases-with-typescript-in-nodejs-4353
import 'module-alias/register'
import { config as envConfig } from 'dotenv'
import { prompt, Separator, registerPrompt } from 'inquirer'
import autocomplete from 'inquirer-autocomplete-prompt'
import { ensurePathExists, format, getFiles, getIdealSizeForInquirer } from 'app/helpers'
import { cleanupEmptySessions, SESSION_DIR } from 'app/session'
import { DIST_JOURNEY_DIR } from 'app/constants'
import { Journey } from 'types/journey'
import { resolve, sep } from 'path'

envConfig()
process.env.APP_ROOT = resolve(__dirname)
registerPrompt('autocomplete', autocomplete)

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
 * Finds and runs init code for FlexUI based on the team using it (ie, ET)
 */
async function initializeTeamSpecificCode() {
  if (!process.env.TEAM) {
    console.error(`TEAM env var is missing - please specify your team in the .env file (for ET, use "et")`)
    process.exit(0)
  }

  const files = await getFiles(`dist${sep}${process.env.TEAM}`)
  const initFile = files.find(o => o.endsWith('init.js'))
  if (!initFile) {
    console.error(`${initFile} file not found - No team specific initialize code will be run`)
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const init = require(initFile)
    await init.default()
  } catch (e) {
    console.error(`Could not read ${initFile} - ${e.message}`)
    process.exit(0)
  }
}

/**
 * The main program loop. Initializes program and asks questions until "Exit" is selected
 */
async function start() {
  ensurePathExists(SESSION_DIR)

  await initializeTeamSpecificCode()

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
  }
  console.log('Bye!')
}

console.log(process.env.APP_ROOT)

void start()
