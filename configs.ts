import { readFileSync, writeFileSync } from "fs"
import { sep } from "path"
import { findMissingItems, upsertFields } from "./helpers"
import { trimCaseField } from "./objects"
import { addToConfig } from "./session"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, EventToComplexType, SaveMode, Scrubbed } from "./types/types"

let englandwales: ConfigSheets

let scotland: ConfigSheets

function getJson(envvar: string, name: string) {
  return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())
}

export function getEnglandWales() {
  return englandwales
}

export function getScotland() {
  return scotland
}

export function getCaseEventIDOpts(defaultOption: string) {
  return [...englandwales.CaseEvent, ...scotland.CaseEvent]
    .reduce((acc: Record<string, any>, obj: CaseEvent) => {
      if (!acc[obj.ID]) {
        acc[obj.ID] = true
      }
      return acc
    }, { [defaultOption]: true })
}

export function getScrubbedOpts(defaultOption: string) {
  return [...englandwales.Scrubbed, ...scotland.Scrubbed]
    .reduce((acc: Record<string, any>, obj: Scrubbed) => {
      if (!acc[obj.ID]) {
        acc[obj.ID] = true
      }
      return acc
    }, { [defaultOption]: true })
}

export function getCounts() {
  return [...Object.keys(englandwales).map(o => `EnglandWales.${o} has ${englandwales[o as keyof (ConfigSheets)].length} objects`),
  ...Object.keys(scotland).map(o => `Scotland.${o} has ${scotland[o as keyof (ConfigSheets)].length} objects`)]
    .join('\r\n')
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

  addToConfig({
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

  addToConfig({
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

  const ewCaseFields = fields.CaseField!.filter(o => o.CaseTypeID === "ET_EnglandWales")
  const ewCaseEventToFields = fields.CaseEventToFields!.filter(o => o.CaseTypeID === "ET_EnglandWales")
  const ewAuthorsationCaseFields = fields.AuthorisationCaseField!.filter(o => o.CaseTypeId === "ET_EnglandWales")
  const ewAuthorsationCaseEvents = fields.AuthorisationCaseEvent!.filter(o => o.CaseTypeId === "ET_EnglandWales")

  const scCaseFields = fields.CaseField!.filter(o => o.CaseTypeID === "ET_Scotland")
  const scCaseEventToFields = fields.CaseEventToFields!.filter(o => o.CaseTypeID === "ET_Scotland")
  const scAuthorsationCaseFields = fields.AuthorisationCaseField!.filter(o => o.CaseTypeId === "ET_Scotland")
  const scAuthorsationCaseEvents = fields.AuthorisationCaseEvent!.filter(o => o.CaseTypeId === "ET_Scotland")

  upsertFields<CaseField>(englandwales.CaseField, ewCaseFields, ['ID', 'CaseTypeID'], () => englandwales.CaseField.findIndex(o => o.CaseTypeID.endsWith("_Listings")))
  upsertFields<CaseEventToField>(englandwales.CaseEventToFields, ewCaseEventToFields, ['CaseEventID', 'CaseFieldID', 'CaseTypeID'], () => englandwales.CaseEventToFields.findIndex(o => o.CaseTypeID.endsWith("_Listings")))
  upsertFields<AuthorisationCaseEvent>(englandwales.AuthorisationCaseEvent, ewAuthorsationCaseEvents, ['CaseEventID', 'CaseTypeId', 'UserRole'], () => englandwales.AuthorisationCaseEvent.findIndex(o => o.CaseTypeId.endsWith("_Listings")))
  upsertFields<AuthorisationCaseField>(englandwales.AuthorisationCaseField, ewAuthorsationCaseFields, ['CaseFieldID', 'CaseTypeId', 'UserRole'], () => englandwales.AuthorisationCaseField.findIndex(o => o.CaseTypeId.endsWith("_Listings")))

  upsertFields<EventToComplexType>(englandwales.EventToComplexTypes, fields.EventToComplexTypes!, ['ID', 'CaseEventID', 'CaseFieldID'])

  upsertFields<CaseField>(scotland.CaseField, scCaseFields, ['ID', 'CaseTypeID'], () => scotland.CaseField.findIndex(o => o.CaseTypeID.endsWith("_Listings")))
  upsertFields<CaseEventToField>(scotland.CaseEventToFields, scCaseEventToFields, ['CaseEventID', 'CaseFieldID', 'CaseTypeID'], () => scotland.CaseEventToFields.findIndex(o => o.CaseTypeID.endsWith("_Listings")))
  upsertFields<AuthorisationCaseEvent>(scotland.AuthorisationCaseEvent, scAuthorsationCaseEvents, ['CaseEventID', 'CaseTypeId', 'UserRole'], () => scotland.AuthorisationCaseEvent.findIndex(o => o.CaseTypeId.endsWith("_Listings")))
  upsertFields<AuthorisationCaseField>(scotland.AuthorisationCaseField, scAuthorsationCaseFields, ['CaseFieldID', 'CaseTypeId', 'UserRole'], () => scotland.AuthorisationCaseField.findIndex(o => o.CaseTypeId.endsWith("_Listings")))

  upsertFields<EventToComplexType>(scotland.EventToComplexTypes, fields.EventToComplexTypes!, ['ID', 'CaseEventID', 'CaseFieldID'])

  addToConfig({
    AuthorisationCaseField: ewAuthorsationCaseFields,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [], //scCaseEvents
    AuthorisationCaseEvent: ewAuthorsationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes!
  })

  addToConfig({
    AuthorisationCaseField: scAuthorsationCaseFields,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [], //scCaseEvents,
    AuthorisationCaseEvent: scAuthorsationCaseEvents,
    EventToComplexTypes: fields.EventToComplexTypes!
  })
}

export function saveBackToProject(saveMode: SaveMode) {
  // return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())

  if (saveMode === SaveMode.ENGLANDWALES || saveMode === SaveMode.BOTH) {
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(englandwales.CaseField, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(englandwales.AuthorisationCaseField, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(englandwales.CaseEventToFields, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}EnglandWales Scrubbed.json`, JSON.stringify(englandwales.Scrubbed, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseEvent.json`, JSON.stringify(englandwales.CaseEvent, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseEvent.json`, JSON.stringify(englandwales.AuthorisationCaseEvent, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}EventToComplexTypes.json`, JSON.stringify(englandwales.EventToComplexTypes, null, 2))
  }

  if (saveMode === SaveMode.ENGLANDWALES) return

  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(scotland.CaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(scotland.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(scotland.CaseEventToFields, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}Scotland Scrubbed.json`, JSON.stringify(scotland.Scrubbed, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEvent.json`, JSON.stringify(scotland.CaseEvent, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseEvent.json`, JSON.stringify(scotland.AuthorisationCaseEvent, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}EventToComplexTypes.json`, JSON.stringify(scotland.EventToComplexTypes, null, 2))
}

export function executeYarnGenerate() {
  const { exec } = require("child_process");

  exec("yarn generate-excel-local", { cwd: process.env.ENGWALES_DEF_DIR },
    function (error: any, stdout: any, stderr: any) {
      console.log(`${error}\r\n${stdout}\r\n${stderr}`)
      if (error) {
        throw new Error('Failed to generate spreadsheet for engwales')
      }

      exec("yarn generate-excel-local", { cwd: process.env.SCOTLAND_DEF_DIR },
        function (error: any, stdout: any, stderr: any) {
          console.log(`${error}\r\n${stdout}\r\n${stderr}`)
          if (error) {
            throw new Error('Failed to generate spreadsheet for scotland')
          }

          exec(`${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh ${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-local.xlsx`,
            { cwd: process.env.ECM_DOCKER_DIR }
            , function (error: any, stdout: any, stderr: any) {
              console.log(`${error}\r\n${stdout}\r\n${stderr}`)
              if (error) {
                throw new Error(`Failed to import EnglandWales defs`)
              }

              exec(`${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh ${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-local.xlsx`,
                { cwd: process.env.ECM_DOCKER_DIR }
                , function (error: any, stdout: any, stderr: any) {
                  console.log(`${error}\r\n${stdout}\r\n${stderr}`)
                  if (error) {
                    throw new Error(`Failed to import scotland defs`)
                  }
                }
              );
            }
          );
        });
    });
}