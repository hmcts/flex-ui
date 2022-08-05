import json

englandWalesFolderLocation = "../et-ccd-definitions-englandwales/definitions/json/"
scotlandFolderLocation = "../et-ccd-definitions-scotland/definitions/json/"

englandWalesIDPrefix = "ET_EnglandWales"
scotlandIDPrefix = "ET_Scotland"


def save_case_event_to_fields_to_json(answers, country):
    if country == "England":
        file_location = englandWalesFolderLocation + "CaseEventToFields.json"
    else:
        file_location = scotlandFolderLocation + "CaseEventToFields.json"
    case_field_to_event_json = json.load(open(file_location))

    new_case_event_to_field = {}

    # CASE TYPE ID Generate
    if country == "England":
        new_case_event_to_field['CaseTypeID'] = englandWalesIDPrefix
    else:
        new_case_event_to_field['CaseTypeID'] = scotlandIDPrefix

    if answers['caseType'] == 'Listings':
        new_case_event_to_field['CaseTypeID'] = new_case_event_to_field['CaseTypeID'] + "_Listings"
    elif answers['caseType'] == 'Multiple':
        new_case_event_to_field['CaseTypeID'] = new_case_event_to_field['CaseTypeID'] + "_Multiple"

    # Show hide condition
    if 'showHideCondition' in answers and answers['showHideCondition'] != '\"\"':
        new_case_event_to_field['FieldShowCondition'] = answers['showHideCondition']

    # Other fields
    new_case_event_to_field['CaseEventID'] = answers['caseEvent']
    new_case_event_to_field['CaseFieldID'] = answers['caseFieldID']
    new_case_event_to_field['DisplayContext'] = answers['displayContext']
    new_case_event_to_field['PageID'] = answers['pageNumber']
    new_case_event_to_field['PageDisplayOrder'] = answers['pageNumber']
    new_case_event_to_field['PageFieldDisplayOrder'] = answers['pageFieldDisplayOrder']
    new_case_event_to_field['ShowSummaryChangeOption'] = 'Y' if answers['showSummary'] else 'N'
    new_case_event_to_field['PageColumnNumber'] = 1

    case_field_to_event_json.append(new_case_event_to_field)

    with open(file_location, 'w', encoding='utf-8') as f:
        json.dump(case_field_to_event_json, f, ensure_ascii=False, indent=2)
