import { prompt } from "inquirer";
import { addToLastAnswers, findPreviousSessions, restorePreviousSession, session } from "app/session";
import { CaseEventKeys, CaseEventToFieldKeys, CaseFieldKeys, Journey } from "types/types";
import { askBasicFreeEntry, listOrFreeType, requestCaseTypeID } from "app/questions";
import { CASE_FIELD_TYPES, DISPLAY_CONTEXT_OPTIONS, FIELD_TYPES_NEED_PARAMETER, FIELD_TYPES_NEED_SCRUBBED, FIELD_TYPES_NO_PARAMETER, NO, YES, YES_OR_NO } from "app/constants";
import fuzzy from "fuzzy"
import { addToInMemoryConfig, getCaseEventIDOpts, getKnownCaseFieldTypeParameters, getKnownCaseFieldTypes } from "app/et/configs";
import { addOnDuplicateQuestion } from "./manageDuplicateField";
import { createAuthorisationCaseFields, createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from "app/objects";
import { createScrubbed } from "./createScrubbed";
import { createEvent } from "./createEvent";

const NONE = '<none>'
const CUSTOM = '<custom>'

async function createSingleField() {
  let answers = await askBasic({})

  answers = await askFieldType(answers)

  if (!FIELD_TYPES_NO_PARAMETER.includes(answers[CaseFieldKeys.FieldType])) {
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

  addToLastAnswers(answers)

  const caseField = createNewCaseField(answers)
  const caseEventToField = createNewCaseEventToField(answers)
  const authorisations = createAuthorisationCaseFields(answers.CaseTypeID, answers.ID)

  addToInMemoryConfig({
    AuthorisationCaseField: authorisations,
    CaseField: [trimCaseField(caseField)],
    CaseEventToFields: [trimCaseEventToField(caseEventToField)]
  })

  await addOnDuplicateQuestion(answers as { CaseTypeID: string, ID: string })
}

async function askBasic(answers: any = {}) {
  return prompt(
    [
      { name: CaseFieldKeys.ID, message: `What's the ID for this field?`, type: 'input' },
      { name: CaseFieldKeys.Label, message: 'What text (Label) should this field have?', type: 'input' },
      { name: CaseEventToFieldKeys.PageID, message: `What page will this field appear on?`, type: 'number', default: session.lastAnswers.PageID || 1 },
      { name: CaseEventToFieldKeys.PageFieldDisplayOrder, message: `Whats the PageFieldDisplayOrder for this field?`, type: 'number', default: session.lastAnswers.PageFieldDisplayOrder + 1 || 1 },
      { name: CaseEventToFieldKeys.FieldShowCondition, message: 'Enter a field show condition string (optional)', type: 'input' }
    ],
    {
      ...answers,
      ... await requestCaseTypeID(),
      ... await askCaseEvent()
    })
}

export async function askCaseEvent(answers: any = {}) {
  const opts = Object.keys(getCaseEventIDOpts())
  const key = CaseEventToFieldKeys.CaseEventID
  answers = await prompt([
    {
      name: key,
      message: `What event does this new field belong to?`,
      type: 'autocomplete',
      source: (_answers: any, input: string) => fuzzySearch([CUSTOM, ...opts], input)
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    answers = {
      ...answers,
      ...await askBasicFreeEntry(key, "What's the name of the Event?")
    }
    await createEvent(answers[key])
  }

  return answers
}

async function askFieldTypeParameter(answers: any = {}) {
  const opts = Object.keys(getKnownCaseFieldTypeParameters())
  const key = CaseFieldKeys.FieldTypeParameter
  answers = await prompt([
    {
      name: key,
      message: `What's the parameter for this ${answers[CaseFieldKeys.FieldType]} field?`,
      type: 'autocomplete',
      source: (_answers: any, input: string) => fuzzySearch([NONE, CUSTOM, ...opts], input)
    }
  ], answers)

  if (answers[key] === NONE) {
    answers[key] = ''
  } else if (answers[key] === CUSTOM) {
    answers = {
      ...answers,
      ...await askBasicFreeEntry(key, "What's the name of the FieldTypeParameter?")
    }
    await createScrubbed(answers[key])
  }

  return answers
}

async function askFieldType(answers: any = {}) {
  const opts = Object.keys(getKnownCaseFieldTypes())
  const key = CaseFieldKeys.FieldType
  answers = await prompt([
    {
      name: key,
      message: "What's the type of this field?",
      type: 'autocomplete',
      source: (_answers: any, input: string) => fuzzySearch([CUSTOM, ...opts], input)
    }
  ], answers)

  if (answers[key] === CUSTOM) {
    answers = {
      ...answers,
      ...await askBasicFreeEntry(key, "What's the name of the FieldType?")
    }
  }

  return answers
}

function fuzzySearch(choices: string[], input = '') {
  return fuzzy.filter(input, choices.sort()).map((el) => el.original)
}

async function askNonLabelQuestions(answers: any = {}) {
  return prompt([
    { name: CaseFieldKeys.HintText, message: 'What HintText should this field have? (optional)', type: 'input' },
    { name: CaseEventToFieldKeys.DisplayContext, message: 'Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX?', type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: DISPLAY_CONTEXT_OPTIONS[1] },
    { name: CaseEventToFieldKeys.ShowSummaryChangeOption, message: 'Should this field appear on the CYA page?', type: 'list', choices: ['Y', 'N'], default: 'Y' },
    { name: CaseFieldKeys.Min, message: 'Enter a min for this field (optional)', },
    { name: CaseFieldKeys.Max, message: 'Enter a max for this field (optional)', },
  ], {
    ...answers
  })
}

export async function askFirstOnPageQuestions(answers: any = {}) {
  return prompt([
    { name: CaseEventToFieldKeys.PageLabel, message: 'Does this page have a custom title? (optional)', type: 'input' },
    { name: CaseEventToFieldKeys.PageShowCondition, message: 'Enter a page show condition string (optional)', type: 'input' },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: 'Enter the callback url to hit before loading the next page (optional)', type: 'input' }
  ], {
    ...answers
  })
}

async function askForRegularExpression(answers: any = {}) {
  return prompt([
    { name: CaseFieldKeys.RegularExpression, message: "Do we need a RegularExpression for the field?", type: 'input' }
  ], {
    ...answers
  })
}

export default {
  group: 'et-create',
  text: 'Create a single field',
  fn: createSingleField
} as Journey