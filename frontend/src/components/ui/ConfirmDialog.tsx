import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Red confirm button for deletes and other irreversible actions. */
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Replaces window.confirm(): `if (!(await confirm({ title: "Delete job?", danger: true }))) return;`
 * Must be rendered inside <ConfirmProvider> (done once in App).
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (ctx) return ctx;
  // Fallback so a missing provider never breaks a destructive-action guard.
  return async (o) => window.confirm(typeof o.message === "string" ? `${o.title}\n\n${o.message}` : o.title);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => {
    resolver.current?.(false);
    setOptions(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const finish = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!options}
        onClose={() => finish(false)}
        size="sm"
        hideHeader
        footer={
          <>
            <Button variant="secondary" onClick={() => finish(false)}>
              {options?.cancelText ?? "Cancel"}
            </Button>
            <Button variant={options?.danger ? "danger" : "primary"} onClick={() => finish(true)} data-autofocus>
              {options?.confirmText ?? "Confirm"}
            </Button>
          </>
        }
      >
        <div className="flex gap-4">
          {options?.danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
              <AlertTriangle size={20} aria-hidden="true" />
            </div>
          )}
          <div>
            <h2 className="text-base font-semibold text-ink">{options?.title}</h2>
            {options?.message && <div className="mt-1 text-sm text-muted">{options.message}</div>}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}
