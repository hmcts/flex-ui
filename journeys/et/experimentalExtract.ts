import { prompt } from 'inquirer'
import { session, saveSession, addToSession } from 'app/session'
import { Journey } from 'types/journey'
import { getKnownETCaseFieldIDsByEvent, getRegionFromCaseTypeId, Region, getEnglandWales, getScotland, addToConfig, getETCaseEventIDOpts } from 'app/et/configs'
import { Answers, askAutoComplete, askCaseEvent, askCaseTypeID, sayWarning } from 'app/questions'
import { CaseEventToFieldKeys, CaseFieldKeys, createNewConfigSheets } from 'app/types/ccd'
import { MULTI, NONE } from 'app/constants'
import { getObjectsReferencedByCaseFields } from 'app/et/duplicateCaseField'
import { getIdealSizeForInquirer } from 'app/helpers'

const QUESTION_ID_SELECT = 'What fields do you want to change authorisations for?'

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

async function extractFieldsAndDependants(region: Region, fieldIDs: string[]) {
  const relatedConfig = createNewConfigSheets()

  fieldIDs.forEach(o => {
    const configs = region === Region.EnglandWales ? getEnglandWales() : getScotland()
    const related = getObjectsReferencedByCaseFields(configs, [configs.CaseField.find(x => x.ID === o)])

    addToConfig(relatedConfig, related)
  })

  addToSession(relatedConfig)
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

  return await extractFieldsAndDependants(region, selectedIDs)
}

export default {
  group: 'et-wip',
  text: '[WIP] Extract fields',
  fn: async () => await sayWarning(askFields),
  alias: 'Extract'
} as Journey
