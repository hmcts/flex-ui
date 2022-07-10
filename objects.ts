import { AuthorisationCaseField, CaseEventToField, CaseField, Session } from './types/types'

export function createNewCaseFieldType(): CaseField {
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
  
  export function createNewCaseEventToField(): CaseEventToField {
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
      ShowSummaryChangeOption: 'N',
      CallBackURLMidEvent: '',
      PageLabel: 'Page Title',
      PageColumnNumber: 1,
      ShowSummaryContentOption: 1,
      RetriesTimeoutURLMidEvent: ''
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
  
    return json as CaseEventToField
  }
  
  export function trimCaseField(obj: CaseField): CaseField {
    const json: Record<string, any> = {}
    for (const key in obj) {
      if (obj[key as keyof (CaseField)]) {
        json[key] = obj[key as keyof (CaseField)]
      }
    }
  
    return json as CaseField
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
      added: {
        AuthorisationCaseField: [],
        CaseEventToFields: [],
        CaseField: [],
        Scrubbed: []
      }
    }
  }