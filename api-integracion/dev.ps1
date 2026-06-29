$env:PORT                    = "3000"
$env:MS_USUARIOS_URL         = "http://localhost:4000"
$env:MS_FRONTEND_LANDING_URL = "http://localhost:5000"
$env:MS_SALAS_URL            = "http://localhost:6001"
$env:JWT_SECRET              = "dev-local-secret-2mino"
$env:CORS_ORIGIN             = "*"
$env:NODE_ENV                = "development"
npx tsx watch src/index.ts
