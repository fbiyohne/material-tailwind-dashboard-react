# Reconstruit dist/ et relance le serveur de recette (port 4100, base barreau_pn_test).
# -Demo : instance du congrès (port 4200, base barreau_pn_demo, non partagée avec les suites de tests, R1-13).
param([switch]$Demo)
# À exécuter après chaque lot de commits, AVANT toute recette : sinon le serveur et dist/ sont périmés.
# Continue : sous PowerShell 5.1, tout écrit sur stderr par un exécutable natif (prisma generate, npm)
# devient une erreur terminale avec Stop. Les échecs sont détectés par $LASTEXITCODE après chaque commande.
$ErrorActionPreference = "Continue"
$racine = Split-Path $PSScriptRoot -Parent
$port = 4100
Set-Location $racine
$test = (Get-Content "$racine\server\.env" | Where-Object { $_ -match '^TEST_DATABASE_URL=' }) -replace '^TEST_DATABASE_URL=', '' -replace '"', ''
if ($test -notmatch '/barreau_pn_test(\?|$)') { throw "TEST_DATABASE_URL doit viser barreau_pn_test (lu : base différente ou absente)" }
if ($Demo) { $test = $test -replace '/barreau_pn_test(\?|$)', '/barreau_pn_demo$1'; $port = 4200 }

# Arrêt de l'ancien serveur de recette
Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

npm run build
if ($LASTEXITCODE) { throw "build front en échec" }
Push-Location server
$env:DATABASE_URL = $test
npx prisma generate
if ($LASTEXITCODE) { throw "prisma generate en échec" }
npx prisma migrate deploy
if ($LASTEXITCODE) { throw "migrate deploy en échec" }
$env:PORT = "$port"
$env:HOST = "127.0.0.1"   # instance de test joignable depuis ce poste seulement
$env:STATIC_DIR = "$racine\dist"
$p = Start-Process -FilePath npm.cmd -ArgumentList "start" -WindowStyle Hidden -PassThru
Pop-Location

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep 1
  try { if ((Invoke-WebRequest "http://localhost:$port/api/health" -UseBasicParsing).StatusCode -eq 200) { "OK http://localhost:$port (HEAD $(git rev-parse --short HEAD))"; return } } catch {}
}
throw "le serveur ne répond pas sur $port"
