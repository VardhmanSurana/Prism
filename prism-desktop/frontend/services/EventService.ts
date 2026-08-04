
import { API_BASE } from '../constants';

export interface SSEEvent {
  type: string;
  photoId?: string | number;
  [key: string]: unknown;
}

type EventCallback = (data: SSEEvent) => void;

class EventService {
    private eventSource: EventSource | null = null;
    private listeners: Record<string, EventCallback[]> = {};
    private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    connect() {
        if (this.eventSource) return;

        this.eventSource = new EventSource(`${API_BASE}/api/v1/settings/events`);

        this.eventSource.onopen = () => {
            // Emit a synthetic 'reconnected' event so subscribers (e.g. photo grid)
            // can re-fetch data after a backend restart.
            this.emit('reconnected', { type: 'reconnected' });
        };

        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data) as SSEEvent;
                const type = data.type;
                if (this.listeners[type]) {
                    this.listeners[type].forEach(callback => callback(data));
                }
                if (this.listeners['*']) {
                    this.listeners['*'].forEach(callback => callback(data));
                }
            } catch (e) {
                console.error("Failed to parse SSE", e);
            }
        };

        this.eventSource.onerror = (e) => {
            console.error("SSE connection error", e);
            this.eventSource?.close();
            this.eventSource = null;
            
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
            
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                this.connect();
            }, 5000);
        };
    }

    emit(type: string, data: SSEEvent) {
        if (this.listeners[type]) {
            this.listeners[type].forEach(callback => callback(data));
        }
        if (this.listeners['*']) {
            this.listeners['*'].forEach(callback => callback(data));
        }
    }

    subscribe(type: string, callback: EventCallback) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
        
        return () => {
            this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
        };
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.eventSource?.close();
        this.eventSource = null;
    }
}

export const eventService = new EventService();
