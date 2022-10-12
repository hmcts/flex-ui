import { ensureUp } from 'app/et/docker'
import { Journey } from 'types/journey'

export default {
  group: 'et-docker',
  text: 'Load new images & spin up docker containers for ET CCD',
  fn: ensureUp
} as Journey
