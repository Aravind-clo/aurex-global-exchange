import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RenderBoundary] Caught component error:', error, info.componentStack);
  }

  private handleResetView = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0B0E11] text-slate-900 dark:text-[#EAECEF] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-[#181A20] border border-slate-200 dark:border-[#2B3139] rounded-xl p-6 space-y-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-[#F6465D]/15 text-[#F6465D] shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base font-semibold">Terminal Render Recovery</h1>
                <p className="text-xs text-slate-500 dark:text-[#848E9C] mt-1">
                  A visual component encountered a recoverable state error. Your server session and ledger remain intact.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 dark:bg-[#0B0E11] border border-slate-200 dark:border-[#2B3139] font-mono text-[11px] text-[#F6465D] break-words">
              {this.state.errorMessage}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={this.handleResetView}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-[#2B3139] text-slate-700 dark:text-[#EAECEF] hover:bg-slate-100 dark:hover:bg-[#2B3139]"
              >
                Reset View
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#F0B90B] hover:bg-[#d9a70a] text-[#0B0E11]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reload Workspace
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
