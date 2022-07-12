import { readFileSync, writeFileSync } from "fs"
import { sep } from "path"
import { findMissingItems } from "./helpers"
import { trimCaseField } from "./objects"
import { addToConfig } from "./session"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, ConfigSheets, SaveMode, Scrubbed } from "./types/types"

let englandwales: ConfigSheets

let scotland: ConfigSheets

function getJson(envvar: string, name: string) {
  return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())
}

export function getScrubbedOpts(defaultOption: string) {
  return englandwales.Scrubbed.reduce((acc: Record<string, any>, obj: Scrubbed) => {
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
  }

  scotland = {
    AuthorisationCaseField: getJson(process.env.SCOTLAND_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.SCOTLAND_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.SCOTLAND_DEF_DIR, "CaseField"),
    Scrubbed: getJson(process.env.SCOTLAND_DEF_DIR, "Scotland Scrubbed"),
    CaseEvent: getJson(process.env.SCOTLAND_DEF_DIR, "CaseEvent"),
    AuthorisationCaseEvent: getJson(process.env.SCOTLAND_DEF_DIR, "AuthorisationCaseEvent"),
  }
}

export function doesEventExist(caseEvent: CaseEvent) {
  const configSheets = caseEvent.CaseTypeID.startsWith("ET_England") ? englandwales : scotland

  return !!configSheets.CaseEvent.find(o => o.ID === caseEvent.ID)
}

export function insertNewCaseEvent(caseEvent: CaseEvent) {
  const configSheets = caseEvent.CaseTypeID.startsWith("ET_England") ? englandwales : scotland

  const ewInsertIndex = configSheets.CaseEvent.findIndex(o => o.DisplayOrder === caseEvent.DisplayOrder)
  configSheets.CaseEvent.splice(ewInsertIndex, 0, caseEvent)

  for (let i = ewInsertIndex + 1; i < configSheets.CaseEvent.length; i++) {
    const event = configSheets.CaseEvent[i];
    if (event.CaseTypeID !== caseEvent.CaseTypeID) continue
    event.DisplayOrder++
  }

  addToConfig({
    AuthorisationCaseField: [],
    CaseEventToFields: [],
    Scrubbed: [],
    CaseField: [],
    CaseEvent: [caseEvent],
    AuthorisationCaseEvent: []
  })
}

export function addNewScrubbed(opts: Scrubbed[]) {
  englandwales.Scrubbed.splice(englandwales.Scrubbed.length, 0, ...opts)
  scotland.Scrubbed.splice(scotland.Scrubbed.length, 0, ...opts)

  addToConfig({
    AuthorisationCaseEvent: [],
    AuthorisationCaseField: [],
    CaseEvent: [],
    CaseEventToFields: [],
    CaseField: [],
    Scrubbed: opts
  })
}

export function addToInMemoryConfig(fields: ConfigSheets) {
  // We add these in just above _Listing

  const ewCaseFields = findMissingItems<CaseField>(englandwales.CaseField, fields.CaseField.filter(o => o.CaseTypeID === "ET_EnglandWales"), ['ID', 'CaseTypeID'])
  const ewCaseEventToFields = findMissingItems<CaseEventToField>(englandwales.CaseEventToFields, fields.CaseEventToFields.filter(o => o.CaseTypeID === "ET_EnglandWales"), ['CaseEventID', 'CaseFieldID', 'CaseTypeID'])
  const ewAuthorsationCaseFields = findMissingItems<AuthorisationCaseField>(englandwales.AuthorisationCaseField, fields.AuthorisationCaseField.filter(o => o.CaseTypeId === "ET_EnglandWales"), ['CaseFieldID', 'CaseTypeId', 'UserRole'])
  const ewAuthorsationCaseEvents = findMissingItems<AuthorisationCaseEvent>(englandwales.AuthorisationCaseEvent, fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId === "ET_EnglandWales"), ['CaseEventID', 'CaseTypeId', 'UserRole'])
  // const ewCaseEvents = fields.CaseEvent.filter(o => o.CaseTypeID === "ET_EnglandWales")

  const scCaseFields = findMissingItems<CaseField>(scotland.CaseField, fields.CaseField.filter(o => o.CaseTypeID === "ET_Scotland"), ['ID', 'CaseTypeID'])
  const scCaseEventToFields = findMissingItems<CaseEventToField>(scotland.CaseEventToFields, fields.CaseEventToFields.filter(o => o.CaseTypeID === "ET_Scotland"), ['CaseEventID', 'CaseFieldID', 'CaseTypeID'])
  const scAuthorsationCaseFields = findMissingItems<AuthorisationCaseField>(scotland.AuthorisationCaseField, fields.AuthorisationCaseField.filter(o => o.CaseTypeId === "ET_Scotland"), ['CaseFieldID', 'CaseTypeId', 'UserRole'])
  const scAuthorsationCaseEvents = findMissingItems<AuthorisationCaseEvent>(scotland.AuthorisationCaseEvent, fields.AuthorisationCaseEvent.filter(o => o.CaseTypeId === "ET_Scotland"), ['CaseEventID', 'CaseTypeId', 'UserRole'])

  // const scCaseEvents = fields.CaseEvent.filter(o => o.CaseTypeID === "ET_Scotland")

  const ewCaseFieldInsertIndex = englandwales.CaseField.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const ewCaseEventToFieldInsertIndex = englandwales.CaseEventToFields.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const ewAuthorisationInsertIndex = englandwales.AuthorisationCaseField.findIndex(o => o.CaseTypeId.endsWith("_Listings"))
  const ewAuthorisationEventInsertIndex = englandwales.AuthorisationCaseEvent.findIndex(o => o.CaseTypeId.endsWith("_Listings"))
  // const ewCaseEventsInsertIndex = englandwales.CaseEvent.findIndex(o => o.CaseTypeID.endsWith("_Listings"))

  const scCaseFieldInsertIndex = scotland.CaseField.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const scCaseEventToFieldInsertIndex = scotland.CaseEventToFields.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const scAuthorisationInsertIndex = scotland.AuthorisationCaseField.findIndex(o => o.CaseTypeId.endsWith("_Listings"))
  const scAuthorisationEventInsertIndex = scotland.AuthorisationCaseEvent.findIndex(o => o.CaseTypeId.endsWith("_Listings"))
  // const scCaseEventsInsertIndex = scotland.CaseEvent.findIndex(o => o.CaseTypeID.endsWith("_Listings"))

  englandwales.CaseField.splice(ewCaseFieldInsertIndex, 0, ...ewCaseFields)
  englandwales.CaseEventToFields.splice(ewCaseEventToFieldInsertIndex, 0, ...ewCaseEventToFields)
  englandwales.AuthorisationCaseField.splice(ewAuthorisationInsertIndex, 0, ...ewAuthorsationCaseFields)
  englandwales.AuthorisationCaseEvent.splice(ewAuthorisationEventInsertIndex, 0, ...ewAuthorsationCaseEvents)
  // englandwales.CaseEvent.splice(ewCaseEventsInsertIndex, 0, ...ewCaseEvents)

  scotland.CaseField.splice(scCaseFieldInsertIndex, 0, ...scCaseFields)
  scotland.CaseEventToFields.splice(scCaseEventToFieldInsertIndex, 0, ...scCaseEventToFields)
  scotland.AuthorisationCaseField.splice(scAuthorisationInsertIndex, 0, ...scAuthorsationCaseFields)
  scotland.AuthorisationCaseEvent.splice(scAuthorisationEventInsertIndex, 0, ...scAuthorsationCaseEvents)
  // scotland.CaseEvent.splice(scCaseEventsInsertIndex, 0, ...scCaseEvents)

  addToConfig({
    AuthorisationCaseField: ewAuthorsationCaseFields,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [], //scCaseEvents
    AuthorisationCaseEvent: ewAuthorsationCaseEvents
  })

  addToConfig({
    AuthorisationCaseField: scAuthorsationCaseFields,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    Scrubbed: [],
    CaseEvent: [], //scCaseEvents,
    AuthorisationCaseEvent: scAuthorsationCaseEvents
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
  }

  if (saveMode === SaveMode.ENGLANDWALES) return

  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(scotland.CaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(scotland.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(scotland.CaseEventToFields, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}Scotland Scrubbed.json`, JSON.stringify(scotland.Scrubbed, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEvent.json`, JSON.stringify(scotland.CaseEvent, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseEvent.json`, JSON.stringify(scotland.AuthorisationCaseEvent, null, 2))
}

export function executeYarnGenerate() {
  const { exec } = require("child_process");

  exec("yarn generate-excel-local", { cwd: process.env.ENGWALES_DEF_DIR },
    function (error: any, stdout: any, stderr: any) {
      console.log(`${error}\r\n${stdout}\r\n${stderr}`)
      if (error) {
        throw new Error('Failed to generate spreadsheet for engwales')
      }
      exec(`${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh ${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-local.xlsx`,
        { cwd: process.env.ECM_DOCKER_DIR }
        , function (error: any, stdout: any, stderr: any) {
          console.log(`${error}\r\n${stdout}\r\n${stderr}`)
          if (error) {
            throw new error(`Failed to import EnglandWales defs`)
          }

          exec("yarn generate-excel-local", { cwd: process.env.SCOTLAND_DEF_DIR },
            function (error: any, stdout: any, stderr: any) {
              console.log(`${error}\r\n${stdout}\r\n${stderr}`)
              if (error) {
                throw new Error('Failed to generate spreadsheet for scotland')
              }
              exec(`${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh ${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-local.xlsx`,
                { cwd: process.env.ECM_DOCKER_DIR }
                , function (error: any, stdout: any, stderr: any) {
                  console.log(`${error}\r\n${stdout}\r\n${stderr}`)
                  if (error) {
                    throw new error(`Failed to import scotland defs`)
                  }
                }
              );
            });

        }
      );
    });
}