import { prompt } from 'inquirer'
import { addToLastAnswers, addToSession, saveSession, session } from 'app/session'
import { CaseEventToField, CaseEventToFieldKeys, CaseFieldKeys } from 'types/ccd'
import { Answers, askBasicFreeEntry, askCaseEvent, askCaseTypeID, askFieldType, askForPageFieldDisplayOrder, askForPageID, askForRegularExpression, askMinAndMax, askRetainHiddenValue, QUESTION_FIELD_TYPE_PARAMETER } from 'app/questions'
import { DISPLAY_CONTEXT_OPTIONS, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, NONE, YES, YES_OR_NO, Y_OR_N } from 'app/constants'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { Journey } from 'types/journey'
import { format } from 'app/helpers'

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
export const QUESTION_ANOTHER = 'Do you want to upsert another?'

function shouldAskEventQuestions(answers: Answers) {
  return answers[CaseEventToFieldKeys.CaseEventID] !== NONE
}

export async function createSingleField(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, undefined, QUESTION_CASE_EVENT_ID)

  answers = await prompt([{ name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id', askAnswered: true }], answers)

  answers = await prompt(
    [
      { name: CaseFieldKeys.Label, message: QUESTION_LABEL, type: 'input', default: 'text' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', default: '', when: shouldAskEventQuestions }
    ], answers
  )

  const askEvent = !!answers[CaseEventToFieldKeys.CaseEventID].trim().length

  if (askEvent) {
    answers = await askForPageID(answers)
    answers = await askForPageFieldDisplayOrder(answers, undefined, undefined, getDefaultForPageFieldDisplayOrder(answers))
  }

  answers = await askFieldType(answers)

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askBasicFreeEntry(answers, CaseFieldKeys.FieldType, format(QUESTION_FIELD_TYPE_PARAMETER, answers[CaseFieldKeys.FieldType]))
  }

  if (answers[CaseFieldKeys.FieldType] !== 'Label') {
    answers = await prompt([
      { name: CaseFieldKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input' },
      { name: CaseEventToFieldKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: DISPLAY_CONTEXT_OPTIONS[1] },
      { name: CaseEventToFieldKeys.ShowSummaryChangeOption, message: QUESTION_SHOW_SUMMARY_CHANGE_OPTION, type: 'list', choices: Y_OR_N, default: 'Y', when: shouldAskEventQuestions }
    ], answers)
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
  // TODO: Not sure yet how to make this generi
  // Team logic needed to calls createAuthorisationCaseField for each role needed
  // See journeys/et/createSingleField for this
  const authorisations = [] // createCaseFieldAuthorisations(answers.CaseTypeID, answers.ID)

  addToSession({
    AuthorisationCaseField: authorisations,
    CaseField: [trimCaseField(caseField)],
    CaseEventToFields: askEvent ? [trimCaseEventToField(caseEventToField)] : []
  })

  const followup = await prompt([{
    name: 'another',
    message: QUESTION_ANOTHER,
    type: 'list',
    choices: YES_OR_NO,
    default: YES
  }])

  if (followup.another === YES) {
    saveSession(session)
    return createSingleField()
  }
}

function getDefaultForPageFieldDisplayOrder(answers: Answers = {}) {
  const pageID = CaseEventToFieldKeys.PageID
  const pageFieldDisplayOrder = CaseEventToFieldKeys.PageFieldDisplayOrder
  if (session.lastAnswers[pageID] && session.lastAnswers[pageFieldDisplayOrder] && answers[pageID] === session.lastAnswers[pageID]) {
    return session.lastAnswers[pageFieldDisplayOrder] + 1
  }
  return 1
}

export async function askFirstOnPageQuestions(answers: Answers = {}, existingCaseEventToField?: CaseEventToField) {
  return await prompt([
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, type: 'input', default: existingCaseEventToField?.PageLabel },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, type: 'input', default: existingCaseEventToField?.PageShowCondition },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, type: 'input', default: existingCaseEventToField?.CallBackURLMidEvent }
  ], answers)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Upsert a single field',
  fn: createSingleField,
  alias: 'UpsertCaseField'
} as Journey
