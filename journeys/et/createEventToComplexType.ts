import { prompt } from 'inquirer'
import { CaseEventToFieldKeys, CaseFieldKeys, EventToComplexTypeKeys } from 'types/ccd'
import { createSingleField, askCaseEvent, QUESTION_HINT_TEXT, QUESTION_RETAIN_HIDDEN_VALUE } from './createSingleField'
import { createNewEventToComplexType } from 'app/ccd'
import { addToInMemoryConfig, getKnownCaseFieldIDs } from 'app/et/configs'
import { Answers, fuzzySearch } from 'app/questions'
import { CUSTOM, YES_OR_NO } from 'app/constants'
import { session } from 'app/session'
import { getIdealSizeForInquirer } from 'app/helpers'
import { Journey } from 'types/journey'

const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_ID = "What's the ID of this EventToComplexType?"
const QUESTION_CASE_FIELD_ID = 'What field does this reference?'
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
  answers = await askCaseEvent(answers, QUESTION_CASE_EVENT_ID)

  answers = await prompt([{ name: 'ID', message: QUESTION_ID, type: 'input', default: session.lastAnswers.ID }], answers)

  answers = await askCaseFieldID(answers)

  answers = await prompt([
    { name: EventToComplexTypeKeys.ListElementCode, message: QUESTION_LIST_ELEMENT_CODE, type: 'input' },
    { name: EventToComplexTypeKeys.EventElementLabel, message: QUESTION_EVENT_ELEMENT_LABEL, type: 'input' },
    { name: EventToComplexTypeKeys.FieldDisplayOrder, message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: getDefaultValueForFieldDisplayOrder },
    { name: EventToComplexTypeKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS },
    { name: EventToComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' },
    { name: EventToComplexTypeKeys.EventHintText, message: QUESTION_HINT_TEXT, type: 'input' },
    { name: EventToComplexTypeKeys.RetainHiddenValue, message: QUESTION_RETAIN_HIDDEN_VALUE, type: 'list', choices: YES_OR_NO }
  ], answers)

  const eventToComplexType = createNewEventToComplexType(answers)

  addToInMemoryConfig({
    EventToComplexTypes: [eventToComplexType]
  })
}

async function askCaseFieldID(answers: Answers = {}) {
  const opts = getKnownCaseFieldIDs()
  const key = EventToComplexTypeKeys.CaseFieldID
  answers = await prompt([
    {
      name: key,
      message: QUESTION_CASE_FIELD_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    answers[key] = await createSingleField({
      [CaseFieldKeys.CaseTypeID]: answers[CaseFieldKeys.CaseTypeID],
      [CaseEventToFieldKeys.CaseEventID]: answers[CaseEventToFieldKeys.CaseEventID]
    })
  }

  return answers
}

export default {
  group: 'et-create',
  text: 'Create an EventToComplexType',
  fn: createEventToComplexType
} as Journey
