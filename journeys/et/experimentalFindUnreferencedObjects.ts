import { COMPOUND_KEYS, NO, YES_OR_NO } from 'app/constants'
import { getEnglandWales, Region } from 'app/et/configs'
import { groupBy, removeFields } from 'app/helpers'
import { CaseField, ComplexType, ConfigSheets } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'

async function journey() {
  await journeyComplexTypes(getEnglandWales(), Region.EnglandWales)
}

async function journeyComplexTypes(ccd: ConfigSheets, region: string) {
  main: while (true) {
    const orphans = findUnreferencedComplexTypesInRegion(ccd)

    for (const orphanList of orphans) {
      const answers = await prompt([{
        name: 'delete',
        message: `${orphanList[0].ID} in ${region} is not referenced anywhere else. Delete?`,
        choices: YES_OR_NO,
        type: 'list',
        default: NO,
        askAnswered: true
      }])

      if (answers.delete === NO) continue

      removeFields(ccd.ComplexTypes, orphanList, COMPOUND_KEYS.ComplexTypes)
      // TODO: Store this in session once delete functionality is added for ComplexTypes
      continue main
    }
    break
  }
}

function findUnreferencedComplexTypesInRegion(ccd: ConfigSheets) {
  const unique = groupBy(ccd.ComplexTypes, 'ID')

  return Object.values(unique).reduce((acc, obj) => {
    if (!isComplexTypeReferencedInRegion(ccd, obj[0])) {
      acc.push(obj)
    }

    return acc
  }, [] as ComplexType[][])
}

function isComplexTypeReferencedInRegion(ccd: ConfigSheets, complexType: ComplexType) {
  /* A complex type could be referenced through:
  * 1. CaseField.FieldType
  * 2. CaseField.FieldTypeParameter
  * 3. ComplexType.FieldType
  * 4. ComplexType.FieldTypeParameter
  */

  const filter = (o: CaseField | ComplexType) => o.FieldType === complexType.ID || o.FieldTypeParameter === complexType.ID
  const caseFields = ccd.CaseField.filter(filter)
  const complexTypes = ccd.ComplexTypes.filter(filter)

  return caseFields.length + complexTypes.length > 0
}

export default {
  group: 'et-experimental',
  text: '[WIP] Find Unreferenced Objects',
  fn: journey
} as Journey
