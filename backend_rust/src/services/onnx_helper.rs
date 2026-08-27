//! Helper for constructing ONNX Runtime sessions with CUDA GPU acceleration,
//! automatic CPU fallback, intra-op thread throttling, and GPU-load routing.

use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use std::path::Path;
use tracing::info;

/// Calculate the optimal number of intra-op worker threads to prevent 100% CPU starvation.
/// Caps at half the logical cores (between 1 and 4 threads).
pub fn optimal_cpu_threads() -> usize {
    let cpus = num_cpus::get();
    (cpus / 2).clamp(1, 4)
}

/// Build a dedicated CPU session with thread throttling and memory arena optimization.
pub fn build_cpu_session(path: impl AsRef<Path>, tag: &str) -> Result<Session, ort::Error> {
    let path_ref = path.as_ref();
    let threads = optimal_cpu_threads();
    info!("[{}] loaded on CPU with {} worker threads", tag, threads);
    Session::builder()?
        .with_intra_threads(threads)?
        .with_inter_threads(1)?
        .with_memory_pattern(false)?
        .with_optimization_level(GraphOptimizationLevel::Level3)?
        .commit_from_file(path_ref)
}

use std::sync::OnceLock;

static CUDA_USABLE: OnceLock<bool> = OnceLock::new();

/// Check if a healthy NVIDIA CUDA GPU is available on the system.
/// If nvidia-smi failed, no dedicated VRAM is detected, or GPU_MODE=cpu,
/// CUDA provider initialization is skipped to prevent driver SIGABRT crashes.
pub fn is_cuda_usable() -> bool {
    *CUDA_USABLE.get_or_init(|| {
        let mode = std::env::var("GPU_MODE").unwrap_or_else(|_| "cpu".to_string());
        if mode.eq_ignore_ascii_case("cpu") {
            info!("[Hardware] GPU_MODE=cpu (using thread-throttled CPU Level-3 SIMD execution)");
            return false;
        }

        // Only attempt CUDA EP if explicitly set to "cuda" and verified on system
        if mode.eq_ignore_ascii_case("cuda") {
            let profile = crate::services::hardware::detect("cuda");
            if profile.backend == "cuda" && profile.vram_mb > 0 {
                info!("[Hardware] Verified CUDA GPU: {} ({} MB VRAM)", profile.gpu_name, profile.vram_mb);
                return true;
            }
        }

        info!("[Hardware] Running on CPU SIMD Level-3 optimization (Thread-capped & Memory-managed)");
        false
    })
}

/// Build an ONNX Runtime `Session` trying CUDA execution provider first,
/// falling back to CPU Level-3 optimized inference if CUDA is unavailable.
pub fn build_session(path: impl AsRef<Path>, tag: &str) -> Result<Session, ort::Error> {
    let path_ref = path.as_ref();
    
    if !is_cuda_usable() {
        return build_cpu_session(path_ref, tag);
    }

    let cuda_res = (|| -> Result<Session, ort::Error> {
        Session::builder()?
            .with_execution_providers([ort::ep::CUDA::default().build()])?
            .with_optimization_level(GraphOptimizationLevel::Level3)?
            .commit_from_file(path_ref)
    })();

    match cuda_res {
        Ok(session) => {
            info!("[{}] loaded with CUDA GPU acceleration from {}", tag, path_ref.display());
            Ok(session)
        }
        Err(e) => {
            info!("[{}] CUDA unavailable ({}), falling back to CPU", tag, e);
            build_cpu_session(path_ref, tag)
        }
    }
}

/// Build a Tier-1 ultra-lightweight session (OCR, YOLO, U2NetP, FaceID, SAM decoder).
/// If the GPU is currently under load from a heavyweight task, it immediately routes to CPU
/// to eliminate GPU queue contention and maintain instant response times.
pub fn build_tier1_session(path: impl AsRef<Path>, tag: &str) -> Result<Session, ort::Error> {
    if !is_cuda_usable() || crate::services::inference_slot::is_busy_sync() {
        return build_cpu_session(path, tag);
    }
    build_session(path, tag)
}
