import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Send, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button, Spinner } from "../components/ui";

const API_URL = import.meta.env.VITE_API_URL || "/v1";

interface ScreeningMessage {
  role: "assistant" | "candidate";
  content: string;
  created_at?: string;
}

/**
 * Fully public, unauthenticated page — no candidate login exists. Deliberately
 * uses plain fetch rather than lib/api.ts: that helper injects a JWT from
 * localStorage (none exists here) and dispatches a global "auth:unauthorized"
 * event on 401 that assumes an authenticated app context, neither of which
 * applies to an anonymous candidate on this page.
 */
export default function ScreeningChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [messages, setMessages] = useState<ScreeningMessage[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const request = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Screening-Token": token || "",
        ...options.headers,
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || "Something went wrong");
    }
    return data;
  };

  useEffect(() => {
    if (!sessionId || !token) {
      setError("This screening link is missing or malformed.");
      setLoading(false);
      return;
    }
    request(`/screening/sessions/${sessionId}`)
      .then((data) => {
        setMessages(data.messages || []);
        setStatus(data.status);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "candidate", content: text }]);
    setSending(true);
    setError(null);
    try {
      const data = await request(`/screening/sessions/${sessionId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.is_complete) setStatus("completed");
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Spinner size={32} tone="brand" label="Loading chat" />
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4 sm:px-6">
        <div className="zh-card w-full max-w-sm space-y-3 p-8 text-center" role="alert">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-50 text-danger-600">
            <AlertTriangle size={22} aria-hidden="true" />
          </div>
          <h1 className="text-base font-semibold text-ink">Unable to load this chat</h1>
          <p className="text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface px-4 py-6">
      <div className="flex w-full max-w-lg flex-1 flex-col">
        <div className="mb-4 flex items-center gap-3">
          <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
          <h1 className="border-l border-line pl-3 text-sm font-semibold text-navy-700">ZorHire — Screening Chat</h1>
        </div>

        <div className="zh-card flex min-h-[60vh] flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <p className="mt-8 text-center text-sm text-muted">Say hello to get started.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm ${
                    m.role === "candidate"
                      ? "rounded-br-sm bg-navy-600 text-white"
                      : "rounded-bl-sm bg-surface-sunken text-ink"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-surface-sunken px-4 py-2 text-sm text-muted">
                  <Spinner size={12} />
                  Typing…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {status === "completed" ? (
            <div className="flex items-center gap-2 border-t border-line bg-success-50 p-4 text-sm text-success-700" role="status">
              <CheckCircle2 size={16} aria-hidden="true" className="shrink-0" />
              Thanks — this screening chat has ended. A recruiter will follow up.
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-line p-3">
              <label htmlFor="screening-message" className="sr-only">
                Your message
              </label>
              <input
                id="screening-message"
                type="text"
                autoComplete="off"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message…"
                readOnly={sending}
                className="zh-input flex-1"
              />
              <Button
                type="submit"
                className="h-10 w-10 shrink-0 px-0"
                loading={sending}
                disabled={!input.trim()}
                aria-label="Send message"
                icon={<Send size={16} aria-hidden="true" />}
              />
            </form>
          )}
          {error && (
            <p role="alert" className="px-4 pb-3 text-xs text-danger-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
