# Reconstruit dist/ et relance le serveur de recette (port 4100, base barreau_pn_test).
# À exécuter après chaque lot de commits, AVANT toute recette : sinon le serveur et dist/ sont périmés.
$ErrorActionPreference = "Stop"
$racine = Split-Path $PSScriptRoot -Parent
$port = 4100
Set-Location $racine
$test = (Get-Content "$racine\server\.env" | Where-Object { $_ -match '^TEST_DATABASE_URL=' }) -replace '^TEST_DATABASE_URL=', '' -replace '"', ''
if (-not $test) { throw "TEST_DATABASE_URL absent de server/.env" }

# Arrêt de l'ancien serveur de recette
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

npm run build
if ($LASTEXITCODE) { throw "build front en échec" }
Push-Location server
$env:DATABASE_URL = $test
npx prisma generate
npx prisma migrate deploy
if ($LASTEXITCODE) { throw "migrate deploy en échec" }
$env:PORT = "$port"
$env:STATIC_DIR = "$racine\dist"
$p = Start-Process -FilePath npm.cmd -ArgumentList "start" -WindowStyle Hidden -PassThru
Pop-Location

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep 1
  try { if ((Invoke-WebRequest "http://localhost:$port/api/health" -UseBasicParsing).StatusCode -eq 200) { "OK http://localhost:$port (HEAD $(git rev-parse --short HEAD))"; return } } catch {}
}
throw "le serveur ne répond pas sur $port"
