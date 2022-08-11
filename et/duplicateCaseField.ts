import { addToInMemoryConfig, getConfigSheetsForCaseTypeId, upsertNewCaseEvent } from "app/et/configs"
import { CaseField, ConfigSheets } from "app/types/types"

/**
 * Duplicates a field and all related objects under a different CaseTypeID
 * @param fromCaseTypeId CaseTypeID of the field to copy
 * @param caseFieldId CaseFieldID of the field to copy
 * @param toCaseTypeId create a copy with this CaseTypeID
 */
export function doDuplicateCaseField(fromCaseTypeId: string, caseFieldId: string, toCaseTypeId: string) {
  const referenced = getObjectsReferencedByCaseField(fromCaseTypeId, caseFieldId)
  referenced.CaseEvent.forEach(o => upsertNewCaseEvent(duplicateInCaseType(toCaseTypeId, o)))

  addToInMemoryConfig({
    AuthorisationCaseEvent: referenced.AuthorisationCaseEvent.map(o => duplicateAuthorisationInCaseType(toCaseTypeId, o)),
    AuthorisationCaseField: referenced.AuthorisationCaseField.map(o => duplicateAuthorisationInCaseType(toCaseTypeId, o)),
    CaseEvent: referenced.CaseEvent.map(o => duplicateInCaseType(toCaseTypeId, o)),
    CaseEventToFields: referenced.CaseEventToFields.map(o => duplicateInCaseType(toCaseTypeId, o)),
    CaseField: referenced.CaseField.map(o => duplicateInCaseType(toCaseTypeId, o)),
  })
}

/**
 * Changes englandwales to scotland and vice versa
 */
function swapRegions(input: string) {
  if (input.endsWith("englandwales")) {
    return input.replace("englandwales", "scotland")
  }
  if (input.endsWith("scotland")) {
    return input.replace("scotland", "englandwales")
  }
  return input
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
  copy.UserRole = swapRegions(copy.UserRole)
  return copy
}

/**
 * Checks if a field references the other in either Label or HintText properties
 */
function isFieldReferencedInField(caseField: CaseField, caseFieldId: string) {
  return caseField.Label?.includes(`{${caseFieldId}}`) || caseField.HintText?.includes(`{${caseFieldId}}`)
}

/**
 * Gets ALL objects needed to support a specific CaseField (checks all supported JSONs)
 */
function getObjectsReferencedByCaseField(caseTypeId: string, caseFieldId: string) {
  const region = getConfigSheetsForCaseTypeId(caseTypeId)

  const caseField = region.CaseField.find(o => o.ID === caseFieldId)

  return getObjectsReferencedByCaseFields(region, [caseField])
}

/**
 * Gets ALL objects needed to support an array of CaseFields (checks all currently supported JSONs)
 * TODO: Include ComplexTypes and other any JSONs as and when supported
 */
export function getObjectsReferencedByCaseFields(config: ConfigSheets, caseFields: CaseField[]) {
  const refCaseFields = config.CaseField.filter(o => caseFields.find(x => x.ID === o.ID || isFieldReferencedInField(x, o.ID)))
  const refCaseEventToField = config.CaseEventToFields.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))
  const refCaseEvents = config.CaseEvent.filter(o => refCaseEventToField.find(x => x.CaseEventID === o.ID))
  const refEventToComplexTypes = config.EventToComplexTypes.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))
  const refScrubbed = config.Scrubbed.filter(o => refCaseFields.find(x => x.FieldTypeParameter === o.ID))
  const refAuthCaseField = config.AuthorisationCaseField.filter(o => refCaseFields.find(x => x.ID === o.CaseFieldID))
  const refAuthCaseEvent = config.AuthorisationCaseEvent.filter(o => refCaseEvents.find(x => x.ID === o.CaseEventID))

  return {
    AuthorisationCaseEvent: refAuthCaseEvent,
    AuthorisationCaseField: refAuthCaseField,
    CaseField: refCaseFields,
    CaseEvent: refCaseEvents,
    CaseEventToFields: refCaseEventToField,
    Scrubbed: refScrubbed,
    EventToComplexTypes: refEventToComplexTypes,
  } as ConfigSheets
}