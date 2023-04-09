import { Journey } from 'types/journey'
import { addToInMemoryConfig } from 'app/et/configs'
import { createCaseEventToFieldJourney } from '../base/createCaseEventToField'

async function journey() {
  const created = await createCaseEventToFieldJourney()
  addToInMemoryConfig(created)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseEventToField',
  fn: journey,
  alias: 'UpsertCaseEventToField'
} as Journey
