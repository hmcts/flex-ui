import { Region, readInCurrentConfig, saveBackToProject } from 'app/et/configs'
import { addNonProdFeatureQuestions, askAutoComplete, askCaseTypeID } from 'app/questions'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { pullAndResetRepo } from './previewEnvironment'
import { getBranchOpts } from '../base/gitCommon'
import { AuthorisationCaseEventKeys, AuthorisationCaseFieldKeys, AuthorisationCaseStateKeys, AuthorisationCaseTypeKeys, AuthorisationComplexTypeKeys, CCDTypes, CaseEventKeys, CaseEventToFieldKeys, CaseFieldKeys, CaseTypeTabKeys, ComplexTypeKeys, CompoundKeys, ConfigSheets, EventToComplexTypeKeys, FlexExtensionKeys, FlexExtensions, RoleToAccessProfileKeys, ScrubbedKeys, createNewConfigSheets } from 'app/types/ccd'
import { execCommand, groupBy, matcher } from 'app/helpers'
import { COMPOUND_KEYS } from 'app/constants'
import { writeFileSync } from 'fs'
import { sep } from 'path'

/*
  The idea of this journey is to compare two branches to find differences. Github's diff shower is not very good for this.
  The inspiration for this came from feature flagging WA. The PR contains a lot of changed objects but git's diff shows partially modifying two objects for a singular change.

  Simplest way to achieve this is to clone one branch, load the configs in memory, clone the other branch, load the configs in memory, and then compare the two.
  This will only tackle one region at a time to remove further complications
*/

async function journey() {
  // Ask user which repo theyre interested in (et-ccd-definitions-englandwales or et-ccd-definitions-scotland)
  const ewPath = await pullAndResetRepo('et-ccd-definitions-englandwales')
  const scPath = await pullAndResetRepo('et-ccd-definitions-scotland')

  const ewBranchOpts = await getBranchOpts(ewPath)
  const scBranchOpts = await getBranchOpts(scPath)

  let answers = await askAutoComplete({}, { name: 'base', message: 'Select base branch', default: 'master', choices: ewBranchOpts, askAnswered: true, sort: true })
  answers = await askAutoComplete(answers, { name: 'compare', message: 'Select branch for compare', default: 'master', choices: ewBranchOpts, askAnswered: true, sort: true })

  // if (!scBranchOpts.includes(answers.compare) || !scBranchOpts.includes(answers.base)) {
  //   throw new Error(`Branch ${answers.compare} or ${answers.base} does not exist in Scotland repo`)
  // }

  const baseConfig: ConfigSheets = createNewConfigSheets()
  const compareConfig: ConfigSheets = createNewConfigSheets()

  // Load base branches
  //await execCommand(`git checkout ${answers.base}`, ewPath, true)
  await execCommand(`git checkout ${answers.base}`, scPath, true)
  await readInCurrentConfig(baseConfig, scPath, undefined)

  // Load compare branches
  // await execCommand(`git checkout ${answers.compare}`, ewPath, true)
  await execCommand(`git checkout ${answers.compare}`, scPath, true)
  await readInCurrentConfig(compareConfig, scPath, undefined)

  // Dumb approach here is to just straight up compare JSON objects
  // It would be nice to list new fields added as well as changed existing fields

  // Can't iterate through each sheet as we need to know its type to know how to compare
  const added = createNewConfigSheets()
  const changed = createNewConfigSheets()
  const removed = createNewConfigSheets()

  const addTo = <T extends keyof (CompoundKeys<CCDTypes>)>(baseConfig: ConfigSheets, compareConfig: ConfigSheets, type: T, keys: string[]) => {
    const res = compareType(baseConfig, compareConfig, type, keys)
    added[type] = res.added
    changed[type] = res.changed
    removed[type] = res.removed
  }

  addTo(baseConfig, compareConfig, 'AuthorisationCaseEvent', Object.keys(AuthorisationCaseEventKeys))
  addTo(baseConfig, compareConfig, 'AuthorisationCaseField', Object.keys(AuthorisationCaseFieldKeys))
  addTo(baseConfig, compareConfig, 'AuthorisationComplexType', Object.keys(AuthorisationComplexTypeKeys))
  addTo(baseConfig, compareConfig, 'CaseEvent', Object.keys(CaseEventKeys))
  addTo(baseConfig, compareConfig, 'CaseEventToFields', Object.keys(CaseEventToFieldKeys))
  addTo(baseConfig, compareConfig, 'CaseField', Object.keys(CaseFieldKeys))
  addTo(baseConfig, compareConfig, 'CaseTypeTab', Object.keys(CaseTypeTabKeys))
  addTo(baseConfig, compareConfig, 'ComplexTypes', Object.keys(ComplexTypeKeys))
  addTo(baseConfig, compareConfig, 'EventToComplexTypes', Object.keys(EventToComplexTypeKeys))
  addTo(baseConfig, compareConfig, 'Scrubbed', Object.keys(ScrubbedKeys))
  addTo(baseConfig, compareConfig, 'RoleToAccessProfiles', Object.keys(RoleToAccessProfileKeys))

  addTo(baseConfig, compareConfig, 'AuthorisationCaseState', Object.keys(AuthorisationCaseStateKeys))
  addTo(baseConfig, compareConfig, 'AuthorisationCaseType', Object.keys(AuthorisationCaseTypeKeys))

  const file = `Comparing ${answers.compare} from ${answers.base}.json`
  writeFileSync(file, JSON.stringify({ added, changed, removed }, null, 2))
  console.log(`Written report to ${file}`)

  answers = await prompt(addNonProdFeatureQuestions('CaseTypeTab'), answers)

  for (const sheet in added) {
    for (const obj of added[sheet]) {
      // Copy the new object in
      baseConfig[sheet].push({ ...obj, feature: answers.feature, ext: answers.ext })
    }
  }

  for (const sheet in changed) {
    for (const obj of changed[sheet]) {
      // Copy the new object in
      baseConfig[sheet].push({ ...obj, feature: answers.feature, ext: answers.ext })

      // Find the original object
      const original = baseConfig[sheet].find(o => matcher(o, obj, COMPOUND_KEYS[sheet]))
      if (!original) {
        console.error(`Failed to find thing that should have exisited TODO HELP`)
        continue
      }

      // Move them to the prod file so that prod env stays the same but lower envs get the changes
      original.feature ||= ''
      original.ext = 'prod'
    }
  }

  for (const sheet in removed) {
    for (const obj of removed[sheet]) {
      //Copy the object into the prod version of this feature so that prod stays the same
      // baseConfig[sheet].push({ ...obj, ext: 'prod' })
      // We can modify obj directly here because its source is from baseConfig
      obj.feature ||= ''
      obj.ext = 'prod'

      // // Mark this object for deletion (move to a delete feature file)
      // obj.feature = 'delete'
      // obj.ext = 'nonprod'
    }
  }

  await saveBackToProject(baseConfig)

  // At this step we have "added", "removed" and "changed"
  // All objects in added, removed and changed should be deleted from the main json
  // Objects inside "added" and "changed" can be moved to feature-nonprod.json
  // "changed" objects will also need their original copy in a feature-prod.json file
  // "removed" objects should be manually reviewed to make sure that we REALLY want to remove them
  // Authorisations are fine to be removed as a CRUD change will trigger them to be classed as removed
  // Care should be taken with other objects deleting data in CCD is non-trivial

  // Please also note that non/prod support is still experimental and Flex has trouble comparing objects they exist in both nonprod and prod variants

  debugger
}

