import { Journey } from 'types/journey'
import { CaseTypeTab, CaseTypeTabKeys, FlexExtensionKeys } from 'app/types/ccd'
import { createNewCaseTypeTab, trimCcdObject } from 'app/ccd'
import { createTemplate, Answers, addonDuplicateQuestion } from 'app/questions'
import { addToSession } from 'app/session'
import { upsertConfigs } from 'app/configs'

async function journey(answers: Answers = {}) {
  const created = await createCaseTypeTab(answers)
  addToSession(created)
  upsertConfigs(created)
}

export async function createCaseTypeTab(answers: Answers = {}) {
  answers = await createTemplate<unknown, CaseTypeTab>({}, { ...CaseTypeTabKeys, ...FlexExtensionKeys }, createNewCaseTypeTab(), 'CaseTypeTab')

  return await addonDuplicateQuestion(answers, undefined, (answers: Answers) => {
    const caseTypeTab = createNewCaseTypeTab(answers)

    return {
      CaseTypeTab: [trimCcdObject(caseTypeTab)]
    }
  })
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a CaseTypeTab',
  fn: journey,
  alias: 'UpsertCaseTypeTab'
} as Journey
