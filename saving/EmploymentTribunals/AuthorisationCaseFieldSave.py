import json

englandWalesFolderLocation = "../et-ccd-definitions-englandwales/definitions/json/"
scotlandFolderLocation = "../et-ccd-definitions-scotland/definitions/json/"

englandWalesIDPrefix = "ET_EnglandWales"
scotlandIDPrefix = "ET_Scotland"


def save_authorisation_case_field_to_json(answers, country):
    if country == "England":
        file_location = englandWalesFolderLocation + "AuthorisationCaseField.json"
    else:
        file_location = scotlandFolderLocation + "AuthorisationCaseField.json"
    authorisation_case_event_json = json.load(open(file_location))

    # CASE TYPE ID Generate
    if country == "England":
        case_id = englandWalesIDPrefix
        role_suffix = 'englandwales'
    else:
        case_id = scotlandIDPrefix
        role_suffix = 'scotland'

    if answers['caseType'] == 'Listings':
        case_id = case_id + "_Listings"
    elif answers['caseType'] == 'Multiple':
        case_id = case_id + "_Multiple"

    raw_json = """[
        {
            "CaseTypeId": "{0}",
            "CaseFieldID": "{1}",
            "UserRole": "caseworker-employment",
            "CRUD": "R"
        },
        {
            "CaseTypeId": "{0}",
            "CaseFieldID": "{1}",
            "UserRole": "caseworker-employment-etjudge",
            "CRUD": "R"
        },
        {
            "CaseTypeId": "{0}",
            "CaseFieldID": "{1}",
            "UserRole": "caseworker-employment-{2}",
            "CRUD": "CRU"
        },
        {
            "CaseTypeId": "{0}",
            "CaseFieldID": "{1}",
            "UserRole": "caseworker-employment-etjudge-{2}",
            "CRUD": "CRU"
        },
        {
            "CaseTypeId": "{0}",
            "CaseFieldID": "{1}",
            "UserRole": "caseworker-employment-api",
            "CRUD": "CRUD"
        }
    ]"""

    raw_json = raw_json.replace('{0}', case_id)
    raw_json = raw_json.replace('{1}', answers['caseFieldID'])
    raw_json = raw_json.replace('{2}', role_suffix)

    new_authorisations = json.loads(raw_json)

    for authorisation in new_authorisations:
        authorisation_case_event_json.append(authorisation)

    with open(file_location, 'w', encoding='utf-8') as f:
        json.dump(authorisation_case_event_json, f, ensure_ascii=False, indent=2)
