import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { getKnownETCaseFieldIDsByEvent, getRegionFromCaseTypeId, Region, getEnglandWales, getScotland, addToConfig, addToInMemoryConfig, getETCaseEventIDOpts } from 'app/et/configs'
import { Answers, askAutoComplete, askCaseEvent, askCaseTypeID, sayWarning } from 'app/questions'
import { CaseEventToFieldKeys, CaseFieldKeys, createNewConfigSheets } from 'app/types/ccd'
import { MULTI, NONE } from 'app/constants'
import { duplicateAuthorisationInCaseType, duplicateInCaseType, getObjectsReferencedByCaseFields } from 'app/et/duplicateCaseField'
import { saveSession, session } from 'app/session'
import { getIdealSizeForInquirer } from 'app/helpers'

const QUESTION_ID_SELECT = 'What fields do you want to duplicate?'
const QUESTION_DUPLICATE_TO = 'What CaseTypeID are we duplicating these to?'

const ALL = '<view all fields in one list>'

function getFieldOptions(caseTypeID: string, caseEventID: string) {
  if (caseEventID === ALL) {
    const fields = getRegionFromCaseTypeId(caseTypeID) === Region.EnglandWales
      ? getEnglandWales().CaseField
      : getScotland().CaseField

    return fields.map(o => o.ID)
  }

  return getKnownETCaseFieldIDsByEvent(caseEventID)
}

async function extractFieldsAndDependants(fromRegion: Region, toCaseTypeID: string, fieldIDs: string[]) {
  const relatedConfig = createNewConfigSheets()

  fieldIDs.forEach(o => {
    const configs = fromRegion === Region.EnglandWales ? getEnglandWales() : getScotland()
    const related = getObjectsReferencedByCaseFields(configs, [configs.CaseField.find(x => x.ID === o)])

    addToConfig(relatedConfig, related)
  })

  relatedConfig.CaseEvent = relatedConfig.CaseEvent.map(o => duplicateInCaseType(toCaseTypeID, o))
  relatedConfig.CaseEventToFields = relatedConfig.CaseEventToFields.map(o => duplicateInCaseType(toCaseTypeID, o))
  relatedConfig.CaseField = relatedConfig.CaseField.map(o => duplicateInCaseType(toCaseTypeID, o))
  relatedConfig.CaseTypeTab = relatedConfig.CaseTypeTab.map(o => duplicateInCaseType(toCaseTypeID, o))

  relatedConfig.ComplexTypes = relatedConfig.ComplexTypes.map(o => duplicateInCaseType(toCaseTypeID, o))
  relatedConfig.Scrubbed = relatedConfig.Scrubbed.map(o => duplicateInCaseType(toCaseTypeID, o))
  relatedConfig.EventToComplexTypes = relatedConfig.EventToComplexTypes.map(o => duplicateInCaseType(toCaseTypeID, o))

  relatedConfig.AuthorisationCaseEvent = relatedConfig.AuthorisationCaseEvent.map(o => duplicateAuthorisationInCaseType(toCaseTypeID, o))
  relatedConfig.AuthorisationCaseField = relatedConfig.AuthorisationCaseField.map(o => duplicateAuthorisationInCaseType(toCaseTypeID, o))

  addToInMemoryConfig(relatedConfig)
  saveSession(session)
}

async function askFields() {
  let answers: Answers = {}

  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, { choices: [ALL, NONE, ...getETCaseEventIDOpts()] })

  const selectedCaseTypeID = answers[CaseFieldKeys.CaseTypeID]
  const region = getRegionFromCaseTypeId(selectedCaseTypeID)
  const selectedCaseEventID = answers[CaseEventToFieldKeys.CaseEventID]

  const idOpts = getFieldOptions(selectedCaseTypeID, selectedCaseEventID)

  answers = await askAutoComplete(answers, { name: CaseFieldKeys.ID, message: QUESTION_ID_SELECT, default: undefined, choices: [MULTI, ...idOpts], askAnswered: true, sort: true })

  if (answers[CaseFieldKeys.ID] === MULTI) {
    answers = await prompt([{
      name: CaseFieldKeys.ID,
      message: QUESTION_ID_SELECT,
      type: 'checkbox',
      choices: idOpts.sort(),
      askAnswered: true,
      pageSize: getIdealSizeForInquirer()
    }], answers)
  } else {
    answers[CaseFieldKeys.ID] = [answers[CaseFieldKeys.ID]] as any
  }

  const selectedIDs = (answers[CaseFieldKeys.ID] as any as string[])

  if (!selectedIDs.length) {
    return
  }

  const toCaseTypeID = (await askCaseTypeID({}, { message: QUESTION_DUPLICATE_TO })).CaseTypeID

  return await extractFieldsAndDependants(region, toCaseTypeID, selectedIDs)
}

export default {
  group: 'et-wip',
  text: '[WIP] Duplicate to another CaseTypeId',
  fn: async () => await sayWarning(askFields),
  alias: 'Duplicate'
} as Journey
