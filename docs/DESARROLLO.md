# Guía de desarrollo

## Requisitos

- Node.js 20+
- npm
- PostgreSQL 16 (local o vía Docker)
- PowerShell (scripts `dev.ps1` en Windows)

## Setup inicial

```powershell
# Clonar e instalar frontend
npm install

# Instalar dependencias de cada microservicio
npm install --prefix api-integracion
npm install --prefix ms-usuarios
npm install --prefix ms-frontend-landing
npm install --prefix ms-salas
```

## Opción A — Docker Compose

```powershell
cp .env.example .env
# Editar POSTGRES_PASSWORD y JWT_SECRET

docker compose up --build
```

Servicios levantados:

| Servicio | Puerto host | Swagger |
|----------|-------------|---------|
| api-integracion | 3000 | http://localhost:3000/docs |
| postgres | 5432 | — |
| ms-usuarios | — (interno) | — |
| ms-frontend-landing | — (interno) | — |
| ms-salas | — (interno) | — |

Frontend aparte:

```powershell
npm run dev
```

Vite proxyea `/api` → `http://localhost:3000` (ver `vite.config.ts`).

## Opción B — Todo en local

### 1. PostgreSQL

Crear base y usuario:

```sql
CREATE USER "2mino" WITH PASSWORD '2minodev';
CREATE DATABASE "2mino" OWNER "2mino";
```

Los scripts `dev.ps1` usan:

```
postgres://2mino:2minodev@localhost:5432/2mino
```

### 2. Microservicios (orden sugerido)

Cada uno en su propia terminal:

```powershell
.\ms-usuarios\dev.ps1          # :4000
.\ms-frontend-landing\dev.ps1  # :5000
.\ms-salas\dev.ps1             # :6001
.\api-integracion\dev.ps1      # :3000
```

> **Nota de puertos:** `ms-salas` corre en **6001** tanto en desarrollo local como en Docker Compose (el puerto 6000 está bloqueado por el `fetch`/undici de Node — está en la lista de puertos "inseguros", igual que en los navegadores).

### 3. Frontend

```powershell
npm run dev
```

Abrir http://localhost:5173

## Primer usuario

1. Ir a la pantalla de registro.
2. Crear cuenta → se asigna al segmento `tester` (todas las features habilitadas).
3. El JWT se guarda según la opción "recordarme" del login.

Para reset de contraseña en dev, con `ENABLE_EMAIL=false`, la API puede devolver `_dev_token` en la respuesta de forgot-password.

## Convenciones de código

### Frontend

- Vistas gestionadas por estado en `App.tsx` (sin React Router).
- Tipos de API centralizados en `src/api.ts`.
- Estilos globales en `src/styles.css` (variables CSS para tema dark/light).
- Componentes de juego en `src/components/game/`.

### Backend

- Fastify con schemas OpenAPI en cada ruta.
- Migraciones inline en `src/db/pool.ts` de cada MS.
- Comunicación entre servicios vía HTTP (`api-integracion/src/http.ts` → `callMs`).

### Idioma

- Código y comentarios en español.
- Mensajes de error al usuario en español.

## Build de producción

```powershell
# Frontend
npm run build    # salida en dist/

# Cada microservicio
npm run build --prefix api-integracion
npm run start --prefix api-integracion
```

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `ECONNREFUSED` en `/api` | Verificar que `api-integracion` esté en :3000 |
| Error de DB al arrancar MS | Comprobar PostgreSQL y credenciales en `DB_URL` |
| CORS en producción | Definir `CORS_ORIGIN` con el dominio exacto del frontend |
| JWT inválido | Regenerar `JWT_SECRET`; los tokens previos dejan de valer |
| ms-salas no responde | Confirmar que corre en el puerto 6001 |

## Branches

Convención sugerida:

```
feature/<area>-<descripcion>
fix/<descripcion>
```

Ejemplo: `feature/frontend-pantalla-juego`
