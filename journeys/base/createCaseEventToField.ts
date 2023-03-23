import { Journey } from 'types/journey'
import { CaseEventToField, CaseEventToFieldKeys } from 'app/types/ccd'
import { createNewCaseEventToField, trimCaseEventToField } from 'app/ccd'
import { createTemplate, Answers } from 'app/questions'
import { addonDuplicateQuestion } from './createSingleField'
import { addToSession } from 'app/session'

export async function createCaseEventToFieldJourney() {
  const answers = await createTemplate<unknown, CaseEventToField>({}, CaseEventToFieldKeys, createNewCaseEventToField(), 'CaseEventToFields')

  await addonDuplicateQuestion(answers, (answers: Answers) => {
    const caseEventToField = createNewCaseEventToField(answers)

    addToSession({
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
