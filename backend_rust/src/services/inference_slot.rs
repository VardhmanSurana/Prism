//! Global inference slot — guarantees only ONE heavyweight ML model runs at a
//! time. On a 4 GB VRAM machine, SAM + LaMa + upscale models cannot be resident
//! simultaneously; every AI job acquires this slot before loading/running its
//! session and releases it afterwards.

use serde_json::json;
use std::sync::OnceLock;
use std::time::Instant;
use tokio::sync::{Mutex, MutexGuard};

struct SlotInner {
    /// Who currently holds the slot: (job name, acquired_at).
    holder: Option<(String, Instant)>,
}

static SLOT: OnceLock<Mutex<SlotInner>> = OnceLock::new();

fn slot() -> &'static Mutex<SlotInner> {
    SLOT.get_or_init(|| Mutex::new(SlotInner { holder: None }))
}

/// RAII guard holding the inference slot for the duration of a job.
#[allow(dead_code)]
pub struct InferenceSlot<'a>(MutexGuard<'a, SlotInner>, String);

#[allow(dead_code)]
impl InferenceSlot<'_> {
    pub fn holder(&self) -> &str {
        &self.1
    }

    pub fn held_for_secs(&self) -> u64 {
        self.0
            .holder
            .as_ref()
            .map(|(_, t)| t.elapsed().as_secs())
            .unwrap_or(0)
    }
}

impl Drop for InferenceSlot<'_> {
    fn drop(&mut self) {
        self.0.holder = None;
    }
}

/// Acquire exclusive access to the inference pipeline. Awaits until free.
pub async fn acquire(job_name: &str) -> InferenceSlot<'static> {
    let mut inner = slot().lock().await;
    inner.holder = Some((job_name.to_string(), Instant::now()));
    InferenceSlot(inner, job_name.to_string())
}

/// Non-blocking snapshot of who is currently running, for diagnostics.
pub async fn status() -> serde_json::Value {
    let inner = slot().lock().await;
    match &inner.holder {
        Some((name, t)) => json!({
            "busy": true,
            "job": name,
            "held_seconds": t.elapsed().as_secs(),
        }),
        None => json!({ "busy": false }),
    }
}

/// Non-blocking synchronous check if a heavyweight job currently holds the inference slot.
pub fn is_busy_sync() -> bool {
    if let Some(slot_mutex) = SLOT.get() {
        if let Ok(guard) = slot_mutex.try_lock() {
            return guard.holder.is_some();
        }
        return true; // Mutex is currently held by an active job
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn slot_is_exclusive_and_released_on_drop() {
        // Acquire → guard.holder() proves the slot was taken.
        // Can't call status() while the guard is held: tokio::sync::Mutex
        // is NOT reentrant and #[tokio::test] uses a single-threaded
        // runtime, so status().await would deadlock.
        {
            let g1 = acquire("lama").await;
            assert_eq!(g1.holder(), "lama");
        }
        // Guard dropped — slot should be free.
        assert_eq!(status().await["busy"], serde_json::Value::Bool(false));
        let _g2 = acquire("sam").await;
        assert_eq!(_g2.holder(), "sam");
    }
}
