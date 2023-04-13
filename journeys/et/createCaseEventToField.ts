import { Journey } from 'types/journey'
import { addToInMemoryConfig } from 'app/et/configs'
import { createCaseEventToFieldJourney } from '../base/createCaseEventToField'
import { Answers } from 'app/questions'

async function journey(answers: Answers = {}) {
  const created = await createCaseEventToFieldJourney(answers)
  addToInMemoryConfig(created)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseEventToField',
  fn: journey,
  alias: 'UpsertCaseEventToField'
} as Journey
