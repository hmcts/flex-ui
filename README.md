# HMCTS Helpers

A collection of tools to help speed up development of ExUI. Split into flows using `inquirer` to create a friendly CLI environment.

Knowledge on ExUI development is still required to use this, please learn how to do this stuff manually before using this tool. This is only to speed up development

## Limitations

This was created to speed up my workflow and only contains tools to replicate actions I've needed to take for development. ie, if I've not had to do it manually yet, its not in here yet. 

An example of this limitation is EnglandWales/Scotland replication, currently all generated fields are duplicated between this no CLI support for differences between the two. As a hack there is a mode to disable scotland generation.

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

## WIP

+ Automated setup of new cases in CCD
  - An example POC exists in web.ts to create a new case in EnglandWales

+ Validation of configs
  - Catch errors before attempting to import and in the wild