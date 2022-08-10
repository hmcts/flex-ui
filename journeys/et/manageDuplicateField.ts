import { prompt } from "inquirer";
import { Journey } from "types/types";
import { listOrFreeType, requestCaseTypeID } from "app/questions";
import { getConfigSheetsForCaseTypeId } from "app/et/configs";
import fuzzy from "fuzzy"
import { doDuplicateCaseField } from "app/et/duplicateCaseField";
import { NO_DUPLICATE } from "app/constants";

async function duplicateCaseField() {
  const { CaseTypeID } = await requestCaseTypeID()
  const region = getConfigSheetsForCaseTypeId(CaseTypeID)

  let answers = await prompt([
    {
      name: 'ID',
      message: "What's the ID of the field to select?",
      type: 'autocomplete',
      source: (_answers: any, input: string) => searchCaseField(region.CaseField.map(o => o.ID), input)
    }
  ])

  if (answers.ID === "CANCEL") {
    return
  }

  answers = {
    ...answers,
    ...await requestCaseTypeID()
  }

  doDuplicateCaseField(CaseTypeID, answers.ID, answers.CaseTypeID)
}

function searchCaseField(choices: string[], input = '') {
  return fuzzy.filter(input, ['CANCEL', ...choices]).map((el) => el.original)
}

export async function addOnDuplicateQuestion(answers: { CaseTypeID: string, ID: string } & Record<string, any>) {
  answers = {
    ...answers,
    ...await listOrFreeType('duplicate', "Do we need this field duplicated under another caseTypeId?", [NO_DUPLICATE, 'ET_EnglandWales', 'ET_Scotland'])
  }

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