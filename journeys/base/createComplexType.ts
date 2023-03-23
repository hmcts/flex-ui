import { prompt } from 'inquirer'
import { CaseFieldKeys, ComplexType, ComplexTypeKeys } from 'types/ccd'
import { QUESTION_ANOTHER, QUESTION_HINT_TEXT } from './createSingleField'
import { createNewComplexType, trimCcdObject } from 'app/ccd'
import { Answers, askBasicFreeEntry, askComplexTypeListElementCode, askFieldType, askFieldTypeParameter, askForRegularExpression, askMinAndMax, fuzzySearch } from 'app/questions'
import { CUSTOM, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, YES, YES_OR_NO } from 'app/constants'
import { addToLastAnswers, addToSession, saveSession, session } from 'app/session'
import { Journey } from 'types/journey'
import { getIdealSizeForInquirer } from 'app/helpers'
import { getKnownComplexTypeIDs } from 'app/configs'

const QUESTION_ID = "What's the ID of this ComplexType?"
const QUESTION_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_DISPLAY_ORDER = 'What\'s the DisplayOrder for this? (use 0 to leave blank)'
const QUESTION_DISPLAY_CONTEXT_PARAMETER = 'What\'s the DisplayContextParameter for this?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'

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
  answers = await askForID(answers, undefined, undefined, session.lastAnswers[ComplexTypeKeys.ID])

  answers = await askComplexTypeListElementCode(answers)

  answers = await prompt([
    { name: ComplexTypeKeys.ElementLabel, message: QUESTION_ELEMENT_LABEL, type: 'input', validate: (input: string) => input.length > 0 },
    { name: ComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' },
    { name: ComplexTypeKeys.DisplayOrder, message: QUESTION_DISPLAY_ORDER, type: 'number', default: () => getDefaultValueForFieldDisplayOrder() },
    { name: ComplexTypeKeys.DisplayContextParameter, message: QUESTION_DISPLAY_CONTEXT_PARAMETER },
    { name: ComplexTypeKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input' }
  ], answers)

  // TODO: Verify that this is not needed
  // if (answers[ComplexTypeKeys.FieldShowCondition]) {
  //   answers = await askRetainHiddenValue(answers, undefined, undefined, existing?.RetainHiddenValue)
  // }

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

  addToSession({
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
  group: 'create',
  text: 'Create/Modify a ComplexType',
  fn: createComplexType,
  alias: 'UpsertComplexTyoe'
} as Journey
