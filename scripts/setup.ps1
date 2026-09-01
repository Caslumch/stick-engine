# ============================================================
# Setup completo do Jarvis numa maquina nova (Windows).
#
#   powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
#
# Idempotente: pode rodar de novo sem quebrar nada.
# Tauri e opcional (precisa de ~6GB de MSVC Build Tools):
#   powershell -ExecutionPolicy Bypass -File scripts/setup.ps1 -WithTauri
# ============================================================

param(
    [switch]$WithTauri,
    [string]$OpenAiKey = ""
)

# Continue, nao Stop: varias ferramentas (docker, pnpm, prisma) escrevem no
# stderr mesmo quando dao certo. Cada passo checa $LASTEXITCODE explicitamente.
$ErrorActionPreference = "Continue"
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$script:failed = @()
function Step($n, $msg) { Write-Host "`n[$n] $msg" -ForegroundColor Yellow }
function Ok($msg)       { Write-Host "  OK  $msg" -ForegroundColor Green }
function Warn($msg)     { Write-Host "  --  $msg" -ForegroundColor DarkYellow }
function Fail($msg)     { Write-Host "  !!  $msg" -ForegroundColor Red; $script:failed += $msg }

function Get-Winget {
    $w = Get-Command winget -EA SilentlyContinue
    if ($w) { return $w.Source }
    $p = "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe"
    if (Test-Path $p) { return $p }
    return $null
}

Write-Host "=== Setup Jarvis ===" -ForegroundColor Cyan
Write-Host "Repo: $repo" -ForegroundColor Gray
$winget = Get-Winget

# --- 1. Pre-requisitos -------------------------------------------------
Step 1 "Verificando pre-requisitos"

if (Get-Command node -EA SilentlyContinue) { Ok "Node $(node -v)" }
else { Fail "Node.js ausente - instale Node >= 20: https://nodejs.org" }

if (Get-Command pnpm -EA SilentlyContinue) { Ok "pnpm $(pnpm -v)" }
else {
    Warn "pnpm ausente - instalando via corepack"
    try { corepack enable; corepack prepare pnpm@latest --activate; Ok "pnpm instalado" }
    catch { Fail "Falha ao instalar pnpm - rode: npm install -g pnpm" }
}

$dockerOk = $false
if (Get-Command docker -EA SilentlyContinue) {
    docker info *>$null
    if ($LASTEXITCODE -eq 0) { $dockerOk = $true; Ok "Docker rodando" }
    else { Fail "Docker instalado mas nao esta rodando - abra o Docker Desktop" }
} else { Fail "Docker ausente - https://docker.com/products/docker-desktop" }

# --- 2. Python (venvs dos servicos de voz) ------------------------------
Step 2 "Python para TTS e wake word"

$py = $null
foreach ($c in @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
                 "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe")) {
    if (Test-Path $c) { $py = $c; break }
}
if (-not $py) {
    $g = Get-Command python -EA SilentlyContinue
    # ignorar o stub da Microsoft Store, que nao e Python de verdade
    if ($g -and $g.Source -notlike "*WindowsApps*") { $py = $g.Source }
}

