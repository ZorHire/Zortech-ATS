import { useEffect, useId, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button, Modal } from "../ui";
import { useGetJobsQuery } from "../../store/api/jobApi";
import { useCreateLinkedInCampaignMutation, useUpdateLinkedInCampaignMutation } from "../../store/api/linkedinApi";
import { useNotify } from "../../hooks/useNotify";
import { getErrorMessage } from "../../lib/format";
import type { CampaignChannel, LinkedInCampaign, Network, SearchFilters } from "../../types/linkedin";

const EMPTY: SearchFilters = {
  keywords: "", title_keywords: "", locations: [], current_companies: [], past_companies: [], industries: [], schools: [],
  network: ["S", "O"], profile_languages: [], exclude_keywords: [],
};
const NETWORKS: { value: Network; label: string }[] = [
  { value: "F", label: "1st" },
  { value: "S", label: "2nd" },
  { value: "O", label: "3rd+" },
];
const list = (s: string) => s.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);

interface Props {
  open: boolean;
  onClose: () => void;
  /** Edit this campaign; omit to create. */
  campaign?: LinkedInCampaign | null;
  hasRecruiterLite: boolean;
  defaultJobId?: string;
  onCreated?: (c: LinkedInCampaign) => void;
}

export default function CampaignFormModal({ open, onClose, campaign, hasRecruiterLite, defaultJobId, onCreated }: Props) {
  const notify = useNotify();
  const uid = useId();
  const editing = !!campaign;
  const { data: jobs } = useGetJobsQuery(undefined, { skip: !open || editing });
  const [create, { isLoading: creating }] = useCreateLinkedInCampaignMutation();
  const [update, { isLoading: updating }] = useUpdateLinkedInCampaignMutation();

  const [name, setName] = useState("");
  const [jobId, setJobId] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("linkedin");
  const [generate, setGenerate] = useState(true);
  const [f, setF] = useState<SearchFilters>(EMPTY);
  const [text, setText] = useState({ locations: "", current_companies: "", past_companies: "", industries: "", schools: "", exclude_keywords: "", profile_languages: "" });
  const [notes, setNotes] = useState("");
  const [useNotes, setUseNotes] = useState(true);
  const [daily, setDaily] = useState(15);
  const [autoSend, setAutoSend] = useState(false);
  const [minScore, setMinScore] = useState(60);
  const [pages, setPages] = useState(3);

  useEffect(() => {
    if (!open) return;
    const c = campaign;
    setName(c?.name ?? "");
    setJobId(c?.job_id ?? defaultJobId ?? "");
    setChannel(c?.channel ?? "linkedin");
    setGenerate(true);
    const s = c?.search ?? EMPTY;
    setF(s);
    setText({
      locations: s.locations.join(", "), current_companies: s.current_companies.join(", "), past_companies: s.past_companies.join(", "),
      industries: s.industries.join(", "), schools: s.schools.join(", "), exclude_keywords: s.exclude_keywords.join(", "),
      profile_languages: s.profile_languages.join(", "),
    });
    setNotes(c?.note_instructions ?? "");
    setUseNotes(c?.use_notes ?? true);
    setDaily(c?.daily_invite_limit ?? 15);
    setAutoSend(c?.auto_send ?? false);
    setMinScore(c?.min_score ?? 60);
    setPages(c?.max_pages ?? 3);
  }, [open, campaign, defaultJobId]);

  const showFilters = editing || !jobId || !generate;
  const filters = (): SearchFilters => ({
    ...f,
    locations: list(text.locations), current_companies: list(text.current_companies), past_companies: list(text.past_companies),
    industries: list(text.industries), schools: list(text.schools), exclude_keywords: list(text.exclude_keywords),
    profile_languages: list(text.profile_languages).map((x) => x.toLowerCase()).filter((x) => /^[a-z]{2}$/.test(x)),
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing && !name.trim() && !jobId) { notify.error("Give the campaign a name or pick a job."); return; }
    const body = {
      name: name.trim() || undefined, channel, note_instructions: notes.trim() || null, use_notes: useNotes,
      daily_invite_limit: daily, auto_send: autoSend, min_score: minScore, max_pages: pages,
      ...(showFilters ? { search: filters() } : {}),
    };
    try {
      if (editing && campaign) {
        await update({ id: campaign.id, body }).unwrap();
        notify.success("Campaign saved.");
      } else {
        const c = await create({ ...body, job_id: jobId || null, generate: !!jobId && generate }).unwrap();
        notify.success(jobId && generate ? "Campaign created. The AI built the LinkedIn search from the job." : "Campaign created.");
        onCreated?.(c);
      }
      onClose();
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not save the campaign."));
    }
  };

  const field = (key: keyof typeof text, label: string, hint: string, placeholder: string) => (
    <div>
      <label htmlFor={`${uid}-${key}`} className="zh-label">{label}</label>
      <input id={`${uid}-${key}`} className="zh-input" value={text[key]} placeholder={placeholder}
        onChange={(e) => setText((t) => ({ ...t, [key]: e.target.value }))} aria-describedby={`${uid}-${key}-h`} />
      <p id={`${uid}-${key}-h`} className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} size="lg" preventClose={creating || updating}
      title={editing ? "Edit LinkedIn campaign" : "New LinkedIn campaign"}
      description="Find matching people on LinkedIn, let the AI score them and write personal notes, then send connection requests at a safe pace."
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={creating || updating}>Cancel</Button>
        <Button type="submit" form={`${uid}-form`} loading={creating || updating} loadingText={!editing && jobId && generate ? "Building search…" : "Saving…"}
          icon={!editing && jobId && generate ? <Sparkles size={16} /> : undefined}>
          {editing ? "Save campaign" : "Create campaign"}
        </Button>
      </>}>
      <form id={`${uid}-form`} onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${uid}-name`} className="zh-label">Campaign name</label>
            <input id={`${uid}-name`} className="zh-input" value={name} maxLength={120} placeholder={jobId ? "Defaults to the job title" : "e.g. SAP FICO consultants, Hyderabad"} onChange={(e) => setName(e.target.value)} />
          </div>
          {!editing && (
            <div>
              <label htmlFor={`${uid}-job`} className="zh-label">Job <span className="font-normal text-muted">(recommended)</span></label>
              <select id={`${uid}-job`} className="zh-input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
                <option value="">No job: I'll set the filters myself</option>
                {(jobs ?? []).filter((j) => !["closed_filled", "closed_cancelled"].includes(j.status)).map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            </div>
          )}
        </div>

        <fieldset>
          <legend className="zh-label">Where to search</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${channel === "linkedin" ? "border-navy-400 bg-navy-50" : "border-line"}`}>
              <input type="radio" name={`${uid}-ch`} checked={channel === "linkedin"} onChange={() => setChannel("linkedin")} className="mt-1" />
              <span><b className="text-sm text-ink">LinkedIn search</b><span className="block text-xs text-muted">Runs automatically and sends connection requests with notes.</span></span>
            </label>
            <label className={`flex items-start gap-2 rounded-lg border p-3 ${!hasRecruiterLite ? "cursor-not-allowed opacity-60" : "cursor-pointer"} ${channel === "recruiter_lite" ? "border-navy-400 bg-navy-50" : "border-line"}`}>
              <input type="radio" name={`${uid}-ch`} disabled={!hasRecruiterLite} checked={channel === "recruiter_lite"} onChange={() => setChannel("recruiter_lite")} className="mt-1" />
              <span><b className="text-sm text-ink">Recruiter Lite</b><span className="block text-xs text-muted">
                {hasRecruiterLite ? "AI builds the Boolean and filter list; import results with the extension and get InMail drafts." : "Needs an active Recruiter Lite subscription."}
              </span></span>
            </label>
          </div>
        </fieldset>

        {!editing && jobId && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={generate} onChange={(e) => setGenerate(e.target.checked)} className="mt-0.5" />
            <span><b>Let the AI build the search from the job</b> (keywords, titles, locations, companies and exclusions). You can edit everything afterwards.</span>
          </label>
        )}

        {showFilters && (
          <fieldset className="space-y-4 rounded-lg border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">LinkedIn filters</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor={`${uid}-kw`} className="zh-label">Keywords</label>
                <input id={`${uid}-kw`} className="zh-input" value={f.keywords} maxLength={500} placeholder='e.g. ("SAP FICO" OR "S/4HANA Finance") AND consultant'
                  onChange={(e) => setF({ ...f, keywords: e.target.value })} />
                <p className="mt-1 text-xs text-muted">Supports AND, OR, NOT, brackets and "quoted phrases". Keep it short: long strings return nothing on LinkedIn.</p>
              </div>
              <div>
                <label htmlFor={`${uid}-title`} className="zh-label">Title</label>
                <input id={`${uid}-title`} className="zh-input" value={f.title_keywords} maxLength={200} placeholder="e.g. FICO consultant" onChange={(e) => setF({ ...f, title_keywords: e.target.value })} />
              </div>
              <fieldset>
                <legend className="zh-label">Connection degree</legend>
                <div className="flex gap-4 pt-2">
                  {NETWORKS.map((n) => (
                    <label key={n.value} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" checked={f.network.includes(n.value)}
                        onChange={(e) => setF({ ...f, network: e.target.checked ? [...f.network, n.value] : f.network.filter((x) => x !== n.value) })} />
                      {n.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {field("locations", "Locations", "Comma-separated, as LinkedIn spells them.", "Hyderabad, Bengaluru")}
              {field("current_companies", "Current companies", "Optional. Never the hiring client.", "Infosys, Deloitte")}
              {field("past_companies", "Past companies", "Optional.", "Accenture")}
              {field("industries", "Industries", "LinkedIn industry names.", "IT Services and IT Consulting")}
              {field("schools", "Schools", "Optional.", "IIT Madras")}
              {field("profile_languages", "Profile languages", "Two-letter codes.", "en")}
              <div className="md:col-span-2">{field("exclude_keywords", "Exclude people who mention", "Added as NOT terms.", "recruiter, trainer, student")}</div>
            </div>
            <p className="text-xs text-muted">The extension looks up LinkedIn's ids for locations, companies, industries and schools in your browser, so the search uses LinkedIn's real filters.</p>
          </fieldset>
        )}

        <fieldset className="space-y-4 rounded-lg border border-line p-4">
          <legend className="px-1 text-sm font-semibold text-ink">Outreach</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useNotes} onChange={(e) => setUseNotes(e.target.checked)} />
            Add a personal note to each connection request (free LinkedIn accounts get only a few notes a month; the agent carries on without notes when they run out)
          </label>
          <div>
            <label htmlFor={`${uid}-notes`} className="zh-label">Instructions for the note writer <span className="font-normal text-muted">(optional)</span></label>
            <textarea id={`${uid}-notes`} className="zh-input min-h-[72px]" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Mention it's a 6-month contract-to-hire, immediate joiners preferred. Don't mention the client." />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor={`${uid}-daily`} className="zh-label">Invites per day</label>
              <input id={`${uid}-daily`} type="number" min={1} max={40} className="zh-input" value={daily} onChange={(e) => setDaily(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
              <p className="mt-1 text-xs text-muted">Across all campaigns you send at most 40 a day and 100 a week.</p>
            </div>
            <div>
              <label htmlFor={`${uid}-pages`} className="zh-label">Search pages per run</label>
              <input id={`${uid}-pages`} type="number" min={1} max={10} className="zh-input" value={pages} onChange={(e) => setPages(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
              <p className="mt-1 text-xs text-muted">About 10 people per page.</p>
            </div>
            <div>
              <label htmlFor={`${uid}-min`} className="zh-label">Minimum AI score</label>
              <input id={`${uid}-min`} type="number" min={0} max={100} className="zh-input" value={minScore} onChange={(e) => setMinScore(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} className="mt-0.5" />
            <span><b>Autopilot:</b> send invites automatically to people scoring {minScore}+ without my review. When off, you approve each person and note first.</span>
          </label>
        </fieldset>
      </form>
    </Modal>
  );
}
