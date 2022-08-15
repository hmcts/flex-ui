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
  FieldShowCondition?: string
  PageShowCondition?: string
  RetainHiddenValue?: 'Yes' | 'No'
  ShowSummaryChangeOption?: 'Y' | 'N'
  CallBackURLMidEvent?: string
  PageLabel?: string
  PageColumnNumber?: number
  ShowSummaryContentOption?: number
  RetriesTimeoutURLMidEvent?: string
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

export type CompoundKeys<T> = {
  [P in keyof T]: Array<keyof T[P]>
}

export type CCDSheets<T> = {
  [P in keyof T]: Array<T[P]>
}

export type ConfigSheets = CCDSheets<CCDTypes>

export type CCDTypes = {
  AuthorisationCaseEvent: AuthorisationCaseEvent,
  AuthorisationCaseField: AuthorisationCaseField,
  CaseEvent: CaseEvent,
  CaseEventToFields: CaseEventToField,
  CaseField: CaseField,
  EventToComplexTypes: EventToComplexType,
  Scrubbed: Scrubbed
}

// Use these enums when referencing keys, they shouldn't change in CCD but it does provide some type safety

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

export const sheets: (keyof (ConfigSheets))[] = [
  'AuthorisationCaseEvent',
  'AuthorisationCaseField',
  'CaseEvent',
  'CaseEventToFields',
  'CaseField',
  'EventToComplexTypes',
  'Scrubbed'
]

export function createNewConfigSheets() {
  return sheets.reduce((acc, obj) => {
    acc[obj] = []
    return acc
  }, {} as ConfigSheets)
}

type KeyOfAll<T> = T extends T ? keyof T : never

type AllObjectKeys<T> = {
  [P in KeyOfAll<T[keyof T]>]: any
}

export type AllCCDKeys = Partial<AllObjectKeys<CCDTypes>>