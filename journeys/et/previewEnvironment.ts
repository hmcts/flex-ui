import { CUSTOM, YES } from 'app/constants'
import { execCommand, formatTableRows, retryFetch, underlineRow, wait } from 'app/helpers'
import { Answers, askAutoComplete, askYesOrNo } from 'app/questions'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { prompt } from 'inquirer'
import { EOL } from 'os'
import { Journey } from 'types/journey'
import { parse, stringify } from 'yaml'
import { createRoles } from './webCreateCase'
import { sep } from 'path'
import { uploadToEnvironment } from './configsCommon'
import { rmdir } from 'fs/promises'

/**
 * This journey will house tasks relating to setting up and maintaining a preview environment.
 * The rules for this seem to change quite often, so this journey will probably change a fair bit.
 * 
 * 1. An Admin PR exists:
 *   - Get tags for dependant services from the values.preview.template.yaml file
 *   - Check if the tag exists on the ACR
 *   - If a tag does not exist, the neither 
 *        - Attempt to find an adjacent tag and use this (ie PR-420 might not exist, but PR-420-6547f59-20231002072751 does) and make a commit to the Admin PR using these
 *        - Restart the pipeline for that PR (requires jenkins authorisation which I've not figured out yet)
 *   - Commit any changes made to the Admin PR
 *   - Wait for tags to be available on ACR
 *   - Push the previously made commit if possible or trigger a rebuild (again requiring jenkins creds)
 
 */

const GIT_REPO_TO_ACR_REPO = {
  'et-ccd-callbacks': 'et/cos',
  'et-sya-frontend': 'et/sya',
  'et-sya-api': 'et/sya-api',
  'rpx-xui-webapp': 'xui/webapp'
}

async function journey() {
  const opts = [
    'Create Preview Environment',
    'Repair Preview Environment',
    'View existing Preview Environments',
    'Run post setup tasks (create roles, upload configs, db migrations)',
    'Get IP address for postgresql pod'
  ]
  let answers = await prompt([{ name: 'task', message: 'What do you want to do?', type: 'list', choices: opts, default: opts[1] }])

  switch (answers.task) {
    case opts[0]:
      return await createPreviewEnv()
    case opts[1]:
      answers = await prompt([{ name: 'pr', message: `What PR number are we interested in?`, validate: (o => Number(o) > 0) }], answers)
      return await repairPreviewEnv(answers.pr)
    case opts[2]:
      return await viewPreviewEnvs()
    case opts[3]:
      answers = await prompt([{ name: 'pr', message: `What PR number are we interested in?`, validate: (o => Number(o) > 0) }], answers)
      return await runPostSetupTasks(answers.pr)
    case opts[4]:
      answers = await prompt([{ name: 'pr', message: `What PR number are we interested in?`, validate: (o => Number(o) > 0) }], answers)
      const ip = await getPostgresIPFromPod(answers.pr)
      console.log(ip)
      break
  }
}

export async function getPostgresIPFromPod(prNumber: string) {
  const pods = await getPodsGroupedByPreviewEnv()
  const prPods = pods[prNumber]

  const postgresPod = prPods.find(o => o.metadata.name.includes('postgresql'))
  return postgresPod?.status.podIP
}

async function runPostSetupTasks(prNumber: string) {
  await createRoles(prNumber)
  await insertDBData(prNumber)
  try {
    await generateAndUploadConfigs(prNumber)
  } catch (e) {
    console.log(`Failed to gen/upload configs - ${e.error?.cmd || e} in ${e.error?.cwd || '<idklol>'}`)
  }

}

async function generateAndUploadConfigs(prNumber: string) {
  const path = await pullAndResetRepo('et-ccd-definitions-admin')
  await execCommand(`gh pr checkout ${prNumber}`, path)

  const gitModules = await readGitModules(readFileSync(`${path}/.gitmodules`, 'utf8'))

  const ewPath = await pullAndResetRepo('et-ccd-definitions-englandwales')
  const scPath = await pullAndResetRepo('et-ccd-definitions-scotland')
  await execCommand(`git checkout ${gitModules.find(o => o.name === 'et-ccd-definitions-englandwales').props.branch}`, ewPath)
  await execCommand(`git checkout ${gitModules.find(o => o.name === 'et-ccd-definitions-scotland').props.branch}`, scPath)

  await execCommand(`yarn generate-excel-preview ${prNumber}`, ewPath, false)
  await execCommand(`yarn generate-excel-preview ${prNumber}`, scPath, false)

  await uploadToEnvironment('preview', prNumber)
}

