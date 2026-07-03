# 2mino

Plataforma web de **dominó dominicano** multijugador. Incluye autenticación de usuarios, salas de juego, lógica de partida en servidor y una interfaz React con tema claro/oscuro.

## Stack

| Capa | Tecnología |
|------|------------|
| Frontend | React 18, TypeScript, Vite |
| API pública | Fastify (`api-integracion`) |
| Microservicios | Fastify + PostgreSQL |
| Base de datos | PostgreSQL 16 |
| Contenedores | Docker Compose |

## Estructura del repositorio

```
2mino/
├── src/                      # Frontend React (SPA)
│   ├── App.tsx               # Enrutamiento de vistas
│   ├── api.ts                # Cliente HTTP y tipos compartidos
│   ├── components/           # UI: auth, dashboard, salas, juego
│   └── game/types.ts         # Lógica de dominó (cliente)
├── api-integracion/          # Gateway público (JWT, CORS, proxy a MS)
├── ms-usuarios/              # Registro, login, reset de contraseña
├── ms-frontend-landing/      # Preferencias de UI y config del landing
├── ms-salas/                 # Salas, jugadores y partidas
├── docker-compose.yml        # Orquestación completa
└── docs/                     # Documentación extendida
```

## Inicio rápido

### Con Docker (recomendado para backend completo)

```powershell
# 1. Configurar variables de entorno
cp .env.example .env
# Editar .env con POSTGRES_PASSWORD y JWT_SECRET

# 2. Levantar servicios
docker compose up --build

# 3. Frontend en otra terminal
npm install
npm run dev
```

- API pública: http://localhost:3000
- Swagger: http://localhost:3000/docs
- Frontend: http://localhost:5173

### Desarrollo local (sin Docker)

Requiere PostgreSQL en `localhost:5432` con base `2mino`, usuario `2mino` y contraseña `2minodev` (o ajustar los scripts `dev.ps1`).

Levantar cada servicio en una terminal:

```powershell
.\ms-usuarios\dev.ps1
.\ms-frontend-landing\dev.ps1
.\ms-salas\dev.ps1
.\api-integracion\dev.ps1
npm run dev
```

Ver [docs/DESARROLLO.md](docs/DESARROLLO.md) para el detalle completo.

## Arquitectura

El frontend solo habla con `api-integracion`. Los microservicios internos no se exponen al navegador en producción.

Diagrama de integración (Mermaid): [docs/DIAGRAMAS.md](docs/DIAGRAMAS.md)

## Flujo de la aplicación

1. **Auth** — Registro/login → JWT almacenado en `localStorage` o `sessionStorage`.
2. **Dashboard** — Preferencias de usuario (tema, idioma, features por segmento).
3. **Salas** — Crear, listar o unirse por código; hasta 4 jugadores por sala.
4. **Juego** — Partida autoritativa en `ms-salas`; el frontend hace polling del estado y envía jugadas.

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) | Servicios, base de datos, API y lógica de juego |
| [docs/DESARROLLO.md](docs/DESARROLLO.md) | Setup local, puertos, scripts y convenciones |
| [docs/FRONTEND.md](docs/FRONTEND.md) | Vistas, componentes y pantalla de juego |
| [docs/DIAGRAMAS.md](docs/DIAGRAMAS.md) | Diagramas Mermaid (integración, flujos) |

## Scripts útiles

```powershell
# Frontend
npm run dev       # Servidor de desarrollo Vite
npm run build     # Build de producción
npm run preview   # Preview del build

# Cada microservicio (desde su carpeta)
npm run dev       # tsx watch
npm run build     # Compilar TypeScript
```

## Variables de entorno

Copiar `.env.example` a `.env`. Variables principales:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL |
| `JWT_SECRET` | Secreto para firmar tokens JWT |
| `CORS_ORIGIN` | Origen permitido del frontend (`*` en dev) |
| `ENABLE_EMAIL` | Envío de emails (reset de contraseña) |

## Licencia

Proyecto privado.
