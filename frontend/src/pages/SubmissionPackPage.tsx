import { useEffect, useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Mail, Pencil, Printer, Save, Sparkles, X } from "lucide-react";
import { Badge, Button, ErrorState, Modal, PageSkeleton } from "../components/ui";
import {
  useGenerateSubmissionMutation,
  useGetSubmissionQuery,
  useSaveSubmissionMutation,
  useSendSubmissionMutation,
} from "../store/api/submissionsApi";
import type { PackContent, SkillLevel, SubmissionView } from "../store/api/submissionsApi";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";

const LEVEL: Record<SkillLevel, { label: string; cls: string }> = {
  strong: { label: "Strong", cls: "bg-success-50 text-success-700" },
  some: { label: "Some", cls: "bg-warning-50 text-warning-700" },
  not_shown: { label: "Not shown", cls: "bg-surface-sunken text-muted" },
};
const lpa = (n: number | null) => (n == null ? null : `${(n / 100000).toFixed(1).replace(/\.0$/, "")} LPA`);
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/**
 * Client-ready candidate profile for one job application. Prints to a clean A4 page
 * (browser "Save as PDF") or goes to the client by email; contact details are hidden
 * unless the recruiter turns them on.
 */
export default function SubmissionPackPage() {
  const { applicationId = "" } = useParams();
  const notify = useNotify();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetSubmissionQuery(applicationId);
  const [generate, { isLoading: generating }] = useGenerateSubmissionMutation();
  const [save, { isLoading: saving }] = useSaveSubmissionMutation();
  const [editing, setEditing] = useState<PackContent | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => { document.title = data ? `${data.facts.name} – ${data.job.title} profile` : "Client profile"; }, [data]);

  if (isLoading) return <PageSkeleton />;
  if (isError || !data) return <div className="p-8"><ErrorState error={error} onRetry={refetch} retrying={isFetching} /></div>;

  const pack = data.pack;
  const content = editing ?? pack?.content ?? null;
  const hasContent = !!content?.headline;

  const doGenerate = async () => {
    try {
      const r = await generate(applicationId).unwrap();
      setEditing(null);
      notify.success(r.ai ? `Profile written by AI${r.used_resume ? " from the resume" : " from the candidate record (no resume file)"}. Check it before sending.` : "Profile drafted from the candidate record (AI isn't configured). Add details before sending.");
    } catch (err) { notify.error(getErrorMessage(err, "Could not create the profile.")); }
  };
  const toggle = async (key: "hide_contacts" | "show_ctc", value: boolean) => {
    try { await save({ id: applicationId, [key]: value }).unwrap(); } catch (err) { notify.error(getErrorMessage(err, "Could not save.")); }
  };
  const saveEdits = async () => {
    if (!editing) return;
    try { await save({ id: applicationId, content: editing }).unwrap(); setEditing(null); notify.success("Profile saved."); }
    catch (err) { notify.error(getErrorMessage(err, "Could not save the profile.")); }
  };

  return (
    <div className="min-h-screen bg-surface print:bg-white">
      <div className="sticky top-0 z-10 border-b border-line bg-white print:hidden">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to={`/pipeline/${data.job.id}`} className="mr-auto inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" /> Back to pipeline
          </Link>
          {pack?.sent_at && <Badge tone="success">Sent {new Date(pack.sent_at).toLocaleDateString()}</Badge>}
          {editing ? <>
            <Button variant="ghost" icon={<X size={16} />} onClick={() => setEditing(null)}>Cancel</Button>
            <Button icon={<Save size={16} />} loading={saving} onClick={saveEdits}>Save changes</Button>
          </> : <>
            <Button variant="secondary" icon={<Sparkles size={16} />} loading={generating} loadingText="Writing…" onClick={doGenerate}>
              {hasContent ? "Rewrite with AI" : "Create with AI"}
            </Button>
            {hasContent && <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(structuredClone(content!))}>Edit</Button>}
            {hasContent && <Button variant="secondary" icon={<Printer size={16} />} onClick={() => window.print()}>Print / PDF</Button>}
            {hasContent && <Button icon={<Mail size={16} />} onClick={() => setSending(true)}>Email to client</Button>}
          </>}
        </div>
        {hasContent && !editing && (
          <div className="mx-auto flex max-w-4xl flex-wrap gap-4 px-4 pb-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={pack?.hide_contacts ?? true} onChange={(e) => toggle("hide_contacts", e.target.checked)} /> Hide candidate's email and phone</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={pack?.show_ctc ?? true} onChange={(e) => toggle("show_ctc", e.target.checked)} /> Show CTC</label>
            {pack?.edited && <span className="text-muted">Edited by you</span>}
          </div>
        )}
      </div>

      <main className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:p-0">
        {!hasContent ? (
          <div className="zh-card p-8 text-center">
            <h1 className="text-lg font-semibold text-ink">Client profile for {data.facts.name}</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted">
              AI reads {data.facts.has_resume ? "the resume" : "the candidate record (no resume file attached)"} against <b>{data.job.title}</b> and writes a one-page profile:
              why they fit, skills against the job, experience and a short recruiter's note. Contact details stay hidden.
            </p>
            <Button className="mt-5" icon={<Sparkles size={16} />} loading={generating} loadingText="Writing…" onClick={doGenerate}>Create with AI</Button>
          </div>
        ) : editing ? (
          <Editor value={editing} onChange={setEditing} />
        ) : (
          <Sheet v={data} content={content!} />
        )}
      </main>

      <SendModal open={sending} onClose={() => setSending(false)} v={data} />
    </div>
  );
}

