$env:PORT     = "6001"
$env:DB_URL   = "postgres://2mino:2minodev@localhost:5432/2mino"
$env:NODE_ENV = "development"
npx tsx watch src/index.ts
