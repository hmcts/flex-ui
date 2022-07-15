export interface CaseField {
  CaseTypeID: string
  ID: string
  Label: string
  HintText?: string
  FieldType?: string
  FieldTypeParameter?: string
  RegularExpression?: string
  SecurityClassification: "Public"
  Min?: number
  Max?: number
}

export interface AuthorisationCaseField {
  CaseTypeId: string
  CaseFieldID: string
  UserRole: string
  CRUD: string
}

export interface CaseEventToField {
  CaseTypeID: string
  CaseEventID: string
  CaseFieldID: string
  DisplayContext: 'READONLY' | 'OPTIONAL' | 'MANDATORY'
  PageID: number
  PageDisplayOrder: number
  PageFieldDisplayOrder: number
  FieldShowCondition?: string | null
  PageShowCondition?: string | null
  RetainHiddenValue?: 'Yes' | 'No' | null
  ShowSummaryChangeOption?: 'Y' | 'N' | null
  CallBackURLMidEvent?: string | null
  PageLabel?: string | null
  PageColumnNumber?: number | null
  ShowSummaryContentOption?: number | null
  RetriesTimeoutURLMidEvent?: string | null
}

export interface CaseEvent {
  CaseTypeID: string
  ID: string
  Name: string
  Description: string
  DisplayOrder: number
  'PreConditionState(s)': string
  PostConditionState: string
  SecurityClassification: 'Public'
  EventEnablingCondition?: string
  ShowEventNotes?: 'Y' | 'N'
  ShowSummary?: 'Y' | 'N'
  CallBackURLAboutToStartEvent?: string
  CallBackURLAboutToSubmitEvent?: string
  CallBackURLSubmittedEvent?: string
}

export interface EventToComplexType {
  ID: string
  CaseEventID: string
  CaseFieldID: string
  ListElementCode: string
  EventElementLabel: string
  EventHintText?: string
  FieldDisplayOrder: number
  DisplayContext: 'READONLY' | 'OPTIONAL' | 'MANDATORY',
  FieldShowCondition?: string
  RetainHiddenValue?: 'No' | 'Yes'
}

export interface AuthorisationCaseEvent {
  CaseTypeId: string
  CaseEventID: string
  UserRole: string
  CRUD: string
}

export interface Scrubbed {
  ID: string
  ListElementCode: string
  ListElement: string
  DisplayOrder: number
}

export enum SaveMode {
  ENGLANDWALES = 1,
  SCOTLAND = 2,
  BOTH = 0
}

export type ConfigSheets = {
  CaseField: CaseField[],
  AuthorisationCaseField: AuthorisationCaseField[],
  CaseEvent: CaseEvent[],
  CaseEventToFields: CaseEventToField[],
  Scrubbed: Scrubbed[],
  AuthorisationCaseEvent: AuthorisationCaseEvent[],
  EventToComplexTypes: EventToComplexType[]
}

export type Session = {
  name: string
  date: Date | string
  added: ConfigSheets
  lastAnswers: Partial<Record<keyof (CaseField) | keyof (CaseEventToField), any>>
}