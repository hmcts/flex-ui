import { sheets } from 'app/configs'
import { getUniqueByKeyAsArray } from 'app/helpers'
import { CaseTypeTabKeys } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { defaultRoleMappings, addToInMemoryConfig } from 'app/et/configs'
import { createAuthorisationCaseField } from 'app/ccd'

async function journey() {
  // Code here
  // To remove a tab from a user:
  // 1. Look through CaseTypeTab and find all CaseFields that appear on this page
  // 2. Set authorisations to D for the role we want to remove

  const opts = getUniqueByKeyAsArray(sheets.CaseTypeTab, "TabID")

  const answers = await prompt([
    { name: CaseTypeTabKeys.TabID, message: "What's the CaseTypeTab?", type: 'list', choices: opts },
    { name: 'role', message: 'What role to remove?', type: 'list', choices: Object.keys(defaultRoleMappings) }
  ])

  const fieldIds = sheets.CaseTypeTab.filter(o => o.TabID === answers[CaseTypeTabKeys.TabID]).map(o => o.CaseFieldID)
  const fields = sheets.CaseField.filter(o => fieldIds.includes(o.ID))

  const delAuths = fields.map(o =>
    createAuthorisationCaseField(
      {
        CaseTypeID: o.CaseTypeID,
        CaseFieldID: o.ID,
        UserRole: answers.role,
        CRUD: "D"
      }
    )
  )

  addToInMemoryConfig({ AuthorisationCaseField: delAuths })
}

export default {
  disabled: false,
  group: 'et-experimental',
  text: '[WIP] Hide Tab',
  fn: journey,
  alias: 'hideTab'
} as Journey
