import { prompt } from 'inquirer'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'types/ccd'
import { Journey } from 'types/journey'
import { addonDuplicateQuestion, Answers, askCaseEvent, askCaseTypeID, askForPageFieldDisplayOrder, askForPageID } from 'app/questions'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { addToInMemoryConfig, createCaseFieldAuthorisations } from 'app/et/configs'
import { askFirstOnPageQuestions, QUESTION_FIELD_SHOW_CONDITION, QUESTION_ID } from './createSingleField'
import { addToLastAnswers } from 'app/session'

export async function createCallbackPopulatedLabel(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers)

  answers = await prompt(
    [
      { name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' }
    ], answers
  )

  answers = await askForPageID(answers)
  answers = await askForPageFieldDisplayOrder(answers)

  if (answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers)
  }

  addToLastAnswers(answers)

  await addonDuplicateQuestion(answers, (answers: Answers) => {
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

    const authorisations = [
      ...createCaseFieldAuthorisations(answers.CaseTypeID, answers.ID),
      ...createCaseFieldAuthorisations(answers.CaseTypeID, `${answers.ID}Label`)
    ]

    addToInMemoryConfig({
      AuthorisationCaseField: authorisations,
      CaseField: [trimCaseField(caseField), trimCaseField(caseFieldLabel)],
      CaseEventToFields: [trimCaseEventToField(caseEventToField), trimCaseEventToField(caseEventToFieldLabel)]
    })
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a callback-populated label',
  fn: createCallbackPopulatedLabel,
  alias: 'CreateCallbackPopulatedLabel'
} as Journey
