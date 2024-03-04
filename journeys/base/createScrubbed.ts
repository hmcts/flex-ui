import { getKnownScrubbedLists, sheets, upsertConfigs } from 'app/configs'
import { COMPOUND_KEYS, CUSTOM, NO, YES } from 'app/constants'
import { upsertFields } from 'app/helpers'
import { addAutoCompleteQuestion, addNonProdFeatureQuestions, Answers, askYesOrNo, Question } from 'app/questions'
import { addToSession } from 'app/session'
import { prompt } from 'inquirer'
import { ConfigSheets, Scrubbed, ScrubbedKeys } from 'types/ccd'
import { Journey } from 'types/journey'

export const QUESTION_ID = "What's the name of the Scrubbed list?"
const QUESTION_LIST_ELEMENT = 'What should be displayed to the user when selecting this option?'
const QUESTION_LIST_ELEMENT_CODE = 'Give a ListElementCode for this item'
const QUESTION_DISPLAY_ORDER = 'Whats the DisplayOrder for this item?'
export const QUESTION_ADD_ANOTHER = 'Add another?'

export async function createScrubbedList(answers: Answers = {}) {
  answers = { ...answers, yesOrNo: YES }
  const created: Partial<ConfigSheets> = { Scrubbed: [] }

  answers = await prompt(addAutoCompleteQuestion({
    name: ScrubbedKeys.ID,
    message: QUESTION_ID,
    default: CUSTOM,
    choices: [CUSTOM, ...getKnownScrubbedLists()],
    askAnswered: false,
    sort: true
  }), answers)

  while (answers.yesOrNo !== NO) {
    const item = await createSingleScrubbedEntry(answers)
    if (item.ListElement) {
      upsertFields(created.Scrubbed, [item], COMPOUND_KEYS.Scrubbed)
      addToSession(created)
      upsertConfigs(created)
    }
    answers = await askYesOrNo(answers, { message: QUESTION_ADD_ANOTHER })
  }

  return created
}

export function addScrubbedQuestions() {
  return [
    { name: 'ListElement', message: QUESTION_LIST_ELEMENT, askAnswered: true },
    { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, default: (ans) => ans.ListElement, askAnswered: true },
    { name: 'DisplayOrder', type: 'number', message: QUESTION_DISPLAY_ORDER, default: (ans) => getLastDisplayOrderInScrubbed(ans) + 1, askAnswered: true },
    ...addNonProdFeatureQuestions('Scrubbed')
  ] as Question[]
}

export async function createSingleScrubbedEntry(answers: Answers = {}, questions: Question[] = []) {
  const ask = addScrubbedQuestions()
  upsertFields(ask, questions, ['name'])

  answers = await prompt(ask, answers)

  return {
    ID: answers.ID,
    ListElement: answers.ListElement,
    ListElementCode: answers.ListElementCode,
    DisplayOrder: answers.DisplayOrder
  } as Scrubbed
}

function getLastDisplayOrderInScrubbed(answers: Answers) {
  const existingObjs = sheets.Scrubbed.filter(o => o.ID === answers.ID)
  const descendingSorted = existingObjs.sort((a, b) => a.DisplayOrder > b.DisplayOrder ? -1 : 1)
  return descendingSorted[0]?.DisplayOrder || 0
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a scrubbed list',
  fn: createScrubbedList,
  alias: 'UpsertFixedList'
} as Journey
