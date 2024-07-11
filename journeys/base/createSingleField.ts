import { prompt } from 'inquirer'
import { addToLastAnswers, addToSession, session } from 'app/session'
import { CaseEventToField, CaseEventToFieldKeys, CaseField, CaseFieldKeys, ScrubbedKeys } from 'types/ccd'
import { addAutoCompleteQuestion, addCaseEvent, addCaseTypeIDQuestion, addDuplicateToCaseTypeID, addFieldTypeParameterQuestion, addFieldTypeQuestion, addMaxQuestion, addMinQuestion, addNonProdFeatureQuestions, addPageFieldDisplayOrderQuestion, addPageIDQuestion, addRegularExpressionQuestion, addRetainHiddenValueQuestion, Answers, createJourneys, FIELD_TYPE_PARAMETERS_CUSTOM_OPTS, Question, QUESTION_CALLBACK_URL_MID_EVENT, QUESTION_PAGE_LABEL, QUESTION_PAGE_SHOW_CONDITION, spliceCustomQuestionIndex } from 'app/questions'
import { CUSTOM, DISPLAY_CONTEXT_OPTIONS, NONE, YES, Y_OR_N } from 'app/constants'
import { createNewCaseEventToField, createNewCaseField, trimCaseEventToField, trimCaseField } from 'app/ccd'
import { Journey } from 'types/journey'
import { duplicateForCaseTypeIDs, findObject, getKnownCaseFieldIDsByEvent, getNextPageFieldIDForPage, upsertConfigs } from 'app/configs'
import { upsertFields } from 'app/helpers'

export const QUESTION_ID = 'What\'s the ID for this field?'
export const QUESTION_ANOTHER = 'Do you want to upsert another?'
export const QUESTION_FIELD_SHOW_CONDITION = 'Enter a field show condition string (optional)'
export const QUESTION_HINT_TEXT = 'What HintText should this field have? (optional)'

const QUESTION_LABEL = 'What text (Label) should this field have?'
const QUESTION_DISPLAY_CONTEXT = 'Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX?'
const QUESTION_SHOW_SUMMARY_CHANGE_OPTION = 'Should this field appear on the CYA page?'

async function journey(answers: Answers = {}) {
  const created = await createSingleField(answers)
  addToSession(created)
  upsertConfigs(created)
}

function findExistingFields(answers: Answers) {
  const existingField: CaseField | undefined = findObject<CaseField>(answers, 'CaseField')
  const existingCaseEventToField: CaseEventToField | undefined = findObject<CaseEventToField>({ ...answers, CaseFieldID: answers.ID }, 'CaseEventToFields')

  return { ...existingField, ...existingCaseEventToField }
}

