export type Journey = {
  /** Alias used for grouping related journeys together */
  group?: string
  /** The text to display as an option to the user. Use a function to generate context-dependant text*/
  text: string | object | (() => string)
  /** A function used to check if the select journey text matches this journey (optional) */
  matchText?: (text: string) => boolean
  /** The main function to call to kick off the journey */
  fn?: () => Promise<any>
}