import { AuthorisationCaseField, CaseField } from 'types/ccd'
import { Journey } from 'types/journey'
import { getConfigSheetsForCaseTypeID, createCaseFieldAuthorisations, Region } from 'app/et/configs'
import { findMissing, matcher } from 'app/helpers'
import { COMPOUND_KEYS } from 'app/constants'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { askCaseTypeID } from 'app/et/questions'

/**
 * Checks over every CaseField for missing or unexpected authorisations.
 * Generates a json report with fields and their extra, missing and/or different authorisations
 */
async function validateCaseFieldAuths() {
  const { CaseTypeID } = await askCaseTypeID()
  const region = getConfigSheetsForCaseTypeID(CaseTypeID)

  const caseFieldsForType = region.CaseField.filter(o => o.CaseTypeID === CaseTypeID)

  const authsByCaseField = region.AuthorisationCaseField.filter(o => o.CaseTypeId === CaseTypeID)
    .reduce((acc: Record<string, AuthorisationCaseField[]>, obj) => {
      // Looks like CCD doesn't care for trailing spaces, but check "subMultipleName" in ET's configs, some references have trailing spaces, others do not
      const trimmedKey = obj.CaseFieldID.trimEnd()
      if (!acc[trimmedKey]) {
        acc[trimmedKey] = []
      }
      acc[trimmedKey].push(obj)
      return acc
    }, {})

  const report = caseFieldsForType.map(o => checkFieldForAuths(o, authsByCaseField[o.ID.trim()] || []))
    .sort((a, b) => a.fieldID > b.fieldID ? 1 : -1)

  const summary = report.reduce((acc, obj) => {
    if (obj.missingAuths.length || obj.differentAuths.length || obj.extraAuths.length) {
      acc.fields++
      acc.discrepancies += obj.missingAuths.length + obj.differentAuths.length + obj.extraAuths.length
    }
    return acc
  }, { fields: 0, discrepancies: 0 })

  if (summary.fields > 0) {
    const outFile = resolve(__dirname, `checkCaseFieldAuths-${CaseTypeID}.json`)
    writeFileSync(outFile, JSON.stringify(report, null, 2))
    console.warn(`Found ${summary.fields} affected fields with a total of ${summary.discrepancies} discrepancies. Check ${outFile} for details`)
  }
}

/**
 * Generates a suggested authorisation array for a field, then checks against the current array to find differences
 * @param field to check for
 * @param existingAuths the authorisations currently stored for this field
 * @returns a record of fields and their extra, missing and/or different auths
 */
function checkFieldForAuths(field: CaseField, existingAuths: AuthorisationCaseField[]) {
  const generatedAuths = createCaseFieldAuthorisations(field.CaseTypeID, field.ID)

  const extraAuths = findMissing<AuthorisationCaseField>([...generatedAuths], existingAuths, COMPOUND_KEYS.AuthorisationCaseField)
  const missingAuths = findMissing<AuthorisationCaseField>([...existingAuths], generatedAuths, COMPOUND_KEYS.AuthorisationCaseField)
  const differentAuths = existingAuths.map(o => {
    const found = generatedAuths.find(x => matcher(o, x, COMPOUND_KEYS.AuthorisationCaseField))
    if (found && found.CRUD !== o.CRUD) return { ...o, currentCRUD: o.CRUD, suggestedCRUD: found.CRUD }
    return undefined
  }).filter(o => o)

  return { fieldID: field.ID, extraAuths, missingAuths, differentAuths }
}

export default {
  disabled: true,
  group: 'et-validate',
  text: 'Validate CaseFields have correct authorisations',
  fn: validateCaseFieldAuths
} as Journey
