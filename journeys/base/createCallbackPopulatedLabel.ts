import { prompt } from 'inquirer'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'types/ccd'
import { Journey } from 'types/journey'
import { addCaseEvent, addCaseTypeIDQuestion, addDuplicateToCaseTypeID, addNonProdFeatureQuestions, addPageFieldDisplayOrderQuestion, addPageIDQuestion, Answers, createJourneys, Question, QUESTION_CALLBACK_URL_MID_EVENT, QUESTION_PAGE_LABEL, QUESTION_PAGE_SHOW_CONDITION, spliceCustomQuestionIndex } from 'app/questions'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { QUESTION_FIELD_SHOW_CONDITION, QUESTION_ID } from './createSingleField'
import { addToLastAnswers, addToSession } from 'app/session'
import { duplicateForCaseTypeIDs, upsertConfigs } from 'app/configs'
import { upsertFields } from 'app/helpers'
import { YES } from 'app/constants'

async function journey(answers: Answers = {}) {
  const created = await createCallbackPopulatedLabel(answers)

  addToSession(created)
  upsertConfigs(created)
}

function addCallbackPopulatedQuestions() {
  const whenFirstOnPage = (answers: Answers) => answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1

  return [
    ...addCaseTypeIDQuestion(),
    ...addCaseEvent(),
    { name: CaseFieldKeys.ID, message: QUESTION_ID, default: 'id' },
    { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION },
    ...addPageIDQuestion(),
    ...addPageFieldDisplayOrderQuestion(),
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, when: whenFirstOnPage },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, when: whenFirstOnPage },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, when: whenFirstOnPage },
    ...addNonProdFeatureQuestions('CaseField'),
    ...addDuplicateToCaseTypeID()
  ] as Question[]
}

export async function createCallbackPopulatedLabel(answers: Answers = {}, questions: Question[] = []) {
  const ask = addCallbackPopulatedQuestions()
  upsertFields(ask, questions, ['name'], spliceCustomQuestionIndex)

  answers = await prompt(ask, answers)

  const created = constructFromAnswers(answers)

  if (answers.createEvent === YES) {
    await createJourneys.createEvent({ ID: answers.CaseEventID, CaseTypeID: answers.CaseTypeID, duplicate: answers.duplicate })
  }

  addToLastAnswers(answers)

  return created
}

export function constructFromAnswers(answers: Answers) {
  const createFn = (answers: Answers) => {
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
  }

  return duplicateForCaseTypeIDs(answers, createFn)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a callback-populated label',
  fn: journey,
  alias: 'CreateCallbackPopulatedLabel'
} as Journey
