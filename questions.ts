import { prompt } from 'inquirer'
import { CUSTOM, YES_OR_NO } from 'app/constants'
import { session } from 'app/session'
import fuzzy from 'fuzzy'
import { AllCCDKeys, CaseEventToFieldKeys, CaseField, CaseFieldKeys, ComplexType } from 'types/ccd'
import { getIdealSizeForInquirer } from 'app/helpers'

const QUESTION_REGULAR_EXPRESSION = 'Do we need a RegularExpression for the field?'
export const QUESTION_RETAIN_HIDDEN_VALUE = 'Should the field retain its value when hidden?'
const QUESTION_MIN = 'Enter a min for this field (optional)'
const QUESTION_MAX = 'Enter a max for this field (optional)'
const QUESTION_PAGE_ID = 'What page will this appear on?'
const QUESTION_PAGE_FIELD_DISPLAY_ORDER = 'Whats the PageFieldDisplayOrder for this?'

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
