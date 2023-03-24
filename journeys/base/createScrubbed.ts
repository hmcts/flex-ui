import { getKnownScrubbedLists, sheets } from 'app/configs'
import { CUSTOM, YES_OR_NO } from 'app/constants'
import { Answers, askAutoComplete } from 'app/questions'
import { addToSession } from 'app/session'
import { prompt } from 'inquirer'
import { Scrubbed, ScrubbedKeys } from 'types/ccd'
import { Journey } from 'types/journey'

const QUESTION_ID = "What's the name of the Scrubbed list?"
const QUESTION_LIST_ELEMENT = 'What should be displayed to the user when selecting this option?'
const QUESTION_LIST_ELEMENT_CODE = 'Give a ListElementCode for this item'
const QUESTION_DISPLAY_ORDER = 'Whats the DisplayOrder for this item?'
const QUESTION_ADD_ANOTHER = 'Add another?'

export async function createScrubbed(answers: Answers = {}) {
  const opts = getKnownScrubbedLists()

  answers = await askAutoComplete(ScrubbedKeys.ID, QUESTION_ID, CUSTOM, [CUSTOM, ...opts], false, true, answers)

  if (answers[ScrubbedKeys.ID] === CUSTOM) {
    answers = await prompt([{ name: ScrubbedKeys.ID, message: QUESTION_ID, askAnswered: true }], answers)
  }

  const createdItems: Scrubbed[] = []

  let x = 0
  while (answers.More !== 'No') {
    if (!x) {
      x = getLastDisplayOrderInScrubbed(answers)
    }
    answers = await prompt([
      { name: 'ListElement', message: QUESTION_LIST_ELEMENT, askAnswered: true },
      { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, default: (answers: Answers) => answers.ListElement, askAnswered: true },
      { name: 'DisplayOrder', type: 'number', message: QUESTION_DISPLAY_ORDER, default: ++x, askAnswered: true },
      { name: 'More', message: QUESTION_ADD_ANOTHER, type: 'list', choices: YES_OR_NO, askAnswered: true }
    ], answers)

    if (!answers.ListElementCode) {
      answers.ListElementCode = answers.ListElement
    }

    if (!answers.DisplayOrder) {
      answers.DisplayOrder = x
    }

    const obj: any = {
      ID: answers.ID,
      ListElement: answers.ListElement,
      ListElementCode: answers.ListElementCode,
      DisplayOrder: answers.DisplayOrder
    }

    createdItems.push(obj)
  }

  addToSession({
    Scrubbed: createdItems
  })

  return answers.ID
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
  fn: createScrubbed,
  alias: 'UpsertFixedList'
} as Journey