import 'source-map-support/register'
import { config as envConfig } from 'dotenv'
import { prompt } from 'inquirer'
import { AuthorisationCaseField, CaseEventToField, CaseField } from './types/types'
import { readFileSync, writeFileSync } from 'fs'
import { sep } from 'path'
envConfig()

function checkEnvVars() {
  const needed = [process.env.ENGWALES_DEF_DIR, process.env.SCOTLAND_DEF_DIR]
  const missing = needed.filter(o => !o)
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

let englandwales: {
  CaseField: CaseField[],
  AuthorisationCaseField: AuthorisationCaseField[],
  CaseEventToFields: CaseEventToField[]
}

let scotland: {
  CaseField: CaseField[],
  AuthorisationCaseField: AuthorisationCaseField[],
  CaseEventToFields: CaseEventToField[]
}

function createNewCaseFieldType(): CaseField {
  return {
    CaseTypeID: '',
    ID: '',
    Label: '',
    HintText: '',
    FieldType: '',
    FieldTypeParameter: '',
    RegularExpression: '',
    SecurityClassification: 'Public',
    Min: 0,
    Max: 0
  }
}

function createNewCaseEventToField(): CaseEventToField {
  return {
    CaseTypeID: 'ET_EnglandWales',
    CaseEventID: '',
    CaseFieldID: '',
    DisplayContext: 'READONLY',
    PageID: 1,
    PageDisplayOrder: 1,
    PageFieldDisplayOrder: 1,
    FieldShowCondition: '',
    PageShowCondition: '',
    RetainHiddenValue: 'Yes',
    ShowSummaryChangeOption: 'Y',
    CallBackURLMidEvent: '',
    PageLabel: 'Page Title',
    PageColumnNumber: 1,
    ShowSummaryContentOption: 1,
    RetriesTimeoutURLMidEvent: ''
  }
}

function trimCaseEventToField(obj: CaseEventToField): CaseEventToField {
  const json: Record<string, any> = {}
  for (const key in obj) {
    if (obj[key as keyof (CaseEventToField)]) {
      json[key] = obj[key as keyof (CaseEventToField)]
    }
  }

  if (!json.FieldShowCondition) {
    delete json.RetainHiddenValue
  }

  return json as CaseEventToField
}

function trimCaseField(obj: CaseField): CaseField {
  const json: Record<string, any> = {}
  for (const key in obj) {
    if (obj[key as keyof (CaseField)]) {
      json[key] = obj[key as keyof (CaseField)]
    }
  }

  return json as CaseField
}

function createAuthorisationCaseFields(caseTypeId: string = "ET_EnglandWales", fieldId: string): AuthorisationCaseField[] {
  const userRoleRegion = caseTypeId === "ET_EnglandWales" ? "englandwales" : "scotland"
  return [
    {
      "CaseTypeId": caseTypeId,
      "CaseFieldID": fieldId,
      "UserRole": "caseworker-employment",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseFieldID": fieldId,
      "UserRole": "caseworker-employment-etjudge",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseFieldID": fieldId,
      "UserRole": `caseworker-employment-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseFieldID": fieldId,
      "UserRole": `caseworker-employment-etjudge-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseFieldID": fieldId,
      "UserRole": "caseworker-employment-api",
      "CRUD": "CRUD"
    },
  ]
}

function getJson(envvar: string, name: string) {
  return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())
}

function readInCurrentConfig() {
  englandwales = {
    AuthorisationCaseField: getJson(process.env.ENGWALES_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.ENGWALES_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.ENGWALES_DEF_DIR, "CaseField"),
  }

  scotland = {
    AuthorisationCaseField: getJson(process.env.SCOTLAND_DEF_DIR, "AuthorisationCaseField"),
    CaseEventToFields: getJson(process.env.SCOTLAND_DEF_DIR, "CaseEventToFields"),
    CaseField: getJson(process.env.SCOTLAND_DEF_DIR, "CaseField"),
  }
}

