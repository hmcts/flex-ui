import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { addonDuplicateQuestion, Answers, askCaseEvent, askCaseTypeID } from 'app/questions'
import { createNewCaseEvent } from 'app/ccd'
import { addToInMemoryConfig, createCaseEventAuthorisations, findETObject, getRegionFromCaseTypeId } from 'app/et/configs'
import { NEW, NO, YES, YES_OR_NO, Y_OR_N } from 'app/constants'
import { CaseEvent, CaseEventKeys } from 'app/types/ccd'

const QUESTION_NAME = 'Give the new event a name (shows in the event dropdown)'
const QUESTION_DESCRIPTION = 'Give the new event a description'
const QUESTION_DISPLAY_ORDER = 'Where should this event appear in the caseEvent dropdown (DisplayOrder)?'
const QUESTION_PRECONDITION_STATES = 'What state should the case be in to see this page? (PreConditionState(s))'
const QUESTION_POST_CONDITION_STATE = 'What state should the case be set to after completing this journey? (PostConditionState)'
const QUESTION_EVENT_ENABLING_CONDITION = 'Enter a condition for showing this event in the "Next step" dropdown? (EventEnablingCondition) (optional)'
const QUESTION_SHOW_EVENT_NOTES = 'Provide a value for ShowEventNotes'
const QUESTION_SHOW_SUMMARY = 'Should there be a Check Your Answers page at the end of this event?'
const QUESTION_CALLBACK_URL_ABOUT_TO_START_EVENT = 'Do we need a callback before we start? (optional)'
const QUESTION_CALLBACK_URL_ABOUT_TO_SUBMIT_EVENT = 'Do we need a callback before we submit? (optional)'
const QUESTION_CALLBACK_URL_SUBMITTED_EVENT = 'Do we need a callback after we submit? (optional)'

export async function createEvent(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, CaseEventKeys.ID, "What's the ID of the new/existing Event?", [NEW], false)

  if (answers.ID === NEW) {
    answers = await prompt([{ name: CaseEventKeys.ID, message: 'What\'s the ID of the new Event?', askAnswered: true, validate: (input: string) => input.length > 0 }], answers)
  }

  const existing: CaseEvent | undefined = findETObject(answers, 'CaseEvent', getRegionFromCaseTypeId(answers[CaseEventKeys.CaseTypeID]))

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

  if (existing) {
    answers = await prompt([{ name: 'authorisations', message: 'Do you want to create authorisations for this existing event?', type: 'list', choices: YES_OR_NO, default: NO }], answers)
  } else {
    answers.authorisations = YES
  }

  await addonDuplicateQuestion(answers, (answers: Answers) => {
    const caseEvent = createNewCaseEvent(answers)
    const authorisations = answers.authorisations === YES ? createCaseEventAuthorisations(answers.CaseTypeID, answers.ID) : []

    addToInMemoryConfig({
      AuthorisationCaseEvent: authorisations,
      CaseEvent: [caseEvent]
    })
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
