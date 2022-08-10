import { AuthorisationCaseField, CaseField, Journey } from "types/types";
import { askCaseTypeID } from "app/questions";
import { getConfigSheetsForCaseTypeId } from "app/et/configs";
import { createAuthorisationCaseFields } from "app/objects";
import { findMissing, matcher } from "app/helpers";
import { COMPOUND_KEYS } from "app/et/constants";
import { writeFileSync } from "fs";
import { resolve } from "path";

async function validateCaseFieldAuths() {
  const { CaseTypeID } = await askCaseTypeID()
  const region = getConfigSheetsForCaseTypeId(CaseTypeID)

  const caseFieldsForType = region.CaseField.filter(o => o.CaseTypeID === CaseTypeID)

  const authsByCaseField = region.AuthorisationCaseField.filter(o => o.CaseTypeId === CaseTypeID)
    .reduce((acc: any, obj) => {
      // Looks like CCD dopesn't care for trailing spaces, but check "subMultipleName" in ET's configs, some references have trailing spaces, others do not
      const trimmedKey = obj.CaseFieldID.trimEnd()
      if (!acc[trimmedKey]) {
        acc[trimmedKey] = []
      }
      acc[trimmedKey].push(obj)
      return acc
    }, {})


  const report = caseFieldsForType.map(o => checkFieldForAuths(o, authsByCaseField[o.ID.trim()] || []))
    .sort((a, b) => a.fieldId > b.fieldId ? 1 : -1)

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

function checkFieldForAuths(field: CaseField, existingAuths: AuthorisationCaseField[]) {
  const generatedAuths = createAuthorisationCaseFields(field.CaseTypeID, field.ID)

  const extraAuths = findMissing<AuthorisationCaseField>([...generatedAuths], existingAuths, COMPOUND_KEYS.AuthorisationCaseField)
  const missingAuths = findMissing<AuthorisationCaseField>([...existingAuths], generatedAuths, COMPOUND_KEYS.AuthorisationCaseField)
  const differentAuths = existingAuths.map(o => {
    const found = generatedAuths.find(x => matcher(o, x, COMPOUND_KEYS.AuthorisationCaseField))
    if (found && found.CRUD !== o.CRUD) return { ...o, currentCRUD: o.CRUD, suggestedCRUD: found.CRUD }
  }).filter(o => o)

  return { fieldId: field.ID, extraAuths, missingAuths, differentAuths }
}

export default {
  group: 'et-session',
  text: 'Validate CaseFields have correct authorisations',
  fn: validateCaseFieldAuths
} as Journey