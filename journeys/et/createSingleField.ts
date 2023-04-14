import { prompt } from 'inquirer'
import { ConfigSheets } from 'types/ccd'
import { Answers } from 'app/questions'
import { YES, YES_OR_NO } from 'app/constants'
import { addToInMemoryConfig, createCaseFieldAuthorisations } from 'app/et/configs'
import { Journey } from 'types/journey'
import { sheets } from 'app/configs'
import { createSingleField } from '../base/createSingleField'

async function journey(answers: Answers = {}) {
  const created = await createSingleField(answers)
  created.AuthorisationCaseField = await createAuthorisations(created)
  addToInMemoryConfig(created)
}

async function createAuthorisations(created: Partial<ConfigSheets>) {
  let authorisations = []
  for (const field of created.CaseField) {
    const authsExist = sheets.AuthorisationCaseEvent.find(o => o.CaseEventID === field.ID && o.CaseTypeId === field.CaseTypeID)

    let answers: Answers = { authorisations: YES }

    if (authsExist) {
      answers = await prompt([{
        name: 'authorisations',
        message: `Do you want to create authorisations for ${field.CaseTypeID}.${field.ID}?`,
        type: 'list',
        choices: YES_OR_NO,
        default: YES,
        askAnswered: true
      }], answers)
    }

    if (answers.authorisations === YES) {
      authorisations = authorisations.concat(...createCaseFieldAuthorisations(field.CaseTypeID, field.ID))
    }
  }
  return authorisations
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a single field',
  fn: journey,
  alias: 'UpsertCaseField'
} as Journey
