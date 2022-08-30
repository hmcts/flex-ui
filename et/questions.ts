import { CUSTOM, NONE } from 'app/constants'
import { format, getIdealSizeForInquirer } from 'app/helpers'
import { createEvent } from 'app/journeys/et/createEvent'
import { Answers, askBasicFreeEntry, fuzzySearch } from 'app/questions'
import { session } from 'app/session'
import { CaseEventKeys, CaseEventToFieldKeys, CaseFieldKeys, EventToComplexTypeKeys } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { getCaseEventIDOpts, getKnownCaseFieldIDs, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes, getKnownCaseTypeIDs } from 'app/et/configs'
import { createSingleField } from 'app/journeys/et/createSingleField'
import { createScrubbed } from 'app/journeys/et/createScrubbed'

const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_CASE_FIELD_ID = 'What field does this reference?'
const QUESTION_FIELD_TYPE_PARAMETER = 'What\'s the parameter for this {0} field?'
const QUESTION_FIELD_TYPE = 'What\'s the type of this field?'
const QUESTION_FIELD_TYPE_CUSTOM = 'What\'s the name of the FieldType?'
const QUESTION_CASE_TYPE_ID = 'What\'s the CaseTypeID?'
const QUESTION_CASE_TYPE_ID_CUSTOM = 'Enter a custom value for CaseTypeID'

/**
 * Asks questions based on the keys contained in the target object type
 * (convenience method for not creating a custom method for asking questions)
 * @param answers An existing answers object that may have answers already filled
 * @param keys An enum representing the keys on the target object (ie, CaseFieldKeys)
 * @param obj A blank/default object of the target type (ie, createNewCaseField)
 * @returns An answers object with answers to questions automatically asked based on the passed in object
 */
export async function createTemplate<T, P>(answers: Answers = {}, keys: T, obj: P) {
  const fields = Object.keys(keys)

  const tasks: Array<() => Promise<void>> = []

  for (const field of fields) {
    const question = { name: field, message: `Give a value for ${field}`, type: 'input', default: session.lastAnswers[field] }

    if (typeof (obj[field]) === 'number') {
      question.type = 'number'
    }

    if (field === 'CaseEventID') {
      tasks.push(async () => { answers = await askCaseEvent(answers, undefined, undefined, true) })
    } else if (field === 'CaseTypeID') {
      tasks.push(async () => { answers = await askCaseTypeID(answers) })
    } else if (field === 'CaseFieldID') {
      tasks.push(async () => { answers = await askCaseFieldID(answers) })
    } else {
      tasks.push(async () => { answers = await prompt([question], answers) })
    }
  }

  for (const task of tasks) {
    await task()
  }

  return answers
}

export async function askCaseEvent(answers: Answers = {}, key?: string, message?: string, allowNone = false) {
  const opts = getCaseEventIDOpts()
  key = key || CaseEventToFieldKeys.CaseEventID
  const choices = [CUSTOM, ...opts]
  if (allowNone) {
    choices.splice(0, 0, NONE)
  }
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

  if (answers[key] === CUSTOM) {
    answers[key] = await createEvent({ CaseTypeID: answers[CaseEventKeys.CaseTypeID] })
  }

  return answers
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

export async function askCaseFieldID(answers: Answers = {}, key?: string, message?: string) {
  const opts = getKnownCaseFieldIDs()
  key = key || EventToComplexTypeKeys.CaseFieldID

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_CASE_FIELD_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    answers[key] = await createSingleField({
      [CaseFieldKeys.CaseTypeID]: answers[CaseFieldKeys.CaseTypeID],
      [CaseEventToFieldKeys.CaseEventID]: answers[CaseEventToFieldKeys.CaseEventID]
    })
  }

  return answers
}

export async function askFieldTypeParameter(answers: Answers = {}, key?: string, message?: string) {
  const opts = getKnownCaseFieldTypeParameters()
  key = key || CaseFieldKeys.FieldTypeParameter

  answers = await prompt([
    {
      name: key,
      message: message || format(QUESTION_FIELD_TYPE_PARAMETER, answers[CaseFieldKeys.FieldType]),
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([NONE, CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === NONE) {
    answers[key] = ''
  } else if (answers[key] === CUSTOM) {
    answers[key] = await createScrubbed({})
  }

  return answers
}

export async function askFieldType(answers: Answers = {}, key?: string, message?: string) {
  const opts = getKnownCaseFieldTypes()
  key = key || CaseFieldKeys.FieldType

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_FIELD_TYPE,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: 'Label',
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    const customFieldType = await askBasicFreeEntry({}, key, QUESTION_FIELD_TYPE_CUSTOM)
    answers[key] = customFieldType[key]
    // TODO: Add ComplexType creation route here when ComplexType support is added
  }

  return answers
}
