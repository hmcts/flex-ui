import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { sep } from 'path'
import { ensurePathExists, findLastIndex, format, getFiles, getUniqueByKey, groupBy, removeFields, upsertFields } from 'app/helpers'
import { addToSession, session } from 'app/session'
import { AuthorisationCaseEvent, AuthorisationCaseField, AuthorisationCaseState, AuthorisationCaseType, CaseEvent, CaseEventKeys, CaseEventToField, CaseEventToFieldKeys, CaseTypeTab, CaseTypeTabKeys, CCDSheetExtension, CCDTypes, ComplexType, ConfigSheets, createNewConfigSheets, EventToComplexType, EventToComplexTypeKeys, extensions, FlexExtensions, RoleToAccessProfile, Scrubbed, ScrubbedKeys, sheets } from 'types/ccd'
import { COMPOUND_KEYS } from 'app/constants'
import { addKnownFeature, clearConfigs, findObject, getCaseEventIDOpts, getKnownCaseFieldIDsByEvent, sheets as globalConfigs } from 'app/configs'

let readTime = 0

export interface ETFlexExtensions extends FlexExtensions {
  flexRegion?: Region
}

export interface CCDTypeWithRegion extends ETFlexExtensions {
  CaseTypeID?: string
  CaseTypeId?: string
}

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

/** Gets the time the configs were last read in */
export function getReadTime() {
  return readTime
}

export function getEnglandWales() {
  return splitGlobalIntoRegional(Region.EnglandWales)
}