async function insertDBData(prNumber: string) {
  const ip = await getPostgresIPFromPod(prNumber)
  if (!ip) {
    throw new Error(`Failed to get IP for postgresql pod`)
  }

  // Check if we need to do a DB INSERT
  const { stdout } = await execCommand(`PGPASSWORD="hmcts" PGHOST="${ip}" psql -U hmcts -d et_cos -c "SELECT * FROM venue LIMIT 100"`, null, false)
  const isEmpty = stdout.split(EOL).find(o => o === '(0 rows)')

  if (!isEmpty) {
    const answers = await prompt([{ name: 'confirm', message: 'The database is not empty. Are you sure you need to insert data?', type: 'confirm' }])
    if (!answers.confirm) {
      return
    }
  }
  // Get V003.1__DevReferenceData.sql from et-ccd-callbacks (on master for now)
  const dbRes = await retryFetch(`https://raw.githubusercontent.com/hmcts/et-ccd-callbacks/master/src/main/resources/db/dev/V003.1__DevReferenceData.sql`)
  const dbText = await dbRes.text()

  const out = await execCommand(`PGPASSWORD="hmcts" PGHOST="${ip}" psql -U hmcts -d et_cos -c "${dbText}"`, null, false)
}

async function viewPreviewEnvs() {
  const results = await getPreviewEnvSummary()

  const out = formatTableRows([
    ...underlineRow({ env: 'Preview', title: 'PR Title', pods: 'Pods State', problems: 'Problems' }),
    ...results.map(o => {
      const totalPods = o.notReadyPods.length + o.readyPods.length
      return { env: `PR-${o.prNumber}`, title: o.prTitle, pods: `${o.readyPods.length} / ${totalPods}`, problems: o.notReadyPods.map(o => `${o.name}`).join(', ') || '<none>' }
    })
  ]).map((o, i) => `${i ? '' : '\x1b[1m'}${o.title.substring(0, 64)} ${o.env} ${o.pods} ${o.problems}${i ? '' : '\x1b[0m'}`).join(EOL)

  console.log(out + EOL)
}

async function getPreviewEnvSummary() {
  const pods = await getPodsGroupedByPreviewEnv()
  const openPRs = await getPRsForRepo('et-ccd-definitions-admin')

  return Object.keys(pods).map(o => {
    const prNumber = o
    const prPods = pods[o].filter(o => o.metadata.ownerReferences[0].kind !== "Job")
    const prTitle = openPRs.find(p => p.value === prNumber)?.title
    // Check if any pods are not ready

    const readyPods = prPods?.filter(o => o.status.containerStatuses.some(o => o.ready)).map(o => o.serviceName)
    const notReadyPods = prPods?.filter(o => o.status.containerStatuses.some(o => !o.ready))
      .map(o => {
        let reason = o.status.containerStatuses[0].state.waiting?.reason || JSON.stringify(o.status.containerStatuses[0].state)

        if (reason === 'ImagePullBackOff') {
          reason = `${reason}-${o.status.containerStatuses[0].image.replace('hmctspublic.azurecr.io/', '')}`
        }

        return {
          name: o.serviceName,
          reason: reason
        }
      })

    return {
      prTitle,
      prNumber,
      readyPods,
      notReadyPods
    }
  })
}

export async function pullAndResetRepo(repoName: string) {
  const path = await cloneRepoToTmp(repoName)
  await execCommand(`git checkout -b ${Date.now()}`, path)
  await execCommand('git branch -D master', path, false)
  await execCommand('git checkout master --force', path)
  await execCommand('git pull origin master', path)

  return path
}

