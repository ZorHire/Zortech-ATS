import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle, Check, Copy, ExternalLink, Pause, Pencil, Play, RefreshCw, Search, Sparkles, Trash2, UserPlus, X,
} from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, PageHeader, PageSkeleton, useConfirm } from "../components/ui";
import type { BadgeTone } from "../components/ui";
import CampaignFormModal from "../components/linkedin/CampaignFormModal";
import { CAMPAIGN_STATUS } from "./LinkedInAgentPage";
import {
  useBulkLinkedInProspectsMutation,
  useDeleteLinkedInCampaignMutation,
  useGenerateLinkedInSearchMutation,
  useGetLinkedInAccountQuery,
  useGetLinkedInCampaignQuery,
  useGetLinkedInProspectsQuery,
  useProspectToCandidateMutation,
  useRegenerateLinkedInNoteMutation,
  useRequestLinkedInSearchMutation,
  useSetLinkedInCampaignStatusMutation,
  useUpdateLinkedInProspectMutation,
} from "../store/api/linkedinApi";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";
import type { LinkedInCampaign, LinkedInProspect, ProspectStatus } from "../types/linkedin";

const TABS: { key: string; label: string; statuses: ProspectStatus[] }[] = [
  { key: "review", label: "To review", statuses: ["scored", "new"] },
  { key: "approved", label: "Approved", statuses: ["approved", "queued"] },
  { key: "sent", label: "Sent", statuses: ["sent"] },
  { key: "accepted", label: "Accepted", statuses: ["accepted"] },
  { key: "other", label: "Skipped & issues", statuses: ["skipped", "failed", "needs_email", "already_connected"] },
];
const STATUS_LABEL: Record<ProspectStatus, { label: string; tone: BadgeTone }> = {
  new: { label: "Scoring…", tone: "neutral" },
  scored: { label: "To review", tone: "brand" },
  approved: { label: "Approved", tone: "navy" },
  queued: { label: "Sending", tone: "navy" },
  sent: { label: "Invite sent", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  skipped: { label: "Skipped", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
  needs_email: { label: "Needs their email", tone: "warning" },
  already_connected: { label: "Already connected", tone: "neutral" },
};
const scoreTone = (n: number | null): BadgeTone => (n == null ? "neutral" : n >= 80 ? "success" : n >= 60 ? "brand" : n >= 40 ? "warning" : "danger");

export default function LinkedInCampaignPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const confirm = useConfirm();
  const me = useAppSelector(selectCurrentUser);
  const [tab, setTab] = useState("review");
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const account = useGetLinkedInAccountQuery();
  const { data: c, isLoading, isError, error, refetch, isFetching } = useGetLinkedInCampaignQuery(id, { pollingInterval: 20000 });
  const prospects = useGetLinkedInProspectsQuery({ campaignId: id }, { pollingInterval: 20000, skip: !id });
  const [setStatus, { isLoading: statusBusy }] = useSetLinkedInCampaignStatusMutation();
  const [generate, { isLoading: generating }] = useGenerateLinkedInSearchMutation();
  const [runSearch, { isLoading: searching }] = useRequestLinkedInSearchMutation();
  const [remove] = useDeleteLinkedInCampaignMutation();
  const [bulk, { isLoading: bulkBusy }] = useBulkLinkedInProspectsMutation();

  const current = TABS.find((t) => t.key === tab)!;
  const rows = useMemo(() => (prospects.data ?? []).filter((p) => current.statuses.includes(p.status)), [prospects.data, current]);
  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.key, (prospects.data ?? []).filter((p) => t.statuses.includes(p.status)).length])), [prospects.data]);

  if (isLoading) return <PageSkeleton />;
  if (isError || !c) return <ErrorState error={error} onRetry={refetch} retrying={isFetching} />;

  const owner = me?.id === c.owner_user_id;
  const unresolvedCount = Object.values(c.unresolved).reduce((n, l) => n + l.length, 0);
  const extensionOnline = !!account.data?.extension_online;

  const act = async (fn: () => Promise<unknown>, ok: string, failMsg: string) => {
    try { await fn(); notify.success(ok); } catch (err) { notify.error(getErrorMessage(err, failMsg)); }
  };
  const toggleAll = (on: boolean) => setSelected(on ? new Set(rows.map((r) => r.id)) : new Set());
  const doBulk = async (action: "approve" | "skip", ids?: string[], allAbove?: number) => {
    try {
      const r = await bulk({ campaignId: c.id, action, ids, all_above: allAbove }).unwrap();
      notify.success(`${r.updated} ${action === "approve" ? "approved" : "skipped"}.`);
      setSelected(new Set());
    } catch (err) { notify.error(getErrorMessage(err, "Could not update.")); }
  };
  const del = async () => {
    const ok = await confirm({ title: "Delete this campaign?", message: "Its people and notes are removed from ZorHire. Invitations already sent on LinkedIn stay as they are.", confirmText: "Delete", danger: true });
    if (!ok) return;
    await remove(c.id);
    navigate("/linkedin-agent");
  };

  return (
    <div>
      <PageHeader
        title={c.name}
        breadcrumbs={[{ label: "LinkedIn agent", to: "/linkedin-agent" }, { label: c.name }]}
        subtitle={<span className="flex flex-wrap items-center gap-2">
          <Badge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</Badge>
          {c.channel === "recruiter_lite" && <Badge tone="navy">Recruiter Lite</Badge>}
          {c.auto_send && <Badge tone="brand">Autopilot ≥ {c.min_score}</Badge>}
          {c.job_id ? <Link to={`/jobs/${c.job_id}`} className="text-navy-600 hover:underline">{c.job_title}</Link> : <span>No job linked</span>}
          <span>· {c.daily_invite_limit}/day · {c.stats.sent_today} sent today</span>
        </span>}
        actions={owner && <div className="flex flex-wrap gap-2">
          {c.status === "active"
            ? <Button variant="secondary" icon={<Pause size={16} />} loading={statusBusy} onClick={() => act(() => setStatus({ id: c.id, status: "paused" }).unwrap(), "Campaign paused.", "Could not pause.")}>Pause</Button>
            : c.status !== "completed" && <Button icon={<Play size={16} />} loading={statusBusy} onClick={() => act(() => setStatus({ id: c.id, status: "active" }).unwrap(), "Campaign running. The extension will search and send approved invites in working hours.", "Could not start.")}>{c.status === "draft" ? "Start campaign" : "Resume"}</Button>}
          <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setEditing(true)}>Edit</Button>
          <Button variant="ghost" icon={<Trash2 size={16} />} onClick={del} aria-label="Delete campaign" />
        </div>}
      />

      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {!owner && (
          <div className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">
            This campaign belongs to {c.owner_name ?? "another recruiter"}. Invitations go out from their LinkedIn account, so only they can run it.
          </div>
        )}
        {owner && !extensionOnline && c.status === "active" && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-line bg-warning-50 p-3 text-sm text-warning-700">
            <AlertTriangle size={16} aria-hidden="true" /> Your ZorHire Assistant extension is offline. Open Chrome (signed in to LinkedIn) to let the campaign run.
          </div>
        )}

        {c.channel === "linkedin" ? <SearchCard c={c} owner={owner} generating={generating} searching={searching}
          onGenerate={() => act(() => generate(c.id).unwrap(), "Search rebuilt from the job.", "Could not build the search.")}
          onRun={() => act(() => runSearch(c.id).unwrap(), extensionOnline ? "Search queued. The extension runs it within a minute or two." : "Search queued. It runs when your extension is online.", "Could not queue the search.")}
          unresolvedCount={unresolvedCount} />
          : <RecruiterCard c={c} />}

        <section className="zh-card" aria-labelledby="li-people">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 pt-4">
            <h2 id="li-people" className="sr-only">People</h2>
            <div role="tablist" aria-label="People by status" className="-mb-px flex gap-4 overflow-x-auto">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); setSelected(new Set()); }}
                  className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${tab === t.key ? "border-navy-600 text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                  {t.label} <span className="ml-1 rounded-full bg-surface-sunken px-1.5 text-xs">{counts[t.key] ?? 0}</span>
                </button>
              ))}
            </div>
            {owner && tab === "review" && rows.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-3">
                {selected.size > 0 ? <>
                  <Button size="sm" icon={<Check size={14} />} loading={bulkBusy} onClick={() => doBulk("approve", [...selected])}>Approve {selected.size}</Button>
                  <Button size="sm" variant="secondary" icon={<X size={14} />} loading={bulkBusy} onClick={() => doBulk("skip", [...selected])}>Skip {selected.size}</Button>
                </> : <Button size="sm" variant="secondary" icon={<Check size={14} />} loading={bulkBusy} onClick={() => doBulk("approve", undefined, c.min_score)}>Approve all scoring {c.min_score}+</Button>}
              </div>
            )}
          </div>
          {prospects.isLoading ? <div className="p-6 text-sm text-muted">Loading people…</div>
            : prospects.isError ? <ErrorState error={prospects.error} onRetry={prospects.refetch} compact />
            : !rows.length ? <EmptyState compact icon={<Search size={22} />}
              title={tab === "review" ? "Nobody to review" : "Nobody here yet"}
              description={tab === "review" ? (c.stats.total ? "You've reviewed everyone found so far." : "Run the search, or open a LinkedIn search yourself and click \"Add to ZorHire\" on the page.") : undefined} />
            : <>
              {owner && tab === "review" && (
                <label className="flex items-center gap-2 border-b border-line px-5 py-2 text-xs text-muted">
                  <input type="checkbox" checked={selected.size === rows.length} onChange={(e) => toggleAll(e.target.checked)} /> Select all {rows.length}
                </label>
              )}
              <ul className="divide-y divide-line">
                {rows.map((p) => <ProspectRow key={p.id} p={p} c={c} owner={owner}
                  selectable={owner && tab === "review"} selected={selected.has(p.id)}
                  onSelect={(on) => setSelected((s) => { const n = new Set(s); on ? n.add(p.id) : n.delete(p.id); return n; })} />)}
              </ul>
            </>}
        </section>
      </div>

      <CampaignFormModal open={editing} onClose={() => setEditing(false)} campaign={c} hasRecruiterLite={!!account.data?.linkedin?.recruiter_lite} />
    </div>
  );
}

