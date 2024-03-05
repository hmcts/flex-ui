import { sayWarning } from 'app/questions'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { knownRepos } from '../base/gitCommon'
import { execCommand, temporaryLog } from 'app/helpers'

async function journey() {
  const TASKS = {
    DISTRIBUTIONS: 'Clear distributions',
    GRADLE: 'Clear gradle caches',
    JETBRAINS: 'Clear JetBrains Gateway IDE installations',
  }

  const answers = await prompt([{ name: 'task', message: 'What do we want to do?', type: 'checkbox', choices: Object.values(TASKS) }])

  if (answers.task.length === 0) {
    return
  }

  const spaceBefore = await getSpace('~')

  if (answers.task.includes(TASKS.DISTRIBUTIONS)) {
    await clearDistributions()
  }

  if (answers.task.includes(TASKS.GRADLE)) {
    await clearGradleCaches()
  }

  if (answers.task.includes(TASKS.JETBRAINS)) {
    await clearJetBrainsCaches()
  }

  const spaceAfter = await getSpace('~')
  console.log(`Space reclaimed: ${formatBytes(spaceBefore - spaceAfter)}`)
}

async function getSpace(dir: string) {
  const space = await execCommand(`du -s ${dir} | awk '{print $1}'`)
  return Number(space.stdout)
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i + 1]
}

async function clearDistributions() {
  // For each java repo - clear the build/distributions folder

  for (const repo in knownRepos) {
    temporaryLog(`Clearing distributions for ${repo}...`)
    await execCommand(`rm -rf ${knownRepos[repo]}/build/distributions`, null, false)
  }
}

async function clearGradleCaches() {
  // ~/.gradle

  temporaryLog('Clearing gradle caches...')
  await execCommand(`rm -rf ~/.gradle/`, null, false)
  await execCommand(`rm -rf ~/.m2/`, null, false)
}

async function clearJetBrainsCaches() {
  // ~/.cache/JetBrains/RemoteDev/dist

  temporaryLog('Clearing JetBrains caches...')
  await execCommand(`rm -rf ~/.cache/JetBrains/RemoteDev/dist/`, null, false)
}

export default {
  group: 'et-wsl',
  text: '[WIP] Cleanup / Clear Caches',
  fn: async () => await sayWarning(journey),
  alias: 'WSLCache'
} as Journey