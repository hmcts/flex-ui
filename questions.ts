import { prompt } from 'inquirer'
import { COMPOUND_KEYS, CUSTOM, NO, NONE, NO_DUPLICATE, YES_OR_NO } from 'app/constants'
import { session } from 'app/session'
import fuzzy from 'fuzzy'
import { AllCCDKeys, CaseEventKeys, CaseEventToFieldKeys, CaseField, CaseFieldKeys, CCDSheets, CCDTypes, ComplexType, ComplexTypeKeys, EventToComplexTypeKeys, ScrubbedKeys } from 'types/ccd'
import { format, getIdealSizeForInquirer } from 'app/helpers'
import { findObject, getCaseEventIDOpts, getKnownCaseFieldIDs, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes, getKnownCaseTypeIDs, getKnownComplexTypeListElementCodes } from './configs'

const QUESTION_REGULAR_EXPRESSION = 'Do we need a RegularExpression for the field?'
export const QUESTION_RETAIN_HIDDEN_VALUE = 'Should the field retain its value when hidden?'
const QUESTION_MIN = 'Enter a min for this field (optional)'
const QUESTION_MAX = 'Enter a max for this field (optional)'
const QUESTION_PAGE_ID = 'What page will this appear on?'
const QUESTION_PAGE_FIELD_DISPLAY_ORDER = 'Whats the PageFieldDisplayOrder for this?'
export const QUESTION_CASE_TYPE_ID = 'What\'s the CaseTypeID?'
export const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
export const QUESTION_CASE_FIELD_ID = 'What field does this reference?'
export const QUESTION_LIST_ELEMENT_CODE = 'What ListElementCode does this reference?'
export const QUESTION_FIELD_TYPE = 'What\'s the type of this field?'
export const QUESTION_FIELD_TYPE_PARAMETER = 'What\'s the parameter for this {0} field?'
export const QUESTION_FIELD_TYPE_PARAMETER_FREE = 'Enter a value for FieldTypeParameter'
const QUESTION_FIELD_TYPE_FREE = 'Enter a value for FieldType'
const QUESTION_CASE_TYPE_ID_CUSTOM = 'Enter a custom value for CaseTypeID'
const QUESTION_CREATE = 'Would you like to create a new {0} with ID {1}?'
const QUESTION_DUPLICATE_ADDON = 'Do we need this field duplicated under another caseTypeID?'
const QUESTION_FIELD_TYPE_PARAMETER_CUSTOM = 'Do you want to create a new scrubbed list or free text enter a FieldTypeParameter?'

const FIELD_TYPE_PARAMETERS_CUSTOM_OPTS = {
  ScrubbedList: 'Create a new Scrubbed List and use that',
  FreeText: 'Enter a custom value for FieldTypeParameter'
}

export type Answers = AllCCDKeys & Record<string, unknown>

/**
 * Asks for generic input selecting from a list
 * @returns extended answers object as passed in
 */
async function list(answers: Answers = {}, name: string, message: string, choices: string[], defaultValue?: unknown, askAnswered?: boolean) {
  return await prompt([{ name, message, type: 'list', choices, default: defaultValue, pageSize: getIdealSizeForInquirer(), askAnswered }], answers)
}

/**
 * Asks for generic input select from a list AND allowing free typing
 * @returns extended answers object as passed in
 */
export async function listOrFreeType(answers: Answers = {}, name: string, message: string, choices: string[], defaultValue?: unknown, askAnswered?: boolean) {
  answers = await list(answers, name, message, [CUSTOM, ...choices], defaultValue, askAnswered)

  if (answers[name] !== CUSTOM) {
    return answers
  }

  return await prompt([{ name, message: 'Enter a custom value', askAnswered: true }], answers)
}

/**
 * Asks for basic text entry given a question
 * @returns extended answers object as passed in
 */
export async function askBasicFreeEntry(answers: Answers = {}, name: string, message?: string, defaultValue?: unknown) {
  return await prompt([{ name, message: message || `What's the ${name}?`, default: defaultValue || session.lastAnswers[name], askAnswered: true }], answers || {})
}

/**
 * Generic fuzzy search for use with autocomplete questions
 * @param choices list of options
 * @param input their current input from terminal
 * @returns a list of suggestions that match the input text
 */
export function fuzzySearch(choices: string[], input = '', sortChoices = true) {
  if (sortChoices) {
    choices = [...choices].sort()
  }
  return fuzzy.filter(input, choices).map((el) => el.original)
}

