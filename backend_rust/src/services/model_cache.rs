//! Releasable cache for expensive, lazily-loaded model sessions.
//!
//! The cache object is static, but `unload` drops its contained `Arc` so ONNX
//! Runtime can return RAM/VRAM while keeping a safe lazy-reload path.

use std::sync::{Arc, Mutex};

pub struct ModelCache<T> {
    value: Mutex<Option<Arc<T>>>,
}

impl<T> ModelCache<T> {
    pub const fn new() -> Self {
        Self { value: Mutex::new(None) }
    }

    pub fn get_or_try_init(&self, build: impl FnOnce() -> Result<T, String>) -> Result<Arc<T>, String> {
        let mut value = self.value.lock().map_err(|_| "model cache lock poisoned".to_string())?;
        if let Some(model) = value.as_ref() {
            return Ok(Arc::clone(model));
        }

        let model = Arc::new(build()?);
        *value = Some(Arc::clone(&model));
        Ok(model)
    }

    /// Drops the cache's reference. In-flight requests retain their `Arc` and
    /// finish safely; the session is freed once their last reference drops.
    pub fn unload(&self) -> bool {
        self.value
            .lock()
            .map(|mut value| value.take().is_some())
            .unwrap_or(false)
    }

    #[cfg(test)]
    pub fn is_loaded(&self) -> bool {
        self.value.lock().map(|value| value.is_some()).unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::ModelCache;

    #[test]
    fn unload_drops_the_value_and_allows_a_lazy_reload() {
        let cache = ModelCache::new();
        let first = cache.get_or_try_init(|| Ok::<_, String>(42)).unwrap();
        assert_eq!(*first, 42);
        assert!(cache.is_loaded());

        assert!(cache.unload());
        assert!(!cache.is_loaded());

        let reloaded = cache.get_or_try_init(|| Ok::<_, String>(7)).unwrap();
        assert_eq!(*reloaded, 7);
    }
}
