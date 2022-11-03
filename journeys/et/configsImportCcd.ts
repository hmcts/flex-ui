import { Region } from 'app/et/configs'
import { execCommand } from 'app/helpers'
import { sep } from 'path'
import { Journey } from 'types/journey'

const IMPORT_SCRIPT = `${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh`

function getDefinitionPath(region: Region, env = 'local') {
  if (region === Region.EnglandWales) {
    return `${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-${env}.xlsx`
  }
  return `${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-${env}.xlsx`
}

export async function ccdImport(region: Region, env = 'local') {
  const definitionFile = getDefinitionPath(region, env)
  const res = await execCommand(`${IMPORT_SCRIPT} ${definitionFile}`)
  if (!res.stdout?.includes('Case Definition data successfully imported')) {
    console.error(res.stdout)
  }
}

export async function importConfigs() {
  await ccdImport(Region.EnglandWales)
  await ccdImport(Region.Scotland)
}

export default {
  group: 'et-configs',
  text: 'Import configs into CCD',
  fn: importConfigs
} as Journey
