import { prompt } from "inquirer";
import { session } from "app/session";
import { CaseEventToFieldKeys, CaseFieldKeys, Journey } from "types/types";
import { askCaseTypeID } from "app/questions";
import { createAuthorisationCaseFields, createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from "app/objects";
import { addToInMemoryConfig } from "app/et/configs";
import { askCaseEvent, askFirstOnPageQuestions, QUESTION_FIELD_SHOW_CONDITION, QUESTION_ID, QUESTION_PAGE_FIELD_DISPLAY_ORDER, QUESTION_PAGE_ID } from "./createSingleField";
import { addOnDuplicateQuestion } from "./manageDuplicateField";

export async function createCallbackPopulatedLabel(answers: any) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers)

  answers = await prompt(
    [
      { name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input' },
      { name: CaseEventToFieldKeys.PageID, message: QUESTION_PAGE_ID, type: 'number', default: session.lastAnswers.PageID || 1 },
      { name: CaseEventToFieldKeys.PageFieldDisplayOrder, message: QUESTION_PAGE_FIELD_DISPLAY_ORDER, type: 'number', default: session.lastAnswers.PageFieldDisplayOrder + 1 || 1 },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' }
    ], answers
  )

  if (answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers)
  }

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