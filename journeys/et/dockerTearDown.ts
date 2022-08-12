import { tearDown } from "app/et/docker"
import { Journey } from "types/types"

export default {
  group: 'et-docker',
  text: 'Destroy docker containers/images/volumes',
  fn: tearDown
} as Journey