if (-not $py) {
    if ($winget) {
        Warn "Python ausente - instalando 3.12 (alguns minutos)"
        & $winget install --id Python.Python.3.12 -e --scope user `
            --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Null
        $cand = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
        if (Test-Path $cand) { $py = $cand; Ok "Python instalado" }
    }
    if (-not $py) { Fail "Python ausente - instale 3.12: https://python.org" }
}
if ($py) { Ok "Python $(& $py --version 2>&1)" }

# Um venv por servico. So o TTS e necessario pra voz; wakeword e extra.
function New-ServiceVenv($name, $packages) {
    if (-not $py) { return }
    $dir   = Join-Path $repo "services\$name"
    $vpy   = Join-Path $dir ".venv\Scripts\python.exe"
    if (-not (Test-Path $dir)) { Warn "services/$name nao existe - pulando"; return }
    if (-not (Test-Path $vpy)) {
        Write-Host "  criando venv de $name..." -ForegroundColor Gray
        & $py -m venv (Join-Path $dir ".venv")
    }
    Write-Host "  instalando deps de $name (pode demorar)..." -ForegroundColor Gray
    & $vpy -m pip install --upgrade pip --quiet 2>&1 | Out-Null
    & $vpy -m pip install --quiet @packages 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "$name pronto" } else { Fail "Falha nas deps de $name" }
}

# Edge TTS so precisa destes. kokoro/qwen sao lazy-loaded: instale a mao se for usar.
New-ServiceVenv "tts"      @("fastapi", "uvicorn[standard]", "edge-tts", "numpy")
New-ServiceVenv "wakeword" @("openwakeword", "fastapi", "uvicorn[standard]", "numpy", "sounddevice", "websockets")

# Modelos do openwakeword nao baixam sozinhos na primeira carga
$wwPy = Join-Path $repo "services\wakeword\.venv\Scripts\python.exe"
if (Test-Path $wwPy) {
    Write-Host "  baixando modelos de wake word..." -ForegroundColor Gray
    & $wwPy -c "import openwakeword; openwakeword.utils.download_models()" 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Ok "modelos de wake word" } else { Warn "modelos nao baixaram - o wake word pode falhar" }
}

# --- 3. Dependencias Node ----------------------------------------------
Step 3 "Instalando dependencias Node"
pnpm install
if ($LASTEXITCODE -eq 0) { Ok "pnpm install" } else { Fail "pnpm install falhou" }

# --- 4. .env da API ----------------------------------------------------
Step 4 "Configurando apps/api/.env"
$envFile = Join-Path $repo "apps\api\.env"
if (Test-Path $envFile) {
    Ok ".env ja existe (nao sobrescrito)"
} else {
    $lines = @(
        'DATABASE_URL="postgresql://jarvis:jarvis@localhost:5432/jarvis?schema=public"'
        'OLLAMA_URL="http://localhost:11434"'
        'OLLAMA_MODEL="qwen2.5"'
    )
    if ($OpenAiKey) { $lines += "OPENAI_API_KEY=`"$OpenAiKey`""; $lines += 'OPENAI_MODEL="gpt-4o"' }
    else           { $lines += '# OPENAI_API_KEY="sk-..."'; $lines += '# OPENAI_MODEL="gpt-4o"' }
    Set-Content -Path $envFile -Value $lines -Encoding utf8
    Ok ".env criado"
    if (-not $OpenAiKey) { Warn "Sem LLM configurado: instale o Ollama ou adicione OPENAI_API_KEY no .env" }
}

# --- 5. Banco ----------------------------------------------------------
Step 5 "Subindo banco e aplicando schema"
if ($dockerOk) {
    # docker compose escreve progresso no stderr mesmo quando da certo;
    # sem isso o $ErrorActionPreference="Stop" mataria o script.
    docker compose up -d *>$null
    if ($LASTEXITCODE -eq 0) { Ok "Postgres + Redis" } else { Fail "docker compose up falhou" }
    # o Postgres aceita conexao alguns segundos depois do container subir
    $ready = $false
    foreach ($i in 1..30) {
        docker exec jarvis-postgres pg_isready -U jarvis *>$null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { Warn "Postgres demorou a responder - o db push pode falhar" }

    Push-Location (Join-Path $repo "apps\api")
    $push = & npx prisma db push 2>&1
    $pushText = $push -join "`n"
    Write-Host $pushText -ForegroundColor Gray
    if ($pushText -match "in sync|already in sync") {
        Ok "schema aplicado"
        # o generate pode falhar com EPERM se um dev server estiver segurando a DLL
        if ($pushText -match "EPERM") { Warn "Prisma Client nao regenerou (arquivo em uso) - pare o 'pnpm dev' e rode: cd apps/api; npx prisma generate" }
    } else {
        Fail "prisma db push falhou"
    }
    Pop-Location
} else {
    Warn "Docker indisponivel - pulei o banco"
}

# --- 6. Tauri (opcional) -----------------------------------------------
if ($WithTauri) {
    Step 6 "Tauri (Rust + MSVC)"
    if (Test-Path "$env:USERPROFILE\.cargo\bin\rustc.exe") {
        Ok "Rust $(& "$env:USERPROFILE\.cargo\bin\rustc.exe" --version)"
    } elseif ($winget) {
        Warn "instalando Rust..."
        & $winget install --id Rustlang.Rustup -e --accept-source-agreements --accept-package-agreements --disable-interactivity | Out-Null
        & "$env:USERPROFILE\.cargo\bin\rustup.exe" default stable | Out-Null
        Ok "Rust instalado"
    } else { Fail "winget ausente - instale o Rust manualmente: https://rustup.rs" }

    $vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    $hasMsvc = (Test-Path $vswhere) -and (& $vswhere -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property displayName 2>$null)
    if ($hasMsvc) {
        Ok "MSVC Build Tools"
    } elseif ($winget) {
        Warn "instalando MSVC Build Tools (~6GB, 20-40min)..."
        & $winget install --id Microsoft.VisualStudio.2022.BuildTools -e `
            --accept-source-agreements --accept-package-agreements --disable-interactivity `
            --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended" | Out-Null
        Ok "MSVC instalado"
    } else { Fail "winget ausente - instale o MSVC Build Tools manualmente" }

    Warn "Se a compilacao do Rust falhar, desative o Smart App Control:"
    Warn "  Seguranca do Windows > Controle de aplicativos e do navegador"

    $binaries = Join-Path $repo "apps\desktop\src-tauri\binaries\setup.ps1"
    if (Test-Path $binaries) { Warn "Binarios de voz (~300MB): powershell -ExecutionPolicy Bypass -File $binaries" }
} else {
    Step 6 "Tauri pulado (use -WithTauri para instalar)"
}

# --- Resumo ------------------------------------------------------------
Write-Host "`n=== Resumo ===" -ForegroundColor Cyan
if ($script:failed.Count -eq 0) {
    Write-Host "Tudo pronto." -ForegroundColor Green
} else {
    Write-Host "Pendencias:" -ForegroundColor Red
    foreach ($f in $script:failed) { Write-Host "  - $f" -ForegroundColor Red }
}
Write-Host ""
Write-Host "  pnpm dev:all    API + front + TTS + wake word" -ForegroundColor White
Write-Host "  pnpm dev        so API + front (voz cai no Web Speech)" -ForegroundColor White
Write-Host "  http://localhost:5173" -ForegroundColor Gray
Write-Host ""
