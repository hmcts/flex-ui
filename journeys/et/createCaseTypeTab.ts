import { Journey } from 'types/journey'
import { CaseTypeTab, CaseTypeTabKeys } from 'app/types/ccd'
import { createNewCaseTypeTab } from 'app/ccd'
import { createTemplate } from 'app/et/questions'
import { addToInMemoryConfig } from 'app/et/configs'

export async function createCaseTypeTab() {
  const answers = await createTemplate<unknown, CaseTypeTab>({}, CaseTypeTabKeys, createNewCaseTypeTab())
  const caseTypeTab = createNewCaseTypeTab(answers)

  addToInMemoryConfig({
    CaseTypeTab: [caseTypeTab]
  })
}

export default {
  disabled: true,
  group: 'et-create',
  text: 'Create/Modify a CaseTypeTab',
  fn: createCaseTypeTab
} as Journey
