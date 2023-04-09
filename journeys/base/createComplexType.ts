import { prompt } from 'inquirer'
import { ComplexType, ComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewComplexType, trimCcdObject } from 'app/ccd'
import { addAutoCompleteQuestion, addComplexTypeListElementCodeQuestion, addFieldTypeParameterQuestion, addFieldTypeQuestion, addMaxQuestion, addMinQuestion, addRegularExpressionQuestion, Answers, Question, spliceCustomQuestionIndex } from 'app/questions'
import { CUSTOM } from 'app/constants'
import { addToLastAnswers, addToSession, session } from 'app/session'
import { Journey } from 'types/journey'
import { upsertFields } from 'app/helpers'
import { findObject, getKnownComplexTypeIDs, upsertConfigs } from 'app/configs'

export const QUESTION_ID = "What's the ID of this ComplexType?"
const QUESTION_ELEMENT_LABEL = 'What\'s the custom label for this control?'
const QUESTION_DISPLAY_ORDER = 'What\'s the DisplayOrder for this? (use 0 to leave blank)'
const QUESTION_DISPLAY_CONTEXT_PARAMETER = 'What\'s the DisplayContextParameter for this?'
const QUESTION_FIELD_SHOW_CONDITION = 'Enter a FieldShowCondition (optional)'

async function journey(answers: Answers = {}) {
  const created = await createComplexType(answers)
  addToSession(created)
  upsertConfigs(created)
}

export function addComplexTypeQuestions(existing?: ComplexType) {
  const questions: Question[] = [
    { name: ComplexTypeKeys.ElementLabel, message: QUESTION_ELEMENT_LABEL, default: existing?.ElementLabel, validate: (input: string) => input.length > 0 },
    { name: ComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION },
    { name: ComplexTypeKeys.DisplayOrder, message: QUESTION_DISPLAY_ORDER, type: 'number' },
    { name: ComplexTypeKeys.DisplayContextParameter, message: QUESTION_DISPLAY_CONTEXT_PARAMETER },
    { name: ComplexTypeKeys.HintText, message: QUESTION_HINT_TEXT },
    ...addFieldTypeQuestion(),
    ...addFieldTypeParameterQuestion(),
    ...addRegularExpressionQuestion(),
    ...addMinQuestion(),
    ...addMaxQuestion()
  ]

  questions.forEach(o => {
    o.default = existing?.[o.name]
  })

  return questions
}

export async function createComplexType(answers: Answers = {}, questions: Question[] = []) {
  answers = await prompt([
    ...addAutoCompleteQuestion({ name: ComplexTypeKeys.ID, message: QUESTION_ID, choices: [CUSTOM, ...getKnownComplexTypeIDs()], default: session.lastAnswers[ComplexTypeKeys.ID] }),
    ...addComplexTypeListElementCodeQuestion()
  ], answers)

  const existing = findObject<ComplexType>(answers, 'ComplexTypes')

  const ask = addComplexTypeQuestions(existing)
  upsertFields(ask, questions, ['name'], spliceCustomQuestionIndex)

  answers = await prompt(ask, answers)

  addToLastAnswers(answers)
  const complexType = createNewComplexType(answers)

  return {
    ComplexTypes: [trimCcdObject(complexType)]
  }
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a ComplexType',
  fn: journey,
  alias: 'UpsertComplexType'
} as Journey
