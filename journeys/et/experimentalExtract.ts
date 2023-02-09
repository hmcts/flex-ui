import { prompt } from 'inquirer'
import { session, saveSession, addToSession } from 'app/session'
import { Journey } from 'types/journey'
import { getKnownCaseFieldIDsByEvent, getRegionFromCaseTypeId, Region, getEnglandWales, getScotland, addToConfig } from 'app/et/configs'
import { Answers } from 'app/questions'
import { addFlexRegionToCcdObject, askCaseEvent, askCaseTypeID, FLEX_REGION_ANSWERS_KEY } from 'app/et/questions'
import { CaseEventToFieldKeys, CaseFieldKeys, createNewConfigSheets } from 'app/types/ccd'
import { NONE } from 'app/constants'
import { getObjectsReferencedByCaseFields } from 'app/et/duplicateCaseField'

const QUESTION_ID_SELECT = 'What fields do you want to change authorisations for?'

const ALL = '<view all fields in one list>'

function getFieldOptions(caseTypeID: string, caseEventID: string) {
  if (caseEventID === ALL) {
    const fields = getRegionFromCaseTypeId(caseTypeID) === Region.EnglandWales
      ? getEnglandWales().CaseField
      : getScotland().CaseField

    return fields.map(o => o.ID)
  }

  return getKnownCaseFieldIDsByEvent(caseEventID)
}

async function extractFieldsAndDependants(region: Region, fieldIDs: string[]) {
  const relatedConfig = createNewConfigSheets()

  fieldIDs.forEach(o => {
    const configs = region === Region.EnglandWales ? getEnglandWales() : getScotland()
    const fakeRegions = { [FLEX_REGION_ANSWERS_KEY]: [region] }
    const related = getObjectsReferencedByCaseFields(configs, [configs.CaseField.find(x => x.ID === o)])
    related.ComplexTypes.forEach(o => addFlexRegionToCcdObject(o, fakeRegions))
    related.Scrubbed.forEach(o => addFlexRegionToCcdObject(o, fakeRegions))
    related.EventToComplexTypes.forEach(o => addFlexRegionToCcdObject(o, fakeRegions))
    addToConfig(relatedConfig, related)
  })

  addToSession(relatedConfig)
  saveSession(session)
}

async function askFields() {
  let answers: Answers = {}

  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, undefined, undefined, false, [ALL, NONE])

  const selectedCaseTypeID = answers[CaseFieldKeys.CaseTypeID]
  const region = getRegionFromCaseTypeId(selectedCaseTypeID)
  const selectedCaseEventID = answers[CaseEventToFieldKeys.CaseEventID]

  const idOpts = getFieldOptions(selectedCaseTypeID, selectedCaseEventID)

  answers = await prompt([{
    name: CaseFieldKeys.ID,
    message: QUESTION_ID_SELECT,
    type: 'checkbox',
    choices: idOpts.sort(),
    askAnswered: true
  }], answers)

  const selectedIDs = (answers[CaseFieldKeys.ID] as any as string[])

  if (!selectedIDs.length) {
    return
  }

  return await extractFieldsAndDependants(region, selectedIDs)
}

export default {
  group: 'et-experimental',
  text: 'Extract fields',
  fn: askFields
} as Journey
