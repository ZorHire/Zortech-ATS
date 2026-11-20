import { useEffect, useRef } from "react";

/**
 * Calls `handler` when the Escape key is pressed, while `enabled` is true.
 * The latest handler is always used, so callers don't need to memoize it.
 */
export function useEscapeKey(handler: () => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") ref.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

export default useEscapeKey;