function addSingleFieldQuestions(existingFn: (answers: Answers) => CaseField & CaseEventToField = findExistingFields) {
  const whenFirstOnPage = (answers: Answers) => answers[CaseEventToFieldKeys.CaseEventID] !== NONE && answers[CaseEventToFieldKeys.PageFieldDisplayOrder] === 1

  const defaultFn = (key: keyof (Answers), or?: string | number | ((answers: Answers) => string | number)) => {
    return (answers: Answers) => {
      const orResult = typeof (or) === 'function' ? (or as any)(answers) : or
      return existingFn(answers)?.[key] || orResult
    }
  }

  return [
    ...addCaseTypeIDQuestion(),
    ...addCaseEvent(),
    ...addAutoCompleteQuestion(
      {
        name: CaseFieldKeys.ID,
        message: QUESTION_ID,
        default: CUSTOM,
        choices: ((answers: Answers) => [CUSTOM, ...getKnownCaseFieldIDsByEvent(answers[CaseEventToFieldKeys.CaseEventID])]) as any,
        askAnswered: false,
        sort: true
      }
    ),
    ...addPageIDQuestion({ default: defaultFn('PageID', 1) }),
    ...addPageFieldDisplayOrderQuestion({ default: defaultFn('PageFieldDisplayOrder', (answers: Answers) => getDefaultForPageFieldDisplayOrder(answers)) }),
    ...addFieldTypeQuestion({ default: defaultFn('FieldType', 'Label') }),
    ...addFieldTypeParameterQuestion({ default: defaultFn('FieldTypeParameter') }),
    { name: CaseFieldKeys.Label, message: QUESTION_LABEL, type: 'input', default: defaultFn('Label', 'text') },
    { name: CaseEventToFieldKeys.FieldShowCondition, message: QUESTION_FIELD_SHOW_CONDITION, when: shouldAskEventQuestions, default: defaultFn('FieldShowCondition') },
    { name: CaseFieldKeys.HintText, message: QUESTION_HINT_TEXT, default: defaultFn('HintText') },
    { name: CaseEventToFieldKeys.DisplayContext, message: QUESTION_DISPLAY_CONTEXT, type: 'list', choices: DISPLAY_CONTEXT_OPTIONS, default: defaultFn('DisplayContext', DISPLAY_CONTEXT_OPTIONS[1]) },
    { name: CaseEventToFieldKeys.ShowSummaryChangeOption, message: QUESTION_SHOW_SUMMARY_CHANGE_OPTION, type: 'list', choices: Y_OR_N, default: defaultFn('ShowSummaryChangeOption'), when: shouldAskEventQuestions },
    { name: CaseEventToFieldKeys.PageLabel, message: QUESTION_PAGE_LABEL, when: whenFirstOnPage, default: defaultFn('PageLabel') },
    { name: CaseEventToFieldKeys.PageShowCondition, message: QUESTION_PAGE_SHOW_CONDITION, when: whenFirstOnPage, default: defaultFn('PageShowCondition') },
    { name: CaseEventToFieldKeys.CallBackURLMidEvent, message: QUESTION_CALLBACK_URL_MID_EVENT, when: whenFirstOnPage, default: defaultFn('CallBackURLMidEvent') },
    ...addRegularExpressionQuestion({ default: defaultFn('RegularExpression') }),
    ...addMinQuestion({ default: defaultFn('Min') }),
    ...addMaxQuestion({ default: defaultFn('Max') }),
    ...addRetainHiddenValueQuestion({ default: defaultFn('RetainHiddenValue') }),
    ...addNonProdFeatureQuestions('CaseField'),
    ...addDuplicateToCaseTypeID()
  ]
}

function shouldAskEventQuestions(answers: Answers) {
  return answers[CaseEventToFieldKeys.CaseEventID] !== NONE
}

export async function createSingleField(answers: Answers = {}, questions: Question[] = []) {
  const ask = addSingleFieldQuestions()
  upsertFields(ask, questions, ['name'], spliceCustomQuestionIndex)

  answers = await prompt(ask, answers)

  const configs = constructFromAnswers(answers)

  if (answers.createEvent === YES) {
    await createJourneys.createEvent({ ID: answers.CaseEventID, CaseTypeID: answers.CaseTypeID, duplicate: answers.duplicate, ext: answers.ext, feature: answers.feature })
  }

  if (answers.fieldTypeParameterJourney === FIELD_TYPE_PARAMETERS_CUSTOM_OPTS.ScrubbedList) {
    await createJourneys.createScrubbed({ [ScrubbedKeys.ID]: answers.FieldTypeParameter, ext: answers.ext, feature: answers.feature })
  }

  addToLastAnswers(answers)

  return configs
}

function getDefaultForPageFieldDisplayOrder(answers: Answers = {}) {
  const pageID = CaseEventToFieldKeys.PageID
  const pageFieldDisplayOrder = CaseEventToFieldKeys.PageFieldDisplayOrder
  if (answers[pageID] && answers[CaseEventToFieldKeys.CaseEventID] && answers[CaseEventToFieldKeys.CaseTypeID]) {
    return getNextPageFieldIDForPage(
      answers[CaseEventToFieldKeys.CaseTypeID],
      answers[CaseEventToFieldKeys.CaseEventID],
      answers[pageID]
    )
  }
  if (session.lastAnswers[pageID] && session.lastAnswers[pageFieldDisplayOrder] && answers[pageID] === session.lastAnswers[pageID]) {
    return session.lastAnswers[pageFieldDisplayOrder] + 1
  }
  return 1
}

export function constructFromAnswers(answers: Answers) {
  const createFn = (answers: Answers) => {
    const askEvent = answers[CaseEventToFieldKeys.CaseEventID] !== NONE
    const caseField = createNewCaseField(answers)
    const caseEventToField = askEvent ? createNewCaseEventToField(answers) : undefined

    return {
      CaseField: [trimCaseField(caseField)],
      CaseEventToFields: askEvent ? [trimCaseEventToField(caseEventToField)] : []
    }
  }

  return duplicateForCaseTypeIDs(answers, createFn)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a single field',
  fn: journey,
  alias: 'UpsertCaseField'
} as Journey