function Sheet({ v, content: p }: { v: SubmissionView; content: PackContent }) {
  const f = v.facts;
  const hide = v.pack?.hide_contacts ?? true;
  const showCtc = v.pack?.show_ctc ?? true;
  const rows: [string, string | null][] = [
    ["Current role", [f.current_title, f.current_company].filter(Boolean).join(", ") || null],
    ["Total experience", f.experience_years != null ? `${f.experience_years} years` : null],
    ["Location", f.current_location],
    ["Preferred location", f.preferred_location],
    ["Notice period", f.notice_period_days != null ? `${f.notice_period_days} days` : null],
    ...(showCtc ? ([["Current CTC", lpa(f.current_ctc)], ["Expected CTC", lpa(f.expected_ctc)]] as [string, string | null][]) : []),
    ...(!hide ? ([["Email", f.email], ["Phone", f.phone]] as [string, string | null][]) : []),
  ];
  return (
    <article className="overflow-hidden rounded-lg border border-line bg-white shadow-card print:rounded-none print:border-0 print:shadow-none">
      <header className="flex items-start justify-between gap-4 bg-navy-600 px-6 py-5 text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <div>
          <p className="text-xs opacity-80">{v.company.name}{v.client.name ? ` · Candidate profile for ${v.client.name}` : ""}</p>
          <h1 className="mt-1 text-2xl font-bold">{f.name}</h1>
          <p className="mt-1 text-sm">{p.headline}</p>
          <p className="mt-2 text-xs font-semibold text-brand-400">For: {v.job.title}{v.job.location ? ` · ${v.job.location}` : ""}</p>
        </div>
        {v.company.is_platform_owner && <img src="/brand/zortech-logo-white.png" alt="ZorTech" className="h-8 w-auto" />}
      </header>
      <div className="space-y-5 px-6 py-5 text-sm text-ink">
        <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 print:grid-cols-2">
          {rows.filter(([, val]) => val).map(([k, val]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{val}</dd></div>
          ))}
        </dl>
        {p.summary.length > 0 && <section><h2 className="mb-1.5 text-sm font-semibold text-navy-700">Why this candidate</h2>
          <ul className="list-disc space-y-1 pl-5">{p.summary.map((s, i) => <li key={i}>{s}</li>)}</ul></section>}
        {p.skills_match.length > 0 && <section><h2 className="mb-1.5 text-sm font-semibold text-navy-700">Skills against the job</h2>
          <table className="w-full border-collapse"><tbody>{p.skills_match.map((s, i) => (
            <tr key={i} className="border-b border-line align-top">
              <td className="w-1/4 py-1.5 pr-2 font-medium">{s.skill}</td>
              <td className="w-24 py-1.5 pr-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL[s.level].cls}`}>{LEVEL[s.level].label}</span></td>
              <td className="py-1.5 text-ink-soft">{s.evidence}</td>
            </tr>))}</tbody></table></section>}
        {p.experience.length > 0 && <section><h2 className="mb-1.5 text-sm font-semibold text-navy-700">Experience</h2>
          <div className="space-y-2.5">{p.experience.map((e, i) => (
            <div key={i} className="break-inside-avoid"><p><b>{e.title}</b>, {e.company} <span className="text-muted">· {e.period}</span></p>
              {e.highlights.length > 0 && <ul className="mt-0.5 list-disc pl-5 text-ink-soft">{e.highlights.map((h, j) => <li key={j}>{h}</li>)}</ul>}</div>))}</div></section>}
        {p.education.length > 0 && <section><h2 className="mb-1.5 text-sm font-semibold text-navy-700">Education</h2>
          {p.education.map((e, i) => <p key={i}>{e.qualification}, {e.institution}{e.year ? ` (${e.year})` : ""}</p>)}</section>}
        {p.certifications.length > 0 && <section><h2 className="mb-1.5 text-sm font-semibold text-navy-700">Certifications</h2><p>{p.certifications.join(" · ")}</p></section>}
        {p.recruiter_note && <section className="break-inside-avoid rounded-md border-l-4 border-brand-500 bg-warning-50 px-4 py-3"><b>Recruiter's note:</b> {p.recruiter_note}</section>}
      </div>
    </article>
  );
}

function Editor({ value: v, onChange }: { value: PackContent; onChange: (p: PackContent) => void }) {
  const id = useId();
  const set = (patch: Partial<PackContent>) => onChange({ ...v, ...patch });
  return (
    <div className="zh-card space-y-5 p-6">
      <div><label htmlFor={`${id}-h`} className="zh-label">Headline</label>
        <input id={`${id}-h`} className="zh-input" maxLength={200} value={v.headline} onChange={(e) => set({ headline: e.target.value })} /></div>
      <div><label htmlFor={`${id}-s`} className="zh-label">Why this candidate (one point per line, up to 6)</label>
        <textarea id={`${id}-s`} className="zh-input min-h-[110px]" value={v.summary.join("\n")} onChange={(e) => set({ summary: lines(e.target.value).slice(0, 6) })} /></div>
      <fieldset><legend className="zh-label">Skills against the job</legend>
        <div className="space-y-2">{v.skills_match.map((s, i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_2fr_auto]">
            <input aria-label="Skill" className="zh-input" value={s.skill} onChange={(e) => set({ skills_match: v.skills_match.map((x, j) => (j === i ? { ...x, skill: e.target.value } : x)) })} />
            <select aria-label={`Level for ${s.skill}`} className="zh-input" value={s.level} onChange={(e) => set({ skills_match: v.skills_match.map((x, j) => (j === i ? { ...x, level: e.target.value as SkillLevel } : x)) })}>
              <option value="strong">Strong</option><option value="some">Some</option><option value="not_shown">Not shown</option>
            </select>
            <input aria-label={`Evidence for ${s.skill}`} className="zh-input" value={s.evidence} onChange={(e) => set({ skills_match: v.skills_match.map((x, j) => (j === i ? { ...x, evidence: e.target.value } : x)) })} />
            <Button variant="ghost" size="sm" aria-label={`Remove ${s.skill}`} onClick={() => set({ skills_match: v.skills_match.filter((_, j) => j !== i) })}><X size={14} /></Button>
          </div>))}
          <Button variant="link" size="sm" onClick={() => set({ skills_match: [...v.skills_match, { skill: "", level: "some", evidence: "" }] })}>Add skill</Button>
        </div></fieldset>
      <fieldset><legend className="zh-label">Experience</legend>
        <div className="space-y-3">{v.experience.map((e, i) => (
          <div key={i} className="rounded-lg border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              {(["title", "company", "period"] as const).map((k) => (
                <input key={k} aria-label={k} placeholder={k[0].toUpperCase() + k.slice(1)} className="zh-input" value={e[k]}
                  onChange={(ev) => set({ experience: v.experience.map((x, j) => (j === i ? { ...x, [k]: ev.target.value } : x)) })} />))}
            </div>
            <textarea aria-label="Highlights" placeholder="Highlights, one per line" className="zh-input mt-2 min-h-[64px]" value={e.highlights.join("\n")}
              onChange={(ev) => set({ experience: v.experience.map((x, j) => (j === i ? { ...x, highlights: lines(ev.target.value).slice(0, 4) } : x)) })} />
            <Button variant="link" size="sm" onClick={() => set({ experience: v.experience.filter((_, j) => j !== i) })}>Remove role</Button>
          </div>))}
          <Button variant="link" size="sm" onClick={() => set({ experience: [...v.experience, { title: "", company: "", period: "", highlights: [] }] })}>Add role</Button>
        </div></fieldset>
      <div><label htmlFor={`${id}-c`} className="zh-label">Certifications (one per line)</label>
        <textarea id={`${id}-c`} className="zh-input min-h-[56px]" value={v.certifications.join("\n")} onChange={(e) => set({ certifications: lines(e.target.value).slice(0, 10) })} /></div>
      <div><label htmlFor={`${id}-n`} className="zh-label">Recruiter's note</label>
        <textarea id={`${id}-n`} className="zh-input min-h-[72px]" maxLength={800} value={v.recruiter_note} onChange={(e) => set({ recruiter_note: e.target.value })} /></div>
    </div>
  );
}

