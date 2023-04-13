import { Journey } from 'types/journey'
import { addToInMemoryConfig } from 'app/et/configs'
import { createCaseTypeTab } from '../base/createCaseTypeTab'
import { Answers } from 'app/questions'

async function journey(answers: Answers = {}) {
  const created = await createCaseTypeTab(answers)
  addToInMemoryConfig(created)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseTypeTab',
  fn: journey,
  alias: 'UpsertCaseTypeTab'
} as Journey
