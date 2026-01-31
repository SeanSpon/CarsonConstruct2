import type { ReactNode } from 'react';
import React from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message?: string;
  stack?: string;
};

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    return { hasError: true, message, stack };
  }

  componentDidCatch(error: unknown) {
    // Also emit to console so preload/main forwarding can pick it up.
    // eslint-disable-next-line no-console
    console.error('[Renderer ErrorBoundary] Uncaught render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-screen w-screen bg-black text-white p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-2xl font-bold">Renderer crashed</h1>
          <p className="text-white/70 text-sm">
            The UI hit a runtime error. Open DevTools (it should auto-open in dev) and check the Console.
          </p>
          <div className="rounded bg-white/10 border border-white/10 p-4">
            <div className="text-sm font-mono whitespace-pre-wrap break-words">
              {this.state.message || '(no error message)'}
            </div>
            {this.state.stack && (
              <div className="mt-3 text-xs font-mono whitespace-pre-wrap break-words text-white/60">
                {this.state.stack}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}
