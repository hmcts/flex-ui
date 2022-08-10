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
  lastAnswers: Answers
}

export type Answers = Partial<Record<keyof (CaseField) | keyof (CaseEventToField) | keyof (CaseEvent) | keyof (EventToComplexType), any>>

export type Journey = {
  group?: string
  text: string | object | (() => string)
  fn?: () => Promise<any>
}

export enum CaseFieldKeys {
  CaseTypeID = 'CaseTypeID',
  ID = 'ID',
  Label = 'Label',
  HintText = 'HintText',
  FieldType = 'FieldType',
  FieldTypeParameter = 'FieldTypeParameter',
  RegularExpression = 'RegularExpression',
  SecurityClassification = 'SecurityClassification',
  Min = 'Min',
  Max = 'Max'
}

export enum AuthorisationCaseFieldKeys {
  CaseTypeId = 'CaseTypeId',
  CaseFieldID = 'CaseFieldID',
  UserRole = 'UserRole',
  CRUD = 'CRUD'
}

export enum CaseEventToFieldKeys {
  CaseTypeID = 'CaseTypeID',
  CaseEventID = 'CaseEventID',
  CaseFieldID = 'CaseFieldID',
  DisplayContext = 'DisplayContext',
  PageID = 'PageID',
  PageDisplayOrder = 'PageDisplayOrder',
  PageFieldDisplayOrder = 'PageFieldDisplayOrder',
  FieldShowCondition = 'FieldShowCondition',
  PageShowCondition = 'PageShowCondition',
  RetainHiddenValue = 'RetainHiddenValue',
  ShowSummaryChangeOption = 'ShowSummaryChangeOption',
  CallBackURLMidEvent = 'CallBackURLMidEvent',
  PageLabel = 'PageLabel',
  PageColumnNumber = 'PageColumnNumber',
  ShowSummaryContentOption = 'ShowSummaryContentOption',
  RetriesTimeoutURLMidEvent = 'RetriesTimeoutURLMidEvent',
}

export enum CaseEventKeys {
  CaseTypeID = 'CaseTypeID',
  ID = 'ID',
  Name = 'Name',
  Description = 'Description',
  DisplayOrder = 'DisplayOrder',
  PreConditionStates = 'PreConditionState(s)',
  PostConditionState = 'PostConditionState',
  SecurityClassification = 'SecurityClassification',
  EventEnablingCondition = 'EventEnablingCondition',
  ShowEventNotes = 'ShowEventNotes',
  ShowSummary = 'ShowSummary',
  CallBackURLAboutToStartEvent = 'CallBackURLAboutToStartEvent',
  CallBackURLAboutToSubmitEvent = 'CallBackURLAboutToSubmitEvent',
  CallBackURLSubmittedEvent = 'CallBackURLSubmittedEvent',
}

export enum EventToComplexTypeKeys {
  ID = 'ID',
  CaseEventID = 'CaseEventID',
  CaseFieldID = 'CaseFieldID',
  ListElementCode = 'ListElementCode',
  EventElementLabel = 'EventElementLabel',
  EventHintText = 'EventHintText',
  FieldDisplayOrder = 'FieldDisplayOrder',
  DisplayContext = 'DisplayContext',
  FieldShowCondition = 'FieldShowCondition',
  RetainHiddenValue = 'RetainHiddenValue',
}

export enum AuthorisationCaseEventKeys {
  CaseTypeId = 'CaseTypeId',
  CaseEventID = 'CaseEventID',
  UserRole = 'UserRole',
  CRUD = 'CRUD',
}

export enum ScrubbedKeys {
  ID = 'ID',
  ListElementCode = 'ListElementCode',
  ListElement = 'ListElement',
  DisplayOrder = 'DisplayOrder',
}

