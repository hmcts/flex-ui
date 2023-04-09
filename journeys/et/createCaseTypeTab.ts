import { Journey } from 'types/journey'
import { addToInMemoryConfig } from 'app/et/configs'
import { createCaseTypeTab } from '../base/createCaseTypeTab'

async function journey() {
  const created = await createCaseTypeTab()
  addToInMemoryConfig(created)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseTypeTab',
  fn: journey,
  alias: 'UpsertCaseTypeTab'
} as Journey
