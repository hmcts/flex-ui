import { prompt } from 'inquirer'
import { Journey } from 'types/journey'
import { sheets, CCDTypes, CCDSheets } from 'app/types/ccd'
import { groupBy, groupByKeys, matcher } from 'app/helpers'
import { addToInMemoryConfig, getEnglandWales, getScotland, Region } from 'app/et/configs'
import { COMPOUND_KEYS, NO, YES_OR_NO } from 'app/constants'
import { addFlexRegionToCcdObject, FLEX_REGION_ANSWERS_KEY, REGION_OPTS } from 'app/et/questions'
import { sayWarning } from 'app/questions'

export async function fn() {
  let results = []
  for (const region of REGION_OPTS) {
    const configs = region === Region.EnglandWales ? getEnglandWales() : getScotland()
    for (const sheet of sheets) {
      results = results.concat(await deduplicateTypeForRegion(sheet, configs, region))
    }
  }
  console.log(results.sort((a, b) => a < b ? -1 : 1).join('\r\n'))
}

export async function deduplicateTypeForRegion(type: keyof CCDTypes, sheets: CCDSheets<CCDTypes>, region: string) {
  const obj = groupByKeys(sheets[type] as any, COMPOUND_KEYS[type])
  const problematic = Object.keys(obj).filter(o => obj[o].length > 1).map(o => obj[o])
  const results = []
  // Delete ALL from the configs and then re-add
  for (const dupeList of problematic) {
    const originalLength = dupeList.length
    const composite = `${region}-${type}-${COMPOUND_KEYS[type].map(o => dupeList[0][o]).join('-')}`

    dedupeArray(dupeList)

    // TODO: Scuffed code for adding on flex regions because addToInMemoryConfig requires it
    dupeList.forEach(o => {
      if (!o.flex?.regions) {
        addFlexRegionToCcdObject(o, { [FLEX_REGION_ANSWERS_KEY]: [Region.EnglandWales] })
      }
    })

    if (dupeList.length === 1) {
      // We can resolve this automatically, no need for user intervention
      sheets[type] = (sheets[type] as any[]).filter(o => !matcher(dupeList[0], o, COMPOUND_KEYS[type]))

      addToInMemoryConfig({ [type]: dupeList })
      results.push(`De-duplicated identical object for '${composite}' (there were ${originalLength} copies)`)
      continue
    }

    // Else we need to ask the user which object to pick
    const ans = await prompt([{ name: 'resolve', message: `${composite} has multiple records with conflicting fields. Would you like to step through and resolve them?`, type: 'list', choices: YES_OR_NO }])

    if (ans.resolve === NO) {
      results.push(`User refused de-duplication for conflicting object '${composite}' (there are ${originalLength} copies)`)
      continue
    }

    const userResolved = await askUserWhatValueToUse(dupeList, composite)
    if (!userResolved) {
      results.push(`User refused de-duplication for conflicting object '${composite}' (there are ${originalLength} copies)`)
      continue
    }

    sheets[type] = (sheets[type] as any[]).filter(o => !matcher(dupeList[0], o, COMPOUND_KEYS[type]))
    addToInMemoryConfig({ [type]: [userResolved] })
    results.push(`User provided instructions for de-duplicating '${composite}' (there were ${originalLength} copies)`)
  }

  return results
}

async function askUserWhatValueToUse<T>(dupeList: T[], compositeKey: string) {
  let resolved = dupeList[0]

  for (const key in dupeList[0]) {
    if (key === 'flex') continue
    const vals = Object.keys(groupBy(dupeList, key))
    if (vals.length === 1) continue

    resolved = await prompt([{ name: key, message: `Select a value for ${compositeKey}'s ${key}`, type: 'list', choices: ['<abort>', ...vals], default: vals[vals.length - 1], askAnswered: true }], resolved)

    if ((resolved as unknown as Record<string, string>)[key] === '<abort>') {
      return
    }
  }

  return resolved
}

function dedupeArray(arr: any[]) {
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i]
    for (let x = 0; x < arr.length; x++) {
      const item2 = arr[x]
      if (i === x) continue
      if (matcher(item, item2, Object.keys(item) as any)) {
        // If all keys match on both then we can delete item2
        arr.splice(x, 1)
        x--
      }
    }
  }
}

export default {
  group: 'et-wip',
  text: '[WIP] De-duplicate fields',
  fn: async () => await sayWarning(fn),
  alias: 'Deduplicate'
} as Journey
