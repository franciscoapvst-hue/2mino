# Deploy en VPS (Docker)

Guía para levantar **2mino** en un VPS Ubuntu con Docker Compose.

Referencia del servidor actual (IONOS):

| Dato          | Valor              |
|---------------|--------------------|
| IP            | `74.208.119.150`   |
| OS            | Ubuntu 24.04       |
| Tamaño        | VPS 2-4-120 (2 vCPU, 4 GB RAM, 120 GB) |
| Usuario       | `root`             |

> ⚠️ La contraseña root se compartió en texto plano durante la configuración.
> **Cámbiala** apenas termines el deploy: dentro del VPS ejecuta `passwd`.

---

## Arquitectura del despliegue

Todo corre en contenedores en una sola red Docker interna. Solo **Caddy** expone
puertos al exterior (80 y 443); todo lo demás vive detrás de la red Docker:

| Servicio              | Puerto interno | Expuesto | Rol                                             |
|-----------------------|----------------|----------|--------------------------------------------------|
| `caddy`               | 80/443         | **80/443** | Reverse proxy + TLS automático (Let's Encrypt) |
| `frontend` (nginx)    | 80             | —        | Sirve el build de Vite + proxy `/api` y `/ws`    |
| `api-integracion`     | 3000           | —        | Gateway público (solo vía red interna)          |
| `ms-usuarios`         | 4000           | —        | Usuarios / auth                                 |
| `ms-frontend-landing` | 5000           | —        | Config del landing / preferencias               |
| `ms-salas`            | 6001           | —        | Salas, juego, ELO, matchmaking                  |
| `ms-social`           | 6200           | —        | Amigos, notificaciones, chat (WS)               |
| `postgres`            | 5432           | 5432 *   | Base de datos                                   |

\* Postgres se expone en el compose para debug local. **En producción comenta ese
bloque `ports:` de postgres** — los microservicios lo alcanzan por la red interna;
no hace falta abrirlo a internet.

El navegador habla con `https://DOMAIN` (Caddy). Caddy termina TLS y reenvía todo
a `frontend:80` (nginx), que sirve el HTML estático y reenvía `/api/` y `/ws/` a
los servicios internos. Por eso **no** hace falta exponer ningún otro puerto: el
frontend y la API comparten origen (`CORS_ORIGIN` solo importa si algo llama
cruzado, ver más abajo).

Archivos clave del frontend en la raíz del repo:
- `Dockerfile` — build de Vite + imagen nginx
- `nginx.conf` — sirve estáticos y proxya `/api/` → `api-integracion:3000`, `/ws/` → `ms-social:6200`
- `Caddyfile` — dominio(s) + `reverse_proxy frontend:80` (Caddy hace el resto: cert, renovación, redirect http→https)
- `.dockerignore` — evita copiar `node_modules`, los microservicios, etc.

---

## Requisitos previos

- Acceso SSH al VPS (`root` + contraseña, o mejor una **clave SSH**).
- El código en GitHub: `https://github.com/franciscoapvst-hue/2mino.git`
  (rama de trabajo actual: `feat/ranked-elo`).
- `ssh` disponible en tu PC (Windows 10/11 ya lo trae; también sirve Git Bash).

---

## Variables de entorno (`.env`)

Se copia de `.env.example` y se rellena **en el VPS** (no subir el `.env` real a git):

```env
# Contraseña de PostgreSQL — larga y aleatoria
POSTGRES_PASSWORD=

# Secreto para firmar JWT — generar con:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=

# Dominio público — Caddy lo usa para pedir el certificado TLS (Let's Encrypt).
# Requiere que el registro A (y el de www) ya apunten a la IP del VPS.
DOMAIN=2mino.online

# CORS — con dominio propio, poner el origen exacto (con https)
CORS_ORIGIN=https://2mino.online

# Email de confirmación de cuenta — ya integrado (SMTP de IONOS), ver
# docs/ARQUITECTURA.md. Poner en true + completar SMTP_USER/SMTP_PASS
# cuando la casilla no-reply@2mino.online esté creada en el panel de IONOS.
ENABLE_EMAIL=false
SMTP_HOST=smtp.ionos.com
SMTP_PORT=465
SMTP_USER=no-reply@2mino.online
SMTP_PASS=
SMTP_FROM=2mino <no-reply@2mino.online>
APP_URL=https://2mino.online
```

`.env` está en `.gitignore`; nunca se commitea.

---

## Pasos de deploy

### 1. Traer el proyecto al VPS (git clone)

Método recomendado: clonar el repo directamente en el VPS. Así el redeploy futuro
es solo `git pull` (ver sección Operación diaria).

Dentro del VPS (`ssh root@74.208.119.150`):

```bash
cd /opt
git clone -b feat/ranked-elo https://github.com/franciscoapvst-hue/2mino.git 2mino
cd 2mino
```

> El repo es **privado**: `git clone` pedirá usuario de GitHub + un **Personal
> Access Token** (GitHub ya no acepta la contraseña de la cuenta).
> Generarlo en: GitHub → Settings → Developer settings → Personal access tokens →
> *Fine-grained tokens* → dar acceso de solo lectura (`Contents: Read`) al repo
> `2mino`. Pegar el token cuando pida la "password".
>
> Si `git` no está instalado en el VPS: `apt update && apt install -y git`.

**Alternativa sin git** (subir por `scp` desde tu PC): más lento porque copia
`node_modules`. Si la usas, borra primero esas carpetas o el `.env` no se sube
(está en `.gitignore` pero `scp` no respeta ignore). En general, preferir git.

```bash
# solo si NO usas git — desde tu PC, en la carpeta 2mino:
scp -r . root@74.208.119.150:/opt/2mino
```

### 2. Instalar Docker

Dentro del VPS (`ssh root@74.208.119.150`):

```bash
curl -fsSL https://get.docker.com | sh
```

Trae Docker Engine + el plugin `docker compose`.

### 3. Configurar el entorno

```bash
cd /opt/2mino
cp .env.example .env
nano .env      # rellenar POSTGRES_PASSWORD y JWT_SECRET
```

Generar el JWT:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Guardar en nano: `Ctrl+O`, Enter, `Ctrl+X`.

### 4. Levantar todo

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos (compila 5 imágenes). Las migraciones de la
base corren solas al arrancar cada microservicio (`CREATE TABLE IF NOT EXISTS`
+ bloques `ALTER TABLE ... IF NOT EXISTS`).

### 5. Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### 6. Verificar

```bash
docker compose ps            # todos "running"/"healthy"
curl localhost/api/health    # {"service":"api-integracion","status":"ok"}
docker compose logs -f caddy # confirmar que obtuvo el certificado (sin errores de ACME)
```

Abrir en el navegador: **https://2mino.online**

> La primera vez, Caddy necesita que el DNS ya resuelva a esta IP y que 80/443
> estén abiertos — si no, el challenge de Let's Encrypt falla y reintenta solo.

---

## Operación diaria

```bash
cd /opt/2mino

docker compose ps                     # estado
docker compose logs -f api-integracion  # logs de un servicio
docker compose logs -f                # logs de todos

docker compose restart ms-salas       # reiniciar uno
docker compose down                   # bajar todo (conserva el volumen de datos)
docker compose up -d --build          # reconstruir y levantar
```

### Redeploy tras cambios de código

Con el repo clonado, dentro del VPS:

```bash
cd /opt/2mino
git pull
docker compose up -d --build
```

`--build` es necesario cuando cambió el código; sin él reusa las imágenes viejas.

---

## Base de datos

- Los datos viven en el volumen Docker `postgres_data`; **sobreviven** a
  `docker compose down` y a los redeploys. Solo se borran con
  `docker compose down -v` (⚠️ destruye la BD).
- Backup manual:
  ```bash
  docker compose exec postgres pg_dump -U 2mino 2mino > backup_$(date +%F).sql
  ```
- Restore:
  ```bash
  cat backup.sql | docker compose exec -T postgres psql -U 2mino 2mino
  ```

---

## Seguridad — a tener en cuenta

1. **Cambiar la contraseña root** (`passwd`) — se expuso en texto plano.
2. **Preferir clave SSH** sobre contraseña. Generar par en tu PC
   (`ssh-keygen -t ed25519`), copiar la pública al VPS:
   ```bash
   echo "TU_LLAVE_PUBLICA" >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
   Luego, opcionalmente, deshabilitar login por contraseña en
   `/etc/ssh/sshd_config` (`PasswordAuthentication no`) y `systemctl restart ssh`.
3. **Comentar el puerto 5432 de postgres** en `docker-compose.yml` para no
   exponer la base a internet.
4. **`.env` nunca a git** — ya está en `.gitignore`.
5. **`usuarios-prueba.txt`** (credenciales de prueba) tampoco se sube; está
   ignorado. En producción, considera borrar esos usuarios de prueba.

---

## Pendiente / mejoras futuras

Auditoría de escalabilidad hecha 2026-07-13 (detalle completo en
`docs/ESCALABILIDAD.md`, local — no versionado). Resumen de lo ya hecho
y lo que falta:

**Ya hecho** (PRs #46, #47, #49):
- Timeout de 10s en las llamadas del gateway a los microservicios.
- `max` explícito en los pools de Postgres de los 4 servicios + `max_connections=200`.
- Rate limiting (global y en `/auth/*`).
- Healthchecks en los 6 contenedores de aplicación.
- Polling del frontend con back-pressure (no apila requests contra un backend lento).
- Compresión (gzip/zstd) en Caddy.

**Pendiente**:
- **Monitoreo**: `docker compose logs` sirve de arranque, pero no hay
  forma de enterarse de un problema sin que un jugador se queje. Falta un
  cron con `docker stats`/`df -h` + alerta por webhook, y/o un uptime
  checker externo (UptimeRobot u otro) apuntando a `/api/health`.
- **CI en el VPS**: Jenkins en sí corre local (PC del dev), pero el paso
  final del pipeline (`Jenkinsfile`, stage "Deploy a VPS") hace
  `docker compose up -d --build` por SSH DIRECTO en el VPS de
  producción — cada imagen se recompila ahí mismo, compitiendo por
  CPU/RAM con el tráfico real. Falta decidir cómo resolverlo (build
  local + push de imagen ya armada, o un runner de CI aparte).
- **Polling del estado de partida**: sigue siendo HTTP cada 2s (con
  back-pressure, pero sigue siendo polling). El siguiente paso natural es
  un WebSocket "aviso + fetch" reusando la infraestructura que ya tiene
  `ms-social` para el chat de partida — scoping ya hecho, ver
  `docs/ESCALABILIDAD.md`.
- **Redis / réplicas**: no urgente hoy — solo hace falta el día que
  algún servicio necesite correr en más de una instancia (hoy el caché
  de `reglas_juego`, el mutex de bots de `ms-salas` y la presencia de
  `ms-social` viven en memoria de un solo proceso).
