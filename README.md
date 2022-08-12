# CCD Helpers

A collection of tools to help speed up development of ExUI. Split into flows using `inquirer` to create a friendly CLI environment.

Knowledge on ExUI development is still required to use this, this is NOT a replacement for learning how CCD works.

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

See the wiki for a detailed walkthrough and information on contributing