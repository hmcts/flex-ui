import { prompt } from 'inquirer'
import { CaseFieldKeys, ComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewComplexType, trimCcdObject } from 'app/ccd'
import { addToInMemoryConfig, getKnownComplexTypeIDs } from 'app/et/configs'
import { Answers, askBasicFreeEntry, askForRegularExpression, askMinAndMax, askRetainHiddenValue, fuzzySearch } from 'app/questions'
import { CUSTOM, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList } from 'app/constants'
import { session } from 'app/session'
import { Journey } from 'types/journey'
import { getIdealSizeForInquirer } from 'app/helpers'
import { addFlexRegionToCcdObject, askFieldType, askFieldTypeParameter, askFlexRegion } from 'app/et/questions'

const QUESTION_ID = "What's the ID of this ComplexType?"
const QUESTION_LIST_ELEMENT_CODE = 'What\'s the ListElementCode for this?'
const QUESTION_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_DISPLAY_ORDER = 'What\'s the DisplayOrder for this? (use 0 to leave blank)'
const QUESTION_DISPLAY_CONTEXT_PARAMETER = 'What\'s the DisplayContextParameter for this?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'

/**
 * Gets the default value for FieldDisplayOrder question
 */
function getDefaultValueForFieldDisplayOrder() {
  const lastOrder: number = session.lastAnswers[ComplexTypeKeys.DisplayOrder]
  if (session.lastAnswers[ComplexTypeKeys.DisplayOrder]) {
    return lastOrder + 1
  }
  return 0
}

export async function createComplexType(answers: Answers = {}) {
  answers = await askFlexRegion(undefined, undefined, undefined, answers)
  answers = await askForID(answers)

  answers = await prompt([
    { name: ComplexTypeKeys.ListElementCode, message: QUESTION_LIST_ELEMENT_CODE, type: 'input' },
    { name: ComplexTypeKeys.ElementLabel, message: QUESTION_ELEMENT_LABEL, type: 'input' },
    { name: ComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' },
    { name: ComplexTypeKeys.DisplayOrder, message: QUESTION_DISPLAY_ORDER, type: 'number', default: getDefaultValueForFieldDisplayOrder },
    { name: ComplexTypeKeys.DisplayContextParameter, message: QUESTION_DISPLAY_CONTEXT_PARAMETER },
    { name: ComplexTypeKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input' }
  ], answers)

  if (answers[ComplexTypeKeys.FieldShowCondition]) {
    answers = await askRetainHiddenValue(answers)
  }

  answers = await askFieldType(answers)

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askFieldTypeParameter(answers)
  }

  if (answers[ComplexTypeKeys.FieldType] === 'Text') {
    answers = await askForRegularExpression(answers)
  }

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_MIN_MAX)) {
    answers = await askMinAndMax(answers)
  }

  const complexType = createNewComplexType(answers)
  addFlexRegionToCcdObject(complexType, answers)

  addToInMemoryConfig({
    ComplexTypes: [trimCcdObject(complexType)]
  })

  return answers[ComplexTypeKeys.ID]
}

async function askForID(answers: Answers = {}) {
  const opts = getKnownComplexTypeIDs()
  const key = ComplexTypeKeys.ID

  answers = await prompt([
    {
      name: key,
      message: QUESTION_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: session.lastAnswers[key],
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
