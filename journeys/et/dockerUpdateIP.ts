import { Journey } from 'types/journey'
import { readFileSync, writeFileSync } from 'fs'
import { sep } from 'path'
import { execCommand } from 'app/helpers'

export async function setIPToHostDockerInternal() {
  updateRegion(process.env.ENGWALES_DEF_DIR, 'host.docker.internal')
  updateRegion(process.env.SCOTLAND_DEF_DIR, 'host.docker.internal')
}

export async function getHostnameIP() {
  return (await execCommand("hostname -I | awk '{print $1}'")).stdout.trim()
}

export async function setIPToWslHostAddress() {
  const ip = await getHostnameIP()
  if (!ip) return
  updateRegion(process.env.ENGWALES_DEF_DIR, ip)
  updateRegion(process.env.SCOTLAND_DEF_DIR, ip)
}

export function getWslHostIP() {
  const packageJsonPath = `${process.env.ENGWALES_DEF_DIR}${sep}package.json`
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  return packageJson.config.local.et_cos.replace(/http:\/\/(.+):8081/, '$1')
}

function updateRegion(regionDir: string, ip: string) {
  const packageJsonPath = `${regionDir}${sep}package.json`
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
  packageJson.config.local.et_cos = `http://${ip}:8081`
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
}

export default {
  disabled: true,
  group: 'et-docker',
  text: 'Update IP address in package.json of config repos',
  fn: setIPToWslHostAddress
} as Journey
