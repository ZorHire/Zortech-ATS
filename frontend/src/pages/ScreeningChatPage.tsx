import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Briefcase, Send, AlertTriangle, CheckCircle2 } from "lucide-react";

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error && messages.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-sm w-full text-center space-y-3">
          <AlertTriangle size={32} className="mx-auto text-red-400" />
          <h2 className="font-bold text-gray-900">Unable to load this chat</h2>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-6">
      <div className="w-full max-w-lg flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Briefcase size={16} className="text-white" />
          </div>
          <span className="font-bold text-gray-900">ZorHire — Screening Chat</span>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex flex-col flex-1 overflow-hidden" style={{ minHeight: "60vh" }}>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-sm text-gray-400 text-center mt-8">Say hello to get started.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "candidate" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    m.role === "candidate"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {status === "completed" ? (
            <div className="border-t border-gray-200 p-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50">
              <CheckCircle2 size={16} />
              Thanks — this screening chat has ended. A recruiter will follow up.
            </div>
          ) : (
            <form onSubmit={handleSend} className="border-t border-gray-200 p-3 flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message…"
                disabled={sending}
                className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </form>
          )}
          {error && (
            <p className="px-4 pb-3 text-xs text-red-600">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
