import inquirer, { prompt } from 'inquirer'
import { COMPOUND_KEYS, CUSTOM, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, isFieldTypeInExclusionList, NO, NONE, NO_DUPLICATE, YES, YES_OR_NO } from 'app/constants'
import { session } from 'app/session'
import fuzzy from 'fuzzy'
import { AllCCDKeys, CaseEventKeys, CaseEventToField, CaseEventToFieldKeys, CaseFieldKeys, CCDSheets, CCDTypes, ComplexTypeKeys, ConfigSheets, EventToComplexTypeKeys } from 'types/ccd'
import { format, getIdealSizeForInquirer, remove } from 'app/helpers'
import { findObject, getCaseEventIDOpts, getKnownCaseFieldIDs, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes, getKnownCaseTypeIDs, getKnownComplexTypeListElementCodes, getLastPageInEvent, getNextPageFieldIDForPage, upsertConfigs } from './configs'
import { createEvent } from './journeys/base/createEvent'
import { createScrubbedList } from './journeys/base/createScrubbed'
import { createSingleField } from './journeys/base/createSingleField'

export const QUESTION_REGULAR_EXPRESSION = 'Do we need a RegularExpression for the field?'
export const QUESTION_RETAIN_HIDDEN_VALUE = 'Should the field retain its value when hidden?'
export const QUESTION_MIN = 'Enter a min for this field (optional)'
export const QUESTION_MAX = 'Enter a max for this field (optional)'
export const QUESTION_PAGE_ID = 'What page will this appear on?'
export const QUESTION_PAGE_FIELD_DISPLAY_ORDER = 'Whats the PageFieldDisplayOrder for this?'
export const QUESTION_CASE_TYPE_ID = 'What\'s the CaseTypeID?'
export const QUESTION_CASE_EVENT_ID = 'What\'s the event ID?'
export const QUESTION_CASE_FIELD_ID = 'What field does this reference?'
export const QUESTION_LIST_ELEMENT_CODE = 'What ListElementCode does this reference?'
export const QUESTION_FIELD_TYPE = 'What\'s the type of this field?'
export const QUESTION_FIELD_TYPE_PARAMETER = 'What\'s the parameter for this {0} field?'
export const QUESTION_FIELD_TYPE_PARAMETER_FREE = 'Enter a value for FieldTypeParameter'
export const QUESTION_FIELD_TYPE_FREE = 'Enter a value for FieldType'
export const QUESTION_CASE_TYPE_ID_CUSTOM = 'Enter a custom value for CaseTypeID'
export const QUESTION_CREATE = 'Would you like to create a new {0} with ID {1}?'
export const QUESTION_DUPLICATE_ADDON = 'Do we need this field duplicated under another caseTypeID?'
export const QUESTION_DUPLICATE = 'Select caseTypeIDs to duplicate this to (optional)'
export const QUESTION_FIELD_TYPE_PARAMETER_CUSTOM = 'Do you want to create a new scrubbed list or free text enter a FieldTypeParameter?'
export const QUESTION_PAGE_LABEL = 'Does this page have a custom title? (optional)'
export const QUESTION_PAGE_SHOW_CONDITION = 'Enter a page show condition string (optional)'
export const QUESTION_CALLBACK_URL_MID_EVENT = 'Enter the callback url to hit before loading the next page (optional)'

export const FIELD_TYPE_PARAMETERS_CUSTOM_OPTS = {
  ScrubbedList: 'Create a new Scrubbed List (after this) and use that',
  FreeText: 'Enter a custom value for FieldTypeParameter'
}

export type Answers = AllCCDKeys & Record<string, unknown>
export type Question = inquirer.Question & { name?: string, choices?: string[], sort?: boolean, index?: number, before?: string, after?: string, fallbackDefault?: string | ((answers: Answers) => string) }
type CreateJourneyFn = (answers: Answers) => Promise<Partial<ConfigSheets>>

export const createJourneys: {
  createEvent: CreateJourneyFn
  createScrubbed: CreateJourneyFn
  createField: CreateJourneyFn
} = {
  createEvent: createEvent,
  createScrubbed: createScrubbedList,
  createField: createSingleField
}

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

