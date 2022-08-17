import { sep } from 'path'
import { CompoundKeys, CCDTypes } from 'types/ccd'

export const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY', 'COMPLEX']

export const YES = 'Yes'
export const NO = 'No'
export const YES_OR_NO = [YES, NO]
export const Y_OR_N = ['Y', 'N']
export const NO_DUPLICATE = 'Don\'t duplicate'

export const JOURNEY_DIR = 'journeys'
export const DIST_JOURNEY_DIR = `dist${sep}${JOURNEY_DIR}`

export const FIELD_TYPES_EXCLUDE_PARAMETER = [
  'Text',
  'Label',
  'YesOrNo',
  'Date',
  'TextArea',
  'Number'
]

export const FIELD_TYPES_EXCLUDE_MIN_MAX = [
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

export const COMPOUND_KEYS: CompoundKeys<CCDTypes> = {
  AuthorisationCaseEvent: ['CaseEventID', 'CaseTypeId', 'UserRole'],
  AuthorisationCaseField: ['CaseFieldID', 'CaseTypeId', 'UserRole'],
  CaseEvent: ['ID', 'CaseTypeID'],
  CaseEventToFields: ['CaseFieldID', 'CaseEventID', 'CaseTypeID'],
  CaseField: ['ID', 'CaseTypeID'],
  EventToComplexTypes: ['ID', 'CaseEventID', 'CaseFieldID', 'ListElementCode'],
  Scrubbed: ['ID', 'ListElementCode']
}
