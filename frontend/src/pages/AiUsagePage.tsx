import { Bot, FileText, Linkedin, MessagesSquare, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, ErrorState, PageHeader, Skeleton } from "../components/ui";
import { useGetAiUsageQuery, type AiMeter, type AiMeterStatus } from "../store/api/aiUsageApi";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";

const ICONS: Record<AiMeter, LucideIcon> = {
  shortlists: Bot,
  screenings: MessagesSquare,
  client_profiles: FileText,
  linkedin_prospects: Linkedin,
};

const WHAT: Record<AiMeter, string> = {
  shortlists: "Each candidate the AI assesses against a job (Autopilot or a recruiter's click). Re-assessing the same candidate this month is free.",
  screenings: "Each AI screening interview sent to a candidate, including its evaluation. An interview a candidate has started always finishes.",
  client_profiles: "Each candidate profile the AI writes for a client. Rewriting the same profile this month is free.",
  linkedin_prospects: "Each LinkedIn person the AI scores and writes a note for. When this runs out, people are still scored with keywords and a template note.",
};

const PLAN_NAMES: Record<string, string> = { starter: "Starter", growth: "Growth", enterprise: "Enterprise" };

const fmt = (n: number) => n.toLocaleString("en-IN");
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long" });

export default function AiUsagePage() {
  const { data, isLoading, isError, error, refetch } = useGetAiUsageQuery(undefined, { refetchOnMountOrArgChange: true, pollingInterval: 60_000 });
  const user = useAppSelector(selectCurrentUser);
  const isAdmin = user?.role === "super_admin" || user?.role === "accounts_manager";

  const subtitle = data
    ? data.unlimited
      ? "Your company has no monthly AI limit."
      : `Your plan includes these AI actions each month, shared by your whole team. The count resets on ${fmtDate(data.resets_at)}.`
    : "AI actions included in your plan this month.";

  return (
    <div>
      <PageHeader title="AI usage" subtitle={subtitle} />
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {isLoading && <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <div key={i} className="zh-card p-5"><Skeleton className="h-24 w-full" /></div>)}</div>}
        {isError && <div className="zh-card"><ErrorState error={error} onRetry={refetch} compact /></div>}
        {data && (
          <>
            {!data.unlimited && (
              <div className="zh-card flex flex-wrap items-center gap-x-6 gap-y-2 p-5 text-sm">
                <span>Plan: <strong>{data.plan ? PLAN_NAMES[data.plan] ?? data.plan : "None"}</strong>{data.subscription_status === "trial" && <Badge tone="info" className="ml-2">Free trial</Badge>}</span>
                {data.subscription_status !== "trial" && <span>Users counted: <strong>{fmt(data.billable_users)}</strong>{data.billable_users > data.users && <span className="text-muted"> (plan minimum; {fmt(data.users)} active)</span>}{data.billable_users < data.users && <span className="text-muted"> (seats paid for; {fmt(data.users)} active. New users count from the next renewal)</span>}</span>}
                {data.subscription_status === "trial" && <span className="text-muted">A trial includes a fixed number of AI actions for the whole company.</span>}
                {isAdmin && <Link to="/subscription" className="font-medium text-navy-700 underline underline-offset-2 hover:text-navy-800">Change plan</Link>}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {data.meters.map((m) => <MeterCard key={m.key} m={m} />)}
            </div>
            {!data.unlimited && (
              <p className="max-w-3xl text-sm text-muted">
                When an allowance is used up, those AI actions pause until the 1st. Everything else in ZorHire keeps working, and Autopilot carries on where it left off once there is allowance again.
                {isAdmin ? " To add more this month, upgrade the plan or contact ZorTech for an add-on pack." : " Your admin is told at 80% and at 100%."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MeterCard({ m }: { m: AiMeterStatus }) {
  const Icon = ICONS[m.key];
  const unlimited = m.limit === null;
  const notIncluded = m.limit === 0;
  const pct = m.percent ?? 0;
  const tone = notIncluded ? "neutral" : pct >= 100 ? "danger" : pct >= 80 ? "warning" : "success";
  const bar = pct >= 100 ? "bg-danger-600" : pct >= 80 ? "bg-warning-600" : "bg-navy-600";
  const labelId = `meter-${m.key}`;
  return (
    <section className="zh-card p-5" aria-labelledby={labelId}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-700"><Icon size={20} aria-hidden="true" /></span>
          <div>
            <h2 id={labelId} className="text-base font-semibold text-ink">{m.label}</h2>
            <p className="mt-0.5 text-sm text-muted">{WHAT[m.key]}</p>
          </div>
        </div>
        <Badge tone={tone}>{unlimited ? "Unlimited" : notIncluded ? "Not in plan" : pct >= 100 ? "Used up" : `${pct}% used`}</Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span><strong className="text-lg text-ink">{fmt(m.used)}</strong> <span className="text-muted">{m.unit}</span></span>
          {!unlimited && <span className="text-muted">of {fmt(m.limit ?? 0)}</span>}
        </div>
        {!unlimited && (
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-labelledby={labelId} aria-valuemin={0} aria-valuemax={m.limit ?? 0} aria-valuenow={m.used}>
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        )}
        {m.topups > 0 && <p className="mt-2 text-xs text-muted">Includes {fmt(m.topups)} extra added this month.</p>}
      </div>
    </section>
  );
}
