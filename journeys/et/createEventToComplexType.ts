import { prompt } from "inquirer";
import { Journey } from "types/types";
import { askCaseEvent } from "./createSingleField";
import { createNewEventToComplexType } from "app/objects";
import { addToInMemoryConfig } from "app/et/configs";

const QUESTION_ID = "What's the ID for this?";
const QUESTION_CASE_FIELD_ID = "What's the CaseFieldID for this?";
const QUESTION_LIST_ELEMENT_CODE = 'Whats the ListElementCode for this?';
const QUESTION_EVENT_ELEMENT_LABEL = 'What\'s the custom label for this control?';
const QUESTION_FIELD_DISPLAY_ORDER = 'Whats the FieldDisplayOrder for this?';
const QUESTION_DISPLAY_CONTEXT = 'Whats the DisplayContext for this?';
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (or leave blank if not needed';
const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY'];

async function createEventToComplexType(answers: any) {
  answers = await askCaseEvent(answers)
  answers = await prompt([
    { name: 'ID', message: QUESTION_ID, type: 'input' },
    { name: 'CaseFieldID', message: QUESTION_CASE_FIELD_ID, type: 'input' },
    { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, type: 'input' },
    { name: 'EventElementLabel', message: QUESTION_EVENT_ELEMENT_LABEL, type: 'input' },
    { name: 'FieldDisplayOrder', message: QUESTION_FIELD_DISPLAY_ORDER, type: 'number', default: 1 },
    { name: 'DisplayContext', message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS },
    { name: 'FieldShowCondition', message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' }
  ], answers)

  const eventToComplexType = createNewEventToComplexType(answers)

  addToInMemoryConfig({
    EventToComplexTypes: [eventToComplexType],
  })
}

export default {
  group: 'et-create',
  text: 'Create an EventToComplexType',
  fn: createEventToComplexType
} as Journey