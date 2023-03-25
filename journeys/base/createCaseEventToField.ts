import { Journey } from 'types/journey'
import { CaseEventToField, CaseEventToFieldKeys } from 'app/types/ccd'
import { createNewCaseEventToField, trimCaseEventToField } from 'app/ccd'
import { createTemplate, Answers, addonDuplicateQuestion } from 'app/questions'
import { addToSession } from 'app/session'
import { sheets } from 'app/configs'
import { upsertFields } from 'app/helpers'
import { COMPOUND_KEYS } from 'app/constants'

export async function createCaseEventToFieldJourney() {
  const answers = await createTemplate<unknown, CaseEventToField>({}, CaseEventToFieldKeys, createNewCaseEventToField(), 'CaseEventToFields')

  await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseEventToField = createNewCaseEventToField(answers)

    const newFields = {
      CaseEventToFields: [trimCaseEventToField(caseEventToField)]
    }
    addToSession(newFields)

    for (const sheetName in newFields) {
      upsertFields(sheets[sheetName], newFields[sheetName], COMPOUND_KEYS[sheetName])
    }
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseEventToField',
  fn: createCaseEventToFieldJourney,
  alias: 'UpsertCaseEventToField'
} as Journey
