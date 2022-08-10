import { prompt } from "inquirer";
import { findPreviousSessions, restorePreviousSession, session } from "app/session";
import { CaseEventToFieldKeys, CaseFieldKeys, Journey } from "types/types";
import { requestCaseTypeID } from "app/questions";
import { createAuthorisationCaseEvent, createAuthorisationCaseFields, createNewCaseEvent, createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from "app/objects";
import { addToInMemoryConfig, upsertNewCaseEvent } from "app/et/configs";
import { askCaseEvent, askFirstOnPageQuestions } from "./createSingleField";
import { addOnDuplicateQuestion } from "./manageDuplicateField";

export async function createCallbackPopulatedLabel() {
  let answers = await prompt(
    [
      { name: CaseFieldKeys.ID, message: `What's the ID for this field?`, type: 'input' },
      { name: CaseEventToFieldKeys.PageID, message: `What page will this field appear on?`, type: 'number', default: session.lastAnswers.PageID || 1 },
      { name: CaseEventToFieldKeys.PageFieldDisplayOrder, message: `Whats the PageFieldDisplayOrder for this field?`, type: 'number', default: session.lastAnswers.PageFieldDisplayOrder + 1 || 1 },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: 'Enter a field show condition string (leave blank if not needed)', type: 'input' }
    ],
    {
      ... await requestCaseTypeID(),
      ... await askCaseEvent()
    }
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