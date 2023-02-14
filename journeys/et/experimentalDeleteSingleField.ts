import { MULTI, NONE } from 'app/constants'
import { getRegionFromCaseTypeId, Region, getKnownCaseFieldIDsByEvent, getEnglandWales, getScotland, deleteFromConfig } from 'app/et/configs'
import { getObjectsReferencedByCaseFields } from 'app/et/duplicateCaseField'
import { askCaseEvent, askCaseTypeID } from 'app/et/questions'
import { Answers, askAutoComplete, sayWarning } from 'app/questions'
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
  answers = await askCaseEvent(answers, undefined, undefined, false, [NONE])

  const selectedCaseTypeID = answers[CaseFieldKeys.CaseTypeID]
  const region = getRegionFromCaseTypeId(selectedCaseTypeID)
  const selectedCaseEventID = answers[CaseEventToFieldKeys.CaseEventID]

  const idOpts = getFieldOptions(selectedCaseTypeID, selectedCaseEventID)

  answers = await askAutoComplete(CaseFieldKeys.ID, QUESTION_ID_SELECT, undefined, [MULTI, ...idOpts], true, answers)

  if (answers[CaseFieldKeys.ID] === MULTI) {
    answers = await prompt([{
      name: CaseFieldKeys.ID,
      message: QUESTION_ID_SELECT,
      type: 'checkbox',
      choices: idOpts.sort(),
      askAnswered: true
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

  return getKnownCaseFieldIDsByEvent(caseEventID)
}

export default {
  group: 'et-wip',
  text: '[WIP] Delete a single field',
  fn: () => sayWarning(journey)
} as Journey
