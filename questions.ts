import { prompt } from "inquirer"
import { CUSTOM } from "app/constants"
import { session } from "app/session"
import fuzzy from "fuzzy"
import { CaseFieldKeys } from "types/types"
import { getKnownCaseTypeIds } from "app/et/configs"
import { getIdealSizeForInquirer } from "./helpers"

/**
 * Asks the user for a CaseTypeID. Allows for creation if <custom> is selected.
 * @returns extended answers object as passed in
 */
export async function askCaseTypeID(answers: any = {}) {
  const opts = getKnownCaseTypeIds()
  const key = CaseFieldKeys.CaseTypeID

  answers = await prompt([
    {
      name: key,
      message: "Select the CaseTypeID",
      type: 'autocomplete',
      source: (_answers: any, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: session.lastAnswers[key],
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    answers = await askBasicFreeEntry({}, key, "Enter a custom value for CaseTypeID")
    //TODO: There's no support for CaseType.json yet so theres no flow to create one. But we could...
  }

  return answers
}

/**
 * Asks for generic input selecting from a list
 * @returns extended answers object as passed in
 */
async function list(answers: any, name: string, message: string, choices: string[], defaultValue?: any) {
  return prompt([{ name, message, type: 'list', choices, default: defaultValue, pageSize: getIdealSizeForInquirer() }], answers)
}

/**
 * Asks for generic input select from a list AND allowing free typing
 * @returns extended answers object as passed in
 */
export async function listOrFreeType(answers: any, name: string, message: string, choices: string[], defaultValue?: any) {
  answers = await list(answers, name, message, [CUSTOM, ...choices], defaultValue)

  if (answers[name] !== CUSTOM) {
    return answers
  }

  // We need this to reset the value of <custom> so the user can provide an actual value
  delete answers[name]
  return prompt([{ name, message: `Enter a custom value` }], answers)
}


/**
 * Asks for basic text entry given a question
 * @returns extended answers object as passed in
 */
export async function askBasicFreeEntry(answers: any, name: string, message?: string, defaultValue?: any) {
  return prompt([{ name, message: message || `What's the ${name}?`, default: defaultValue || session.lastAnswers[name] }], answers || {})
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