import { Journey } from 'types/journey'
import { CaseTypeTab, CaseTypeTabKeys } from 'app/types/ccd'
import { createNewCaseTypeTab, trimCcdObject } from 'app/ccd'
import { createTemplate, Answers, addonDuplicateQuestion } from 'app/questions'
import { QUESTION_ANOTHER } from './createSingleField'
import { addToLastAnswers, addToSession, saveSession, session } from 'app/session'
import { prompt } from 'inquirer'
import { COMPOUND_KEYS, YES, YES_OR_NO } from 'app/constants'
import { sheets } from 'app/configs'
import { upsertFields } from 'app/helpers'

export async function createCaseTypeTab() {
  const answers = await createTemplate<unknown, CaseTypeTab>({}, CaseTypeTabKeys, createNewCaseTypeTab(), 'CaseTypeTab')

  const createFn = (answers: Answers) => {
    const caseTypeTab = createNewCaseTypeTab(answers)

    const newFields = {
      CaseTypeTab: [trimCcdObject(caseTypeTab)]
    }
    addToSession(newFields)

    for (const sheetName in newFields) {
      upsertFields(sheets[sheetName], newFields[sheetName], COMPOUND_KEYS[sheetName])
    }
  }

  addToLastAnswers(answers)

  await addonDuplicateQuestion(answers, undefined, createFn)

  const followup = await prompt([{
    name: 'another',
    message: QUESTION_ANOTHER,
    type: 'list',
    choices: YES_OR_NO,
    default: YES
  }])

  if (followup.another === YES) {
    saveSession(session)
    return createCaseTypeTab()
  }
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseTypeTab',
  fn: createCaseTypeTab,
  alias: 'UpsertCaseTypeTab'
} as Journey
