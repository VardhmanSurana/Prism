import { Component, ErrorInfo, ReactNode } from 'react';
import { API_BASE } from '../../constants';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    try {
      fetch(`${API_BASE}/api/v1/telemetry/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'error',
          component: 'ErrorBoundary',
          action: 'react_component_crash',
          metadata_json: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
          }),
          status: 'error',
        }),
      }).catch(() => {});
    } catch {
      // Ignore telemetry failures in error boundary
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-gray-100">
          <div className="max-w-md w-full rounded-2xl bg-surface border border-border p-8 text-center shadow-xl">
            <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
            <p className="text-sm text-gray-400 mb-6 font-medium">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-6 py-2.5 bg-primary text-black hover:brightness-110 font-bold rounded-xl text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(var(--color-primary),0.15)] transition-all active:scale-95"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
