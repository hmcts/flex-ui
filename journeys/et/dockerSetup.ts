import { ensureUp } from 'app/et/docker'
import { Journey } from 'types/journey'

export default {
  disabled: true,
  group: 'et-docker',
  text: 'Spin up docker containers for ET CCD',
  fn: ensureUp
} as Journey