export async function askAutoComplete(answers: Answers = {}, question: Question = {}) {
  return await prompt(addAutoCompleteQuestion(question), answers)
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

export async function askCaseEvent(answers: Answers = {}, question: Question = {}, allowCreate = true) {
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

  if (allowCreate && createJourneys.createEvent) {
    const followup = await prompt([{ name: 'create', message: format(QUESTION_CREATE, 'CaseEvent', answers[key] as string), type: 'list', choices: YES_OR_NO }])

    if (followup.create === NO) {
      return answers
    }

    const created = await createJourneys.createEvent({ ID: answers[key] as string, CaseTypeID: answers[CaseEventKeys.CaseTypeID] })
    answers[key] = created.CaseEvent[0].ID
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

export async function askDuplicate(answers: Answers, question: Question = {}) {
  question.name ||= 'duplicate'
  question.message ||= QUESTION_DUPLICATE_ADDON
  question.choices ||= [NO_DUPLICATE, ...getKnownCaseTypeIDs()]

  return await listOrFreeType(answers, { askAnswered: true, ...question })
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

    const question = { name: field, message: `Give a value for ${field}`, default: existing?.[field] || session.lastAnswers[field], type: 'input' }

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

export async function addonDuplicateQuestion(answers: Answers, question: Question = {}, fn: (answers: Answers) => Partial<ConfigSheets>) {
  const created = fn(answers)

  while (true) {
    answers = await askDuplicate(answers, question)

    if (answers.duplicate === NO_DUPLICATE) {
      return created
    }

    answers.CaseTypeID = answers.CaseTypeId = answers.duplicate as string
    const more = fn(answers)
    upsertConfigs(more, created)
  }
}

export function addDuplicateToCaseTypeID(question: Question = {}) {
  question.name ||= 'duplicate'
  question.message ||= QUESTION_DUPLICATE
  question.choices ||= getKnownCaseTypeIDs()

  return [
    {
      type: 'checkbox',
      ...question
    }
  ]
}

export async function askFirstOnPageQuestions(answers: Answers = {}, existingCaseEventToField?: CaseEventToField) {
  return await prompt([
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, default: existingCaseEventToField?.PageLabel },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, default: existingCaseEventToField?.PageShowCondition },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, default: existingCaseEventToField?.CallBackURLMidEvent }
  ], answers)
}

export async function askYesOrNo(answers: Answers = {}, question: Question = {}) {
  question.name ||= 'yesOrNo'

  return await prompt([{ type: 'list', choices: YES_OR_NO, askAnswered: true, ...question }], answers)
}

export function addComplexTypeListElementCodeQuestion(answers: Answers = {}, question: Question = {}) {
  question.name ||= ComplexTypeKeys.ListElementCode
  question.message ||= QUESTION_LIST_ELEMENT_CODE
  question.default ||= session.lastAnswers[question.name] || CUSTOM
  // TODO: Our Question type only allows a string[] for choices - but inquirer can also take a function that returns a string[]
  question.choices ||= ((answers: Answers) => {
    const choices = getKnownComplexTypeListElementCodes(answers[ComplexTypeKeys.ID])
    remove(choices, CUSTOM)
    choices.splice(0, 0, CUSTOM)
    return choices
  }) as any

  return addAutoCompleteQuestion(question)
}

/**
 * Asks for basic text entry given a question
 * @returns extended answers object as passed in
 */
export function addBasicFreeEntry(question: Question = {}) {
  question.name ||= 'question'
  question.message ||= `What's the ${question.name}?`
  question.default ||= session.lastAnswers[question.name]

  return [question]
}

export function addFieldTypeQuestion(question: Question = {}) {
  question.name ||= CaseFieldKeys.FieldType
  question.message ||= QUESTION_FIELD_TYPE
  question.default ||= 'Label'
  question.choices ||= getKnownCaseFieldTypes()

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)

  return addAutoCompleteQuestion(question)
}

export function addFieldTypeParameterQuestion(question: Question = {}) {
  question.name ||= CaseFieldKeys.FieldTypeParameter
  question.message ||= (answers: Answers) => format(QUESTION_FIELD_TYPE_PARAMETER, answers[CaseFieldKeys.FieldType])
  question.default ||= NONE
  question.choices ||= getKnownCaseFieldTypeParameters()
  question.when ||= (answers: Answers) => !isFieldTypeInExclusionList(answers.FieldType, FIELD_TYPES_EXCLUDE_PARAMETER)

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)
  remove(question.choices, NONE)
  question.choices.splice(1, 0, NONE)

  return [
    {
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch(question.choices, input),
      pageSize: getIdealSizeForInquirer(),
      filter: (input: string) => input === NONE ? '' : input,
      ...question
    },
    {
      when: (answers: Answers) => answers[question.name] === CUSTOM,
      name: 'fieldTypeParameterJourney',
      message: QUESTION_FIELD_TYPE_PARAMETER_CUSTOM,
      choices: Object.values(FIELD_TYPE_PARAMETERS_CUSTOM_OPTS),
      type: 'list',
      askAnswered: true
    },
    {
      when: (answers: Answers) => answers.fieldTypeParameterJourney === FIELD_TYPE_PARAMETERS_CUSTOM_OPTS.FreeText,
      name: question.name,
      message: QUESTION_FIELD_TYPE_PARAMETER_FREE,
      askAnswered: true
    }
  ]
}

export function addAutoCompleteQuestion(question: Question = {}) {
  question.name ||= 'autocomplete'
  question.message ||= 'Pick a value'

  return [
    {
      type: 'autocomplete',
      source: (answers: Answers, input: string) => {
        const choices = typeof (question.choices) === 'function' ? (question as any).choices(answers) : question.choices
        return fuzzySearch(choices, input, question.sort)
      },
      pageSize: getIdealSizeForInquirer(),
      ...question
    },
    {
      when: (ans) => ans[question.name] === CUSTOM,
      name: question.name,
      message: question.message,
      askAnswered: true
    }
  ]
}

