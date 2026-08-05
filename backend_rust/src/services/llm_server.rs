//! llm_server.rs — spawns and lifecycle-manages the local llama-server
//! (llama.cpp binary) in three mutually-exclusive modes, replacing Python's
//! `ai_orchestrator.py` / `agent/llm.py` (LlamaManager).
//!
//! Modes (ports match Python exactly):
//!   Agent  :9090 — Gemma 3.2 E4B (+mmproj)  — agent chat / stories
//!   Vision :9091 — Gemma 3.2 E2B (+mmproj)  — image captions + tags
//!   Ocr    :9092 — PaddleOCR-VL GGUF         — text extraction
//!
//! Only one mode runs at a time: starting a different mode kills the current
//! server (same mutual-exclusion as Python's AIOrchestrator).

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tracing::info;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum LlmMode {
    Agent,
    Vision,
    Ocr,
}

impl LlmMode {
    pub fn port(self) -> u16 {
        match self {
            LlmMode::Agent => 9090,
            LlmMode::Vision => 9091,
            LlmMode::Ocr => 9092,
        }
    }

    fn model(self, models_dir: &PathBuf) -> PathBuf {
        match self {
            LlmMode::Agent => models_dir.join("llm/gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf"),
            LlmMode::Vision => models_dir.join("llm/gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf"),
            LlmMode::Ocr => models_dir.join("PaddleOCR/PaddleOCR-VL-1.6-GGUF.gguf"),
        }
    }

    fn mmproj(self, models_dir: &PathBuf) -> PathBuf {
        match self {
            LlmMode::Agent => models_dir.join("llm/mmproj-BF16-E4B.gguf"),
            LlmMode::Vision => models_dir.join("llm/mmproj-BF16-E2B.gguf"),
            LlmMode::Ocr => models_dir.join("PaddleOCR/PaddleOCR-VL-1.6-GGUF-mmproj.gguf"),
        }
    }

    fn log_file(self) -> String {
        match self {
            LlmMode::Agent => "llm_server_agent.log",
            LlmMode::Vision => "llm_server_vision.log",
            LlmMode::Ocr => "llm_server_ocr.log",
        }
        .to_string()
    }
}

struct Inner {
    mode: Option<LlmMode>,
    child: Option<Child>,
}

/// Shared handle to the single (mutually exclusive) llama-server process.
#[derive(Clone)]
pub struct LlmServer {
    inner: Arc<Mutex<Inner>>,
    models_dir: PathBuf,
    gpu_mode: String,
    http: reqwest::Client,
}

impl LlmServer {
    pub fn new(models_dir: PathBuf, gpu_mode: String) -> Arc<Self> {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()
            .unwrap_or_else(|_| reqwest::Client::new());

        Arc::new(LlmServer {
            inner: Arc::new(Mutex::new(Inner { mode: None, child: None })),
            models_dir,
            gpu_mode,
            http,
        })
    }

    /// Ensures the given mode is running and returns its base URL.
    pub async fn base_url(&self, mode: LlmMode) -> Result<String, String> {
        let port = self.ensure_running(mode).await?;
        Ok(format!("http://127.0.0.1:{port}"))
    }

    /// Kills the running llama-server, if any (SIGKILL — it is a stateless server).
    pub async fn stop(&self) {
        let mut inner = self.inner.lock().await;
        if let Some(mut child) = inner.child.take() {
            info!("[LlmServer] Stopping llama-server ({:?})", inner.mode);
            child.start_kill().ok();
            let _ = child.wait().await;
        }
        inner.mode = None;
    }

    async fn ensure_running(&self, mode: LlmMode) -> Result<u16, String> {
        {
            let mut inner = self.inner.lock().await;
            if inner.mode == Some(mode) {
                if let Some(child) = &mut inner.child {
                    if child.try_wait().map_err(|e| e.to_string())?.is_none() {
                        return Ok(mode.port());
                    }
                }
            }
        }

        // Different mode (or dead process) → restart (mutual exclusion).
        self.stop().await;
        self.spawn(mode).await
    }

    async fn spawn(&self, mode: LlmMode) -> Result<u16, String> {
        let model_path = mode.model(&self.models_dir);
        if !model_path.exists() {
            return Err(format!(
                "llama-server model not found: {}",
                model_path.to_string_lossy()
            ));
        }

        let port = mode.port();
        let ngl = if self.gpu_mode == "cpu" { "0" } else { "999" };

        let mut cmd = Command::new("llama-server");
        cmd.arg("-m").arg(&model_path)
            .arg("--host").arg("0.0.0.0")
            .arg("--port").arg(port.to_string())
            .arg("-ngl").arg(ngl)
            .arg("-c").arg("8192")
            .arg("-np").arg("1");

        let mmproj_path = mode.mmproj(&self.models_dir);
        if mmproj_path.exists() {
            cmd.arg("--mmproj").arg(&mmproj_path).arg("--no-mmproj-offload");
        }

        if self.gpu_mode != "cpu" {
            cmd.args(["--flash-attn", "on", "-ctk", "q8_0", "-ctv", "q8_0", "-fit", "off"]);
        }

        // Python inherited LD_LIBRARY_PATH with CUDA prepended; replicate.
        if self.gpu_mode != "cpu" {
            let cur = std::env::var("LD_LIBRARY_PATH").unwrap_or_default();
            if !cur.contains("/usr/local/cuda/lib64") {
                cmd.env("LD_LIBRARY_PATH", format!("/usr/local/cuda/lib64:{}", cur));
            }
        }

        // Capture stderr to a log file + stream lines into tracing.
        let log_file = std::fs::File::create(mode.log_file()).unwrap_or_else(|_| {
            std::fs::File::open("/dev/null").expect("failed to open /dev/null")
        });
        cmd.stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::from(log_file))
            .kill_on_drop(true);

        info!(
            "[LlmServer] Starting llama-server ({mode:?}) on :{port}: {}",
            model_path.to_string_lossy()
        );

        let mut child = cmd.spawn().map_err(|e| {
            format!("failed to spawn llama-server for {mode:?}: {e} (is llama-server on PATH?)")
        })?;

        // Health wait (model load can take a while).
        let health_url = format!("http://127.0.0.1:{port}/health");
        for _ in 0..60 {
            if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
                return Err(format!(
                    "llama-server ({mode:?}) exited during startup with code {status}; check {}",
                    mode.log_file()
                ));
            }
            match self.http.get(&health_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    info!("[LlmServer] llama-server ({mode:?}) ready on :{port}");
                    *self.inner.lock().await = Inner { mode: Some(mode), child: Some(child) };
                    return Ok(port);
                }
                _ => tokio::time::sleep(Duration::from_secs(1)).await,
            }
        }

        child.start_kill().ok();
        Err(format!(
            "llama-server ({mode:?}) failed to become healthy on :{port}; check {}",
            mode.log_file()
        ))
    }
}
