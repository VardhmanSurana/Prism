//! HardwareScheduler — schedules and throttles background AI jobs based on hardware metrics.

#[allow(unused_imports)]
pub use crate::services::worker::{
    JobScheduler as HardwareScheduler,
    JobScheduler,
    SystemMonitor,
    SystemState,
    HardwareMetricsSnapshot,
    WorkerStatusSnapshot,
};
