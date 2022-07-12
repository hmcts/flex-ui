import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, Session } from './types/types'

export function createNewCaseEvent(): CaseEvent {
  return {
    CaseTypeID: '',
    ID: '',
    Name: '',
    Description: '',
    DisplayOrder: 1,
    "PreConditionState(s)": "*",
    PostConditionState: "*",
    "SecurityClassification": "Public",
    ShowEventNotes: 'N',
    ShowSummary: 'Y',
  }
}

export function createNewCaseFieldType(): CaseField {
  return {
    CaseTypeID: '',
    ID: '',
    Label: '',
    HintText: undefined,
    FieldType: '',
    FieldTypeParameter: undefined,
    RegularExpression: undefined,
    SecurityClassification: 'Public',
    Min: 0,
    Max: 0
  }
}

export function createNewCaseEventToField(): CaseEventToField {
  return {
    CaseTypeID: 'ET_EnglandWales',
    CaseEventID: '',
    CaseFieldID: '',
    DisplayContext: 'READONLY',
    PageID: 1,
    PageDisplayOrder: 1,
    PageFieldDisplayOrder: 1,
    FieldShowCondition: undefined,
    PageShowCondition: undefined,
    RetainHiddenValue: 'Yes',
    ShowSummaryChangeOption: 'N',
    CallBackURLMidEvent: undefined,
    PageLabel: 'Page Title',
    PageColumnNumber: 1,
    ShowSummaryContentOption: undefined,
    RetriesTimeoutURLMidEvent: undefined
  }
}

export function trimCaseEventToField(obj: CaseEventToField): CaseEventToField {
  const json: Record<string, any> = {}
  for (const key in obj) {
    if (obj[key as keyof (CaseEventToField)]) {
      json[key] = obj[key as keyof (CaseEventToField)]
    }
  }

  if (!json.FieldShowCondition) {
    delete json.RetainHiddenValue
  }

  if (obj.PageFieldDisplayOrder !== 1) {
    delete json.PageLabel
  }

  if (obj.ShowSummaryChangeOption === 'N') {
    delete json.ShowSummaryChangeOption
  }

  if (obj.PageColumnNumber === 1) {
    delete json.PageColumnNumber
  }

  return json as CaseEventToField
}

export function trimCaseField(obj: CaseField): CaseField {
  const json: Record<string, any> = {}
  for (const key in obj) {
    if (obj[key as keyof (CaseField)]) {
      json[key] = obj[key as keyof (CaseField)]
    }
  }

  for (const key in json) {
    json[key] = json[key].replace(/\\r\\n/g, '\r\n')
  }

  return json as CaseField
}

export function createAuthorisationCaseEvent(caseTypeId: string = "ET_EnglandWales", eventId: string): AuthorisationCaseEvent[] {
  const userRoleRegion = caseTypeId === "ET_EnglandWales" ? "englandwales" : "scotland"
  return [
    {
      "CaseTypeId": caseTypeId,
      "CaseEventID": eventId,
      "UserRole": "caseworker-employment",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseEventID": eventId,
      "UserRole": "caseworker-employment-etjudge",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseEventID": eventId,
      "UserRole": `caseworker-employment-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseEventID": eventId,
      "UserRole": `caseworker-employment-etjudge-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeId,
      "CaseEventID": eventId,
      "UserRole": "caseworker-employment-api",
      "CRUD": "CRUD"
    }
  ]
}

export function createAuthorisationCaseFields(caseTypeId: string = "ET_EnglandWales", fieldId: string): AuthorisationCaseField[] {
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

export function createNewSession(name: string): Session {
  return {
    name,
    date: new Date(),
    lastAnswers: {},
    added: {
      AuthorisationCaseField: [],
      CaseEventToFields: [],
      CaseField: [],
      Scrubbed: [],
      CaseEvent: [],
      AuthorisationCaseEvent: []
    }
  }
}

export function duplicateFieldsForScotland(caseFields: CaseField[], caseEventToFields: CaseEventToField[], authorisationCaseFields: AuthorisationCaseField[], authorisationCaseEvents: AuthorisationCaseEvent[]) {
  const newCaseFields = []
  const newCaseFieldAuthorisations = []
  const newCaseEventToFields = []
  const newCaseEventAuthorisations = []

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
    newCaseFieldAuthorisations.push(newObj)
  }

  for (const auth of authorisationCaseEvents) {
    const newObj = Object.assign({}, auth)
    newObj.CaseTypeId = "ET_Scotland"
    if (newObj.UserRole.endsWith("englandwales")) {
      newObj.UserRole = newObj.UserRole.replace("englandwales", "scotland")
    }
    newCaseEventAuthorisations.push(newObj)
  }

  caseFields = caseFields.concat(newCaseFields)
  caseEventToFields = caseEventToFields.concat(newCaseEventToFields)
  authorisationCaseFields = authorisationCaseFields.concat(newCaseFieldAuthorisations)
  authorisationCaseEvents = authorisationCaseEvents.concat(newCaseEventAuthorisations)

  return {
    caseFields,
    caseEventToFields,
    authorisationCaseFields,
    authorisationCaseEvents
  }
}