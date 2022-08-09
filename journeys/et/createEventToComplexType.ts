import { prompt } from "inquirer";
import { findPreviousSessions, restorePreviousSession } from "app/session";
import { Journey } from "types/types";
import { requestCaseTypeID } from "app/questions";
import { askCaseEvent } from "./createSingleField";
import { createNewEventToComplexType } from "app/objects";
import { addToInMemoryConfig } from "app/et/configs";

async function createEventToComplexType() {
  const answers = await prompt([
    { name: 'ID', message: "What's the ID for this?", type: 'input' },
    { name: 'CaseFieldID', message: "What's the CaseFieldID for this?", type: 'input' },
    { name: 'ListElementCode', message: 'Whats the ListElementCode for this?', type: 'input' },
    { name: 'EventElementLabel', message: 'What\'s the custom label for this control?', type: 'input' },
    { name: 'FieldDisplayOrder', message: 'DWhats the FieldDisplayOrder for this?', type: 'number', default: 1 },
    { name: 'DisplayContext', message: 'Whats the DisplayContext for this?', type: 'list', choices: ['READONLY', 'OPTIONAL', 'MANDATORY'] },
    { name: 'FieldShowCondition', message: 'Enter a FieldShowCondition (or leave blank if not needed', type: 'input' }
  ], {
    ... await askCaseEvent()
  })

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