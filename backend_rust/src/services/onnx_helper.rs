//! Helper for constructing ONNX Runtime sessions with CUDA GPU acceleration
//! and automatic graceful fallback to multi-threaded CPU execution.

use ort::session::builder::GraphOptimizationLevel;
use ort::session::Session;
use std::path::Path;
use tracing::info;

/// Build an ONNX Runtime `Session` trying CUDA execution provider first,
/// falling back to CPU Level-3 optimized inference if CUDA is unavailable.
pub fn build_session(path: impl AsRef<Path>, tag: &str) -> Result<Session, ort::Error> {
    let path_ref = path.as_ref();
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
            Session::builder()?
                .with_optimization_level(GraphOptimizationLevel::Level3)?
                .commit_from_file(path_ref)
        }
    }
}
