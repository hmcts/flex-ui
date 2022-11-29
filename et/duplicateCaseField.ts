import { getRegionFromCaseTypeId, regionRoles } from 'app/et/configs'
import { CaseField, ConfigSheets } from 'app/types/ccd'

function getEquivalentRole(caseTypeID: string, role: string) {
  const region = getRegionFromCaseTypeId(caseTypeID)
  const regionRole = regionRoles[role]
  return regionRole?.[region]
}

/**
 * Duplicate object with a new CaseTypeID
 */
export function duplicateInCaseType<T extends { CaseTypeID: string }>(caseTypeID: string, obj: T) {
  const copy = Object.assign({}, obj)
  copy.CaseTypeID = caseTypeID
  return copy
}

/**
 * Duplicate authorisation object with a new CaseTypeId and with swapped user roles
 */
export function duplicateAuthorisationInCaseType<T extends { CaseTypeId: string, UserRole: string }>(caseTypeID: string, obj: T) {
  const copy = Object.assign({}, obj)
  copy.CaseTypeId = caseTypeID
  copy.UserRole = getEquivalentRole(caseTypeID, copy.UserRole) || copy.UserRole
  return copy
}

/**
 * Checks if a field references the other in either Label or HintText properties
 */
function isFieldReferencedInField(caseField: CaseField, caseFieldID: string) {
  return caseField.Label?.includes(`{${caseFieldID}}`) || caseField.HintText?.includes(`{${caseFieldID}}`)
}

/**
 * Gets ALL objects needed to support an array of CaseFields (checks all currently supported JSONs)
 */
export function getObjectsReferencedByCaseFields(config: ConfigSheets, caseFields: CaseField[]): ConfigSheets {
  const refCaseFields = config.CaseField.filter(o => caseFields.find(x => x.ID === o.ID || isFieldReferencedInField(x, o.ID)))
  const refCaseEventToField = config.CaseEventToFields.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))
  const refCaseEvents = config.CaseEvent.filter(o => refCaseEventToField.find(x => x.CaseEventID === o.ID))
  const refEventToComplexTypes = config.EventToComplexTypes.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))
  const refScrubbed = config.Scrubbed.filter(o => refCaseFields.find(x => x.FieldTypeParameter === o.ID))
  const refAuthCaseField = config.AuthorisationCaseField.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))
  const refAuthCaseEvent = config.AuthorisationCaseEvent.filter(o => refCaseEvents.find(x => x.ID === o.CaseEventID))
  const refComplexType = config.ComplexTypes.filter(o => refCaseFields.find(x => x.FieldTypeParameter === o.ID || x.FieldType === o.ID))
  const refCaseTypeTab = config.CaseTypeTab.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))

  return {
    AuthorisationCaseEvent: refAuthCaseEvent,
    AuthorisationCaseField: refAuthCaseField,
    CaseField: refCaseFields,
    CaseEvent: refCaseEvents,
    CaseEventToFields: refCaseEventToField,
    ComplexTypes: refComplexType,
    Scrubbed: refScrubbed,
    EventToComplexTypes: refEventToComplexTypes,
    CaseTypeTab: refCaseTypeTab
  }
}
