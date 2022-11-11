import { Journey } from 'types/journey'
import { askAutoComplete } from 'app/questions'
import { createCaseTypeTab } from './createCaseTypeTab'
import { createComplexType } from './createComplexType'
import { createEvent } from './createEvent'
import { createEventToComplexType } from './createEventToComplexType'
import { createSingleField } from './createSingleField'
import { createCallbackPopulatedLabel } from './createCallbackPopulatedLabel'
import { createScrubbed } from './createScrubbed'
import { duplicateCaseField } from './manageDuplicateField'
import { createCaseEventToFieldJourney } from './createCaseEventToField'

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
  SCRUBBED: 'Upsert a scrubbed list',
  DUPLICATE: 'Duplicate case field'
}

export async function createJourney() {
  while (true) {
    const answers = await askAutoComplete('task', QUESTION_TASK, TASK_CHOICES.BACK, Object.values(TASK_CHOICES))

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
        await createScrubbed()
        break
      case TASK_CHOICES.DUPLICATE:
        await duplicateCaseField()
        break
    }
  }
}

export default {
  group: 'et-create',
  text: 'Upsert a CCD Type...',
  fn: createJourney
} as Journey
