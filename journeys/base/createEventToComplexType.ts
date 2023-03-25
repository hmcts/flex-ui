import { prompt } from 'inquirer'
import { EventToComplexTypeKeys } from 'types/ccd'
import { QUESTION_ANOTHER, QUESTION_HINT_TEXT } from './createSingleField'
import { createNewEventToComplexType, trimCcdObject } from 'app/ccd'
import { Answers, askCaseEvent, askCaseFieldID, askRetainHiddenValue } from 'app/questions'
import { addToLastAnswers, addToSession, saveSession, session } from 'app/session'
import { Journey } from 'types/journey'
import { COMPOUND_KEYS, YES, YES_OR_NO } from 'app/constants'
import { sheets } from 'app/configs'
import { upsertFields } from 'app/helpers'

const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_ID = "What's the ID of this EventToComplexType?"
const QUESTION_EVENT_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_FIELD_DISPLAY_ORDER = 'What\'s the FieldDisplayOrder for this?'
const QUESTION_DISPLAY_CONTEXT = 'Should this field be READONLY, OPTIONAL or MANDATORY?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'
const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY']
const QUESTION_LIST_ELEMENT_CODE = 'What\'s the ListElementCode that this references?'

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

export async function createEventToComplexType(answers: Answers = {}) {
  answers = await askCaseEvent(answers, { message: QUESTION_CASE_EVENT_ID })

  answers = await prompt([{ name: EventToComplexTypeKeys.ID, message: QUESTION_ID, type: 'input', default: session.lastAnswers.ID }], answers)

  answers = await askCaseFieldID(answers)

  answers = await prompt([
    { name: EventToComplexTypeKeys.ListElementCode, message: QUESTION_LIST_ELEMENT_CODE },
    { name: EventToComplexTypeKeys.EventElementLabel, message: QUESTION_EVENT_ELEMENT_LABEL, type: 'input', default: session.lastAnswers.EventElementLabel },
    { name: EventToComplexTypeKeys.FieldDisplayOrder, message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: getDefaultValueForFieldDisplayOrder },
    { name: EventToComplexTypeKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: session.lastAnswers.DisplayContext },
    { name: EventToComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', default: session.lastAnswers.FieldShowCondition },
    { name: EventToComplexTypeKeys.EventHintText, message: QUESTION_HINT_TEXT, type: 'input' }
  ], answers)

  answers = await askRetainHiddenValue(answers)

  const eventToComplexType = createNewEventToComplexType(answers)

  const newFields = {
    EventToComplexTypes: [trimCcdObject(eventToComplexType)]
  }
  addToSession(newFields)

  for (const sheetName in newFields) {
    upsertFields(sheets[sheetName], newFields[sheetName], COMPOUND_KEYS[sheetName])
  }

  addToLastAnswers(answers)

  const followup = await prompt([{
    name: 'another',
    message: QUESTION_ANOTHER,
    type: 'list',
    choices: YES_OR_NO,
    default: YES
  }])

  if (followup.another === YES) {
    saveSession(session)
    return createEventToComplexType()
  }
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an EventToComplexType',
  fn: createEventToComplexType,
  alias: 'UpsertEventToComplexType'
} as Journey
