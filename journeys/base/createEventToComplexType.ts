import { prompt } from 'inquirer'
import { CaseField, EventToComplexType, EventToComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewEventToComplexType, trimCcdObject } from 'app/ccd'
import { addAutoCompleteQuestion, addCaseEvent, addCaseFieldID, addNonProdFeatureQuestions, addRetainHiddenValueQuestion, Answers, createJourneys, Question, spliceCustomQuestionIndex } from 'app/questions'
import { addToLastAnswers, addToSession, session } from 'app/session'
import { Journey } from 'types/journey'
import { findObject, getKnownComplexTypeListElementCodes, upsertConfigs } from 'app/configs'
import { upsertFields } from 'app/helpers'
import { CUSTOM, YES, Y_OR_N } from 'app/constants'

const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_ID = "What's the ID of this EventToComplexType?"
const QUESTION_EVENT_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_FIELD_DISPLAY_ORDER = 'What\'s the FieldDisplayOrder for this?'
const QUESTION_DISPLAY_CONTEXT = 'Should this field be READONLY, OPTIONAL or MANDATORY?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'
const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY']
const QUESTION_LIST_ELEMENT_CODE = 'What\'s the ListElementCode that this references?'
const QUESTION_WA_PUBLISH = 'Do you want to publish this (for WA)?'

async function journey(answers: Answers = {}) {
  const created = await createEventToComplexType(answers)
  addToSession(created)
  upsertConfigs(created)
}

function findExisting(answers: Answers) {
  return findObject<EventToComplexType>(answers, 'EventToComplexTypes')
}

export function addEventToComplexTypesQuestions(existingFn: (answers: Answers) => EventToComplexType = findExisting) {
  const defaultFn = (key: keyof (Answers), or?: string | number | ((answers: Answers) => string | number)) => {
    return (answers: Answers) => {
      const orResult = typeof (or) === 'function' ? (or as any)(answers) : or
      return existingFn(answers)?.[key] || orResult
    }
  }

  return [
    { name: EventToComplexTypeKeys.ID, message: QUESTION_ID, default: session.lastAnswers.ID },
    ...addCaseEvent({ message: QUESTION_CASE_EVENT_ID, default: session.lastAnswers.CaseEventID }),
    ...addCaseFieldID(),
    ...addAutoCompleteQuestion({ name: EventToComplexTypeKeys.ListElementCode, message: QUESTION_LIST_ELEMENT_CODE, choices: findListElementCodeOptions as any }),
    { name: EventToComplexTypeKeys.EventElementLabel, message: QUESTION_EVENT_ELEMENT_LABEL, default: defaultFn('EventElementLabel', session.lastAnswers.EventElementLabel) },
    { name: EventToComplexTypeKeys.FieldDisplayOrder, message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: defaultFn('FieldDisplayOrder', getDefaultValueForFieldDisplayOrder()) },
    { name: EventToComplexTypeKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: defaultFn('DisplayContext', session.lastAnswers.DisplayContext) },
    { name: EventToComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, default: defaultFn('FieldShowCondition') },
    { name: EventToComplexTypeKeys.EventHintText, message: QUESTION_HINT_TEXT, default: defaultFn('EventHintText') },
    ...addRetainHiddenValueQuestion({ default: defaultFn('RetainHiddenValue') }),
    { name: EventToComplexTypeKeys.Publish, message: QUESTION_WA_PUBLISH, type: 'list', choices: Y_OR_N, default: defaultFn('Publish', 'N') },
    ...addNonProdFeatureQuestions('EventToComplexTypes')
  ] as Question[]
}

function findListElementCodeOptions(answers: Answers) {
  // Look up the CaseField we are referencing to get the ComplexType we're referencing
  // Afaik the ID on an EventToComplexType has no real meaning and can be different to the ComplexType ID

  const caseField = findObject<CaseField>({ ID: answers[EventToComplexTypeKeys.CaseFieldID] }, 'CaseField')
  if (!caseField) return [CUSTOM]

  return [CUSTOM, ...getKnownComplexTypeListElementCodes(caseField.FieldTypeParameter || caseField.FieldType)]
}

/**
 * Gets the default value for FieldDisplayOrder question
 */
function getDefaultValueForFieldDisplayOrder() {
  const lastOrder: number = session.lastAnswers[EventToComplexTypeKeys.FieldDisplayOrder]
  if (session.lastAnswers[EventToComplexTypeKeys.FieldDisplayOrder]) {
    return lastOrder + 1
  }
  return 1
}

export async function createEventToComplexType(answers: Answers = {}, questions: Question[] = []) {
  const ask = addEventToComplexTypesQuestions()
  upsertFields(ask, questions, ['name'], spliceCustomQuestionIndex)

  answers = await prompt(ask, answers)

  if (answers.createField === YES) {
    await createJourneys.createField({ ID: answers.CaseFieldID, CaseEventID: answers.CaseEventID })
  }

  addToLastAnswers(answers)

  const eventToComplexType = createNewEventToComplexType(answers)

  return {
    EventToComplexTypes: [trimCcdObject(eventToComplexType)]
  }
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an EventToComplexType',
  fn: journey,
  alias: 'UpsertEventToComplexType'
} as Journey