export async function askForRegularExpression(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
  return await prompt([{
    name: key || CaseFieldKeys.RegularExpression,
    message: message || QUESTION_REGULAR_EXPRESSION,
    type: 'input',
    default: defaultValue || session.lastAnswers[key] || session.lastAnswers.RegularExpression
  }
  ], answers)
}

export async function askRetainHiddenValue(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
  return await prompt([{
    name: key || CaseEventToFieldKeys.RetainHiddenValue,
    message: message || QUESTION_RETAIN_HIDDEN_VALUE,
    type: 'list',
    choices: YES_OR_NO,
    default: defaultValue
  }
  ], answers)
}

export async function askMinAndMax(answers: Answers = {}, existingCaseField?: CaseField | ComplexType) {
  return await prompt([
    { name: CaseFieldKeys.Min, message: QUESTION_MIN, default: existingCaseField?.Min },
    { name: CaseFieldKeys.Max, message: QUESTION_MAX, default: existingCaseField?.Max }
  ], answers)
}

export async function askForPageID(answers: Answers = {}, key?: string, message?: string, defaultValue?: number) {
  return await prompt([{
    name: key || CaseEventToFieldKeys.PageID,
    message: message || QUESTION_PAGE_ID,
    type: 'number',
    default: defaultValue || session.lastAnswers.PageID || 1
  }], answers)
}

export async function askForPageFieldDisplayOrder(answers: Answers = {}, key?: string, message?: string, defaultValue?: number) {
  return await prompt([{
    name: key || CaseEventToFieldKeys.PageFieldDisplayOrder,
    message: message || QUESTION_PAGE_FIELD_DISPLAY_ORDER,
    type: 'number',
    default: defaultValue
  }], answers)
}

export async function askAutoComplete(name: string, message: string, defaultOpt: string, choices: string[], askAnswered = true, sortChoices = true, answers: Answers = {}) {
  return await prompt([
    {
      name,
      message,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(choices, input, sortChoices),
      default: defaultOpt,
      askAnswered,
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)
}

export async function sayWarning(journeyFn: () => Promise<void>) {
  const answers = await prompt([{ name: 'warning', message: 'This is a WORK IN PROGRESS journey - please be careful with these. Continue?', type: 'list', choices: YES_OR_NO, default: NO }])

  if (answers.warning === NO) {
    return
  }

  return await journeyFn()
}

/**
 * Asks the user for a CaseTypeID. Allows for creation if <custom> is selected.
 * @returns extended answers object as passed in
 */
export async function askCaseTypeID(answers: Answers = {}, key?: string, message?: string) {
  const opts = getKnownCaseTypeIDs()
  key = key || CaseFieldKeys.CaseTypeID

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_CASE_TYPE_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: session.lastAnswers[key],
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    const newEventTypeAnswers = await askBasicFreeEntry({}, key, QUESTION_CASE_TYPE_ID_CUSTOM)
    answers[key] = newEventTypeAnswers[key]
    // TODO: There's no support for CaseType.json yet so theres no flow to create one. But we could...
  }

  return answers
}

export async function askCaseEvent(answers: Answers = {}, key?: string, message?: string, addOpts: string[] = [], allowCustom = true, createEventFn?: (answers: Answers) => Promise<string>) {
  const opts = getCaseEventIDOpts()
  key = key || CaseEventToFieldKeys.CaseEventID

  const choices = allowCustom ? [...addOpts, CUSTOM, ...opts] : [...addOpts, ...opts]

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_CASE_EVENT_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(choices, input),
      default: session.lastAnswers[key],
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] !== CUSTOM) {
    return answers
  }

  answers[key] = await askBasicFreeEntry({}, key, QUESTION_CASE_EVENT_ID, 'eventId')

  if (createEventFn) {
    const followup = await prompt([{ name: 'create', message: format(QUESTION_CREATE, 'Case Field', answers[key] as string), type: 'list', choices: YES_OR_NO }])

    if (followup.create === NO) {
      return answers
    }

    answers[key] = await createEventFn({ ID: answers[key] as string, CaseTypeID: answers[CaseEventKeys.CaseTypeID] })
  }

  return answers
}

export async function askFieldType(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
  const opts = getKnownCaseFieldTypes()
  key = key || CaseFieldKeys.FieldType

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_FIELD_TYPE,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: defaultValue || 'Label',
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    const customFieldType = await askBasicFreeEntry({}, key, QUESTION_FIELD_TYPE_FREE)
    answers[key] = customFieldType[key]
  }

  return answers
}

