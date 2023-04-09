import { prompt } from 'inquirer'
import { ConfigSheets } from 'types/ccd'
import { Answers } from 'app/questions'
import { YES, YES_OR_NO } from 'app/constants'
import { addToInMemoryConfig, createCaseFieldAuthorisations } from 'app/et/configs'
import { Journey } from 'types/journey'
import { sheets } from 'app/configs'
import { createSingleField } from '../base/createSingleField'

async function journey() {
  const created = await createSingleField()
  created.AuthorisationCaseField = await createAuthorisations(created)
  addToInMemoryConfig(created)
}

async function createAuthorisations(created: Partial<ConfigSheets>) {
  const createdCaseField = created.CaseField?.[0] || { ID: '', CaseTypeID: '' }
  const authsExist = sheets.AuthorisationCaseEvent.find(o => o.CaseEventID === createdCaseField.ID && o.CaseTypeId === createdCaseField.CaseTypeID)

  let answers: Answers = { authorisations: YES }

  if (authsExist) {
    answers = await prompt([{
      name: 'authorisations',
      message: 'Do you want to create authorisations for this field?',
      type: 'list',
      choices: YES_OR_NO,
      default: YES,
      askAnswered: true
    }], answers)
  }

  return answers.authorisations === YES
    ? createCaseFieldAuthorisations(createdCaseField.CaseTypeID, createdCaseField.ID)
    : []
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a single field',
  fn: journey,
  alias: 'UpsertCaseField'
} as Journey
