import { prompt } from "inquirer"
import { CaseEventToFieldKeys, CaseFieldKeys, EventToComplexTypeKeys } from "types/ccd"
import { createSingleField, askCaseEvent } from "./createSingleField"
import { createNewEventToComplexType } from "app/objects"
import { addToInMemoryConfig, getKnownCaseFieldIDs } from "app/et/configs"
import { fuzzySearch } from "app/questions"
import { CUSTOM } from "app/constants"
import { session } from "app/session"
import { getIdealSizeForInquirer } from "app/helpers"
import { Journey } from "types/journey"

const QUESTION_CASE_EVENT_ID = "What event does this belong to?"
const QUESTION_ID = "What's the ID of this EventToComplexType?"
const QUESTION_CASE_FIELD_ID = "What field does this reference?"
const QUESTION_LIST_ELEMENT_CODE = 'Whats the ListElementCode for this?'
const QUESTION_EVENT_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_FIELD_DISPLAY_ORDER = 'What\'s the FieldDisplayOrder for this?'
const QUESTION_DISPLAY_CONTEXT = 'Should this field be READONLY, OPTIONAL or MANDATORY?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'
const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY']

async function createEventToComplexType(answers: any) {
  answers = await askCaseEvent(answers, QUESTION_CASE_EVENT_ID)

  answers = await prompt([{ name: 'ID', message: QUESTION_ID, type: 'input', default: session.lastAnswers.ID }], answers)

  answers = await askCaseFieldID(answers)

  answers = await prompt([
    { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, type: 'input' },
    { name: 'EventElementLabel', message: QUESTION_EVENT_ELEMENT_LABEL, type: 'input' },
    { name: 'FieldDisplayOrder', message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: (session.lastAnswers[EventToComplexTypeKeys.FieldDisplayOrder] || 0) + 1 },
    { name: 'DisplayContext', message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS },
    { name: 'FieldShowCondition', message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' }
  ], answers)

  const eventToComplexType = createNewEventToComplexType(answers)

  addToInMemoryConfig({
    EventToComplexTypes: [eventToComplexType],
  })
}

async function askCaseFieldID(answers: any = {}) {
  const opts = getKnownCaseFieldIDs()
  const key = EventToComplexTypeKeys.CaseFieldID
  answers = await prompt([
    {
      name: key,
      message: QUESTION_CASE_FIELD_ID,
      type: 'autocomplete',
      source: (_answers: any, input: string) => fuzzySearch([CUSTOM, ...opts], input),
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