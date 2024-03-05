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
  let authorisations = []
  for (const event of created.CaseEvent) {
    const authsExist = sheets.AuthorisationCaseEvent.find(o => o.CaseEventID === event.ID && o.CaseTypeId === event.CaseTypeID)

    let answers: Answers = { authorisations: YES }

    if (authsExist) {
      answers = await prompt([{
        name: 'authorisations',
        message: `Do you want to create authorisations for ${event.CaseTypeID}.${event.ID}?`,
        type: 'list',
        choices: YES_OR_NO,
        default: YES,
        askAnswered: true
      }], answers)
    }

    if (answers.authorisations === YES) {
      authorisations = authorisations.concat(...createCaseEventAuthorisations(event.CaseTypeID, event.ID, undefined, event.ext, event.feature))
    }
  }
  return authorisations
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an Event',
  fn: journey,
  alias: 'UpsertEvent'
} as Journey
