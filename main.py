import inquirer
from pyfiglet import Figlet
from questions.EmploymentTribunals.CaseFieldQuestions import ask_case_field_questions
from saving.EmploymentTribunals.AuthorisationCaseFieldSave import save_authorisation_case_field_to_json
from saving.EmploymentTribunals.CaseEventToFieldSave import save_case_event_to_fields_to_json
from saving.EmploymentTribunals.CaseFieldSave import save_case_field_to_json
from utilities.EmploymentTribunals.DockerTools import import_json_files, create_docker_environment, init_ecm, \
    destroy_docker_environment

if __name__ == '__main__':
    f = Figlet(font='colossal')
    print(f.renderText('FlexUI'))

    menu_questions = [
        inquirer.List('createMethod', message='Main Menu',
                      choices=[
                          'Create Event',
                          'Create Field',
                          'Generate Data Model For Event',
                          'Delete Event',
                          'Delete Field',
                          'Import JSON files',
                          'Create Docker Environment',
                          'Init ECM (Do after creating docker)',
                          'Destroy Docker Environment',
                          'Quit'
                      ]),
    ]

    while True:
        # Get important answers
        menu_selection = inquirer.prompt(menu_questions)
        if menu_selection['createMethod'] == 'Create Event':
            print('Event creation not implemented')
        elif menu_selection['createMethod'] == 'Create Field':
            answers = ask_case_field_questions()
            for country in ['England', 'Scotland']:
                save_case_field_to_json(answers, country)
                save_case_event_to_fields_to_json(answers, country)
                save_authorisation_case_field_to_json(answers, country)
        elif menu_selection['createMethod'] == 'Import JSON files':
            import_json_files()
        elif menu_selection['createMethod'] == 'Create Docker Environment':
            create_docker_environment()
        elif menu_selection['createMethod'] == 'Init ECM (Do after creating docker)':
            init_ecm()
        elif menu_selection['createMethod'] == 'Destroy Docker Environment':
            destroy_docker_environment()
        elif menu_selection['createMethod'] == 'Quit':
            quit()
