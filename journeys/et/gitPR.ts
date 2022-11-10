import { execCommand } from 'app/helpers'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { getRepos as getRepoOpts } from './gitCommon'

const QUESTION_REPOS = 'Which repos shall we open a PR under?'
const QUESTION_TICKET_NUMBER = 'What\'s the ticket number? (RET-XXXX)'
const QUESTION_WHAT_CHANGED = 'What changed?'
const QUESTION_BREAKING_CHANGE = 'Does this PR introduce a breaking change?'
const QUESTION_TITLE = 'Summary of what changed (under 10 words)'
const QUESTION_BASE_BRANCH = 'What branch are we merging into?'

const template = `### JIRA link (if applicable) ###

https://tools.hmcts.net/jira/browse/RET-%NUMBER%

### Change description ###

%DESCRIPTION%

**Does this PR introduce a breaking change?** (check one with "x")

\`\`\`
[%YES%] Yes
[%NO%] No
\`\`\`
`

async function getCurrentBranchName(dir: string) {
  const { stdout } = await execCommand('git rev-parse --symbolic-full-name --abbrev-ref HEAD', dir)
  console.log(stdout)
  return stdout.replace('RET-', '').replace('\n', '')
}

export async function openPRJourney(answers: any = {}) {
  const REPOS = await getRepoOpts()

  answers = await prompt([
    { name: 'repos', message: QUESTION_REPOS, type: 'checkbox', choices: Object.keys(REPOS), default: Object.keys(REPOS) }
  ], answers)

  answers = await prompt([
    { name: 'ticket', message: QUESTION_TICKET_NUMBER, default: await getCurrentBranchName(answers.repos.includes('et-ccd-definitions-englandwales') ? process.env.ENGWALES_DEF_DIR : process.env.SCOTLAND_DEF_DIR) },
    { name: 'title', message: QUESTION_TITLE },
    { name: 'base', message: QUESTION_BASE_BRANCH, default: 'master' }
  ], answers)

  answers = await prompt([
    { name: 'change', message: QUESTION_WHAT_CHANGED, default: answers.title },
    { name: 'breaking', message: QUESTION_BREAKING_CHANGE, type: 'list', choices: ['Yes', 'No'], default: 'No' }
  ], answers)

  const content = template.replace('%NUMBER%', answers.ticket)
    .replace('%DESCRIPTION%', answers.change)
    .replace('%YES%', answers.breaking === 'No' ? '' : 'x')
    .replace('%NO%', answers.breaking === 'No' ? 'x' : '')

  const command = `gh pr create --title "RET-${answers.ticket}: ${answers.title}" --base ${answers.base} --body '${content}'`

  await Promise.allSettled(answers.repos.map(async o => await openPRFor(command, REPOS[o])))
}

async function openPRFor(command: string, dir: string) {
  const result = await execCommand(command, dir, false)

  if (!result.code) {
    return console.log(`Opened PR at: ${result.stdout.replace('\n', '')}`)
  }

  console.error(result.stderr || result.stdout)
}

export default {
  disabled: true,
  group: 'et-git',
  text: 'Open a PR from a branch',
  fn: openPRJourney
} as Journey
