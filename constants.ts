import { sep } from "path"
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, EventToComplexType, Scrubbed } from "types/types"

export const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY', 'COMPLEX']

export const YES = 'Yes'
export const NO = 'No'
export const YES_OR_NO = [YES, NO]
export const Y_OR_N = ['Y', 'N']
export const NO_DUPLICATE = 'Don\'t duplicate'

export const JOURNEY_DIR = 'journeys'
export const DIST_JOURNEY_DIR = `dist${sep}${JOURNEY_DIR}`

export const FIELD_TYPES_NO_PARAMETER = [
  'Text',
  'Label',
  'YesOrNo',
  'Date',
  'TextArea',
  'Number'
]

export const FIELD_TYPES_NO_MIN_MAX = [
  'Label',
  'YesOrNo',
  'FixedRadioList',
  'FixedList',
  'Document',
  'DynamicList',
  'DynamicRadioList'
]

export const NONE = '<none>'
export const CUSTOM = '<custom>'
export const CANCEL = '<cancel>'

// TODO: Looking for a better name and way to declare this (tried Record<keyof(ConfigSheets), keyof(keyof(ConfigSheets))> but that's not supported).
// Really want full type safety here as a lot relies on this. The only thing we're missing currently is that the keys must be keyof<ConfigSheets>
export const COMPOUND_KEYS: {
  AuthorisationCaseEvent: (keyof (AuthorisationCaseEvent))[],
  AuthorisationCaseField: (keyof (AuthorisationCaseField))[],
  CaseEvent: (keyof (CaseEvent))[],
  CaseEventToFields: (keyof (CaseEventToField))[],
  CaseField: (keyof (CaseField))[],
  EventToComplexTypes: (keyof (EventToComplexType))[],
  Scrubbed: (keyof (Scrubbed))[],
} = {
  AuthorisationCaseEvent: ['CaseEventID', 'CaseTypeId', 'UserRole'],
  AuthorisationCaseField: ['CaseFieldID', 'CaseTypeId', 'UserRole'],
  CaseEvent: ['ID', 'CaseTypeID'],
  CaseEventToFields: ['CaseFieldID', 'CaseEventID', 'CaseTypeID'],
  CaseField: ['ID', 'CaseTypeID'],
  EventToComplexTypes: ['ID', 'CaseEventID', 'CaseFieldID', 'ListElementCode'],
  Scrubbed: ['ID', 'ListElementCode']
}