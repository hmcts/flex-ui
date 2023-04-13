import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { Answers } from 'app/questions'
import { addToInMemoryConfig, createCaseEventAuthorisations } from 'app/et/configs'
import { YES, YES_OR_NO } from 'app/constants'
import { ConfigSheets } from 'app/types/ccd'
import { sheets } from 'app/configs'
import { createEvent } from '../base/createEvent'

async function journey(answers: Answers = {}) {
  const created = await createEvent(answers)
  created.AuthorisationCaseEvent = await createAuthorisations(created)
  addToInMemoryConfig(created)
  return created
}

async function createAuthorisations(created: Partial<ConfigSheets>) {
  const createdCaseEvent = created.CaseEvent?.[0] || { ID: '', CaseTypeID: '' }
  const authsExist = sheets.AuthorisationCaseEvent.find(o => o.CaseEventID === createdCaseEvent.ID && o.CaseTypeId === createdCaseEvent.CaseTypeID)

  let answers: Answers = { authorisations: YES }

  if (authsExist) {
    answers = await prompt([{
      name: 'authorisations',
      message: 'Do you want to create authorisations for this event?',
      type: 'list',
      choices: YES_OR_NO,
      default: YES,
      askAnswered: true
    }], answers)
  }

  return answers.authorisations === YES
    ? createCaseEventAuthorisations(createdCaseEvent.CaseTypeID, createdCaseEvent.ID)
    : []
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an Event',
  fn: journey,
  alias: 'UpsertEvent'
} as Journey