function compareType<T extends keyof (CompoundKeys<CCDTypes>)>(baseConfig: ConfigSheets, compareConfig: ConfigSheets, type: T, keys: any) {
  const added = []
  const changed = []
  const removed = []

  for (const compareObj of compareConfig[type]) {
    const originalObj = baseConfig[type].find(o => matcher(o, compareObj, COMPOUND_KEYS[type]))

    if (!originalObj) {
      added.push(compareObj)
      continue
    }

    // Compare each field
    const changedFields = getChangedFields<T>(keys, originalObj, compareObj)
    if (changedFields.length) {
      changed.push({ ...compareObj, changedFields })
    }
  }

  // Find removed
  for (const baseObj of baseConfig[type]) {
    const compareObj = compareConfig[type].find(o => matcher(o, baseObj, COMPOUND_KEYS[type]))

    if (!compareObj) {
      removed.push(baseObj)
    }
  }

  return { added, changed, removed }
}

function getChangedFields<T extends keyof (CompoundKeys<CCDTypes>)>(keys: any, originalObj: CCDTypes[T], compareObj: CCDTypes[T]) {
  const fields = []
  for (const key of keys) {
    if (!extTargettingSame(originalObj, compareObj)) continue // Skip comparing nonprod objs to prod objs (we expect these to be different)
    if (key[0].toLowerCase() === key[0]) continue // Skip flex keys
    if (originalObj[key] !== compareObj[key]) {
      fields.push(`${key}: ${originalObj[key]} -> ${compareObj[key]}`)
    }
  }
  return fields
}

function extTargettingSame<T extends FlexExtensions>(obj1: T, obj2: T) {
  return obj1.ext === '' || obj2.ext === '' || obj1.ext === obj2.ext
}

export default {
  disabled: false,
  group: 'et-wip',
  text: '[WIP] Compare ET Config Branches',
  fn: journey,
  alias: 'CompareConfig'
} as Journey
