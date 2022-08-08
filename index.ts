import 'source-map-support/register'
import { config as envConfig } from 'dotenv'
import { prompt, Separator } from 'inquirer'
import { AuthorisationCaseEvent, AuthorisationCaseField, CaseEvent, CaseEventToField, CaseField, SaveMode, Scrubbed, Session } from './types/types'
import { createAuthorisationCaseEvent, createAuthorisationCaseFields, createNewCaseEvent, createNewCaseEventToField, createNewCaseFieldType, createNewEventToComplexType, createNewSession, duplicateFieldsForScotland, trimCaseEventToField, trimCaseField } from './objects'
import { addNewScrubbed, addToInMemoryConfig, execGenerateSpreadsheet, getScrubbedOpts, upsertNewCaseEvent, readInCurrentConfig, saveBackToProject, getCaseEventIDOpts, getEnglandWales, getScotland, execImportConfig } from './configs'
import { ensurePathExists, upsertFields } from './helpers'
import { findPreviousSessions, getFieldCount, getFieldsPerPage, getPageCount, restorePreviousSession, saveSession, session, SESSION_DIR } from './session'
import { ensureUp, tearDown } from './setup'
envConfig()

function checkEnvVars() {
  const needed = [process.env.ENGWALES_DEF_DIR, process.env.SCOTLAND_DEF_DIR]
  const missing = needed.filter(o => !o)
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

let saveMode: SaveMode = SaveMode.BOTH
const NEW = "New..."

async function start() {
  ensurePathExists(SESSION_DIR)
  checkEnvVars()
  readInCurrentConfig()

  while (true) {
    const journeySplitSessionOpt = `Split current session (${getFieldCount()} fields across ${getPageCount().length} pages)`
    const optSaveMode = `Change save mode (currently: ${SaveMode[saveMode]})`

    const choices: { text: string | object, fn?: () => Promise<any> }[] = [
      { text: optSaveMode, fn: journeySaveMode },
      { text: 'Set session name', fn: journeySessionName },
      { text: 'Restore a previous session', fn: journeyRestoreSession },
      { text: journeySplitSessionOpt, fn: journeySplitSession },
      { text: new Separator() },
      { text: 'Create a single field', fn: journeyCreateNewField },
      { text: 'Create a Callback populated Label', fn: journeyCreateCallbackPopulatedTextField },
      { text: 'Create new page/event', fn: journeyCreateCaseEvent },
      { text: 'Create an EventToComplexType', fn: journeyCreateEventToComplexType },
      { text: new Separator() },
      // Don't use this one - it was a hack job I needed for a very specific thing
      { text: "Temp journey validate authorisation case fields", fn: journeyValidateAuthorisationCaseFields },
      { text: new Separator() },
      { text: 'Fresh start docker (destroy and rebuild)', fn: async () => { await tearDown(); await ensureUp() } },
      { text: 'Boot and setup ECM/CCD docker', fn: async () => ensureUp() },
      { text: 'Tear down everything docker', fn: async () => tearDown() },
      { text: new Separator() },
      { text: 'Save to JSONs and Generate spreadsheets', fn: async () => saveBackToProject(saveMode) },
      { text: 'Generate spreadsheets', fn: execGenerateSpreadsheet },
      { text: 'Import configs into CCD', fn: execImportConfig },
      { text: 'Exit', fn: async () => { console.log(`Bye!`); process.exit(0) } },
      { text: new Separator() }
    ]

    const answers = await prompt([
      {
        name: 'Journey',
        message: "What do you want to do?",
        type: 'list',
        choices: choices.map(o => o.text)
      }
    ])

    const selectedFn = choices.find(o => o.text === answers.Journey)

    if (!selectedFn) {
      throw new Error(`Uh-oh, unable to find your selected option. Probably a dev error`)
    }

    if (selectedFn.fn) {
      await selectedFn.fn()
    }

    saveSession(session)
  }
}

async function journeySaveMode() {
  const answers = await prompt([
    { name: 'SaveMode', message: "Which ones would you like to generate/save for?", type: 'list', choices: ['Both', 'EnglandWales', 'Scotland'] }
  ])

  saveMode = answers.SaveMode === "Both" ? SaveMode.BOTH
    : answers.SaveMode === "EnglandWales" ? SaveMode.ENGLANDWALES
      : SaveMode.SCOTLAND
}

async function journeySessionName() {
  const answers = await prompt([
    { name: 'name', message: "What should we called this session?" }
  ])

  session.name = answers.name
}

async function journeyRestoreSession() {
  const prevSessions = await findPreviousSessions()

  if (!prevSessions.length) {
    console.warn(`There are no previous sessions found`)
    return
  }

  const answers = await prompt([
    { name: 'name', message: "Select a previous session", type: 'list', choices: ['Cancel', ...prevSessions] }
  ])

  if (answers.name === 'Cancel') {
    return
  }

  restorePreviousSession(answers.name)
}

async function journeyCreateNewScrubbed() {
  const answers = await prompt([
    { name: 'Name', message: "What's the name of the new Scrubbed list?" }
  ])

  let createdItems: Scrubbed[] = []

  let x = 0
  while (true) {
    x++
    const followup = await prompt([
      { name: 'ListElement', message: `What should be displayed to the user when selecting this option?` },
    ])

    const more = await prompt([
      { name: 'ListElementCode', message: `Give a ListElementCode for this item`, default: followup.ListElement },
      { name: 'DisplayOrder', message: `Whats the DisplayOrder for this item?`, default: x },
      { name: 'More', message: `Add another?`, type: 'list', choices: ['Yes', 'No'] }
    ])

    if (!more.ListElementCode) {
      more.ListElementCode = followup.ListElement
    }

    if (!more.DisplayOrder) {
      more.DisplayOrder = x
    }

    createdItems.push({
      ID: answers.Name,
      ListElement: followup.ListElement,
      ListElementCode: more.ListElementCode,
      DisplayOrder: more.DisplayOrder
    })

    if (more.More === "No") {
      break
    }
  }

  addNewScrubbed(createdItems)

  return answers.Name
}

async function journeyCreateNewField() {
  const optsFieldType = [
    'FixedList',
    'FixedRadioList',
    'MultiSelectList',
    'Label',
    'TextArea',
    'YesOrNo',
    'Text',
    'Number',
    'Collection',
    'Other'
  ]

  const caseField = createNewCaseFieldType()
  const caseEventToField = createNewCaseEventToField()

  let answers = await prompt(
    [
      { name: 'CaseEventID', message: `Whats the CaseEvent that this field belongs to?`, default: session.lastAnswers.CaseEventID },
      { name: 'ID', message: `What's the ID for this field?`, type: 'input' },
      { name: 'Label', message: 'What text should this field have (Label)?', type: 'input' },
      { name: 'FieldType', message: 'What FieldType should this be?', type: 'list', choices: optsFieldType },
      { name: 'PageID', message: `What page will this field appear on?`, type: 'number', default: session.lastAnswers.PageID || 1 },
      { name: 'PageFieldDisplayOrder', message: `Whats the PageFieldDisplayOrder for this field?`, type: 'number', default: session.lastAnswers.PageFieldDisplayOrder + 1 || 1 },
      { name: 'FieldShowCondition', message: 'Enter a field show condition string (leave blank if not needed)', type: 'input' }
    ]
  )

  session.lastAnswers.CaseEventID = answers.CaseEventID
  session.lastAnswers.PageID = answers.PageID
  session.lastAnswers.PageFieldDisplayOrder = answers.PageFieldDisplayOrder

  if (answers.FieldType === "Label") {
    answers.DisplayContext = "READONLY"
  } else {
    answers = {
      ...answers, ...await prompt([
        { name: 'DisplayContext', message: 'Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX?', type: 'list', choices: ['READONLY', 'OPTIONAL', 'MANDATORY', 'COMPLEX'], default: 'OPTIONAL' },
        { name: 'ShowSummaryChangeOption', message: 'Should this field appear on the CYA page?', type: 'list', choices: ['Yes', 'No'], default: 'Yes' },
      ])
    }
  }

  if (!['Label'].includes(answers.FieldType)) {
    answers = {
      ...answers, ...await prompt([
        { name: 'HintText', message: 'What HintText should this field have? (enter for nothing)', type: 'input' }
      ])
    }

  }

  if (answers.PageFieldDisplayOrder === 1) {
    answers = {
      ...answers, ...await prompt([
        { name: 'PageLabel', message: 'Does this page have a custom title?', type: 'input' },
        { name: 'PageShowCondition', message: 'Enter a page show condition string (leave blank if not needed)', type: 'input' },
        { name: 'CallBackURLMidEvent', message: 'Enter the callback url to hit before loading the next page (leave blank if not needed)', type: 'input' }
      ])
    }
  }

  if (['FixedList', 'FixedRadioList', 'MultiSelectList', 'Collection'].includes(answers.FieldType)) {

    const fieldTypeOpts = getScrubbedOpts(NEW)

    const followup = await prompt([
      { name: 'FieldTypeParameter', message: "What's the FieldTypeParameter?", type: 'list', choices: Object.keys(fieldTypeOpts).sort(), default: NEW }
    ])

    console.log(`Chosen ${followup.FieldTypeParameter} FieldTypeParameter`)

    if (followup.FieldTypeParameter === NEW) {
      caseField.FieldTypeParameter = await journeyCreateNewScrubbed()
    } else {
      caseField.FieldTypeParameter = followup.FieldTypeParameter
    }

  } else if (answers.FieldType === "Other") {
    const followup = await prompt([
      { name: 'Other', message: `Enter the name of the ComplexType for ${answers.ID}` },
      { name: 'FieldTypeParameter', message: `Enter the name of the FieldTypeParameter for ${answers.ID} (leave blank if not needed)` }
    ])

    answers.FieldType = followup.Other
    answers.FieldTypeParameter = followup.FieldTypeParameter
  }

  if (answers.FieldType === "Text") {
    answers = {
      ...answers, ...await prompt([
        { name: 'RegularExpression', message: "Do we need a RegularExpression for the field?", type: 'input' }
      ])
    }
  }

  caseField.CaseTypeID = "ET_EnglandWales"

  caseField.ID = answers.ID
  caseField.Label = answers.Label
  caseField.HintText = answers.HintText
  caseField.FieldType = answers.FieldType
  caseField.RegularExpression = answers.RegularExpression

  caseEventToField.CaseTypeID = "ET_EnglandWales"
  caseEventToField.CaseEventID = answers.CaseEventID
  caseEventToField.CaseFieldID = answers.ID
  caseEventToField.DisplayContext = answers.DisplayContext
  caseEventToField.PageID = answers.PageID
  caseEventToField.PageDisplayOrder = answers.PageID
  caseEventToField.PageFieldDisplayOrder = answers.PageFieldDisplayOrder
  caseEventToField.PageLabel = answers.PageLabel
  caseEventToField.PageShowCondition = answers.PageShowCondition
  caseEventToField.FieldShowCondition = answers.FieldShowCondition
  caseEventToField.ShowSummaryChangeOption = answers.ShowSummaryChangeOption === 'Yes' ? 'Y' : 'N'

  if (answers.CallBackURLMidEvent?.startsWith('/')) {
    answers.CallBackURLMidEvent = "${ET_COS_URL}" + answers.CallBackURLMidEvent
  }

  caseEventToField.CallBackURLMidEvent = answers.CallBackURLMidEvent

  const fieldAuthorisations = createAuthorisationCaseFields("ET_EnglandWales", answers.ID)
  const output = duplicateFieldsForScotland([trimCaseField(caseField)], [trimCaseEventToField(caseEventToField)], fieldAuthorisations, [])

  addToInMemoryConfig({
    AuthorisationCaseField: output.authorisationCaseFields,
    CaseField: output.caseFields,
    CaseEventToFields: output.caseEventToFields
  })

  console.log(`Added ${output.caseFields.length} caseFields, ${output.caseEventToFields.length} caseEventToFields and ${output.authorisationCaseFields.length} authorisationCaseFields`)
}

async function journeyCreateCaseEvent() {
  const caseEvent = createNewCaseEvent()

  let answers = await prompt(
    [
      { name: 'ID', message: `What's the page ID?`, type: 'input' },
      { name: 'Name', message: 'Give the new page a name', type: 'input' },
      { name: 'Description', message: 'Give the new page a description', type: 'input' },
      { name: 'DisplayOrder', message: 'Where should this page appear in the caseEvent dropdown (DisplayOrder)?', type: 'number' },
      { name: 'PreConditionState(s)', message: 'What state should the case be in to see this page? (PreConditionState(s))', type: 'input' },
      { name: 'PostConditionState', message: 'What state should the case be set to after completing this journey? (PostConditionState)', type: 'input' },
      { name: 'EventEnablingCondition', message: 'Provide an EventEnablingCondition (leave blank if not needed)', type: 'input' },
      { name: 'ShowEventNotes', message: `Provide a value for ShowEventNotes`, type: 'list', choices: ['Y', 'N'], default: 'N' },
      { name: 'ShowSummary', message: 'Should there be a Check Your Answers page after this?', type: 'list', choices: ['Y', 'N'], default: 'Y' },
      { name: 'CallBackURLAboutToStartEvent', message: 'Do we need a callback before we start? (leave blank if not)', type: 'input' },
      { name: 'CallBackURLAboutToSubmitEvent', message: 'Do we need a callback before we submit? (leave blank if not)', type: 'input' },
      { name: 'CallBackURLSubmittedEvent', message: 'Do we need a callback after we submit? (leave blank if not)', type: 'input' },
    ]
  )

  caseEvent.CallBackURLAboutToStartEvent = answers.CallBackURLAboutToStartEvent
  caseEvent.CallBackURLAboutToSubmitEvent = answers.CallBackURLAboutToSubmitEvent
  caseEvent.CallBackURLSubmittedEvent = answers.CallBackURLSubmittedEvent

  caseEvent.CaseTypeID = "ET_EnglandWales"
  caseEvent.ID = answers.ID
  caseEvent.Name = answers.Name
  caseEvent.Description = answers.Description
  caseEvent.DisplayOrder = answers.DisplayOrder
  caseEvent['PreConditionState(s)'] = answers['PreConditionState(s)']
  caseEvent.PostConditionState = answers.PostConditionState
  caseEvent.EventEnablingCondition = answers.EventEnablingCondition
  caseEvent.ShowEventNotes = answers.ShowEventNotes
  caseEvent.ShowSummary = answers.ShowSummary

  const scotlandCaseEvent = { ...caseEvent, CaseTypeID: caseEvent.CaseTypeID.replace("ET_EnglandWales", "ET_Scotland") }
  upsertNewCaseEvent(caseEvent)
  upsertNewCaseEvent(scotlandCaseEvent)

  const caseAuthorisations = createAuthorisationCaseEvent("ET_EnglandWales", answers.ID)
  console.log(`created ${caseAuthorisations.length} auths for case event`)
  const output = duplicateFieldsForScotland([], [], [], caseAuthorisations)
  console.log(`after duplication had ${output.authorisationCaseEvents.length} auths for case event`)

  addToInMemoryConfig({
    AuthorisationCaseEvent: output.authorisationCaseEvents
  })

  return caseEvent.ID
}

async function journeyCreateCallbackPopulatedTextField() {
  const caseField = createNewCaseFieldType()
  const caseEventToField = createNewCaseEventToField()
  const caseFieldLabel = createNewCaseFieldType()
  const caseEventToFieldLabel = createNewCaseEventToField()

  let answers = await prompt(
    [
      { name: 'CaseEventID', message: "Whats the CaseEvent that this field belongs to?", default: session.lastAnswers.CaseEventID },
      { name: 'ID', message: "What's the ID for this field?", type: 'input' },
      { name: 'PageID', message: 'What page will this field appear on?', type: 'number', default: session.lastAnswers.PageID || 1 },
      { name: 'PageFieldDisplayOrder', message: 'Whats the PageFieldDisplayOrder for this field?', type: 'number', default: session.lastAnswers.PageFieldDisplayOrder + 1 || 1 }
    ]
  )

  if (answers.PageFieldDisplayOrder === 1) {
    answers = {
      ...answers, ...await prompt([
        { name: 'PageLabel', message: 'Does this page have a custom title?', type: 'input' },
        { name: 'PageShowCondition', message: 'Enter a page show condition string (leave blank if not needed)', type: 'input' },
        { name: 'CallBackURLMidEvent', message: 'Enter the callback url to hit before loading the next page (leave blank if not needed)', type: 'input' }
      ])
    }
  }

  caseField.CaseTypeID = "ET_EnglandWales"
  caseFieldLabel.CaseTypeID = "ET_EnglandWales"

  caseField.ID = answers.ID
  caseFieldLabel.ID = `${answers.ID}Label`

  caseField.Label = "Placeholder"
  caseFieldLabel.Label = "${" + caseField.ID + "}"

  caseField.FieldType = "Text"
  caseFieldLabel.FieldType = "Label"

  caseEventToField.ShowSummaryChangeOption = 'N'
  caseEventToFieldLabel.ShowSummaryChangeOption = 'N'

  caseEventToField.CaseTypeID = "ET_EnglandWales"
  caseEventToFieldLabel.CaseTypeID = "ET_EnglandWales"

  caseEventToField.CaseEventID = answers.CaseEventID
  caseEventToFieldLabel.CaseEventID = answers.CaseEventID
  session.lastAnswers.CaseEventID = answers.CaseEventID

  caseEventToField.CaseFieldID = answers.ID
  caseEventToFieldLabel.CaseFieldID = `${answers.ID}Label`

  caseEventToField.DisplayContext = "READONLY"
  caseEventToFieldLabel.DisplayContext = "READONLY"

  caseEventToField.PageID = answers.PageID || 1
  caseEventToFieldLabel.PageID = caseEventToField.PageID
  session.lastAnswers.PageID = answers.PageID + 1

  caseEventToField.PageDisplayOrder = caseEventToField.PageID
  caseEventToFieldLabel.PageDisplayOrder = caseEventToField.PageID

  caseEventToField.PageFieldDisplayOrder = answers.PageFieldDisplayOrder || 1
  caseEventToFieldLabel.PageFieldDisplayOrder = caseEventToField.PageFieldDisplayOrder + 1
  session.lastAnswers.PageID = caseEventToFieldLabel.PageFieldDisplayOrder

  caseEventToField.PageLabel = answers.PageTitle

  caseEventToField.FieldShowCondition = `${answers.ID}Label=\"dummy\"`

  caseEventToField.PageShowCondition = answers.PageShowCondition

  caseEventToField.RetainHiddenValue = "No"

  if (answers.CallBackURLMidEvent?.startsWith('/')) {
    answers.CallBackURLMidEvent = "${ET_COS_URL}" + answers.CallBackURLMidEvent
  }

  caseEventToField.CallBackURLMidEvent = answers.CallBackURLMidEvent

  const fieldAuthorisations = [...createAuthorisationCaseFields("ET_EnglandWales", answers.ID), ...createAuthorisationCaseFields("ET_EnglandWales", `${answers.ID}Label`)]
  const output = duplicateFieldsForScotland(
    [trimCaseField(caseField), trimCaseField(caseFieldLabel)],
    [trimCaseEventToField(caseEventToField), trimCaseEventToField(caseEventToFieldLabel)],
    fieldAuthorisations,
    []
  )

  addToInMemoryConfig({
    AuthorisationCaseField: output.authorisationCaseFields,
    CaseField: output.caseFields,
    CaseEventToFields: output.caseEventToFields
  })

  console.log(output)
  console.log(`Added ${output.caseFields.length} caseFields, ${output.caseEventToFields.length} caseEventToFields and ${output.authorisationCaseFields.length} authorisationCaseFields`)
}

async function journeyCreateEventToComplexType() {
  const caseEventIdOpts = getCaseEventIDOpts(NEW)
  const answers = await prompt(
    [
      { name: 'ID', message: "What's the ID for this?", type: 'input' },
      { name: 'CaseEventID', message: "What's the CaseEventID for this?", type: 'list', choices: Object.keys(caseEventIdOpts) },
      { name: 'CaseFieldID', message: "What's the CaseFieldID for this?", type: 'input' },
      { name: 'ListElementCode', message: 'Whats the ListElementCode for this?', type: 'input' },
      { name: 'EventElementLabel', message: 'What\'s the custom label for this control?', type: 'input' },
      { name: 'FieldDisplayOrder', message: 'DWhats the FieldDisplayOrder for this?', type: 'number' },
      { name: 'DisplayContext', message: 'Whats the DisplayContext for this?', type: 'list', choices: ['READONLY', 'OPTIONAL', 'MANDATORY'] },
      { name: 'FieldShowCondition', message: 'Enter a FieldShowCondition (or leave blank if not needed', type: 'input' }
    ]
  )

  if (answers.CaseEventID === NEW) {
    answers.CaseEventID = await journeyCreateCaseEvent()
  }

  const eventToComplexType = createNewEventToComplexType()

  eventToComplexType.ID = answers.ID
  eventToComplexType.CaseEventID = answers.CaseEventID
  eventToComplexType.CaseFieldID = answers.CaseFieldID
  eventToComplexType.ListElementCode = answers.ListElementCode
  eventToComplexType.EventElementLabel = answers.EventElementLabel
  eventToComplexType.DisplayContext = answers.DisplayContext
  eventToComplexType.FieldShowCondition = answers.FieldShowCondition

  addToInMemoryConfig({
    AuthorisationCaseEvent: [],
    AuthorisationCaseField: [],
    CaseEvent: [],
    CaseEventToFields: [],
    CaseField: [],
    EventToComplexTypes: [eventToComplexType],
    Scrubbed: []
  })
}

async function journeySplitSession() {
  const ALL = "ALL"
  const RANGE = "RANGE"

  const validPages = getFieldsPerPage()
  const largestNumberLength = Object.keys(validPages).reduce((acc: number, obj) => Math.max(acc, obj.length), 0)
  const pageChoices = Object.keys(validPages).map(o => {
    return {
      name: o.padStart(largestNumberLength, '0'),
      value: Number(o)
    }
  })

  const answers = await prompt(
    [
      { name: 'PageID', message: `Export fields from what page?`, type: 'list', choices: [...pageChoices, new Separator(), RANGE, ALL, new Separator()] },
    ]
  )

  if (answers.PageID === ALL) {
    const totalPages = Object.keys(validPages).length

    for (let i = 1; i < totalPages + 1; i++) {
      const fieldCountOnPage = validPages[i]

      const followup = await prompt([
        { name: 'sessionName', message: `What's the name of the session to export page ${i} (${fieldCountOnPage} fields) to?`, type: 'input' },
      ])

      createSessionFromPage(i, followup.sessionName)
    }
    return
  } else if (answers.PageID === RANGE) {

    let followup = await prompt([
      { name: 'startPage', message: 'Starting from what page ID?', type: 'list', choices: pageChoices },
    ])

    const lastPageChoice = pageChoices.filter(o => o.value > Number(followup.startPage)).sort()

    followup = {
      ...followup,
      ...await prompt([
        { name: 'lastPage', message: `Up to (including) what page ID?`, type: 'list', choices: [...lastPageChoice, new Separator()] },
        { name: 'sessionName', message: 'Whats the name for this session file?', type: 'input' }
      ])
    }

    const newSession = createNewSession(followup.sessionName)

    for (let i = 1; i < Number(followup.lastPage) + 1; i++) {
      addPageToSession(i, newSession)
    }
    return
  }

  const fieldCountOnPage = validPages[answers.PageID]

  const followup = await prompt([
    { name: 'sessionName', message: `What's the name of the session to export ${fieldCountOnPage} fields to?`, type: 'input' },
  ])

  createSessionFromPage(answers.PageID, followup.sessionName)
}

async function journeyValidateAuthorisationCaseFields() {
  const OTHER = "Other..."

  const answers = await prompt(
    [
      { name: 'caseTypeId', message: `What is the caseTypeId?`, type: 'list', choices: ["ET_EnglandWales", "ET_Scotland", OTHER] },
    ]
  )

  if (answers.caseTypeId === OTHER) {
    const followup = await prompt(
      [
        { name: 'caseTypeId', message: `Enter a custom caseTypeId` },
      ]
    )
    answers.caseTypeId = followup.caseTypeId
  }

  const region = answers.caseTypeId.startsWith("ET_EnglandWales") ? getEnglandWales() : getScotland()

  const uniqueCaseFields = region.AuthorisationCaseField.filter(o => o.CaseTypeId === answers.caseTypeId).reduce((acc: any, obj) => {
    acc[obj.CaseFieldID] = true
    return acc
  }, {})

  const standardizedRoles = Object.keys(uniqueCaseFields).flatMap(o => createAuthorisationCaseFields(answers.caseTypeId, o))
    .filter(o => o.UserRole === "caseworker-employment-legalrep-solicitor")

  for (const auth of standardizedRoles) {
    const alreadyExists = region.AuthorisationCaseField.find(o => o.CaseFieldID === auth.CaseFieldID && o.UserRole === auth.UserRole && o.CaseTypeId === auth.CaseTypeId)
    if (alreadyExists) continue

    const insertIndex = region.AuthorisationCaseField.findIndex(o => o.CaseFieldID === auth.CaseFieldID)
    region.AuthorisationCaseField.splice(insertIndex, 0, auth)
  }
}

function createSessionFromPage(pageId: number, sessionName: string) {
  const full: Session['added'] = JSON.parse(JSON.stringify(session.added))

  const fieldsOnPage = full.CaseEventToFields.filter(o => o.PageID === pageId)
  const newSession = createNewSession(sessionName)

  newSession.added.CaseEventToFields = fieldsOnPage
  newSession.added.CaseField = full.CaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.ID))
  newSession.added.AuthorisationCaseField = full.AuthorisationCaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.CaseFieldID))
  newSession.added.Scrubbed = full.Scrubbed.filter(o => newSession.added.CaseField.find(x => x.FieldTypeParameter === o.ID))
  newSession.added.CaseEvent = full.CaseEvent.filter(o => fieldsOnPage.find(x => x.CaseEventID === o.ID))
  newSession.added.AuthorisationCaseEvent = full.AuthorisationCaseEvent.filter(o => newSession.added.CaseEvent.find(x => x.ID === o.CaseEventID))
  newSession.added.EventToComplexTypes = full.EventToComplexTypes.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.ID))

  newSession.date = new Date()

  saveSession(newSession)
}

