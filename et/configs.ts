import { readFileSync, writeFileSync } from 'fs'
import { sep } from 'path'
import { findLastIndex, format, getUniqueByKey, getUniqueByKeyAsArray, groupBy, removeFields, upsertFields } from 'app/helpers'
import { addToSession, session } from 'app/session'
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventKeys, CaseEventToField, CaseEventToFieldKeys, CaseField, CaseTypeTab, CaseTypeTabKeys, CCDSheets, CCDTypes, ComplexType, ConfigSheets, createNewConfigSheets, EventToComplexType, EventToComplexTypeKeys, FlexExtensions, Scrubbed, ScrubbedKeys, sheets } from 'types/ccd'
import { COMPOUND_KEYS, NONE } from 'app/constants'

let readTime = 0
let englandwales: ConfigSheets
let scotland: ConfigSheets

export enum Region {
  EnglandWales = 'ET_EnglandWales',
  Scotland = 'ET_Scotland',
}

export enum Roles {
  AcasApi = 'et-acas-api',
  CaseworkerEmployment = 'caseworker-employment',
  CaseworkerEmploymentLegalRepSolicitor = 'caseworker-employment-legalrep-solicitor',
  CaseworkerEmploymentETJudge = 'caseworker-employment-etjudge',
  CaseworkerEmploymentEnglandWales = 'caseworker-employment-englandwales',
  CaseworkerEmploymentETJudgeEnglandWales = 'caseworker-employment-etjudge-englandwales',
  CaseworkerEmploymentScotland = 'caseworker-employment-scotland',
  CaseworkerEmploymentETJudgeScotland = 'caseworker-employment-etjudge-scotland',
  Citizen = 'citizen',
  CaseworkerEmploymentApi = 'caseworker-employment-api'
}

type RegionPermissions = Record<Region, string>
export type RoleMappings = Record<Roles, Partial<RegionPermissions>>

export const defaultRoleMappings: RoleMappings = {
  [Roles.AcasApi]: { [Region.EnglandWales]: 'R', [Region.Scotland]: 'R' },
  [Roles.CaseworkerEmployment]: { [Region.EnglandWales]: 'R', [Region.Scotland]: 'R' },
  [Roles.CaseworkerEmploymentApi]: { [Region.EnglandWales]: 'CRUD', [Region.Scotland]: 'CRUD' },
  [Roles.CaseworkerEmploymentETJudge]: { [Region.EnglandWales]: 'R', [Region.Scotland]: 'R' },
  [Roles.CaseworkerEmploymentETJudgeEnglandWales]: { [Region.EnglandWales]: 'CRU' },
  [Roles.CaseworkerEmploymentETJudgeScotland]: { [Region.Scotland]: 'CRU' },
  [Roles.CaseworkerEmploymentEnglandWales]: { [Region.EnglandWales]: 'CRU' },
  [Roles.CaseworkerEmploymentLegalRepSolicitor]: { [Region.EnglandWales]: 'D', [Region.Scotland]: 'D' },
  [Roles.CaseworkerEmploymentScotland]: { [Region.Scotland]: 'CRU' },
  [Roles.Citizen]: { [Region.EnglandWales]: 'CRU', [Region.Scotland]: 'CRU' }
}

export const regionRoles: RoleMappings = {
  [Roles.CaseworkerEmploymentETJudgeEnglandWales]: { [Region.Scotland]: Roles.CaseworkerEmploymentETJudgeScotland },
  [Roles.CaseworkerEmploymentETJudgeScotland]: { [Region.EnglandWales]: Roles.CaseworkerEmploymentETJudgeEnglandWales },
  [Roles.CaseworkerEmploymentEnglandWales]: { [Region.Scotland]: Roles.CaseworkerEmploymentScotland },
  [Roles.CaseworkerEmploymentScotland]: { [Region.EnglandWales]: Roles.CaseworkerEmploymentEnglandWales },

  [Roles.Citizen]: {},
  [Roles.CaseworkerEmployment]: {},
  [Roles.CaseworkerEmploymentApi]: {},
  [Roles.CaseworkerEmploymentETJudge]: {},
  [Roles.CaseworkerEmploymentLegalRepSolicitor]: {},
  [Roles.AcasApi]: {}
}

