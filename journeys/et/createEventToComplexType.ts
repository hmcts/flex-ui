import { addToInMemoryConfig, CCDTypeWithRegion, Region } from 'app/et/configs'
import { Journey } from 'types/journey'
import { addFlexRegionAndClone, askFlexRegion, FLEX_REGION_ANSWERS_KEY, REGION_OPTS } from 'app/et/questions'
import { createEventToComplexType } from '../base/createEventToComplexType'
import { addAutoCompleteQuestion, addCaseEvent, addCaseFieldID, Answers, QUESTION_CASE_EVENT_ID, QUESTION_LIST_ELEMENT_CODE } from 'app/questions'
import { CaseField, EventToComplexType, EventToComplexTypeKeys } from 'app/types/ccd'
import { findObject, getKnownComplexTypeListElementCodes } from 'app/configs'
import { matcher } from 'app/helpers'
import { prompt } from 'inquirer'
import { session } from 'app/session'
import { CUSTOM } from 'app/constants'

const QUESTION_EXISTING_REGION_DIFFERENT = 'The EventToComplexType object in both regions are different, which one should we bring back for defaults?'

async function journey(answers: Answers = {}) {
  answers = await askFlexRegion(answers)
  if (!(answers.flexRegion as string[]).length) return

  // We only need to ask these questions ourselves to cover the scenario of two objects existing in both EW and SC but them being different (ie, EventElementLabel is different)
  // If we were okay with bringing back defaults for one region regardless - we could rely just on the base journey
  answers = await prompt([
    ...addCaseEvent({ message: QUESTION_CASE_EVENT_ID, default: session.lastAnswers.CaseEventID }),
    ...addCaseFieldID(),
    ...addAutoCompleteQuestion({ name: EventToComplexTypeKeys.ListElementCode, message: QUESTION_LIST_ELEMENT_CODE, choices: findListElementCodeOptions as any })
  ], answers)

  const existing: CCDTypeWithRegion = await findExisting(answers)

  const created = await createEventToComplexType({ ...answers, flexRegion: existing.flexRegion })
  created.EventToComplexTypes = addFlexRegionAndClone(answers[FLEX_REGION_ANSWERS_KEY] as Region[], created.EventToComplexTypes[0])
  addToInMemoryConfig(created)
}

function findListElementCodeOptions(answers: Answers) {
  // Look up the CaseField we are referencing to get the ComplexType we're referencing
  // Afaik the ID on an EventToComplexType has no real meaning and can be different to the ComplexType ID

  const caseField = findObject<CaseField>({ ID: answers[EventToComplexTypeKeys.CaseFieldID] }, 'CaseField')
  if (!caseField) return [CUSTOM]

  return [CUSTOM, ...getKnownComplexTypeListElementCodes(caseField.FieldTypeParameter || caseField.FieldType)]
}

async function findExisting(answers: Answers) {
  let ewExisting: EventToComplexType | null = null
  let scExisting: EventToComplexType | null = null

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.EnglandWales)) {
    ewExisting = findObject({ ...answers, flexRegion: Region.EnglandWales }, 'EventToComplexTypes')
  }

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.Scotland)) {
    scExisting = findObject({ ...answers, flexRegion: Region.Scotland }, 'EventToComplexTypes')
  }

  if (!ewExisting || !scExisting) {
    return ewExisting || scExisting
  }

  // We have both objects - we need to check that they are the same, else it'll be hard to know which to bring back
  if (matcher(ewExisting, scExisting, Object.keys(EventToComplexTypeKeys) as Array<keyof (EventToComplexType)>)) {
    return ewExisting
  }

  // The complex types in ew and sc are different - we need to know what defaults to load back
  const obj = await prompt([
    { name: 'region', message: QUESTION_EXISTING_REGION_DIFFERENT, type: 'list', choices: REGION_OPTS }
  ])

  return obj.region === Region.EnglandWales ? ewExisting : scExisting
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an EventToComplexType',
  fn: journey,
  alias: 'UpsertEventToComplexType'
} as Journey
