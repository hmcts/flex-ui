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
  const envJsonPath = `${process.env.ENGWALES_DEF_DIR}${sep}env.json`
  const envJson = JSON.parse(readFileSync(envJsonPath, 'utf-8'))
  return envJson.local.ET_COS_URL.replace(/http:\/\/(.+):8081/, '$1')
}

function updateRegion(regionDir: string, ip: string) {
  const envJsonPath = `${regionDir}${sep}env.json`
  const envJson = JSON.parse(readFileSync(envJsonPath, 'utf-8'))
  envJson.local.ET_COS_URL = `http://${ip}:8081`
  writeFileSync(envJsonPath, JSON.stringify(envJson, null, 2) + '\n')
}

export default {
  disabled: true,
  group: 'et-docker',
  text: 'Update IP address in config repos',
  fn: setIPToWslHostAddress,
  alias: 'DockerIP'
} as Journey
