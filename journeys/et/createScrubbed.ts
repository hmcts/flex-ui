import { YES_OR_NO } from 'app/constants'
import { addToInMemoryConfig } from 'app/et/configs'
import { Answers } from 'app/questions'
import { prompt } from 'inquirer'
import { Scrubbed } from 'types/ccd'
import { Journey } from 'types/journey'

const QUESTION_ID = "What's the name of the new Scrubbed list?"
const QUESTION_LIST_ELEMENT = 'What should be displayed to the user when selecting this option?'
const QUESTION_LIST_ELEMENT_CODE = 'Give a ListElementCode for this item'
const QUESTION_DISPLAY_ORDER = 'Whats the DisplayOrder for this item?'
const QUESTION_ADD_ANOTHER = 'Add another?'

export async function createScrubbed(answers: Answers = {}) {
  answers = await prompt([{ name: 'ID', message: QUESTION_ID }], answers)

  const createdItems: Scrubbed[] = []

  let x = 0
  while (answers.More !== 'No') {
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

    createdItems.push({
      ID: answers.ID,
      ListElement: answers.ListElement,
      ListElementCode: answers.ListElementCode,
      DisplayOrder: answers.DisplayOrder
    })
  }

  addToInMemoryConfig({
    Scrubbed: createdItems
  })

  return answers.ID
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify a scrubbed list',
  fn: createScrubbed
} as Journey
