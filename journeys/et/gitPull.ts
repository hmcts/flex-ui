import { execCommand } from 'app/helpers'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'

const QUESTION = 'Which repos shall we pull in?'
const REPOS = {
  'et-ccd-definitions-englandwales': process.env.ENGWALES_DEF_DIR,
  'et-ccd-definitions-scotland': process.env.SCOTLAND_DEF_DIR,
  'ecm-ccd-docker': process.env.ECM_DOCKER_DIR,
  'et-ccd-callbacks': process.env.ET_CCD_CALLBACKS_DIR
}

async function askDiscard() {
  const answers = await prompt([
    { name: 'repos', message: QUESTION, type: 'checkbox', choices: Object.keys(REPOS), default: Object.keys(REPOS) }
  ])

  for (const repo of answers.repos) {
    const path = REPOS[repo]

    const { stdout, stderr } = await execCommand('git pull', path, false)
    console.log(`Pull for ${repo}`)
    console.log(stderr || stdout)
  }
}

export default {
  group: 'et-git',
  text: 'Git pull in repos...',
  fn: askDiscard
} as Journey
