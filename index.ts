import 'source-map-support/register'
import { config as envConfig } from 'dotenv'
import { prompt } from 'inquirer'
import { AuthorisationCaseField, CaseEventToField, CaseField, SaveMode, Scrubbed, Session } from './types/types'
import { readFileSync, writeFileSync } from 'fs'
import { sep } from 'path'
import { createAuthorisationCaseEvent, createAuthorisationCaseFields, createNewCaseEvent, createNewCaseEventToField, createNewCaseFieldType, createNewSession, duplicateFieldsForScotland, trimCaseEventToField, trimCaseField } from './objects'
import { addNewScrubbed, addToInMemoryConfig, executeYarnGenerate, getCounts, getScrubbedOpts, insertNewCaseEvent, readInCurrentConfig, saveBackToProject } from './configs'
import { ensurePathExists } from './helpers'
import { readdir } from 'fs/promises'
import { findPreviousSessions, getCurrentSessionName, lastAnswers, restorePreviousSession, saveSession, session, SESSION_DIR, SESSION_EXT, setCurrentSessionName } from './session'
envConfig()

function checkEnvVars() {
  const needed = [process.env.ENGWALES_DEF_DIR, process.env.SCOTLAND_DEF_DIR]
  const missing = needed.filter(o => !o)
  if (missing.length) {
    throw new Error(`Env vars are missing: ${missing.join(', ')}`)
  }
}

let saveMode: SaveMode = SaveMode.BOTH

async function start() {
  ensurePathExists(SESSION_DIR)
  checkEnvVars()
  readInCurrentConfig()

  const journeyRestore = 'Restore a previous session'
  const journeySetName = 'Set session name'
  const journeySingle = 'Create a single field'
  const journeyCallbackLabel = 'Create a Callback populated Label'
  const journeySaveAndExit = 'Save JSONs and Exit'
  const journeyCreatePage = 'Create new page/event'
  const journeyDebugListChanges = "DEBUG: List in-memory configs"

  while (true) {
    const answers = await prompt([
      {
        name: 'Journey',
        message: "What do you want to do?",
        type: 'list',
        choices: [
          journeySetName,
          journeyRestore,
          journeyCreatePage,
          journeySingle,
          journeyCallbackLabel,
          `Change save mode (currently: ${SaveMode[saveMode]})`,
          journeyDebugListChanges,
          journeySaveAndExit
        ]
      }
    ])

    console.log(answers)

    if (answers.Journey === journeySetName) {
      await journeySessionName()
    } else if (answers.Journey === journeyRestore) {
      await journeyRestoreSession()
    } else if (answers.Journey === journeyCreatePage) {
      await journeyCreateCaseEvent()
    } else if (answers.Journey === journeySingle) {
      await journeyCreateNewField()
    } else if (answers.Journey === journeyCallbackLabel) {
      await journeyCreateCallbackPopulatedTextField()
    } else if (answers.Journey.startsWith("Change save mode")) {
      await journeySaveMode()
    } else if (answers.Journey === journeyDebugListChanges) {
      journeyDebugList()
    } else if (answers.Journey === journeySaveAndExit) {
      break
    }

    saveSession()
  }

  saveBackToProject(saveMode)
  executeYarnGenerate()
}

async function journeySaveMode() {
  const answers = await prompt([
    { name: 'SaveMode', message: "Which ones would you like to generate/save for?", type: 'list', choices: ['Both', 'EnglandWales', 'Scotland'] }
  ])

  saveMode = answers.SaveMode === "Both" ? SaveMode.BOTH
    : answers.SaveMode === "EnglandWales" ? SaveMode.ENGLANDWALES
      : SaveMode.SCOTLAND
}

async function journeyDebugList() {
  console.log(`DEBUG: ${getCounts()}`)
}

