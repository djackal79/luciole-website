import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090e] text-neutral-200 flex flex-col items-center justify-center p-6 font-mono text-center">
          <div className="max-w-lg w-full bg-[#0c0f18] border border-rose-500/40 rounded-2xl p-6 shadow-2xl">
            <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-white mb-2">Sim Dashboard Error</h2>
            <p className="text-xs text-rose-300 bg-rose-950/40 p-3 rounded-lg border border-rose-900/50 mb-4 text-left overflow-x-auto">
              {this.state.error?.message || 'Unknown runtime error occurred.'}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset & Reload</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
