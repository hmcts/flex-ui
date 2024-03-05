#!/bin/bash

# Set the banner at the top of the terminal
tput setaf 4; tput bold; 
echo "==============================================================="
echo "*            Welcome to HMCTS Employment Tribunals           * "
echo "==============================================================="
echo "     This script will take you through the following steps     "
echo "---------------------------------------------------------------"
echo "* SSH key setup (if not present - manual step)"
echo "* Clone ET repos"
echo "* Install Java (if not already installed)"
echo "* Install AzureCLI (if not already installed)"
echo "* Install PostgreSQL (if not already installed)"
echo "* Install jq (if not already installed)"
echo "* Install Node (if not already installed or below 16)"
echo "* Install Yarn (if not already installed)"
echo "* Install redis-server (if not already installed)"
echo "* Install dependencies for ET repos"
tput sgr0

read -p "Press enter to continue or CTRL+C to quit..."

# Compare two version strings
# Returns 0 if $1 > $2
# Returns 1 if $1 < $2
function version_compare() {
    if ((10#$1 > 10#$2)); then
        return 0
    else
        return 1
    fi
}

function installNode() {
    # Check if nvm is installed
    if [ -x "$(command -v nvm)" ]; then
        echo "nvm is already installed"
        else 
        echo "Installing nvm"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash
    fi

    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

    # Check if node 20 is installed through nvm
    nvm install 20
    nvm use 20
}

# Check if user has an id_rsa or id_ed25519 key
if [ -f "$HOME/.ssh/id_rsa" ] || [ -f "$HOME/.ssh/id_ed25519" ]; then
  echo "SSH key found - Please make sure this is added to github and authorised for SSO"
else
  echo "No SSH key found - Please generate a new key, add it to github and authorise SSO on it"
  echo "From the github docs (https://docs.github.com/en/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)"
  echo "> ssh-keygen -t ed25519 -C "your_email@example.com""
  echo "> eval \"\$(ssh-agent -s)\""
  echo "> ssh-add ~/.ssh/id_ed25519"
  echo "> cat ~/.ssh/id_ed25519.pub"
  echo "Copy the output of the last command and add it to github > settings > SSH and GPG keys > New SSH key > Configure SSO > hmcts > Authorise"
  exit 0
fi

# Clone repos first because it likely has a user prompt with fingerprint

REPOS=(
  "et-ccd-definitions-englandwales"
  "et-ccd-definitions-scotland"
  "et-ccd-definitions-admin"
  "et-ccd-callbacks"
  "et-data-model"
  "et-common"
  "et-sya-api"
  "et-sya-frontend"
  "et-hearings-api"
  "flex-ui"
)

for repo in "${REPOS[@]}"; do
  if [ ! -d "$HOME/$repo" ]; then
    git clone "git@github.com:hmcts/$repo.git" "$HOME/$repo"
  fi
done

# Check if JAVA is installed
if [ -x "$(command -v java)" ]; then
    echo "Java is already installed"
    else 
    sudo apt-get update
    sudo apt-get install openjdk-17-jdk -y
    
fi

# Check if AzureCLI is installed
if [ -x "$(command -v az)" ]; then
    echo "AzureCLI is already installed"
    else 
    echo "Installing AzureCLI"
    curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
fi

# Check if postgresql is installed
if [ -x "$(command -v psql)" ]; then
    echo "PostgreSQL is already installed"
    else 
    echo "Installing PostgreSQL"
    sudo apt install postgresql -y
fi

# Check if jq is installed
if [ -x "$(command -v jq)" ]; then
    echo "jq is already installed"
    else 
    echo "Installing jq"
    sudo apt install jq -y
fi

# Check if node is installed and version 16 or higher
if [ -x "$(command -v node)" ]; then
    echo "node is already installed"
    node_version="8" # $(node -v | cut -d '.' -f 1 | sed 's/^v//')
    minimum_version="16"
    if version_compare "$node_version" "$minimum_version"; then
        echo "Node version is $node_version, which is equal to or greater than $minimum_version"
    else
        echo "Node version is $node_version, which is less than $minimum_version"
        installNode
    fi
else 
    installNode
fi

# Check if redis-server is installed 
if [ -x "$(command -v redis-server)" ]; then
    echo "redis-server is already installed"
    else 
    echo "Installing redis-server"
    sudo apt install redis-server -y
fi

# Check if yarn is installed
if [ -x "$(command -v yarn)" ]; then
    echo "yarn is already installed"
    else 
    echo "Installing yarn"
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
    sudo apt update && sudo apt install yarn -y
fi

YARN_INSTALL=(
  "et-ccd-definitions-englandwales"
  "et-ccd-definitions-scotland"
  "et-ccd-definitions-admin",
  "et-sya-frontend"
)

for repo in "${YARN_INSTALL[@]}"; do
    cd "$HOME/$repo"
    yarn install
done

cd $HOME/flex-ui
npm install

# Check if docker is installed
if [ -x "$(command -v docker)" ]; then
    echo "Docker is already installed"
    else 
    echo "Docker is not setup in this WSL instance"
    echo "Make sure Docker Desktop is installed and enabled for this instance"
    echo "(Settings > Resources > WSL integration > Toggle 'ON' for this instance)"
    echo "Open a new terminal instance once enabled - use 'docker ps' to check"
fi
