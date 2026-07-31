use base64::{engine::general_purpose::STANDARD, Engine};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;
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
    let exe_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Erro: {}", e))?;

    let bin_name = format!("{}-x86_64-pc-windows-msvc.exe", name);

    // Produção
    let prod_path = exe_dir.join(&bin_name);
    if prod_path.exists() {
        return Ok(prod_path);
    }

    // Dev
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
    let prod = resource_path(app, &format!("binaries/models/{}", model))?;
    if prod.exists() {
        return Ok(prod);
    }

    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("models")
        .join(model);
    if dev.exists() {
        return Ok(dev);
    }

    Err(format!("Modelo '{}' não encontrado", model))
}

/// Executa um comando com timeout. Mata o processo se exceder.
fn run_with_timeout(child: std::process::Child, timeout: Duration) -> Result<std::process::Output, String> {
    use std::sync::mpsc;
    use std::thread;

    let (tx, rx) = mpsc::channel();

    let handle = thread::spawn(move || {
        let output = child.wait_with_output();
        let _ = tx.send(output);
    });

    match rx.recv_timeout(timeout) {
        Ok(result) => {
            let _ = handle.join();
            result.map_err(|e| format!("Erro ao aguardar processo: {}", e))
        }
        Err(_) => {
            // Timeout — a thread ainda está rodando com o processo
            // O processo será morto quando o Child for dropado na thread
            Err("Timeout: processo demorou demais e foi encerrado".to_string())
        }
    }
}

/// STT: recebe áudio WAV em base64, retorna transcrição
/// Timeout: 30 segundos
#[tauri::command]
pub async fn transcribe(app: tauri::AppHandle, audio_b64: String) -> Result<String, String> {
    let audio_bytes = STANDARD
        .decode(&audio_b64)
        .map_err(|e| format!("Erro ao decodificar áudio: {}", e))?;

    let tmp_dir = std::env::temp_dir();
    let wav_path = tmp_dir.join("jarvis_stt_input.wav");
    std::fs::write(&wav_path, &audio_bytes)
        .map_err(|e| format!("Erro ao salvar áudio: {}", e))?;

    let whisper = sidecar_path(&app, "whisper")?;
    let model = model_path(&app, "ggml-small.bin")?;

    let child = Command::new(&whisper)
        .args([
            "-m", model.to_str().unwrap(),
            "-f", wav_path.to_str().unwrap(),
            "-l", "pt",
            "--no-timestamps",
            "-nt",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Erro ao executar whisper: {}", e))?;

    let output = run_with_timeout(child, Duration::from_secs(30))?;

    let _ = std::fs::remove_file(&wav_path);

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!("Whisper falhou (exit {}): stderr={} stdout={}",
            output.status.code().unwrap_or(-1), stderr, stdout));
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(text)
}

/// TTS: recebe texto, retorna áudio WAV em base64.
/// Tenta Qwen3-TTS (localhost:5001) primeiro, fallback pro Piper sidecar.
#[tauri::command]
pub async fn speak(app: tauri::AppHandle, text: String) -> Result<String, String> {
    // Tentar Qwen3-TTS via HTTP
    match speak_qwen(&text) {
        Ok(wav_bytes) => return Ok(STANDARD.encode(&wav_bytes)),
        Err(e) => {
            log::warn!("Qwen3-TTS indisponível ({}), usando Piper como fallback", e);
        }
    }

    // Fallback: Piper sidecar
    speak_piper(&app, &text)
}

/// Chama o servidor Qwen3-TTS em localhost:5001
fn speak_qwen(text: &str) -> Result<Vec<u8>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("HTTP client: {}", e))?;

    let resp = client
        .post("http://localhost:5001/speak")
        .json(&serde_json::json!({
            "text": text,
            "language": "Portuguese",
            "speaker": "ryan"
        }))
        .send()
        .map_err(|e| format!("Conexão: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    resp.bytes()
        .map(|b| b.to_vec())
        .map_err(|e| format!("Leitura: {}", e))
}

/// Fallback: Piper sidecar (timeout 15s)
fn speak_piper(app: &tauri::AppHandle, text: &str) -> Result<String, String> {
    let piper = sidecar_path(app, "piper")?;
    let voice = model_path(app, "pt_BR-faber-medium.onnx")?;

    let tmp_dir = std::env::temp_dir();
    let wav_path = tmp_dir.join("jarvis_tts_output.wav");

    let mut child = Command::new(&piper)
        .args([
            "--model", voice.to_str().unwrap(),
            "--output_file", wav_path.to_str().unwrap(),
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Erro ao executar piper: {}", e))?;

    {
        use std::io::Write;
        if let Some(ref mut stdin) = child.stdin.take() {
            stdin.write_all(text.as_bytes())
                .map_err(|e| format!("Erro ao enviar texto ao piper: {}", e))?;
        }
    }

    let output = run_with_timeout(child, Duration::from_secs(15))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Piper falhou: {}", stderr));
    }

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
    let whisper_model_ok = model_path(&app, "ggml-small.bin").is_ok();
    let piper_model_ok = model_path(&app, "pt_BR-faber-medium.onnx").is_ok();

    Ok(serde_json::json!({
        "whisper": whisper_ok,
        "piper": piper_ok,
        "whisperModel": whisper_model_ok,
        "piperModel": piper_model_ok,
        "ready": whisper_ok && piper_ok && whisper_model_ok && piper_model_ok
    }))
}
