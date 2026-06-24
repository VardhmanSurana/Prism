# Design Specification: AI Progress Ingestion & Notification Dropdown

Implement real-time background processing updates for AI services (Vision/CLIP, Gemma Vision captioning, Face clustering) in a glassmorphic notification dropdown.

## 1. Backend Specifications

### REST API endpoint
* **Path**: `/api/v1/utilities/background-jobs/status`
* **Method**: `GET`
* **Response Schema**:
  ```json
  {
    "total_photos": int,
    "clip": {
      "processed": int,
      "total": int,
      "progress": float,
      "is_processing": bool
    },
    "gemma": {
      "processed": int,
      "total": int,
      "progress": float,
      "is_processing": bool
    },
    "face": {
      "processed": int,
      "total": int,
      "progress": float,
      "is_processing": bool
    },
    "queue": {
      "pending": int,
      "processing": int,
      "failed": int,
      "completed": int
    }
  }
  ```

### Calculations
* `total_photos`: count of photos where `is_locked = 0` and `is_trash = 0`.
* `clip_processed`: count of photos where `is_locked = 0`, `is_trash = 0`, and `embedding` is not null.
* `gemma_processed`: count of photos where `is_locked = 0`, `is_trash = 0`, and `ai_summary` is not null.
* `face_processed`: count of Completed `BackgroundJob` records of type `sequential_analysis`.
* `queue`: counts of `BackgroundJob` rows by their `status`.
* `is_processing`: True if `queue.pending > 0` or `queue.processing > 0` (and if settings enable the corresponding service, or generally if the pipeline is active).

### SSE Events
* **`background_job_status`**: Emitted when the queue worker begins or completes a batch of jobs.
* **`background_job_completed`**: Emitted when a batch completes and the remaining active jobs in the queue is `0`.

---

## 2. Frontend Specifications

### Notification Button & Dropdown Layout
* Replace `NotificationsButton.tsx` with a stateful component managing:
  * `isOpen` (toggle state for the dropdown card).
  * `hasNewCompletion` (boolean flag to light up notification dot badge).
  * `backgroundStatus` (background-jobs status state).
  * `logs` (array of recent completion event messages).
* Position the glassmorphic dropdown card absolutely below the header Notifications button.
* Animate card entry using `framer-motion` (fade and scale).

### Processing States & Progress Bars
* Only show progress bars when the service is actively processing (`is_processing === true`).
* Use `ProgressBar.tsx` for each active progress bar:
  * **Importing/Syncing**: Green theme (using `syncStatus` from hooks).
  * **CLIP**: Indigo theme.
  * **Gemma**: Violet theme.
  * **Face Detection**: Pink theme.

### Recent Activity & Ping Behavior
* Show a list of completed batch items.
* Provide a "Clear" button to clear completed activity logs and clear the notification badge dot.

---

## Verification Plan

### Backend Unit Tests
* Implement test to verify endpoint calculations and background job queue sizes.
* Command: `cd backend && uv run pytest tests/`

### Frontend Verification
* Verify typing and compile correctness.
* Command: `cd frontend && bunx tsc --noEmit`
