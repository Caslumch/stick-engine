use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

/// Resolve path relativo ao diretório de recursos do app
fn resource_path(app: &tauri::AppHandle, relative: &str) -> Result<PathBuf, String> {
    app.path()
        .resource_dir()
        .map(|p| p.join(relative))
        .map_err(|e| format!("Erro ao resolver path de recurso: {}", e))
}

/// Resolve path do sidecar (binário externo)
fn sidecar_path(app: &tauri::AppHandle, name: &str) -> Result<PathBuf, String> {
    // Em dev, os binários estão em src-tauri/binaries/
    // Em produção, estão no diretório do executável
    let exe_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Erro: {}", e))?;

    // Tauri externalBin usa o sufixo da target triple
    let bin_name = format!("{}-x86_64-pc-windows-msvc.exe", name);

    // Tentar no resource dir (produção)
    let prod_path = exe_dir.join(&bin_name);
    if prod_path.exists() {
        return Ok(prod_path);
    }

    // Tentar no diretório binaries (dev)
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(&bin_name);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err(format!(
        "Sidecar '{}' não encontrado em {:?} nem {:?}",
        name, prod_path, dev_path
    ))
}

/// Resolve path de modelo
fn model_path(app: &tauri::AppHandle, model: &str) -> Result<PathBuf, String> {
    // Produção
    let prod = resource_path(app, &format!("binaries/models/{}", model))?;
    if prod.exists() {
        return Ok(prod);
    }

    // Dev
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("models")
        .join(model);
    if dev.exists() {
        return Ok(dev);
    }

    Err(format!("Modelo '{}' não encontrado", model))
}

/// STT: recebe áudio WAV em base64, retorna transcrição
#[tauri::command]
pub async fn transcribe(app: tauri::AppHandle, audio_b64: String) -> Result<String, String> {
    // Decodificar base64 para WAV
    let audio_bytes = STANDARD
        .decode(&audio_b64)
        .map_err(|e| format!("Erro ao decodificar áudio: {}", e))?;

    // Salvar em arquivo temporário
    let tmp_dir = std::env::temp_dir();
    let wav_path = tmp_dir.join("jarvis_stt_input.wav");
    std::fs::write(&wav_path, &audio_bytes)
        .map_err(|e| format!("Erro ao salvar áudio: {}", e))?;

    // Encontrar whisper e modelo
    let whisper = sidecar_path(&app, "whisper")?;
    let model = model_path(&app, "ggml-base.bin")?;

    // Executar whisper
    let output = Command::new(&whisper)
        .args([
            "-m",
            model.to_str().unwrap(),
            "-f",
            wav_path.to_str().unwrap(),
            "-l",
            "pt",
            "--no-timestamps",
            "-nt",
        ])
        .output()
        .map_err(|e| format!("Erro ao executar whisper: {}", e))?;

    // Limpar temp
    let _ = std::fs::remove_file(&wav_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Whisper falhou: {}", stderr));
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(text)
}

/// TTS: recebe texto, retorna áudio WAV em base64
#[tauri::command]
pub async fn speak(app: tauri::AppHandle, text: String) -> Result<String, String> {
    let piper = sidecar_path(&app, "piper")?;
    let voice = model_path(&app, "pt_BR-faber-medium.onnx")?;

    let tmp_dir = std::env::temp_dir();
    let wav_path = tmp_dir.join("jarvis_tts_output.wav");

    // Piper lê texto de stdin e escreve WAV no output_file
    let output = Command::new(&piper)
        .args([
            "--model",
            voice.to_str().unwrap(),
            "--output_file",
            wav_path.to_str().unwrap(),
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(ref mut stdin) = child.stdin {
                stdin.write_all(text.as_bytes())?;
            }
            child.wait_with_output()
        })
        .map_err(|e| format!("Erro ao executar piper: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Piper falhou: {}", stderr));
    }

    // Ler WAV e codificar em base64
    let wav_bytes = std::fs::read(&wav_path)
        .map_err(|e| format!("Erro ao ler áudio gerado: {}", e))?;

    let _ = std::fs::remove_file(&wav_path);

    Ok(STANDARD.encode(&wav_bytes))
}

/// Verifica se os sidecars estão disponíveis
#[tauri::command]
pub async fn voice_check(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let whisper_ok = sidecar_path(&app, "whisper").is_ok();
    let piper_ok = sidecar_path(&app, "piper").is_ok();
    let whisper_model_ok = model_path(&app, "ggml-base.bin").is_ok();
    let piper_model_ok = model_path(&app, "pt_BR-faber-medium.onnx").is_ok();

    Ok(serde_json::json!({
        "whisper": whisper_ok,
        "piper": piper_ok,
        "whisperModel": whisper_model_ok,
        "piperModel": piper_model_ok,
        "ready": whisper_ok && piper_ok && whisper_model_ok && piper_model_ok
    }))
}
