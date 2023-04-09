import { addToInMemoryConfig, CCDTypeWithRegion, Region } from 'app/et/configs'
import { addAutoCompleteQuestion, addComplexTypeListElementCodeQuestion, Answers } from 'app/questions'
import { Journey } from 'types/journey'
import { addFlexRegionAndClone, askFlexRegion, FLEX_REGION_ANSWERS_KEY, REGION_OPTS } from 'app/et/questions'
import { createComplexType, QUESTION_ID } from '../base/createComplexType'
import { prompt } from 'inquirer'
import { ComplexType, ComplexTypeKeys } from 'app/types/ccd'
import { CUSTOM } from 'app/constants'
import { findObject, getKnownComplexTypeIDs } from 'app/configs'
import { session } from 'app/session'
import { matcher } from 'app/helpers'

const QUESTION_EXISTING_REGION_DIFFERENT = 'The ComplexType object in both regions are different, which one should we bring back for defaults?'

async function journey(answers: Answers = {}) {
  answers = await askFlexRegion(answers)

  answers = await prompt([
    ...addAutoCompleteQuestion({ name: ComplexTypeKeys.ID, message: QUESTION_ID, choices: [CUSTOM, ...getKnownComplexTypeIDs()], default: session.lastAnswers[ComplexTypeKeys.ID] }),
    ...addComplexTypeListElementCodeQuestion()
  ], answers)

  const existing: CCDTypeWithRegion = await findExistingComplexType(answers)

  const created = await createComplexType({ ...answers, flexRegion: existing?.flexRegion || answers[FLEX_REGION_ANSWERS_KEY][0] })
  created.ComplexTypes = addFlexRegionAndClone(answers[FLEX_REGION_ANSWERS_KEY] as Region[], created.ComplexTypes[0])

  addToInMemoryConfig(created)
}

async function findExistingComplexType(answers: Answers) {
  let ewExisting: ComplexType | null = null
  let scExisting: ComplexType | null = null

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.EnglandWales)) {
    ewExisting = findObject({ ...answers, flexRegion: Region.EnglandWales }, 'ComplexTypes')
  }

  if ((answers[FLEX_REGION_ANSWERS_KEY] as string[]).includes(Region.Scotland)) {
    scExisting = findObject({ ...answers, flexRegion: Region.Scotland }, 'ComplexTypes')
  }

  if (!ewExisting || !scExisting) {
    return ewExisting || scExisting
  }

  // We have both objects - we need to check that they are the same, else it'll be hard to know which to bring back
  if (matcher(ewExisting, scExisting, Object.keys(ComplexTypeKeys) as Array<keyof (ComplexType)>)) {
    return ewExisting
  }

  // The complex types in ew and sc are different - we need to know what defaults to load back
  const obj = await prompt([
    { name: 'region', message: QUESTION_EXISTING_REGION_DIFFERENT, type: 'list', choices: REGION_OPTS }
  ])

  return obj.region === Region.EnglandWales ? ewExisting : scExisting
}

export default {
  disabled: true,
  group: 'create',
  text: 'Create/Modify a ComplexType',
  fn: journey,
  alias: 'UpsertComplexTyoe'
} as Journey