function SearchCard({ c, owner, generating, searching, onGenerate, onRun, unresolvedCount }: {
  c: LinkedInCampaign; owner: boolean; generating: boolean; searching: boolean; onGenerate: () => void; onRun: () => void; unresolvedCount: number;
}) {
  const s = c.search;
  const chips: [string, string[]][] = [
    ["Locations", s.locations], ["Current companies", s.current_companies], ["Past companies", s.past_companies],
    ["Industries", s.industries], ["Schools", s.schools], ["Excluding", s.exclude_keywords],
  ];
  const degree = s.network.map((n) => ({ F: "1st", S: "2nd", O: "3rd+" })[n]).join(", ");
  const pending = c.search_requested_at && (!c.last_search_at || new Date(c.search_requested_at) > new Date(c.last_search_at));
  return (
    <section className="zh-card p-5" aria-labelledby="li-search">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="li-search" className="text-base font-semibold text-ink">LinkedIn search</h2>
          <p className="text-sm text-muted">{c.last_search_at ? `Last run ${new Date(c.last_search_at).toLocaleString()}` : "Not run yet"}{pending ? " · run requested" : ""}. Running campaigns top up once a day when the queue runs low.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={c.search_url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink hover:bg-surface">
            <ExternalLink size={14} aria-hidden="true" /> Open in LinkedIn
          </a>
          {owner && c.job_id && <Button size="sm" variant="secondary" icon={<Sparkles size={14} />} loading={generating} onClick={onGenerate}>Rebuild with AI</Button>}
          {owner && <Button size="sm" icon={<RefreshCw size={14} />} loading={searching} onClick={onRun}>Run search now</Button>}
        </div>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3"><dt className="text-xs text-muted">Keywords</dt><dd className="font-mono text-ink">{s.keywords || "—"}</dd></div>
        <div><dt className="text-xs text-muted">Title</dt><dd className="text-ink">{s.title_keywords || "—"}</dd></div>
        <div><dt className="text-xs text-muted">Connection degree</dt><dd className="text-ink">{degree || "Any"}</dd></div>
        {chips.filter(([, v]) => v.length).map(([k, v]) => (
          <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="mt-0.5 flex flex-wrap gap-1">{v.map((x) => <Badge key={x} tone="neutral">{x}</Badge>)}</dd></div>
        ))}
      </dl>
      {unresolvedCount > 0 && (
        <p className="mt-3 text-xs text-muted">{unresolvedCount} filter value{unresolvedCount > 1 ? "s" : ""} will be matched to LinkedIn's own filters by your extension on the next run.</p>
      )}
      <p className="mt-3 text-xs text-muted">Want a filter that isn't here? Open the search in LinkedIn, refine it there, and click <b>Add to ZorHire</b> at the bottom right of the results page.</p>
    </section>
  );
}

function RecruiterCard({ c }: { c: LinkedInCampaign }) {
  const notify = useNotify();
  const r = c.recruiter_search;
  const copy = async (t: string) => { await navigator.clipboard.writeText(t); notify.success("Copied."); };
  if (!r) return <section className="zh-card p-5 text-sm text-muted">No Recruiter Lite search yet. Link a job and click Edit to rebuild it with AI.</section>;
  const rows: [string, string][] = [
    ["Job titles", r.job_titles.join(", ")], ["Skills", r.skills.join(", ")], ["Locations", r.locations.join(", ")],
    ["Companies", r.companies.join(", ")], ["Industries", r.industries.join(", ")],
    ["Years of experience", r.years_experience_min != null || r.years_experience_max != null ? `${r.years_experience_min ?? 0}–${r.years_experience_max ?? "any"}` : ""],
    ["Seniority", r.seniority.join(", ")],
  ];
  return (
    <section className="zh-card p-5" aria-labelledby="li-rl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="li-rl" className="text-base font-semibold text-ink">Recruiter Lite search</h2>
          <p className="max-w-2xl text-sm text-muted">Paste the Boolean into Recruiter Lite's keyword box and tick the filters below. Then click <b>Add to ZorHire</b> on the results page: the AI scores everyone and drafts an InMail for each.</p>
        </div>
        <a href="https://www.linkedin.com/talent/search" target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-white px-3 text-xs font-medium text-ink hover:bg-surface">
          <ExternalLink size={14} aria-hidden="true" /> Open Recruiter Lite
        </a>
      </div>
      <div className="mt-4 rounded-lg bg-surface-sunken p-3">
        <div className="flex items-start justify-between gap-3">
          <code className="flex-1 whitespace-pre-wrap break-words text-sm text-ink">{r.boolean || "—"}</code>
          <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={() => copy(r.boolean)}>Copy</Button>
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-2">
            <div><dt className="text-xs text-muted">{k}</dt><dd className="text-ink">{v}</dd></div>
            <button type="button" className="text-xs text-navy-600 hover:underline" onClick={() => copy(v)} aria-label={`Copy ${k}`}>Copy</button>
          </div>
        ))}
      </dl>
      {r.tips && <p className="mt-3 text-sm text-muted"><b className="text-ink">Tip:</b> {r.tips}</p>}
    </section>
  );
}

