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

    // 2mino-BO (Back Office) es un panel de uso local — nunca se
    // despliega al VPS y no participa de este pipeline. Si el push solo
    // tocó esa carpeta (o docs/), no tiene sentido correr type-check,
    // tests, Sonar ni deploy: se marca el build como no-op y se corta acá.
    // Si algo falla al detectar el diff (ej. commit inicial sin padre),
    // se asume que SÍ hay que correr todo — más seguro que saltear de más.
    stage('Detectar alcance del cambio') {
      steps {
        script {
          env.SOLO_BACK_OFFICE = 'false'
          try {
            def base = sh(script: 'git rev-parse HEAD~1', returnStdout: true).trim()
            def changed = sh(script: "git diff --name-only ${base} HEAD", returnStdout: true).trim()
            def files = changed ? changed.split('\n') : []
            if (files.size() > 0 && files.every { it.startsWith('2mino-BO/') }) {
              env.SOLO_BACK_OFFICE = 'true'
              echo "Cambios únicamente en 2mino-BO/ — se salta el resto del pipeline (panel local, no se despliega)."
            }
          } catch (e) {
            echo "No se pudo determinar el diff (${e.message}) — se corre el pipeline completo por seguridad."
          }
        }
      }
    }

    stage('Install & Type-check') {
      when { environment name: 'SOLO_BACK_OFFICE', value: 'false' }
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
      when { environment name: 'SOLO_BACK_OFFICE', value: 'false' }
      steps { dir('ms-salas') { sh 'npm test' } }
    }

    stage('Build frontend') {
      when { environment name: 'SOLO_BACK_OFFICE', value: 'false' }
      steps { sh 'npm run build' }
    }

    stage('SonarQube Analysis') {
      when { environment name: 'SOLO_BACK_OFFICE', value: 'false' }
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
      when { environment name: 'SOLO_BACK_OFFICE', value: 'false' }
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
      when { environment name: 'SOLO_BACK_OFFICE', value: 'false' }
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
