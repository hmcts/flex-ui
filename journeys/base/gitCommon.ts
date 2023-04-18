import { CUSTOM, NO, YES_OR_NO } from 'app/constants'
import { execCommand, getIdealSizeForInquirer, groupBy } from 'app/helpers'
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
const QUESTION_ABITRARY_COMMAND = 'Enter the command to be run in selected repos below (include "git" at the start)'

const TASK_CHOICES = {
  BACK: '<< back to main menu',
  ABITRARY: 'Arbitrary command in selected repos',
  ADD: 'Add file(s)',
  BRANCH: 'Switch Branch (new/existing)',
  COMMIT: 'Commit',
  DELETE: 'Delete local branch',
  FETCH: 'Fetch',
  PULL: 'Pull',
  FORCE_PULL: 'Pull (force) (reset branch and pull)',
  PUSH: 'Push',
  FORCE_PUSH: 'Push (force)',
  PR: 'Open a PR for active branches',
  STASH: 'Stash / Discard Changes',
  STATUS: 'Status'
}

interface KnownRepos { [alias: string]: string }

export const knownRepos: KnownRepos = {

}

export async function getRepos() {
  const repos: Record<keyof KnownRepos, { dir: string, alias: string }> = {}
  for (const key in knownRepos) {
    const path = knownRepos[key]
    const status = await getBranchStatus(path)
    repos[key] = { dir: path, alias: `${key} - ${status}` }
  }
  return repos
}

export function getRepo(opts: Record<keyof KnownRepos, { dir: string, alias: string }>, choice: string) {
  const repoName = /(.+) - .+/.exec(choice)?.[1]
  return Object.values(opts).find(o => o.alias.startsWith(repoName))?.dir
}

export async function gitJourney() {
  const REPOS = await getRepos()

  if (!Object.keys(REPOS).length) {
    return console.warn(`There are no known repos for this team. See "journeys/et/gitCommon.ts" for an example of how to set this up. Aborting journey...`)
  }

  const answers = await prompt([
    { name: 'repos', message: QUESTION_REPOS, type: 'checkbox', choices: Object.values(REPOS).map(o => o.alias), pageSize: getIdealSizeForInquirer() }
  ])

  if (!answers.repos.length) {
    return
  }

  while (true) {
    let followup: Record<string, any> = { repos: answers.repos }
    const branchOpts = await getBranchOpts(getRepo(REPOS, followup.repos[0]))

    followup = await askAutoComplete(followup, { name: 'task', message: QUESTION_TASK, default: TASK_CHOICES.PULL, choices: Object.values(TASK_CHOICES), askAnswered: true, sort: false })
    const repos = followup.repos as string[]

    switch (followup.task) {
      case TASK_CHOICES.ADD:
        followup = await prompt([{ name: 'command', message: QUESTION_ADD, askAnswered: true, default: '.' }], followup)
        await Promise.allSettled(repos.map(async o => await add(getRepo(REPOS, o), followup.command)))
        break
      case TASK_CHOICES.BACK:
        return
      case TASK_CHOICES.BRANCH:
        followup = await askAutoComplete(followup, { name: 'branch', message: QUESTION_BRANCH, default: 'master', choices: [CUSTOM, ...branchOpts], askAnswered: true, sort: true })
        if (followup.branch === CUSTOM) {
          followup = await prompt([{ name: 'branch', message: QUESTION_BRANCH, askAnswered: true }], followup)
        }

        await Promise.allSettled(repos.map(async o => await switchBranch(getRepo(REPOS, o), followup.branch, /(.+) - /.exec(o)?.[1])))
        break
      case TASK_CHOICES.COMMIT:
        followup = await askBasicFreeEntry(followup, { name: 'message', message: QUESTION_MESSAGE_COMMIT })
        await Promise.allSettled(repos.map(async o => await commit(getRepo(REPOS, o), followup.message)))
        break
      case TASK_CHOICES.DELETE:
        followup = await askAutoComplete(followup, { name: 'branch', message: QUESTION_BRANCH, default: 'master', choices: [CUSTOM, ...branchOpts], askAnswered: true, sort: true })
        if (followup.branch === CUSTOM) {
          followup = await prompt([{ name: 'branch', message: QUESTION_BRANCH, askAnswered: true }], followup)
        }

        await Promise.allSettled(repos.map(async o => await deleteBranch(getRepo(REPOS, o), followup.branch)))
        break
      case TASK_CHOICES.FETCH:
        await Promise.allSettled(repos.map(async o => await fetch(getRepo(REPOS, o))))
        break
      case TASK_CHOICES.FORCE_PUSH:
        await Promise.allSettled(repos.map(async o => await push(getRepo(REPOS, o), true)))
        break
      case TASK_CHOICES.PR:
        await openPRJourney(followup)
        break
      case TASK_CHOICES.PULL:
        await Promise.allSettled(repos.map(async o => await pull(getRepo(REPOS, o), false)))
        break
      case TASK_CHOICES.FORCE_PULL:
        await Promise.allSettled(repos.map(async o => await pull(getRepo(REPOS, o), true)))
        break
      case TASK_CHOICES.PUSH:
        await Promise.allSettled(repos.map(async o => await push(getRepo(REPOS, o))))
        break
      case TASK_CHOICES.STATUS:
        await Promise.allSettled(repos.map(async o => await status(getRepo(REPOS, o))))
        break
      case TASK_CHOICES.STASH:
        followup = await askBasicFreeEntry(followup, { name: 'message', message: QUESTION_MESSAGE_STASH })
        await Promise.allSettled(repos.map(async o => await stash(getRepo(REPOS, o), followup.message)))
        break
      case TASK_CHOICES.ABITRARY:
        followup = await askBasicFreeEntry(followup, { name: 'message', message: QUESTION_ABITRARY_COMMAND })
        await Promise.allSettled(repos.map(async o => await runCommand(getRepo(REPOS, o), followup.message)))
        break
    }
  }
}

