import { useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '../constants';
import { useSettingsStore } from '../store/settingsStore';

export interface TelemetryEvent {
  id?: number;
  source: string;
  session_id?: string;
  event_type: string;
  component?: string;
  action?: string;
  metadata_json?: string;
  status?: string;
  duration_ms?: number;
  created_at?: string;
}

export interface TelemetrySummary {
  total_events: number;
  session_count: number;
  error_count: number;
  warning_count: number;
  avg_latency_ms: number;
  events_per_minute: number;
  recent_events: TelemetryEvent[];
}

// ── Module-level event buffer (shared across all hook instances) ──────────
const BUFFER_FLUSH_INTERVAL_MS = 800;
const BUFFER_MAX_SIZE = 30;

/**
 * Session identifier generated once per app launch. All events from this
 * module share the same ID so they can be grouped into a single session
 * on the backend (summarized via the `session_count` stat).
 */
function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for non-secure contexts
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const TELEMETRY_SESSION_ID = generateSessionId();

type PendingEvent = {
  session_id: string;
  event_type: string;
  component?: string;
  action?: string;
  metadata_json?: string;
  status?: string;
};

let eventBuffer: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;

async function flushBuffer(): Promise<void> {
  if (isFlushing || eventBuffer.length === 0) return;
  isFlushing = true;

  const batch = eventBuffer.splice(0, BUFFER_MAX_SIZE);

  try {
    await fetch(`${API_BASE}/api/v1/telemetry/log-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Silently swallow — telemetry should never break the UI
  } finally {
    isFlushing = false;
    // If more events arrived while flushing, schedule another flush
    if (eventBuffer.length > 0) {
      scheduleFlush();
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return; // already scheduled
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer();
  }, BUFFER_FLUSH_INTERVAL_MS);
}

function enqueueEvent(event: PendingEvent): void {
  // Respect the global telemetry opt-out. Errors are always captured so
  // diagnostics remain available even when telemetry collection is paused.
  if (!useSettingsStore.getState().telemetryEnabled && event.status !== 'error') {
    return;
  }

  eventBuffer.push(event);

  // Flush immediately if buffer is full
  if (eventBuffer.length >= BUFFER_MAX_SIZE) {
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushBuffer();
    return;
  }

  scheduleFlush();
}

// Flush on page unload so no events are lost
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (eventBuffer.length > 0) {
      // Use sendBeacon for reliable delivery during page unload
      const payload = JSON.stringify({ events: eventBuffer.splice(0) });
      navigator.sendBeacon(
        `${API_BASE}/api/v1/telemetry/log-batch`,
        new Blob([payload], { type: 'application/json' }),
      );
    }
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────

/**
 * Hook for logging frontend telemetry events to the backend.
 *
 * Events are buffered and flushed in batches (~800ms) to avoid flooding
 * the backend with individual HTTP POSTs on rapid interactions.
 *
 * Usage:
 *   const { logEvent, logAction, logNavigation, logError } = useTelemetry();
 *   logAction('PhotoGrid', 'photo_select', { photoId: 42 });
 *   logNavigation('/albums/3');
 *   logError('ImageEditor', 'export_failed', new Error('timeout'));
 */
export function useTelemetry() {
  const sessionStart = useRef(Date.now());

  /** Flush any pending events on unmount */
  useEffect(() => {
    return () => {
      if (eventBuffer.length > 0) {
        flushBuffer();
      }
    };
  }, []);

  /** Log a generic telemetry event */
  const logEvent = useCallback(
    (
      eventType: string,
      component?: string,
      action?: string,
      metadata?: Record<string, unknown>,
      status?: string,
    ) => {
      enqueueEvent({
        session_id: TELEMETRY_SESSION_ID,
        event_type: eventType,
        component,
        action,
        metadata_json: metadata ? JSON.stringify(metadata) : undefined,
        status,
      });
    },
    [],
  );

  /** Convenience: log a user-initiated action */
  const logAction = useCallback(
    (component: string, action: string, metadata?: Record<string, unknown>) => {
      enqueueEvent({
        session_id: TELEMETRY_SESSION_ID,
        event_type: 'user_action',
        component,
        action,
        metadata_json: metadata ? JSON.stringify(metadata) : undefined,
      });
    },
    [],
  );

  /** Convenience: log a navigation / view change */
  const logNavigation = useCallback((path: string, metadata?: Record<string, unknown>) => {
    enqueueEvent({
      session_id: TELEMETRY_SESSION_ID,
      event_type: 'navigation',
      component: 'router',
      action: 'navigate',
      metadata_json: JSON.stringify({ path, ...metadata }),
    });
  }, []);

  /** Convenience: log an error — errors are flushed immediately (no delay) */
  const logError = useCallback(
    (component: string, action: string, error: Error | unknown, metadata?: Record<string, unknown>) => {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      enqueueEvent({
        session_id: TELEMETRY_SESSION_ID,
        event_type: 'error',
        component,
        action,
        metadata_json: JSON.stringify({
          message: errorObj.message,
          stack: errorObj.stack,
          ...metadata,
        }),
        status: 'error',
      });
      // Flush errors immediately so they're not lost
      if (flushTimer !== null) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushBuffer();
    },
    [],
  );

  /** Log app session start (once per hook lifetime) — sent immediately */
  useEffect(() => {
    enqueueEvent({
      session_id: TELEMETRY_SESSION_ID,
      event_type: 'session_start',
      component: 'app',
      action: 'init',
      metadata_json: JSON.stringify({
        started_at: new Date(sessionStart.current).toISOString(),
        user_agent: navigator.userAgent,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      }),
    });
    // Flush session_start immediately
    if (flushTimer !== null) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    flushBuffer();
  }, []);

  const logAIInference = useCallback(
    (modelName: string, inferenceMs: number, itemCount: number, metadata?: Record<string, unknown>) => {
      enqueueEvent({
        session_id: TELEMETRY_SESSION_ID,
        event_type: 'ai_inference',
        component: modelName.toLowerCase(),
        action: 'infer',
        metadata_json: JSON.stringify({
          model_name: modelName,
          inference_ms: inferenceMs,
          item_count: itemCount,
          ...metadata,
        }),
        status: 'ok',
      });
    },
    [],
  );

  return { logEvent, logAction, logNavigation, logError, logAIInference };
}

/**
 * Subscribe to the backend SSE telemetry stream.
 * Returns events as they happen via the callback.
 *
 * Usage in DiagnosticsLogs or similar:
 *   useEffect(() => {
 *     const unsub = subscribeTelemetryStream((event) => { ... });
 *     return unsub;
 *   }, []);
 */
export function subscribeTelemetryStream(
  onEvent: (event: TelemetryEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/api/v1/telemetry/stream`);

  es.addEventListener('telemetry', (msg: MessageEvent) => {
    try {
      const event: TelemetryEvent = JSON.parse(msg.data);
      onEvent(event);
    } catch {
      // Ignore malformed events
    }
  });

  es.addEventListener('ping', () => {
    // Keep-alive from server, no action needed
  });

  es.onerror = (err) => {
    if (onError) onError(err);
  };

  return () => {
    es.close();
  };
}

/**
 * Fetch the current telemetry summary from the backend.
 */
export async function fetchTelemetrySummary(): Promise<TelemetrySummary | null> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/telemetry/summary`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Silently fail
  }
  return null;
}

/**
 * Fetch recent telemetry events from the backend.
 */
export async function fetchTelemetryEvents(limit = 100): Promise<TelemetryEvent[]> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/telemetry/events?limit=${limit}`);
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // Silently fail
  }
  return [];
}

/**
 * Clear all stored telemetry events from the backend database.
 */
export async function clearTelemetryEvents(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/telemetry/events`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}