async function createPreviewEnv() {
  const path = await pullAndResetRepo('et-ccd-definitions-admin')

  let answers: Answers = {}

  answers = await prompt([{ name: 'adminBranch', message: 'What branch are we basing off of?', default: 'master' }], answers)

  if (answers.adminBranch !== 'master') {
    await execCommand(`git checkout ${answers.adminBranch}`, path)
  }

  // TOOD: Ask about branch for et-ccd-definitions-(englandwales|scotland), and modify as appropiate in .gitmodules

  const submodules = await readGitModules(readFileSync(`${path}/.gitmodules`, 'utf8'))

  // Ask user to select a branch for et-ccd-definitions-englandwales and et-ccd-definitions-scotland
  const ewOpts = await getPRsForRepo('et-ccd-definitions-englandwales')
  const scOpts = await getPRsForRepo('et-ccd-definitions-scotland')

  const ewDefsKey = 'defs-englandwales'
  const scDefsKeys = 'defs-scotland'
  answers = await askAutoComplete(answers, { name: ewDefsKey, message: 'What branch should we use for et-ccd-definitions-englandwales?', choices: [CUSTOM, 'master', ...ewOpts.map(o => o.key)], default: 'master' })
  answers = await askAutoComplete(answers, { name: scDefsKeys, message: 'What branch should we use for et-ccd-definitions-scotland?', choices: [CUSTOM, 'master', ...scOpts.map(o => o.key)], default: answers[ewDefsKey] || 'master' })

  // Update the .gitmodules file to use the selected branches
  const ewSubmodule = submodules.find(o => o.name === 'et-ccd-definitions-englandwales')
  const scSubmodule = submodules.find(o => o.name === 'et-ccd-definitions-scotland')

  ewSubmodule.props.branch = ewOpts.find(o => o.key === answers[ewDefsKey])?.branch || answers[ewDefsKey] as string || 'master'
  scSubmodule.props.branch = scOpts.find(o => o.key === answers[scDefsKeys])?.branch || answers[scDefsKeys] as string || 'master'

  await writeGitModules(submodules, path)

  // Ask the user what PR numbers we need to use for each dependant service
  const services = await getPreviewValues(path) // Hopefully user does not need to register a new service...


  const changedTags = []

  for (const service of services) {
    const gitRepo = getGitRepoFromAcrRepo(service.repositoryName)

    if (gitRepo) {

      // Use GH CLI to find the PR number for the branch (if available)
      // Match the PR number to the branch name
      const choices = await getPRsForRepo(gitRepo)

      //answers = await prompt([{ name: service.serviceName, message: `What tag should we use for ${service.serviceName}? (use 'latest' for master or specify pr-X for a PR)`, default: service.tag }], answers)
      answers = await askAutoComplete(answers, { name: service.serviceName, message: `What tag should we use for ${service.serviceName}? (use 'latest' for master or specify pr-X for a PR)`, choices: [CUSTOM, 'latest', ...choices.map(o => o.key)], default: 'latest' })
      answers[service.serviceName] = (choices.find(o => o.key === answers[service.serviceName]) || { value: answers[service.serviceName] }).value

      if (answers[service.serviceName] !== 'latest') {
        answers[service.serviceName] = `pr-${answers[service.serviceName]}` // Add the pr- prefix
      }
    } else {
      answers = await prompt([{ name: service.serviceName, message: `What tag should we use for ${service.serviceName}? (use 'latest' for master or specify pr-X for a PR)`, default: service.tag }], answers)
    }

    if (answers[service.serviceName] !== service.tag && answers[service.serviceName] !== 'latest') {
      changedTags.push(`${service.serviceName}-${answers[service.serviceName].toString().replace('pr-', '')}`)
    }

    if (answers[service.serviceName] === 'latest') {
      continue
    }

    // Check if the selected tag is available on ACR
    const available = await isTagOnAcr(answers[service.serviceName] as string, service.acrName, service.repositoryName)

    if (available) {
      continue // All good - nothing to do here
    }

    // If not available, ask if we should rebuild the PR
    answers = await askYesOrNo(answers, { name: 'rebuild', message: `Tag ${answers[service.serviceName]} is not available on ${service.acrName}/${service.repositoryName}. Would you like to trigger a rebuild of ${service.serviceName}?`, askAnswered: true })

    if (answers.rebuild === YES) {
      // TODO: Check status of last build on GH to see if this is likely to work (but for now, blind optimism is the way)
      await triggerRebuild(gitRepo, answers[service.serviceName] as string)
    }
  }

  answers = await prompt([{ name: 'dmn', message: 'What branch should we use for the DMNs?', default: 'master' }], answers)

  // Get existing branches in remote
  const { stdout } = await execCommand(`git branch -r`, path, false)
  const takenNames = stdout.split(EOL).map(o => o.trim()).filter(o => o).map(o => o.replace('origin/', ''))

  const suggestedName = changedTags.length ? `${changedTags.join('-').substring(0, 64)}` : `${process.env.USER}-${new Date().getDate()}`

  const commitMessage = Object.keys({ ...answers, branch: undefined }).filter(o => answers[o]).map(o => `${o}: ${answers[o]}`).join(EOL)

  // Ask user what the branch name should be
  answers = await prompt([
    { name: 'branch', message: `What should the branch name be?`, default: suggestedName, validate: (o => !takenNames.includes(o)) },
    { name: 'message', message: 'Describe the purpose of this environment (used as commit message)', default: commitMessage },
    { name: 'title', message: 'What should the PR title be?', default: `${process.env.USER}\`s Untitled FlexUI Preview Environment` }
  ], answers)

  // Create the branch
  await execCommand(`git checkout -b ${answers.branch}`, path)

  // Update the values file
  for (const service of services) {
    const tag = answers[service.serviceName] as string
    changeTagInPreviewValuesYaml(service, tag, path)
  }

  changeDmnInPreviewJenkinsCnp(path, answers.dmn as string)

  // Commit the changes
  await execCommand(`git -c commit.gpgsign=false add .`, path)
  await execCommand(`git -c commit.gpgsign=false commit -m '${answers.message}'`, path)
  await execCommand(`git push --set-upstream origin ${answers.branch}`, path)

  // Open PR
  await execCommand(`gh pr create --title '${(answers.title as string).replace(/'/g, '`')}' --body '${(answers.message as string).replace(/'/g, '`')}' --base master`, path)

  // Add the enable_keep_helm flag to the PR
  await execCommand(`gh pr edit --add-label enable_keep_helm`, path)

  // TODO: Report back the newly opened PR number (and link)
  // TDOO: Ask if user wants flex to monitor it's progress (watch for checks to pass or pods to come online and be healthy - whichever happens first)
}

