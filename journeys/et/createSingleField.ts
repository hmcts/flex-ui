import { prompt } from 'inquirer'
import { addToLastAnswers, session } from 'app/session'
import { CaseEventToField, CaseEventToFieldKeys, CaseField, CaseFieldKeys } from 'types/ccd'
import { Answers, askAutoComplete, askForPageFieldDisplayOrder, askForPageID, askForRegularExpression, askMinAndMax, askRetainHiddenValue } from 'app/questions'
import { CUSTOM, DISPLAY_CONTEXT_OPTIONS, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, NO, NONE, NO_DUPLICATE, YES, YES_OR_NO, Y_OR_N } from 'app/constants'
import { addToInMemoryConfig, createCaseFieldAuthorisations, findObject, getKnownCaseFieldIDs, getKnownCaseFieldIDsByEvent, getNextPageFieldIDForPage } from 'app/et/configs'
import { addOnDuplicateQuestion, askDuplicate } from './manageDuplicateField'
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
const QUESTION_AUTHORISATIONS = 'Do you want to generate authorisations for this case field?'

function shouldAskEventQuestions(answers: Answers) {
  return answers[CaseEventToFieldKeys.CaseEventID] !== NONE
}

export async function createSingleField(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, undefined, QUESTION_CASE_EVENT_ID, true)

  const idOpts = getKnownCaseFieldIDsByEvent(answers[CaseEventToFieldKeys.CaseEventID])

  // We could autofill in properties if this field already exists, but it's a lot of effort
  answers = await askAutoComplete(CaseFieldKeys.ID, QUESTION_ID, CUSTOM, [CUSTOM, ...idOpts], answers)

  if (answers[CaseFieldKeys.ID] === CUSTOM) {
    answers = await prompt([{ name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id', askAnswered: true }], answers)
  }

  // At this point we should know whether the user is adding or modifying a field
  // TODO: Find out why referencing something on existingField without a ? does not result in an error (because it could be undefined)
  const existingField: CaseField | undefined = findObject<CaseField>(answers, 'CaseField')
  const existingCaseEventToField: CaseEventToField | undefined = findObject<CaseEventToField>({ ...answers, CaseFieldID: answers.ID }, 'CaseEventToFields')

  answers = await prompt(
    [
      { name: CaseFieldKeys.Label, message: QUESTION_LABEL, type: 'input', default: existingField?.Label || 'text' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', default: existingCaseEventToField?.FieldShowCondition || '', when: shouldAskEventQuestions }
    ], answers
  )

  const askEvent = answers[CaseEventToFieldKeys.CaseEventID] !== NONE

  if (askEvent) {
    answers = await askForPageID(answers, undefined, undefined, existingCaseEventToField?.PageID)
    answers = await askForPageFieldDisplayOrder(answers, undefined, undefined, existingCaseEventToField?.PageFieldDisplayOrder || getDefaultForPageFieldDisplayOrder(answers))
  }

  answers = await askFieldType(answers, undefined, undefined, existingField?.FieldType)

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askFieldTypeParameter(answers, undefined, undefined, existingField?.FieldTypeParameter)
  }

  if (answers[CaseFieldKeys.FieldType] !== 'Label') {
    answers = await prompt([
      { name: CaseFieldKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input', default: existingField?.HintText },
      { name: CaseEventToFieldKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: existingCaseEventToField?.DisplayContext || DISPLAY_CONTEXT_OPTIONS[1] },
      { name: CaseEventToFieldKeys.ShowSummaryChangeOption, message: QUESTION_SHOW_SUMMARY_CHANGE_OPTION, type: 'list', choices: Y_OR_N, default: existingCaseEventToField?.ShowSummaryChangeOption || 'Y', when: shouldAskEventQuestions }
    ], answers)
  }

  if (askEvent && answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers, existingCaseEventToField)
  }

  if (answers[CaseFieldKeys.FieldType] === 'Text') {
    answers = await askForRegularExpression(answers, undefined, undefined, existingField?.RegularExpression)
  }

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_MIN_MAX)) {
    answers = await askMinAndMax(answers, existingField)
  }

  if (askEvent && answers[CaseEventToFieldKeys.FieldShowCondition]) {
    answers = await askRetainHiddenValue(answers, existingCaseEventToField?.RetainHiddenValue)
  }

  if (existingField) {
    answers = await prompt([{ name: 'authorisations', message: QUESTION_AUTHORISATIONS, type: 'list', choices: YES_OR_NO, default: NO }], answers)
  }

  addToLastAnswers(answers)

  const createFn = (answers: Answers) => {
    const caseField = createNewCaseField(answers)
    const caseEventToField = askEvent ? createNewCaseEventToField(answers) : undefined
    const authorisations = answers.authorisations === YES ? createCaseFieldAuthorisations(answers.CaseTypeID, answers.ID) : []

    addToInMemoryConfig({
      AuthorisationCaseField: authorisations,
      CaseField: [trimCaseField(caseField)],
      CaseEventToFields: askEvent ? [trimCaseEventToField(caseEventToField)] : []
    })
  }

  await addonDuplicateQuestion(answers, createFn)
}

export async function addonDuplicateQuestion(answers: Answers, fn: (answers: Answers) => void) {
  fn(answers)

  while (true) {
    answers = await askDuplicate(answers)

    if (answers.duplicate === NO_DUPLICATE) {
      return answers.ID
    }

    answers.CaseTypeID = answers.CaseTypeId = answers.duplicate as string
    fn(answers)
  }
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

export async function askFirstOnPageQuestions(answers: Answers = {}, existingCaseEventToField?: CaseEventToField) {
  return await prompt([
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, type: 'input', default: existingCaseEventToField?.PageLabel },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, type: 'input', default: existingCaseEventToField?.PageShowCondition },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, type: 'input', default: existingCaseEventToField?.CallBackURLMidEvent }
  ], answers)
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify a single field',
  fn: createSingleField
} as Journey
