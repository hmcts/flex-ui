import { getRunningContainers, stopContainers } from 'app/et/docker'
import { ensurePathExists, execCommand, getEnvVarsFromFile, getIdealSizeForInquirer, temporaryLog, wait } from 'app/helpers'
import { ChildProcess, spawn } from 'child_process'
import { createWriteStream, readFileSync, truncateSync, writeFile, writeFileSync } from 'fs'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { waitForDmStore } from './dockerCommon'
import { generateSpreadsheetsForBothRepos } from './configsCommon'
import { getHostnameIP, getWslHostIP } from './dockerUpdateIP'
import { resolve, sep } from 'path'
import { killFrontendServices, makeLocalChangesForFrontend, startFrontendServices } from './launchServices'

enum CFTLIB_ACTION {
  BACK = '<-- Back',
  START = 'Start',
  STOP = 'Stop',
  MAINTANENCE = 'Maintanence',
}

const CFTLIB_CONTAINERS = [
  'wiremock',
  'compose-dm-store-1',
  'compose-azure-storage-emulator-azurite-1',
  'cftlib-ccd-elasticsearch-1',
  'cftlib-rse-idam-simulator-1',
  'cftlib-shared-database-pg12-1',
  // The last two often don't start up with the ./gradlew bootWithCCD command
  'cftlib-xui-manage-org-1',
  'cftlib-xui-manage-cases-1',
]

const CFTLIB_WA_CONTAINERS = [
  "wa-task-monitor",
  "case-event-handler",
  "workflow-api",
  "wa-task-management-api",
  "message-publisher",
  "compose-camunda-local-bpm-1",
]

const CFTLIB_PORTS = [
  4451, 4452, 4453, 4455, 4096, 8489, 8081
]

const ALL_CFTLIB_CONTAINERS = [...CFTLIB_CONTAINERS, ...CFTLIB_WA_CONTAINERS]

let cftLibChild: ChildProcess
let messageHandlerChild: ChildProcess
let stdout: NodeJS.WritableStream

async function isCurrentlyRunning() {
  const { stdout } = await execCommand('lsof -i :8081 -t', null, false)
  return stdout.trim().length > 0
}

async function journey() {
  const running = await isCurrentlyRunning()
  const answers = await prompt([{
    message: `Would you like to start up or stop CFTLib? (Currently ${running ? '' : 'not '}running)`,
    name: 'action', type: 'list', choices: Object.values(CFTLIB_ACTION), default: running ? CFTLIB_ACTION.STOP : CFTLIB_ACTION.START
  }])

  if (answers.action === CFTLIB_ACTION.BACK) {
    return
  }

  if (answers.action === CFTLIB_ACTION.MAINTANENCE) {
    // Stop CFTLib
    await stopCFTLib()
    return await askUserWhatMaintananceTasks()
  }

  if (answers.action === CFTLIB_ACTION.STOP) {
    // Stop CFTLib
    await stopCFTLib()
    await killFrontendServices()
    // Only want to stop
    return
  }

  await askBootCftTasks()
}

async function isWaEnablked() {
  const { stdout } = await execCommand('env | grep CFTLIB_EXTRA_COMPOSE_FILES', null, false)
  const { stdout: buildGradle } = await execCommand('cat build.gradle', process.env.ET_CCD_CALLBACKS_DIR, false)

  const buildWaEnabled = buildGradle.match(/^\s* environment 'CFTLIB_EXTRA_COMPOSE_FILES'.*wa-docker-compose.yml/m)

  return !!stdout.trim().match('wa-docker-compose.yml') || !!buildWaEnabled
}

async function getExpectedContainers() {
  const waEnabled = await isWaEnablked()
  return waEnabled ? CFTLIB_CONTAINERS.concat(CFTLIB_WA_CONTAINERS) : CFTLIB_CONTAINERS
}

async function getBranchNameForConfigs() {
  const { stdout: ew } = await execCommand('git branch --show-current', process.env.ENGWALES_DEF_DIR, false)
  const { stdout: sc } = await execCommand('git branch --show-current', process.env.SCOTLAND_DEF_DIR, false)
  return { ew, sc }
}

