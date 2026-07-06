pipeline {
  agent any

  tools {
    nodejs 'node20'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
  }

  stages {

    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Install & Type-check') {
      parallel {
        stage('frontend') {
          steps { sh 'npm ci && npx tsc --noEmit' }
        }
        stage('api-integracion') {
          steps { dir('api-integracion') { sh 'npm ci && npx tsc --noEmit' } }
        }
        stage('ms-usuarios') {
          steps { dir('ms-usuarios') { sh 'npm ci && npx tsc --noEmit' } }
        }
        stage('ms-frontend-landing') {
          steps { dir('ms-frontend-landing') { sh 'npm ci && npx tsc --noEmit' } }
        }
        stage('ms-salas') {
          steps { dir('ms-salas') { sh 'npm ci && npx tsc --noEmit' } }
        }
      }
    }

    stage('Tests (ms-salas)') {
      steps { dir('ms-salas') { sh 'npm test' } }
    }

    stage('Build frontend') {
      steps { sh 'npm run build' }
    }

    stage('SonarQube Analysis') {
      steps {
        withSonarQubeEnv('SonarQubeLocal') {
          sh 'SONAR_TOKEN=$SONAR_AUTH_TOKEN npx --yes @sonar/scan'
        }
      }
    }
  }

  post {
    always { cleanWs() }
  }
}
