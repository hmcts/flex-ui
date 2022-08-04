# HMCTS Helpers

A collection of tools to help speed up development of ExUI. Split into flows using `inquirer` to create a friendly CLI environment.

Knowledge on ExUI development is still required to use this, please learn how to do this stuff manually before using this tool. This is only to speed up development


## Features:

+ Loading and Saving of the EnglandWales and Scotland configs
+ Create once for both EnglandWales and replicate to Scotland
+ Sessions
  - Build out new pages in a seperate session to integrate into the config at a later date
  - Useful for resolving merge conflicts with other teams
+ Supports the following JSONs:
  - CaseField (including a macro for a callback populated label)
  - CaseEventToFields (bundled into creating fields)
  - CaseEvent
  - EventToComplexType
  - Scrubbed (create new lists)
  - Authorisations (for CaseField and CaseEvents)
+ Automatically generate authorisations
+ Tear down and rebuild the Docker environment
+ Save to XLSX and import definitions

## Testimony

The entire ET3 Response journey was created using this tool. An example of the finished session containing everything needed for ET3 Response can be found in "sessions/24-RET-1948.session.json".

After following the questions and generating all the pages. `Split current session` was used to generate story-by-story session files that could be replayed on top of the latest sprint branch. Here the entire ET3 Response journey was merged in a single day:

+ https://github.com/hmcts/et-ccd-definitions-englandwales/pull/195
+ https://github.com/hmcts/et-ccd-definitions-englandwales/pull/197
+ https://github.com/hmcts/et-ccd-definitions-englandwales/pull/198
+ https://github.com/hmcts/et-ccd-definitions-englandwales/pull/199
+ https://github.com/hmcts/et-ccd-definitions-englandwales/pull/201

## Limitations

This was created to speed up my workflow and only contains tools to replicate actions I've needed to take for development. ie, if I've not had to do it manually yet, its not in here. 

An example of this limitation is EnglandWales/Scotland replication, currently all generated fields are duplicated between this no CLI support for differences between the two. As a hack there is a mode to disable scotland generation.

## WIP / Future Improvements

##### Automated setup of new cases in CCD
  - An example POC exists in web.ts to create a new case in EnglandWales
  - It would be nice to build out a system that could take us through ALL events

##### Validation of configs
  - Catch errors before attempting to import and in the wild
  - There's an attempt at 'fixing' authorisations but the tool should only suggest changes and not automatically apply (as some discrepancies are intended)

##### Error handling in code
  - There's really not a lot of error handling so it's probably pretty easy to break

