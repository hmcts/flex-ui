import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { addCaseEvent, addCaseTypeIDQuestion, addonDuplicateQuestion, Answers, Question, spliceCustomQuestionIndex } from 'app/questions'
import { createNewCaseEvent } from 'app/ccd'
import { Y_OR_N } from 'app/constants'
import { CaseEvent, CaseEventKeys } from 'app/types/ccd'
import { findObject, upsertConfigs } from 'app/configs'
import { addToSession } from 'app/session'
import { format, upsertFields } from 'app/helpers'

export const QUESTION_ID = 'What\'s the ID of the Event?'
export const QUESTION_NAME = 'Give the {0} event a name (shows in the next steps dropdown)'
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

async function journey(answers: Answers = {}) {
  const created = await createEvent(answers)
  addToSession(created)
  upsertConfigs(created)
}

function findExisting(answers: Answers) {
  return findObject<CaseEvent>({ ...answers, ID: answers.CaseEventID }, 'CaseEvent')
}

export function addEventQuestions(existingFn: (answers: Answers) => CaseEvent = findExisting) {
  const defaultFn = (key: keyof (Answers), or?: string | number | ((answers: Answers) => string | number)) => {
    return (answers: Answers) => {
      const orResult = typeof (or) === 'function' ? (or as any)(answers) : or
      return existingFn(answers)?.[key] || orResult
    }
  }

  const questions: Question[] = [
    ...addCaseTypeIDQuestion(),
    ...addCaseEvent({ name: CaseEventKeys.ID, message: QUESTION_ID }, false),
    { name: 'Name', message: (answers: Answers) => format(QUESTION_NAME, answers.ID), default: defaultFn('Name', (answers: Answers) => answers.ID) },
    { name: 'Description', message: QUESTION_DESCRIPTION, default: defaultFn('Description') },
    { name: 'DisplayOrder', message: QUESTION_DISPLAY_ORDER, type: 'number', default: defaultFn('DisplayOrder', 1) },
    { name: 'PreConditionState(s)', message: QUESTION_PRECONDITION_STATES, default: defaultFn('PreConditionState(s)', '*') },
    { name: 'PostConditionState', message: QUESTION_POST_CONDITION_STATE, default: defaultFn('PostConditionState', '*') },
    { name: 'EventEnablingCondition', message: QUESTION_EVENT_ENABLING_CONDITION, default: defaultFn('EventEnablingCondition') },
    { name: 'ShowEventNotes', message: QUESTION_SHOW_EVENT_NOTES, type: 'list', choices: Y_OR_N, default: defaultFn('ShowEventNotes', 'N') },
    { name: 'ShowSummary', message: QUESTION_SHOW_SUMMARY, type: 'list', choices: Y_OR_N, default: defaultFn('ShowSummary', 'Y') },
    { name: 'CallBackURLAboutToStartEvent', message: QUESTION_CALLBACK_URL_ABOUT_TO_START_EVENT, default: defaultFn('CallBackURLAboutToStartEvent') },
    { name: 'CallBackURLAboutToSubmitEvent', message: QUESTION_CALLBACK_URL_ABOUT_TO_SUBMIT_EVENT, default: defaultFn('CallBackURLAboutToSubmitEvent') },
    { name: 'CallBackURLSubmittedEvent', message: QUESTION_CALLBACK_URL_SUBMITTED_EVENT, default: defaultFn('CallBackURLSubmittedEvent') }
  ]

  return questions
}

export async function createEvent(answers: Answers = {}, questions: Question[] = []) {
  const ask = addEventQuestions()
  upsertFields(ask, questions, ['name'], spliceCustomQuestionIndex)

  answers = await prompt(ask, answers)

  return await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseEvent = createNewCaseEvent(answers)

    // ET creates authorisations here - this is highly specific code so teams implementing this will
    // need to provide their own journey for this. See journeys/et/createSingleField for an example.
    const authorisations = []

    return {
      AuthorisationCaseEvent: authorisations,
      CaseEvent: [caseEvent]
    }
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an Event',
  fn: journey,
  alias: 'UpsertEvent'
} as Journey
