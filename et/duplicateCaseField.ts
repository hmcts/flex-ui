import { addToInMemoryConfig, getConfigSheetsForCaseTypeID, upsertNewCaseEvent } from 'app/et/configs'
import { CaseField, ConfigSheets, createNewConfigSheets } from 'app/types/ccd'

/**
 * Duplicates a field and all related objects under a different CaseTypeID
 * @param fromCaseTypeID CaseTypeID of the field to copy
 * @param caseFieldID CaseFieldID of the field to copy
 * @param toCaseTypeID create a copy with this CaseTypeID
 */
export function doDuplicateCaseField(fromCaseTypeID: string, caseFieldID: string, toCaseTypeID: string) {
  const referenced = getObjectsReferencedByCaseField(fromCaseTypeID, caseFieldID)
  referenced.CaseEvent.forEach(o => upsertNewCaseEvent(duplicateInCaseType(toCaseTypeID, o)))

  addToInMemoryConfig({
    AuthorisationCaseEvent: referenced.AuthorisationCaseEvent.map(o => duplicateAuthorisationInCaseType(toCaseTypeID, o)),
    AuthorisationCaseField: referenced.AuthorisationCaseField.map(o => duplicateAuthorisationInCaseType(toCaseTypeID, o)),
    CaseEvent: referenced.CaseEvent.map(o => duplicateInCaseType(toCaseTypeID, o)),
    CaseEventToFields: referenced.CaseEventToFields.map(o => duplicateInCaseType(toCaseTypeID, o)),
    CaseField: referenced.CaseField.map(o => duplicateInCaseType(toCaseTypeID, o))
  })
}

/**
 * Changes englandwales to scotland and vice versa
 */
function swapRegions(input: string) {
  if (input.endsWith('englandwales')) {
    return input.replace('englandwales', 'scotland')
  }
  if (input.endsWith('scotland')) {
    return input.replace('scotland', 'englandwales')
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
function isFieldReferencedInField(caseField: CaseField, caseFieldID: string) {
  return caseField.Label?.includes(`{${caseFieldID}}`) || caseField.HintText?.includes(`{${caseFieldID}}`)
}

/**
 * Gets ALL objects needed to support a specific CaseField (checks all supported JSONs)
 */
function getObjectsReferencedByCaseField(caseTypeID: string, caseFieldID: string): ConfigSheets {
  const region = getConfigSheetsForCaseTypeID(caseTypeID)

  const caseField = region.CaseField.find(o => o.ID === caseFieldID)
  if (!caseField) return createNewConfigSheets()

  return getObjectsReferencedByCaseFields(region, [caseField])
}

/**
 * Gets ALL objects needed to support an array of CaseFields (checks all currently supported JSONs)
 * TODO: Include ComplexTypes and other any JSONs as and when supported
 */
export function getObjectsReferencedByCaseFields(config: ConfigSheets, caseFields: CaseField[]): ConfigSheets {
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
    EventToComplexTypes: refEventToComplexTypes
  }
}
