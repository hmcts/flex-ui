import { prompt } from 'inquirer'
import { session, saveSession } from 'app/session'
import { Journey } from 'types/journey'
import { getKnownETCaseFieldIDsByEvent, getRegionFromCaseTypeId, Region, RoleMappings, defaultRoleMappings, Roles, createCaseFieldAuthorisations, addToInMemoryConfig, getEnglandWales, getScotland, createCaseEventAuthorisations, getETCaseEventIDOpts } from 'app/et/configs'
import { Answers, askAutoComplete, sayWarning, askCaseEvent, askCaseTypeID, addonDuplicateQuestion } from 'app/questions'
import { format, getIdealSizeForInquirer } from 'app/helpers'
import { CaseEventToFieldKeys, CaseFieldKeys } from 'app/types/ccd'
import { MULTI, NONE } from 'app/constants'
import { getKnownCaseFieldIDs } from 'app/configs'
import { changeDefaultAuthorisations } from './experimentalAuthorisations'


export default {
  group: 'et-wip',
  text: '[WIP] Change default authorisations',
  fn: async () => await sayWarning(changeDefaultAuthorisations),
  alias: 'ChangeDefaultAuthorisation'
} as Journey
