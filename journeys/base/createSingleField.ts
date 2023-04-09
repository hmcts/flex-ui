import { prompt } from 'inquirer'
import { addToLastAnswers, addToSession, session } from 'app/session'
import { CaseEventToField, CaseEventToFieldKeys, CaseField, CaseFieldKeys } from 'types/ccd'
import { addonDuplicateQuestion, Answers, askAutoComplete, askCaseEvent, askCaseTypeID, askFieldType, askFieldTypeParameter, askFirstOnPageQuestions, askForPageFieldDisplayOrder, askForPageID, askForRegularExpression, askMinAndMax, askRetainHiddenValue } from 'app/questions'
import { CUSTOM, DISPLAY_CONTEXT_OPTIONS, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, NONE, Y_OR_N } from 'app/constants'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { Journey } from 'types/journey'
import { findObject, getCaseEventIDOpts, getKnownCaseFieldIDsByEvent, getNextPageFieldIDForPage, upsertConfigs } from 'app/configs'

export const QUESTION_ID = 'What\'s the ID for this field?'
export const QUESTION_ANOTHER = 'Do you want to upsert another?'
export const QUESTION_FIELD_SHOW_CONDITION = 'Enter a field show condition string (optional)'
export const QUESTION_HINT_TEXT = 'What HintText should this field have? (optional)'

const QUESTION_LABEL = 'What text (Label) should this field have?'
const QUESTION_CASE_EVENT_ID = 'What event does this new field belong to?'
const QUESTION_DISPLAY_CONTEXT = 'Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX?'
const QUESTION_SHOW_SUMMARY_CHANGE_OPTION = 'Should this field appear on the CYA page?'

async function journey() {
  const created = await createSingleField()
  addToSession(created)
  upsertConfigs(created)
}

function shouldAskEventQuestions(answers: Answers) {
  return answers[CaseEventToFieldKeys.CaseEventID] !== NONE
}

export async function createSingleField(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, { message: QUESTION_CASE_EVENT_ID, choices: [NONE, ...getCaseEventIDOpts()] })

  const idOpts = getKnownCaseFieldIDsByEvent(answers[CaseEventToFieldKeys.CaseEventID])

  answers = await askAutoComplete(answers, { name: CaseFieldKeys.ID, message: QUESTION_ID, default: CUSTOM, choices: [CUSTOM, ...idOpts], askAnswered: false, sort: true })

  if (answers[CaseFieldKeys.ID] === CUSTOM) {
    answers = await prompt([{ name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id', askAnswered: true }], answers)
  }

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
    answers = await askForPageID(answers, { default: existingCaseEventToField?.PageID })
    answers = await askForPageFieldDisplayOrder(answers, { default: existingCaseEventToField?.PageFieldDisplayOrder || getDefaultForPageFieldDisplayOrder(answers) })
  }

  answers = await askFieldType(answers, { default: existingField?.FieldType })

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askFieldTypeParameter(answers, { default: existingField?.FieldTypeParameter })
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
    answers = await askForRegularExpression(answers, { default: existingField?.RegularExpression })
  }

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_MIN_MAX)) {
    answers = await askMinAndMax(answers, existingField)
  }

  if (askEvent && answers[CaseEventToFieldKeys.FieldShowCondition]) {
    answers = await askRetainHiddenValue(answers, { default: existingCaseEventToField?.RetainHiddenValue })
  }

  addToLastAnswers(answers)

  return await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseField = createNewCaseField(answers)
    const caseEventToField = askEvent ? createNewCaseEventToField(answers) : undefined

    // ET creates authorisations here - this is highly specific code so teams implementing this will
    // need to provide their own journey for this. See journeys/et/createSingleField for an example.
    const authorisations = []

    return {
      AuthorisationCaseField: authorisations,
      CaseField: [trimCaseField(caseField)],
      CaseEventToFields: askEvent ? [trimCaseEventToField(caseEventToField)] : []
    }
  })
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

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a single field',
  fn: journey,
  alias: 'UpsertCaseField'
} as Journey