async function getPRsForRepo(gitRepo: string): Promise<{ key: string, branch: string, title: string, value: string }[]> {
  const out = await execCommand(`gh pr list --json headRefName,number,title --state all --limit 500 --repo hmcts/${gitRepo}`, null, false)
  return JSON.parse(out.stdout).map(o => { return { key: `${o.headRefName} - ${o.title.substring(0, 128)}`, branch: o.headRefName, title: o.title, value: o.number.toString() } })
}

async function writeGitModules(gitmodules: GitSubModule[], repoPath: string) {
  const contents = gitmodules.map(o => {
    const header = `[submodule "${o.name}"]`
    const props = Object.keys(o.props).map(p => `\t${p} = ${o.props[p]}`).join(EOL)

    return `${header}${EOL}${props}`
  }).join(EOL)

  writeFileSync(`${repoPath}${sep}.gitmodules`, contents)
}

type GitSubModule = { name: string, props: Record<string, string> }
async function readGitModules(fileContents: string): Promise<GitSubModule[]> {
  const submodules = fileContents.match(/\[submodule ".+"\](?:\n\s.+)+/gm)

  const modules = submodules.map(o => {
    const name = /submodule "(.+)"/.exec(o)[1]
    const props = o.split(EOL)
      .filter(o => o)
      .reduce((acc, o) => {
        const [_, key, value] = /^\s([^ ]+) = (.+)/g.exec(o) || []
        if (!key) { return acc }
        acc[key] = value
        return acc
      }, {})

    return { name, props }
  })

  return modules
}

async function getPodsGroupedByPreviewEnv() {
  await execCommand('kubectl config use-context cft-preview-01-aks', null, false)
  const out = await execCommand(`kubectl -n et get pods --output json`, null, false)
  const pods: { items: Pod[] } = JSON.parse(out.stdout)

  const groupedByPr = pods.items.reduce((acc, o) => {
    const prNumber = /pr-(\d+)/gi.exec(o.metadata.name)?.[1]
    if (!prNumber || !o.metadata.name.includes('et-ccd-definitions-admin')) {
      return acc
    }

    if (!acc[prNumber]) {
      acc[prNumber] = []
    }

    o.serviceName = /et-ccd-definitions-admin-pr-\d+-(.+)/.exec(o.metadata.labels['app.kubernetes.io/name'])?.[1]

    acc[prNumber].push(o)

    return acc
  }, {} as Record<string, Pod[]>)

  return groupedByPr
}

