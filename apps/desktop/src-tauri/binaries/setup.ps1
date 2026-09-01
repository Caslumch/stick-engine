# Setup script — baixa whisper.cpp, piper e modelos de voz
# Rodar: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"
$binDir = $PSScriptRoot
$modelsDir = Join-Path $binDir "models"

New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null

# --- Whisper.cpp ---
$whisperVersion = "v1.9.1"
$whisperZip = Join-Path $binDir "whisper-bin.zip"
$whisperExe = Join-Path $binDir "whisper-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $whisperExe)) {
    Write-Host "Baixando whisper.cpp $whisperVersion..."
    $whisperUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/$whisperVersion/whisper-bin-Win32.zip"
    Invoke-WebRequest -Uri $whisperUrl -OutFile $whisperZip
    Expand-Archive -Path $whisperZip -DestinationPath "$binDir\whisper-tmp" -Force

    # Encontrar whisper-cli.exe (main.exe é deprecated)
    $mainExe = Get-ChildItem "$binDir\whisper-tmp" -Recurse -Filter "whisper-cli.exe" |
        Select-Object -First 1

    if ($mainExe) {
        Copy-Item $mainExe.FullName $whisperExe -Force
        Write-Host "  -> $($mainExe.Name) copiado como whisper sidecar"
    } else {
        # Listar o que tem pra debug
        Write-Host "  Executaveis encontrados:"
        Get-ChildItem "$binDir\whisper-tmp" -Recurse -Filter "*.exe" | ForEach-Object { Write-Host "    $($_.FullName)" }
        throw "Nenhum executavel whisper encontrado"
    }

    # Copiar DLLs necessárias (se houver)
    Get-ChildItem "$binDir\whisper-tmp" -Recurse -Filter "*.dll" | ForEach-Object {
        Copy-Item $_.FullName $binDir -Force
        Write-Host "  -> DLL: $($_.Name)"
    }

    Remove-Item "$binDir\whisper-tmp" -Recurse -Force
    Remove-Item $whisperZip -Force
    Write-Host "  Whisper OK"
} else {
    Write-Host "Whisper ja existe, pulando."
}

# --- Modelo Whisper (base — 148MB) ---
# base em vez de small: ~2.7s contra ~10s na mesma frase, com precisao
# equivalente em pt-BR. Pra usar o small: WHISPER_MODEL=ggml-small.bin
$whisperModel = Join-Path $modelsDir "ggml-base.bin"
if (-not (Test-Path $whisperModel)) {
    Write-Host "Baixando modelo Whisper base (~148MB)..."
    $modelUrl = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
    Invoke-WebRequest -Uri $modelUrl -OutFile $whisperModel
    Write-Host "  Modelo Whisper OK"
} else {
    Write-Host "Modelo Whisper ja existe, pulando."
}

# --- Piper ---
$piperZip = Join-Path $binDir "piper.zip"
$piperExe = Join-Path $binDir "piper-x86_64-pc-windows-msvc.exe"

if (-not (Test-Path $piperExe)) {
    Write-Host "Baixando Piper TTS..."
    $piperUrl = "https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip"
    Invoke-WebRequest -Uri $piperUrl -OutFile $piperZip
    Expand-Archive -Path $piperZip -DestinationPath "$binDir\piper-tmp" -Force

    $pExe = Get-ChildItem "$binDir\piper-tmp" -Recurse -Filter "piper.exe" | Select-Object -First 1
    if ($pExe) {
        Copy-Item $pExe.FullName $piperExe -Force
        Write-Host "  -> piper.exe copiado como piper sidecar"
    } else {
        throw "piper.exe nao encontrado"
    }

    # Copiar DLLs e libs do piper
    Get-ChildItem "$binDir\piper-tmp" -Recurse -Filter "*.dll" | ForEach-Object {
        Copy-Item $_.FullName $binDir -Force
        Write-Host "  -> DLL: $($_.Name)"
    }
    # espeak-ng-data é necessário pro piper
    $espeakData = Get-ChildItem "$binDir\piper-tmp" -Recurse -Directory | Where-Object { $_.Name -eq "espeak-ng-data" } | Select-Object -First 1
    if ($espeakData) {
        Copy-Item $espeakData.FullName $binDir -Recurse -Force
        Write-Host "  -> espeak-ng-data copiado"
    }

    Remove-Item "$binDir\piper-tmp" -Recurse -Force
    Remove-Item $piperZip -Force
    Write-Host "  Piper OK"
} else {
    Write-Host "Piper ja existe, pulando."
}

# --- Voz pt-BR para Piper (faber medium) ---
$voiceModel = Join-Path $modelsDir "pt_BR-faber-medium.onnx"
$voiceConfig = Join-Path $modelsDir "pt_BR-faber-medium.onnx.json"

if (-not (Test-Path $voiceModel)) {
    Write-Host "Baixando voz pt-BR (faber medium)..."
    $voiceUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx"
    $configUrl = "https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json"
    Invoke-WebRequest -Uri $voiceUrl -OutFile $voiceModel
    Invoke-WebRequest -Uri $configUrl -OutFile $voiceConfig
    Write-Host "  Voz pt-BR OK"
} else {
    Write-Host "Voz pt-BR ja existe, pulando."
}

Write-Host ""
Write-Host "Setup completo!"
Write-Host "  Whisper: $whisperExe"
Write-Host "  Piper:   $piperExe"
Write-Host "  Modelos: $modelsDir"
