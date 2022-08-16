import { Journey } from "types/journey"
import { readFileSync, writeFileSync } from "fs"
import { sep } from "path"
import { execCommand } from "app/helpers"

async function updateIP() {
  const ip = (await execCommand("hostname -I | awk '{print $1}'")).stdout.trim()
  updateRegion(process.env.ENGWALES_DEF_DIR, ip)
  updateRegion(process.env.SCOTLAND_DEF_DIR, ip)
}

function updateRegion(regionDir: string, ip: string) {
  const packageJsonPath = `${regionDir}${sep}package.json`
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  packageJson.config.local.et_cos = `http://${ip}:8081`
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
}

export default {
  group: 'et-docker',
  text: 'Update IP address in package.json of config repos',
  fn: updateIP
} as Journey