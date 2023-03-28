import { sep } from 'path'
import { CompoundKeys, CCDTypes } from 'types/ccd'

export const DISPLAY_CONTEXT_OPTIONS = ['READONLY', 'OPTIONAL', 'MANDATORY', 'COMPLEX']

export const YES = 'Yes'
export const NO = 'No'
export const YES_OR_NO = [YES, NO]
export const Y_OR_N = ['Y', 'N']
export const NO_DUPLICATE = 'Don\'t duplicate'
export const MULTI = '<multi-select>'
export const NEW = '<new>'

export const JOURNEY_DIR = 'journeys'
export const DIST_JOURNEY_DIR = `dist${sep}${JOURNEY_DIR}`

export const FIELD_TYPES_EXCLUDE_PARAMETER = [
  'Text',
  'Label',
  'YesOrNo',
  'Date',
  'TextArea',
  'Number',
  'DynamicList'
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

/** Pulled from https://tools.hmcts.net/confluence/display/RCCD/CCD+Supported+Field+Types */
export const CCD_FIELD_TYPES = [
  'Address',
  'AddressUK',
  'AddressGlobal',
  'AddressGlobalUK',
  'BaseLocation',
  'CaseHistoryViewer',
  'CaseLink',
  'CaseLocation',
  'CasePaymentHistoryViewer',
  'ChangeOrganisationRequest',
  'Collection',
  'ComponentLauncher',
  'Date',
  'DateTime',
  'Document',
  'DynamicList',
  'DynamicRadioList',
  'DynamicMultiSelectList',
  'Email',
  'FixedList',
  'FixedRadioList',
  'Flags',
  'FlagsDetail',
  'FlagLauncher',
  'JudicialUser',
  'Label',
  'LinkReason',
  'MoneyGBP',
  'MultiSelectList',
  'Number',
  'OrderSummary',
  'Organisation',
  'OrganisationPolicy',
  'PhoneUK',
  'Postcode',
  'PreviousOrganisation',
  'Region',
  'SearchCriteria',
  'SearchParty',
  'Text',
  'TextArea',
  'TTL',
  'WaysToPay',
  'YesOrNo'
]

/**
 * Checks if a given field type is in the exclusion list provided
 */
export function isFieldTypeInExclusionList(fieldType: string, exclusionList: string[]) {
  return exclusionList.includes(fieldType)
}

export const NONE = '<none>'
export const CUSTOM = '<custom>'
export const CANCEL = '<cancel>'

export const COMPOUND_KEYS: CompoundKeys<CCDTypes> = {
  AuthorisationCaseEvent: ['CaseEventID', 'CaseTypeId', 'UserRole'],
  AuthorisationCaseField: ['CaseFieldID', 'CaseTypeId', 'UserRole'],
  CaseEvent: ['ID', 'CaseTypeID'],
  CaseEventToFields: ['CaseFieldID', 'CaseEventID', 'CaseTypeID'],
  CaseField: ['ID', 'CaseTypeID'],
  CaseTypeTab: ['CaseTypeID', 'Channel', 'TabID', 'CaseFieldID'],
  ComplexTypes: ['ID', 'ListElementCode'],
  EventToComplexTypes: ['ID', 'CaseEventID', 'CaseFieldID', 'ListElementCode'],
  Scrubbed: ['ID', 'ListElementCode']
}
