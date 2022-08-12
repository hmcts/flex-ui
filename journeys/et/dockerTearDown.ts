import { destroyEverything } from "app/et/docker"
import { Journey } from "types/types"

export default {
  group: 'et-docker',
  text: 'Destroy docker containers/images/volumes',
  fn: destroyEverything
} as Journey

