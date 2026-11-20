import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  /** "page" renders inside the app shell so the sidebar stays usable. */
  variant?: "app" | "page";
  /** Changing this (e.g. the route path) clears the error. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/** After a deploy, an open tab may ask for page files that no longer exist. */
function isStaleBundleError(error: Error | null): boolean {
  const msg = error?.message ?? "";
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg);
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const stale = isStaleBundleError(error);
    const page = this.props.variant === "page";

    return (
      <div className={`flex items-center justify-center px-4 ${page ? "flex-1 py-16" : "min-h-screen bg-surface"}`}>
        <div role="alert" className="zh-card w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <AlertTriangle size={24} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold text-ink">
            {stale ? "ZorHire has been updated" : "This screen hit a problem"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {stale
              ? "Reload to get the latest version. Nothing you saved is lost."
              : "Something went wrong while showing this page. Reloading usually fixes it; if it keeps happening, tell us what you were doing."}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy-600 px-4 text-sm font-semibold text-white hover:bg-navy-700"
            >
              <RefreshCw size={16} aria-hidden="true" />
              Reload
            </button>
            {!stale && (
              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="h-10 rounded-lg px-4 text-sm font-medium text-muted hover:bg-surface-sunken hover:text-ink"
              >
                Go to dashboard
              </button>
            )}
          </div>
          {!stale && import.meta.env.DEV && (
            <pre className="mt-6 max-h-32 overflow-auto rounded bg-surface-sunken p-3 text-left text-xs text-ink-soft">{error.message}</pre>
          )}
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
