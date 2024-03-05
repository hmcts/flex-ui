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
    await execCommand(`docker image tag ${image} ${newName}`)
    console.log(`Retagged ${image} as ${newName}`)
    await execCommand(`docker push ${newName}`)
    console.log(`Pushed ${newName}`)
  }
}

export default {
  disabled: false,
  group: 'et-docker',
  text: 'Backup docker images',
  fn: journey,
  alias: 'Backup docker images'
} as Journey
