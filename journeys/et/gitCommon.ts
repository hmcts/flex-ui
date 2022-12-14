import { CUSTOM } from 'app/constants'
import { execCommand, groupBy } from 'app/helpers'
import { askAutoComplete, askBasicFreeEntry } from 'app/questions'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { openPRJourney } from './gitPR'

const QUESTION_REPOS = 'Select the repos to perform the action in'
const QUESTION_TASK = 'What task do you want to perform?'
const QUESTION_BRANCH = 'What branch?'
const QUESTION_ADD = 'What to add? (specify files or a matcher just like you would in git add)'
const QUESTION_MESSAGE_COMMIT = 'What message shall we commit with?'
const QUESTION_MESSAGE_STASH = 'What message shall we stash with?'

const TASK_CHOICES = {
  ADD: 'Add file(s)',
  COMMIT: 'Commit',
  DELETE: 'Delete local branch',
  FETCH: 'Fetch',
  PULL: 'Pull',
  STASH: 'Discard / Stash Changes',
  PUSH: 'Push',
  FORCE_PUSH: 'Push (force)',
  BRANCH: 'Switch Branch (new/existing)',
  PR: 'Open a PR for active branches',
  STATUS: 'Status',
  BACK: '<< back to main menu'
}

export async function getRepos() {
  return {
    [`et-ccd-definitions-englandwales (${await getBranchStatus(process.env.ENGWALES_DEF_DIR)})`]: process.env.ENGWALES_DEF_DIR,
    [`et-ccd-definitions-scotland (${await getBranchStatus(process.env.SCOTLAND_DEF_DIR)})`]: process.env.SCOTLAND_DEF_DIR,
    [`et-ccd-callbacks (${await getBranchStatus(process.env.ET_CCD_CALLBACKS_DIR)})`]: process.env.ET_CCD_CALLBACKS_DIR
  }
}

async function gitJourney() {
  const REPOS = await getRepos()

  const answers = await prompt([
    { name: 'repos', message: QUESTION_REPOS, type: 'checkbox', choices: Object.keys(REPOS), default: Object.keys(REPOS) }
  ])

  while (true) {
    let followup: any = { repos: answers.repos }
    const branchOpts = await getBranchOpts(REPOS[followup.repos[0]])

    followup = await askAutoComplete('task', QUESTION_TASK, TASK_CHOICES.PULL, Object.values(TASK_CHOICES), followup)

    switch (followup.task) {
      case TASK_CHOICES.ADD:
        followup = await prompt([{ name: 'command', message: QUESTION_ADD, askAnswered: true, default: '.' }], followup)
        await Promise.allSettled(followup.repos.map((o: string) => add(REPOS[o], followup.command)))
        break
      case TASK_CHOICES.BACK:
        return
      case TASK_CHOICES.BRANCH:
        followup = await askAutoComplete('branch', QUESTION_BRANCH, 'master', [CUSTOM, ...branchOpts], followup)
        if (followup.branch === CUSTOM) {
          followup = await prompt([{ name: 'branch', message: QUESTION_BRANCH, askAnswered: true }], followup)
        }

        await Promise.allSettled(followup.repos.map((o: string) => switchBranch(REPOS[o], followup.branch)))
        break
      case TASK_CHOICES.COMMIT:
        followup = await askBasicFreeEntry(followup, 'message', QUESTION_MESSAGE_COMMIT)
        await Promise.allSettled(followup.repos.map((o: string) => commit(REPOS[o], followup.message)))
        break
      case TASK_CHOICES.DELETE:
        followup = await askAutoComplete('branch', QUESTION_BRANCH, 'master', [CUSTOM, ...branchOpts], followup)
        if (followup.branch === CUSTOM) {
          followup = await prompt([{ name: 'branch', message: QUESTION_BRANCH, askAnswered: true }], followup)
        }

        await Promise.allSettled(followup.repos.map((o: string) => deleteBranch(REPOS[o], followup.branch)))
        break
      case TASK_CHOICES.FETCH:
        await Promise.allSettled(followup.repos.map((o: string) => fetch(REPOS[o])))
        break
      case TASK_CHOICES.FORCE_PUSH:
        await Promise.allSettled(followup.repos.map((o: string) => push(REPOS[o], true)))
        break
      case TASK_CHOICES.PR:
        await openPRJourney(followup)
        break
      case TASK_CHOICES.PULL:
        await Promise.allSettled(followup.repos.map((o: string) => pull(REPOS[o])))
        break
      case TASK_CHOICES.PUSH:
        await Promise.allSettled(followup.repos.map((o: string) => push(REPOS[o])))
        break
      case TASK_CHOICES.STATUS:
        await Promise.allSettled(followup.repos.map((o: string) => status(REPOS[o])))
        break
      case TASK_CHOICES.STASH:
        followup = await askBasicFreeEntry(followup, 'message', QUESTION_MESSAGE_STASH)
        await Promise.allSettled(followup.repos.map((o: string) => stash(REPOS[o], followup.message)))
        break
    }
  }
}

