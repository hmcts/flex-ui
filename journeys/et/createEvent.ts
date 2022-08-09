import { prompt } from "inquirer";
import { findPreviousSessions, restorePreviousSession } from "app/session";
import { Journey } from "types/types";
import { requestCaseTypeID } from "app/questions";
import { createAuthorisationCaseEvent, createNewCaseEvent } from "app/objects";
import { addToInMemoryConfig, upsertNewCaseEvent } from "app/et/configs";

export async function createEvent(id: string) {
  let answers = { ID: id } || await prompt([
    { name: 'ID', message: "What's the name of the new Event?" }
  ])

  answers = {
    ...answers, ... await prompt(
      [
        { name: 'Name', message: 'Give the new event a name', type: 'input' },
        { name: 'Description', message: 'Give the new event a description', type: 'input' },
        { name: 'DisplayOrder', message: 'Where should this event appear in the caseEvent dropdown (DisplayOrder)?', type: 'number' },
        { name: 'PreConditionState(s)', message: 'What state should the case be in to see this page? (PreConditionState(s))', type: 'input', default: '*' },
        { name: 'PostConditionState', message: 'What state should the case be set to after completing this journey? (PostConditionState)', type: 'input', default: '*' },
        { name: 'EventEnablingCondition', message: 'Enter an EventEnablingCondition (optional)', type: 'input' },
        { name: 'ShowEventNotes', message: `Provide a value for ShowEventNotes`, type: 'list', choices: ['Y', 'N'], default: 'N' },
        { name: 'ShowSummary', message: 'Should there be a Check Your Answers page at the end of this event?', type: 'list', choices: ['Y', 'N'], default: 'Y' },
        { name: 'CallBackURLAboutToStartEvent', message: 'Do we need a callback before we start? (optional)', type: 'input' },
        { name: 'CallBackURLAboutToSubmitEvent', message: 'Do we need a callback before we submit? (optional)', type: 'input' },
        { name: 'CallBackURLSubmittedEvent', message: 'Do we need a callback after we submit? (optional)', type: 'input' },
      ], {
      ...await requestCaseTypeID()
    })
  }

  const caseEvent = createNewCaseEvent(answers)
  const authorisations = createAuthorisationCaseEvent(answers.CaseTypeID, answers.ID)

  upsertNewCaseEvent(caseEvent)

  addToInMemoryConfig({
    AuthorisationCaseEvent: authorisations
  })
  
  return caseEvent.ID
}

export default {
  group: 'et-create',
  text: 'Create Event',
  fn: createEvent
} as Journey