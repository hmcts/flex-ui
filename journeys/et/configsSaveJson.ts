import { Journey } from 'types/journey'
import { saveBackToProject } from 'app/et/configs'
import { generateSpreadsheets } from './configsGenerateSpreadsheet'

async function save() {
  await saveBackToProject()
  await generateSpreadsheets()
}

export default {
  group: 'et-configs',
  text: 'Save to JSONs and Generate spreadsheets',
  fn: save
} as Journey
