import { Journey } from "types/types";
import { saveBackToProject } from "app/et/configs";

export default {
  group: 'et-configs',
  text: 'Save to JSONs and Generate spreadsheets',
  fn: saveBackToProject
} as Journey