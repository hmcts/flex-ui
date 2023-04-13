import { getIdealSizeForInquirer } from 'app/helpers'
import { Answers, Question } from 'app/questions'
import { prompt } from 'inquirer'
import { ETFlexExtensions, Region } from 'app/et/configs'
import { session } from 'app/session'

const QUESTION_REGION = 'Which region(s) should this entry be added to?'

export const FLEX_REGION_ANSWERS_KEY = 'flexRegion'

export const REGION_OPTS = [
  Region.EnglandWales,
  Region.Scotland
]

export async function askFlexRegion(answers?: Answers, question: Question = {}) {
  return await prompt(addFlexRegion(question), answers || {})
}

export function getFlexRegionFromAnswers(answers: Answers) {
  return answers[FLEX_REGION_ANSWERS_KEY] as Region[]
}

/** Adds flexRegion to the ccd object and clones to the other region if required. Returns an array of 1 or 2 objects */
export function addFlexRegionAndClone<T extends ETFlexExtensions>(flexRegions: Region[], ccdType: T) {
  ccdType.flexRegion = flexRegions[0] || Region.EnglandWales

  if (flexRegions.length < 2) {
    return [ccdType]
  }

  const clone = JSON.parse(JSON.stringify(ccdType))
  ccdType.flexRegion = flexRegions[1]

  return [ccdType, clone]
}

export function addFlexRegion(question: Question = {}) {
  question.name ||= FLEX_REGION_ANSWERS_KEY
  question.message ||= QUESTION_REGION
  question.choices ||= REGION_OPTS
  question.default ||= (answers: Answers) => answers?.[FLEX_REGION_ANSWERS_KEY] || session.lastAnswers?.[FLEX_REGION_ANSWERS_KEY] || REGION_OPTS

  return [{ type: 'checkbox', askAnswered: true, pageSize: getIdealSizeForInquirer(), ...question }]
}
