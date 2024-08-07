import { CCD_FIELD_TYPES, COMPOUND_KEYS, NONE } from "./constants"
import { getUniqueByKey, getUniqueByKeyAsArray, groupBy, upsertFields } from "./helpers"
import { Answers } from "./questions"
import { CaseEventToField, CaseField, CCDTypes, ConfigSheets, createNewConfigSheets, FlexExtensions } from "./types/ccd"

export const sheets: ConfigSheets = createNewConfigSheets()
export const knownFeatures: Record<string, null> = {}

export function rebuildKnownFeaturesFromConfigSheets(configSheets: ConfigSheets = sheets) {
  const sheetTypes = Object.values(configSheets)
  sheetTypes.forEach(sheet => {
    sheet.forEach(obj => {
      if (obj.feature) {
        knownFeatures[obj.feature] = null
      }
    })
  })

  return getKnownFeatures()
}

export function getKnownFeatures() {
  return Object.keys(knownFeatures)
}

export function addKnownFeature(feature: string) {
  knownFeatures[feature] = null
}

export function removeKnownFeature(feature: string) {
  delete knownFeatures[feature]
}

/** Clear everything on the currently loaded sheets */
export function clearConfigs() {
  Object.keys(sheets).forEach(key => { sheets[key] = [] })
}

/** Upsert/combine two sets of ConfigSheets together */
export function upsertConfigs(from: Partial<ConfigSheets>, to: Partial<ConfigSheets> = sheets) {
  Object.keys(from).forEach(key => {
    upsertFields<FlexExtensions>(to[key], from[key], [...COMPOUND_KEYS[key], 'ext', 'feature'])
  })
  return to
}

export function findObject<T extends FlexExtensions>(partial: Record<string, any>, sheetName: keyof CCDTypes, configSheets: ConfigSheets = sheets): T | undefined {
  if (sheetName) {
    return findObjectBySheet<T>(partial, sheetName, configSheets)
  }

  for (const sheet in configSheets) {
    const found = findObject(partial, sheet as keyof CCDTypes, configSheets)
    if (found) {
      return found as T
    }
  }
}

export function findObjectBySheet<T>(partial: Record<string, any>, sheetName: keyof CCDTypes, configSheets: ConfigSheets = sheets): T | undefined {
  const arr = configSheets[sheetName] as Array<Record<string, any>>
  const keysThatMatter = COMPOUND_KEYS[sheetName] as string[]
  const found = arr.find(o => {
    for (const key in partial) {
      if (!keysThatMatter.includes(key)) {
        continue
      }

      if (partial[key] && !Number.isNaN(partial[key]) && o[key] !== partial[key]) {
        return false
      }
    }
    return true
  })

  if (found) {
    return found as T
  }
}

/**
 * Get all defined CaseEvent IDs configs
 */
export function getCaseEventIDOpts(configSheets: ConfigSheets = sheets) {
  return getUniqueByKeyAsArray(configSheets.CaseEvent, 'ID')
}

/**
 * Get all currently known FieldType IDs in configs (FieldTypes that are referenced by at least one CaseField)
 */
export function getKnownCaseFieldTypes(configSheets: ConfigSheets = sheets) {
  const knownFieldTypes = configSheets.CaseField.map(o => o.FieldType)
  const knownComplexTypes = configSheets.ComplexTypes.map(o => o.ID)
  return Object.keys(groupBy([...knownFieldTypes, ...knownComplexTypes, ...CCD_FIELD_TYPES]))
}

/**
 * Gets possible FieldTypeParameters by collecting
 *  * FieldTypeParameters refereced in other CaseFields
 *  * Available FixedList IDs
 *  * Available ComplexType IDs
 *  * Known CCD Field Types as defined on Confluence
 */
export function getKnownCaseFieldTypeParameters(configSheets: ConfigSheets = sheets) {
  const inUse = getUniqueByKey(configSheets.CaseField, 'FieldTypeParameter')
  const fixedLists = getUniqueByKey(configSheets.Scrubbed, 'ID')
  const complexTypes = getUniqueByKey(configSheets.ComplexTypes, 'ID')
  return [...Object.keys({ ...inUse, ...fixedLists, ...complexTypes }), ...CCD_FIELD_TYPES]
}

