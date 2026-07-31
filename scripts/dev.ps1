# Sobe todos os serviços de desenvolvimento
# Uso: powershell -File scripts/dev.ps1

Write-Host "=== Jarvis AI - Dev ===" -ForegroundColor Cyan

# 1. Docker (Postgres + Redis)
Write-Host "`n[1/3] Subindo banco de dados..." -ForegroundColor Yellow
docker compose up -d 2>&1 | Out-Null
Write-Host "  Postgres + Redis OK" -ForegroundColor Green

# 2. TTS Server (Qwen3-TTS)
Write-Host "[2/3] Subindo servidor TTS (Qwen3-TTS)..." -ForegroundColor Yellow
$ttsJob = Start-Process python -ArgumentList "services/tts/server.py" -PassThru -WindowStyle Minimized
Write-Host "  TTS server PID: $($ttsJob.Id) (rodando em background)" -ForegroundColor Green

# Esperar TTS ficar pronto (max 120s)
Write-Host "  Aguardando modelo carregar..." -ForegroundColor Gray
$ready = $false
for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:5001/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
        if ($resp.StatusCode -eq 200) {
            $ready = $true
            break
        }
    } catch {}
}
if ($ready) {
    Write-Host "  Qwen3-TTS pronto!" -ForegroundColor Green
} else {
    Write-Host "  TTS ainda carregando (vai ficar pronto em breve)" -ForegroundColor Yellow
}

# 3. Backend + Frontend (Turborepo)
Write-Host "[3/3] Subindo backend + frontend..." -ForegroundColor Yellow
Write-Host "  pnpm dev" -ForegroundColor Gray
Write-Host ""
pnpm dev
