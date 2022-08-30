import { prompt } from 'inquirer'
import { EventToComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewEventToComplexType } from 'app/ccd'
import { addToInMemoryConfig } from 'app/et/configs'
import { Answers, askRetainHiddenValue } from 'app/questions'
import { session } from 'app/session'
import { Journey } from 'types/journey'
import { askCaseEvent, askCaseFieldID } from 'app/et/questions'

const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_ID = "What's the ID of this EventToComplexType?"
const QUESTION_LIST_ELEMENT_CODE = 'What\'s the ListElementCode for this?'
const QUESTION_EVENT_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_FIELD_DISPLAY_ORDER = 'What\'s the FieldDisplayOrder for this?'
const QUESTION_DISPLAY_CONTEXT = 'Should this field be READONLY, OPTIONAL or MANDATORY?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'
const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY']

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

async function createEventToComplexType(answers: Answers = {}) {
  answers = await askCaseEvent(answers, undefined, QUESTION_CASE_EVENT_ID)

  answers = await prompt([{ name: 'ID', message: QUESTION_ID, type: 'input', default: session.lastAnswers.ID }], answers)

  answers = await askCaseFieldID(answers)

  answers = await prompt([
    { name: EventToComplexTypeKeys.ListElementCode, message: QUESTION_LIST_ELEMENT_CODE, type: 'input' },
    { name: EventToComplexTypeKeys.EventElementLabel, message: QUESTION_EVENT_ELEMENT_LABEL, type: 'input' },
    { name: EventToComplexTypeKeys.FieldDisplayOrder, message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: getDefaultValueForFieldDisplayOrder },
    { name: EventToComplexTypeKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS },
    { name: EventToComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' },
    { name: EventToComplexTypeKeys.EventHintText, message: QUESTION_HINT_TEXT, type: 'input' }
  ], answers)

  answers = await askRetainHiddenValue(answers)

  const eventToComplexType = createNewEventToComplexType(answers)

  addToInMemoryConfig({
    EventToComplexTypes: [eventToComplexType]
  })
}

export default {
  group: 'et-create',
  text: 'Create an EventToComplexType',
  fn: createEventToComplexType
} as Journey
