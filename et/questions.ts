import { COMPOUND_KEYS, CUSTOM, NONE } from 'app/constants'
import { getIdealSizeForInquirer } from 'app/helpers'
import { Answers, askBasicFreeEntry, askCaseEvent, askCaseFieldID, askCaseTypeID, fuzzySearch, Question, QUESTION_LIST_ELEMENT_CODE } from 'app/questions'
import { CCDSheets, CCDTypes, EventToComplexTypeKeys } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { ETFlexExtensions, findETObject, getConfigSheetsFromFlexRegion, getETCaseEventIDOpts, getKnownETCaseFieldIDsByEvent, getKnownETCaseTypeIDs, getKnownETComplexTypeListElementCodes, Region } from 'app/et/configs'
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

// TODO: Revisit this
export async function askEventToComplexTypeListElementCode(answers: Answers = {}, question: Question = {}) {
  question.name ||= EventToComplexTypeKeys.ListElementCode
  question.message ||= QUESTION_LIST_ELEMENT_CODE

  // This is a BIG WIP right now, we're just going to use englandwales for look ups
  const caseField = getConfigSheetsFromFlexRegion(answers[FLEX_REGION_ANSWERS_KEY] as Region[]).CaseField.find(o => o.ID === answers[EventToComplexTypeKeys.CaseFieldID])

  if (!caseField) {
    return await askEventToComplexTypeListElementCodeFallback(answers, question.name)
  }

  const opts = getKnownETComplexTypeListElementCodes(caseField.FieldType === 'Collection' ? caseField.FieldTypeParameter : caseField.FieldType, answers[FLEX_REGION_ANSWERS_KEY] as Region[])

  answers = await prompt([
    {
      ...question,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[question.name] === CUSTOM) {
    return await askEventToComplexTypeListElementCodeFallback(answers, question.name)
  }

  return answers
}

// TODO: Update this to take in a Question object as a parameter
export async function askFlexRegion(answers?: Answers, question: Question = {}) {
  question.name ||= FLEX_REGION_ANSWERS_KEY
  question.message ||= QUESTION_REGION
  question.choices ||= REGION_OPTS
  question.default ||= answers?.[FLEX_REGION_ANSWERS_KEY] || session.lastAnswers?.[FLEX_REGION_ANSWERS_KEY] || REGION_OPTS

  return await prompt([
    {
      ...question,
      type: 'checkbox',
      askAnswered: true,
      pageSize: getIdealSizeForInquirer()
    }
  ], answers || {})
}

export function getFlexRegionFromAnswers(answers: Answers) {
  return answers[FLEX_REGION_ANSWERS_KEY] as Region[]
}

/** Adds flexRegion to the ccd object and clones to the other region if required. Returns an array of 1 or 2 objects */
export function addFlexRegionAndClone<T extends ETFlexExtensions>(flexRegions: Region[], ccdType: T) {
  ccdType.flexRegion = flexRegions[0] || Region.EnglandWales

  if (flexRegions.length < 2) {
    return [ccdType]
  }

  const clone = JSON.parse(JSON.stringify(ccdType))
  ccdType.flexRegion = flexRegions[1]

  return [ccdType, clone]
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
