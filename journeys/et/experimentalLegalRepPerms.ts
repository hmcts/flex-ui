import { sheets } from 'app/configs'
import { getUniqueByKeyAsArray } from 'app/helpers'
import { AuthorisationCaseField, CaseTypeTabKeys } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { defaultRoleMappings, addToInMemoryConfig } from 'app/et/configs'
import { createAuthorisationCaseField } from 'app/ccd'

async function journey() {
  // Code here
  // To remove a tab from a user:
  // 1. Look through CaseTypeTab and find all CaseFields that appear on this page
  // 2. Set authorisations to D for the role we want to remove

  const REP = 'caseworker-employment-legalrep-solicitor'

  const authEvents = sheets.AuthorisationCaseEvent.filter(o => o.CaseTypeId.includes("_Multiple") && o.UserRole === REP)
  const authFields = sheets.AuthorisationCaseField.filter(o => o.CaseTypeId.includes("_Multiple") && o.UserRole === REP)

  // First disable access to legalrep for EVERYTHING

  authEvents.forEach(authEvent => {
    authEvent.CRUD = "D"
  })

  authFields.forEach(authField => {
    authField.CRUD = "D"
  })

  // Enable all fields on CaseMultiple tab
  const ignoreFields = ['state', 'multipleSource', 'caseImporterFile']
  const added: AuthorisationCaseField[] = []

  sheets.CaseTypeTab.filter(o => o.TabID === "CaseMultiple" && !ignoreFields.includes(o.CaseFieldID))
    .forEach(o => {
      const exist = sheets.AuthorisationCaseField.find(x => x.CaseFieldID === o.CaseFieldID && x.CaseTypeId === o.CaseTypeID && x.UserRole === REP)
      if (exist) {
        exist.CRUD = "R"
        return
      }
      const obj = createAuthorisationCaseField({ CaseFieldID: o.CaseFieldID, CaseTypeId: o.CaseTypeID, UserRole: REP, CRUD: "R" })
      added.push(obj)
    })

  // Enable all fields on Doc - Respondent tab
  sheets.CaseTypeTab.filter(o => o.TabID === "MultiplesRespondentDocumentsTab")
    .forEach(o => {
      const exist = sheets.AuthorisationCaseField.find(x => x.CaseFieldID === o.CaseFieldID && x.CaseTypeId === o.CaseTypeID && x.UserRole === REP)
      if (exist) {
        exist.CRUD = "R"
        return
      }
      const obj = createAuthorisationCaseField({ CaseFieldID: o.CaseFieldID, CaseTypeId: o.CaseTypeID, UserRole: REP, CRUD: "R" })
      added.push(obj)
    })

  sheets.CaseField.filter(o => o.ID === "legalrepDocumentCollection")
    .forEach(o => {
      const exist = sheets.AuthorisationCaseField.find(x => x.CaseFieldID === o.ID && x.CaseTypeId === o.CaseTypeID && x.UserRole === REP)
      if (exist) {
        exist.CRUD = "CRU"
        return
      }
      const obj = createAuthorisationCaseField({ CaseFieldID: o.ID, CaseTypeId: o.CaseTypeID, UserRole: REP, CRUD: "CRU" })
      added.push(obj)
    })

  addToInMemoryConfig({
    AuthorisationCaseField: added
  })
}

export default {
  disabled: false,
  group: 'et-experimental',
  text: '[WIP] Legal Rep Perms',
  fn: journey,
  alias: 'legalrepperms'
} as Journey