/**
 * Gets the parsed JSON file contents
 * @param regionDir repo folder that contains definitions (ie, et-ccd-definitions-scotland)
 * @param name of the JSON file (ie, CaseField)
 * @returns parsed JSON file
 */
function getJson(regionDir: string, name: string) {
  try {
    return JSON.parse(readFileSync(`${regionDir}${sep}definitions${sep}json${sep}${name}.json`).toString())
  } catch (e) {
    throw new Error(`Failed to read ${name}.json in ${regionDir}`)
  }
}

/** Getter for readTime */
export function getReadTime() {
  return readTime
}

/** Getter for englandwales */
export function getEnglandWales() {
  return englandwales
}

/** Getter for scotland */
export function getScotland() {
  return scotland
}

export function getCombinedSheets() {
  return sheets.reduce((acc, sheet) => {
    // @ts-expect-error TS doesn't know that ConfigSheets can be merged with ConfigSheets (bug bounty: fix this)
    acc[sheet] = [...englandwales[sheet], ...scotland[sheet]]
    return acc
  }, {} as CCDSheets<CCDTypes>)
}

/**
 * Given an array of regions (as would be found in Answers) returns the relevant ccd sheets or combined sheets
 */
export function getConfigSheetsFromFlexRegion(flexRegion: Region[]) {
  if (flexRegion.includes(Region.EnglandWales) && flexRegion.includes(Region.Scotland)) {
    return getCombinedSheets()
  }

  if (flexRegion.includes(Region.EnglandWales)) {
    return getEnglandWales()
  }

  if (flexRegion.includes(Region.Scotland)) {
    return getScotland()
  }

  return createNewConfigSheets()
}

