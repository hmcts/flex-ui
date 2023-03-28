import inquirer, { prompt } from 'inquirer'
import { COMPOUND_KEYS, CUSTOM, NO, NONE, NO_DUPLICATE, YES_OR_NO } from 'app/constants'
import { session } from 'app/session'
import fuzzy from 'fuzzy'
import { AllCCDKeys, CaseEventKeys, CaseEventToFieldKeys, CaseField, CaseFieldKeys, CCDSheets, CCDTypes, ComplexType, ComplexTypeKeys, EventToComplexTypeKeys, ScrubbedKeys } from 'types/ccd'
import { format, getIdealSizeForInquirer, remove } from 'app/helpers'
import { findObject, getCaseEventIDOpts, getKnownCaseFieldIDs, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes, getKnownCaseTypeIDs, getKnownComplexTypeListElementCodes } from './configs'

const QUESTION_REGULAR_EXPRESSION = 'Do we need a RegularExpression for the field?'
export const QUESTION_RETAIN_HIDDEN_VALUE = 'Should the field retain its value when hidden?'
const QUESTION_MIN = 'Enter a min for this field (optional)'
const QUESTION_MAX = 'Enter a max for this field (optional)'
const QUESTION_PAGE_ID = 'What page will this appear on?'
const QUESTION_PAGE_FIELD_DISPLAY_ORDER = 'Whats the PageFieldDisplayOrder for this?'
export const QUESTION_CASE_TYPE_ID = 'What\'s the CaseTypeID?'
export const QUESTION_CASE_EVENT_ID = 'What\'s the event ID?'
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
export type Question = inquirer.Question & { choices?: string[], sort?: boolean }

/**
 * Asks for generic input selecting from a list
 * @returns extended answers object as passed in
 */
export async function list(answers: Answers = {}, question: Question = {}) {
  question.name ||= 'name'
  question.message ||= 'no message provided'
  question.choices ||= []

  return await prompt([{ type: 'list', pageSize: getIdealSizeForInquirer(), ...question }], answers)
}

/**
 * Asks for generic input select from a list AND allowing free typing
 * @returns extended answers object as passed in
 */
export async function listOrFreeType(answers: Answers = {}, question: Question = {}) {
  question.name ||= 'name'
  question.message ||= 'no message provided'
  question.choices = question.choices.includes(CUSTOM) ? question.choices : [CUSTOM, ...question.choices]

  answers = await list(answers, question)

  if (answers[question.name] !== CUSTOM) {
    return answers
  }

  return await prompt([{ name: question.name, message: 'Enter a custom value', askAnswered: true }], answers)
}

/**
 * Asks for basic text entry given a question
 * @returns extended answers object as passed in
 */
export async function askBasicFreeEntry(answers: Answers = {}, question: Question = {}) {
  question.name ||= 'question'
  question.message ||= `What's the ${question.name}?`
  question.default ||= session.lastAnswers[question.name]

  return await prompt([question], answers)
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

export async function askForRegularExpression(answers: Answers = {}, question: Question = {}) {
  question.name ||= CaseFieldKeys.RegularExpression
  question.message ||= QUESTION_REGULAR_EXPRESSION

  return await prompt([{ type: 'input', ...question }], answers)
}

export async function askRetainHiddenValue(answers: Answers = {}, question: Question = {}) {
  question.name ||= CaseEventToFieldKeys.RetainHiddenValue
  question.message ||= QUESTION_RETAIN_HIDDEN_VALUE

  return await prompt([{ type: 'list', choices: YES_OR_NO, ...question }], answers)
}

export async function askMinAndMax(answers: Answers = {}, existingCaseField?: CaseField | ComplexType) {
  return await prompt([
    { name: CaseFieldKeys.Min, message: QUESTION_MIN, default: existingCaseField?.Min },
    { name: CaseFieldKeys.Max, message: QUESTION_MAX, default: existingCaseField?.Max }
  ], answers)
}

export async function askForPageID(answers: Answers = {}, question: Question = {}) {
  question.name ||= CaseEventToFieldKeys.PageID
  question.message ||= QUESTION_PAGE_ID
  question.default ||= session.lastAnswers[CaseEventToFieldKeys.PageID] || 1

  return await prompt([{ type: 'number', ...question }], answers)
}

export async function askForPageFieldDisplayOrder(answers: Answers = {}, question: Question = {}) {
  question.name ||= CaseEventToFieldKeys.PageFieldDisplayOrder
  question.message ||= QUESTION_PAGE_FIELD_DISPLAY_ORDER

  return await prompt([{ type: 'number', ...question }], answers)
}

export async function askAutoComplete(answers: Answers = {}, question: Question = {}) {
  return await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input, question.sort),
      pageSize: getIdealSizeForInquirer(),
      ...question
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
export async function askCaseTypeID(answers: Answers = {}, question: Question = {}) {
  question.name ||= CaseFieldKeys.CaseTypeID
  question.message ||= QUESTION_CASE_TYPE_ID
  question.default ||= session.lastAnswers[question.name]
  question.choices ||= getKnownCaseTypeIDs()

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)

  answers = await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      ...question
    }
  ], answers)

  if (answers[question.name] === CUSTOM) {
    const newEventTypeAnswers = await askBasicFreeEntry({}, { name: question.name, message: QUESTION_CASE_TYPE_ID_CUSTOM })
    answers[question.name] = newEventTypeAnswers[question.name]
    // TODO: There's no support for CaseType.json yet so theres no flow to create one. But we could...
  }

  return answers
}

