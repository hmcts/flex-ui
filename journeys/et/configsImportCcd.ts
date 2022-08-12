import { execCommand } from "app/helpers"
import { sep } from "path"
import { Journey } from "types/types"

const IMPORT_SCRIPT = `${process.env.ECM_DOCKER_DIR}/bin/ccd-import-definition.sh`

function getDefinitionPath(region: "EnglandWales" | "Scotland", env: string = "local") {
  if (region === "EnglandWales") {
    return `${process.env.ENGWALES_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-englandwales-ccd-config-${env}.xlsx`
  }
  return `${process.env.SCOTLAND_DEF_DIR}${sep}definitions${sep}xlsx${sep}et-scotland-ccd-config-${env}.xlsx`
}

export async function ccdImport(region: "EnglandWales" | "Scotland", env: string = "local") {
  const definitionFile = getDefinitionPath(region, env)
  const res = await execCommand(`${IMPORT_SCRIPT} ${definitionFile}`) as any
  if (!res.stdout?.includes("Case Definition data successfully imported")) {
    console.error(res.stdout)
  }
}

async function importConfigs() {
  await ccdImport("EnglandWales")
  await ccdImport("Scotland")
}

export default {
  group: 'et-configs',
  text: 'Import configs into CCD',
  fn: importConfigs
} as Journey