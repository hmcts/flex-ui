import { ensureUp, destroyEverything } from "app/et/docker"
import { Journey } from "types/types"

async function tearDownAndFreshStart() {
  await destroyEverything()
  await ensureUp()
}

export default {
  group: 'et-docker',
  text: 'Fresh start docker (destroy and rebuild)',
  fn: tearDownAndFreshStart
} as Journey

