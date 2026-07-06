# CI local: Jenkins + SonarQube

Pipeline de integración continua corriendo **en esta PC** (no en la nube ni en el
VPS de producción), pensado para un solo desarrollador: cuando hay cambios, esta
máquina tiene que estar encendida para que el pipeline corra.

---

## Arquitectura

Todo vive en `ci/docker-compose.yml`, separado del `docker-compose.yml` de la
app (son dos stacks Docker independientes, se pueden levantar juntos o por
separado):

| Servicio    | Puerto | Rol                                              |
|-------------|--------|---------------------------------------------------|
| `jenkins`   | 8080   | Orquesta el pipeline (`Jenkinsfile` en la raíz)   |
| `sonarqube` | 9000   | Análisis de calidad de código                     |
| `sonar-db`  | —      | Postgres dedicado a SonarQube (no el de la app)   |

Jenkins **poll-ea** el repo de GitHub cada 5 minutos (`H/5 * * * *`) en vez de
usar un webhook — esta PC no tiene IP pública, así que no hace falta exponer
nada a internet ni usar un túnel (ngrok, etc.).

Toda la configuración de Jenkins (usuario admin, credenciales, conexión a
SonarQube, y el job del pipeline) se define como código en
`ci/jenkins-casc.yaml` (plugin *Configuration as Code*) — no hace falta pasar
por el asistente de instalación ni clickear nada a mano.

---

## Requisitos

- Docker Desktop (ya instalado en esta PC).
- Un Personal Access Token de GitHub de solo lectura sobre el repo `2mino`
  (mismo tipo que se usa para el deploy al VPS, ver `docs/DEPLOY.md`).

---

## Levantar todo por primera vez

```powershell
cd ci
cp .env.example .env
# Rellenar SONAR_DB_PASSWORD, JENKINS_ADMIN_PASSWORD, GITHUB_USERNAME/GITHUB_TOKEN
```

### 1. SonarQube primero (Jenkins necesita su token para arrancar)

```powershell
docker compose up -d sonar-db sonarqube
```

Esperar a que esté sano:

```powershell
curl http://localhost:9000/api/system/status
# {"status":"UP", ...}
```

Cambiar la contraseña por defecto (`admin`/`admin` → forzado) y generar un
token para Jenkins:

```powershell
# Cambiar password
curl -u admin:admin -X POST "http://localhost:9000/api/users/change_password" `
  --data-urlencode "login=admin" `
  --data-urlencode "previousPassword=admin" `
  --data-urlencode "password=TU_PASSWORD_NUEVA"

# Generar token de análisis
curl -u admin:TU_PASSWORD_NUEVA -X POST "http://localhost:9000/api/user_tokens/generate" `
  --data-urlencode "name=jenkins-ci" `
  --data-urlencode "type=GLOBAL_ANALYSIS_TOKEN"
```

Guardar ese `token` en `ci/.env` como `SONAR_TOKEN`.

### 2. Jenkins

```powershell
docker compose build jenkins   # imagen con los plugins de plugins.txt ya instalados
docker compose up -d jenkins
```

JCasC crea automáticamente:
- El usuario admin (`JENKINS_ADMIN_USER`/`JENKINS_ADMIN_PASSWORD`).
- Credencial `github-pat` (checkout del repo privado).
- Credencial `sonar-token` (análisis).
- La conexión global a SonarQube (`SonarQubeLocal` → `http://sonarqube:9000`).
- Una herramienta Node.js (`node20`), auto-instalada la primera vez que corre un build.
- El job `2mino-ci`, apuntando a `main` y con polling cada 5 minutos.

Verificar en `http://localhost:8080` con el usuario/password de `ci/.env`.

---

## El pipeline (`Jenkinsfile`, raíz del repo)

1. Checkout.
2. `npm ci` + `tsc --noEmit` en paralelo: frontend, `api-integracion`,
   `ms-usuarios`, `ms-frontend-landing`, `ms-salas`.
3. `npm test` (Vitest) en `ms-salas`.
4. `npm run build` del frontend.
5. Análisis de SonarQube (`sonar-project.properties` en la raíz define qué
   carpetas mirar) usando el paquete oficial `@sonar/scan` vía `npx` — no
   depende de tener el scanner CLI instalado en el agente, `npx` lo resuelve
   solo la primera vez.

---

## Operación diaria

```powershell
cd ci
docker compose ps                  # estado
docker compose logs -f jenkins     # logs
docker compose stop                # bajar todo, conserva volúmenes
docker compose up -d               # volver a levantar
```

Un push a `main` no dispara el build al instante — Jenkins lo detecta en el
próximo poll (máximo 5 minutos). Para forzarlo ya: entrar al job en
`http://localhost:8080/job/2mino-ci/` → "Build Now".

---

## Seguridad

- `ci/.env` nunca se sube a git (ya está en `.gitignore` vía la regla general
  de `.env`).
- El PAT de GitHub usado acá es de **solo lectura** (`Contents: Read`) — igual
  que el del VPS, no puede escribir en el repo.
- Jenkins y SonarQube solo escuchan en `localhost` de esta PC (los puertos no
  están pensados para exponerse a la red local ni a internet).