function ProspectRow({ p, c, owner, selectable, selected, onSelect }: {
  p: LinkedInProspect; c: LinkedInCampaign; owner: boolean; selectable: boolean; selected: boolean; onSelect: (on: boolean) => void;
}) {
  const notify = useNotify();
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(p.note ?? "");
  const [update, { isLoading: saving }] = useUpdateLinkedInProspectMutation();
  const [regen, { isLoading: regenerating }] = useRegenerateLinkedInNoteMutation();
  const [toCandidate, { isLoading: adding }] = useProspectToCandidateMutation();
  const limit = 300;
  const st = STATUS_LABEL[p.status];
  const canEdit = owner && ["new", "scored", "approved", "failed", "skipped"].includes(p.status);
  const link = p.profile_url ?? p.recruiter_url;

  const run = async (fn: () => Promise<unknown>, failMsg: string, ok?: string) => {
    try { await fn(); if (ok) notify.success(ok); } catch (err) { notify.error(getErrorMessage(err, failMsg)); }
  };
  const saveNote = () => run(async () => { await update({ id: p.id, campaignId: c.id, note }).unwrap(); setEditingNote(false); }, "Could not save the note.");
  const copyInmail = async () => {
    await navigator.clipboard.writeText(`${p.inmail_subject ?? ""}\n\n${p.note ?? ""}`);
    notify.success("InMail subject and message copied.");
  };

  return (
    <li className="flex items-start gap-3 px-5 py-4">
      {selectable && <input type="checkbox" className="mt-1.5" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label={`Select ${p.full_name ?? "person"}`} />}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {link ? <a href={link} target="_blank" rel="noreferrer" className="font-medium text-ink hover:text-navy-600 hover:underline">{p.full_name ?? p.public_id}</a>
            : <span className="font-medium text-ink">{p.full_name}</span>}
          {p.degree && <span className="text-xs text-muted">{p.degree}</span>}
          <Badge tone={scoreTone(p.match_score)}>{p.match_score == null ? "Not scored" : `AI ${p.match_score}`}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
          {p.candidate_id && <Link to={`/candidates?highlight=${p.candidate_id}`} className="text-xs text-navy-600 hover:underline">In Candidates</Link>}
        </div>
        <p className="mt-0.5 text-sm text-ink-soft">{p.headline}</p>
        <p className="text-xs text-muted">{[p.location, p.snippet].filter(Boolean).join(" · ")}</p>
        {!!p.match_reasons?.length && <p className="mt-1 text-xs text-muted">Why: {p.match_reasons.join(" · ")}</p>}
        {p.error && <p className="mt-1 text-xs text-danger-600">{p.error}</p>}

        {(p.note || canEdit) && p.status !== "new" && (
          <div className="mt-2 rounded-lg border border-line bg-surface p-3">
            <p className="mb-1 text-xs font-medium text-muted">{c.channel === "recruiter_lite" ? `InMail: ${p.inmail_subject ?? ""}` : c.use_notes ? "Connection note" : "Note (campaign sends without notes)"}</p>
            {editingNote ? (
              <div>
                <label htmlFor={`note-${p.id}`} className="sr-only">Connection note</label>
                <textarea id={`note-${p.id}`} className="zh-input min-h-[72px] text-sm" value={note} maxLength={limit} onChange={(e) => setNote(e.target.value)} />
                <div className="mt-1 flex items-center justify-between">
                  <span className={`text-xs ${note.length > 200 ? "text-warning-700" : "text-muted"}`}>{note.length}/{limit}{note.length > 200 ? " (free accounts allow 200)" : ""}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setNote(p.note ?? ""); setEditingNote(false); }}>Cancel</Button>
                    <Button size="sm" loading={saving} onClick={saveNote}>Save note</Button>
                  </div>
                </div>
              </div>
            ) : <p className="whitespace-pre-wrap text-sm text-ink">{p.note || "—"}{p.note_edited && <span className="ml-1 text-xs text-muted">(edited)</span>}</p>}
          </div>
        )}
      </div>
      {owner && (
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {["scored", "new", "failed", "skipped"].includes(p.status) && p.status !== "new" && (
            <Button size="sm" icon={<Check size={14} />} loading={saving} onClick={() => run(() => update({ id: p.id, campaignId: c.id, action: "approve" }).unwrap(), "Could not approve.")}>Approve</Button>
          )}
          {["scored", "approved", "queued", "failed"].includes(p.status) && (
            <Button size="sm" variant="ghost" icon={<X size={14} />} onClick={() => run(() => update({ id: p.id, campaignId: c.id, action: "skip" }).unwrap(), "Could not skip.")}>Skip</Button>
          )}
          {canEdit && p.status !== "new" && !editingNote && <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => setEditingNote(true)}>Edit note</Button>}
          {canEdit && p.status !== "new" && (
            <Button size="sm" variant="ghost" icon={<Sparkles size={14} />} loading={regenerating} onClick={() => run(() => regen({ id: p.id, campaignId: c.id }).unwrap(), "Could not rewrite the note.", "Note rewritten.")}>Rewrite</Button>
          )}
          {c.channel === "recruiter_lite" && p.note && <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={copyInmail}>Copy InMail</Button>}
          {!p.candidate_id && ["accepted", "sent", "scored", "approved"].includes(p.status) && (
            <Button size="sm" variant="ghost" icon={<UserPlus size={14} />} loading={adding}
              onClick={() => run(() => toCandidate({ id: p.id, campaignId: c.id }).unwrap(), "Could not add to candidates.", c.job_id ? "Added to Candidates and the job's pipeline." : "Added to Candidates.")}>Add to candidates</Button>
          )}
        </div>
      )}
    </li>
  );
}
