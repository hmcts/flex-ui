import { execCommand } from 'app/helpers'
import { prompt } from 'inquirer'
import { Journey } from 'types/journey'

async function journey() {
  const answers = await prompt([{ name: 'username', message: 'enter your dockerhub username', default: 'jackreeve532' }])
  const name = answers.username
  // Code here
  const images = [
    'hmctspublic.azurecr.io/hmcts/rse/rse-idam-simulator:latest',
    'hmctspublic.azurecr.io/dm/store:latest',
    'hmctspublic.azurecr.io/xui/webapp:latest',
    'wiremock/wiremock:latest',
    'mcr.microsoft.com/azure-storage/azurite:latest',
    'cftlib-ccd-logstash:latest',
    'hmctspublic.azurecr.io/xui/mo-webapp:latest',
    'docker.elastic.co/elasticsearch/elasticsearch:7.11.1'
  ]

  for (const image of images) {
    const newName = `${name}/${image.replace(/\//g, '-')}`
    await execCommand(`docker pull ${newName}`)
    console.log(`Pulled ${newName}`)

    await execCommand(`docker image tag ${newName} ${image}`)
    console.log(`Retagged ${newName} as ${image}`)

  }
}

export default {
  disabled: false,
  group: 'et-docker',
  text: 'Restore docker images',
  fn: journey,
  alias: 'Restore docker images'
} as Journey
