import { NO, YES, YES_OR_NO } from 'app/constants'
import { destroyEverything, ensureUp } from 'app/et/docker'
import { temporaryLog } from 'app/helpers'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { generateSpreadsheets } from './configsGenerateSpreadsheet'
import { importConfigs } from './configsImportCcd'
import { setIPToWslHostAddress } from './dockerUpdateIP'

const QUESTION_DESTROY_DOCKER = 'Do you want to tear down any existing containers?'
const QUESTION_CALLBACKS_IN_WSL = 'Do you run callbacks in WSL? (will fix IP if yes)'

async function wslResume() {
  const answers = await prompt([
    { name: 'destroy', message: QUESTION_DESTROY_DOCKER, type: 'list', choices: YES_OR_NO, default: NO },
    { name: 'ip', message: QUESTION_CALLBACKS_IN_WSL, type: 'list', choices: YES_OR_NO, default: NO }
  ])

  if (answers.destroy === YES) {
    temporaryLog('Destroying all docker containers')
    await destroyEverything()
  }

  temporaryLog('Generating spreadsheets for EnglandWales and Scotland')
  await generateSpreadsheets('local')
  temporaryLog('Booting up docker containers')
  await ensureUp()
  if (answers.ip === YES) {
    temporaryLog('Updating WSL IP in EnglandWales and Scotland')
    await setIPToWslHostAddress()
  }
  temporaryLog('Importing configs into CCD')
  await importConfigs()
}

export default {
  disabled: true,
  group: 'et-wsl',
  text: 'Bring up ECM, fix WSL IP and import CCD configs',
  fn: wslResume
} as Journey
