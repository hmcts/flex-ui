import { readFileSync, writeFileSync } from "fs"
import { sep } from "path"
import { findLastIndex, upsertFields } from "../helpers"
import { addToSession } from "../session"
import { exec } from "child_process";
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, EventToComplexType, Scrubbed } from "../types/types"
import { COMPOUND_KEYS } from "./constants";

let englandwales: ConfigSheets
let scotland: ConfigSheets

function getJson(envvar: string, name: string) {
  return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())
}

function getEnglandWales() {
  return englandwales
}

function getScotland() {
  return scotland
}

export function getConfigSheetsForCaseTypeId(caseTypeId: string) {
  return caseTypeId.startsWith("ET_EnglandWales") ? getEnglandWales() : getScotland()
}

function getUniqueByKey<T>(arr: T[], key: keyof (T), defaultOption?: string) {
  return arr.reduce((acc: Record<string, any>, obj: T) => {
    const accKey = String(obj[key])
    if (!acc[accKey]) {
      acc[accKey] = true
    }
    return acc
  }, defaultOption ? { [defaultOption]: true } : {})
}

export function getCaseEventIDOpts(defaultOption?: string) {
  return getUniqueByKey([...englandwales.CaseEvent, ...scotland.CaseEvent], 'ID', defaultOption)
}

export function getScrubbedOpts(defaultOption?: string) {
  return getUniqueByKey([...englandwales.Scrubbed, ...scotland.Scrubbed], 'ID', defaultOption)
}

export function getKnownCaseFieldTypes(defaultOption?: string) {
  return getUniqueByKey([...englandwales.CaseField, ...scotland.CaseField], 'FieldType', defaultOption)
}

export function getKnownCaseFieldTypeParameters(defaultOption?: string) {
  return getUniqueByKey([...englandwales.CaseField, ...scotland.CaseField], 'FieldTypeParameter', defaultOption)
}

export function getKnownCaseTypeIds() {
  return getUniqueByKey([...englandwales.CaseField, ...scotland.CaseField], 'CaseTypeID')
}

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
}

export function upsertNewCaseEvent(caseEvent: CaseEvent) {
  const configSheets = caseEvent.CaseTypeID.startsWith("ET_England") ? englandwales : scotland

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

export function addToInMemoryConfig(fields: Partial<ConfigSheets>) {
  const keys: (keyof ConfigSheets)[] = ['AuthorisationCaseEvent', 'AuthorisationCaseField', 'CaseEvent', 'CaseEventToFields', 'CaseField', 'EventToComplexTypes', 'Scrubbed']

  for (const key of keys) {
    if (!fields[key]) {
      fields[key] = []
    }
  }

  const ewCaseFields = fields.CaseField.filter(o => o.CaseTypeID.startsWith("ET_EnglandWales"))
  const ewCaseEventToFields = fields.CaseEventToFields.filter(o => o.CaseTypeID.startsWith("ET_EnglandWales"))
  const ewAuthorsationCaseFields = fields.AuthorisationCaseField.filter(o => o.CaseTypeId.startsWith("ET_EnglandWales"))
  const ewAuthorsationCaseEvents = fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId.startsWith("ET_EnglandWales"))

  const scCaseFields = fields.CaseField.filter(o => o.CaseTypeID.startsWith("ET_Scotland"))
  const scCaseEventToFields = fields.CaseEventToFields.filter(o => o.CaseTypeID.startsWith("ET_Scotland"))
  const scAuthorsationCaseFields = fields.AuthorisationCaseField.filter(o => o.CaseTypeId.startsWith("ET_Scotland"))
  const scAuthorsationCaseEvents = fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId.startsWith("ET_Scotland"))

  upsertFields(englandwales.CaseField, ewCaseFields, COMPOUND_KEYS.CaseField, (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1)
  upsertFields(englandwales.CaseEventToFields, ewCaseEventToFields, COMPOUND_KEYS.CaseEventToField, (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1)
  upsertFields(englandwales.AuthorisationCaseEvent, ewAuthorsationCaseEvents, COMPOUND_KEYS.AuthorisationCaseEvent, (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1)
  upsertFields(englandwales.AuthorisationCaseField, ewAuthorsationCaseFields, COMPOUND_KEYS.AuthorisationCaseField, (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1)

  upsertFields(englandwales.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexType)

  upsertFields(scotland.CaseField, scCaseFields, COMPOUND_KEYS.CaseField, (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1)
  upsertFields(scotland.CaseEventToFields, scCaseEventToFields, COMPOUND_KEYS.CaseEventToField, (x, arr) => findLastIndex(arr, o => o.CaseTypeID === x.CaseTypeID) + 1)
  upsertFields(scotland.AuthorisationCaseEvent, scAuthorsationCaseEvents, COMPOUND_KEYS.AuthorisationCaseEvent, (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1)
  upsertFields(scotland.AuthorisationCaseField, scAuthorsationCaseFields, COMPOUND_KEYS.AuthorisationCaseField, (x, arr) => findLastIndex(arr, o => o.CaseTypeId === x.CaseTypeId) + 1)

  upsertFields(scotland.EventToComplexTypes, fields.EventToComplexTypes, COMPOUND_KEYS.EventToComplexType)

  addToSession({
    AuthorisationCaseField: ewAuthorsationCaseFields,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: ewAuthorsationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes
  })

  addToSession({
    AuthorisationCaseField: scAuthorsationCaseFields,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: scAuthorsationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes
  })
}

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

  return execGenerateSpreadsheet()
}

export function execImportConfig() {
  return new Promise((resolve, reject) => {
    exec(`${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh ${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-local.xlsx`,
      { cwd: process.env.ECM_DOCKER_DIR }
      , function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error) {
          reject(new Error(`Failed to import EnglandWales defs`))
        }

        exec(`${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh ${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-local.xlsx`,
          { cwd: process.env.ECM_DOCKER_DIR }
          , function (error: any, stdout: any, stderr: any) {
            console.log(`${error}\r\n${stdout}\r\n${stderr}`)
            if (error) {
              reject(new Error(`Failed to import scotland defs`))
            }
            resolve(null)
          }
        );
      }
    );
  })
}

export function execGenerateSpreadsheet() {
  return new Promise((resolve, reject) => {
    exec("yarn generate-excel-local", { cwd: process.env.ENGWALES_DEF_DIR },
      function (error: any, stdout: any, stderr: any) {
        console.log(`${error}\r\n${stdout}\r\n${stderr}`)
        if (error) {
          reject(new Error('Failed to generate spreadsheet for engwales'))
        }

        exec("yarn generate-excel-local", { cwd: process.env.SCOTLAND_DEF_DIR },
          function (error: any, stdout: any, stderr: any) {
            console.log(`${error}\r\n${stdout}\r\n${stderr}`)
            if (error) {
              reject(new Error('Failed to generate spreadsheet for scotland'))
            }

            resolve(null)
          });
      });
  })

}

export function getUniqueCaseFields(region: string) {
  const set = region.startsWith("ET_EnglandWales") ? getEnglandWales() : getScotland()
  return set.CaseField.map(o => o.ID)
}