async function askBootCftTasks() {
  const { ew, sc } = await getBranchNameForConfigs()
  const waEnabled = await isWaEnablked()
  console.log(`WA Enabled: ${waEnabled}`)

  const OPTS = {
    GENERATE: `Generate CCD Configs (yarn generate-excel cftlib) (Current branches: ${ew.trim()} / ${sc.trim()})`,
    AZURE: 'Azure Login (az login)',
    IDAM: 'Pull IdAM image (docker pull hmctspublic.azurecr.io/hmcts/rse/rse-idam-simulator:latest)',
    CFTLIB: 'Start CFTLib (./gradlew bootWithCCD)',
    MAX_CONNECTIONS: 'Increase postgres max to 1000',
    WIREMOCK: 'Ensure wiremock starts up (often struggles in WSL)',
    DMSTORE: 'Restart DM Store if it gets stuck doing migrations',
    RESTART: 'Restart xui-manage-org container (often fails to start the first time)',
    XUI: 'Replace xui-manage-cases container with our own (see cftlib/docker-compose.yml)',
    SERVICEBUS: '[WIP] Start et-message-handler',
    FRONTEND: '[WIP] Start et-sya-api and et-sya-frontend',
    WA_TASKS: 'Import Camunda tasks for WA (./scripts/camunda-deployment.sh)',
  }

  const defaults = Object.values(OPTS)
  defaults.splice(defaults.indexOf(OPTS.AZURE), 1)
  defaults.splice(defaults.indexOf(OPTS.IDAM), 1)

  if (!waEnabled) {
    defaults.splice(defaults.indexOf(OPTS.WA_TASKS), 1)
  }

  const answers = await prompt([{ name: 'tasks', message: 'What tasks are we interested in?', type: 'checkbox', choices: Object.values(OPTS), default: defaults, pageSize: getIdealSizeForInquirer() }])

  if (answers.tasks.find(o => o.startsWith(OPTS.GENERATE))) {
    temporaryLog('Generating CCD Configs')
    await generateSpreadsheetsForBothRepos('cftlib')
  }

  if (answers.tasks.includes(OPTS.AZURE)) {
    temporaryLog('Attempting an az Login')
    await azLogin()
  }
  if (answers.tasks.includes(OPTS.IDAM)) {
    temporaryLog(`Pulling IdAM image`)
    await pullIdamImage()
  }
  if (answers.tasks.includes(OPTS.CFTLIB)) {
    // Start CFTLib
    await replaceHostnameInFlexCompose()
    await replaceHostnameInCallbacksCompose()
    await replaceHostnameInCallbacksApplicationYaml()
    await setGlobalEnvVars()

    temporaryLog('Starting and waiting for CFTLib to boot (./gradlew bootWithCCD)')
    await startCFTLib(answers.tasks.includes(OPTS.WIREMOCK))
  }
  if (answers.tasks.includes(OPTS.MAX_CONNECTIONS)) {
    const out = await execCommand(`PGPASSWORD="postgres" PGHOST="localhost" PGPORT=6432 psql -U postgres -d postgres -c "ALTER SYSTEM SET max_connections TO '1000'"`, null, false)
    console.log(out.stderr)
    console.log(out.stdout)
    await execCommand('docker restart cftlib-shared-database-pg12-1', null, false)
  }
  if (answers.tasks.includes(OPTS.DMSTORE)) {
    // dm-store can still crash, so make sure it's loaded correctly or reboot if not
    await waitForDmStore()
  }
  if (answers.tasks.includes(OPTS.XUI)) {
    temporaryLog('Replacing xui-manage-cases container - CHECK IF STILL NEEDED')
    await replaceXuiManageCases()
  }
  if (answers.tasks.includes(OPTS.RESTART)) {
    temporaryLog('Booting up XUI containers if not started')
    await bootupXuiContainers()
  }

  if (answers.tasks.includes(OPTS.SERVICEBUS)) {
    temporaryLog('Starting et-message-handler')
    await startMessageHandler()
  }

  if (answers.tasks.includes(OPTS.FRONTEND)) {
    temporaryLog('Starting et-sya-api and et-sya-frontend')
    await killFrontendServices()
    await makeLocalChangesForFrontend()
    await startFrontendServices()
  }

  if (answers.tasks.includes(OPTS.WA_TASKS)) {
    temporaryLog('Importing Camunda tasks for WA')
    await importCamundaTasks()
  }
}

