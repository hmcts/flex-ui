import { Journey } from "types/types";
import { execGenerateSpreadsheet } from "app/et/configs";

export default {
  group: 'et-configs',
  text: 'Save to JSONs and Generate spreadsheets',
  fn: execGenerateSpreadsheet
} as Journey