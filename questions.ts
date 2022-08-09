import { prompt } from "inquirer"
import { CASE_FIELD_TYPES, DISPLAY_CONTEXT_OPTIONS, NO, YES } from "./constants"
import { session } from "./session"
import fuzzy from "fuzzy"
import { CaseFieldKeys } from "./types/types"

export async function requestCaseTypeID(message: string = "What's the CaseTypeID?") {
  const choices = ['ET_EnglandWales', 'ET_Scotland']
  return listOrFreeType("CaseTypeID", message, choices, choices[0])
}

export async function requestCaseFieldType() {
  return listOrFreeType("FieldType", "What field type should this be?", CASE_FIELD_TYPES, CASE_FIELD_TYPES[0])
}

export async function requestCaseEventID() {
  return askBasicFreeEntry('CaseEventID')
}

export async function askYesNo(name: string, message: string) {
  return list(name, message, [YES, NO])
}

export async function askToDuplicate() {
  let answers = await askYesNo('duplicate', '?')

  if (answers.duplicate === NO) {
    return answers
  }

  return requestCaseTypeID()
}

async function list(name: string, message: string, choices: string[], defaultValue?: any) {
  return prompt(
    [
      { name, message, type: 'list', choices, default: defaultValue }
    ]
  )
}

export async function listOrFreeType(name: string, message: string, choices: string[], defaultValue?: any) {
  const OTHER = "Other..."

  let answers = await prompt(
    [
      { name, message, type: 'list', choices: [OTHER, ...choices], default: defaultValue }
    ]
  )

  if (answers[name] !== OTHER) {
    return answers
  }

  return prompt(
    [
      { name, message: `Enter a custom value for ${name}` },
    ]
  )
}

export async function askBasicFreeEntry(name: string, message?: string, defaultValue?: any) {
  return prompt([{ name, message: message || `What's the ${name}?`, default: defaultValue || session.lastAnswers[name] }])
}