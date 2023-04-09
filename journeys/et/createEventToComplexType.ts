import { addToInMemoryConfig, Region } from 'app/et/configs'
import { Journey } from 'types/journey'
import { addFlexRegionAndClone, askFlexRegion, FLEX_REGION_ANSWERS_KEY } from 'app/et/questions'
import { createEventToComplexType } from '../base/createEventToComplexType'

async function journey() {
  const answers = await askFlexRegion({})
  const created = await createEventToComplexType()
  created.EventToComplexTypes = addFlexRegionAndClone(answers[FLEX_REGION_ANSWERS_KEY] as Region[], created.EventToComplexTypes[0])
  addToInMemoryConfig(created)
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify an EventToComplexType',
  fn: journey,
  alias: 'UpsertEventToComplexType'
} as Journey
