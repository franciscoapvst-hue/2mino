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

    // SonarQube analiza de forma asíncrona; este paso espera el webhook
    // de vuelta y corta el pipeline si el Quality Gate no pasa. Sin esto,
    // "SonarQube Analysis" solo dispara el análisis pero nunca lo evalúa.
    stage('Wait for Quality Gate') {
      steps {
        timeout(time: 5, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true
        }
      }
    }

    // Único paso que toca producción: si todo lo anterior pasó, el VPS
    // se actualiza solo. El job de este pipeline solo trackea `main`,
    // así que llegar hasta acá ya implica que es ese branch.
    stage('Deploy a VPS') {
      steps {
        withCredentials([string(credentialsId: 'vps-password', variable: 'VPS_PASSWORD')]) {
          sh '''
            sshpass -p "$VPS_PASSWORD" ssh -o StrictHostKeyChecking=no root@74.208.119.150 \
              "cd /opt/2mino && git pull && docker compose up -d --build"
          '''
        }
      }
    }
  }

  post {
    always { cleanWs() }
  }
}
