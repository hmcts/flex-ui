import { Journey } from 'types/journey'
import { ENV_OPTS, REGION_OPTS, askCreateCaseQuestions, createCaseOnCitizenUI, doCreateCaseTasks, doMultiple, findExistingCases } from './webCreateCase'
import { prompt } from 'inquirer'
import { getIdealSizeForInquirer } from 'app/helpers'
import { Answers } from 'app/questions'
import { getCurrentPreviewPRNumber } from './configsCommon'
import { NO, YES, YES_OR_NO } from 'app/constants'

async function journey() {
  const answers = await askQuestions()

  const createdIds: string[] = []
  for (let i = 0; i < answers.createCaseAnswers.repeat; i++) {
    const caseId = await createCaseOnCitizenUI(answers.createCaseAnswers)

    if (!caseId) {
      return
    }

    if (answers.createCaseAnswers.events === YES) {
      answers.runEventsAnswers.caseId = caseId
      await doCreateCaseTasks(answers.runEventsAnswers)
    }
    createdIds.push(caseId)
  }

  if (answers.createCaseAnswers.multiple === YES) {
    await doMultiple(answers.createCaseAnswers.name, answers.createCaseAnswers.region, createdIds)
  }

  createdIds.forEach(o => console.log(`Created case ${o}`))
}

async function askQuestions() {
  const currentPr = await getCurrentPreviewPRNumber()
  let answers = await prompt([
    { name: 'env', message: 'Which environment are we targeting?', type: 'list', choices: ENV_OPTS, default: ENV_OPTS[0] },
    { name: 'region', message: 'What region are we creating for?', type: 'list', choices: REGION_OPTS, default: REGION_OPTS, pageSize: getIdealSizeForInquirer() },
    { name: 'pr', message: 'What PR number are we targetting?', default: currentPr, when: (answers: Answers) => answers.env === ENV_OPTS[1] },
  ])

  answers = await prompt([{ name: 'events', message: `Would you like to also run ExUI events on this new case?`, type: 'list', choices: YES_OR_NO, default: YES }], answers)
  const followup = await askCreateCaseQuestions({ region: [answers.region], caseId: 'TBA' })

  const whenMultiple = (answers: Answers) => answers.events === YES
  answers = await prompt([
    { name: 'repeat', message: `How many cases should we create with these answers?`, type: 'number', default: 1, validate: value => !isNaN(Number(value)) && value > 0 },
    { name: 'multiple', message: 'Want a multiple from these created cases?', type: 'list', choices: YES_OR_NO, default: NO, when: whenMultiple },
    { name: 'name', message: 'What should the multiple be called?', type: 'input', default: Date.now().toString(), when: whenMultiple }
  ], answers)
  return { createCaseAnswers: answers, runEventsAnswers: followup }
}

export default {
  disabled: false,
  group: 'et-wip',
  text: '[WIP] Create case from citizenUI',
  fn: journey,
  alias: 'citui'
} as Journey
