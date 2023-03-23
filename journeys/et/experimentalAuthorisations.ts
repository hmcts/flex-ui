import { prompt } from 'inquirer'
import { session, saveSession } from 'app/session'
import { Journey } from 'types/journey'
import { getKnownETCaseFieldIDsByEvent, getRegionFromCaseTypeId, Region, RoleMappings, defaultRoleMappings, Roles, createCaseFieldAuthorisations, addToInMemoryConfig, getEnglandWales, getScotland, createCaseEventAuthorisations } from 'app/et/configs'
import { Answers, askAutoComplete, sayWarning, askCaseEvent, askCaseTypeID } from 'app/questions'
import { format, getIdealSizeForInquirer } from 'app/helpers'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'app/types/ccd'
import { MULTI, NONE } from 'app/constants'
import { addonDuplicateQuestion } from './createSingleField'

const QUESTION_ID_SELECT = 'What fields do you want to change authorisations for?'
const QUESTION_AUTHORISATIONS = 'What permissions are we giving {0} for {1}?'

const NO_CHANGE = 'Don\'t Change'
const OPTS = ['Create', 'Read', 'Update', 'Delete', NO_CHANGE]
const ALL = '<view all fields in one list>'
const THIS = '<this event>'

async function askAuthorisations(message: string, region: Region) {
  let answers: Answers = {}
  const mappings: Partial<RoleMappings> = {}

  for (const mapping in Roles) {
    const role = Roles[mapping]

    answers = await prompt([{
      name: 'role',
      message: message ? format(message, role) : `What permissions should ${role} have?`,
      type: 'checkbox',
      choices: OPTS,
      default: mapCrudToWords(defaultRoleMappings[role]?.[region]),
      askAnswered: true,
      pageSize: getIdealSizeForInquirer()
    }], answers)

    if ((answers.role as string[]).includes("Don't Change")) {
      continue
    }

    const regionMappings = (answers.role as string[]).map(o => o[0]).join('') || 'D'

    if (regionMappings.length) {
      mappings[role] = { [region]: regionMappings }
    }
  }

  return mappings as RoleMappings
}

export async function changeDefaultAuthorisations() {
  const enMappings = await askAuthorisations(`What default permissions should {0} have for EnglandWales?`, Region.EnglandWales)
  const scMappings = await askAuthorisations(`What default permissions should {0} have for Scotland?`, Region.Scotland)

  for (const key in enMappings) {
    defaultRoleMappings[key].en = enMappings[key]
  }

  for (const key in enMappings) {
    defaultRoleMappings[key].sc = scMappings[key]
  }
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

async function changeAuthorisationsForCaseEvent(caseTypeID: string, caseEventID: string, region: Region) {
  const newMapping = await askAuthorisations(QUESTION_AUTHORISATIONS.replace('{1}', caseEventID), region)
  const answers = { [CaseFieldKeys.CaseTypeID]: caseTypeID }

  await addonDuplicateQuestion(answers, (answers: Answers) => {
    const duplicateRegion = getRegionFromCaseTypeId(answers[CaseFieldKeys.CaseTypeID])
    for (const key in newMapping) {
      newMapping[key][duplicateRegion] = newMapping[key][region]
    }

    const auths = createCaseEventAuthorisations(answers[CaseFieldKeys.CaseTypeID], caseEventID, newMapping)

    addToInMemoryConfig({
      AuthorisationCaseEvent: auths
    })
  })

  saveSession(session)
}

async function changeAuthorisationsForCaseField(caseTypeID: string, region: Region, fieldIDs: string[]) {
  const message = QUESTION_AUTHORISATIONS.replace('{1}', fieldIDs.length === 1 ? fieldIDs[0] : 'these fields')
  const newMapping = await askAuthorisations(message, region)

  const answers = { [CaseFieldKeys.CaseTypeID]: caseTypeID }
  await addonDuplicateQuestion(answers, (answers: Answers) => {
    const duplicateRegion = getRegionFromCaseTypeId(answers[CaseFieldKeys.CaseTypeID])
    for (const key in newMapping) {
      newMapping[key][duplicateRegion] = newMapping[key][region]
    }

    const auths = fieldIDs.reduce((acc, fieldID) =>
      acc.concat(createCaseFieldAuthorisations(answers[CaseFieldKeys.CaseTypeID], fieldID, newMapping)), [])

    addToInMemoryConfig({
      AuthorisationCaseField: auths
    })
  })

  saveSession(session)
}

export async function changeAuthorisations() {
  let answers: Answers = {}

  answers = await askCaseTypeID(answers)
  answers = await askCaseEvent(answers, undefined, undefined, [ALL, NONE], false)

  const selectedCaseTypeID = answers[CaseFieldKeys.CaseTypeID]
  const region = getRegionFromCaseTypeId(selectedCaseTypeID)
  const selectedCaseEventID = answers[CaseEventToFieldKeys.CaseEventID]

  const idOpts = getFieldOptions(selectedCaseTypeID, selectedCaseEventID)

  answers = await askAutoComplete(CaseFieldKeys.ID, QUESTION_ID_SELECT, undefined, [THIS, MULTI, ...idOpts], true, true, answers)

  if (answers[CaseFieldKeys.ID] === THIS) {
    return await changeAuthorisationsForCaseEvent(selectedCaseTypeID, selectedCaseEventID, region)
  }

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

  return await changeAuthorisationsForCaseField(selectedCaseTypeID, region, selectedIDs)
}

function mapCrudToWords(crud: string) {
  return crud?.toUpperCase().split('').map(o => {
    if (o === 'C') return 'Create'
    if (o === 'R') return 'Read'
    if (o === 'U') return 'Update'
    if (o === 'D') return 'Delete'
    return ''
  })
}

export default {
  group: 'et-wip',
  text: '[WIP] Change authorisations',
  fn: () => sayWarning(changeAuthorisations),
  alias: 'ChangeAuthorisation'
} as Journey
