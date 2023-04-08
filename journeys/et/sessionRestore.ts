import { Journey } from 'types/journey'
import { loadCurrentSessionIntoMemory, Region } from 'app/et/configs'
import { restoreSession } from '../base/sessionRestore'
import { session } from 'app/session'
import { addFlexRegionAndClone } from 'app/et/questions'

async function restoreETSession() {
  await restoreSession()
  migrateAddFlexRegionString()
  loadCurrentSessionIntoMemory()
}

function migrateAddFlexRegionString() {
  // We could have sessions that contain objects with NO region data or a region array
  // For NO regions - assume both regions (ie, duplicate)
  // For a region array - we can flatten and dupe (if required)

  const reducer = (acc, obj) => {
    if (obj.flexRegion) return acc.concat(obj) // ie, do nothing

    const created = addFlexRegionAndClone(obj.flex?.regions || [Region.EnglandWales, Region.Scotland], obj)
    created.forEach(o => {
      if (!o.flex?.regions) return
      o.flex.regions = undefined
    })
    return acc.concat(...created)
  }

  session.added.ComplexTypes = session.added.ComplexTypes.reduce(reducer, [])
  session.added.EventToComplexTypes = session.added.EventToComplexTypes.reduce(reducer, [])
  session.added.Scrubbed = session.added.Scrubbed.reduce(reducer, [])
}

export default {
  group: 'session',
  text: 'Restore a previous session',
  fn: restoreETSession,
  alias: 'SessionRestore'
} as Journey