async function startMessageHandler() {
  if (!process.env.ET_MESSAGE_HANDLER_DIR) {
    return console.warn(`ET_MESSAGE_HANDLER_DIR not set - skipping...`)
  }

  messageHandlerChild = spawn('./gradlew', ['bootRun', `--args='--spring.profiles.active=cftlib'`], { cwd: process.env.ET_MESSAGE_HANDLER_DIR, env: { ...process.env, ...getEnvVarsFromFile() } })
  ensurePathExists('./logs')
  writeFileSync('./logs/et-message-handler.log', '')
  truncateSync('./logs/et-message-handler.log')
  stdout = createWriteStream('./logs/et-message-handler.log', { flags: 'a' })
  messageHandlerChild.stdout.pipe(stdout)
  messageHandlerChild.stderr.pipe(stdout)
}

async function importCamundaTasks() {
  const { stdout, stderr } = await execCommand(`./scripts/camunda-deployment.sh`, process.env.ET_WA_TASK_CONFIGURATION_DIR, false)
  console.log('log ' + stdout)
  console.error('error ' + stderr)
  if (stderr.includes('Empty reply from server') || stdout.includes('Empty reply from server')) {
    temporaryLog('Camunda deployment failed - retrying...')
    await wait(10000)
    return await importCamundaTasks()
  }
}

async function startCFTLib(dealWithWiremock = true) {
  if (stdout) {
    try { stdout.end() } catch { }
  }

  cftLibChild = spawn('./gradlew', ['bootWithCCD'], { cwd: process.env.ET_CCD_CALLBACKS_DIR, env: { ...process.env, ...getEnvVarsFromFile() } })
  ensurePathExists('./logs')
  writeFileSync('./logs/cftlib.log', '')
  truncateSync('./logs/cftlib.log')
  stdout = createWriteStream('./logs/cftlib.log', { flags: 'a' })
  cftLibChild.stdout.pipe(stdout)
  cftLibChild.stderr.pipe(stdout)

  let secondsElapsed = 0
  while (true) {
    await wait(10000)
    secondsElapsed += 10
    const containers = await getRunningContainers(ALL_CFTLIB_CONTAINERS)
    const expectedContainers = await getExpectedContainers()

    if (containers.length >= expectedContainers.length - 2) {
      // Assume started up - xui-manage-org and xui-manage-cases often don't start up
      return true
    }

    // It is possible for wiremock to have issues mounting the mocks (for some reason)
    // We need to deal with this here as it's common enough to annoy me

    if (dealWithWiremock && secondsElapsed > 60 && containers.length >= 6 && !containers.includes('wiremock') && await isWiremockBroken()) {
      await execCommand(`docker rm wiremock --force`, null, false)
      console.warn(`Wiremock container failed to come up - removing and retrying...`)
      await stopCFTLib()
      return await startCFTLib()
    }

    if (secondsElapsed > 60 * 5) {
      temporaryLog(`CFTLib is taking too long to start - please check log file ./logs/cftlib.log... (${containers.length} / ${expectedContainers.length - 2} containers running)`)
      continue
    }

    temporaryLog(`Still waiting for CFTLib to start up (${containers.length} / ${expectedContainers.length - 2} containers running) (check ./logs/cftlib.log for output)`)
  }
}

async function hasCftlibFailed() {
  const { stdout } = await execCommand('cat ./logs/cftlib.log | grep "**** CFTLIB failed to start ****"', null, false)
  return stdout.trim().length > 0
}

async function isWiremockBroken() {
  const { stdout, stderr } = await execCommand('docker start wiremock', null, false)
  return (stderr || stdout).includes('unable to start container process')
}

async function stopCFTLib() {
  if (cftLibChild) {
    temporaryLog(`Killing CFTLib child process previously started by me`)
    try { cftLibChild.kill() } catch (e) { }
  }

  if (messageHandlerChild) {
    temporaryLog(`Killing et-message-handler child process previously started by me`)
    try { messageHandlerChild.kill() } catch (e) { }
  }

  if (stdout) {
    try { stdout.end() } catch { }
  }

  temporaryLog(`Stopping related CFTLib containers`)
  await stopContainers(ALL_CFTLIB_CONTAINERS)

  temporaryLog(`Terminating processes listening on CFTLib related ports`)
  CFTLIB_PORTS.forEach(port => execCommand(`kill -9 $(lsof -i:${port} -t)`, null, false))
}

async function azLogin() {
  const { stdout, stderr } = await execCommand('az acr login --name hmctspublic', null, false)
  if (!stdout.startsWith('Login Succeeded')) {
    console.error(`Failed to login to Azure: ${stderr || stdout}`)
  }
}

async function pullIdamImage() {
  const res = await execCommand('docker pull hmctspublic.azurecr.io/hmcts/rse/rse-idam-simulator:latest', null, false)
  console.log(res.stdout)
  console.error(res.stderr)
}

