import { Journey } from 'types/journey'
import { CaseTypeTab, CaseTypeTabKeys } from 'app/types/ccd'
import { createNewCaseTypeTab, trimCcdObject } from 'app/ccd'
import { createTemplate } from 'app/et/questions'
import { addToInMemoryConfig } from 'app/et/configs'
import { Answers } from 'app/questions'
import { addonDuplicateQuestion } from './createSingleField'

export async function createCaseTypeTab() {
  const answers = await createTemplate<unknown, CaseTypeTab>({}, CaseTypeTabKeys, createNewCaseTypeTab(), 'CaseTypeTab')

  const createFn = (answers: Answers) => {
    const caseTypeTab = createNewCaseTypeTab(answers)

    addToInMemoryConfig({
      CaseTypeTab: [trimCcdObject(caseTypeTab)]
    })
  }

  await addonDuplicateQuestion(answers, createFn)
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify a CaseTypeTab',
  fn: createCaseTypeTab
} as Journey
