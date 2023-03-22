import { Journey } from "app/types/journey"
import { gitJourney, knownRepos } from "../base/gitCommon"

async function journey() {
  knownRepos['et-ccd-definitions-englandwales'] = process.env.ENGWALES_DEF_DIR
  knownRepos['et-ccd-definitions-scotland'] = process.env.SCOTLAND_DEF_DIR
  knownRepos['et-ccd-callbacks'] = process.env.ET_CCD_CALLBACKS_DIR
  knownRepos['et-data-model'] = process.env.DATA_MODEL_DIR
  return await gitJourney()
}

export default {
  group: 'git',
  text: 'Git(hub) commands',
  fn: journey,
  alias: 'GitCommon'
} as Journey
