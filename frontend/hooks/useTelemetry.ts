import { useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '../constants';

export interface TelemetryEvent {
  id?: number;
  source: string;
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
  error_count: number;
  warning_count: number;
  avg_latency_ms: number;
  events_per_minute: number;
  recent_events: TelemetryEvent[];
}

// ── Module-level event buffer (shared across all hook instances) ──────────
const BUFFER_FLUSH_INTERVAL_MS = 800;
const BUFFER_MAX_SIZE = 30;

type PendingEvent = {
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

  return { logEvent, logAction, logNavigation, logError };
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
