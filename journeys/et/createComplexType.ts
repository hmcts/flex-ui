import { prompt } from 'inquirer'
import { CaseFieldKeys, ComplexType, ComplexTypeKeys } from 'types/ccd'
import { QUESTION_ANOTHER, QUESTION_HINT_TEXT } from './createSingleField'
import { createNewComplexType, trimCcdObject } from 'app/ccd'
import { addToInMemoryConfig, findObject, getKnownComplexTypeIDs, Region } from 'app/et/configs'
import { Answers, askBasicFreeEntry, askForRegularExpression, askMinAndMax, fuzzySearch } from 'app/questions'
import { CUSTOM, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, YES, YES_OR_NO } from 'app/constants'
import { addToLastAnswers, saveSession, session } from 'app/session'
import { Journey } from 'types/journey'
import { getIdealSizeForInquirer, matcher } from 'app/helpers'
import { addFlexRegionToCcdObject, askComplexTypeListElementCode, askFieldType, askFieldTypeParameter, askFlexRegion, FLEX_REGION_ANSWERS_KEY, REGION_OPTS } from 'app/et/questions'

const QUESTION_ID = "What's the ID of this ComplexType?"
const QUESTION_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_DISPLAY_ORDER = 'What\'s the DisplayOrder for this? (use 0 to leave blank)'
const QUESTION_DISPLAY_CONTEXT_PARAMETER = 'What\'s the DisplayContextParameter for this?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'
const QUESTION_EXISTING_REGION_DIFFERENT = 'The ComplexType object in both regions are different, which one should we bring back for defaults?'

/**
 * Gets the default value for FieldDisplayOrder question
 */
function getDefaultValueForFieldDisplayOrder(existing?: ComplexType) {
  if (existing) {
    return existing.DisplayOrder
  }

  const lastOrder: number = session.lastAnswers[ComplexTypeKeys.DisplayOrder]
  if (session.lastAnswers[ComplexTypeKeys.DisplayOrder]) {
    return lastOrder + 1
  }
  return 0
}

export async function createComplexType(answers: Answers = {}) {
  answers = await askFlexRegion(undefined, undefined, undefined, answers)
  answers = await askForID(answers, undefined, undefined, session.lastAnswers[ComplexTypeKeys.ID])

  answers = await askComplexTypeListElementCode(answers)

  const existing = await prepopulateAnswersWithExistingValues(answers)

  answers = await prompt([
    { name: ComplexTypeKeys.ElementLabel, message: QUESTION_ELEMENT_LABEL, type: 'input', default: existing?.ElementLabel, validate: (input: string) => input.length > 0 },
    { name: ComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', default: existing?.FieldShowCondition },
    { name: ComplexTypeKeys.DisplayOrder, message: QUESTION_DISPLAY_ORDER, type: 'number', default: () => getDefaultValueForFieldDisplayOrder(existing) },
    { name: ComplexTypeKeys.DisplayContextParameter, message: QUESTION_DISPLAY_CONTEXT_PARAMETER, default: existing?.DisplayContextParameter },
    { name: ComplexTypeKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input', default: existing?.HintText }
  ], answers)

  // TODO: Verify that this is not needed
  // if (answers[ComplexTypeKeys.FieldShowCondition]) {
  //   answers = await askRetainHiddenValue(answers, undefined, undefined, existing?.RetainHiddenValue)
  // }

  answers = await askFieldType(answers, undefined, undefined, existing?.FieldType)

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askFieldTypeParameter(answers, undefined, undefined, existing?.FieldTypeParameter)
  }

  if (answers[ComplexTypeKeys.FieldType] === 'Text') {
    answers = await askForRegularExpression(answers, undefined, undefined, existing?.RegularExpression)
  }

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_MIN_MAX)) {
    answers = await askMinAndMax(answers, existing)
  }

  const complexType = createNewComplexType(answers)
  addFlexRegionToCcdObject(complexType, answers)

  addToInMemoryConfig({
    ComplexTypes: [trimCcdObject(complexType)]
  })

  addToLastAnswers(answers)

  const followup = await prompt([{
    name: 'another',
    message: QUESTION_ANOTHER,
    type: 'list',
    choices: YES_OR_NO,
    default: YES
  }])

  if (followup.another === YES) {
    saveSession(session)
    return createComplexType()
  }

  return answers[ComplexTypeKeys.ID]
}

async function prepopulateAnswersWithExistingValues(answers: Answers) {
  let ewExisting: ComplexType | null = null
  let scExisting: ComplexType | null = null

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.EnglandWales)) {
    ewExisting = findObject(answers, 'ComplexTypes', Region.EnglandWales)
  }

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.Scotland)) {
    scExisting = findObject(answers, 'ComplexTypes', Region.Scotland)
  }

  if (!ewExisting || !scExisting) {
    return ewExisting || scExisting
  }

  // We have both objects - we need to check that they are the same, else it'll be hard to know which to bring back
  if (matcher(ewExisting, scExisting, Object.keys(ewExisting) as Array<keyof (ComplexType)>)) {
    return ewExisting
  }

  // The complex types in ew and sc are different - we need to know what defaults to load back
  const obj = await prompt([
    { name: 'region', message: QUESTION_EXISTING_REGION_DIFFERENT, type: 'list', choices: REGION_OPTS }
  ])

  return obj.region === Region.EnglandWales ? ewExisting : scExisting
}

async function askForID(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
  const opts = getKnownComplexTypeIDs()
  key = key || ComplexTypeKeys.ID

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: defaultValue || session.lastAnswers[key],
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    const newEventTypeAnswers = await askBasicFreeEntry({}, key, 'Enter a custom value for ID')
    answers[key] = newEventTypeAnswers[key]
  }

  return answers
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify a ComplexType',
  fn: createComplexType,
  alias: 'UpsertComplexTyoe'
} as Journey