async function getCurrentAdminPrNumber() {
  const obj = await execCommand('gh pr view --json number', process.env.ADMIN_DEF_DIR, false)
  const json = JSON.parse(obj.stdout)
  const adminPrNumber = json.number

  return adminPrNumber
}

async function repairPreviewEnv(adminPrNumber: string) {
  // First check the status of the last admin PR build
  // It likely failed if we're running this journey
  // If the last build failed because "The build of this commit was aborted", we can assume that a dependant tag is not available 
  const path = await pullAndResetRepo('et-ccd-definitions-admin')
  await execCommand(`gh pr checkout ${adminPrNumber}`, path)

  const previewEnvs = await getPreviewEnvSummary()
  const ourPreviewEnv = previewEnvs.find(o => o.prNumber === adminPrNumber)

  if (!ourPreviewEnv) {
    // Our preview environment has been destroyed entirely
    console.log(`Preview ${adminPrNumber} has been destroyed entirely. We need to recreate it.`)
  }

  const services = await getPreviewValues(path)

  const watchTags: ({ prNumber?: string, gitRepo?: string } & AcrImage)[] = []
  let needsAdminRebuild = false
  let adminChangedMessage = []
  let dependantWasUpdated = false

  const tagOverview = await Promise.all(services.map(async o => {
    const result = await isTagOnAcr(o.tag, o.acrName, o.repositoryName)
    return { ...o, exists: result ? '✓' : '✘', pod: ourPreviewEnv?.readyPods.find(p => p === o.serviceName) ? '✓' : '✘' }
  }))

  const obj = formatTableRows([
    ...underlineRow({ pod: 'Pod Running', serviceName: 'Service', tag: 'Tag Name', exists: 'Available on ACR' }),
    ...tagOverview
  ]).map((o, i) => `${i ? '' : '\x1b[1m'}${o.serviceName} ${o.tag} ${o.exists} ${o.pod}${i ? '' : '\x1b[0m'}`).join(EOL)

  console.log(obj)

  for (const service of tagOverview) {
    if (service.exists) {
      continue
    }

    console.warn(`${service.acrName} does not have ${service.tag} on ${service.repositoryName}`)

    const prNumber = /pr-(\d+)/gi.exec(service.tag)?.[1]
    const branch = service.tag === 'latest' ? 'master' : `pr-${prNumber}`
    const repo = getGitRepoFromAcrRepo(service.repositoryName)

    // If the image tag is dated snapshot (ie, PR-420-6547f59-20231002072751), ask if we're happy to changed to just the main PR one (ie, PR-420)
    if (service.tag.match(/pr-\d+-\w+-\d+/gi)) {
      const answers = await askYesOrNo({}, { name: 'pr', message: `${repo}:${service.tag} is using a dated tag that is no longer available. Shall I change this to reference ${branch} instead?` })

      if (answers.pr === YES) {
        const newTag = /pr-\d+/gi.exec(service.tag)?.[0]
        changeTagInPreviewValuesYaml(service, newTag, path)
        adminChangedMessage.push(`${service.serviceName} -> ${newTag}`)
        service.tag = newTag

        if (await isTagOnAcr(newTag, service.acrName, service.repositoryName)) {
          console.log(`Tag ${newTag} is now available on ${service.acrName}`)
          needsAdminRebuild = true
          continue
        }
      }
    }

    // Check the last build on GH
    // "The build of this commit was aborted" - likely due to chart needing bumping
    // "This commit cannot be built" - could be a number of reasons - needs manual intervention
    // "This commit looks good" - we can trigger a rebuild (its likely the tag was deleted from ACR due to age)

    const ghStatus = await getGhStatus(prNumber, repo)

    switch (true) {
      case ghStatus.includes('The build of this commit was aborted'):
        const answers = await askYesOrNo({}, { name: 'bump', message: `The build of ${repo}:${branch} was aborted (likely due to the chart needing a bump). Would you like to bump the chart version?` })
        if (answers.bump === YES) {
          await bumpChartVersion(repo, service.serviceName, prNumber)
          needsAdminRebuild = true
          dependantWasUpdated = true
          continue
        }
        break
      case ghStatus.includes('This commit cannot be built'):
        // The previous build failed and the tag doesnt exist anymore - this needs manual intervention
        const url = ghStatus.match(/https:\/\/build.platform.hmcts.net[^\s]+/gi)?.[0]
        console.log(`The last build of ${repo}:${branch} failed, so it's unlikely that triggering a rebuild will work. Please check yourself at: ${url}`)

        await tryFixWithYarnInstall(repo, prNumber)

        const proceed = await prompt([{ name: 'continue', message: `The last build of ${repo}:${branch} failed, so it's unlikely that triggering a rebuild will work. Please check yourself at: ${url}. Fix this and then continue here (Y) or cancel and return to the main menu (n)`, type: 'confirm' }])
        if (!proceed.continue) {
          return
        }
        watchTags.push({ ...service, prNumber, gitRepo: repo })
        continue
      case ghStatus.includes('This commit is being built'):
        console.log(`Pipeline is still running for ${repo}:${branch} - disallowing rebuild`)
        watchTags.push({ ...service, prNumber, gitRepo: repo })
        continue
      case ghStatus.includes('This commit looks good'):
        // The tag was deleted from ACR due to age - we can trigger a rebuild
        console.log(`Commit can probably be rebuilt without hassle`)
        break
      default:
        console.warn(`Unknown status for ${repo}:${branch} - ${ghStatus}`)
        break
    }

    const answers = await askYesOrNo({}, { name: 'rebuild', message: `Would you like to trigger a rebuild on ${repo}:${branch}?` })

    if (answers.rebuild === YES) {
      await triggerRebuild(repo, prNumber)
      dependantWasUpdated = true
      needsAdminRebuild = true
    }

    watchTags.push({ ...service, prNumber, gitRepo: repo })
  }


  if (needsAdminRebuild) {
    const message = adminChangedMessage.length ? `Updated tags: ${adminChangedMessage.join(', ')}` : 'Trigger rebuild'
    if (adminChangedMessage.length) {
      await execCommand(`git -c commit.gpgsign=false add .`, path)
    }

    await execCommand(`git -c commit.gpgsign=false commit --allow-empty -m '${message}'`, path)
    await execCommand(`git push`, path)
    await wait(30000)
    await adminPrWaitForNoPendingChecks()
  }

  if (!watchTags.length && !needsAdminRebuild) {
    console.log(`No tags to wait for`)

    const answers = await askYesOrNo({}, { name: 'rebuild', message: 'Would you like to trigger a rebuild of the Admin PR?' })
    if (answers.rebuild === YES) {
      await triggerRebuild('et-ccd-definitions-admin', adminPrNumber)
      await wait(30000)
      await adminPrWaitForNoPendingChecks()
    }

    return
  }

  // Wait for tags to be available

  const results = await Promise.allSettled(watchTags.map(async o => {
    const result = await waitForTagToBecomeAvailable(o.tag, o.acrName, o.repositoryName)
    return { ...o, result }
  }))

  const statuses = results.map(o => o.status === 'fulfilled' ? o.value : undefined).filter(o => o)
  console.log(JSON.stringify(statuses, null, 2))

  if (dependantWasUpdated) {
    return await repairPreviewEnv(adminPrNumber)
  }
}

