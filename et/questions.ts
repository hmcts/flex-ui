import { COMPOUND_KEYS, CUSTOM, NONE } from 'app/constants'
import { getIdealSizeForInquirer } from 'app/helpers'
import { Answers, askBasicFreeEntry, askCaseEvent, askCaseFieldID, askCaseTypeID, fuzzySearch, QUESTION_LIST_ELEMENT_CODE } from 'app/questions'
import { CCDSheets, CCDTypes, EventToComplexTypeKeys, FlexExtensions } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { findETObject, getEnglandWales, getETCaseEventIDOpts, getKnownETCaseFieldIDsByEvent, getKnownETCaseTypeIDs, getKnownETComplexTypeListElementCodes, getScotland, Region } from 'app/et/configs'
import { session } from 'app/session'

const QUESTION_REGION = 'Which region(s) should this entry be added to?'

export const FLEX_REGION_ANSWERS_KEY = 'flexRegion'

export const REGION_OPTS = [
  Region.EnglandWales,
  Region.Scotland
]

async function askEventToComplexTypeListElementCodeFallback(answers: Answers = {}, key?: string) {
  const customNameAnswers = await askBasicFreeEntry({}, { name: key, message: QUESTION_LIST_ELEMENT_CODE })
  answers[key] = customNameAnswers[key]
  return answers
}

export async function askEventToComplexTypeListElementCode(answers: Answers = {}, key?: string, message?: string) {
  // This is a BIG WIP right now, we're just going to use englandwales for look ups
  const caseField = getEnglandWales().CaseField.find(o => o.ID === answers[EventToComplexTypeKeys.CaseFieldID])

  if (!caseField) {
    return await askEventToComplexTypeListElementCodeFallback(answers, key)
  }

  const opts = getKnownETComplexTypeListElementCodes(caseField.FieldType === "Collection" ? caseField.FieldTypeParameter : caseField.FieldType)
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
    const customNameAnswers = await askBasicFreeEntry({}, { name: key, message: QUESTION_LIST_ELEMENT_CODE })
    answers[key] = customNameAnswers[key]
  }

  // This needs to be recursive/iterative, but for now just test with one sub level

  const obj = getKnownETComplexTypeListElementCodes(selected[0].FieldType)

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

// TODO: Update this to take in a Question object as a parameter
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

export function getFlexRegionFromAnswers(answers: Answers) {
  return answers[FLEX_REGION_ANSWERS_KEY] as Region[]
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
      existing = findETObject(answers, sheet)
    }

    const question = { name: field, message: `Give a value for ${field}`, type: 'input', default: existing?.[field] || session.lastAnswers[field] }

    if (typeof (obj[field]) === 'number') {
      question.type = 'number'
    }

    if (field === 'CaseEventID') {
      answers = await askCaseEvent(answers, { choices: [NONE, ...getETCaseEventIDOpts()] })
    } else if (field === 'CaseTypeID') {
      answers = await askCaseTypeID(answers, { choices: getKnownETCaseTypeIDs() })
    } else if (field === 'CaseFieldID') {
      answers = await askCaseFieldID(answers, { choices: getKnownETCaseFieldIDsByEvent() })
    } else {
      answers = await prompt([question], answers)
    }
  }

  for (const task of tasks) {
    await task()
  }

  return answers
}