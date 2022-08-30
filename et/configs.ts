import { readFileSync, writeFileSync } from 'fs'
import { sep } from 'path'
import { findLastIndex, format, getUniqueByKey, getUniqueByKeyAsArray, upsertFields } from 'app/helpers'
import { addToSession, session } from 'app/session'
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, ConfigSheets, Scrubbed, sheets } from 'types/ccd'
import { COMPOUND_KEYS } from 'app/constants'

let readTime = 0
let englandwales: ConfigSheets
let scotland: ConfigSheets

export enum Region {
  EnglandWales = 'EnglandWales',
  Scotland = 'Scotland'
}

enum Roles {
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
type RoleMappings = Record<Roles, Partial<RegionPermissions>>

const roleMappings: RoleMappings = {
  [Roles.CaseworkerEmployment]: { [Region.EnglandWales]: 'R', [Region.Scotland]: 'R' },
  [Roles.CaseworkerEmploymentApi]: { [Region.EnglandWales]: 'CRUD', [Region.Scotland]: 'CRUD' },
  [Roles.CaseworkerEmploymentETJudge]: { [Region.EnglandWales]: 'R', [Region.Scotland]: 'R' },
  [Roles.CaseworkerEmploymentETJudgeEnglandWales]: { [Region.EnglandWales]: 'CRU' },
  [Roles.CaseworkerEmploymentETJudgeScotland]: { [Region.Scotland]: 'CRU' },
  [Roles.CaseworkerEmploymentEnglandWales]: { [Region.EnglandWales]: 'R' },
  [Roles.CaseworkerEmploymentLegalRepSolicitor]: { [Region.EnglandWales]: 'CRU', [Region.Scotland]: 'CRU' },
  [Roles.CaseworkerEmploymentScotland]: { [Region.Scotland]: 'R' },
  [Roles.Citizen]: { [Region.EnglandWales]: 'CRU', [Region.Scotland]: 'CRU' }
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
function getEnglandWales() {
  return englandwales
}

/** Getter for scotland */
function getScotland() {
  return scotland
}

/**
 * Mapper function for deciding where to write objects depending on CaseTypeID
 * @param caseTypeID a caseTypeID value
 * @returns either englandwales or scotland
 */
export function getConfigSheetsForCaseTypeID(caseTypeID: string) {
  return caseTypeID.startsWith('ET_EnglandWales') ? getEnglandWales() : getScotland()
}

/**
 * Returns a region enum value based on the CaseTypeID passed in
 */
function getRegionFromCaseTypeId(caseTypeID: string) {
  return caseTypeID.startsWith('ET_EnglandWales') ? Region.EnglandWales : Region.Scotland
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
  return getUniqueByKeyAsArray([...englandwales.CaseField, ...scotland.CaseField], 'FieldType')
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
 * Get all defined CaseType IDs in englandwales and scotland configs
 */
export function getKnownCaseTypeIDs() {
  return getUniqueByKeyAsArray([...englandwales.CaseField, ...scotland.CaseField], 'CaseTypeID')
}

/**
 * Get all defined CaseField IDs in englandwales and scotland configs
 */
export function getKnownCaseFieldIDs() {
  return getUniqueByKeyAsArray([...englandwales.CaseField, ...scotland.CaseField], 'ID')
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
    return `${region.toString()} Scrubbed`
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

/**
 * Upserts Scrubbed items into the correct region's config and into the current session.
 * Will replace where necessary, so changed non-compound keys will get updated (ie, ListElement)
 * @param opts scrubbed options to upsert
 */
export function addNewScrubbed(opts: Scrubbed[]) {
  for (const item of opts) {
    const ewExistIndex = englandwales.Scrubbed.findIndex(o => o.ID === item.ID && o.ListElementCode === item.ListElementCode)

    if (ewExistIndex > -1) {
      englandwales.Scrubbed.splice(ewExistIndex, 1, item)
    } else {
      englandwales.Scrubbed.push(item)
    }

    const scExistIndex = scotland.Scrubbed.findIndex(o => o.ID === item.ID && o.ListElementCode === item.ListElementCode)

    if (scExistIndex > -1) {
      scotland.Scrubbed.splice(scExistIndex, 1, item)
    } else {
      scotland.Scrubbed.push(item)
    }
  }

  addToSession({ Scrubbed: opts })
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

  const ewCaseFields = fields.CaseField.filter(o => o.CaseTypeID.startsWith('ET_EnglandWales'))
  const ewCaseEventToFields = fields.CaseEventToFields.filter(o => o.CaseTypeID.startsWith('ET_EnglandWales'))
  const ewAuthorisationCaseFields = fields.AuthorisationCaseField.filter(o => o.CaseTypeId.startsWith('ET_EnglandWales'))
  const ewAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId.startsWith('ET_EnglandWales'))

  const scCaseFields = fields.CaseField.filter(o => o.CaseTypeID.startsWith('ET_Scotland'))
  const scCaseEventToFields = fields.CaseEventToFields.filter(o => o.CaseTypeID.startsWith('ET_Scotland'))
  const scAuthorisationCaseFields = fields.AuthorisationCaseField.filter(o => o.CaseTypeId.startsWith('ET_Scotland'))
  const scAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId.startsWith('ET_Scotland'))

  // TODO: These group by CaseTypeID but fields should also be grouped further (like Case Fields need to listen to PageID and PageFieldDisplayOrder etc...)

  upsertFields(englandwales.CaseField, ewCaseFields, COMPOUND_KEYS.CaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )

  upsertFields(englandwales.CaseEventToFields, ewCaseEventToFields, COMPOUND_KEYS.CaseEventToFields,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )

  upsertFields(englandwales.AuthorisationCaseEvent, ewAuthorisationCaseEvents, COMPOUND_KEYS.AuthorisationCaseEvent,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )

  upsertFields(englandwales.AuthorisationCaseField, ewAuthorisationCaseFields, COMPOUND_KEYS.AuthorisationCaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )

  upsertFields(englandwales.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexTypes)

  upsertFields(scotland.CaseField, scCaseFields, COMPOUND_KEYS.CaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )
  upsertFields(scotland.CaseEventToFields, scCaseEventToFields, COMPOUND_KEYS.CaseEventToFields,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )
  upsertFields(scotland.AuthorisationCaseEvent, scAuthorisationCaseEvents, COMPOUND_KEYS.AuthorisationCaseEvent,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )
  upsertFields(scotland.AuthorisationCaseField, scAuthorisationCaseFields, COMPOUND_KEYS.AuthorisationCaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )

  upsertFields(scotland.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexTypes)

  addToSession({
    AuthorisationCaseField: ewAuthorisationCaseFields,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    AuthorisationCaseEvent: ewAuthorisationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes
  })

  addToSession({
    AuthorisationCaseField: scAuthorisationCaseFields,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    AuthorisationCaseEvent: scAuthorisationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes
  })
}

/**
 * Save the in-memory configs back to their JSON files
 */
export async function saveBackToProject() {
  const templatePath = `{0}${sep}definitions${sep}json${sep}{1}.json`

  for (const sheet of sheets) {
    const eng = format(templatePath, process.env.ENGWALES_DEF_DIR, getConfigSheetName(Region.EnglandWales, sheet))
    writeFileSync(eng, JSON.stringify(englandwales[sheet], null, 2))

    const scot = format(templatePath, process.env.SCOTLAND_DEF_DIR, getConfigSheetName(Region.Scotland, sheet))
    writeFileSync(scot, JSON.stringify(scotland[sheet], null, 2))
  }
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
export function createCaseEventAuthorisations(caseTypeID = 'ET_EnglandWales', eventID: string) {
  return createAuthorisations<AuthorisationCaseEvent>(roleMappings, caseTypeID, (role, crud) => {
    return { CaseTypeId: caseTypeID, CaseEventID: eventID, UserRole: role, CRUD: crud }
  })
}

/**
 * Creates an array of AuthorisationCaseEvent objects
 */
export function createCaseFieldAuthorisations(caseTypeID = 'ET_EnglandWales', fieldID: string) {
  return createAuthorisations<AuthorisationCaseField>(roleMappings, caseTypeID, (role, crud) => {
    return { CaseTypeId: caseTypeID, CaseFieldID: fieldID, UserRole: role, CRUD: crud }
  })
}

/**
 * Load the current session into in-memory configs
 */
export function loadCurrentSessionIntoMemory() {
  addToInMemoryConfig(session.added)

  addNewScrubbed(session.added.Scrubbed)

  for (const event of session.added.CaseEvent) {
    upsertNewCaseEvent(event)
  }
}