function SendModal({ open, onClose, v }: { open: boolean; onClose: () => void; v: SubmissionView }) {
  const id = useId();
  const notify = useNotify();
  const [send, { isLoading }] = useSendSubmissionMutation();
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attach, setAttach] = useState(false);
  const [mark, setMark] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTo(v.client.contact_email ?? "");
    setCc("");
    setSubject(`Profile: ${v.facts.name} for ${v.job.title}`);
    setMessage(`Hi ${v.client.contact_name?.split(" ")[0] ?? ""},\n\nPlease find below the profile of ${v.facts.name} for the ${v.job.title} role. Happy to set up an interview at your convenience.\n\nRegards`);
    setAttach(false);
    setMark(true);
  }, [open, v]);

  const submit = async () => {
    try {
      const r = await send({ id: v.application_id, body: { to: to.split(/[,;\s]+/).filter(Boolean), cc: cc.split(/[,;\s]+/).filter(Boolean), subject, message, attach_resume: attach, mark_submitted: mark } }).unwrap();
      notify.success(`Sent from ${r.from}.${r.moved_to_submitted ? " Moved to Submitted to client." : ""}`);
      onClose();
    } catch (err) { notify.error(getErrorMessage(err, "Could not send the email.")); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" preventClose={isLoading} title="Email profile to client"
      description="The profile goes in the email body, sent from your mailbox (or the company mailbox if yours isn't connected)."
      footer={<><Button variant="ghost" onClick={onClose} disabled={isLoading}>Cancel</Button><Button icon={<Mail size={16} />} loading={isLoading} onClick={submit}>Send</Button></>}>
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-to`} className="zh-label">To</label><input id={`${id}-to`} className="zh-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="hiring.manager@client.com" /></div>
          <div><label htmlFor={`${id}-cc`} className="zh-label">Cc <span className="font-normal text-muted">(optional)</span></label><input id={`${id}-cc`} className="zh-input" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        </div>
        <div><label htmlFor={`${id}-s`} className="zh-label">Subject</label><input id={`${id}-s`} className="zh-input" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><label htmlFor={`${id}-m`} className="zh-label">Message above the profile</label><textarea id={`${id}-m`} className="zh-input min-h-[110px]" maxLength={3000} value={message} onChange={(e) => setMessage(e.target.value)} /></div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" checked={attach} disabled={!v.facts.has_resume} onChange={(e) => setAttach(e.target.checked)} />
          <span>Attach the original resume {v.facts.has_resume ? <span className="text-warning-700">(it usually includes the candidate's phone and email)</span> : <span className="text-muted">(no resume file on record)</span>}</span>
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={mark} onChange={(e) => setMark(e.target.checked)} /> Move the candidate to "Submitted to client"</label>
      </div>
    </Modal>
  );
}
