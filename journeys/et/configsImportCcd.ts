import { Journey } from "types/types";
import { execImportConfig } from "app/et/configs";

export default {
  group: 'et-configs',
  text: 'Import configs into CCD',
  fn: execImportConfig
} as Journey