/**
 * Get all defined FixedList IDs
 */
export function getKnownScrubbedLists(configSheets: ConfigSheets = sheets) {
  return getUniqueByKeyAsArray(configSheets.Scrubbed, 'ID')
}

/**
 * Get all defined CaseType IDs in englandwales and scotland configs
 */
export function getKnownCaseTypeIDs(configSheets: ConfigSheets = sheets) {
  return getUniqueByKeyAsArray(configSheets.CaseField, 'CaseTypeID')
}

/**
 * Get all defined CaseField IDs
 */
export function getKnownCaseFieldIDs(configSheets: ConfigSheets = sheets, filter?: (obj: CaseField) => CaseField[]) {
  const arr = configSheets.CaseField
  return getUniqueByKeyAsArray(filter ? arr.filter(filter) : arr, 'ID')
}

/**
 * Get all defined CaseField IDs on an event
 */
export function getKnownCaseFieldIDsByEvent(caseEventId?: string, configSheets: ConfigSheets = sheets) {
  const byEventId = (obj: CaseEventToField) => obj.CaseEventID === caseEventId

  const allCaseEventToFields = configSheets.CaseEventToFields
  const fieldToEvent = allCaseEventToFields.filter(byEventId)

  if (caseEventId === NONE) {
    const orphanFields = configSheets.CaseField.filter(o => !allCaseEventToFields.find(x => x.CaseFieldID === o.ID))
    return getUniqueByKeyAsArray(orphanFields, 'ID')
  }

  return getUniqueByKeyAsArray(!caseEventId || caseEventId === NONE ? allCaseEventToFields : fieldToEvent, 'CaseFieldID')
}

/**
 * Get all defined ComplexType IDs
 */
export function getKnownComplexTypeIDs(configSheets: ConfigSheets = sheets) {
  return getUniqueByKeyAsArray(configSheets.ComplexTypes, 'ID')
}

/**
 * Get all defined ComplexType IDs
 */
export function getKnownComplexTypeListElementCodes(id: string, configSheets: ConfigSheets = sheets) {
  const complexTypesOfID = configSheets.ComplexTypes.filter(o => o.ID === id)
  return getUniqueByKeyAsArray(complexTypesOfID, 'ListElementCode')
}

/**
 * Gets the highest PageFieldDisplayOrder number from fields on a certain page and increments 1
 */
export function getNextPageFieldIDForPage(caseTypeID: string, caseEventID: string, pageID: number, configSheets: ConfigSheets = sheets) {
  const fieldsOnPage = configSheets.CaseEventToFields.filter(o => o.CaseTypeID === caseTypeID && o.CaseEventID === caseEventID && o.PageID === pageID)
  const fieldOrders = fieldsOnPage.map(o => Number(o.PageFieldDisplayOrder))
  return fieldsOnPage.length ? Math.max(...fieldOrders) + 1 : 1
}

/** Gets the highest PageID from all CaseEventToFields belonging to an event */
export function getLastPageInEvent(caseTypeID: string, caseEventID: string, configSheets: ConfigSheets = sheets) {
  const fields = configSheets.CaseEventToFields.filter(o => o.CaseTypeID === caseTypeID && o.CaseEventID === caseEventID)
  return Math.max(...fields.map(o => o.PageID))
}

export function duplicateForCaseTypeIDs(answers: Answers, createFn: (answers: Answers) => Partial<ConfigSheets>) {
  const dupes = (answers.duplicate as string[]).reduce((acc, obj) => {
    return upsertConfigs(createFn({ ...answers, CaseTypeID: obj }), acc)
  }, createNewConfigSheets())

  const upserted = upsertConfigs(createFn(answers), dupes)

  // Remove undefineds and nulls
  for (const sheet in upserted) {
    upserted[sheet] = upserted[sheet].filter(o => o)
  }

  return upserted
}
