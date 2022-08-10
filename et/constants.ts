import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, EventToComplexType, Scrubbed } from "app/types/types";

// TODO: Looking for a better name and way to declare this (tried Record<keyof(ConfigSheets), keyof(keyof(ConfigSheets))> but that's not supported).
export const COMPOUND_KEYS: {
  AuthorisationCaseEvent: (keyof (AuthorisationCaseEvent))[],
  AuthorisationCaseField: (keyof (AuthorisationCaseField))[],
  CaseEvent: (keyof (CaseEvent))[],
  CaseEventToField: (keyof (CaseEventToField))[],
  CaseField: (keyof (CaseField))[],
  EventToComplexType: (keyof (EventToComplexType))[],
  Scrubbed: (keyof (Scrubbed))[],
} = {
  AuthorisationCaseEvent: ['CaseEventID', 'CaseTypeId', 'UserRole'],
  AuthorisationCaseField: ['CaseFieldID', 'CaseTypeId', 'UserRole'],
  CaseEvent: ['ID', 'CaseTypeID'],
  CaseEventToField: ['CaseFieldID', 'CaseEventID', 'CaseTypeID'],
  CaseField: ['ID', 'CaseTypeID'],
  EventToComplexType: ['ID', 'CaseEventID', 'CaseFieldID', 'ListElementCode'],
  Scrubbed: ['ID', 'ListElementCode']
}