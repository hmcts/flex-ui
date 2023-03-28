import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { addonDuplicateQuestion, Answers, askCaseEvent, askCaseTypeID } from 'app/questions'
import { createNewCaseEvent } from 'app/ccd'
import { COMPOUND_KEYS, NEW, Y_OR_N } from 'app/constants'
import { CaseEvent, CaseEventKeys } from 'app/types/ccd'
import { findObject, getCaseEventIDOpts, sheets } from 'app/configs'
import { addToSession } from 'app/session'
import { upsertFields } from 'app/helpers'

export const QUESTION_NAME = 'Give the new event a name (shows in the event dropdown)'
export const QUESTION_DESCRIPTION = 'Give the new event a description'
export const QUESTION_DISPLAY_ORDER = 'Where should this event appear in the caseEvent dropdown (DisplayOrder)?'
export const QUESTION_PRECONDITION_STATES = 'What state should the case be in to see this page? (PreConditionState(s))'
export const QUESTION_POST_CONDITION_STATE = 'What state should the case be set to after completing this journey? (PostConditionState)'
export const QUESTION_EVENT_ENABLING_CONDITION = 'Enter a condition for showing this event in the "Next step" dropdown? (EventEnablingCondition) (optional)'
export const QUESTION_SHOW_EVENT_NOTES = 'Provide a value for ShowEventNotes'
export const QUESTION_SHOW_SUMMARY = 'Should there be a Check Your Answers page at the end of this event?'
export const QUESTION_CALLBACK_URL_ABOUT_TO_START_EVENT = 'Do we need a callback before we start? (optional)'
export const QUESTION_CALLBACK_URL_ABOUT_TO_SUBMIT_EVENT = 'Do we need a callback before we submit? (optional)'
export const QUESTION_CALLBACK_URL_SUBMITTED_EVENT = 'Do we need a callback after we submit? (optional)'

export async function createEvent(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, { name: CaseEventKeys.ID, message: "What's the ID of the new/existing Event?", choices: [NEW, ...getCaseEventIDOpts()] })

  if (answers.ID === NEW) {
    answers = await prompt([{ name: CaseEventKeys.ID, message: 'What\'s the ID of the new Event?', askAnswered: true, validate: (input: string) => input.length > 0 }], answers)
  }

  const existing: CaseEvent | undefined = findObject(answers, 'CaseEvent')

  answers = await prompt(
    [
      { name: 'Name', message: QUESTION_NAME, type: 'input', default: existing?.Name || answers.ID },
      { name: 'Description', message: QUESTION_DESCRIPTION, type: 'input', default: existing?.Description },
      { name: 'DisplayOrder', message: QUESTION_DISPLAY_ORDER, type: 'number', default: existing?.DisplayOrder || 1 },
      { name: 'PreConditionState(s)', message: QUESTION_PRECONDITION_STATES, type: 'input', default: existing?.['PreConditionState(s)'] || '*' },
      { name: 'PostConditionState', message: QUESTION_POST_CONDITION_STATE, type: 'input', default: existing?.PostConditionState || '*' },
      { name: 'EventEnablingCondition', message: QUESTION_EVENT_ENABLING_CONDITION, type: 'input', default: existing?.EventEnablingCondition },
      { name: 'ShowEventNotes', message: QUESTION_SHOW_EVENT_NOTES, type: 'list', choices: Y_OR_N, default: existing?.ShowEventNotes || 'N' },
      { name: 'ShowSummary', message: QUESTION_SHOW_SUMMARY, type: 'list', choices: Y_OR_N, default: existing?.ShowSummary || 'Y' },
      { name: 'CallBackURLAboutToStartEvent', message: QUESTION_CALLBACK_URL_ABOUT_TO_START_EVENT, type: 'input', default: existing?.CallBackURLAboutToStartEvent },
      { name: 'CallBackURLAboutToSubmitEvent', message: QUESTION_CALLBACK_URL_ABOUT_TO_SUBMIT_EVENT, type: 'input', default: existing?.CallBackURLAboutToSubmitEvent },
      { name: 'CallBackURLSubmittedEvent', message: QUESTION_CALLBACK_URL_SUBMITTED_EVENT, type: 'input', default: existing?.CallBackURLSubmittedEvent }
    ], answers)

  await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseEvent = createNewCaseEvent(answers)

    // ET creates authorisations here - this is highly specific code so teams implementing this will
    // need to provide their own journey for this. See journeys/et/createSingleField for an example.
    const authorisations = []

    const newFields = {
      AuthorisationCaseEvent: authorisations,
      CaseEvent: [caseEvent]
    }
    addToSession(newFields)

    for (const sheetName in newFields) {
      upsertFields(sheets[sheetName], newFields[sheetName], COMPOUND_KEYS[sheetName])
    }
  })

  return answers[CaseEventKeys.ID]
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an Event',
  fn: createEvent,
  alias: 'UpsertEvent'
} as Journey