async function journeySessionName() {
  const answers = await prompt([
    { name: 'name', message: "What should we called this session?" }
  ])

  setCurrentSessionName(answers.name)
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

  setCurrentSessionName(answers.name)
  restorePreviousSession(getCurrentSessionName())
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
    'Other'
  ]

  const caseField = createNewCaseFieldType()
  const caseEventToField = createNewCaseEventToField()

  let answers = await prompt(
    [
      { name: 'CaseEventID', message: `Whats the CaseEvent that this field belongs to?`, default: lastAnswers.CaseEventID },
      { name: 'ID', message: `What's the ID for this field?`, type: 'input' },
      { name: 'Label', message: 'What text should this field have (Label)?', type: 'input' },
      { name: 'FieldType', message: 'What FieldType should this be?', type: 'list', choices: optsFieldType },
      { name: 'PageID', message: `What page will this field appear on?`, type: 'number', default: lastAnswers.PageID || 1 },
      { name: 'PageFieldDisplayOrder', message: `Whats the PageFieldDisplayOrder for this field?`, type: 'number', default: lastAnswers.PageFieldDisplayOrder + 1 || 1 },
      { name: 'FieldShowCondition', message: 'Enter a field show condition string (leave blank if not needed)', type: 'input' }
    ]
  )

  lastAnswers.CaseEventID = answers.CaseEventID
  lastAnswers.PageID = answers.PageID
  lastAnswers.PageFieldDisplayOrder = answers.PageFieldDisplayOrder

  if (answers.FieldType === "Label") {
    answers.DisplayContext = "READONLY"
  } else {
    answers = {
      ...answers, ...await prompt([
        { name: 'DisplayContext', message: 'Is this field READONLY, OPTIONAL or MANDATORY?', type: 'list', choices: ['READONLY', 'OPTIONAL', 'MANDATORY'], default: 'OPTIONAL' },
        { name: 'ShowSummaryChangeOption', message: 'Should this field appear on the CYA page?', type: 'list', choices: ['Yes', 'No'], default: 'Yes' },
      ])
    }
  }

  if (!['Text', 'Label'].includes(answers.FieldType)) {
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
      ])
    }
  }

  if (['FixedList', 'FixedRadioList', 'MultiSelectList'].includes(answers.FieldType)) {
    const NEW = "New..."
    const fieldTypeOpts = getScrubbedOpts(NEW)

    const followup = await prompt([
      { name: 'FieldTypeParameter', message: "What's the FieldTypeParameter?", type: 'list', choices: Object.keys(fieldTypeOpts).sort(), default: NEW }
    ])

    if (followup.FieldTypeParameter === NEW) {
      caseField.FieldTypeParameter = await journeyCreateNewScrubbed()
    }

    answers.FieldTypeParameter = followup.FieldTypeParameter
  } else if (answers.FieldType === "Other") {
    const followup = await prompt([
      { name: 'Other', message: `Enter the name of the ComplexType for ${answers.ID}` }
    ])

    answers.FieldType = followup.Other
  }

  caseField.CaseTypeID = "ET_EnglandWales"

  caseField.ID = answers.ID
  caseField.Label = answers.Label
  caseField.HintText = answers.HintText
  caseField.FieldType = answers.FieldType

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

  if (answers.FieldTypeParameter) {
    caseField.FieldTypeParameter
  }

  const fieldAuthorisations = createAuthorisationCaseFields("ET_EnglandWales", answers.ID)
  const output = duplicateFieldsForScotland([trimCaseField(caseField)], [trimCaseEventToField(caseEventToField)], fieldAuthorisations, [])

  addToInMemoryConfig({
    AuthorisationCaseField: output.authorisationCaseFields,
    CaseField: output.caseFields,
    CaseEventToFields: output.caseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: []
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
  insertNewCaseEvent(caseEvent)
  insertNewCaseEvent(scotlandCaseEvent)

  const caseAuthorisations = createAuthorisationCaseEvent("ET_EnglandWales", answers.ID)
  console.log(`created ${caseAuthorisations.length} auths for case event`)
  const output = duplicateFieldsForScotland([], [], [], caseAuthorisations)
  console.log(`after duplication had ${output.authorisationCaseEvents.length} auths for case event`)

  addToInMemoryConfig({
    AuthorisationCaseField: [],
    CaseField: [],
    CaseEventToFields: [],
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: output.authorisationCaseEvents
  })
}

async function journeyCreateCallbackPopulatedTextField() {
  const caseField = createNewCaseFieldType()
  const caseEventToField = createNewCaseEventToField()
  const caseFieldLabel = createNewCaseFieldType()
  const caseEventToFieldLabel = createNewCaseEventToField()

  const answers = await prompt(
    [
      { name: 'CaseEventID', message: "Whats the CaseEvent that this field belongs to?" },
      { name: 'ID', message: "What's the ID for this field?", type: 'input' },
      { name: 'PageID', message: 'What page will this field appear on?', type: 'number' },
      { name: 'PageFieldDisplayOrder', message: 'Whats the PageFieldDisplayOrder for this field?', type: 'number' },
      { name: 'PageTitle', message: 'Does this page have a custom title? (leave blank if this is not the first field on that page)', type: 'input' },
      { name: 'PageShowCondition', message: 'Enter a page show condition string (leave blank if not needed)', type: 'input' }
    ]
  )

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
  lastAnswers.CaseEventID = answers.CaseEventID

  caseEventToField.CaseFieldID = answers.ID
  caseEventToFieldLabel.CaseFieldID = `${answers.ID}Label`

  caseEventToField.DisplayContext = "READONLY"
  caseEventToFieldLabel.DisplayContext = "READONLY"

  caseEventToField.PageID = answers.PageID || 1
  caseEventToFieldLabel.PageID = caseEventToField.PageID
  lastAnswers.PageID = answers.PageID + 1

  caseEventToField.PageDisplayOrder = caseEventToField.PageID
  caseEventToFieldLabel.PageDisplayOrder = caseEventToField.PageID

  caseEventToField.PageFieldDisplayOrder = answers.PageFieldDisplayOrder || 1
  caseEventToFieldLabel.PageFieldDisplayOrder = caseEventToField.PageFieldDisplayOrder + 1
  lastAnswers.PageID = caseEventToFieldLabel.PageFieldDisplayOrder

  caseEventToField.PageLabel = answers.PageTitle

  caseEventToField.FieldShowCondition = `${answers.ID}Label=\"dummy\"`

  caseEventToField.PageShowCondition = answers.PageShowCondition

  caseEventToField.RetainHiddenValue = "No"

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
    CaseEventToFields: output.caseEventToFields,
    Scrubbed: [],
    CaseEvent: [],
    AuthorisationCaseEvent: [],
  })

  console.log(output)
  console.log(`Added ${output.caseFields.length} caseFields, ${output.caseEventToFields.length} caseEventToFields and ${output.authorisationCaseFields.length} authorisationCaseFields`)
}

start()