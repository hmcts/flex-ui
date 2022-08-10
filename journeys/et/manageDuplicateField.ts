import { prompt } from "inquirer";
import { Journey } from "types/types";
import { askCaseTypeID, fuzzySearch, listOrFreeType } from "app/questions";
import { getConfigSheetsForCaseTypeId, getKnownCaseTypeIds } from "app/et/configs";
import { doDuplicateCaseField } from "app/et/duplicateCaseField";
import { CANCEL, NO_DUPLICATE } from "app/constants";

const QUESTION_DUPLICATE = "What's the ID of the field to duplicate?";
const QUESTION_DUPLICATE_ADDON = "Do we need this field duplicated under another caseTypeId?";

async function duplicateCaseField() {
  const { CaseTypeID } = await askCaseTypeID()
  const region = getConfigSheetsForCaseTypeId(CaseTypeID)

  let answers = await prompt([
    {
      name: 'ID',
      message: QUESTION_DUPLICATE,
      type: 'autocomplete',
      source: (_answers: any, input: string) => fuzzySearch([CANCEL, ...region.CaseField.map(o => o.ID)], input)
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


export async function addOnDuplicateQuestion(answers: { CaseTypeID: string, ID: string } & Record<string, any>) {
  const opts = [NO_DUPLICATE, ...Object.keys(getKnownCaseTypeIds())]
  answers = await listOrFreeType(answers, 'duplicate', QUESTION_DUPLICATE_ADDON, opts)

  if (answers.duplicate === NO_DUPLICATE) {
    return
  }

  doDuplicateCaseField(answers.CaseTypeID, answers.ID, answers.duplicate)
  return answers
}

export default {
  group: 'et-manage',
  text: 'Duplicate case field',
  fn: duplicateCaseField
} as Journey