import { YES_OR_NO } from "app/constants"
import { addNewScrubbed } from "app/et/configs"
import { prompt } from "inquirer"
import { Scrubbed } from "types/ccd"
import { Journey } from "types/journey"

const QUESTION_ID = "What's the name of the new Scrubbed list?"
const QUESTION_LIST_ELEMENT = `What should be displayed to the user when selecting this option?`
const QUESTION_LIST_ELEMENT_CODE = `Give a ListElementCode for this item`
const QUESTION_DISPLAY_ORDER = `Whats the DisplayOrder for this item?`
const QUESTION_ADD_ANOTHER = `Add another?`

export async function createScrubbed(answers: any) {
  answers = await prompt([{ name: 'ID', message: QUESTION_ID }], answers)

  let createdItems: Scrubbed[] = []

  let x = 0
  while (true) {
    x++
    const followup = await prompt([
      { name: 'ListElement', message: QUESTION_LIST_ELEMENT },
    ])

    const more = await prompt([
      { name: 'ListElementCode', message: QUESTION_LIST_ELEMENT_CODE, default: followup.ListElement },
      { name: 'DisplayOrder', message: QUESTION_DISPLAY_ORDER, default: x },
      { name: 'More', message: QUESTION_ADD_ANOTHER, type: 'list', choices: YES_OR_NO }
    ])

    if (!more.ListElementCode) {
      more.ListElementCode = followup.ListElement
    }

    if (!more.DisplayOrder) {
      more.DisplayOrder = x
    }

    createdItems.push({
      ID: answers.ID,
      ListElement: followup.ListElement,
      ListElementCode: more.ListElementCode,
      DisplayOrder: more.DisplayOrder
    })

    if (more.More === "No") {
      break
    }
  }

  addNewScrubbed(createdItems)

  return answers.ID
}

export default {
  group: 'et-create',
  text: 'Create new scrubbed list',
  fn: createScrubbed
} as Journey