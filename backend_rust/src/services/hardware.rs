//! Hardware capability detection for AI feature gating.
//!
//! Produces a `HardwareProfile` describing GPU / VRAM / RAM / CPU so plugins
//! and the Model Router can decide which models fit on this machine
//! (e.g. a 4 GB VRAM laptop cannot host SDXL-class diffusion models).

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HardwareProfile {
    /// Human-readable GPU name ("NVIDIA GeForce RTX 2050", "Intel UHD Graphics",
    /// or "CPU only").
    pub gpu_name: String,
    /// Total VRAM in MB (0 when running CPU-only / iGPU without dedicated VRAM).
    pub vram_mb: u64,
    /// Total system RAM in MB.
    pub ram_mb: u64,
    /// CPU model string.
    pub cpu_model: String,
    /// Logical CPU thread count.
    pub cpu_threads: usize,
    /// Active compute backend derived from GPU_MODE: "cuda" | "cpu" | ...
    pub backend: String,
    /// Whether heavyweight (>2 GB VRAM) generative models can run locally.
    pub supports_heavyweight_generative: bool,
}

/// Read total system RAM (kB) from /proc/meminfo (Linux). Returns None elsewhere.
fn read_total_ram_kb() -> Option<u64> {
    let content = std::fs::read_to_string("/proc/meminfo").ok()?;
    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("MemTotal:") {
            let kb: u64 = rest.trim().trim_end_matches(" kB").replace(',', "").parse().ok()?;
            return Some(kb);
        }
    }
    None
}

/// Query the first NVIDIA GPU name + total VRAM (MB) via nvidia-smi.
fn query_nvidia_gpu() -> Option<(String, u64)> {
    let output = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let first_line = text.lines().next()?;
    let mut parts = first_line.split(',');
    let name = parts.next()?.trim().to_string();
    let mem_mb: u64 = parts.next()?.trim().parse().ok()?;
    if name.is_empty() || mem_mb == 0 {
        return None;
    }
    Some((name, mem_mb))
}

/// Detect the current hardware profile. Blocking syscalls/subprocesses are kept
/// minimal; call once per request via `tokio::task::spawn_blocking`.
pub fn detect(gpu_mode: &str) -> HardwareProfile {
    let (gpu_name, vram_mb) = match query_nvidia_gpu() {
        Some((name, mb)) => (name, mb),
        None => ("Integrated / CPU graphics".to_string(), 0),
    };

    let ram_mb = read_total_ram_kb().map(|kb| kb / 1024).unwrap_or(0);

    let cpu_model = std::fs::read_to_string("/proc/cpuinfo")
        .ok()
        .and_then(|info| {
            info.lines()
                .find(|l| l.starts_with("model name"))
                .and_then(|l| l.split(':').nth(1))
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let cpu_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(1);

    let has_cuda_gpu = vram_mb > 0 && gpu_name.to_lowercase().contains("nvidia");
    let backend = match gpu_mode {
        m if m.eq_ignore_ascii_case("cpu") => "cpu".to_string(),
        _ if has_cuda_gpu => "cuda".to_string(),
        m => m.to_lowercase(),
    };

    // Heuristic policy: heavyweight generative editing needs >= 8 GB VRAM
    // (quantized) — smaller GPUs must route to lightweight CV models instead.
    let supports_heavyweight_generative = has_cuda_gpu && vram_mb >= 8_000;

    HardwareProfile {
        gpu_name,
        vram_mb,
        ram_mb,
        cpu_model,
        cpu_threads,
        backend,
        supports_heavyweight_generative,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_a_profile_without_panicking() {
        let profile = detect("cuda");
        eprintln!("[test] Detected profile: {:?}", profile);
        assert!(!profile.cpu_model.is_empty());
        assert!(profile.cpu_threads > 0);
    }

    #[test]
    fn cpu_mode_forces_cpu_backend() {
        assert_eq!(detect("cpu").backend, "cpu");
    }
}
