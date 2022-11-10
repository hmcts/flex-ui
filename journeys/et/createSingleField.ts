import { prompt } from 'inquirer'
import { addToLastAnswers, session } from 'app/session'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'types/ccd'
import { Answers, askAutoComplete, askForPageFieldDisplayOrder, askForPageID, askForRegularExpression, askMinAndMax, askRetainHiddenValue } from 'app/questions'
import { CUSTOM, DISPLAY_CONTEXT_OPTIONS, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, NONE, Y_OR_N } from 'app/constants'
import { addToInMemoryConfig, createCaseFieldAuthorisations, getKnownCaseFieldIDs, getKnownCaseFieldIDsByEvent, getNextPageFieldIDForPage } from 'app/et/configs'
import { addOnDuplicateQuestion } from './manageDuplicateField'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { Journey } from 'types/journey'
import { doDuplicateCaseField } from 'app/et/duplicateCaseField'
import { askCaseEvent, askCaseTypeID, askFieldType, askFieldTypeParameter } from 'app/et/questions'

export const QUESTION_ID = 'What\'s the ID for this field?'
const QUESTION_LABEL = 'What text (Label) should this field have?'

export const QUESTION_FIELD_SHOW_CONDITION = 'Enter a field show condition string (optional)'
const QUESTION_CASE_EVENT_ID = 'What event does this new field belong to?'
export const QUESTION_HINT_TEXT = 'What HintText should this field have? (optional)'
const QUESTION_DISPLAY_CONTEXT = 'Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX?'
const QUESTION_SHOW_SUMMARY_CHANGE_OPTION = 'Should this field appear on the CYA page?'

const QUESTION_PAGE_LABEL = 'Does this page have a custom title? (optional)'
const QUESTION_PAGE_SHOW_CONDITION = 'Enter a page show condition string (optional)'
const QUESTION_CALLBACK_URL_MID_EVENT = 'Enter the callback url to hit before loading the next page (optional)'

function shouldAskEventQuestions(answers: Answers) {
  return answers[CaseEventToFieldKeys.CaseEventID] !== NONE
}

export async function createSingleField(answers: Answers = {}) {
  answers = await askBasic(answers)

  const askEvent = answers[CaseEventToFieldKeys.CaseEventID] !== NONE

  if (askEvent) {
    answers = await askForPageID(answers)
    answers = await askForPageFieldDisplayOrder(answers, undefined, undefined, getDefaultForPageFieldDisplayOrder(answers))
  }

  answers = await askFieldType(answers)

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askFieldTypeParameter(answers)
  }

  if (answers[CaseFieldKeys.FieldType] !== 'Label') {
    answers = await askNonLabelQuestions(answers)
  }

  if (askEvent && answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers)
  }

  if (answers[CaseFieldKeys.FieldType] === 'Text') {
    answers = await askForRegularExpression(answers)
  }

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_MIN_MAX)) {
    answers = await askMinAndMax(answers)
  }

  if (askEvent && answers[CaseEventToFieldKeys.FieldShowCondition]) {
    answers = await askRetainHiddenValue(answers)
  }

  addToLastAnswers(answers)

  const caseField = createNewCaseField(answers)
  const caseEventToField = askEvent ? createNewCaseEventToField(answers) : undefined
  const authorisations = createCaseFieldAuthorisations(answers.CaseTypeID, answers.ID)

  addToInMemoryConfig({
    AuthorisationCaseField: authorisations,
    CaseField: [trimCaseField(caseField)],
    CaseEventToFields: askEvent ? [trimCaseEventToField(caseEventToField)] : []
  })

  doDuplicateCaseField(answers.CaseTypeID, answers.ID, answers.CaseTypeID)
  await addOnDuplicateQuestion(answers as { CaseTypeID: string, ID: string })

  return answers.ID
}

function getDefaultForPageFieldDisplayOrder(answers: Answers = {}) {
  const pageID = CaseEventToFieldKeys.PageID
  const pageFieldDisplayOrder = CaseEventToFieldKeys.PageFieldDisplayOrder
  if (answers[pageID] && answers[CaseEventToFieldKeys.CaseEventID] && answers[CaseEventToFieldKeys.CaseTypeID]) {
    return getNextPageFieldIDForPage(
      answers[CaseEventToFieldKeys.CaseTypeID],
      answers[CaseEventToFieldKeys.CaseEventID],
      answers[pageID]
    )
  }
  if (session.lastAnswers[pageID] && session.lastAnswers[pageFieldDisplayOrder] && answers[pageID] === session.lastAnswers[pageID]) {
    return session.lastAnswers[pageFieldDisplayOrder] + 1
  }
  return 1
}

async function askBasic(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, undefined, QUESTION_CASE_EVENT_ID, true)

  const idOpts = getKnownCaseFieldIDsByEvent(answers[CaseEventToFieldKeys.CaseEventID])

  // We could autofill in properties if this field already exists, but it's a lot of effort
  answers = await askAutoComplete(CaseFieldKeys.ID, QUESTION_ID, CUSTOM, [CUSTOM, ...idOpts], answers)

  if (answers[CaseFieldKeys.ID] === CUSTOM) {
    answers = await prompt([{ name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id', askAnswered: true }], answers)
  }

  return await prompt(
    [
      //{ name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id' },
      { name: CaseFieldKeys.Label, message: QUESTION_LABEL, type: 'input', default: 'text' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', when: shouldAskEventQuestions }
    ], answers
  )
}

async function askNonLabelQuestions(answers: Answers = {}) {
  return await prompt([
    { name: CaseFieldKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input' },
    { name: CaseEventToFieldKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: DISPLAY_CONTEXT_OPTIONS[1] },
    { name: CaseEventToFieldKeys.ShowSummaryChangeOption, message: QUESTION_SHOW_SUMMARY_CHANGE_OPTION, type: 'list', choices: Y_OR_N, default: 'Y', when: shouldAskEventQuestions }
  ], answers)
}

export async function askFirstOnPageQuestions(answers: Answers = {}) {
  return await prompt([
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, type: 'input' },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, type: 'input' },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, type: 'input' }
  ], answers)
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify a single field',
  fn: createSingleField
} as Journey
