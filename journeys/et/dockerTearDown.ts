import { destroyEverything } from 'app/et/docker'
import { Journey } from 'types/journey'

export default {
  disabled: true,
  group: 'et-docker',
  text: 'Destroy docker containers/images/volumes',
  fn: destroyEverything
} as Journey
