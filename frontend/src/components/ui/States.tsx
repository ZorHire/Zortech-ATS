import type { ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw, WifiOff } from "lucide-react";
import Button from "./Button";
import { describeApiError, isServerUnreachableError } from "../../store/api/baseApi";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}

/** "Nothing here yet" with a hint and usually one action. */
export function EmptyState({ icon, title, description, action, className = "", compact }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-16"} px-6 ${className}`}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-muted">
        {icon ?? <Inbox size={22} aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  /** RTK Query / unwrap() error, used to pick a readable message. */
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
  compact?: boolean;
}

/** Shown instead of an empty list when loading failed, so failures don't look like "no data". */
export function ErrorState({ error, title, message, onRetry, retrying, className = "", compact }: ErrorStateProps) {
  const offline = isServerUnreachableError(error);
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center text-center ${compact ? "py-8" : "py-16"} px-6 ${className}`}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
        {offline ? <WifiOff size={22} aria-hidden="true" /> : <AlertTriangle size={22} aria-hidden="true" />}
      </div>
      <h3 className="text-base font-semibold text-ink">{title ?? (offline ? "Can't reach ZorHire" : "Couldn't load this")}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{message ?? describeApiError(error, "Something went wrong. Please try again.")}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry} loading={retrying} icon={<RefreshCw size={14} />}>
          Try again
        </Button>
      )}
    </div>
  );
}