async function runCommand(path: string, command: string) {
  const { stderr, stdout } = await execCommand(command, path, false)
  console.log(`${command} in ${path}`)
  console.log(stderr)
  console.log(stdout)
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

async function switchBranch(path: string, branch: string, repoAlias: string) {
  let { stdout, stderr } = await execCommand(`git checkout ${branch}`, path, false)
  if (stderr) {
    const result = await execCommand(`git checkout -b ${branch}`, path, false)
    stdout = result.stdout
    stderr = result.stderr
  }

  console.log(`Checkout in ${path}`)
  console.log(stderr || stdout)

  const newBranch = await currentBranch(path)

  if (newBranch === branch) {
    return
  }

  // Something went wrong during switching
  const answers = await prompt([{ name: 'branch', message: `Failed to switch branch in ${repoAlias} (likely due to unstashed changes). Would you like to force a switch? (hard reset and switch?)`, type: 'list', choices: YES_OR_NO }])

  if (answers.branch === NO) {
    return
  }

  await pull(path, true)
  await switchBranch(path, branch, repoAlias)
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

async function pull(path: string, force = false) {
  try { await fetch(path) } catch (e) { }
  const branch = await currentBranch(path)
  if (force) {
    await reset(path)
  }
  const { stdout, stderr } = await execCommand(`git pull origin ${branch}`, path, false)
  console.log(`Pull in ${path}`)
  console.log(stderr || stdout)
}

async function reset(path: string) {
  const branch = await currentBranch(path)
  const { stdout, stderr } = await execCommand(`git reset --hard origin/${branch}`, path, false)
  console.log(`Reset in ${path}`)
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
  try { await fetch(path) } catch (e) { }
}

async function commit(path: string, message?: string) {
  const { stdout, stderr } = await execCommand(`git commit -m '${message || 'no message provided'}'`, path, false)
  console.log(`Committing in ${path}`)
  console.log(stderr || stdout)
}

async function stash(path: string, message?: string) {
  message = message ? ` push -m '${message.replace(/'/g, '"')}'` : ''
  const { stdout, stderr } = await execCommand(`git stash${message} --include-untracked`, path, false)
  console.log(`Stashing in ${path}`)
  console.log(stderr || stdout)
}

async function status(path: string) {
  const { stdout, stderr } = await execCommand('git status', path, false)
  console.log(`Status in ${path}`)
  console.log(stderr || stdout)
}

export default {
  group: 'git',
  text: 'Git(hub) commands',
  fn: gitJourney,
  alias: 'GitCommon'
} as Journey