export function findObject<T>(keys: Record<string, any>, sheetName: keyof CCDTypes, region?: Region): T | undefined {
  const ccd = region === Region.EnglandWales
    ? getEnglandWales()
    : region === Region.Scotland
      ? getScotland()
      : getCombinedSheets()

  const arr = ccd[sheetName] as Array<Record<string, any>>
  const keysThatMatter = COMPOUND_KEYS[sheetName] as string[]
  const found = arr.find(o => {
    for (const key in keys) {
      if (!keysThatMatter.includes(key)) {
        continue
      }

      if (keys[key] && !Number.isNaN(keys[key]) && o[key] !== keys[key]) {
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
 * Mapper function for deciding where to write objects depending on CaseTypeID
 * @param caseTypeID a caseTypeID value
 * @returns either englandwales or scotland
 */
export function getConfigSheetsForCaseTypeID(caseTypeID: string) {
  return caseTypeID.startsWith(Region.EnglandWales) ? getEnglandWales() : getScotland()
}

/**
 * Returns a region enum value based on the CaseTypeID passed in
 */
export function getRegionFromCaseTypeId(caseTypeID: string) {
  return caseTypeID.startsWith(Region.EnglandWales) ? Region.EnglandWales : Region.Scotland
}

/**
 * Get all defined CaseEvent IDs in englandwales and scotland configs
 */
export function getCaseEventIDOpts() {
  return getUniqueByKeyAsArray([...englandwales.CaseEvent, ...scotland.CaseEvent], 'ID')
}

/**
 * Get all currently known FieldType IDs in englandwales and scotland configs (FieldTypes that are referenced by at least one CaseField)
 */
export function getKnownCaseFieldTypes() {
  const knownFieldTypes = [...englandwales.CaseField, ...scotland.CaseField].map(o => o.FieldType)
  const knownComplexTypes = [...englandwales.ComplexTypes, ...scotland.ComplexTypes].map(o => o.ID)
  return Object.keys(groupBy([...knownFieldTypes, ...knownComplexTypes]))
}

/**
 * Gets (most) options for FieldTypeParameters in englandwales and scotland configs by looking at existing CaseField FieldTypeParameters and getting all scrubbed ID options
 * TOOD: When ComplexTypes JSON support is added. Add it here
 */
export function getKnownCaseFieldTypeParameters() {
  const inUse = getUniqueByKey([...englandwales.CaseField, ...scotland.CaseField], 'FieldTypeParameter')
  const scrubbed = getUniqueByKey([...englandwales.Scrubbed, ...scotland.Scrubbed], 'ID')
  return Object.keys({ ...inUse, ...scrubbed })
}

/**
 * Get all defined Scrubbed IDs in englandwales and scotland configs
 */
export function getKnownScrubbedLists() {
  return getUniqueByKeyAsArray([...englandwales.Scrubbed, ...scotland.Scrubbed], 'ID')
}

/**
 * Get all defined CaseType IDs in englandwales and scotland configs
 */
export function getKnownCaseTypeIDs() {
  return getUniqueByKeyAsArray([...englandwales.CaseField, ...scotland.CaseField], 'CaseTypeID')
}

/**
 * Get all defined CaseField IDs in englandwales and scotland configs
 */
export function getKnownCaseFieldIDs(filter?: (obj: CaseField) => CaseField[]) {
  const arr = [...englandwales.CaseField, ...scotland.CaseField]
  return getUniqueByKeyAsArray(filter ? arr.filter(filter) : arr, 'ID')
}

/**
 * Get all defined CaseField IDs in englandwales and scotland configs on an event
 */
export function getKnownCaseFieldIDsByEvent(caseEventId?: string, regions: Region[] = [Region.EnglandWales, Region.Scotland]) {
  let arr = []

  if (regions.includes(Region.EnglandWales)) {
    arr = [...englandwales.CaseField]
  }

  if (regions.includes(Region.Scotland)) {
    arr = arr.concat(scotland.CaseField)
  }

  const byEventId = (obj: CaseEventToField) => obj.CaseEventID === caseEventId

  const allCaseEventToFields = [...englandwales.CaseEventToFields, ...scotland.CaseEventToFields]
  const fieldToEvent = allCaseEventToFields.filter(byEventId)
  const subsetFields = caseEventId === NONE ?
    arr.filter(o => !allCaseEventToFields.some(x => o.ID === x.CaseFieldID))
    : arr.filter(o => fieldToEvent.find(x => x.CaseFieldID === o.ID))

  return getUniqueByKeyAsArray(subsetFields, 'ID')
}

/**
 * Get all defined ComplexType IDs in englandwales and scotland configs
 */
export function getKnownComplexTypeIDs() {
  return getUniqueByKeyAsArray([...englandwales.ComplexTypes, ...scotland.ComplexTypes], 'ID')
}

/**
 * Get all defined ComplexType IDs in englandwales and scotland configs
 */
export function getKnownComplexTypeListElementCodes(id: string) {
  const complexTypesOfID = [...englandwales.ComplexTypes.filter(o => o.ID === id), ...scotland.ComplexTypes.filter(o => o.ID === id)]
  return getUniqueByKeyAsArray(complexTypesOfID, 'ListElementCode')
}

/**
 * Gets the highest PageFieldDisplayOrder number from fields on a certain page
 */
export function getNextPageFieldIDForPage(caseTypeID: string, caseEventID: string, pageID: number) {
  const region = getConfigSheetsForCaseTypeID(caseTypeID)
  const fieldsOnPage = region.CaseEventToFields.filter(o => o.CaseEventID === caseEventID && o.PageID === pageID)
  const fieldOrders = fieldsOnPage.map(o => Number(o.PageFieldDisplayOrder))
  return fieldsOnPage.length ? Math.max(...fieldOrders) + 1 : 1
}

export function getConfigSheetName(region: Region, configSheet: keyof (ConfigSheets)) {
  if (configSheet === 'Scrubbed') {
    return `${region.toString().replace('ET_', '')} Scrubbed`
  }
  return configSheet
}

/**
 * Replace in-memory configs by reading in both englandwales and scotland configs from their repo folders.
 */
export function readInCurrentConfig() {
  const builder = (envVar: string, region: Region) => {
    return sheets.reduce<Partial<ConfigSheets>>((acc, sheetName) => {
      acc[sheetName] = getJson(envVar, getConfigSheetName(region, sheetName))
      return acc
    }, {}) as ConfigSheets
  }

  englandwales = builder(process.env.ENGWALES_DEF_DIR, Region.EnglandWales)
  scotland = builder(process.env.SCOTLAND_DEF_DIR, Region.Scotland)

  readTime = Date.now()
}

/**
 * Finds the index at which to insert a Case Event by finding the index of an existing DisplayOrder
 * or returning the index of the higher DisplayOrder +1
 */
function getCaseEventInsertIndex(configSheet: ConfigSheets, caseEvent: CaseEvent) {
  const insertIndex = configSheet.CaseEvent.findIndex(o => o.DisplayOrder === caseEvent.DisplayOrder)
  if (insertIndex > -1) {
    return insertIndex
  }

  return findLastIndex(configSheet.CaseEvent, o => o.CaseTypeID === caseEvent.CaseTypeID) + 1
}

/**
 * Upserts a CaseEvent into the correct region's config and into the current session.
 * Inserts according to DisplayOrder, modifying other CaseEvent DisplayOrders where necessary.
 * Will replace where necessary, so changed non-compound keys will get updated
 * @param caseEvent to upsert
 */
export function upsertNewCaseEvent(caseEvent: CaseEvent) {
  const configSheets = getConfigSheetsForCaseTypeID(caseEvent.CaseTypeID)
  const existIndex = configSheets.CaseEvent.findIndex(o => o.ID === caseEvent.ID)

  if (existIndex === -1) {
    const insertIndex = getCaseEventInsertIndex(configSheets, caseEvent)
    configSheets.CaseEvent.splice(insertIndex, 0, caseEvent)

    for (let i = insertIndex + 1; i < configSheets.CaseEvent.length; i++) {
      const event = configSheets.CaseEvent[i]
      if (event.CaseTypeID !== caseEvent.CaseTypeID) continue
      event.DisplayOrder++
    }
  } else {
    configSheets.CaseEvent.splice(existIndex, 1, caseEvent)
  }

  addToSession({ CaseEvent: [caseEvent] })
}

function spliceIndexCaseEventToField(x: CaseEventToField, arr: CaseEventToField[]) {
  let index = findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1

  if (index === -1) {
    index = arr.length
  }

  const eventIDIndex = findLastIndex(arr, o => o.CaseEventID === x.CaseEventID)
  const andPageID = findLastIndex(arr, o => o.CaseEventID === x.CaseEventID && o.PageID === x.PageID)

  if (andPageID > -1) {
    if (x.PageFieldDisplayOrder) {
      const indexOfPrevious = arr.findIndex(o => o.CaseFieldID === x.CaseFieldID && x.PageFieldDisplayOrder - 1 === o.PageFieldDisplayOrder)
      if (indexOfPrevious > -1) {
        index = indexOfPrevious
      }
    }
  } else if (eventIDIndex > -1) {
    index = eventIDIndex
  }

  pushCaseEventToFieldsPageFieldDisplayOrder(arr, x.CaseTypeID, x.CaseEventID, x.PageID, x.PageFieldDisplayOrder)

  return index
}

function spliceIndexCaseTypeId<T extends { CaseTypeId: string }>(x: T, arr: T[]) {
  let index = findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  if (index === -1) {
    index = arr.length
  }
  return index
}

function spliceIndexCaseTypeID<T extends { CaseTypeID: string }>(x: T, arr: T[]) {
  let index = findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  if (index === -1) {
    index = arr.length
  }
  return index
}

function spliceIndexCaseTypeTab(x: CaseTypeTab, arr: CaseTypeTab[]) {
  let index = findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID && o.Channel === x.Channel && o.TabID === x.TabID) + 1

  if (index === -1) {
    index = findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID && o.Channel === x.Channel) + 1
  }

  if (index === -1) {
    index = findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  }

  if (index === -1) {
    index = arr.length
  }

  if (x.TabFieldDisplayOrder === 1) {
    index = arr.findIndex(o => o.CaseTypeID === x.CaseTypeID && o.Channel === x.Channel && o.TabID === x.TabID)
  }

  if (x.TabFieldDisplayOrder) {
    const indexOfPrevious = arr.findIndex(o => o.CaseTypeID === x.CaseTypeID && o.Channel === x.Channel && o.TabID === x.TabID && x.TabFieldDisplayOrder - 1 === o.TabFieldDisplayOrder)
    if (indexOfPrevious > -1) {
      index = indexOfPrevious + 1
    }
  }

  pushCaseTypeTabTabFieldDisplayOrders(arr, x.CaseTypeID, x.Channel, x.TabID, x.TabFieldDisplayOrder)

  return index
}

function spliceIndexEventToComplexType(x: EventToComplexType, arr: EventToComplexType[]) {
  let index = findLastIndex(arr, o => o.CaseFieldID === x.CaseFieldID) + 1

  if (index === -1) {
    index = arr.length
  }

  if (x.FieldDisplayOrder === 1) {
    index = arr.findIndex(o => o.CaseFieldID === x.CaseFieldID)
  }

  if (x.FieldDisplayOrder) {
    const indexOfPrevious = arr.findIndex(o => o.CaseFieldID === x.CaseFieldID && x.FieldDisplayOrder - 1 === o.FieldDisplayOrder)
    index = indexOfPrevious === -1 ? findLastIndex(arr, o => o.CaseFieldID === x.CaseFieldID) + 1 : indexOfPrevious + 1
  }

  pushEventToComplexTypeFieldDisplayOrders(arr, x.CaseEventID, x.CaseFieldID, x.FieldDisplayOrder)

  return index
}

function spliceIndexScrubbed(x: Scrubbed, arr: Scrubbed[]) {
  let index = findLastIndex(arr, o => o.ID === x.ID) + 1

  if (index === -1) {
    index = arr.length
  }

  if (x.DisplayOrder === 1) {
    index = arr.findIndex(o => o.ID === x.ID)
  }

  if (x.DisplayOrder) {
    const indexOfPrevious = arr.findIndex(o => o.ID === x.ID && x.DisplayOrder - 1 === o.DisplayOrder)
    if (indexOfPrevious > -1) {
      index = indexOfPrevious + 1
    }
  }

  pushScrubbedDisplayOrder(arr, x.ID, x.DisplayOrder)

  return index
}

function spliceIndexCaseEvent(x: CaseEvent, arr: CaseEvent[]) {
  let index = findLastIndex(arr, o => o.ID === x.ID && o.CaseTypeID === x.CaseTypeID) + 1

  if (x.DisplayOrder === 1) {
    index = arr.findIndex(o => o.CaseTypeID === x.CaseTypeID)
  }

  if (x.DisplayOrder) {
    const indexOfPrevious = arr.findIndex(o => o.CaseTypeID === x.CaseTypeID && x.DisplayOrder - 1 === o.DisplayOrder)
    if (indexOfPrevious > -1) {
      index = indexOfPrevious + 1
    }
  }

  pushCaseEventsDisplayOrder(arr, x.CaseTypeID, x.DisplayOrder)

  return index
}

function spliceIndexComplexType(x: ComplexType, arr: ComplexType[]) {
  // If this ID is referenced by any other ComplexTypes, put it above them
  const firstRefIndex = arr.findIndex(o => o.FieldType === x.ID || o.FieldTypeParameter === x.ID)

  if (firstRefIndex === -1) {
    // Fallback - just place it with the others with the same ID
    return findLastIndex(arr, o => o.ID === x.ID) + 1
  }

  // Grab the first index of the first instance of the refering ComplexType
  const complexTypeID = arr[firstRefIndex].ID
  const firstInComplexTypeIndex = arr.findIndex(o => o.ID === complexTypeID)

  return firstInComplexTypeIndex
}

export function deleteFromInMemoryConfig(fields: Partial<ConfigSheets>) {
  for (const key of sheets) {
    if (!fields[key]) {
      fields[key] = []
    }
  }

  const deleteOnlyFilter = (o: { CRUD: string }) => o.CRUD.toUpperCase() === "D"
  const ewCaseTypeIDFilter = (o: { CaseTypeID?: string, CaseTypeId?: string }) => (o.CaseTypeID || o.CaseTypeId).startsWith(Region.EnglandWales)

  const scCaseTypeIDFilter = (o: { CaseTypeID?: string, CaseTypeId?: string }) => (o.CaseTypeID || o.CaseTypeId).startsWith(Region.Scotland)

  const ewAuthorisationCaseFields = fields.AuthorisationCaseField.filter(ewCaseTypeIDFilter).filter(deleteOnlyFilter)
  const ewAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(ewCaseTypeIDFilter).filter(deleteOnlyFilter)

  const scAuthorisationCaseFields = fields.AuthorisationCaseField.filter(scCaseTypeIDFilter).filter(deleteOnlyFilter)
  const scAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(scCaseTypeIDFilter).filter(deleteOnlyFilter)

  deleteFromConfig(englandwales, {
    AuthorisationCaseEvent: ewAuthorisationCaseEvents,
    AuthorisationCaseField: ewAuthorisationCaseFields
  })

  deleteFromConfig(scotland, {
    AuthorisationCaseEvent: scAuthorisationCaseEvents,
    AuthorisationCaseField: scAuthorisationCaseFields
  })
}

/**
 * Upserts new fields into the in-memory configs and current session. Does NOT touch the original JSON files.
 * See TODOs in body. This is functional but ordering is not necessarily ideal
 */
export function addToInMemoryConfig(fields: Partial<ConfigSheets>) {
  for (const key of sheets) {
    if (!fields[key]) {
      fields[key] = []
    }
  }

  const ewCaseTypeIDFilter = (o: { CaseTypeID?: string, CaseTypeId?: string }) => (o.CaseTypeID || o.CaseTypeId).startsWith(Region.EnglandWales)
  const ewRegionFilter = (o: FlexExtensions) => (o.flex?.regions as string[]).includes(Region.EnglandWales)

  const scCaseTypeIDFilter = (o: { CaseTypeID?: string, CaseTypeId?: string }) => (o.CaseTypeID || o.CaseTypeId).startsWith(Region.Scotland)
  const scRegionFilter = (o: FlexExtensions) => (o.flex?.regions as string[]).includes(Region.Scotland)

  const ewCaseFields = fields.CaseField.filter(ewCaseTypeIDFilter)
  const ewCaseEventToFields = fields.CaseEventToFields.filter(ewCaseTypeIDFilter)
  const ewAuthorisationCaseFields = fields.AuthorisationCaseField.filter(ewCaseTypeIDFilter)
  const ewAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(ewCaseTypeIDFilter)
  const ewCaseTypeTabs = fields.CaseTypeTab.filter(ewCaseTypeIDFilter)
  const ewCaseEvents = fields.CaseEvent.filter(ewCaseTypeIDFilter)

  const ewScrubbed = fields.Scrubbed.filter(ewRegionFilter)
  const ewComplexTypes = fields.ComplexTypes.filter(ewRegionFilter)
  const ewEventToComplexTypes = fields.EventToComplexTypes.filter(ewRegionFilter)

  const scCaseFields = fields.CaseField.filter(scCaseTypeIDFilter)
  const scCaseEventToFields = fields.CaseEventToFields.filter(scCaseTypeIDFilter)
  const scAuthorisationCaseFields = fields.AuthorisationCaseField.filter(scCaseTypeIDFilter)
  const scAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(scCaseTypeIDFilter)
  const scCaseTypeTabs = fields.CaseTypeTab.filter(scCaseTypeIDFilter)
  const scCaseEvents = fields.CaseEvent.filter(scCaseTypeIDFilter)

  const scScrubbed = fields.Scrubbed.filter(scRegionFilter)
  const scComplexTypes = fields.ComplexTypes.filter(scRegionFilter)
  const scEventToComplexTypes = fields.EventToComplexTypes.filter(scRegionFilter)

  addToConfig(englandwales, {
    AuthorisationCaseEvent: ewAuthorisationCaseEvents,
    AuthorisationCaseField: ewAuthorisationCaseFields,
    CaseEvent: ewCaseEvents,
    CaseEventToFields: ewCaseEventToFields,
    CaseField: ewCaseFields,
    CaseTypeTab: ewCaseTypeTabs,
    ComplexTypes: ewComplexTypes,
    EventToComplexTypes: ewEventToComplexTypes,
    Scrubbed: ewScrubbed
  })

  addToConfig(scotland, {
    AuthorisationCaseEvent: scAuthorisationCaseEvents,
    AuthorisationCaseField: scAuthorisationCaseFields,
    CaseEvent: scCaseEvents,
    CaseEventToFields: scCaseEventToFields,
    CaseField: scCaseFields,
    CaseTypeTab: scCaseTypeTabs,
    ComplexTypes: scComplexTypes,
    EventToComplexTypes: scEventToComplexTypes,
    Scrubbed: scScrubbed
  })

  addToSession({
    AuthorisationCaseField: ewAuthorisationCaseFields,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    AuthorisationCaseEvent: ewAuthorisationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes,
    ComplexTypes: fields.ComplexTypes,
    CaseTypeTab: ewCaseTypeTabs,
    Scrubbed: ewScrubbed,
    CaseEvent: ewCaseEvents
  })

  addToSession({
    AuthorisationCaseField: scAuthorisationCaseFields,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    AuthorisationCaseEvent: scAuthorisationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes,
    ComplexTypes: fields.ComplexTypes,
    CaseTypeTab: scCaseTypeTabs,
    Scrubbed: scScrubbed,
    CaseEvent: scCaseEvents
  })

  deleteFromInMemoryConfig(fields)
}

export function deleteFromConfig(main: Partial<ConfigSheets>, toDelete: Partial<ConfigSheets>) {
  removeFields(main.AuthorisationCaseEvent, toDelete.AuthorisationCaseEvent, COMPOUND_KEYS.AuthorisationCaseEvent)

  removeFields(main.AuthorisationCaseField, toDelete.AuthorisationCaseField, COMPOUND_KEYS.AuthorisationCaseField)

  removeFields(main.CaseField, toDelete.CaseField, COMPOUND_KEYS.CaseField)

  removeFields(main.CaseEventToFields, toDelete.CaseEventToFields, COMPOUND_KEYS.CaseEventToFields)
  // TODO: Handle other types
}

export function addToConfig(to: Partial<ConfigSheets>, from: Partial<ConfigSheets>) {
  upsertFields(to.CaseField, from.CaseField, COMPOUND_KEYS.CaseField, spliceIndexCaseTypeID)

  upsertFields(to.CaseEventToFields, from.CaseEventToFields, COMPOUND_KEYS.CaseEventToFields, spliceIndexCaseEventToField)

  upsertFields(to.AuthorisationCaseEvent, from.AuthorisationCaseEvent, COMPOUND_KEYS.AuthorisationCaseEvent, spliceIndexCaseTypeId)

  upsertFields(to.AuthorisationCaseField, from.AuthorisationCaseField, COMPOUND_KEYS.AuthorisationCaseField, spliceIndexCaseTypeId)

  upsertFields(to.CaseTypeTab, from.CaseTypeTab, COMPOUND_KEYS.CaseTypeTab, spliceIndexCaseTypeTab)

  upsertFields(to.EventToComplexTypes, from.EventToComplexTypes, COMPOUND_KEYS.EventToComplexTypes, spliceIndexEventToComplexType)

  upsertFields(to.ComplexTypes, from.ComplexTypes, COMPOUND_KEYS.ComplexTypes, spliceIndexComplexType)

  upsertFields(to.Scrubbed, from.Scrubbed, COMPOUND_KEYS.Scrubbed, spliceIndexScrubbed)

  upsertFields(to.CaseEvent, from.CaseEvent, COMPOUND_KEYS.CaseEvent, spliceIndexCaseEvent)
}

export function pushEventToComplexTypeFieldDisplayOrders(arr: EventToComplexType[], eventID: string, fieldID: string, start: number) {
  const matching = arr.filter(o => o.CaseEventID === eventID && o.CaseFieldID === fieldID && o.FieldDisplayOrder >= start)
  pushByDisplayOrderField(matching, start, EventToComplexTypeKeys.FieldDisplayOrder)
}

export function pushCaseTypeTabTabFieldDisplayOrders(arr: CaseTypeTab[], caseTypeID: string, channel: string, tabID: string, start: number) {
  const matching = arr.filter(o => o.CaseTypeID === caseTypeID && o.Channel === channel && o.TabID === tabID && o.TabFieldDisplayOrder >= start)
  pushByDisplayOrderField(matching, start, CaseTypeTabKeys.TabFieldDisplayOrder)
}

export function pushCaseEventToFieldsPageFieldDisplayOrder(arr: CaseEventToField[], caseTypeID: string, eventID: string, pageID: number, start: number) {
  const matching = arr.filter(o => o.CaseTypeID === caseTypeID && o.CaseEventID === eventID && o.PageID === pageID && o.PageFieldDisplayOrder >= start)
  pushByDisplayOrderField(matching, start, CaseEventToFieldKeys.PageFieldDisplayOrder)
}

export function pushScrubbedDisplayOrder(arr: Scrubbed[], id: string, start: number) {
  const matching = arr.filter(o => o.ID === id && o.DisplayOrder >= start)
  pushByDisplayOrderField(matching, start, ScrubbedKeys.DisplayOrder)
}

export function pushCaseEventsDisplayOrder(arr: CaseEvent[], caseTypeID: string, start: number) {
  const matching = arr.filter(o => o.CaseTypeID === caseTypeID && o.DisplayOrder >= start)
  pushByDisplayOrderField(matching, start, CaseEventKeys.DisplayOrder)
}

function pushByDisplayOrderField(arr: any[], start: number, displayOrderKey: string) {
  let changesMade = false
  do {
    changesMade = false
    let num = start
    for (const field of arr) {
      if (field[displayOrderKey] === num) {
        field[displayOrderKey]++
        num++
        changesMade = true
      }
    }
  }
  while (changesMade)
}

/**
 * Save the in-memory configs back to their JSON files
 */
export async function saveBackToProject() {
  const templatePath = `{0}${sep}definitions${sep}json${sep}{1}.json`

  for (const sheet of sheets) {
    const eng = format(templatePath, process.env.ENGWALES_DEF_DIR, getConfigSheetName(Region.EnglandWales, sheet))
    const jsonEng = JSON.stringify(englandwales[sheet].map(o => { return { ...o, flex: undefined } }), null, 2)
    writeFileSync(eng, `${jsonEng}${getFileTerminatingCharacter(eng)}`)

    const scot = format(templatePath, process.env.SCOTLAND_DEF_DIR, getConfigSheetName(Region.Scotland, sheet))
    const jsonScot = JSON.stringify(scotland[sheet].map(o => { return { ...o, flex: undefined } }), null, 2)
    writeFileSync(scot, `${jsonScot}${getFileTerminatingCharacter(scot)}`)
  }
}

function getFileTerminatingCharacter(file: string) {
  const contents = readFileSync(file).toString()
  return contents.endsWith('\n') ? '\n' : ''
}

/**
 * Calls the provided function for each role in a mappings object where that role has crud permissions
 * to create an array of authorisations
 * @param mappings The rules to use for mapping
 * @param caseTypeID for the authorisations
 * @param fn responsible for creating an authorisation object when passed a role and crud string
 * @returns an array of authorisations (the result of calling fn for each role)
 */
function createAuthorisations<T>(mappings: RoleMappings, caseTypeID: string, fn: (role: string, crud: string) => T): T[] {
  const region = getRegionFromCaseTypeId(caseTypeID)

  return Object.keys(mappings).map(role => {
    const regionPermissions = mappings[role as Roles]
    const targetPermissions = regionPermissions[region]
    if (!targetPermissions) return undefined

    return fn(role, targetPermissions)
  }).filter(o => o)
}

/**
 * Creates an array of AuthorisationCaseEvent objects
 */
export function createCaseEventAuthorisations(caseTypeID: string = Region.EnglandWales, eventID: string, roleMappings: RoleMappings = defaultRoleMappings) {
  return createAuthorisations<AuthorisationCaseEvent>(roleMappings, caseTypeID, (role, crud) => {
    return { CaseTypeId: caseTypeID, CaseEventID: eventID, UserRole: role, CRUD: crud }
  })
}

/**
 * Creates an array of AuthorisationCaseEvent objects
 */
export function createCaseFieldAuthorisations(caseTypeID: string = Region.EnglandWales, fieldID: string, roleMappings: RoleMappings = defaultRoleMappings) {
  return createAuthorisations<AuthorisationCaseField>(roleMappings, caseTypeID, (role, crud) => {
    return { CaseTypeId: caseTypeID, CaseFieldID: fieldID, UserRole: role, CRUD: crud }
  })
}

/**
 * Load the current session into in-memory configs
 */
export function loadCurrentSessionIntoMemory() {
  addToInMemoryConfig(session.added)
}
