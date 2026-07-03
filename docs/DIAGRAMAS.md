# Diagramas

Diagramas Mermaid del proyecto 2mino.

---

## Integración de servicios

Vista de cómo se conectan el frontend, el gateway público, los microservicios internos y la base de datos.

```mermaid
flowchart TB
    subgraph Cliente["Cliente (navegador)"]
        FE["Frontend React<br/><b>Vite :5173</b><br/>SPA · tema dark/light"]
    end

    subgraph Gateway["Punto de entrada público"]
        API["api-integracion<br/><b>:3000</b><br/>JWT · CORS · OpenAPI /docs"]
    end

    subgraph Microservicios["Microservicios internos"]
        MU["ms-usuarios<br/><b>:4000</b><br/>Identidad y credenciales"]
        MFL["ms-frontend-landing<br/><b>:5000</b><br/>Landing y preferencias UI"]
        MS["ms-salas<br/><b>:6001</b><br/>Salas y partidas"]
    end

    subgraph Persistencia["Persistencia"]
        PG[("PostgreSQL<br/><b>:5432</b><br/>Base de datos 2mino")]
    end

    FE -->|"HTTP /api/*<br/>Authorization: Bearer JWT"| API

    API -->|"/auth/register<br/>/auth/login<br/>/auth/forgot-password<br/>/auth/me"| MU
    API -->|"/frontend/config<br/>/frontend/preferencias"| MFL
    API -->|"/salas/*<br/>/salas/:id/juego/*"| MS

    API -.->|"Emite JWT tras login/register<br/>Valida JWT en rutas protegidas"| API

    MU -->|"usuarios<br/>segmentos<br/>reset_tokens"| PG
    MFL -->|"landing_config<br/>frontend_overrides"| PG
    MS -->|"salas<br/>sala_jugadores<br/>juegos"| PG

    classDef public fill:#1e3a5f,stroke:#60a5fa,color:#e2e8f0
    classDef internal fill:#1a2e1a,stroke:#4ade80,color:#e2e8f0
    classDef data fill:#3b2f1a,stroke:#fbbf24,color:#e2e8f0
    classDef client fill:#2d1b4e,stroke:#a855f7,color:#e2e8f0

    class FE client
    class API public
    class MU,MFL,MS internal
    class PG data
```

### Leyenda

| Elemento | Rol |
|----------|-----|
| **Frontend** | SPA React; en dev proxyea `/api` → `api-integracion:3000` |
| **api-integracion** | Único servicio expuesto al navegador; orquesta y autentica |
| **ms-usuarios** | Registro, login, bcrypt, tokens de reset |
| **ms-frontend-landing** | Config global del landing + overrides por usuario |
| **ms-salas** | Salas multijugador y lógica autoritativa del dominó |
| **PostgreSQL** | Base compartida; cada MS ejecuta sus migraciones al arrancar |

### Flujo de una petición autenticada

```mermaid
sequenceDiagram
    autonumber
    participant FE as Frontend
    participant API as api-integracion
    participant MS as Microservicio
    participant PG as PostgreSQL

    FE->>API: POST /api/salas/:id/juego/jugar<br/>Bearer JWT + body
    API->>API: Verificar JWT (sub, username)
    API->>MS: POST /salas/:id/juego/jugar<br/>+ headers internos
    MS->>PG: Leer / actualizar estado partida
    PG-->>MS: Estado persistido
    MS-->>API: PartidaPublica (sin manos ajenas)
    API-->>FE: 200 JSON
```

### Entornos

| Entorno | Frontend | API pública | MS internos | Postgres expuesto |
|---------|----------|-------------|-------------|-------------------|
| **Docker Compose** | `npm run dev` aparte | `:3000` | Solo red Docker | `:5432` (debug) |
| **Local (dev.ps1)** | `:5173` | `:3000` | `:4000`, `:5000`, `:6001` | `:5432` |
