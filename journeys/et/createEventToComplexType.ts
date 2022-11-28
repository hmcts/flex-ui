import { prompt } from 'inquirer'
import { EventToComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewEventToComplexType, trimCcdObject } from 'app/ccd'
import { addToInMemoryConfig } from 'app/et/configs'
import { Answers, askRetainHiddenValue } from 'app/questions'
import { addToLastAnswers, session } from 'app/session'
import { Journey } from 'types/journey'
import { addFlexRegionToCcdObject, askCaseEvent, askCaseFieldID, askEventToComplexTypeListElementCode, askFlexRegion } from 'app/et/questions'

const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_ID = "What's the ID of this EventToComplexType?"
const QUESTION_LIST_ELEMENT_CODE = 'What\'s the ListElementCode for this?'
const QUESTION_EVENT_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_FIELD_DISPLAY_ORDER = 'What\'s the FieldDisplayOrder for this?'
const QUESTION_DISPLAY_CONTEXT = 'Should this field be READONLY, OPTIONAL or MANDATORY?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'
const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY']
const QUESTION_REPEAT = 'Add another?'

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
  answers = await askFlexRegion(undefined, undefined, undefined, answers)

  answers = await askCaseEvent(answers, undefined, QUESTION_CASE_EVENT_ID)

  answers = await prompt([{ name: 'ID', message: QUESTION_ID, type: 'input', default: session.lastAnswers.ID }], answers)

  answers = await askCaseFieldID(answers)

  answers = await askEventToComplexTypeListElementCode(answers)

  answers = await prompt([
    { name: EventToComplexTypeKeys.EventElementLabel, message: QUESTION_EVENT_ELEMENT_LABEL, type: 'input', default: session.lastAnswers.EventElementLabel },
    { name: EventToComplexTypeKeys.FieldDisplayOrder, message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: getDefaultValueForFieldDisplayOrder },
    { name: EventToComplexTypeKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: session.lastAnswers.DisplayContext },
    { name: EventToComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', default: session.lastAnswers.FieldShowCondition },
    { name: EventToComplexTypeKeys.EventHintText, message: QUESTION_HINT_TEXT, type: 'input' }
  ], answers)

  answers = await askRetainHiddenValue(answers)

  const eventToComplexType = createNewEventToComplexType(answers)
  addFlexRegionToCcdObject(eventToComplexType, answers)

  addToInMemoryConfig({
    EventToComplexTypes: [trimCcdObject(eventToComplexType)]
  })

  addToLastAnswers(answers)
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify an EventToComplexType',
  fn: createEventToComplexType
} as Journey
