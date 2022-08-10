import { sep } from "path"

export const CASE_FIELD_TYPES = [
  'FixedList',
  'FixedRadioList',
  'MultiSelectList',
  'Label',
  'TextArea',
  'YesOrNo',
  'Text',
  'Number',
  'Collection'
]

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

export const FIELD_TYPES_NEED_PARAMETER = [
  'Collection',
  'DynamicList'
]

export const FIELD_TYPES_NEED_SCRUBBED = [
  'FixedList',
  'FixedRadioList',
  'MultiSelectList',
]

export const NONE = '<none>'
export const CUSTOM = '<custom>'
export const CANCEL = '<cancel>'