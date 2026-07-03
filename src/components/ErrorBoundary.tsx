import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    message: null,
  };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f0f1a] px-4 text-white">
        <div role="alert" className="w-full max-w-md rounded-lg border border-red-900/60 bg-gray-900 px-5 py-4 shadow-xl">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          {this.state.message && (
            <p className="mt-2 break-words text-sm text-red-200">{this.state.message}</p>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
