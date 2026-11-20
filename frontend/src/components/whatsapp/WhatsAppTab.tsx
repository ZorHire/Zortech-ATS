import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, CheckCheck, Clock, ExternalLink, Send, AlertTriangle } from "lucide-react";
import { Button, ErrorState, Skeleton } from "../ui";
import { useConfirmWhatsAppSentMutation, useGetMyWhatsAppQuery, useGetWhatsAppThreadQuery, useSendWhatsAppMutation } from "../../store/api/whatsappApi";
import type { WhatsAppMessage } from "../../store/api/whatsappApi";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser } from "../../store/slices/authSlice";
import { useNotify } from "../../hooks/useNotify";
import { getErrorMessage } from "../../lib/format";

interface Props {
  candidateId: string;
  firstName: string;
  jobTitle?: string | null;
}

const STATUS_ICON: Record<WhatsAppMessage["status"], { icon: JSX.Element; label: string }> = {
  prepared: { icon: <Clock size={12} />, label: "Opened in WhatsApp, not confirmed" },
  sent: { icon: <Check size={12} />, label: "Sent" },
  delivered: { icon: <CheckCheck size={12} />, label: "Delivered" },
  read: { icon: <CheckCheck size={12} className="text-sky-500" />, label: "Read" },
  failed: { icon: <AlertTriangle size={12} className="text-danger-600" />, label: "Failed" },
  received: { icon: <></>, label: "Received" },
};

/** WhatsApp conversation with one candidate, from the signed-in recruiter's own number. */
export default function WhatsAppTab({ candidateId, firstName, jobTitle }: Props) {
  const id = useId();
  const notify = useNotify();
  const me = useAppSelector(selectCurrentUser);
  const mine = useGetMyWhatsAppQuery();
  const { data, isLoading, isError, error, refetch } = useGetWhatsAppThreadQuery(candidateId, { pollingInterval: 15000 });
  const [send, { isLoading: sending }] = useSendWhatsAppMutation();
  const [confirmSent] = useConfirmWhatsAppSentMutation();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const sender = me?.full_name?.split(" ")[0] ?? "your recruiter";
  const role = jobTitle ? `the ${jobTitle} role` : "a role we're hiring for";

  const QUICK = [
    { label: "Interested?", text: `Hi ${firstName}, this is ${sender}. I came across your profile for ${role}. Would you be open to a quick chat about it?` },
    { label: "Share CV", text: `Hi ${firstName}, could you please share your updated CV, current and expected CTC and notice period?` },
    { label: "Interview reminder", text: `Hi ${firstName}, a quick reminder about your interview for ${role}. Please reply here if you need to reschedule.` },
    { label: "Still interested?", text: `Hi ${firstName}, just checking in: are you still interested in ${role}? Happy to answer any questions.` },
  ];

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [data?.messages.length]);

  if (mine.isLoading || isLoading) return <div className="space-y-2 p-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="ml-auto h-10 w-2/3" /></div>;
  if (isError || !data) return <ErrorState error={error} onRetry={refetch} compact />;

  const number = mine.data?.number;
  if (!number) {
    return (
      <div className="rounded-lg border border-line bg-surface p-5 text-sm">
        <p className="font-medium text-ink">Set your WhatsApp number first</p>
        <p className="mt-1 text-muted">Messages go from your own number. It takes a few seconds and works with any WhatsApp account.</p>
        <Link to="/settings/whatsapp" className="mt-3 inline-block font-medium text-navy-600 hover:underline">Open WhatsApp settings</Link>
      </div>
    );
  }
  if (!data.candidate_phone) {
    return <p className="rounded-lg border border-line bg-surface p-5 text-sm text-muted">This candidate has no valid phone number. Add one (with country code for numbers outside India) on the Overview tab.</p>;
  }

  const submit = async () => {
    try {
      const r = await send({ candidateId, text }).unwrap();
      if (r.mode === "click" && r.url) {
        window.open(r.url, "_blank", "noopener");
        notify.success("WhatsApp opened with your message. Press Send there, then mark it sent here.");
      } else {
        notify.success(r.template ? "Sent as your company's WhatsApp template (the candidate hasn't messaged in the last 24 hours)." : "Sent on WhatsApp.");
      }
      setText("");
    } catch (err) { notify.error(getErrorMessage(err, "Could not send.")); }
  };

  return (
    <div className="flex h-full flex-col">
      <p className="mb-2 text-xs text-muted">
        From +{number.phone_e164} to +{data.candidate_phone} · {number.mode === "api" ? (data.session_open ? "Automatic, free-form (candidate replied in the last 24 h)" : "Automatic, sent as your company template") : "Click to send: opens WhatsApp for you to press Send"}
      </p>
      <div className="min-h-[200px] flex-1 space-y-2 overflow-y-auto rounded-lg bg-surface-sunken p-3" aria-live="polite">
        {data.messages.length === 0 && <p className="py-8 text-center text-sm text-muted">No WhatsApp messages with {firstName} yet.</p>}
        {data.messages.map((m) => {
          const out = m.direction === "out";
          const st = STATUS_ICON[m.status];
          return (
            <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${out ? "bg-[#DCF8C6] text-ink" : "bg-white text-ink"}`}>
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted">
                  {out && m.sender_name && <span>{m.sender_name} ·</span>}
                  {m.template && <span>template ·</span>}
                  {new Date(m.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  {out && <span title={st.label} aria-label={st.label}>{st.icon}</span>}
                </p>
                {m.status === "failed" && m.error && <p className="mt-1 text-xs text-danger-600">{m.error}</p>}
                {m.status === "prepared" && (
                  <div className="mt-1 flex justify-end gap-3 text-xs">
                    <a className="inline-flex items-center gap-1 text-navy-600 hover:underline" href={`https://wa.me/${data.candidate_phone}?text=${encodeURIComponent(m.body)}`} target="_blank" rel="noreferrer"><ExternalLink size={12} /> Open again</a>
                    <button type="button" className="font-medium text-navy-600 hover:underline" onClick={() => confirmSent({ id: m.id, candidateId })}>I sent it</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button key={q.label} type="button" onClick={() => setText(q.text)} className="rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-soft hover:border-navy-300 hover:text-ink">{q.label}</button>
        ))}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <label htmlFor={`${id}-t`} className="sr-only">WhatsApp message</label>
        <textarea id={`${id}-t`} className="zh-input min-h-[64px] flex-1" maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${firstName} on WhatsApp`} />
        <Button icon={<Send size={16} />} loading={sending} disabled={!text.trim()} onClick={submit}>{number.mode === "api" ? "Send" : "Open WhatsApp"}</Button>
      </div>
    </div>
  );
}
