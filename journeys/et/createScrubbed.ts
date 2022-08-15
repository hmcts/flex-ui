import { YES_OR_NO } from "app/constants"
import { addNewScrubbed } from "app/et/configs"
import { Answers } from "app/questions"
import { prompt } from "inquirer"
import { Scrubbed } from "types/ccd"
import { Journey } from "types/journey"

const QUESTION_ID = "What's the name of the new Scrubbed list?"
const QUESTION_LIST_ELEMENT = `What should be displayed to the user when selecting this option?`
const QUESTION_LIST_ELEMENT_CODE = `Give a ListElementCode for this item`
const QUESTION_DISPLAY_ORDER = `Whats the DisplayOrder for this item?`
const QUESTION_ADD_ANOTHER = `Add another?`

export async function createScrubbed(answers: Answers = {}) {
  answers = await prompt([{ name: 'ID', message: QUESTION_ID }], answers)

  let createdItems: Scrubbed[] = []

  let x = 0
  do {
    answers = await prompt([
      { name: 'ListElement', message: QUESTION_LIST_ELEMENT },
      { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, default: (answers: Answers) => answers.ListElement },
      { name: 'DisplayOrder', message: QUESTION_DISPLAY_ORDER, default: ++x },
      { name: 'More', message: QUESTION_ADD_ANOTHER, type: 'list', choices: YES_OR_NO }
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

    if (answers.More === "No") {
      break
    }
  } while (true)

  addNewScrubbed(createdItems)

  return answers.ID
}

export default {
  group: 'et-create',
  text: 'Create new scrubbed list',
  fn: createScrubbed
} as Journey