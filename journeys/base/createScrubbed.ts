import { getKnownScrubbedLists, sheets } from 'app/configs'
import { COMPOUND_KEYS, CUSTOM, YES_OR_NO } from 'app/constants'
import { upsertFields } from 'app/helpers'
import { Answers, askAutoComplete } from 'app/questions'
import { addToSession } from 'app/session'
import { prompt } from 'inquirer'
import { ScrubbedKeys } from 'types/ccd'
import { Journey } from 'types/journey'

const QUESTION_ID = "What's the name of the Scrubbed list?"
const QUESTION_LIST_ELEMENT = 'What should be displayed to the user when selecting this option?'
const QUESTION_LIST_ELEMENT_CODE = 'Give a ListElementCode for this item'
const QUESTION_DISPLAY_ORDER = 'Whats the DisplayOrder for this item?'
const QUESTION_ADD_ANOTHER = 'Add another?'

export async function createScrubbed(answers: Answers = {}) {
  const opts = getKnownScrubbedLists()

  answers = await askAutoComplete(answers, { name: ScrubbedKeys.ID, message: QUESTION_ID, default: CUSTOM, choices: [CUSTOM, ...opts], askAnswered: false, sort: true })

  if (answers[ScrubbedKeys.ID] === CUSTOM) {
    answers = await prompt([{ name: ScrubbedKeys.ID, message: QUESTION_ID, askAnswered: true }], answers)
  }

  while (answers.More !== 'No') {
    answers = await prompt([
      { name: 'ListElement', message: QUESTION_LIST_ELEMENT, askAnswered: true },
      { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, default: (answers: Answers) => answers.ListElement, askAnswered: true },
      { name: 'DisplayOrder', type: 'number', message: QUESTION_DISPLAY_ORDER, default: getLastDisplayOrderInScrubbed(answers) + 1, askAnswered: true },
      { name: 'More', message: QUESTION_ADD_ANOTHER, type: 'list', choices: YES_OR_NO, askAnswered: true }
    ], answers)

    if (!answers.ListElementCode) {
      answers.ListElementCode = answers.ListElement
    }

    const obj: any = {
      ID: answers.ID,
      ListElement: answers.ListElement,
      ListElementCode: answers.ListElementCode,
      DisplayOrder: answers.DisplayOrder
    }

    const newFields = {
      Scrubbed: [obj]
    }

    addToSession(newFields)

    for (const sheetName in newFields) {
      upsertFields(sheets[sheetName], newFields[sheetName], COMPOUND_KEYS[sheetName])
    }
  }

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