async function tryFixUpdateWithBaseBranch(repo: string, prNumber: string) {
  const path = await cloneRepoToTmp(repo)
  const { stdout } = await execCommand(`gh pr diff ${prNumber} --name-only`, path)

  const files = stdout.split(EOL).filter(o => o)

  if (!files.length) {
    return // Up to date
  }

  await execCommand(`gh pr checkout ${prNumber}`, path)

}

async function tryFixWithYarnInstall(repo: string, prNumber: string) {
  const path = await cloneRepoToTmp(repo)

  if (!existsSync(`${path}/yarn.lock`)) {
    return // Not a yarn project
  }

  await pullAndResetRepo(repo)

  await execCommand(`gh pr checkout ${prNumber}`, path)

  await execCommand(`yarn install`, path, false)
  // Did that yarn install result in a yarn.lock change?
  const gitStatus = await execCommand(`git status`, path, false)
  if (!gitStatus.stdout.includes('yarn.lock')) {
    return // No, do nothing
  }

  // Yes, commit and push
  await execCommand(`git -c commit.gpgsign=false add yarn.lock`, path)
  await execCommand(`git -c commit.gpgsign=false commit -m 'Update yarn.lock'`, path)
  await execCommand(`git push`, path)
}

function getGitRepoFromAcrRepo(repo: string) {
  return Object.keys(GIT_REPO_TO_ACR_REPO).find(o => GIT_REPO_TO_ACR_REPO[o] === repo)
}

