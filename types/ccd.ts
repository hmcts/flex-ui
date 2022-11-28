export interface CaseField extends FlexExtensions {
  CaseTypeID: string
  ID: string
  Label: string
  HintText: string
  FieldType: string
  FieldTypeParameter: string
  RegularExpression: string
  SecurityClassification: 'Public'
  Min: number
  Max: number
}

export interface AuthorisationCaseField extends FlexExtensions {
  CaseTypeId: string
  CaseFieldID: string
  UserRole: string
  CRUD: string
}

export interface CaseEventToField extends FlexExtensions {
  CaseTypeID: string
  CaseEventID: string
  CaseFieldID: string
  DisplayContext: 'READONLY' | 'OPTIONAL' | 'MANDATORY'
  PageID: number
  PageDisplayOrder: number
  PageFieldDisplayOrder: number
  FieldShowCondition: string
  PageShowCondition: string
  RetainHiddenValue: 'Yes' | 'No'
  ShowSummaryChangeOption: 'Y' | 'N'
  CallBackURLMidEvent: string
  PageLabel: string
  PageColumnNumber: number
  ShowSummaryContentOption: number
  RetriesTimeoutURLMidEvent: string
  CaseEventFieldLabel: string
  CaseEventFieldHint: string
}

export interface CaseEvent extends FlexExtensions {
  CaseTypeID: string
  ID: string
  Name: string
  Description: string
  DisplayOrder: number
  'PreConditionState(s)': string
  PostConditionState: string
  SecurityClassification: 'Public'
  EventEnablingCondition?: string
  ShowEventNotes: 'Y' | 'N'
  ShowSummary: 'Y' | 'N'
  CallBackURLAboutToStartEvent: string
  CallBackURLAboutToSubmitEvent: string
  CallBackURLSubmittedEvent: string
}

export interface EventToComplexType extends FlexExtensions {
  ID: string
  CaseEventID: string
  CaseFieldID: string
  ListElementCode: string
  EventElementLabel: string
  EventHintText: string
  FieldDisplayOrder: number
  DisplayContext: 'READONLY' | 'OPTIONAL' | 'MANDATORY'
  FieldShowCondition: string
  RetainHiddenValue: 'No' | 'Yes'
}

export interface AuthorisationCaseEvent extends FlexExtensions {
  CaseTypeId: string
  CaseEventID: string
  UserRole: string
  CRUD: string
}

export interface Scrubbed extends FlexExtensions {
  ID: string
  ListElementCode: string
  ListElement: string
  DisplayOrder: number
}

export interface ComplexType extends FlexExtensions {
  ID: string
  ListElementCode: string
  FieldType: string
  ElementLabel: string
  FieldTypeParameter: string
  FieldShowCondition: string
  RetainHiddenValue: 'No' | 'Yes'
  DisplayContextParameter: string
  SecurityClassification: 'Public'
  Min: number
  Max: number
  RegularExpression: string
  DisplayOrder: number
  HintText: string
}

export interface CaseTypeTab extends FlexExtensions {
  CaseTypeID: string
  Channel: string
  TabID: string
  TabLabel: string
  TabDisplayOrder: number
  CaseFieldID: string
  TabFieldDisplayOrder: number
  FieldShowCondition: string
  TabShowCondition: string
  DisplayContextParameter: string
}

export interface FlexExtensions {
  flex?: Record<string, any>
}

export interface CCDTypes {
  AuthorisationCaseEvent: AuthorisationCaseEvent
  AuthorisationCaseField: AuthorisationCaseField
  CaseEvent: CaseEvent
  CaseEventToFields: CaseEventToField
  CaseField: CaseField
  CaseTypeTab: CaseTypeTab
  ComplexTypes: ComplexType
  EventToComplexTypes: EventToComplexType
  Scrubbed: Scrubbed
}

export type CompoundKeys<T> = {
  [P in keyof T]: Array<keyof T[P]>
}

export type CCDSheets<T> = {
  [P in keyof T]: Array<T[P]>
}

export type ConfigSheets = CCDSheets<CCDTypes>

export type AllCCDKeys = Partial<AllObjectKeys<CCDTypes>>

type KeyOfAll<T> = T extends T ? keyof T : never
type UnionValue<T, K extends PropertyKey> = T extends Record<K, infer V> ? V : never
type AllObjectKeys<T> = {
  [P in KeyOfAll<T[keyof T]>]: UnionValue<T[keyof T], P>
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
  CaseEventFieldLabel = 'CaseEventFieldLabel',
  CaseEventFieldHint = 'CaseEventFieldHint'
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

export enum ComplexTypeKeys {
  ID = 'ID',
  ListElementCode = 'ListElementCode',
  FieldType = 'FieldType',
  ElementLabel = 'ElementLabel',
  FieldTypeParameter = 'FieldTypeParameter',
  FieldShowCondition = 'FieldShowCondition',
  RetainHiddenValue = 'RetainHiddenValue',
  DisplayContextParameter = 'DisplayContextParameter',
  SecurityClassification = 'SecurityClassification',
  Min = 'Min',
  Max = 'Max',
  RegularExpression = 'RegularExpression',
  DisplayOrder = 'DisplayOrder',
  HintText = 'HintText',
}

export enum CaseTypeTabKeys {
  CaseTypeID = 'CaseTypeID',
  Channel = 'Channel',
  TabID = 'TabID',
  TabLabel = 'TabLabel',
  TabDisplayOrder = 'TabDisplayOrder',
  CaseFieldID = 'CaseFieldID',
  TabFieldDisplayOrder = 'TabFieldDisplayOrder',
  FieldShowCondition = 'FieldShowCondition',
  TabShowCondition = 'TabShowCondition',
  DisplayContextParameter = 'DisplayContextParameter'
}

const sheetsObj: CCDTypes = {
  CaseEvent: null,
  CaseEventToFields: null,
  CaseField: null,
  ComplexTypes: null,
  EventToComplexTypes: null,
  AuthorisationCaseEvent: null,
  AuthorisationCaseField: null,
  Scrubbed: null,
  CaseTypeTab: null
}

export const sheets = Object.keys(sheetsObj) as Array<keyof (CCDTypes)>

export function createNewConfigSheets(): ConfigSheets {
  return sheets.reduce((acc, obj) => {
    acc[obj] = []
    return acc
  }, {}) as ConfigSheets
}
