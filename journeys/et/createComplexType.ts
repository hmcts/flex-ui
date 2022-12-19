import { prompt } from 'inquirer'
import { CaseFieldKeys, ComplexType, ComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewComplexType, trimCcdObject } from 'app/ccd'
import { addToInMemoryConfig, findObject, getKnownComplexTypeIDs, Region } from 'app/et/configs'
import { Answers, askBasicFreeEntry, askForRegularExpression, askMinAndMax, askRetainHiddenValue, fuzzySearch } from 'app/questions'
import { CUSTOM, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList } from 'app/constants'
import { session } from 'app/session'
import { Journey } from 'types/journey'
import { getIdealSizeForInquirer, matcher } from 'app/helpers'
import { addFlexRegionToCcdObject, askComplexTypeListElementCode, askFieldType, askFieldTypeParameter, askFlexRegion, FLEX_REGION_ANSWERS_KEY } from 'app/et/questions'

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
  answers = await askForID(answers)

  // Modify to work like single field where it brings back information if the field exists
  answers = await askComplexTypeListElementCode(answers)

  let existing: ComplexType | null = null
  let ewExisting: ComplexType | null = null
  let scExisting: ComplexType | null = null

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.EnglandWales)) {
    ewExisting = findObject(answers, 'ComplexTypes', Region.EnglandWales)
  }

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.Scotland)) {
    scExisting = findObject(answers, 'ComplexTypes', Region.Scotland)
  }

  if (ewExisting && scExisting) {
    // We have both objects - we need to check that they are the same, else it'll be hard to know which to bring back
    const same = matcher(ewExisting, scExisting, Object.keys(ewExisting) as Array<keyof (ComplexType)>)
    if (same) {
      // Yay
      existing = ewExisting
    } else {
      // The complex types in ew and sc are different - we need to know what defaults to load back, we could ask the user
      const obj = await prompt([
        { name: 'region', message: QUESTION_EXISTING_REGION_DIFFERENT, type: 'list', choices: [Region.EnglandWales, Region.Scotland], default: Region.EnglandWales }
      ])

      if (obj.region === Region.EnglandWales) {
        existing = ewExisting
      } else {
        existing = scExisting
      }
    }
  } else {
    existing = ewExisting || scExisting
  }

  answers = await prompt([
    { name: ComplexTypeKeys.ElementLabel, message: QUESTION_ELEMENT_LABEL, type: 'input', default: existing?.ElementLabel },
    { name: ComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input', default: existing?.FieldShowCondition },
    { name: ComplexTypeKeys.DisplayOrder, message: QUESTION_DISPLAY_ORDER, type: 'number', default: () => getDefaultValueForFieldDisplayOrder(existing) },
    { name: ComplexTypeKeys.DisplayContextParameter, message: QUESTION_DISPLAY_CONTEXT_PARAMETER, default: existing?.DisplayContextParameter },
    { name: ComplexTypeKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input', default: existing?.HintText }
  ], answers)

  if (answers[ComplexTypeKeys.FieldShowCondition]) {
    answers = await askRetainHiddenValue(answers, undefined, undefined, existing?.RetainHiddenValue)
  }

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

  return answers[ComplexTypeKeys.ID]
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
  fn: createComplexType
} as Journey