async function postAdminBuildTasks(prNumber: string) {
  await createRoles(prNumber)
}

async function waitForPodsToBeReady() {
  const adminPrNumber = await getCurrentAdminPrNumber()
  const pods = await getPodsGroupedByPreviewEnv()

  const prPods = pods[adminPrNumber]

  // Check if any pods are not ready
  const notReadyPods = prPods?.filter(o => o.status.containerStatuses.some(o => !o.ready))

  if (notReadyPods.length) {
    const reasons = notReadyPods.map(o => `${o.serviceName}: ${o.status.containerStatuses[0].state.waiting.reason}`).join(', ')
    console.log(`Not all pods are ready.${EOL}(${reasons})${EOL}Waiting...`)
    await wait(60000)
    return await waitForPodsToBeReady()
  }
}

async function adminPrWaitForNoPendingChecks() {
  const git = await execCommand(`gh pr checks --watch --fail-fast`, process.env.ADMIN_DEF_DIR, false)

  console.log(git.stdout)
  if (git.stdout.includes('All checks have passed')) {
    return
  }

  // Several things can go wrong here
  // The build was aborted - might suggest that image tags can't be found
  // The build was not successful - potentially functional tests failed (common)

  // If the functional tests failed, its likely that it just couldn't 
}

async function bumpChartVersion(repo: string, service: string, prNumber: string | number) {
  const path = await cloneRepoToTmp(repo)
  await execCommand('git checkout master --force', path)

  const masterChartFile = `${path}/charts/${service}/Chart.yaml`
  const masterFile = readFileSync(masterChartFile, 'utf8')
  const masterChart = parse(masterFile)

  const [_, major, minor, patch] = /(\d+)\.(\d+)\.(\d+)/g.exec(masterChart.version)
  const newVersion = `${major}.${minor}.${parseInt(patch) + 1}`

  await execCommand(`gh pr checkout ${prNumber} --force`, path)

  const chartFile = `${path}/charts/${service}/Chart.yaml`
  const file = readFileSync(chartFile, 'utf8')
  const chart = parse(file)

  const oldVersionStr = `version: ${chart.version}`
  const newVersionStr = `version: ${newVersion}`

  writeFileSync(masterChartFile, file.replace(oldVersionStr, newVersionStr))
  await gitAddCommitPushAll(repo, `Bump chart (flex)`)
}

function changeTagInPreviewValuesYaml(service: AcrImage, tag: string, valuesFilePath: string) {
  const valuesFile = `${valuesFilePath}/charts/et-ccd-definitions-admin/values.preview.template.yaml`
  const oldContents = readFileSync(valuesFile, 'utf8')

  const oldTag = `${service.acrName}.azurecr.io/${service.repositoryName}:${service.tag}`
  const newTag = `${service.acrName}.azurecr.io/${service.repositoryName}:${tag}`

  // Using manual writing here as yaml's stringify deletes comments and changes the structure of the file
  const newContents = oldContents.replace(oldTag, newTag)
  writeFileSync(valuesFile, newContents)
}

function changeDmnInPreviewJenkinsCnp(repoPath: string, dmn: string) {
  const path = `${repoPath}/Jenkinsfile_CNP`
  const file = readFileSync(path, 'utf8')

  const dmnBranchRegex = /def dmnBranch = "(.+)"/g
  const bpmnBranchRegex = /def bpmnBranch = "(.+)"/g
  const newFile = file.replace(dmnBranchRegex, `def dmnBranch = "${dmn}"`).replace(bpmnBranchRegex, `def bpmnBranch = "${dmn}"`)
  return writeFileSync(path, newFile)
}

