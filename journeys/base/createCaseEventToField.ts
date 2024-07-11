import { Journey } from 'types/journey'
import { CaseEventToField, CaseEventToFieldKeys, FlexExtensionKeys } from 'app/types/ccd'
import { createNewCaseEventToField, trimCaseEventToField } from 'app/ccd'
import { createTemplate, Answers, addonDuplicateQuestion } from 'app/questions'
import { addToSession } from 'app/session'
import { upsertConfigs } from 'app/configs'

async function journey(answers: Answers = {}) {
  const created = await createCaseEventToFieldJourney(answers)
  addToSession(created)
  upsertConfigs(created)
}

export async function createCaseEventToFieldJourney(answers: Answers = {}) {
  answers = await createTemplate<unknown, CaseEventToField>({}, { ...CaseEventToFieldKeys, ...FlexExtensionKeys }, createNewCaseEventToField(), 'CaseEventToFields')

  return await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseEventToField = createNewCaseEventToField(answers)

    return {
      CaseEventToFields: [trimCaseEventToField(caseEventToField)]
    }
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseEventToField',
  fn: journey,
  alias: 'UpsertCaseEventToField'
} as Journey