export async function askCaseEvent(answers: Answers = {}, question: Question = {}, createEventFn?: (answers: Answers) => Promise<string>) {
  question.name ||= CaseEventToFieldKeys.CaseEventID
  question.message ||= QUESTION_CASE_EVENT_ID
  question.default ||= session.lastAnswers[question.name]
  question.choices ||= [CUSTOM, NONE, ...getCaseEventIDOpts()]

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)
  remove(question.choices, NONE)
  question.choices.splice(1, 0, NONE)

  answers = await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      ...question
    }
  ], answers)

  const key = question.name

  if (answers[key] !== CUSTOM) {
    return answers
  }

  answers = await askBasicFreeEntry(answers, { name: key, message: QUESTION_CASE_EVENT_ID, default: 'eventId', askAnswered: true })

  if (createEventFn) {
    const followup = await prompt([{ name: 'create', message: format(QUESTION_CREATE, 'CaseEvent', answers[key] as string), type: 'list', choices: YES_OR_NO }])

    if (followup.create === NO) {
      return answers
    }

    answers[key] = await createEventFn({ ID: answers[key] as string, CaseTypeID: answers[CaseEventKeys.CaseTypeID] })
  }

  return answers
}

export async function askFieldType(answers: Answers = {}, question: Question = {}) {
  question.name ||= CaseFieldKeys.FieldType
  question.message ||= QUESTION_FIELD_TYPE
  question.default ||= 'Label'
  question.choices ||= getKnownCaseFieldTypes()

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)

  answers = await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      ...question
    }
  ], answers)

  const key = question.name

  if (answers[key] === CUSTOM) {
    const customFieldType = await askBasicFreeEntry({}, { name: key, message: QUESTION_FIELD_TYPE_FREE })
    answers[key] = customFieldType[key]
  }

  return answers
}

export async function askCaseFieldID(answers: Answers = {}, question: Question = {}, createSingleFieldFn?: (answers: Answers) => Promise<string>) {
  question.name ||= EventToComplexTypeKeys.CaseFieldID
  question.message ||= QUESTION_CASE_FIELD_ID
  question.default ||= session.lastAnswers[question.name]
  question.choices ||= getKnownCaseFieldIDs()

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)

  answers = await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      ...question
    }
  ], answers)

  const key = question.name

  if (answers[key] !== CUSTOM) {
    return answers
  }

  answers = await askBasicFreeEntry(answers, { name: key, message: QUESTION_CASE_FIELD_ID, default: 'fieldId', askAnswered: true })

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

export async function askDuplicate(answers: Answers, opts = getKnownCaseTypeIDs()) {
  opts = opts.includes(NO_DUPLICATE) ? opts : [NO_DUPLICATE, ...opts]
  return await listOrFreeType(answers, { name: 'duplicate', message: QUESTION_DUPLICATE_ADDON, choices: opts, askAnswered: true })
}

export async function askComplexTypeListElementCode(answers: Answers = {}, question: Question = {}) {
  question.name ||= ComplexTypeKeys.ListElementCode
  question.message ||= QUESTION_LIST_ELEMENT_CODE
  question.default ||= session.lastAnswers[question.name] || CUSTOM
  question.choices ||= getKnownComplexTypeListElementCodes(answers[ComplexTypeKeys.ID])

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)

  answers = await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      ...question
    }
  ], answers)

  const key = question.name

  if (answers[key] === CUSTOM) {
    const customFieldType = await askBasicFreeEntry({}, { name: key, message: QUESTION_LIST_ELEMENT_CODE })
    answers[key] = customFieldType[key]
  }

  return answers
}

export async function askFieldTypeParameter(answers: Answers = {}, question: Question = {}, createFixedListFn?: (answers: Answers) => Promise<string>) {
  question.name ||= CaseFieldKeys.FieldTypeParameter
  question.message ||= format(QUESTION_FIELD_TYPE_PARAMETER, answers[CaseFieldKeys.FieldType])
  question.default ||= NONE
  question.choices ||= getKnownCaseFieldTypeParameters()

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)
  remove(question.choices, NONE)
  question.choices.splice(1, 0, NONE)

  answers = await prompt([
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      ...question
    }
  ], answers)

  const key = question.name

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

  return await askBasicFreeEntry(answers, { name: key, message: QUESTION_FIELD_TYPE_PARAMETER_FREE })
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
      answers = await askCaseEvent(answers, { choices: [NONE, ...getCaseEventIDOpts()] })
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

export async function addonDuplicateQuestion(answers: Answers, opts = getKnownCaseTypeIDs(), fn: (answers: Answers) => void) {
  fn(answers)

  while (true) {
    answers = await askDuplicate(answers, opts)

    if (answers.duplicate === NO_DUPLICATE) {
      return answers.ID
    }

    answers.CaseTypeID = answers.CaseTypeId = answers.duplicate as string
    fn(answers)
  }
}
