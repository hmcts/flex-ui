import { CaseEvent, CaseEventToField, CaseField, CCDTypes, ConfigSheets, EventToComplexType } from "./ccd"

export type Session = {
  name: string
  date: Date | string
  added: ConfigSheets
  lastAnswers: Answers
}

// type Intersect<T> = Partial<{
//   [P in keyof T]: any
// }>

// type tmp<T> = Intersect<CCDTypes>

// const obj: tmp<CCDTypes> = {'AuthorisationCaseEvent'}

// TODO: Refactor this to get its types from an intersection of CCDType values
export type Answers = Partial<
  Record<keyof (CaseField) |
    keyof (CaseEventToField) |
    keyof (CaseEvent) |
    keyof (EventToComplexType),
    any>
>