$env:PORT         = "5000"
$env:DB_URL       = "postgres://2mino:2minodev@localhost:5432/2mino"
$env:NODE_ENV     = "development"
$env:ENABLE_EMAIL = "false"
npx tsx watch src/index.ts