export function getScotland() {
  return splitGlobalIntoRegional(Region.Scotland)
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

export function getCombinedSheets() {
  return globalConfigs // lol
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

export function findETObject<T extends FlexExtensions>(keys: Record<string, any>, sheetName: keyof CCDTypes, region?: Region): T | FlexExtensions | undefined {
  const ccd = region === Region.EnglandWales
    ? getEnglandWales()
    : region === Region.Scotland
      ? getScotland()
      : getCombinedSheets()

  return findObject<T>(keys, sheetName, ccd)
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
export function getETCaseEventIDOpts() {
  return getCaseEventIDOpts(getCombinedSheets())
}

/**
 * Get all defined CaseField IDs in englandwales and scotland configs on an event
 */
export function getKnownETCaseFieldIDsByEvent(caseEventId?: string, regions: Region[] = [Region.EnglandWales, Region.Scotland]) {
  return getKnownCaseFieldIDsByEvent(caseEventId, getConfigSheetsFromFlexRegion(regions))
}

export function getConfigSheetName(region: Region, configSheet: keyof (ConfigSheets)) {
  if (configSheet === 'Scrubbed') {
    return `${region.toString().replace('ET_', '')} Scrubbed`
  }
  return configSheet
}

export function getSheetNameTwo(fileName: string) {
  fileName = fileName.substring(fileName.lastIndexOf('/') + 1)
  const regex = /([A-Za-z0-9-]+?)(?:\-(.+?))?(?:-((?:non)?prod))?\.json$/gi.exec(fileName)
  if (!regex) return

  let [_, sheet, feature, ext] = regex

  let internalSheet = sheet.includes('Scrubbed') ? 'Scrubbed' : sheet

  // If we don't know what the sheet is - ignore it as theres no guarentee we can save it back
  if (globalConfigs[internalSheet] === undefined) return
  if (!extensions.includes(ext)) return // Ignore unknown extensions

  if (!ext && feature === 'nonprod' || feature === 'prod') {
    ext = feature
    feature = ''
  }

  return {
    sheet: internalSheet,
    feature: feature || '',
    ext: (ext || '') as CCDSheetExtension
  }
}

function compressAuthorisationCaseState(json: AuthorisationCaseState[]) {
  const compressed = []
  for (const obj of json) {
    // if (!obj.compress) {
    //   compressed.push(obj)
    //   continue
    // }

    let targetAccessControl = compressed.find(o => o.CaseTypeID === obj.CaseTypeID && obj.CaseStateID === o.CaseStateID && o.AccessControl?.length && o.feature === obj.feature && o.ext === obj.ext)
    if (!targetAccessControl) {
      targetAccessControl = { CaseTypeID: obj.CaseTypeID, CaseStateID: obj.CaseStateID, AccessControl: [], feature: obj.feature, ext: obj.ext }
      compressed.push(targetAccessControl)
    }

    const targetCrud = targetAccessControl.AccessControl.find(o => o.CRUD === obj.CRUD)
    if (targetCrud) {
      targetCrud.UserRoles.push(obj.UserRole)
      targetCrud.singles.push(obj)
    } else {
      targetAccessControl.AccessControl.push({ CRUD: obj.CRUD, UserRoles: [obj.UserRole], singles: [obj] })
    }
  }

  // Undo the compression if we only have one user role inside a CRUD

  return compressed
}

function decompressAuthorisationCaseState(json: AuthorisationCaseState[]) {
  const flattened = []
  for (const obj of json) {
    if (!obj.AccessControl?.length) {
      flattened.push(obj)
      continue
    }

    for (const ac of obj.AccessControl) {
      for (const role of ac.UserRoles) {
        flattened.push({ ...obj, AccessControl: undefined, UserRole: role, CRUD: ac.CRUD, compress: true })
      }
    }
  }

  return flattened
}

function compressAuthorisationCaseType(json: AuthorisationCaseType[]) {
  const compressed = []
  for (const obj of json) {
    // if (!obj.compress) {
    //   compressed.push(obj)
    //   continue
    // }

    const find = compressed.find(o => o.CaseTypeId === obj.CaseTypeId && obj.CRUD === o.CRUD && o.UserRoles?.length && o.feature === obj.feature && o.ext === obj.ext)
    if (find) {
      find.UserRoles.push(obj.UserRole)
      find.singles.push(obj)
    } else {
      compressed.push({ CaseTypeId: obj.CaseTypeId, UserRoles: [obj.UserRole], CRUD: obj.CRUD, feature: obj.feature, ext: obj.ext, singles: [obj] })
    }
  }

  for (const obj of compressed) {
    if (obj.UserRoles.length === 1) {
      obj.UserRole = obj.UserRoles[0]
      delete obj.UserRoles
    }
  }

  return compressed
}

function decompressAuthorisationCaseType(json: AuthorisationCaseType[]) {
  const flattened = []
  for (const obj of json) {
    if (!obj.UserRoles?.length) {
      flattened.push(obj)
      continue
    }

    for (const role of obj.UserRoles) {
      flattened.push({ ...obj, UserRole: role, UserRoles: undefined, compress: true })
    }
  }

  return flattened
}

export async function readInCurrentConfig(configs = globalConfigs, ewPath: string, scPath: string) {
  const needRegions = ['ComplexTypes', 'EventToComplexTypes', 'Scrubbed']

  const builder = async (dir: string, region: Region) => {
    // Discover files in the directory
    const files = (await getFiles(dir)).filter(o => o.endsWith('.json'))

    files.forEach(o => {
      // Try detect sheet name
      const { sheet, feature, ext: prod } = getSheetNameTwo(o) || {}
      if (!sheet) return

      // Read in the file
      let json = JSON.parse(readFileSync(o).toString())

      // A few sheets support collapsing similar objects into an array
      // This makes things difficult for flex in terms of defining unique objects
      // Having a choice in how to format objects is nice, but adds a ton of complexity
      // For now, lets unravel these and copy them as objects
      // We can either re-compress on save or just leave them as objects (ccd is fine with either)

      const compressableSheets: (keyof (CCDTypes))[] = ['AuthorisationCaseState', 'AuthorisationCaseType']

      if (sheet === 'AuthorisationCaseState') {
        json = decompressAuthorisationCaseState(json)
      }

      if (sheet === 'AuthorisationCaseType') {
        json = decompressAuthorisationCaseType(json)
      }

      if (needRegions.includes(sheet)) {
        json.forEach((o: CCDTypeWithRegion) => o.flexRegion = region)
      }

      json.forEach((o: CCDTypeWithRegion) => {
        o.feature = feature
        o.ext = prod
      })

      // TODO: Upserting is the better option as it sanitizes input - but theres a known duplicate issue that needs raising with the ET team
      // upsertConfigs(json)
      configs[sheet] = (configs[sheet] || []).concat(...json)
      //console.log(`Added ${json.length} objects from ${o} in ${region} (detected: ${sheet}, ${feature}, ${prod})`)
      addKnownFeature(feature)
    })
  }

  clearConfigs()
  if (ewPath) {
    await builder(`${ewPath}${sep}definitions${sep}json`, Region.EnglandWales)
  }

  if (scPath) {
    await builder(`${scPath}${sep}definitions${sep}json`, Region.Scotland)
  }

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

function spliceIndexEventToComplexType(x: EventToComplexType & CCDTypeWithRegion, arr: Array<EventToComplexType & CCDTypeWithRegion>) {
  let index = findLastIndex(arr, o => o.CaseFieldID === x.CaseFieldID && o.flexRegion === x.flexRegion) + 1

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

  pushEventToComplexTypeFieldDisplayOrders(arr, x.flexRegion, x.CaseEventID, x.CaseFieldID, x.FieldDisplayOrder)

  return index
}

function spliceIndexScrubbed(x: Scrubbed & CCDTypeWithRegion, arr: Array<Scrubbed & CCDTypeWithRegion>) {
  let index = findLastIndex(arr, o => o.ID === x.ID && o.flexRegion === x.flexRegion) + 1

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

  pushScrubbedDisplayOrder(arr, x.ID, x.flexRegion, x.DisplayOrder)

  return index
}

function spliceIndexCaseEvent(x: CaseEvent, arr: CaseEvent[]) {
  let index = findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1

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

function spliceIndexComplexType(x: ComplexType & CCDTypeWithRegion, arr: Array<ComplexType & CCDTypeWithRegion>) {
  // If this ID is referenced by any other ComplexTypes, put it above them
  const firstRefIndex = arr.findIndex(o => x.flexRegion === o.flexRegion && (o.FieldType === x.ID || o.FieldTypeParameter === x.ID))

  if (firstRefIndex === -1) {
    // Fallback - just place it with the others with the same ID
    return findLastIndex(arr, o => x.flexRegion === o.flexRegion && o.ID === x.ID) + 1
  }

  // Grab the first index of the first instance of the refering ComplexType
  const complexTypeID = arr[firstRefIndex].ID
  const firstInComplexTypeIndex = arr.findIndex(o => x.flexRegion === o.flexRegion && o.ID === complexTypeID)

  return firstInComplexTypeIndex
}

function spliceIndexRoleToAccessProfile(x: RoleToAccessProfile & CCDTypeWithRegion, arr: Array<RoleToAccessProfile & CCDTypeWithRegion>) {
  return findLastIndex(arr, o => o.flexRegion === x.flexRegion && o.RoleName === x.RoleName) + 1
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

  deleteFromConfig(globalConfigs, {
    AuthorisationCaseEvent: ewAuthorisationCaseEvents,
    AuthorisationCaseField: ewAuthorisationCaseFields
  })

  deleteFromConfig(globalConfigs, {
    AuthorisationCaseEvent: scAuthorisationCaseEvents,
    AuthorisationCaseField: scAuthorisationCaseFields
  })
}

/**
 * Upserts new fields into the in-memory configs and current session. Does NOT touch the original JSON files.
 */
export function addToInMemoryConfig(fields: Partial<ConfigSheets>) {
  for (const key of sheets) {
    if (!fields[key]) {
      fields[key] = []
    }
  }

  addToConfig(globalConfigs, fields as ConfigSheets)

  addToSession(fields)

  deleteFromInMemoryConfig(fields)
}

export function deleteFromConfig(main: Partial<ConfigSheets>, toDelete: Partial<ConfigSheets>) {
  const andExtFeature = (keys) => [...keys, 'ext', 'feature']

  removeFields(main.AuthorisationCaseEvent, toDelete.AuthorisationCaseEvent, andExtFeature(COMPOUND_KEYS.AuthorisationCaseEvent))

  removeFields(main.AuthorisationCaseField, toDelete.AuthorisationCaseField, andExtFeature(COMPOUND_KEYS.AuthorisationCaseField))

  removeFields(main.CaseField, toDelete.CaseField, andExtFeature(COMPOUND_KEYS.CaseField))

  removeFields(main.CaseEventToFields, toDelete.CaseEventToFields, andExtFeature(COMPOUND_KEYS.CaseEventToFields))
  // TODO: Handle other types
}

export function addToConfig(to: Partial<ConfigSheets>, from: Partial<ConfigSheets>) {
  const andExtFeature = (keys) => [...keys, 'ext', 'feature']

  upsertFields(to.CaseField, from.CaseField, andExtFeature(COMPOUND_KEYS.CaseField), spliceIndexCaseTypeID)

  upsertFields(to.CaseEventToFields, from.CaseEventToFields, andExtFeature(COMPOUND_KEYS.CaseEventToFields), spliceIndexCaseEventToField)

  upsertFields(to.AuthorisationCaseEvent, from.AuthorisationCaseEvent, andExtFeature(COMPOUND_KEYS.AuthorisationCaseEvent), spliceIndexCaseTypeId)

  upsertFields(to.AuthorisationCaseField, from.AuthorisationCaseField, andExtFeature(COMPOUND_KEYS.AuthorisationCaseField), spliceIndexCaseTypeId)

  upsertFields(to.CaseTypeTab, from.CaseTypeTab, andExtFeature(COMPOUND_KEYS.CaseTypeTab), spliceIndexCaseTypeTab)

  upsertFields(to.EventToComplexTypes, from.EventToComplexTypes, andExtFeature(COMPOUND_KEYS.EventToComplexTypes), spliceIndexEventToComplexType)

  upsertFields(to.ComplexTypes, from.ComplexTypes, andExtFeature(COMPOUND_KEYS.ComplexTypes), spliceIndexComplexType)

  upsertFields(to.Scrubbed, from.Scrubbed, andExtFeature(COMPOUND_KEYS.Scrubbed), spliceIndexScrubbed)

  upsertFields(to.CaseEvent, from.CaseEvent, andExtFeature(COMPOUND_KEYS.CaseEvent), spliceIndexCaseEvent)

  upsertFields(to.RoleToAccessProfiles, from.RoleToAccessProfiles, andExtFeature(COMPOUND_KEYS.RoleToAccessProfiles), spliceIndexRoleToAccessProfile)
}

export function pushEventToComplexTypeFieldDisplayOrders(arr: Array<EventToComplexType & CCDTypeWithRegion>, region: Region, eventID: string, fieldID: string, start: number) {
  const matching = arr.filter(o => o.flexRegion === region && o.CaseEventID === eventID && o.CaseFieldID === fieldID && o.FieldDisplayOrder >= start)
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

export function pushScrubbedDisplayOrder(arr: Array<Scrubbed & CCDTypeWithRegion>, id: string, region: Region, start: number) {
  const matching = arr.filter(o => o.ID === id && o.flexRegion === region && o.DisplayOrder >= start)
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
      if (field[displayOrderKey] === num && !field.freeze && field.ext === CCDSheetExtension.NONPROD) {
        field[displayOrderKey]++
        num++
        changesMade = true
      }
    }
  }
  while (changesMade)
}

function removeFlexKeys(ccd: CCDTypeWithRegion) {
  const clone = JSON.parse(JSON.stringify(ccd))
  Object.keys(clone).forEach(key => {
    if (key[0] === key[0].toUpperCase() && key[0] !== '_') return // Only want to remove keys that start with a lowercase character or _ (CCD keys are all WordCase)
    clone[key] = undefined
  })
  return clone
}

function splitGlobalIntoRegional(region: Region, configs = globalConfigs) {
  const getRegionFilter = (region: Region) => (o: CCDTypeWithRegion) => (o.CaseTypeID || o.CaseTypeId || o.flexRegion).startsWith(region)

  return Object.keys(configs).reduce((acc, key) => {
    acc[key] = configs[key].filter(getRegionFilter(region))
    return acc
  }, createNewConfigSheets())
}

function getJsonNameForSheet(sheetName: string, feature?: string, env?: string): string {
  const isEmpty = (x: any) => x === 'undefined' || x === null || x === '' || x === ' '
  if (isEmpty(feature)) {
    feature = undefined
  }

  if (isEmpty(env)) {
    env = undefined
  }

  return `${sheetName}${feature ? `-${feature}` : ''}${env ? `-${env}` : ''}.json`
}

/**
 * Save the in-memory configs back to their JSON files
 */
export async function saveBackToProject(configs = globalConfigs, ewPath = process.env.ENGWALES_DEF_DIR, scPath = process.env.SCOTLAND_DEF_DIR) {
  const ewConfigs = splitGlobalIntoRegional(Region.EnglandWales, configs)
  const scConfigs = splitGlobalIntoRegional(Region.Scotland, configs)
  const byRegion = { [Region.EnglandWales]: ewConfigs, [Region.Scotland]: scConfigs }

  const getSheetName = (sheet: string, region: string) => {
    if (sheet === 'Scrubbed') return `${region} Scrubbed`
    return sheet
  }

  for (const region in byRegion) {
    for (const sheet in byRegion[region]) {
      let json = byRegion[region][sheet] as CCDTypeWithRegion[]

      // if (sheet === 'AuthorisationCaseState') {
      //   json = compressAuthorisationCaseState(json as AuthorisationCaseState[])
      // }

      // if (sheet === 'AuthorisationCaseType') {
      //   json = compressAuthorisationCaseType(json as AuthorisationCaseType[])
      // }

      const byFeature = groupBy(json, 'feature')
      for (const feature in byFeature) {
        const byExt = groupBy(byFeature[feature], 'ext')

        for (const ext in byExt) {
          const json = JSON.stringify(byExt[ext].map(o => removeFlexKeys(o)), null, 2)
          const repo = region === Region.EnglandWales ? ewPath : scPath
          const sheetName = getSheetName(sheet, region.substring(3))
          const fileName = getJsonNameForSheet(sheetName, feature, ext)
          const path = `${repo}${sep}definitions${sep}json${sep}${sheetName}${sep}${fileName}`

          ensurePathExists(path.substring(0, path.lastIndexOf(sep)))
          writeFileSync(path, `${json}${getFileTerminatingCharacter(path)}`)
        }
      }
    }
  }
}

function getFileTerminatingCharacter(file: string) {
  if (!existsSync(file)) return '\n'
  const contents = readFileSync(file).toString() || '\n'
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
export function createCaseEventAuthorisations(caseTypeID: string = Region.EnglandWales, eventID: string, roleMappings: RoleMappings = defaultRoleMappings, ext: CCDSheetExtension = CCDSheetExtension.BASE, feature: string = '') {
  return createAuthorisations<AuthorisationCaseEvent>(roleMappings, caseTypeID, (role, crud) => {
    return { CaseTypeId: caseTypeID, CaseEventID: eventID, UserRole: role, CRUD: crud, ext, feature }
  })
}

/**
 * Creates an array of AuthorisationCaseEvent objects
 */
export function createCaseFieldAuthorisations(caseTypeID: string = Region.EnglandWales, fieldID: string, roleMappings: RoleMappings = defaultRoleMappings, ext: CCDSheetExtension = CCDSheetExtension.BASE, feature: string = '') {
  return createAuthorisations<AuthorisationCaseField>(roleMappings, caseTypeID, (role, crud) => {
    return { CaseTypeId: caseTypeID, CaseFieldID: fieldID, UserRole: role, CRUD: crud, ext, feature }
  })
}

/**
 * Load the current session into in-memory configs
 */
export function loadCurrentSessionIntoMemory() {
  addToInMemoryConfig(session.added)
}
