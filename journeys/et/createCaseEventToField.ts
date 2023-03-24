import { Journey } from 'types/journey'
import { CaseEventToField, CaseEventToFieldKeys } from 'app/types/ccd'
import { createNewCaseEventToField, trimCaseEventToField } from 'app/ccd'
import { createTemplate, Answers, addonDuplicateQuestion } from 'app/questions'
import { addToInMemoryConfig } from 'app/et/configs'

export async function createCaseEventToFieldJourney() {
  const answers = await createTemplate<unknown, CaseEventToField>({}, CaseEventToFieldKeys, createNewCaseEventToField(), 'CaseEventToFields')

  await addonDuplicateQuestion(answers, (answers: Answers) => {
    const caseEventToField = createNewCaseEventToField(answers)

    addToInMemoryConfig({
      CaseEventToFields: [trimCaseEventToField(caseEventToField)]
    })
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseEventToField',
  fn: createCaseEventToFieldJourney,
  alias: 'UpsertCaseEventToField'
} as Journey
