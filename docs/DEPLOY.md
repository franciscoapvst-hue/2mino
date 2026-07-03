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

Todo corre en contenedores en una sola red Docker interna. Solo **dos puertos**
se exponen al exterior:

| Servicio              | Puerto interno | Expuesto | Rol                                             |
|-----------------------|----------------|----------|-------------------------------------------------|
| `frontend` (nginx)    | 80             | **80**   | Sirve el build de Vite + proxy `/api`           |
| `api-integracion`     | 3000           | —        | Gateway público (solo vía red interna)          |
| `ms-usuarios`         | 4000           | —        | Usuarios / auth                                 |
| `ms-frontend-landing` | 5000           | —        | Config del landing / preferencias               |
| `ms-salas`            | 6001           | —        | Salas, juego, ELO, matchmaking                  |
| `postgres`            | 5432           | 5432 *   | Base de datos                                   |

\* Postgres se expone en el compose para debug local. **En producción comenta ese
bloque `ports:` de postgres** — los microservicios lo alcanzan por la red interna;
no hace falta abrirlo a internet.

El navegador solo habla con `http://IP` (puerto 80). nginx sirve el HTML estático
y reenvía todo lo que empiece con `/api/` al gateway. Por eso **no** hace falta
exponer el puerto 3000 ni configurar CORS con un dominio: el frontend y la API
comparten origen.

Archivos clave del frontend en la raíz del repo:
- `Dockerfile` — build de Vite + imagen nginx
- `nginx.conf` — sirve estáticos y proxya `/api/` → `api-integracion:3000`
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

# CORS — con acceso por IP y proxy same-origin, dejar *
CORS_ORIGIN=*

# Email — true solo cuando se integre un proveedor (SendGrid/Resend/SES)
ENABLE_EMAIL=false
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
ufw enable
```

### 6. Verificar

```bash
docker compose ps            # todos "running"/"healthy"
curl localhost/api/health    # {"service":"api-integracion","status":"ok"}
```

Abrir en el navegador: **http://74.208.119.150**

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

- **Dominio + HTTPS**: cuando haya dominio, apuntar un registro `A` a la IP y
  añadir un reverse proxy con TLS (Caddy o nginx + certbot/Let's Encrypt).
  Entonces poner `CORS_ORIGIN=https://tudominio` en vez de `*`.
- **CI/CD**: automatizar el redeploy con un webhook o GitHub Actions que haga
  `git pull && docker compose up -d --build` en el VPS.
- **Monitoreo**: `docker compose logs` sirve de arranque; a futuro, un stack de
  logs/alertas si el tráfico crece.
