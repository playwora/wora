import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex h-full w-full flex-col items-center justify-center p-8">
          <div className="max-w-md text-center">
            <IconAlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
            <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
            <p className="mb-4 text-sm opacity-70">
              An unexpected error occurred. The application may not work correctly.
            </p>
            {process.env.NODE_ENV !== 'production' && this.state.error && (
              <details className="mb-4 rounded-lg bg-gray-100 p-3 text-left dark:bg-gray-800">
                <summary className="cursor-pointer text-xs font-medium">Error details</summary>
                <pre className="mt-2 overflow-auto text-xs">
                  {this.state.error.toString()}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <Button
              onClick={this.handleReset}
              className="flex items-center gap-2"
            >
              <IconRefresh size={16} />
              Reload Application
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}