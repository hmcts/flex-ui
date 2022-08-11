import { readFileSync, writeFileSync } from "fs"
import { sep } from "path"
import { findLastIndex, getUniqueByKey, getUniqueByKeyAsArray, upsertFields } from "app/helpers"
import { addToSession } from "app/session"
import { CaseEvent, ConfigSheets, Scrubbed } from "types/types"
import { COMPOUND_KEYS } from "app/constants";

let readTime: number = 0
let englandwales: ConfigSheets
let scotland: ConfigSheets

/**
 * Gets the parsed JSON file contents
 * @param regionDir repo folder that contains definitions (ie, et-ccd-definitions-scotland)
 * @param name of the JSON file (ie, CaseField)
 * @returns parsed JSON file
 */
function getJson(regionDir: string, name: string) {
  return JSON.parse(readFileSync(`${regionDir}${sep}definitions${sep}json${sep}${name}.json`).toString())
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
 * @param caseTypeId a caseTypeID value
 * @returns either englandwales or scotland
 */
export function getConfigSheetsForCaseTypeId(caseTypeId: string) {
  return caseTypeId.startsWith("ET_EnglandWales") ? getEnglandWales() : getScotland()
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
export function getKnownCaseTypeIds() {
  return getUniqueByKeyAsArray([...englandwales.CaseField, ...scotland.CaseField], 'CaseTypeID')
}

/**
 * Get all defined CaseField IDs in englandwales and scotland configs
 */
export function getKnownCaseFieldIds() {
  return getUniqueByKeyAsArray([...englandwales.CaseField, ...scotland.CaseField], 'ID')
}

/**
 * Replace in-memory configs by reading in both englandwales and scotland configs from their repo folders.
 */
export function readInCurrentConfig() {
  englandwales = {
    AuthorisationCaseField: getJson(process.env.ENGWALES_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.ENGWALES_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.ENGWALES_DEF_DIR, "CaseField"),
    Scrubbed: getJson(process.env.ENGWALES_DEF_DIR, "EnglandWales Scrubbed"),
    CaseEvent: getJson(process.env.ENGWALES_DEF_DIR, "CaseEvent"),
    AuthorisationCaseEvent: getJson(process.env.ENGWALES_DEF_DIR, "AuthorisationCaseEvent"),
    EventToComplexTypes: getJson(process.env.ENGWALES_DEF_DIR, "EventToComplexTypes")
  }

  scotland = {
    AuthorisationCaseField: getJson(process.env.SCOTLAND_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.SCOTLAND_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.SCOTLAND_DEF_DIR, "CaseField"),
    Scrubbed: getJson(process.env.SCOTLAND_DEF_DIR, "Scotland Scrubbed"),
    CaseEvent: getJson(process.env.SCOTLAND_DEF_DIR, "CaseEvent"),
    AuthorisationCaseEvent: getJson(process.env.SCOTLAND_DEF_DIR, "AuthorisationCaseEvent"),
    EventToComplexTypes: getJson(process.env.SCOTLAND_DEF_DIR, "EventToComplexTypes")
  }

  readTime = Date.now()
}

/**
 * Upserts a CaseEvent into the correct region's config and into the current session. 
 * Inserts according to DisplayOrder, modifying other CaseEvent DisplayOrders where necessary.
 * Will replace where necessary, so changed non-compound keys will get updated
 * @param caseEvent to upsert
 */
export function upsertNewCaseEvent(caseEvent: CaseEvent) {
  const configSheets = getConfigSheetsForCaseTypeId(caseEvent.CaseTypeID)
  const existIndex = configSheets.CaseEvent.findIndex(o => o.ID === caseEvent.ID)

  if (existIndex === -1) {
    const ewInsertIndex = configSheets.CaseEvent.findIndex(o => o.DisplayOrder === caseEvent.DisplayOrder)
    configSheets.CaseEvent.splice(ewInsertIndex, 0, caseEvent)

    for (let i = ewInsertIndex + 1; i < configSheets.CaseEvent.length; i++) {
      const event = configSheets.CaseEvent[i];
      if (event.CaseTypeID !== caseEvent.CaseTypeID) continue
      event.DisplayOrder++
    }
  } else {
    configSheets.CaseEvent.splice(existIndex, 1, caseEvent)
  }

  addToSession({
    AuthorisationCaseField: [],
    CaseEventToFields: [],
    Scrubbed: [],
    CaseField: [],
    CaseEvent: [caseEvent],
    AuthorisationCaseEvent: [],
    EventToComplexTypes: [],
  })
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

  addToSession({
    AuthorisationCaseEvent: [],
    AuthorisationCaseField: [],
    CaseEvent: [],
    CaseEventToFields: [],
    CaseField: [],
    Scrubbed: opts,
    EventToComplexTypes: []
  })
}

/**
 * Upserts new fields into the in-memory configs and current session. Does NOT touch the original JSON files.
 * See TODOs in body. This is functional but ordering is not necessarily ideal
 */
export function addToInMemoryConfig(fields: Partial<ConfigSheets>) {
  const keys: (keyof ConfigSheets)[] = ['AuthorisationCaseEvent', 'AuthorisationCaseField', 'CaseEvent', 'CaseEventToFields', 'CaseField', 'EventToComplexTypes', 'Scrubbed']

  for (const key of keys) {
    if (!fields[key]) {
      fields[key] = []
    }
  }

  const ewCaseFields = fields.CaseField.filter(o => o.CaseTypeID.startsWith("ET_EnglandWales"))
  const ewCaseEventToFields = fields.CaseEventToFields.filter(o => o.CaseTypeID.startsWith("ET_EnglandWales"))
  const ewAuthorisationCaseFields = fields.AuthorisationCaseField.filter(o => o.CaseTypeId.startsWith("ET_EnglandWales"))
  const ewAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId.startsWith("ET_EnglandWales"))

  const scCaseFields = fields.CaseField.filter(o => o.CaseTypeID.startsWith("ET_Scotland"))
  const scCaseEventToFields = fields.CaseEventToFields.filter(o => o.CaseTypeID.startsWith("ET_Scotland"))
  const scAuthorisationCaseFields = fields.AuthorisationCaseField.filter(o => o.CaseTypeId.startsWith("ET_Scotland"))
  const scAuthorisationCaseEvents = fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId.startsWith("ET_Scotland"))

  // TODO: These group by CaseTypeID but fields should also be grouped further (like Case Fields need to listen to PageID and PageFieldDisplayOrder etc...)

  upsertFields(englandwales.CaseField, ewCaseFields, COMPOUND_KEYS.CaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )

  upsertFields(englandwales.CaseEventToFields, ewCaseEventToFields, COMPOUND_KEYS.CaseEventToField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )

  upsertFields(englandwales.AuthorisationCaseEvent, ewAuthorisationCaseEvents, COMPOUND_KEYS.AuthorisationCaseEvent,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )

  upsertFields(englandwales.AuthorisationCaseField, ewAuthorisationCaseFields, COMPOUND_KEYS.AuthorisationCaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )

  upsertFields(englandwales.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexType)

  upsertFields(scotland.CaseField, scCaseFields, COMPOUND_KEYS.CaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )
  upsertFields(scotland.CaseEventToFields, scCaseEventToFields, COMPOUND_KEYS.CaseEventToField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1
  )
  upsertFields(scotland.AuthorisationCaseEvent, scAuthorisationCaseEvents, COMPOUND_KEYS.AuthorisationCaseEvent,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )
  upsertFields(scotland.AuthorisationCaseField, scAuthorisationCaseFields, COMPOUND_KEYS.AuthorisationCaseField,
    (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1
  )

  upsertFields(scotland.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexType)

  addToSession({
    AuthorisationCaseField: ewAuthorisationCaseFields,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: ewAuthorisationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes
  })

  addToSession({
    AuthorisationCaseField: scAuthorisationCaseFields,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: scAuthorisationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes
  })
}

/**
 * Save the in-memory configs back to their JSON files
 */
export async function saveBackToProject() {
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(englandwales.CaseField, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(englandwales.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(englandwales.CaseEventToFields, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}EnglandWales Scrubbed.json`, JSON.stringify(englandwales.Scrubbed, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseEvent.json`, JSON.stringify(englandwales.CaseEvent, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseEvent.json`, JSON.stringify(englandwales.AuthorisationCaseEvent, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}EventToComplexTypes.json`, JSON.stringify(englandwales.EventToComplexTypes, null, 2))

  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(scotland.CaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(scotland.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(scotland.CaseEventToFields, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}Scotland Scrubbed.json`, JSON.stringify(scotland.Scrubbed, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEvent.json`, JSON.stringify(scotland.CaseEvent, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseEvent.json`, JSON.stringify(scotland.AuthorisationCaseEvent, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}EventToComplexTypes.json`, JSON.stringify(scotland.EventToComplexTypes, null, 2))
}