export function addRegularExpressionQuestion(question: Question = {}) {
  question.name ||= CaseFieldKeys.RegularExpression
  question.message ||= QUESTION_REGULAR_EXPRESSION
  question.when ||= (answers: Answers) => answers.FieldType === 'Text'

  return [question]
}

export function addMinQuestion(question: Question = {}) {
  question.name = CaseFieldKeys.Min
  question.message = QUESTION_MIN
  question.when = (answers: Answers) => !isFieldTypeInExclusionList(answers.FieldType, FIELD_TYPES_EXCLUDE_MIN_MAX)

  return [question]
}

export function addMaxQuestion(question: Question = {}) {
  question.name = CaseFieldKeys.Max
  question.message = QUESTION_MAX
  question.when = (answers: Answers) => !isFieldTypeInExclusionList(answers.FieldType, FIELD_TYPES_EXCLUDE_MIN_MAX)

  return [question]
}

export function addPageIDQuestion(question: Question = {}) {
  question.name ||= CaseEventToFieldKeys.PageID
  question.message ||= QUESTION_PAGE_ID
  question.default ||= (answers: Answers) => session.lastAnswers[CaseEventToFieldKeys.PageID] || getLastPageInEvent(answers.CaseTypeID, answers.CaseEventID) || 1

  return [{ type: 'number', ...question }]
}

export function addPageFieldDisplayOrderQuestion(question: Question = {}) {
  question.name ||= CaseEventToFieldKeys.PageFieldDisplayOrder
  question.message ||= QUESTION_PAGE_FIELD_DISPLAY_ORDER
  question.default ||= (answers: Answers) => getNextPageFieldIDForPage(answers.CaseTypeID, answers.CaseEventID, answers.PageID)

  return [{ type: 'number', ...question }]
}

export function addRetainHiddenValueQuestion(question: Question = {}) {
  question.name ||= CaseEventToFieldKeys.RetainHiddenValue
  question.message ||= QUESTION_RETAIN_HIDDEN_VALUE
  question.when ||= (answers: Answers) => answers.FieldShowCondition?.length > 1

  return [{ type: 'list', choices: YES_OR_NO, ...question }]
}

export function addCaseTypeIDQuestion(question: Question = {}) {
  question.name ||= CaseFieldKeys.CaseTypeID
  question.message ||= QUESTION_CASE_TYPE_ID
  question.default ||= session.lastAnswers[question.name]
  question.choices ||= [CUSTOM, ...getKnownCaseTypeIDs()]

  return addAutoCompleteQuestion(question)
}

export function addCaseEvent(question: Question = {}, allowCreate = true) {
  question.name ||= CaseEventToFieldKeys.CaseEventID
  question.message ||= QUESTION_CASE_EVENT_ID
  question.default ||= session.lastAnswers[question.name]
  question.choices ||= [CUSTOM, NONE, ...getCaseEventIDOpts()]

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)
  remove(question.choices, NONE)
  question.choices.splice(1, 0, NONE)

  return [
    ...addAutoCompleteQuestion(question),
    {
      when: (answers: Answers) => allowCreate && answers[question.name] !== NONE && !findObject({ CaseTypeID: answers.CaseTypeID, ID: answers.CaseEventID }, 'CaseEvent'),
      name: 'createEvent',
      message: (answers: Answers) => `Event ${answers[question.name]} does not exist, would you like to create it after this?`,
      type: 'list',
      choices: YES_OR_NO,
      default: YES
    }
  ]
}

export function addCaseFieldID(question: Question = {}, allowCreate = true) {
  question.name ||= EventToComplexTypeKeys.CaseFieldID
  question.message ||= QUESTION_CASE_FIELD_ID
  question.default ||= session.lastAnswers[question.name]
  question.choices ||= getKnownCaseFieldIDs()

  remove(question.choices, CUSTOM)
  question.choices.splice(0, 0, CUSTOM)

  return [
    ...addAutoCompleteQuestion(question),
    {
      when: (answers: Answers) => allowCreate && answers[question.name] !== NONE && !findObject({ ID: answers.CaseFieldID }, 'CaseField'),
      name: 'createField',
      message: 'This Field does not exist, would you like to create it after this?',
      type: 'list',
      choices: YES_OR_NO,
      default: YES
    }
  ]
}

export function spliceCustomQuestionIndex(obj: Question, arr: Question[]) {
  if (obj.index || obj.index === 0) {
    return obj.index
  }

  if (obj.before) {
    const iBefore = arr.findIndex(o => o.name === obj.before)
    return Math.max(0, iBefore)
  }

  const iAfter = arr.findIndex(o => o.name === obj.after)
  return iAfter + 1
}
