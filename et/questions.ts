import { COMPOUND_KEYS, CUSTOM, NONE, NO_DUPLICATE } from 'app/constants'
import { format, getIdealSizeForInquirer } from 'app/helpers'
import { createEvent } from 'app/journeys/et/createEvent'
import { Answers, askBasicFreeEntry, fuzzySearch, listOrFreeType } from 'app/questions'
import { session } from 'app/session'
import { CaseEventKeys, CaseEventToFieldKeys, CaseFieldKeys, CCDSheets, CCDTypes, ComplexTypeKeys, EventToComplexTypeKeys, FlexExtensions } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { findObject, getCaseEventIDOpts, getEnglandWales, getKnownCaseFieldIDs, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes, getKnownCaseTypeIDs, getKnownComplexTypeListElementCodes, getScotland, Region } from 'app/et/configs'
import { createSingleField } from 'app/journeys/et/createSingleField'
import { createScrubbed } from 'app/journeys/et/createScrubbed'

const QUESTION_REGION = 'Which region(s) should this entry be added to?'
const QUESTION_CASE_EVENT_ID = 'What event does this belong to?'
const QUESTION_CASE_FIELD_ID = 'What field does this reference?'
const QUESTION_LIST_ELEMENT_CODE = 'What ListElementCode does this reference?'
const QUESTION_FIELD_TYPE_PARAMETER = 'What\'s the parameter for this {0} field?'
const QUESTION_FIELD_TYPE = 'What\'s the type of this field?'
const QUESTION_FIELD_TYPE_CUSTOM = 'What\'s the name of the FieldType?'
const QUESTION_CASE_TYPE_ID = 'What\'s the CaseTypeID?'
const QUESTION_CASE_TYPE_ID_CUSTOM = 'Enter a custom value for CaseTypeID'
const QUESTION_DUPLICATE_ADDON = 'Do we need this field duplicated under another caseTypeID?'
const QUESTION_FIELD_TYPE_PARAMETER_CUSTOM = 'Do you want to create a new scrubbed list or free text enter a FieldTypeParameter?'
const QUESTION_FIELD_TYPE_PARAMETER_FREE = 'Enter a value for FieldTypeParameter'

export const FLEX_REGION_ANSWERS_KEY = 'flexRegion'

export const REGION_OPTS = [
  Region.EnglandWales,
  Region.Scotland
]

const FIELD_TYPE_PARAMETERS_CUSTOM_OPTS = {
  ScrubbedList: 'Create a new Scrubbed List and use that',
  FreeText: 'Enter a custom value for FieldTypeParameter'
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
      answers = await askCaseEvent(answers, undefined, undefined, true)
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

export async function askCaseEvent(answers: Answers = {}, key?: string, message?: string, allowNone = false, addOpts: string[] = []) {
  const opts = getCaseEventIDOpts()
  key = key || CaseEventToFieldKeys.CaseEventID
  const choices = [...addOpts, CUSTOM, ...opts]
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

export async function askCaseFieldID(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
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

  if (answers[key] === CUSTOM) {
    answers[key] = await createSingleField({
      [CaseFieldKeys.CaseTypeID]: answers[CaseFieldKeys.CaseTypeID],
      [CaseEventToFieldKeys.CaseEventID]: answers[CaseEventToFieldKeys.CaseEventID]
    })
  }

  return answers
}

async function askEventToComplexTypeListElementCodeFallback(answers: Answers = {}, key?: string) {
  const customNameAnswers = await askBasicFreeEntry({}, key, QUESTION_LIST_ELEMENT_CODE)
  answers[key] = customNameAnswers[key]
  return answers
}

export async function askEventToComplexTypeListElementCode(answers: Answers = {}, key?: string, message?: string) {
  // This is a BIG WIP right now, we're just going to use englandwales for look ups
  const caseField = getEnglandWales().CaseField.find(o => o.ID === answers[EventToComplexTypeKeys.CaseFieldID])

  if (!caseField) {
    return await askEventToComplexTypeListElementCodeFallback(answers, key)
  }

  const opts = getKnownComplexTypeListElementCodes(caseField.FieldType === "Collection" ? caseField.FieldTypeParameter : caseField.FieldType)
  key = key || EventToComplexTypeKeys.ListElementCode

  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_LIST_ELEMENT_CODE,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    return await askEventToComplexTypeListElementCodeFallback(answers, key)
  }

  // User selected a complex type, but it might have properties on it.
  // If their selected ListElementCode IS a complex type, ask this again until they select "none"

  // For example: They selected "Judgement_costs", now enumerate all ListElementCodes on the complex type "JudgmentCosts"
  const temp = [...getEnglandWales().ComplexTypes, ...getScotland().ComplexTypes]
  const selected = temp.filter(o => o.ListElementCode === answers[key])

  // Can have a result for EW and SC, thats fine, but the FieldType should be the same, if not, just ask them to manually type in the name
  if (selected.length === 2 && selected[0].FieldType !== selected[1].FieldType) {
    const customNameAnswers = await askBasicFreeEntry({}, key, QUESTION_LIST_ELEMENT_CODE)
    answers[key] = customNameAnswers[key]
  }

  // This needs to be recursive/iterative, but for now just test with one sub level

  const obj = getKnownComplexTypeListElementCodes(selected[0].FieldType)

  if (!obj.length) {
    return answers
  }

  const SUBLEVEL_KEY = 'sublevel'
  answers = await prompt([
    {
      name: SUBLEVEL_KEY,
      message: message || `${QUESTION_LIST_ELEMENT_CODE} (${answers[key]}.?)`,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...obj], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  answers[key] = `${answers[key]}.${answers[SUBLEVEL_KEY]}`

  return answers
}

export async function askFieldTypeParameter(answers: Answers = {}, key?: string, message?: string, defaultValue?: string) {
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
    answers[key] = await createScrubbed({})
    return answers
  }

  return await askBasicFreeEntry(answers, key, QUESTION_FIELD_TYPE_PARAMETER_FREE)
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
    const customFieldType = await askBasicFreeEntry({}, key, QUESTION_FIELD_TYPE_CUSTOM)
    answers[key] = customFieldType[key]
    // TODO: Add ComplexType creation route here when ComplexType support is added
  }

  return answers
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

export async function askDuplicate(answers: Answers) {
  const opts = [NO_DUPLICATE, ...getKnownCaseTypeIDs()]
  return await listOrFreeType(answers, 'duplicate', QUESTION_DUPLICATE_ADDON, opts, undefined, true)
}

export async function askFlexRegion(key?: string, message?: string, defaultValue?: string[], answers?: Answers) {
  return await prompt([
    {
      name: key || FLEX_REGION_ANSWERS_KEY,
      message: message || QUESTION_REGION,
      type: 'checkbox',
      choices: REGION_OPTS,
      default: defaultValue || answers?.[FLEX_REGION_ANSWERS_KEY] || REGION_OPTS,
      askAnswered: true,
      pageSize: getIdealSizeForInquirer()
    }
  ], answers || {})
}

export function addFlexRegionToCcdObject(obj: FlexExtensions, answers: Answers, key?: string) {
  if (!obj.flex) {
    obj.flex = {}
  }
  obj.flex.regions = answers[key || FLEX_REGION_ANSWERS_KEY]
}