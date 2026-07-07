$env:PORT             = "6200"
$env:DB_URL           = "postgres://2mino:2minodev@localhost:5432/2mino"
$env:NODE_ENV         = "development"
$env:JWT_SECRET       = "dev-secret-change-in-production"
$env:MS_USUARIOS_URL  = "http://localhost:4000"
$env:MS_SALAS_URL     = "http://localhost:6001"
npx tsx watch src/index.ts
