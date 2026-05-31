
import { API_BASE } from '../constants';

type EventCallback = (data: any) => void;

class EventService {
    private eventSource: EventSource | null = null;
    private listeners: { [type: string]: EventCallback[] } = {};
    private reconnectTimeout: any = null;

    connect() {
        if (this.eventSource) return;

        this.eventSource = new EventSource(`${API_BASE}/api/v1/settings/events`);

        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const type = data.type;
                if (this.listeners[type]) {
                    this.listeners[type].forEach(callback => callback(data));
                }
                // Also support catch-all
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
            
            // Avoid scheduling multiple duplicate reconnections
            if (this.reconnectTimeout) {
                clearTimeout(this.reconnectTimeout);
            }
            
            // Reconnect after 5 seconds
            this.reconnectTimeout = setTimeout(() => {
                this.reconnectTimeout = null;
                this.connect();
            }, 5000);
        };
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
