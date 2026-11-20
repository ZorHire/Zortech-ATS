import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowUp, BookOpen, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import Markdown from "./Markdown";
import { useHelp, type HelpMessage } from "./HelpContext";
import { useAskHelpMutation, useHelpFeedbackMutation } from "../../store/api/helpApi";
import { getErrorMessage } from "../../lib/format";

const STARTERS: Record<string, string[]> = {
  staff: [
    "How do I add candidates from resumes?",
    "How does Autopilot shortlist and screen candidates?",
    "How do I send a candidate's profile to a client?",
    "How do I invite a vendor to the vendor portal?",
  ],
  vendor_user: ["How do I submit a candidate?", "Where can I see feedback on my submissions?"],
  client_user: ["How do I give feedback on a candidate?", "Where are the candidates for my job?"],
};

/**
 * Chat with the ZorHire help assistant. Used in the side panel (compact) and on the Help page.
 * `onNavigate` closes the side panel when the user follows a link.
 */
export default function HelpAssistant({ role, compact = false, onNavigate }: { role?: string; compact?: boolean; onNavigate?: () => void }) {
  const { messages, setMessages, reset } = useHelp();
  const location = useLocation();
  const [ask, { isLoading }] = useAskHelpMutation();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, isLoading]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || isLoading) return;
    const history = messages.filter((m) => !m.error).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setText("");
    try {
      const reply = await ask({ question, history, page: location.pathname }).unwrap();
      setMessages((prev) => [...prev, { role: "assistant", content: reply.answer, reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: getErrorMessage(err, "Something went wrong. Please try again."), error: true }]);
    }
  };

  const starters = STARTERS[role ?? ""] ?? STARTERS.staff;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className={`min-h-0 flex-1 space-y-4 overflow-y-auto ${compact ? "px-4 py-4" : "px-5 py-5"}`} aria-live="polite">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <ArunaAvatar />
              <p className="pt-1 text-sm text-ink-soft">Hi, I'm Aruna, your ZorHire help assistant. Ask me anything about using ZorHire: where to find something, how a feature works, or what to do next.</p>
            </div>
            <div className="flex flex-wrap gap-2 pl-11">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs text-ink-soft hover:border-navy-300 hover:bg-navy-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (m.role === "user" ? <UserBubble key={i} text={m.content} /> : <AssistantReply key={i} m={m} onNavigate={onNavigate} />))}
        {isLoading && (
          <div className="flex items-center gap-2 pl-11 text-sm text-muted" role="status">
            <span className="inline-flex gap-1" aria-hidden="true">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
            </span>
            Aruna is looking that up…
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); void send(text); }}
        className={`border-t border-line bg-white ${compact ? "p-3" : "p-4"}`}
      >
        <div className="flex items-end gap-2 rounded-xl border border-line bg-white px-3 py-2 focus-within:border-navy-400 focus-within:ring-2 focus-within:ring-navy-100">
          <label htmlFor="help-question" className="sr-only">Ask Aruna a question about ZorHire</label>
          <textarea
            id="help-question"
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
            rows={1}
            maxLength={1000}
            placeholder="Ask Aruna a question…"
            className="max-h-32 min-h-[24px] flex-1 resize-none border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-muted focus:ring-0"
          />
          <button type="submit" disabled={!text.trim() || isLoading} aria-label="Send question" className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-navy-700 text-white hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-40">
            <ArrowUp size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>Aruna is an AI and can be wrong. Check the linked guide when it matters.</span>
          {messages.length > 0 && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 rounded px-1 hover:text-ink">
              <RotateCcw size={12} aria-hidden="true" /> New chat
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy-700 px-3.5 py-2 text-sm text-white">{text}</p>
    </div>
  );
}

function AssistantReply({ m, onNavigate }: { m: HelpMessage; onNavigate?: () => void }) {
  const r = m.reply;
  return (
    <div className="flex items-start gap-3">
      <ArunaAvatar />
      <div className="min-w-0 flex-1">
        <div className={`rounded-2xl rounded-tl-md px-3.5 py-2.5 ${m.error ? "bg-danger-50 text-danger-700" : "bg-surface"}`}>
          {m.error ? <p className="text-sm">{m.content}</p> : <Markdown text={m.content} onNavigate={onNavigate} />}
        </div>
        {r && (r.links.length > 0 || r.articles.length > 0) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {r.links.map((l) => (
              <Link key={l.path} to={l.path} onClick={onNavigate} className="rounded-lg border border-navy-200 bg-white px-2.5 py-1 text-xs font-medium text-navy-700 hover:bg-navy-50">
                {l.label}
              </Link>
            ))}
            {r.articles.map((a) => (
              <Link key={a.slug} to={`/help/${a.slug}`} onClick={onNavigate} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white px-2.5 py-1 text-xs text-ink-soft hover:bg-surface">
                <BookOpen size={12} aria-hidden="true" /> {a.title}
              </Link>
            ))}
          </div>
        )}
        {r && !r.answered && r.support_email && (
          <p className="mt-2 text-xs text-muted">
            Still stuck? Email <a className="font-medium text-navy-700 underline" href={`mailto:${r.support_email}`}>{r.support_email}</a>.
          </p>
        )}
        {r && <Feedback id={r.id} />}
      </div>
    </div>
  );
}

function Feedback({ id }: { id: string }) {
  const [send] = useHelpFeedbackMutation();
  const [sent, setSent] = useState<boolean | null>(null);
  const rate = (helpful: boolean) => { setSent(helpful); void send({ id, helpful }).unwrap().catch(() => {}); };
  if (sent !== null) return <p className="mt-1.5 text-xs text-muted">{sent ? "Thanks for the feedback." : "Thanks. We'll use this to improve the help."}</p>;
  return (
    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted">
      <span className="mr-1">Helpful?</span>
      <button type="button" onClick={() => rate(true)} aria-label="Yes, this helped" className="rounded p-1 hover:bg-surface hover:text-ink"><ThumbsUp size={13} aria-hidden="true" /></button>
      <button type="button" onClick={() => rate(false)} aria-label="No, this didn't help" className="rounded p-1 hover:bg-surface hover:text-ink"><ThumbsDown size={13} aria-hidden="true" /></button>
    </div>
  );
}

function ArunaAvatar() {
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-ink" aria-hidden="true" title="Aruna">
      A
    </span>
  );
}
