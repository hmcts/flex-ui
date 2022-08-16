import { prompt } from "inquirer"
import { addToLastAnswers, session } from "app/session"
import { CaseEventKeys, CaseEventToFieldKeys, CaseFieldKeys } from "types/ccd"
import { Answers, askBasicFreeEntry, askCaseTypeID, fuzzySearch } from "app/questions"
import { CUSTOM, DISPLAY_CONTEXT_OPTIONS, FIELD_TYPES_EXCLUDE_MIN_MAX, FIELD_TYPES_EXCLUDE_PARAMETER, NONE, Y_OR_N } from "app/constants"
import { addToInMemoryConfig, createCaseFieldAuthorisations, getCaseEventIDOpts, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes, getNextPageFieldIDForPage } from "app/et/configs"
import { addOnDuplicateQuestion } from "./manageDuplicateField"
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from "app/ccd"
import { createScrubbed } from "./createScrubbed"
import { createEvent } from "./createEvent"
import { format, getIdealSizeForInquirer } from "app/helpers"
import { Journey } from "types/journey"
import { doDuplicateCaseField } from "app/et/duplicateCaseField"

export const QUESTION_ID = `What's the ID for this field?`
const QUESTION_LABEL = 'What text (Label) should this field have?'
const QUESTION_PAGE_ID = `What page will this field appear on?`
const QUESTION_PAGE_FIELD_DISPLAY_ORDER = `Whats the PageFieldDisplayOrder for this field?`
export const QUESTION_FIELD_SHOW_CONDITION = 'Enter a field show condition string (optional)'
const QUESTION_CASE_EVENT_ID = `What event does this new field belong to?`
const QUESTION_FIELD_TYPE_PARAMETER = "What's the parameter for this {0} field?"
const QUESTION_FIELD_TYPE = "What's the type of this field?"
const QUESTION_FIELD_TYPE_CUSTOM = "What's the name of the FieldType?"
const QUESTION_HINT_TEXT = 'What HintText should this field have? (optional)'
const QUESTION_DISPLAY_CONTEXT = 'Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX?'
const QUESTION_SHOW_SUMMARY_CHANGE_OPTION = 'Should this field appear on the CYA page?'
const QUESTION_MIN = 'Enter a min for this field (optional)'
const QUESTION_MAX = 'Enter a max for this field (optional)'
const QUESTION_PAGE_LABEL = 'Does this page have a custom title? (optional)'
const QUESTION_PAGE_SHOW_CONDITION = 'Enter a page show condition string (optional)'
const QUESTION_CALLBACK_URL_MID_EVENT = 'Enter the callback url to hit before loading the next page (optional)'
const QUESTION_REGULAR_EXPRESSION = "Do we need a RegularExpression for the field?"

export async function createSingleField(answers: Answers = {}) {
  answers = await askBasic(answers)

  answers = await askForPageIDAndDisplayOrder(answers)

  answers = await askFieldType(answers)

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_PARAMETER)) {
    answers = await askFieldTypeParameter(answers)
  }

  if (answers[CaseFieldKeys.FieldType] !== "Label") {
    answers = await askNonLabelQuestions(answers)
  }

  if (answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1) {
    answers = await askFirstOnPageQuestions(answers)
  }

  if (answers[CaseFieldKeys.FieldType] === "Text") {
    answers = await askForRegularExpression(answers)
  }

  if (!isFieldTypeInExclusionList(answers[CaseFieldKeys.FieldType], FIELD_TYPES_EXCLUDE_MIN_MAX)) {
    answers = await askMinAndMax(answers)
  }

  addToLastAnswers(answers)

  const caseField = createNewCaseField(answers)
  const caseEventToField = createNewCaseEventToField(answers)
  const authorisations = createCaseFieldAuthorisations(answers.CaseTypeID, answers.ID)

  addToInMemoryConfig({
    AuthorisationCaseField: authorisations,
    CaseField: [trimCaseField(caseField)],
    CaseEventToFields: [trimCaseEventToField(caseEventToField)]
  })

  doDuplicateCaseField(answers.CaseTypeID, answers.ID, answers.CaseTypeID)
  await addOnDuplicateQuestion(answers as { CaseTypeID: string, ID: string })

  return answers.ID
}

/**
 * Checks if a given field type is in the exclusion list provided
 */
function isFieldTypeInExclusionList(fieldType: string, exclusionList: string[]) {
  return exclusionList.includes(fieldType)
}