async function waitForTagToBecomeAvailable(tag: string, acrName: string, repositoryName: string, timeoutMs = 600_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isTagOnAcr(tag, acrName, repositoryName)) {
      return
    }

    const ghStatus = await getGhStatus(tag, repositoryName)
    if (ghStatus) {
      // TODO: We can exit early if a check fails, but we need to gather data on possible states first
      console.log(`Debug ghStatus: ${ghStatus}`)
    }

    console.log(`Tag ${tag} is not available on ${acrName}/${repositoryName}. Waiting...`)
    await wait(60000)
  }

  throw new Error(`Tag ${tag} was not found on ${acrName}/${repositoryName} after ${timeoutMs}ms`)
}

async function getGhStatus(prNumber: string | number, repoName: string) {
  const { stdout, stderr, err } = await execCommand(`gh pr checks ${prNumber} --repo "hmcts/${repoName}"`, null, false)

  console.log(JSON.stringify({ pr: prNumber, stdout }))
  return stdout
}

async function isTagOnAcr(tag: string, acrName: string, repositoryName: string): Promise<boolean> {
  const { stdout } = await execCommand(`az acr repository show-tags --name ${acrName} --repository ${repositoryName} --output json`, null, false)
  const tags = JSON.parse(stdout)

  return tags.includes(tag)
}

function findTagForService(values: Props) {
  const image = values.java?.image || values.nodejs?.image

  if (!image) {
    return
  }

  const regex = /(.+)\.azurecr.io\/(.+):(.+)/g.exec(image)

  return {
    acrName: regex[1],
    repositoryName: regex[2],
    tag: regex[3]
  } as AcrImage
}

function savePreviewValuesYaml(data: Values) {
  const valuesFile = `${process.env.ADMIN_DEF_DIR}/charts/et-ccd-definitions-admin/values.preview.template.yaml`
  const file = stringify(data)
  writeFileSync(valuesFile, file)
}

async function readPreviewValuesYaml(repoPath: string) {
  const valuesFile = `${repoPath}/charts/et-ccd-definitions-admin/values.preview.template.yaml`
  const file = readFileSync(valuesFile, 'utf8')
  const values: Values = parse(file)

  return values
}

async function getPreviewValues(repoPath: string) {
  const values = await readPreviewValuesYaml(repoPath)

  return Object.keys(values).map(o => { return { ...findTagForService(values[o]), serviceName: o } }).filter(o => o.acrName)
}

async function cloneRepoToTmp(repoName: string) {
  const path = getRepoTmpDir(repoName)

  if (existsSync(path)) {
    await rmdir(path, { recursive: true })
  }

  await execCommand(`git clone git@github.com:hmcts/${repoName}.git ${path}`)
  return path
}

async function gitAddCommitPushAll(repoName: string, message: string) {
  const path = getRepoTmpDir(repoName)
  await execCommand(`git -c commit.gpgsign=false add .`, path)
  await execCommand(`git -c commit.gpgsign=false commit --allow-empty -m "${message}"`, path)
  await execCommand(`git push`, path)
}

async function triggerRebuild(repoName: string, prNumber: string) {
  const path = getRepoTmpDir(repoName)
  await cloneRepoToTmp(repoName)
  await execCommand(`git reset --hard`, path)
  await execCommand(`gh pr checkout ${prNumber.replace('pr-', '')} --force`, path)
  // Make an empty commit to trigger a rebuild
  await execCommand(`git -c commit.gpgsign=false commit --allow-empty -m "Trigger rebuild"`, path)
  // Push the commit
  await execCommand(`git push`, path)
}

function getRepoTmpDir(repo: string) {
  return `./tmp/${repo}`
}

type Values = Record<string, Props>
type Props = { java?: { image: string }, nodejs: { image: string } }
type AcrImage = { serviceName?: string, acrName: string, repositoryName: string, tag: string }
interface Pod {
  serviceName: string,
  metadata: {
    name: string;
    namespace: string;
    labels: {
      [key: string]: string;
    };
    ownerReferences: {
      kind: string;
    }[];
  };
  spec: {
    containers: {
      name: string;
      image: string;
      ports: {
        containerPort: number;
      }[];
    }[];
  };
  status: {
    phase: string;
    podIP: string;
    containerStatuses: {
      name: string;
      ready: boolean;
      restartCount: number;
      image: string;
      state: {
        waiting: {
          reason: string;
        };
      }
    }[];
  };
}

export default {
  disabled: false,
  group: 'et-preview',
  text: '[WIP] Preview Environment tasks...',
  fn: journey,
  alias: 'Alias'
} as Journey
