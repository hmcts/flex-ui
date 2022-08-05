import inquirer


def ask_case_field_questions(last_answer={}):
    questions_main = [
        inquirer.List('caseType', message='Case Type', choices=['Singles', 'Listings', 'Multiple']),
        inquirer.Text('caseEvent', message='Case event ID'),
        inquirer.Text('pageNumber', message='Page Number'),
        inquirer.Confirm('showSummary', message='Show in the summary')
    ]

    questions_case_field = [
        inquirer.List('displayContext', message='Display context',
                      choices=['MANDATORY', 'OPTIONAL', 'READONLY', 'COMPLEX']),
        inquirer.Text('pageFieldDisplayOrder', message='Page field display order'),
        inquirer.Text('caseFieldID', message='Case Field ID'),
        inquirer.Text('caseFieldLabel', message='Case Field Label'),
        inquirer.List('caseFieldType', message='Case Field Type',
                      choices=['Label', 'Number', 'Text', 'TextArea', 'FixedList', 'DynamicList', 'Date', 'DateTime',
                               'YesOrNo', 'Collection', 'Other']),
        inquirer.Confirm('hasShowCondition', message='Does this have a show/hide condition?')
    ]

    questions_show_hide = [
        inquirer.Text('showOnCaseField', message='Case field to show or hide on'),
        inquirer.List('showCondition', message='Show/Hide condition', choices=['CONTAINS', '=', '!=']),
        inquirer.Text('showOnValue', message='Value to show or hide on'),
        inquirer.Confirm('showAdditionalCondition', message='Additional condition?', default=False)
    ]

    questions_case_field_type_other = [
        inquirer.Text('caseFieldType', message='Case Field Type (Free text)'),
    ]

    questions_case_field_type_other = [
        inquirer.Text('caseFieldTypeParameter', message='Case Field Parameter'),
    ]

    questions_show_hide_additional = [
        inquirer.List('showConditionCombiner', message='Show/Hide condition combiner', choices=['OR', 'AND']),
    ]

    answers = {}
    answers = {**answers, **inquirer.prompt(questions_main)}
    answers = {**answers, **inquirer.prompt(questions_case_field)}

    # Generate show/hide
    show_hide_condition = ''
    while answers['hasShowCondition']:
        if 'showAdditionalCondition' in answers and answers['showAdditionalCondition']:
            answers = {**answers, **inquirer.prompt(questions_show_hide_additional)}
            show_hide_condition += ' {0} '.format(answers['showConditionCombiner'])
        answers = {**answers, **inquirer.prompt(questions_show_hide)}
        show_hide_condition += '{0} {1} \"{2}\"'.format(answers['showOnCaseField'], answers['showCondition'],
                                                        answers['showOnValue'])
        answers['hasShowCondition'] = answers['showAdditionalCondition']

    answers['showHideCondition'] = show_hide_condition

    return answers
