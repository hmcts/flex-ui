// import { getKnownCaseFieldIDs } from 'app/et/configs'
// import { askCaseTypeID } from 'app/questions'
// import { prompt } from 'inquirer'
// import { Journey } from 'types/journey'
// import { addToInMemoryConfig } from ''

// async function journey() {
//   let answers = await askCaseTypeID({})
//   answers = await prompt([
//     { name: 'role', message: 'Whats the name of the role?' },
//     { name: 'crud', message: 'What permissions should we apply?', default: 'CRU' }
//   ], answers)
//   const role = answers.role

//   const caseFields = getKnownCaseFieldIDs()

//   for (const field of caseFields) {
//     const authScaff = { CaseTypeId: answers.CaseTypeID, CaseFieldID: field, UserRole: role, CRUD: 'CRU' }
//     addToInMemoryConfig()
//   }
// }

// export default {
//   group: 'et-auth',
//   text: 'Give a role case field authorisations',
//   fn: journey
// } as Journey
