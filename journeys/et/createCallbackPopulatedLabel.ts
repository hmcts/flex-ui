import { prompt } from "inquirer"
import { CaseEventToFieldKeys, CaseFieldKeys, Journey } from "types/types"
import { askCaseTypeID } from "app/questions"
import { createAuthorisationCaseFields, createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from "app/objects"
import { addToInMemoryConfig } from "app/et/configs"
import { askCaseEvent, askFirstOnPageQuestions, askForPageIdAndDisplayOrder, QUESTION_FIELD_SHOW_CONDITION, QUESTION_ID } from "./createSingleField"
import { addOnDuplicateQuestion } from "./manageDuplicateField"
import { addToLastAnswers } from "app/session"

export async function createCallbackPopulatedLabel(answers: any) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers)

  answers = await prompt(
    [
      { name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' }
    ], answers
  )

  answers = await askForPageIdAndDisplayOrder(answers)

  if (answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers)
  }

  addToLastAnswers(answers)

  const caseField = createNewCaseField({
    ...answers,
    FieldType: 'Text',
    Label: 'Placeholder'
  })

  const caseFieldLabel = createNewCaseField({
    ...answers,
    ID: `${answers.ID}Label`,
    FieldType: 'Label',
    Label: "${" + caseField.ID + "}"
  })

  const caseEventToField = createNewCaseEventToField({
    ...answers,
    ShowSummaryChangeOption: 'N',
    DisplayContext: 'READONLY',
    FieldShowCondition: `${answers.ID}Label=\"dummy\"`,
    RetainHiddenValue: 'No'
  })

  const caseEventToFieldLabel = createNewCaseEventToField({
    ...answers,
    ShowSummaryChangeOption: 'N',
    DisplayContext: 'READONLY',
    RetainHiddenValue: 'No',
    CaseFieldID: `${answers.ID}Label`,
    PageFieldDisplayOrder: answers.PageFieldDisplayOrder + 1,
    PageShowCondition: ''
  })

  const authorisations = [
    ...createAuthorisationCaseFields(answers.CaseTypeID, answers.ID),
    ...createAuthorisationCaseFields(answers.CaseTypeID, `${answers.ID}Label`)
  ]

  addToInMemoryConfig({
    AuthorisationCaseField: authorisations,
    CaseField: [trimCaseField(caseField), trimCaseField(caseFieldLabel)],
    CaseEventToFields: [trimCaseEventToField(caseEventToField), trimCaseEventToField(caseEventToFieldLabel)]
  })

  await addOnDuplicateQuestion({ CaseTypeID: answers.CaseTypeID, ID: caseFieldLabel.ID })
}

export default {
  group: 'et-create',
  text: 'Create callback-populated label',
  fn: createCallbackPopulatedLabel
} as Journey