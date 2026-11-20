import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Inbox, Linkedin, Plus, Send, UserCheck, Users } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, PageHeader, Skeleton, StatCard } from "../components/ui";
import type { BadgeTone } from "../components/ui";
import ConnectExtensionCard from "../components/linkedin/ConnectExtensionCard";
import CampaignFormModal from "../components/linkedin/CampaignFormModal";
import { useGetLinkedInAccountQuery, useGetLinkedInCampaignsQuery, useGetLinkedInSummaryQuery } from "../store/api/linkedinApi";
import type { CampaignStatus } from "../types/linkedin";
import AiUsageBanner from "../components/ai/AiUsageBanner";

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Running", tone: "success" },
  paused: { label: "Paused", tone: "warning" },
  completed: { label: "Completed", tone: "navy" },
};

export default function LinkedInAgentPage() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [params, setParams] = useSearchParams();
  const newFor = params.get("newFor") ?? undefined; // "Source on LinkedIn" from a job page
  const [creating, setCreating] = useState(!!newFor);
  const account = useGetLinkedInAccountQuery();
  const summary = useGetLinkedInSummaryQuery(undefined, { pollingInterval: 30000 });
  const campaigns = useGetLinkedInCampaignsQuery({ scope }, { pollingInterval: 30000 });
  const hasRecruiterLite = !!account.data?.linkedin?.recruiter_lite;
  const s = summary.data;

  return (
    <div>
      <PageHeader
        title="LinkedIn agent"
        subtitle="Search LinkedIn with every filter, let AI score people and write personal notes, and send connection requests from your own account at a safe pace."
        actions={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>New campaign</Button>}
      />
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <AiUsageBanner meters={["linkedin_prospects"]} />
        <ConnectExtensionCard />

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="To review" value={s?.to_review ?? 0} hint="People with AI notes waiting for you" icon={<Inbox size={18} />} tone="brand" loading={summary.isLoading} />
          <StatCard label="Sent today" value={s?.sent_today ?? 0} hint={`${s?.sent_this_week ?? 0} this week`} icon={<Send size={18} />} loading={summary.isLoading} />
          <StatCard label="Invitations sent" value={s?.sent ?? 0} hint="All campaigns" icon={<Users size={18} />} loading={summary.isLoading} />
          <StatCard label="Accepted" value={s?.accepted ?? 0}
            hint={s?.sent ? `${Math.round((100 * (s.accepted ?? 0)) / s.sent)}% acceptance` : "Added to Candidates automatically"}
            icon={<UserCheck size={18} />} tone="success" loading={summary.isLoading} />
        </div>

        <section className="zh-card" aria-labelledby="li-campaigns">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 id="li-campaigns" className="text-base font-semibold text-ink">Campaigns</h2>
            <div role="tablist" aria-label="Whose campaigns" className="inline-flex rounded-lg bg-surface-sunken p-0.5 text-sm">
              {(["mine", "all"] as const).map((v) => (
                <button key={v} role="tab" aria-selected={scope === v} onClick={() => setScope(v)}
                  className={`rounded-md px-3 py-1.5 font-medium ${scope === v ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
                  {v === "mine" ? "Mine" : "Everyone's"}
                </button>
              ))}
            </div>
          </div>
          {campaigns.isLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : campaigns.isError ? (
            <ErrorState error={campaigns.error} onRetry={campaigns.refetch} retrying={campaigns.isFetching} compact />
          ) : !campaigns.data?.length ? (
            <EmptyState icon={<Linkedin size={22} />} title="No LinkedIn campaigns yet"
              description="Pick a job and the AI builds the LinkedIn search for it: keywords, titles, locations, target companies and exclusions."
              action={<Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>Create your first campaign</Button>} />
          ) : (
            <ul className="divide-y divide-line">
              {campaigns.data.map((c) => (
                <li key={c.id}>
                  <Link to={`/linkedin-agent/campaigns/${c.id}`} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-surface focus-visible:bg-surface">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium text-ink">{c.name}</span>
                        <Badge tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</Badge>
                        {c.channel === "recruiter_lite" && <Badge tone="navy">Recruiter Lite</Badge>}
                        {c.auto_send && <Badge tone="brand">Autopilot</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {c.job_title ? `For ${c.job_title}` : "No job linked"}{scope === "all" && c.owner_name ? ` · ${c.owner_name}` : ""}
                        {c.last_search_at ? ` · searched ${new Date(c.last_search_at).toLocaleDateString()}` : " · not searched yet"}
                      </p>
                    </div>
                    <dl className="grid grid-cols-4 gap-4 text-center text-sm">
                      <div><dt className="text-xs text-muted">Found</dt><dd className="font-semibold text-ink">{c.stats.total}</dd></div>
                      <div><dt className="text-xs text-muted">Review</dt><dd className={`font-semibold ${c.stats.to_review ? "text-brand-700" : "text-ink"}`}>{c.stats.to_review}</dd></div>
                      <div><dt className="text-xs text-muted">Sent</dt><dd className="font-semibold text-ink">{c.stats.sent}</dd></div>
                      <div><dt className="text-xs text-muted">Accepted</dt><dd className="font-semibold text-success-700">{c.stats.accepted}</dd></div>
                    </dl>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CampaignFormModal open={creating} hasRecruiterLite={hasRecruiterLite} defaultJobId={newFor}
        onClose={() => { setCreating(false); if (newFor) setParams({}, { replace: true }); }}
        onCreated={(c) => navigate(`/linkedin-agent/campaigns/${c.id}`)} />
    </div>
  );
}