async function bootupXuiContainers() {
  await execCommand('docker start cftlib-xui-manage-org-1 cftlib-xui-manage-cases-1', null, false)
}

async function replaceHostnameInFlexCompose() {
  const contents = readFileSync('./cftlib/docker-compose.yml').toString()
  const ip = await getHostnameIP()
  const newContents = contents.replace(/172\.\d+\.\d+\.\d+/g, ip)
  writeFileSync('./cftlib/docker-compose.yml', newContents)
}

async function replaceHostnameInCallbacksCompose() {
  const filePath = `${process.env.ET_CCD_CALLBACKS_DIR}${sep}src${sep}cftlib${sep}resources${sep}compose${sep}docker-compose.yml`
  const contents = readFileSync(filePath).toString()
  const regex = /IDAM_S2S_BASE_URI: (.+)/g.exec(contents)
  if (!regex) {
    throw new Error('Failed to find IDAM_S2S_BASE_URI in docker-compose.yml')
  }
  const ip = await getHostnameIP()
  const newContents = contents.replace(regex[0], `IDAM_S2S_BASE_URI: http://${ip}:8489`)
  writeFileSync(filePath, newContents)
}

function resolveRegexReplacements(regex, string) {
  const matches = string.matchAll(/\$(\d+)/g)
  for (const match of matches) {
    const [_, envVar] = match
    string = string.replace(_, regex[envVar] || '')
  }

  return string
}

async function replaceHostnameInCallbacksApplicationYaml() {
  const ip = await getHostnameIP()
  const filePath = `${process.env.ET_CCD_CALLBACKS_DIR}${sep}src${sep}main${sep}resources${sep}application-cftlib.yaml`
  const contents = readFileSync(filePath).toString()
  const replacers = [
    { regex: /data-store-api-url: .+/g, replacement: `data-store-api-url: http://${ip}:4452` },
    { regex: /(case_document_am:\n\s+url: ).+/g, replacement: `$1http://${ip}:4455` },
  ]

  let newContents = contents

  for (let { regex, replacement } of replacers) {
    const match = regex.exec(contents)
    if (!match) {
      throw new Error(`Failed to find ${regex} in application-cftlib.yaml`)
    }

    const final = resolveRegexReplacements(match, replacement)

    newContents = newContents.replace(match[0], final)
  }

  writeFileSync(filePath, newContents)
}

async function setGlobalEnvVars() {
  const ip = await getHostnameIP()

  const vars = {
    JVM_HOST: ip,
    XUI_S2S_URL: `http://${ip}:8489`,
    XUI_DOCUMENTS_API_V2: `http://${ip}:4455`
  }

  for (const name in vars) {
    const val = vars[name]
    await execCommand(`export ${name}="${val}"`, null, false)
  }

  const res = await execCommand('env', null, false)
  console.log(res.stdout)
}

async function replaceXuiManageCases() {
  await execCommand('docker rm cftlib-xui-manage-cases-1 cftlib-xui-manage-org-1 --force', null, false)
  const { stdout, stderr } = await execCommand('docker-compose up -d', './cftlib', false)
  console.log(stdout)
  console.error(stderr)
}

async function askUserWhatMaintananceTasks() {
  const CHOICES = {
    CONTAINERS: 'Remove containers',
    IMAGES: 'Remove Images (will prompt cftlib to download images on next start)',
    VOLUMES: 'Remove Volumes (will clear database)'
  }

  const answers = await prompt([{ name: 'what', message: 'What tasks are we interested in?', type: 'checkbox', choices: Object.values(CHOICES), default: [CHOICES.CONTAINERS, CHOICES.VOLUMES] }])

  if (answers.what.includes(CHOICES.CONTAINERS)) {
    // Force rm all containers in cftlib
    await Promise.allSettled(ALL_CFTLIB_CONTAINERS.map(container => execCommand(`docker rm ${container} --force`, null, false)))
  }

  if (answers.what.includes(CHOICES.VOLUMES)) {
    // Prune volumes in docker should delete all volumes used by cftlib (volumes that are not used by any container)
    await execCommand(`docker volume prune --force`, null, false)
  }

  if (answers.what.includes(CHOICES.IMAGES)) {
    // Prune images
    await execCommand(`docker image prune --all --force`, null, false)
  }
}

export default {
  disabled: false,
  group: 'et-cftlib',
  text: 'Manage CFTLib',
  fn: journey,
  alias: 'cftlib'
} as Journey
