import { Answers, AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, EventToComplexType, Session } from './types/types'

export function createNewCaseEvent(answers?: Answers): CaseEvent {
  return {
    CaseTypeID: answers?.CaseTypeID || '',
    ID: answers?.ID || '',
    Name: answers?.Name || '',
    Description: answers?.Description || '',
    DisplayOrder: answers?.DisplayOrder || 1,
    "PreConditionState(s)": answers?.['PreConditionState(s)'] || "*",
    PostConditionState: answers?.PostConditionState || "*",
    "SecurityClassification": "Public",
    ShowEventNotes: answers?.ShowEventNotes || 'N',
    ShowSummary: answers?.ShowSummary || 'Y',
    EventEnablingCondition: answers?.EventEnablingCondition || '',
    CallBackURLAboutToStartEvent: answers?.CallBackURLAboutToStartEvent || '',
    CallBackURLAboutToSubmitEvent: answers?.CallBackURLAboutToSubmitEvent || '',
    CallBackURLSubmittedEvent: answers?.CallBackURLSubmittedEvent || ''
  }
}

export function createNewCaseField(answers?: Answers): CaseField {
  return {
    CaseTypeID: answers?.CaseTypeID || '',
    ID: answers?.ID || '',
    Label: answers?.Label || '',
    HintText: answers?.HintText,
    FieldType: answers?.FieldType,
    FieldTypeParameter: answers?.FieldTypeParameter,
    RegularExpression: answers?.RegularExpression,
    SecurityClassification: 'Public',
    Min: answers?.Min,
    Max: answers?.Max
  }
}

export function createNewCaseEventToField(answers?: Answers): CaseEventToField {
  return {
    CaseTypeID: answers?.CaseTypeID || 'ET_EnglandWales',
    CaseEventID: answers?.CaseEventID || '',
    CaseFieldID: answers?.CaseFieldID || answers?.ID || '',
    DisplayContext: answers?.DisplayContext || 'READONLY',
    PageID: answers?.PageID || 1,
    PageDisplayOrder: answers?.PageDisplayOrder || answers?.PageID || 1,
    PageFieldDisplayOrder: answers?.PageFieldDisplayOrder || 1,
    FieldShowCondition: answers?.FieldShowCondition,
    PageShowCondition: answers?.PageShowCondition,
    RetainHiddenValue: answers?.RetainHiddenValue || 'Yes',
    ShowSummaryChangeOption: answers?.ShowSummaryChangeOption || 'N',
    CallBackURLMidEvent: answers?.CallBackURLMidEvent?.startsWith('/') ? ("${ET_COS_URL}" + answers.CallBackURLMidEvent) : answers?.CallBackURLMidEvent,
    PageLabel: answers?.PageLabel || '',
    PageColumnNumber: answers?.PageColumnNumber || 1,
    ShowSummaryContentOption: answers?.ShowSummaryContentOption,
    RetriesTimeoutURLMidEvent: answers?.RetriesTimeoutURLMidEvent
  }
}

export function createNewEventToComplexType(answers?: Answers): EventToComplexType {
  return {
    ID: answers?.ID || '',
    CaseFieldID: answers?.CaseFieldID || '',
    CaseEventID: answers?.CaseEventID || '',
    ListElementCode: answers?.ListElementCode || '',
    EventElementLabel: answers?.EventElementLabel || '',
    FieldDisplayOrder: answers?.FieldDisplayOrder || 1,
    DisplayContext: answers?.DisplayContext || 'OPTIONAL',
    FieldShowCondition: answers?.FieldShowCondition
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
      "UserRole": `caseworker-employment-legalrep-solicitor`,
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
      AuthorisationCaseEvent: [],
      EventToComplexTypes: [],
    }
  }
}

function swapRegions(input: string) {
  if (input.endsWith("englandwales")) {
    return input.replace("englandwales", "scotland")
  }
  if (input.endsWith("scotland")) {
    return input.replace("scotland", "englandwales")
  }
  return input
}



export function duplicateFieldsFor(caseTypeId: string, caseFields: CaseField[], caseEventToFields: CaseEventToField[], authorisationCaseFields: AuthorisationCaseField[], authorisationCaseEvents: AuthorisationCaseEvent[]) {
  const newCaseFields = []
  const newCaseFieldAuthorisations = []
  const newCaseEventToFields = []
  const newCaseEventAuthorisations = []

  for (const caseField of caseFields) {
    const newObj = Object.assign({}, caseField)
    newObj.CaseTypeID = caseTypeId
    newCaseFields.push(newObj)
  }

  for (const caseEventToField of caseEventToFields) {
    const newObj = Object.assign({}, caseEventToField)
    newObj.CaseTypeID = caseTypeId
    newCaseEventToFields.push(newObj)
  }

  for (const auth of authorisationCaseFields) {
    const newObj = Object.assign({}, auth)
    newObj.CaseTypeId = caseTypeId
    newObj.UserRole = swapRegions(newObj.UserRole)
    newCaseFieldAuthorisations.push(newObj)
  }

  for (const auth of authorisationCaseEvents) {
    const newObj = Object.assign({}, auth)
    newObj.CaseTypeId = caseTypeId
    newObj.UserRole = swapRegions(newObj.UserRole)
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