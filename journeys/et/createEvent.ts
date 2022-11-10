import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { Answers } from 'app/questions'
import { createNewCaseEvent } from 'app/ccd'
import { addToInMemoryConfig, createCaseEventAuthorisations, upsertNewCaseEvent } from 'app/et/configs'
import { Y_OR_N } from 'app/constants'
import { askCaseTypeID } from 'app/et/questions'

const QUESTION_NAME = 'Give the new event a name (shows in the event dropdown)'
const QUESTION_DESCRIPTION = 'Give the new event a description'
const QUESTION_DISPLAY_ORDER = 'Where should this event appear in the caseEvent dropdown (DisplayOrder)?'
const QUESTION_PRECONDITION_STATES = 'What state should the case be in to see this page? (PreConditionState(s))'
const QUESTION_POST_CONDITION_STATE = 'What state should the case be set to after completing this journey? (PostConditionState)'
const QUESTION_EVENT_ENABLING_CONDITION = 'Enter an EventEnablingCondition (optional)'
const QUESTION_SHOW_EVENT_NOTES = 'Provide a value for ShowEventNotes'
const QUESTION_SHOW_SUMMARY = 'Should there be a Check Your Answers page at the end of this event?'
const QUESTION_CALLBACK_URL_ABOUT_TO_START_EVENT = 'Do we need a callback before we start? (optional)'
const QUESTION_CALLBACK_URL_ABOUT_TO_SUBMIT_EVENT = 'Do we need a callback before we submit? (optional)'
const QUESTION_CALLBACK_URL_SUBMITTED_EVENT = 'Do we need a callback after we submit? (optional)'

export async function createEvent(answers: Answers = {}) {
  answers = await prompt([{ name: 'ID', message: "What's the ID of the new Event?" }], answers)
  answers = await askCaseTypeID(answers)
  answers = await prompt(
    [
      { name: 'Name', message: QUESTION_NAME, type: 'input', default: answers.ID },
      { name: 'Description', message: QUESTION_DESCRIPTION, type: 'input' },
      { name: 'DisplayOrder', message: QUESTION_DISPLAY_ORDER, type: 'number', default: 1 },
      { name: 'PreConditionState(s)', message: QUESTION_PRECONDITION_STATES, type: 'input', default: '*' },
      { name: 'PostConditionState', message: QUESTION_POST_CONDITION_STATE, type: 'input', default: '*' },
      { name: 'EventEnablingCondition', message: QUESTION_EVENT_ENABLING_CONDITION, type: 'input' },
      { name: 'ShowEventNotes', message: QUESTION_SHOW_EVENT_NOTES, type: 'list', choices: Y_OR_N, default: 'N' },
      { name: 'ShowSummary', message: QUESTION_SHOW_SUMMARY, type: 'list', choices: Y_OR_N, default: 'Y' },
      { name: 'CallBackURLAboutToStartEvent', message: QUESTION_CALLBACK_URL_ABOUT_TO_START_EVENT, type: 'input' },
      { name: 'CallBackURLAboutToSubmitEvent', message: QUESTION_CALLBACK_URL_ABOUT_TO_SUBMIT_EVENT, type: 'input' },
      { name: 'CallBackURLSubmittedEvent', message: QUESTION_CALLBACK_URL_SUBMITTED_EVENT, type: 'input' }
    ], answers)

  const caseEvent = createNewCaseEvent(answers)
  const authorisations = createCaseEventAuthorisations(answers.CaseTypeID, answers.ID)

  upsertNewCaseEvent(caseEvent)

  addToInMemoryConfig({
    AuthorisationCaseEvent: authorisations
  })

  return caseEvent.ID
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify an Event',
  fn: createEvent
} as Journey
