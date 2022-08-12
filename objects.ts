import { Answers, AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, EventToComplexType } from 'types/types'

/**
 * Creates a new CaseEvent object using answers provided or defaults
 */
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

/**
 * Creates a new CaseField object using answers provided or defaults
 */
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

/**
 * Creates a new CaseEventToField object using answers provided or defaults
 */
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

/**
 * Creates a new EventToCompledType object using answers provided or defaults
 */
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

/**
 * Removes default values from CaseEventToField to rely on ccd defaults
 */
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

/**
 * Removes default values from CaseField to rely on ccd defaults
 */
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

/**
 * Creates an array of AuthorisationCaseEvent objects.
 * TODO: Refactor so its not specific to ET
 */
export function createAuthorisationCaseEvent(caseTypeID: string = "ET_EnglandWales", eventID: string): AuthorisationCaseEvent[] {
  const userRoleRegion = caseTypeID === "ET_EnglandWales" ? "englandwales" : "scotland"
  return [
    {
      "CaseTypeId": caseTypeID,
      "CaseEventID": eventID,
      "UserRole": "caseworker-employment",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseEventID": eventID,
      "UserRole": "caseworker-employment-etjudge",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseEventID": eventID,
      "UserRole": `caseworker-employment-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseEventID": eventID,
      "UserRole": `caseworker-employment-etjudge-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseEventID": eventID,
      "UserRole": "caseworker-employment-api",
      "CRUD": "CRUD"
    }
  ]
}

/**
 * Creates an array of AuthorisationCaseFields objects.
 * TODO: Refactor so its not specific to ET
 */
export function createAuthorisationCaseFields(caseTypeID: string = "ET_EnglandWales", fieldID: string): AuthorisationCaseField[] {
  const userRoleRegion = caseTypeID === "ET_EnglandWales" ? "englandwales" : "scotland"
  return [
    {
      "CaseTypeId": caseTypeID,
      "CaseFieldID": fieldID,
      "UserRole": "caseworker-employment",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseFieldID": fieldID,
      "UserRole": "caseworker-employment-etjudge",
      "CRUD": "R"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseFieldID": fieldID,
      "UserRole": `caseworker-employment-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseFieldID": fieldID,
      "UserRole": `caseworker-employment-etjudge-${userRoleRegion}`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseFieldID": fieldID,
      "UserRole": `caseworker-employment-legalrep-solicitor`,
      "CRUD": "CRU"
    },
    {
      "CaseTypeId": caseTypeID,
      "CaseFieldID": fieldID,
      "UserRole": "caseworker-employment-api",
      "CRUD": "CRUD"
    },
  ]
}