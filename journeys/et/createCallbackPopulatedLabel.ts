import { ConfigSheets } from 'types/ccd'
import { Journey } from 'types/journey'
import { addToInMemoryConfig, createCaseFieldAuthorisations } from 'app/et/configs'
import { createCallbackPopulatedLabel } from '../base/createCallbackPopulatedLabel'
import { Answers } from 'app/questions'

async function journey(answers: Answers = {}) {
  const created = await createCallbackPopulatedLabel(answers)
  const authorisations = createAuthorisations(created)
  addToInMemoryConfig({ ...created, AuthorisationCaseField: authorisations })
}

function createAuthorisations(created: Partial<ConfigSheets>) {
  return created.CaseField.reduce((acc, o) =>
    acc.concat(...createCaseFieldAuthorisations(o.CaseTypeID, o.ID)), []
  )
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a callback-populated label',
  fn: journey,
  alias: 'CreateCallbackPopulatedLabel'
} as Journey
