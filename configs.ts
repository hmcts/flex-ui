import { readFileSync, writeFileSync } from "fs"
import { sep } from "path"
import { addToConfig } from "./session"
import { AuthorisationCaseField, CaseEventToField, CaseField, ConfigSheets, SaveMode, Scrubbed } from "./types/types"

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
  return [...Object.keys(englandwales).map(o => `EnglandWales.${o} has ${englandwales[o as keyof(ConfigSheets)].length} objects`),
  ...Object.keys(scotland).map(o => `Scotland.${o} has ${scotland[o as keyof(ConfigSheets)].length} objects`)]
  .join('\r\n')
}

export function readInCurrentConfig() {
  englandwales = {
    AuthorisationCaseField: getJson(process.env.ENGWALES_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.ENGWALES_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.ENGWALES_DEF_DIR, "CaseField"),
    Scrubbed: getJson(process.env.ENGWALES_DEF_DIR, "EnglandWales Scrubbed"),
  }

  scotland = {
    AuthorisationCaseField: getJson(process.env.SCOTLAND_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.SCOTLAND_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.SCOTLAND_DEF_DIR, "CaseField"),
    Scrubbed: getJson(process.env.SCOTLAND_DEF_DIR, "Scotland Scrubbed"),
  }
}

export function addNewScrubbed(opts: Scrubbed[]) {
  englandwales.Scrubbed.splice(englandwales.Scrubbed.length, 0, ...opts)
  scotland.Scrubbed.splice(scotland.Scrubbed.length, 0, ...opts)
}

export function addToInMemoryConfig(caseFields: CaseField[], caseEventToFields: CaseEventToField[], authorisationCaseFields: AuthorisationCaseField[]) {
  // We add these in just above _Listing

  const ewCaseFields = caseFields.filter(o => o.CaseTypeID === "ET_EnglandWales")
  const ewCaseEventToFields = caseEventToFields.filter(o => o.CaseTypeID === "ET_EnglandWales")
  const ewAuthorsations = authorisationCaseFields.filter(o => o.CaseTypeId === "ET_EnglandWales")

  const scCaseFields = caseFields.filter(o => o.CaseTypeID === "ET_Scotland")
  const scCaseEventToFields = caseEventToFields.filter(o => o.CaseTypeID === "ET_Scotland")
  const scAuthorsations = authorisationCaseFields.filter(o => o.CaseTypeId === "ET_Scotland")

  const ewCaseFieldInsertIndex = englandwales.CaseField.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const ewCaseEventToFieldInsertIndex = englandwales.CaseEventToFields.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const ewAuthorisationInsertIndex = englandwales.AuthorisationCaseField.findIndex(o => o.CaseTypeId.endsWith("_Listings"))

  const scCaseFieldInsertIndex = scotland.CaseField.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const scCaseEventToFieldInsertIndex = scotland.CaseEventToFields.findIndex(o => o.CaseTypeID.endsWith("_Listings"))
  const scAuthorisationInsertIndex = scotland.AuthorisationCaseField.findIndex(o => o.CaseTypeId.endsWith("_Listings"))

  englandwales.CaseField.splice(ewCaseFieldInsertIndex, 0, ...ewCaseFields)
  englandwales.CaseEventToFields.splice(ewCaseEventToFieldInsertIndex, 0, ...ewCaseEventToFields)
  englandwales.AuthorisationCaseField.splice(ewAuthorisationInsertIndex, 0, ...ewAuthorsations)

  scotland.CaseField.splice(scCaseFieldInsertIndex, 0, ...scCaseFields)
  scotland.CaseEventToFields.splice(scCaseEventToFieldInsertIndex, 0, ...scCaseEventToFields)
  scotland.AuthorisationCaseField.splice(scAuthorisationInsertIndex, 0, ...scAuthorsations)
  
  addToConfig({
    AuthorisationCaseField: ewAuthorsations,
    CaseField: ewCaseFields,
    CaseEventToFields: ewCaseEventToFields,
    Scrubbed: []
  })

  addToConfig({
    AuthorisationCaseField: scAuthorsations,
    CaseField: scCaseFields,
    CaseEventToFields: scCaseEventToFields,
    Scrubbed: []
  })
}

export function saveBackToProject(saveMode: SaveMode) {
  // return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())
  if (saveMode === SaveMode.ENGLANDWALES || saveMode === SaveMode.BOTH) {
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(englandwales.CaseField, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(englandwales.AuthorisationCaseField, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(englandwales.CaseEventToFields, null, 2))
    writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}EnglandWales Scrubbed.json`, JSON.stringify(englandwales.Scrubbed, null, 2))
  }

  if (saveMode === SaveMode.ENGLANDWALES) return

  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(scotland.CaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(scotland.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(scotland.CaseEventToFields, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}Scotland Scrubbed.json`, JSON.stringify(scotland.Scrubbed, null, 2))
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