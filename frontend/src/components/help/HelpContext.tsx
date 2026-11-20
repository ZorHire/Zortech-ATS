import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { HelpAnswer } from "../../store/api/helpApi";

export interface HelpMessage {
  role: "user" | "assistant";
  content: string;
  /** Set on assistant replies. */
  reply?: HelpAnswer;
  error?: boolean;
}

interface HelpState {
  open: boolean;
  setOpen: (open: boolean) => void;
  messages: HelpMessage[];
  setMessages: (fn: (prev: HelpMessage[]) => HelpMessage[]) => void;
  reset: () => void;
}

const Ctx = createContext<HelpState | null>(null);
const KEY = "zh-help-conversation";

const load = (): HelpMessage[] => {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HelpMessage[]) : [];
  } catch {
    return [];
  }
};

/** Shares the help conversation between the side panel and the Help page (kept for the browser tab). */
export function HelpProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [messages, setRaw] = useState<HelpMessage[]>(load);
  const setMessages = useCallback((fn: (prev: HelpMessage[]) => HelpMessage[]) => {
    setRaw((prev) => {
      const next = fn(prev).slice(-30);
      try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
      return next;
    });
  }, []);
  const reset = useCallback(() => setMessages(() => []), [setMessages]);
  const value = useMemo(() => ({ open, setOpen, messages, setMessages, reset }), [open, messages, setMessages, reset]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHelp(): HelpState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useHelp must be used inside HelpProvider");
  return v;
}
