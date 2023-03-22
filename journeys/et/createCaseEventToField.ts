import { Journey } from 'types/journey'
import { CaseEventToField, CaseEventToFieldKeys } from 'app/types/ccd'
import { createNewCaseEventToField, trimCaseEventToField } from 'app/ccd'
import { createTemplate } from 'app/et/questions'
import { addToInMemoryConfig } from 'app/et/configs'
import { addonDuplicateQuestion } from './createSingleField'
import { Answers } from 'app/questions'

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
  group: 'et-create',
  text: 'Create/Modify a CaseEventToField',
  fn: createCaseEventToFieldJourney,
  alias: 'UpsertCaseEventToField'
} as Journey
