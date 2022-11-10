import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { fuzzySearch, listOrFreeType } from 'app/questions'
import { getConfigSheetsForCaseTypeID, getKnownCaseTypeIDs } from 'app/et/configs'
import { doDuplicateCaseField } from 'app/et/duplicateCaseField'
import { CANCEL, NO_DUPLICATE } from 'app/constants'
import { getIdealSizeForInquirer } from 'app/helpers'
import { askCaseTypeID } from 'app/et/questions'

const QUESTION_DUPLICATE = "What's the ID of the field to duplicate?"
const QUESTION_DUPLICATE_ADDON = 'Do we need this field duplicated under another caseTypeID?'

export async function duplicateCaseField() {
  const { CaseTypeID } = await askCaseTypeID()
  const region = getConfigSheetsForCaseTypeID(CaseTypeID)

  let answers = await prompt([
    {
      name: 'ID',
      message: QUESTION_DUPLICATE,
      type: 'autocomplete',
      source: (_answers: unknown, input: string) => fuzzySearch([CANCEL, ...region.CaseField.map(o => o.ID)], input),
      pageSize: getIdealSizeForInquirer()
    }
  ])

  if (answers.ID === CANCEL) {
    return
  }

  answers = {
    ...answers,
    ...await askCaseTypeID()
  }

  doDuplicateCaseField(CaseTypeID, answers.ID, answers.CaseTypeID)
}

/**
 * Convenience method for adding on the duplicate question to a journey
 */
export async function addOnDuplicateQuestion(answers: { CaseTypeID: string, ID: string } & Record<string, string>) {
  const opts = [NO_DUPLICATE, ...getKnownCaseTypeIDs()]
  answers = await listOrFreeType(answers, 'duplicate', QUESTION_DUPLICATE_ADDON, opts)

  if (answers.duplicate === NO_DUPLICATE) {
    return
  }

  doDuplicateCaseField(answers.CaseTypeID, answers.ID, answers.duplicate)
  return answers
}

export default {
  disabled: true,
  group: 'et-manage',
  text: 'Duplicate case field',
  fn: duplicateCaseField
} as Journey
