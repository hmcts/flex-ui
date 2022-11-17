import { Journey } from 'types/journey'
import { CaseEventToField, CaseEventToFieldKeys, CaseTypeTab, CaseTypeTabKeys } from 'app/types/ccd'
import { createNewCaseEventToField, createNewCaseTypeTab, trimCaseEventToField } from 'app/ccd'
import { createTemplate } from 'app/et/questions'
import { addToInMemoryConfig, findObject } from 'app/et/configs'
import { addonDuplicateQuestion } from './createSingleField'
import { Answers } from 'app/questions'

export async function createCaseEventToFieldJourney() {
  const answers = await createTemplate<unknown, CaseEventToField>({}, CaseEventToFieldKeys, createNewCaseEventToField(), 'CaseEventToFields')
  // // Does the object already exist? ie, are we modifying?
  // const existing = findObject(answers, 'CaseEventToFields')

  // const caseEventToField = createNewCaseEventToField(Object.keys(existing).reduce((acc, key) => {
  //   if (answers[key] && answers[key] !== NaN) {
  //     acc[key] = answers[key]
  //   }
  //   return acc
  // }, existing || answers))

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
  fn: createCaseEventToFieldJourney
} as Journey
