import { Journey } from 'types/journey'
import { ENV_OPTS, REGION_OPTS, askCreateCaseQuestions, createCaseOnCitizenUI, doCreateCaseTasks } from './webCreateCase'
import { prompt } from 'inquirer'
import { getIdealSizeForInquirer } from 'app/helpers'
import { Answers } from 'app/questions'
import { getCurrentPreviewPRNumber } from './configsCommon'
import { NO, YES_OR_NO } from 'app/constants'

async function journey() {
  const currentPr = await getCurrentPreviewPRNumber()
  let answers = await prompt([
    { name: 'env', message: 'Which environment are we targeting?', type: 'list', choices: ENV_OPTS, default: ENV_OPTS[0] },
    { name: 'region', message: 'What region are we creating for?', type: 'list', choices: REGION_OPTS, default: REGION_OPTS, pageSize: getIdealSizeForInquirer() },
    { name: 'pr', message: 'What PR number are we targetting?', default: currentPr, when: (answers: Answers) => answers.env === ENV_OPTS[1] },
  ])

  const caseId = await createCaseOnCitizenUI(answers)

  if (!caseId) {
    return
  }

  answers = await prompt([{ name: 'events', message: `Would you like to run ExUI events on this new case (${caseId})?`, type: 'list', choices: YES_OR_NO, default: NO }], answers)

  if (answers.events === NO) {
    return
  }

  const followup = await askCreateCaseQuestions({ region: [answers.region], caseId })
  return await doCreateCaseTasks(followup)
}

export default {
  disabled: false,
  group: 'et-wip',
  text: '[WIP] Create case from citizenUI',
  fn: journey,
  alias: 'citui'
} as Journey
