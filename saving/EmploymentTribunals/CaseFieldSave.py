import json

englandWalesFolderLocation = "../et-ccd-definitions-englandwales/definitions/json/"
scotlandFolderLocation = "../et-ccd-definitions-scotland/definitions/json/"

englandWalesIDPrefix = "ET_EnglandWales"
scotlandIDPrefix = "ET_Scotland"


def save_case_field_to_json(answers, country):
    if country == "England":
        file_location = englandWalesFolderLocation + "CaseField.json"
    else:
        file_location = scotlandFolderLocation + "CaseField.json"
    case_field_json = json.load(open(file_location))

    new_case_field = {}

    # CASE TYPE ID Generate
    if country == "England":
        new_case_field['CaseTypeID'] = englandWalesIDPrefix
    else:
        new_case_field['CaseTypeID'] = scotlandIDPrefix

    if answers['caseType'] == 'Listings':
        new_case_field['CaseTypeID'] = new_case_field['CaseTypeID'] + "_Listings"
    elif answers['caseType'] == 'Multiple':
        new_case_field['CaseTypeID'] = new_case_field['CaseTypeID'] + "_Multiple"

    # Other fields
    new_case_field['ID'] = answers['caseFieldID']
    new_case_field['Label'] = answers['caseFieldLabel']
    new_case_field['FieldType'] = answers['caseFieldType']
    new_case_field['SecurityClassification'] = 'Public'

    case_field_json.append(new_case_field)

    with open(file_location, 'w', encoding='utf-8') as f:
        json.dump(case_field_json, f, ensure_ascii=False, indent=2)
