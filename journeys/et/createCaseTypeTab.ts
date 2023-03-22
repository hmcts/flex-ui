import { Journey } from 'types/journey'
import { CaseTypeTab, CaseTypeTabKeys } from 'app/types/ccd'
import { createNewCaseTypeTab, trimCcdObject } from 'app/ccd'
import { createTemplate } from 'app/et/questions'
import { addToInMemoryConfig } from 'app/et/configs'
import { Answers } from 'app/questions'
import { addonDuplicateQuestion, QUESTION_ANOTHER } from './createSingleField'
import { addToLastAnswers, saveSession, session } from 'app/session'
import { prompt } from 'inquirer'
import { YES, YES_OR_NO } from 'app/constants'

export async function createCaseTypeTab() {
  const answers = await createTemplate<unknown, CaseTypeTab>({}, CaseTypeTabKeys, createNewCaseTypeTab(), 'CaseTypeTab')

  const createFn = (answers: Answers) => {
    const caseTypeTab = createNewCaseTypeTab(answers)

    addToInMemoryConfig({
      CaseTypeTab: [trimCcdObject(caseTypeTab)]
    })
  }

  addToLastAnswers(answers)

  await addonDuplicateQuestion(answers, createFn)

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
  group: 'et-create',
  text: 'Create/Modify a CaseTypeTab',
  fn: createCaseTypeTab
} as Journey