async function getBranchStatus(path: string) {
  const branch = await currentBranch(path)
  // Might add more useful data here later
  return branch
}

async function currentBranch(path: string) {
  const { stdout } = await execCommand('git rev-parse --symbolic-full-name --abbrev-ref HEAD', path, false)
  return stdout.replace(/\r\n|\n/, '')
}

async function add(path: string, command: string) {
  const { stdout, stderr } = await execCommand(`git add ${command}`, path, false)
  console.log(`Add ${command} in ${path}`)
  console.log(stderr || stdout)
}

async function switchBranch(path: string, branch: string) {
  let { stdout, stderr } = await execCommand(`git checkout ${branch}`, path, false)
  if (stderr) {
    const result = await execCommand(`git checkout -b ${branch}`, path, false)
    stdout = result.stdout
    stderr = result.stderr
  }

  console.log(`Checkout in ${path}`)
  console.log(stderr || stdout)
}

async function deleteBranch(path: string, branch: string) {
  let { stdout, stderr } = await execCommand(`git branch -D ${branch}`, path, false)
  if (stderr.includes('error: Cannot delete branch')) {
    await execCommand('git checkout master', path, false)
    const result = await execCommand(`git branch -D ${branch}`, path, false)
    stdout = result.stdout
    stderr = result.stderr
  }
  console.log(`Deleting in ${path}`)
  console.log(stderr || stdout)
}

async function getBranchOpts(path: string) {
  const { stdout } = await execCommand('git branch -a', path, false)
  const opts = stdout.split(/\r\n|\n/).filter(o => !o.includes('->') && o.length > 2).map(o => o.replace('remotes/origin/', '').substring(2))
  return Object.keys(groupBy(opts))
}

async function pull(path: string) {
  const branch = await currentBranch(path)
  const { stdout, stderr } = await execCommand(`git pull origin ${branch}`, path, false)
  console.log(`Pull in ${path}`)
  console.log(stderr || stdout)
}

async function fetch(path: string) {
  const { stdout, stderr } = await execCommand('git fetch', path, false)
  console.log(`Fetch in ${path}`)
  console.log(stderr || stdout)
}

async function push(path: string, force = false) {
  const branch = await currentBranch(path)
  const { stdout, stderr } = await execCommand(`git push origin ${branch}${force ? ' -f' : ''}`, path, false)
  console.log(`${force ? 'Force ' : ''}Push in ${path}`)
  console.log(stderr || stdout)
}

async function commit(path: string, message?: string) {
  const { stdout, stderr } = await execCommand(`git commit -m '${message || 'no message provided'}'`, path, false)
  console.log(`Committing in ${path}`)
  console.log(stderr || stdout)
}

async function stash(path: string, message?: string) {
  const { stdout, stderr } = await execCommand(`git stash${message ? ` push -m '${message}` : ''} --include-untracked`, path, false)
  console.log(`Stashing in ${path}`)
  console.log(stderr || stdout)
}

async function status(path: string) {
  const { stdout, stderr } = await execCommand('git status', path, false)
  console.log(`Status in ${path}`)
  console.log(stderr || stdout)
}

export default {
  group: 'et-git',
  text: 'Git(hub) commands',
  fn: gitJourney
} as Journey
