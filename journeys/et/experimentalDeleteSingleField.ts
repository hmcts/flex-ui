import { MULTI, NONE } from 'app/constants'
import { getRegionFromCaseTypeId, Region, getKnownETCaseFieldIDsByEvent, getEnglandWales, getScotland, deleteFromConfig, getETCaseEventIDOpts } from 'app/et/configs'
import { getObjectsReferencedByCaseFields } from 'app/et/duplicateCaseField'
import { getIdealSizeForInquirer } from 'app/helpers'
import { Answers, askAutoComplete, askCaseEvent, askCaseTypeID, sayWarning } from 'app/questions'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'app/types/ccd'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'

const QUESTION_ID_SELECT = 'What field(s) do you want to delete?'
const ALL = '<view all fields in one list>'

async function journey() {
  /*
   * 1. Take the user through the same flow as selecting a field to extract
   * 2. Check for references that ONLY reference that single field
   *    - CaseEventToFields only reference one CaseField (may be multiple)
   *    - AuthorisationCaseField only reference on CaseField (will be multiple)
   *    - ComplexTypes IF it is not referenced by other ComplexTypes or CaseFields (will leave this as TODO)
   *    - ScrubbedList again with the same logic as ComplexTypes (also TODO)
  */

  let answers: Answers = {}

  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, { choices: [NONE, ...getETCaseEventIDOpts()] })

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

  selectedIDs.forEach(o => {
    const configs = region === Region.EnglandWales ? getEnglandWales() : getScotland()
    const fields = configs.CaseField.find(x => x.ID === o)
    const related = getObjectsReferencedByCaseFields(configs, [fields])

    deleteFromConfig(configs, {
      AuthorisationCaseField: related.AuthorisationCaseField,
      CaseEventToFields: related.CaseEventToFields,
      CaseField: [fields]
    })
  })
}

function getFieldOptions(caseTypeID: string, caseEventID: string) {
  if (caseEventID === ALL) {
    const fields = getRegionFromCaseTypeId(caseTypeID) === Region.EnglandWales
      ? getEnglandWales().CaseField
      : getScotland().CaseField

    return fields.map(o => o.ID)
  }

  return getKnownETCaseFieldIDsByEvent(caseEventID)
}

export default {
  group: 'et-wip',
  text: '[WIP] Delete a single field',
  fn: async () => await sayWarning(journey),
  alias: 'DeleteCaseField'
} as Journey