export function getDefaultForPageFieldDisplayOrder(answers: Answers = {}) {
  const pageID = CaseEventToFieldKeys.PageID
  if (answers[pageID] && answers[CaseEventToFieldKeys.CaseEventID] && answers[CaseEventToFieldKeys.CaseTypeID]) {
    return getNextPageFieldIDForPage(
      answers[CaseEventToFieldKeys.CaseTypeID],
      answers[CaseEventToFieldKeys.CaseEventID],
      answers[pageID]
    )
  }
  if (answers[pageID] === session.lastAnswers[pageID] && session.lastAnswers[pageID]) {
    return session.lastAnswers[CaseEventToFieldKeys.PageFieldDisplayOrder] + 1
  }
  return 1
}

async function askBasic(answers: Answers = {}) {
  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers)

  return prompt(
    [
      { name: CaseFieldKeys.ID, message: QUESTION_ID, type: 'input', default: 'id' },
      { name: CaseFieldKeys.Label, message: QUESTION_LABEL, type: 'input', default: 'text' },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, type: 'input' },
    ], answers
  )
}

export async function askForPageIDAndDisplayOrder(answers: Answers = {}) {
  answers = await prompt([{
    name: CaseEventToFieldKeys.PageID,
    message: QUESTION_PAGE_ID,
    type: 'number',
    default: session.lastAnswers.PageID || 1
  }], answers)

  return prompt([{
    name: CaseEventToFieldKeys.PageFieldDisplayOrder,
    message: QUESTION_PAGE_FIELD_DISPLAY_ORDER,
    type: 'number',
    default: getDefaultForPageFieldDisplayOrder(answers)
  }], answers)
}

export async function askCaseEvent(answers: Answers = {}, message?: string) {
  const opts = getCaseEventIDOpts()
  const key = CaseEventToFieldKeys.CaseEventID
  answers = await prompt([
    {
      name: key,
      message: message || QUESTION_CASE_EVENT_ID,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CUSTOM, ...opts], input),
      default: session.lastAnswers[key],
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    answers[key] = await createEvent({ CaseTypeID: answers[CaseEventKeys.CaseTypeID] })
  }

  return answers
}

async function askFieldTypeParameter(answers: Answers = {}) {
  const opts = getKnownCaseFieldTypeParameters()
  const key = CaseFieldKeys.FieldTypeParameter
  answers = await prompt([
    {
      name: key,
      message: format(QUESTION_FIELD_TYPE_PARAMETER, answers[CaseFieldKeys.FieldType]),
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([NONE, CUSTOM, ...opts], input),
      pageSize: getIdealSizeForInquirer()
    }
  ], answers)

  if (answers[key] === NONE) {
    answers[key] = ''
  } else if (answers[key] === CUSTOM) {
    delete answers[key]
    answers[key] = await createScrubbed({})
  }

  return answers
}


async function askFieldType(answers: Answers = {}) {
  const opts = getKnownCaseFieldTypes()
  const key = CaseFieldKeys.FieldType
  answers = await prompt([
    {
      name: key,
      message: QUESTION_FIELD_TYPE,
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

async function askNonLabelQuestions(answers: Answers = {}) {
  return prompt([
    { name: CaseFieldKeys.HintText, message: QUESTION_HINT_TEXT, type: 'input' },
    { name: CaseEventToFieldKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: DISPLAY_CONTEXT_OPTIONS[1] },
    { name: CaseEventToFieldKeys.ShowSummaryChangeOption, message: QUESTION_SHOW_SUMMARY_CHANGE_OPTION, type: 'list', choices: Y_OR_N, default: 'Y' },
  ], answers)
}

export async function askMinAndMax(answers: Answers = {}) {
  return prompt([
    { name: CaseFieldKeys.Min, message: QUESTION_MIN, },
    { name: CaseFieldKeys.Max, message: QUESTION_MAX, },
  ], answers)
}

export async function askFirstOnPageQuestions(answers: Answers = {}) {
  return prompt([
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, type: 'input' },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, type: 'input' },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, type: 'input' }
  ], answers)
}

async function askForRegularExpression(answers: Answers = {}) {
  return prompt([
    { name: CaseFieldKeys.RegularExpression, message: QUESTION_REGULAR_EXPRESSION, type: 'input' }
  ], answers)
}

export default {
  group: 'et-create',
  text: 'Create a single field',
  fn: createSingleField
} as Journey