export async function askCaseFieldID(answers: Answers = {}, key?: string, message?: string, defaultValue?: string, createSingleFieldFn?: (answers: Answers) => Promise<string>) {
  const opts = getKnownCaseFieldIDs()
  key = key || EventToComplexTypeKeys.CaseFieldID

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_CASE_FIELD_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: session.lastAnswers[key] || defaultValue,
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] !== CUSTOM) {
    return answers
  }

  answers[key] = await askBasicFreeEntry({}, key, QUESTION_CASE_FIELD_ID, 'fieldId')

  if (createSingleFieldFn) {
    const followup = await prompt([{ name: 'create', message: format(QUESTION_CREATE, 'Case Field', answers[key] as string), type: 'list', choices: YES_OR_NO }])

    if (followup.create === NO) {
      return answers
    }

    answers[key] = await createSingleFieldFn({
      [CaseFieldKeys.CaseTypeID]: answers[CaseFieldKeys.CaseTypeID],
      [CaseEventToFieldKeys.CaseEventID]: answers[CaseEventToFieldKeys.CaseEventID],
      [CaseFieldKeys.ID]: answers[key] as string
    })
  }

  return answers
}

export async function askDuplicate(answers: Answers) {
  const opts = [NO_DUPLICATE, ...getKnownCaseTypeIDs()]
  return await listOrFreeType(answers, 'duplicate', QUESTION_DUPLICATE_ADDON, opts, undefined, true)
}

export async function askComplexTypeListElementCode(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
  const opts = getKnownComplexTypeListElementCodes(answers[ComplexTypeKeys.ID])
  key = key || ComplexTypeKeys.ListElementCode

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_LIST_ELEMENT_CODE,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: defaultValue || answers[ComplexTypeKeys.ListElementCode] || CUSTOM,
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    const customFieldType = await askBasicFreeEntry({}, key, QUESTION_LIST_ELEMENT_CODE)
    answers[key] = customFieldType[key]
  }

  return answers
}

export async function askFieldTypeParameter(answers: Answers = {}, key?: string, message?: string, defaultValue?: string, createFixedListFn?: (answers: Answers) => Promise<string>) {
  const opts = getKnownCaseFieldTypeParameters()
  key = key || CaseFieldKeys.FieldTypeParameter

  answers = await prompt([
    {
      name: key,
      message: message || format(QUESTION_FIELD_TYPE_PARAMETER, answers[CaseFieldKeys.FieldType]),
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([NONE, CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer(),
      default: defaultValue
    }
  ], answers)

  if (answers[key] === NONE) {
    answers[key] = ''
    return answers
  }

  if (answers[key] !== CUSTOM) {
    return answers
  }

  const followup = await prompt([{ name: 'journey', message: QUESTION_FIELD_TYPE_PARAMETER_CUSTOM, choices: Object.values(FIELD_TYPE_PARAMETERS_CUSTOM_OPTS), type: 'list' }])
  if (followup.journey === FIELD_TYPE_PARAMETERS_CUSTOM_OPTS.ScrubbedList) {
    answers[key] = await createFixedListFn({ [ScrubbedKeys.ID]: CUSTOM })
    return answers
  }

  return await askBasicFreeEntry(answers, key, QUESTION_FIELD_TYPE_PARAMETER_FREE)
}

/**
 * Asks questions based on the keys contained in the target object type
 * (convenience method for not creating a custom method for asking questions)
 * @param answers An existing answers object that may have answers already filled
 * @param keys An enum representing the keys on the target object (ie, CaseFieldKeys)
 * @param obj A blank/default object of the target type (ie, createNewCaseField)
 * @returns An answers object with answers to questions automatically asked based on the passed in object
 */
export async function createTemplate<T, P>(answers: Answers = {}, keys: T, obj: P, sheet: keyof CCDSheets<CCDTypes>) {
  const fields = Object.keys(keys)
  const compoundKeys = COMPOUND_KEYS[sheet]

  const tasks: Array<() => Promise<void>> = []
  let existing: T | undefined

  for (const field of fields) {
    if (!compoundKeys.some(o => !answers[o])) {
      existing = findObject(answers, sheet)
    }

    const question = { name: field, message: `Give a value for ${field}`, type: 'input', default: existing?.[field] || session.lastAnswers[field] }

    if (typeof (obj[field]) === 'number') {
      question.type = 'number'
    }

    if (field === 'CaseEventID') {
      answers = await askCaseEvent(answers, undefined, undefined, [NONE])
    } else if (field === 'CaseTypeID') {
      answers = await askCaseTypeID(answers)
    } else if (field === 'CaseFieldID') {
      answers = await askCaseFieldID(answers)
    } else {
      answers = await prompt([question], answers)
    }
  }

  for (const task of tasks) {
    await task()
  }

  return answers
}
