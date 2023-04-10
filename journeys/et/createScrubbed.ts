import { getKnownScrubbedLists } from 'app/configs'
import { COMPOUND_KEYS, CUSTOM, NO, YES } from 'app/constants'
import { addToInMemoryConfig, getConfigSheetsFromFlexRegion, Region } from 'app/et/configs'
import { addFlexRegionAndClone, askFlexRegion, FLEX_REGION_ANSWERS_KEY, getFlexRegionFromAnswers } from 'app/et/questions'
import { upsertFields } from 'app/helpers'
import { addAutoCompleteQuestion, Answers, askYesOrNo } from 'app/questions'
import { ScrubbedKeys } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { createSingleScrubbedEntry, QUESTION_ADD_ANOTHER, QUESTION_ID } from '../base/createScrubbed'

const QUESTION_DISPLAY_ORDER = 'Whats the DisplayOrder for this item?'

function getETQuestions() {
  return [
    {
      name: 'DisplayOrder',
      type: 'number',
      message: QUESTION_DISPLAY_ORDER,
      default: (ans: Answers) => getLastDisplayOrderInScrubbed(ans) + 1,
      askAnswered: true
    }
  ]
}

async function journey(answers: Answers = {}) {
  answers = { ...answers, yesOrNo: YES }
  const created = { Scrubbed: [] }

  answers = await prompt(addAutoCompleteQuestion({
    name: ScrubbedKeys.ID,
    message: QUESTION_ID,
    default: CUSTOM,
    choices: [CUSTOM, ...getKnownScrubbedLists()],
    askAnswered: false,
    sort: true
  }), answers)

  while (answers.yesOrNo !== NO) {
    answers = await askFlexRegion(answers)
    const item = await createSingleScrubbedEntry(answers, getETQuestions())
    if (item.ListElement) {
      upsertFields(created.Scrubbed, addFlexRegionAndClone(answers[FLEX_REGION_ANSWERS_KEY] as Region[], item), COMPOUND_KEYS.Scrubbed)
      addToInMemoryConfig(created)
    }
    answers = await askYesOrNo(answers, { message: QUESTION_ADD_ANOTHER })
  }

  return created
}

function getLastDisplayOrderInScrubbed(answers: Answers) {
  const selectedRegions = getFlexRegionFromAnswers(answers)
  const existingObjs = getConfigSheetsFromFlexRegion(selectedRegions).Scrubbed.filter(o => o.ID === answers.ID)
  const descendingSorted = existingObjs.sort((a, b) => a.DisplayOrder > b.DisplayOrder ? -1 : 1)
  return descendingSorted[0]?.DisplayOrder || 0
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a scrubbed list',
  fn: journey,
  alias: 'UpsertFixedList'
} as Journey
