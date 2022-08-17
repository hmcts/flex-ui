import { prompt } from 'inquirer'
import { CUSTOM } from 'app/constants'
import { session } from 'app/session'
import fuzzy from 'fuzzy'
import { AllCCDKeys, CaseFieldKeys } from 'types/ccd'
import { getKnownCaseTypeIDs } from 'app/et/configs'
import { getIdealSizeForInquirer } from 'app/helpers'

export type Answers = AllCCDKeys & Record<string, unknown>

/**
 * Asks the user for a CaseTypeID. Allows for creation if <custom> is selected.
 * @returns extended answers object as passed in
 */
export async function askCaseTypeID(answers: Answers = {}) {
  const opts = getKnownCaseTypeIDs()
  const key = CaseFieldKeys.CaseTypeID

  answers = await prompt([
    {
      name: key,
      message: 'Select the CaseTypeID',
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: session.lastAnswers[key],
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    const newEventTypeAnswers = await askBasicFreeEntry({}, key, 'Enter a custom value for CaseTypeID')
    answers[key] = newEventTypeAnswers[key]
    // TODO: There's no support for CaseType.json yet so theres no flow to create one. But we could...
  }

  return answers
}

/**
 * Asks for generic input selecting from a list
 * @returns extended answers object as passed in
 */
async function list(answers: Answers = {}, name: string, message: string, choices: string[], defaultValue?: unknown) {
  return await prompt([{ name, message, type: 'list', choices, default: defaultValue, pageSize: getIdealSizeForInquirer() }], answers)
}

/**
 * Asks for generic input select from a list AND allowing free typing
 * @returns extended answers object as passed in
 */
export async function listOrFreeType(answers: Answers = {}, name: string, message: string, choices: string[], defaultValue?: unknown) {
  answers = await list(answers, name, message, [CUSTOM, ...choices], defaultValue)

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
  return await prompt([{ name, message: message || `What's the ${name}?`, default: defaultValue || session.lastAnswers[name] }], answers || {})
}

/**
 * Generic fuzzy search for use with autocomplete questions
 * @param choices list of options
 * @param input their current input from terminal
 * @returns a list of suggestions that match the input text
 */
export function fuzzySearch(choices: string[], input = '') {
  return fuzzy.filter(input, [...choices].sort()).map((el) => el.original)
}