function duplicateFieldsForScotland(caseFields: CaseField[], caseEventToFields: CaseEventToField[], authorisationCaseFields: AuthorisationCaseField[]) {
  const newCaseFields = []
  const newAuthorisations = []
  const newCaseEventToFields = []

  for (const caseField of caseFields) {
    const newObj = Object.assign({}, caseField)
    newObj.CaseTypeID = "ET_Scotland"
    newCaseFields.push(newObj)
  }

  for (const caseEventToField of caseEventToFields) {
    const newObj = Object.assign({}, caseEventToField)
    newObj.CaseTypeID = "ET_Scotland"
    newCaseEventToFields.push(newObj)
  }

  for (const auth of authorisationCaseFields) {
    const newObj = Object.assign({}, auth)
    newObj.CaseTypeId = "ET_Scotland"
    if (newObj.UserRole.endsWith("englandwales")) {
      newObj.UserRole = newObj.UserRole.replace("englandwales", "scotland")
    }
    newAuthorisations.push(newObj)
  }

  caseFields = caseFields.concat(newCaseFields)
  caseEventToFields = caseEventToFields.concat(newCaseEventToFields)
  authorisationCaseFields = authorisationCaseFields.concat(newAuthorisations)

  return {
    caseFields,
    caseEventToFields,
    authorisationCaseFields
  }
}

function addToInMemoryConfig(caseFields: CaseField[], caseEventToFields: CaseEventToField[], authorisationCaseFields: AuthorisationCaseField[]) {
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

}

function saveBackToProject() {
  // return JSON.parse(readFileSync(`${envvar}${sep}definitions${sep}json${sep}${name}.json`).toString())
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(englandwales.CaseField, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(englandwales.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(englandwales.CaseEventToFields, null, 2))

  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseField.json`, JSON.stringify(scotland.CaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}AuthorisationCaseField.json`, JSON.stringify(scotland.AuthorisationCaseField, null, 2))
  writeFileSync(`${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}json${sep}CaseEventToFields.json`, JSON.stringify(scotland.CaseEventToFields, null, 2))
}

async function start() {
  checkEnvVars()
  readInCurrentConfig()

  while (true) {
    const answers = await prompt([
      {
        name: 'Journey',
        message: "What do you want to do?",
        type: 'list',
        choices: [
          'Create a single field',
          'Create a Callback populated Label',
          'Save JSONs and Exit'
        ]
      }
    ])

    console.log(answers)

    if (answers.Journey === "Create a single field") {
      await journeyCreateNewField()
    } else if (answers.Journey === "Create a Callback populated Label") {
      await journeyCreateCallbackPopulatedTextField()
    } else if (answers.Journey === "Save JSONs and Exit") {
      break
    }
  }

  saveBackToProject()

}

async function journeyCreateNewField() {
  const optsFieldType = [
    'FixedList',
    'FixedRadioList',
    'Label',
    'TextArea',
    'YesOrNo',
    'Other'
  ]

  const caseField = createNewCaseFieldType()
  const caseEventToField = createNewCaseEventToField()

  const answers = await prompt(
    [
      { name: 'CaseEventID', message: "Whats the CaseEvent that this field belongs to?" },
      { name: 'ID', message: "What's the ID for this field?", type: 'input' },
      { name: 'Label', message: 'What text should this field have (Label)?', type: 'input' },
      { name: 'HintText', message: 'What HintText should this field have? (enter for nothing)', type: 'input' },
      { name: 'FieldType', message: 'What FieldType should this be?', type: 'list', choices: optsFieldType },
      { name: 'DisplayContext', message: 'Is this field READONLY, OPTIONAL or MANDATORY?', type: 'list', choices: ['READONLY', 'OPTIONAL', 'MANDATORY'] },
      { name: 'PageID', message: 'What page will this field appear on?', type: 'number' },
      { name: 'PageFieldDisplayOrder', message: 'Whats the PageFieldDisplayOrder for this field?', type: 'number' },
      { name: 'PageLabel', message: 'Does this page have a custom title? (leave blank if this is not the first field on that page)', type: 'input' },
      { name: 'PageShowCondition', message: 'Enter a page show condition string (leave blank if not needed)', type: 'input' },
      { name: 'FieldShowCondition', message: 'Enter a field show condition string (leave blank if not needed)', type: 'input' }
    ]
  )

  caseField.CaseTypeID = "ET_EnglandWales"

  caseField.ID = answers.ID
  caseField.Label = answers.Label
  caseField.HintText = answers.HintText
  caseField.FieldType = answers.FieldType

  caseEventToField.CaseTypeID = "ET_EnglandWales"
  caseEventToField.CaseEventID = answers.CaseEventID
  caseEventToField.CaseFieldID = answers.ID
  caseEventToField.DisplayContext = answers.DisplayContext
  caseEventToField.PageID = answers.PageID
  caseEventToField.PageDisplayOrder = answers.PageID
  caseEventToField.PageFieldDisplayOrder = answers.PageFieldDisplayOrder
  caseEventToField.PageLabel = answers.PageLabel
  caseEventToField.PageShowCondition = answers.PageShowCondition
  caseEventToField.FieldShowCondition = answers.FieldShowCondition

  const fieldAuthorisations = createAuthorisationCaseFields("ET_EnglandWales", answers.ID)
  const output = duplicateFieldsForScotland([trimCaseField(caseField)], [trimCaseEventToField(caseEventToField)], fieldAuthorisations)

  addToInMemoryConfig(output.caseFields, output.caseEventToFields, output.authorisationCaseFields)
  console.log(`Added ${output.caseFields.length} caseFields, ${output.caseEventToFields.length} caseEventToFields and ${output.authorisationCaseFields.length} authorisationCaseFields`)
}

