import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Rendered when the subtree throws. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  error: Error | null;
}

/** Keeps a crashed app from taking the whole desktop down with it. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Windows 12 Concept] Unhandled error', error, info.componentStack);
    this.props.onError?.(error);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center">
        <div>
          <h2 className="text-base font-semibold">Something went wrong</h2>
          <p className="mt-1 max-w-sm text-xs opacity-70">{error.message}</p>
          <button type="button" className="win-button mt-4" onClick={this.reset}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
