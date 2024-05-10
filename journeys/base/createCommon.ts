import { Journey } from 'types/journey'
import { askAutoComplete } from 'app/questions'
import { createCaseTypeTab } from './createCaseTypeTab'
import { createComplexType } from './createComplexType'
import { createEvent } from './createEvent'
import { createEventToComplexType } from './createEventToComplexType'
import { createSingleField } from './createSingleField'
import { createCallbackPopulatedLabel } from './createCallbackPopulatedLabel'
import { createSingleScrubbedEntry } from './createScrubbed'
import { createCaseEventToFieldJourney } from './createCaseEventToField'
import { isCurrentSessionEmpty, saveSession, session } from 'app/session'
import { setSessionName } from './sessionSetName'
import { prompt } from 'inquirer'
import { YES, YES_OR_NO } from 'app/constants'

const QUESTION_TASK = 'What task do you want to perform?'

const TASK_CHOICES = {
  BACK: '<< back to main menu',
  CALLBACK_LABEL: 'Upsert a callback-populated label',
  FIELD: 'Upsert a single Field',
  CASE_EVENT_TO_FIELD: 'Upsert a CaseEventToField',
  CASE_TYPE_TAB: 'Upsert a CaseTypeTab',
  COMPLEX_TYPE: 'Upsert a ComplexType',
  EVENT: 'Upsert an Event',
  EVENT_TO_COMPLEX_TYPE: 'Upsert an EventToComplexType',
  SCRUBBED: 'Upsert a scrubbed list'
}

export async function createJourney() {
  while (true) {
    const answers = await askAutoComplete({}, { name: 'task', message: QUESTION_TASK, default: TASK_CHOICES.BACK, choices: Object.values(TASK_CHOICES) })

    switch (answers.task) {
      case TASK_CHOICES.BACK:
        return
      case TASK_CHOICES.CASE_EVENT_TO_FIELD:
        await createCaseEventToFieldJourney()
        break
      case TASK_CHOICES.CALLBACK_LABEL:
        await createCallbackPopulatedLabel()
        break
      case TASK_CHOICES.CASE_TYPE_TAB:
        await createCaseTypeTab()
        break
      case TASK_CHOICES.COMPLEX_TYPE:
        await createComplexType()
        break
      case TASK_CHOICES.EVENT:
        await createEvent()
        break
      case TASK_CHOICES.EVENT_TO_COMPLEX_TYPE:
        await createEventToComplexType()
        break
      case TASK_CHOICES.FIELD:
        await createSingleField()
        break
      case TASK_CHOICES.SCRUBBED:
        await createSingleScrubbedEntry()
        break
    }

    saveSession(session)
    await conditionalAskForSessionName()
  }
}

/**
 * Ask the user for a session name if the current session has a default name (session_TIME) and has data in it
 */
async function conditionalAskForSessionName() {
  const isDefaultName = session.name.match(/^session_\d+$/)
  if (isCurrentSessionEmpty() || !isDefaultName) {
    return
  }

  const notEmptyQuestion = `Current session (${session.name}) is not empty but has not had a name set. Would you like to do that now?`
  const answers = await prompt([
    { name: 'name', message: notEmptyQuestion, type: 'list', choices: YES_OR_NO }
  ])

  if (answers.name === YES) {
    await setSessionName()
    saveSession(session)
  }
}

export default {
  group: 'create',
  text: 'Upsert a CCD Type...',
  fn: createJourney,
  alias: 'UpsertCommon'
} as Journey