##### Go back after answering a question wrong
  - I don't know how easy this is to do in inquirer
  - When I made mistakes in the past I restart (it doesn't take long to get back to where you were)

##### Add support for the other sheets
  - There's many that haven't been covered here simply because I haven't needed to use them yet

##### Add to et-ccd-callbacks project
  - Template out new endpoints with the provided CallBackURL...
  - I feel like a collection of vscode snippets works better for this (no need to overcomplicate)

##### Tests
  - All officially support tools should have them?

## Requirements

Built with Node 16 but should run with 14 as well

- `npm install` 
- `npm run start`

+ An `.env` file in the root of the project with the following (change paths as needed)

```
ENGWALES_DEF_DIR="/Users/jackreeve/hmcts/et-ccd-definitions-englandwales"
SCOTLAND_DEF_DIR="/Users/jackreeve/hmcts/et-ccd-definitions-scotland"
ECM_DOCKER_DIR="/Users/jackreeve/hmcts/ecm-ccd-docker"
ET_CCD_CALLBACKS_DIR="/Users/jackreeve/hmcts/et-ccd-callbacks"
```

The script will yell at you if these are not provided

## Walkthrough

After running `npm run start`, the script will load the current configs (as defined in ENGWALES_DEF_DIR and SCOTLAND_DEF_DIR) to memory. Any changes are kept in memory (and the current session file) until `Save back to Config` is run. 

Here we're going to walkthrough creating a new event with pages from scratch.

### Set a session name

Set a session name by selecting `Set session name` in the main menu, this is not required and a default name of the current time will be used.

### Create a new event

+ Select `Create new page/event`
+ Fill out the questions
  - These will mostly just be "provide a value for X" but some have friendlier names

For now, we're going to use the following to create a basic event with no callbacks: 

```
? What do you want to do? Create new page/event
? What's the page ID? helpersTest
? Give the new page a name Example of HMCTS Helpers
? Give the new page a description A walkthrough of the helper tool
? Where should this page appear in the caseEvent dropdown (DisplayOrder)? 10
? What state should the case be in to see this page? (PreConditionState(s)) *
? What state should the case be set to after completing this journey? (PostConditionState) *
? Provide an EventEnablingCondition (leave blank if not needed) 
? Provide a value for ShowEventNotes N
? Should there be a Check Your Answers page after this? Y
? Do we need a callback before we start? (leave blank if not) 
? Do we need a callback before we submit? (leave blank if not) 
? Do we need a callback after we submit? (leave blank if not) 
```

### Create some fields

The questions you'll be asked here go into creating both the CaseField and the CaseEventToField entry at the same time. Note that some questions are hidden depending on the answers given (for example, a PageTitle is not asked for when creating a field that is not first on the page).

### FieldType: Label

```
? What do you want to do? Create a single field
? Whats the CaseEvent that this field belongs to? helpersTest
? What's the ID for this field? testFieldLabel
? What text should this field have (Label)? I'm a basic label
? What FieldType should this be? Label
? What page will this field appear on? 1
? Whats the PageFieldDisplayOrder for this field? 1
? Enter a field show condition string (leave blank if not needed) 
? Does this page have a custom title? The First Page of the Example
? Enter a page show condition string (leave blank if not needed) 
? Enter the callback url to hit before loading the next page (leave blank if not needed)

```

This will create a Label with the text "I'm a basic label" as the first field the first page of "helpersTest" event.
We set a custom title for the page as "The First Page of the Example"


### FieldType: FixedRadioList with a new Scrubbed type

Let's create a FixedRadioList field to demonstrate a more complex field.

You'll notice at this point that some questions have default answers to them based on your previous answers (most notably, the case event question and the ordering of field questions).

When selecting a FieldTypeParameter, it will pre-populate options that already exist in the config, along with an option to create a new one...

```
? What do you want to do? Create a single field
? Whats the CaseEvent that this field belongs to? helpersTest
? What's the ID for this field? testFieldFixedRadioList
? What text should this field have (Label)? Select one of the following options
? What FieldType should this be? FixedRadioList
? What page will this field appear on? 1
? Whats the PageFieldDisplayOrder for this field? 2
? Enter a field show condition string (leave blank if not needed) 
? Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX? MANDATORY
? Should this field appear on the CYA page? Yes
? What HintText should this field have? (enter for nothing) It doesn't matter which you select, this is just an example
? What's the FieldTypeParameter? New...
Chosen New... FieldTypeParameter
? What's the name of the new Scrubbed list? frl_exampleOptions
? What should be displayed to the user when selecting this option? Windows
? Give a ListElementCode for this item Windows
? Whats the DisplayOrder for this item? 1
? Add another? Yes
? What should be displayed to the user when selecting this option? Mac
? Give a ListElementCode for this item Mac
? Whats the DisplayOrder for this item? 2
? Add another? Yes
? What should be displayed to the user when selecting this option? Linux
? Give a ListElementCode for this item Linux
? Whats the DisplayOrder for this item? 3
? Add another? No
```

This will create a FixedRadioList with the Label "Select one of the following options" and HintText "It doesn't matter which you select, this is just an example". It will appear second on the first page. We were given options for our FixedRadioList but we decided to create a new one called "frl_exampleOptions" with three options "Windows, Mac and Linux".

### FieldType: TextArea (with a conditional show)

Finally for this page, lets create a text area that only appears if the user selects "Windows" on the previous field. This time we'll make the field OPTIONAL.

```
? What do you want to do? Create a single field
? Whats the CaseEvent that this field belongs to? helpersTest
? What's the ID for this field? testFieldTextArea
? What text should this field have (Label)? Why did you pick windows?
? What FieldType should this be? TextArea
? What page will this field appear on? 1
? Whats the PageFieldDisplayOrder for this field? 3
? Enter a field show condition string (leave blank if not needed) testFieldFixedRadioList="Windows"
? Is this field READONLY, OPTIONAL, MANDATORY or COMPLEX? OPTIONAL
? Should this field appear on the CYA page? Yes
? What HintText should this field have? (enter for nothing) You could have picked anything else
```

The only special thing to note here is that the field show condition doesn't need to be escaped (yay).

### Callback-populated label

A macro/shorthand for creating two fields for a label that is populated via a callback. We create the first field, a hidden text box whose value will be written to by a callback, and a second label field that will show the text.

For the sake of demonstration we'll add a second page to this event by answering "2" when asked what page it will appear on and we'll make the second page only show if the user selected "Mac" on the previous page.

```
? What do you want to do? Create a Callback populated Label
? Whats the CaseEvent that this field belongs to? helpersTest
? What's the ID for this field? testCallbackPopulated
? What page will this field appear on? 2
? Whats the PageFieldDisplayOrder for this field? 1
? Does this page have a custom title? (leave blank if this is not the first field on that page) Second page
? Enter a page show condition string (leave blank if not needed) testFieldFixedRadioList="Mac"
? Enter the callback url to hit before loading the next page (leave blank if not needed)
```

This results in the following being created:

```json
"caseFields": [
      {
        "CaseTypeID": "ET_EnglandWales",
        "ID": "testCallbackPopulated",
        "Label": "Placeholder",
        "FieldType": "Text",
        "SecurityClassification": "Public"
      },
      {
        "CaseTypeID": "ET_EnglandWales",
        "ID": "testCallbackPopulatedLabel",
        "Label": "${testCallbackPopulated}",
        "FieldType": "Label",
        "SecurityClassification": "Public"
      }
],
"caseEventToFields": [
        {
        "CaseTypeID": "ET_EnglandWales",
        "CaseEventID": "helpersTest",
        "CaseFieldID": "testCallbackPopulated",
        "DisplayContext": "READONLY",
        "PageID": 2,
        "PageDisplayOrder": 2,
        "PageFieldDisplayOrder": 1,
        "FieldShowCondition": "testCallbackPopulatedLabel=\"dummy\"",
        "PageShowCondition": "testFieldFixedRadioList=\"Mac\"",
        "RetainHiddenValue": "No",
        "PageLabel": "Second page",
      },
      {
        "CaseTypeID": "ET_EnglandWales",
        "CaseEventID": "helpersTest",
        "CaseFieldID": "testCallbackPopulatedLabel",
        "DisplayContext": "READONLY",
        "PageID": 2,
        "PageDisplayOrder": 2,
        "PageFieldDisplayOrder": 2
      },
]
```

Callbacks can then set the value of "testCallbackPopulated" to whatever arbitrary text/html and it will be displayed as a label through the "testCallbackPopulatedLabel" field. We cannot add a callback in this guide without needing code in the callbacks and data-model repos, so for now this will be a blank page (but you can see the elements there when inspecting the webpage!)

### Save back to Config

By now we have 2 pages of fields and a CYA page showing what the user input.

+ Select "Save back to Config"

This will modify the actual JSON files and then runs a "yarn generate-excel-local" in both engwales/scotland repos

The "yarn generate-excel-local" also exists as a standalone command called "Generate Spreadsheets"

### Import configs into CCD 

Select "Import configs into CCD" to load the configs into CCD (same as running ./bin/ecm/import-ccd-config.sh)

### Finally

Session data will be saved with each step into the sessions folder by the name provided (or by date). This contains all the additions made.
This file can be edited and reloaded with "Restore a previous session", but be aware that these files are not validated and contain both data for EngWales and Scotland, so make sure to modify both where applicable.

When saving back to JSONs, the objects are diffed based on what makes each field unique, meaning Labels and Hint Texts etc... can be changed here and re-applied without reverting git changes.

### Things not shown in this guide

#### CallBackURLMidEvent

For this guide to be runnable out of the box, we can't show adding Callbacks without also modifying the callbacks project. These are pretty simple though, just provide a URL when asked for one by the questions. "${ET_COS_URL}" will be prepended if entry starts with a slash ('/'). ie, "/midHelpersTest" will get generated as ${ET_COS_URL}/midHelpersTest

#### EventToComplexTypes

Support for this is incomplete, it doesn't support creating ComplexTypes yet. Support shouldn't be too hard to add, I just haven't personally had to do this myself yet, but I have needed to use an existing ComplexType in an event, therefore EventToComplexTypes support exists, just follow the questions asked, if you can grasp the other functionality this will be a breeze.

#### Split current session

This is useful for taking a large session file and splitting it based on event pages. Give it a page number and it'll create a new session with only fields/event/scrubbeds required to reload it in. Edge case, but I found this helpful when splitting up the ET3 Response journey into more managable PRs.

#### Fresh start docker, Boot and setup, Tear down everything docker

See below or look in setup.ts for the code relating to these functions

##### Tear down everything docker

docker kill all
docker remove all 
docker system prune
docker remove all images#

```
docker kill $(docker ps -qa)
docker rm $(docker ps -qa)
docker system prune --volumes
docker image rm $(docker image ls)
```

Not the cleanest of output but it gets the job done.

NOTE THIS WILL DESTROY EVERYTHING (EVEN NON HMCTS DOCKER CONTAINER/IMAGES)

##### Boot and Setup

Basically runs everything inside the README for ecm-ccd-docker:

```
	./ccd login
	./ccd compose pull
	./ccd init
	./ccd compose up -d
	./bin/ecm/init-ecm.sh

```

and from the et-ccd-callbacks:

```
./bin/init-db.sh
```

##### Fresh start docker

"Tear down everything docker" and "Boot and Setup" all rolled into one command