function addPageToSession(pageId: number, newSession: Session) {
  const full: Session['added'] = JSON.parse(JSON.stringify(session.added))

  const fieldsOnPage = full.CaseEventToFields.filter(o => o.PageID === pageId)

  upsertFields<AuthorisationCaseField>(newSession.added.AuthorisationCaseField, full.AuthorisationCaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.CaseFieldID)), ['CaseFieldID', 'CaseTypeId', 'UserRole'])

  upsertFields<CaseField>(newSession.added.CaseField, full.CaseField.filter(o => fieldsOnPage.find(x => x.CaseFieldID === o.ID)), ['ID', 'CaseTypeID'])

  upsertFields<CaseEventToField>(newSession.added.CaseEventToFields, fieldsOnPage, ['CaseFieldID', 'CaseEventID', 'CaseTypeID'])

  upsertFields<Scrubbed>(newSession.added.Scrubbed, full.Scrubbed.filter(o => newSession.added.CaseField.find(x => x.FieldTypeParameter === o.ID)), ['ID', 'ListElementCode'])

  upsertFields<CaseEvent>(newSession.added.CaseEvent, full.CaseEvent.filter(o => fieldsOnPage.find(x => x.CaseEventID === o.ID)), ['ID', 'CaseTypeID'])

  upsertFields<AuthorisationCaseEvent>(newSession.added.AuthorisationCaseEvent, full.AuthorisationCaseEvent.filter(o => newSession.added.CaseEvent.find(x => x.ID === o.CaseEventID)), ['CaseEventID', 'CaseTypeId', 'UserRole'])

  newSession.date = new Date()

  saveSession(newSession)
}

start()