import { Journey } from "app/types/journey"
import { gitJourney, knownRepos } from "../base/gitCommon"

async function journey() {
  knownRepos['et-ccd-callbacks'] = process.env.ET_CCD_CALLBACKS_DIR
  knownRepos['et-ccd-definitions-admin'] = process.env.ADMIN_DEF_DIR
  knownRepos['et-ccd-definitions-englandwales'] = process.env.ENGWALES_DEF_DIR
  knownRepos['et-ccd-definitions-scotland'] = process.env.SCOTLAND_DEF_DIR
  knownRepos['et-common'] = process.env.ET_COMMON_DIR
  knownRepos['et-data-model'] = process.env.DATA_MODEL_DIR
  knownRepos['et-hearings-api'] = process.env.ET_HEARINGS_API_DIR
  knownRepos['et-message-handler'] = process.env.ET_MESSAGE_HANDLER_DIR
  knownRepos['et-sya-api'] = process.env.ET_SYA_API_DIR
  knownRepos['et-sya-frontend'] = process.env.ET_SYA_FRONTEND_DIR
  knownRepos['et-wa-task-configuration'] = process.env.ET_WA_TASK_CONFIGURATION_DIR
  return await gitJourney()
}

export default {
  group: 'git',
  text: 'Git(hub) commands',
  fn: journey,
  alias: 'GitCommon'
} as Journey
