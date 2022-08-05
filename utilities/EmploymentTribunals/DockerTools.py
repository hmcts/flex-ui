import subprocess


def import_json_files():
    subprocess.call('yarn generate-excel-local', shell=True, cwd='../et-ccd-definitions-englandwales/')
    subprocess.call('yarn generate-excel-local', shell=True, cwd='../et-ccd-definitions-scotland/')
    subprocess.call('./bin/ecm/import-ccd-config.sh e', shell=True, cwd='../ecm-ccd-docker/')
    subprocess.call('./bin/ecm/import-ccd-config.sh s', shell=True, cwd='../ecm-ccd-docker/')


def create_docker_environment():
    # Need to get env variables working here
    subprocess.call('source ./bin/set-environment-variables.sh', shell=True, cwd='../ecm-ccd-docker/')
    subprocess.call('./ccd login', shell=True, cwd='../ecm-ccd-docker/')
    subprocess.call('./ccd compose pull', shell=True, cwd='../ecm-ccd-docker/')
    subprocess.call('./ccd init', shell=True, cwd='../ecm-ccd-docker/')
    subprocess.call('./ccd compose up -d', shell=True, cwd='../ecm-ccd-docker/')


def init_ecm():
    subprocess.call('./bin/ecm/init-ecm.sh', shell=True, cwd='../ecm-ccd-docker/')
    subprocess.call('./bin/init-db.sh', shell=True, cwd='../et-ccd-callbacks/')


def destroy_docker_environment():
    subprocess.call('docker kill $(docker ps -qa)', shell=True)
    subprocess.call('docker rm $(docker ps -qa)', shell=True)
    subprocess.call('docker system prune --volumes', shell=True)
    subprocess.call('docker image rm $(docker image ls)', shell=True)
