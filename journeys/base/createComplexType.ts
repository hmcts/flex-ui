import { prompt } from 'inquirer'
import { ComplexType, ComplexTypeKeys } from 'types/ccd'
import { QUESTION_HINT_TEXT } from './createSingleField'
import { createNewComplexType, trimCcdObject } from 'app/ccd'
import { addAutoCompleteQuestion, addComplexTypeListElementCodeQuestion, addFieldTypeParameterQuestion, addFieldTypeQuestion, addMaxQuestion, addMinQuestion, addNonProdFeatureQuestions, addRegularExpressionQuestion, Answers, Question, spliceCustomQuestionIndex } from 'app/questions'
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

function findExisting(answers: Answers) {
  return findObject<ComplexType>(answers, 'ComplexTypes')
}

export function addComplexTypeQuestions(existingFn: (answers: Answers) => ComplexType = findExisting) {
  const defaultFn = (key: keyof (Answers), or?: string | number | ((answers: Answers) => string | number)) => {
    return (answers: Answers) => {
      const orResult = typeof (or) === 'function' ? (or as any)(answers) : or
      return existingFn(answers)?.[key] || orResult
    }
  }

  return [
    ...addAutoCompleteQuestion({
      name: ComplexTypeKeys.ID,
      message: QUESTION_ID,
      choices: [CUSTOM, ...getKnownComplexTypeIDs()],
      default: session.lastAnswers[ComplexTypeKeys.ID]
    }),
    ...addComplexTypeListElementCodeQuestion(),
    { name: ComplexTypeKeys.ElementLabel, message: QUESTION_ELEMENT_LABEL, validate: (input: string) => input.length > 0, default: defaultFn('ElementLabel', ' ') },
    { name: ComplexTypeKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, default: defaultFn('FieldShowCondition') },
    { name: ComplexTypeKeys.DisplayOrder, message: QUESTION_DISPLAY_ORDER, type: 'number', default: defaultFn('DisplayOrder') },
    { name: ComplexTypeKeys.DisplayContextParameter, message: QUESTION_DISPLAY_CONTEXT_PARAMETER, default: defaultFn('DisplayContextParameter') },
    { name: ComplexTypeKeys.HintText, message: QUESTION_HINT_TEXT, default: defaultFn('HintText') },
    ...addFieldTypeQuestion({ default: defaultFn('FieldType') }),
    ...addFieldTypeParameterQuestion({ default: defaultFn('FieldTypeParameter') }),
    ...addRegularExpressionQuestion({ default: defaultFn('RegularExpression') }),
    ...addMinQuestion({ default: defaultFn('Min') }),
    ...addMaxQuestion({ default: defaultFn('Max') }),
    ...addNonProdFeatureQuestions('ComplexTypes'),
  ] as Question[]
}

export async function createComplexType(answers: Answers = {}, questions: Question[] = []) {
  const ask = addComplexTypeQuestions()
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
