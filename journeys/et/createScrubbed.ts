import { YES_OR_NO } from "app/constants";
import { addNewScrubbed } from "app/et/configs";
import { prompt } from "inquirer";
import { Journey, Scrubbed } from "types/types";

export async function createScrubbed(id: string) {
  const answers = { id } || await prompt([
    { name: 'id', message: "What's the name of the new Scrubbed list?" }
  ])

  let createdItems: Scrubbed[] = []

  let x = 0
  while (true) {
    x++
    const followup = await prompt([
      { name: 'ListElement', message: `What should be displayed to the user when selecting this option?` },
    ])

    const more = await prompt([
      { name: 'ListElementCode', message: `Give a ListElementCode for this item`, default: followup.ListElement },
      { name: 'DisplayOrder', message: `Whats the DisplayOrder for this item?`, default: x },
      { name: 'More', message: `Add another?`, type: 'list', choices: YES_OR_NO }
    ])

    if (!more.ListElementCode) {
      more.ListElementCode = followup.ListElement
    }

    if (!more.DisplayOrder) {
      more.DisplayOrder = x
    }

    createdItems.push({
      ID: answers.id,
      ListElement: followup.ListElement,
      ListElementCode: more.ListElementCode,
      DisplayOrder: more.DisplayOrder
    })

    if (more.More === "No") {
      break
    }
  }

  addNewScrubbed(createdItems)

  return answers.Name
}

export default {
  group: 'et-create',
  text: 'Create new scrubbed list',
  fn: createScrubbed
} as Journey