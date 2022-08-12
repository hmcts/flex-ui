import { ensureUp } from "app/et/docker"
import { Journey } from "types/types"

export default {
  group: 'et-docker',
  text: 'Spin up docker containers for ET CCD',
  fn: ensureUp
} as Journey

