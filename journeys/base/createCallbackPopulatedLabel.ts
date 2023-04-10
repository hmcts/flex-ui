import { prompt } from 'inquirer'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'types/ccd'
import { Journey } from 'types/journey'
import { addonDuplicateQuestion, Answers, askCaseEvent, askCaseTypeID, askFirstOnPageQuestions, askForPageFieldDisplayOrder, askForPageID } from 'app/questions'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { QUESTION_FIELD_SHOW_CONDITION, QUESTION_ID } from './createSingleField'
import { addToLastAnswers, addToSession } from 'app/session'
import { upsertConfigs } from 'app/configs'

async function journey() {
  const created = await createCallbackPopulatedLabel()

  addToSession(created)
  upsertConfigs(created)
}

export async function createCallbackPopulatedLabel(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, undefined, true)

  answers = await prompt(
    [
      { name: CaseFieldKeys.ID, message: QUESTION_ID, default: 'id' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION }
    ], answers
  )

  answers = await askForPageID(answers)
  answers = await askForPageFieldDisplayOrder(answers)

  if (answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers)
  }

  addToLastAnswers(answers)

  return await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseField = createNewCaseField({
      ...answers,
      FieldType: 'Text',
      Label: 'Placeholder'
    })

    const caseFieldLabel = createNewCaseField({
      ...answers,
      ID: `${answers.ID}Label`,
      FieldType: 'Label',
      Label: '${' + caseField.ID + '}'
    })

    const caseEventToField = createNewCaseEventToField({
      ...answers,
      ShowSummaryChangeOption: 'N',
      DisplayContext: 'READONLY',
      FieldShowCondition: `${answers.ID}Label="dummy"`,
      RetainHiddenValue: 'No'
    })

    const caseEventToFieldLabel = createNewCaseEventToField({
      ...answers,
      ShowSummaryChangeOption: 'N',
      DisplayContext: 'READONLY',
      RetainHiddenValue: 'No',
      CaseFieldID: `${answers.ID}Label`,
      PageFieldDisplayOrder: (answers.PageFieldDisplayOrder) + 1,
      PageShowCondition: ''
    })

    return {
      CaseField: [trimCaseField(caseField), trimCaseField(caseFieldLabel)],
      CaseEventToFields: [trimCaseEventToField(caseEventToField), trimCaseEventToField(caseEventToFieldLabel)]
    }
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a callback-populated label',
  fn: journey,
  alias: 'CreateCallbackPopulatedLabel'
} as Journey