async function journeyCreateCallbackPopulatedTextField() {
  const caseField = createNewCaseFieldType()
  const caseEventToField = createNewCaseEventToField()
  const caseFieldLabel = createNewCaseFieldType()
  const caseEventToFieldLabel = createNewCaseEventToField()

  const answers = await prompt(
    [
      { name: 'CaseEventID', message: "Whats the CaseEvent that this field belongs to?" },
      { name: 'ID', message: "What's the ID for this field?", type: 'input' },
      { name: 'PageID', message: 'What page will this field appear on?', type: 'number' },
      { name: 'PageFieldDisplayOrder', message: 'Whats the PageFieldDisplayOrder for this field?', type: 'number' },
      { name: 'PageTitle', message: 'Does this page have a custom title? (leave blank if this is not the first field on that page)', type: 'input' },
      { name: 'PageShowCondition', message: 'Enter a page show condition string (leave blank if not needed)', type: 'input' }
    ]
  )

  caseField.CaseTypeID = "ET_EnglandWales"
  caseFieldLabel.CaseTypeID = "ET_EnglandWales"

  caseField.ID = answers.ID
  caseFieldLabel.ID = `${answers.ID}Label`

  caseField.Label = "Placeholder"
  caseFieldLabel.Label = "${" + caseField.ID + "}"

  caseField.FieldType = "Text"
  caseFieldLabel.FieldType = "Label"

  caseEventToField.CaseTypeID = "ET_EnglandWales"
  caseEventToFieldLabel.CaseTypeID = "ET_EnglandWales"

  caseEventToField.CaseEventID = answers.CaseEventID
  caseEventToFieldLabel.CaseEventID = answers.CaseEventID

  caseEventToField.CaseFieldID = answers.ID
  caseEventToField.CaseFieldID = `${answers.ID}Label`

  caseEventToField.DisplayContext = "READONLY"
  caseEventToFieldLabel.DisplayContext = "READONLY"

  caseEventToField.PageID = answers.PageID || 1
  caseEventToFieldLabel.PageID = caseEventToField.PageID

  caseEventToField.PageDisplayOrder = caseEventToField.PageID
  caseEventToFieldLabel.PageDisplayOrder = caseEventToField.PageID

  caseEventToField.PageFieldDisplayOrder = answers.PageFieldDisplayOrder || 1
  caseEventToFieldLabel.PageFieldDisplayOrder = caseEventToField.PageFieldDisplayOrder + 1

  caseEventToField.PageLabel = answers.PageLabel

  caseEventToFieldLabel.FieldShowCondition = `${answers.ID}Label=\\"dummy\\"`

  caseEventToField.PageShowCondition = answers.PageShowCondition

  const fieldAuthorisations = createAuthorisationCaseFields("ET_EnglandWales", answers.ID)
  const output = duplicateFieldsForScotland(
    [trimCaseField(caseField), trimCaseField(caseFieldLabel)],
    [trimCaseEventToField(caseEventToField), trimCaseEventToField(caseEventToFieldLabel)],
    fieldAuthorisations
  )
  addToInMemoryConfig(output.caseFields, output.caseEventToFields, output.authorisationCaseFields)
  console.log(output)
  console.log(`Added ${output.caseFields.length} caseFields, ${output.caseEventToFields.length} caseEventToFields and ${output.authorisationCaseFields.length} authorisationCaseFields`)
}

start()