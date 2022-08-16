import { AllCCDKeys, AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, EventToComplexType } from 'types/ccd'

/**
 * Creates a new CaseEvent object using answers provided or defaults
 */
export function createNewCaseEvent(answers?: AllCCDKeys): CaseEvent {
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
export function createNewCaseField(answers?: AllCCDKeys): CaseField {
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
export function createNewCaseEventToField(answers?: AllCCDKeys): CaseEventToField {
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
export function createNewEventToComplexType(answers?: AllCCDKeys): EventToComplexType {
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
 * Creates a new AuthorisationCaseEvent object using answers provided or defaults
 */
export function createAuthorisationCaseEvent(answers?: AllCCDKeys): AuthorisationCaseEvent {
  return {
    CaseTypeId: answers?.CaseTypeId || answers?.CaseTypeID,
    CaseEventID: answers?.CaseEventID,
    UserRole: answers?.UserRole,
    CRUD: answers?.CRUD || 'R'
  }
}

/**
 * Creates a new AuthorisationCaseField object using answers provided or defaults
 */
export function createAuthorisationCaseField(answers?: AllCCDKeys): AuthorisationCaseField {
  return {
    CaseTypeId: answers?.CaseTypeId || answers?.CaseTypeID,
    CaseFieldID: answers?.CaseFieldID,
    UserRole: answers?.UserRole,
    CRUD: answers?.CRUD || 'R'
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