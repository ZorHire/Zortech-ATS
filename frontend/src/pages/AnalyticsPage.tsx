import React from 'react';
import { Users, Clock, Target, Award, Download } from 'lucide-react';
import { useGetAnalyticsQuery } from '../store/api/analyticsApi';
import {
  Button,
  CardGridSkeleton,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
} from '../components/ui';
import { getStage } from '../lib/stages';

type Preset = 'all' | '30d' | '90d' | '6m' | '1y';

function getDateRange(preset: Preset): { from?: string; to?: string } {
  if (preset === 'all') return {};
  const to = new Date();
  const from = new Date();
  if (preset === '30d') from.setDate(from.getDate() - 30);
  else if (preset === '90d') from.setDate(from.getDate() - 90);
  else if (preset === '6m') from.setMonth(from.getMonth() - 6);
  else if (preset === '1y') from.setFullYear(from.getFullYear() - 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '6m', label: '6 months' },
  { key: '1y', label: '1 year' },
];

/**
 * Chart series colours (SVG fills, from the brand tokens in tailwind.config.js):
 * navy first, orange second, then lighter navy/orange steps and neutral greys.
 */
const CHART_COLORS = {
  navy: '#1A4277', // navy-600
  navySoft: '#8AA9D6', // navy-300
  orange: '#F7911E', // brand-500
  ink: '#262626',
  muted: '#5F6B76',
};
const SERIES = [
  '#1A4277', // navy-600
  '#F7911E', // brand-500
  '#5781BE', // navy-400
  '#FDB662', // brand-300
  '#0F2A4F', // navy-800
  '#B85F00', // brand-700
  '#B8CCE8', // navy-200
  '#5F6B76', // muted grey
  '#CBD2DA', // line-strong grey
];

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex h-32 min-w-max items-end gap-2 sm:min-w-0">
        {data.map(d => (
          <div key={d.label} className="flex min-w-[2.5rem] flex-1 flex-col items-center gap-1">
            <span className="text-xs font-medium text-ink">{d.value}</span>
            <div className="w-full rounded-t-md transition-all" style={{ height: `${(d.value / max) * 80}px`, backgroundColor: d.color }} />
            <span className="w-full truncate text-center text-xs text-muted">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return <EmptyState compact title="No candidate data yet" description="Sources appear once candidates are added." />;
  }
  let cumulative = 0;
  const radius = 40; const cx = 50; const cy = 50;
  const paths = segments.map(seg => {
    const start = (cumulative / total) * 360;
    const end = ((cumulative + seg.value) / total) * 360;
    cumulative += seg.value;
    const startRad = ((start - 90) * Math.PI) / 180;
    const endRad = ((end - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad); const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad); const y2 = cy + radius * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;
    return { ...seg, d: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <svg viewBox="0 0 100 100" className="h-28 w-28 flex-shrink-0" role="img" aria-label={`Candidates by source, ${total} total`}>
        {paths.map(p => <path key={p.label} d={p.d} fill={p.color} stroke="white" strokeWidth="1" />)}
        <circle cx={cx} cy={cy} r="22" fill="white" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '9px', fontWeight: 600, fill: CHART_COLORS.ink }}>{total}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '6px', fill: CHART_COLORS.muted }}>total</text>
      </svg>
      <ul className="w-full min-w-0 space-y-1.5 sm:w-auto sm:flex-1">
        {segments.map(seg => (
          <li key={seg.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} aria-hidden="true" />
            <span className="truncate text-xs capitalize text-ink-soft">{seg.label}</span>
            <span className="ml-auto pl-4 text-xs font-semibold text-ink">{seg.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ title, subtitle, children, className = '' }: { title: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`zh-card min-w-0 p-4 sm:p-5 ${className}`}>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function vendorBarTone(rate: number) {
  if (rate >= 70) return 'bg-success-600';
  if (rate >= 50) return 'bg-navy-600';
  if (rate >= 30) return 'bg-brand-500';
  return 'bg-danger-600';
}

export default function AnalyticsPage() {
  const [preset, setPreset] = React.useState<Preset>('all');
  const dateRange = getDateRange(preset);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetAnalyticsQuery(
    preset === 'all' ? undefined : dateRange,
  );

  const handleExportReport = () => {
    const base = import.meta.env.VITE_API_URL || '/v1';
    const params = new URLSearchParams();
    if (dateRange.from) params.set('from', dateRange.from);
    if (dateRange.to) params.set('to', dateRange.to);
    const qs = params.toString();
    window.open(`${base}/admin/analytics/export${qs ? `?${qs}` : ''}`, '_blank');
  };

  const summary = data?.summary;
  const funnel = data?.funnel ?? [];
  const monthly = data?.monthly ?? [];
  const recruiters = data?.recruiters ?? [];
  const vendors = data?.vendors ?? [];
  const sources = data?.sources ?? [];

  const monthlyChartData = monthly.map((m, i) => ({
    label: m.label,
    value: m.count,
    // Latest month in navy, earlier months in a lighter navy.
    color: i === monthly.length - 1 ? CHART_COLORS.navy : CHART_COLORS.navySoft,
  }));

  const sourceSegments = sources.map((s, i) => ({
    label: s.source,
    value: s.count,
    color: SERIES[i % SERIES.length],
  }));

  const presetControl = (
    <div role="group" aria-label="Date range" className="flex max-w-full gap-1 overflow-x-auto rounded-lg bg-surface-sunken p-1">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={preset === p.key}
          onClick={() => setPreset(p.key)}
          className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-colors ${
            preset === p.key ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Real-time recruitment performance insights"
        actions={
          <Button icon={<Download size={16} />} onClick={handleExportReport}>
            Export CSV
          </Button>
        }
      >
        {presetControl}
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {isLoading ? (
          <>
            <CardGridSkeleton />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Skeleton className="h-64 rounded-xl" />
              <Skeleton className="h-64 rounded-xl" />
            </div>
          </>
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total placements" value={summary?.total_placements ?? 0} icon={<Award size={18} />} tone="navy" />
              <StatCard label="Active jobs" value={summary?.active_jobs ?? 0} icon={<Clock size={18} />} tone="success" />
              <StatCard
                label="Offer accept rate"
                value={summary?.offer_accept_rate != null ? `${summary.offer_accept_rate}%` : '—'}
                icon={<Target size={18} />}
                tone="brand"
              />
              <StatCard label="Candidate pipeline" value={summary?.total_candidates?.toLocaleString() ?? 0} icon={<Users size={18} />} tone="neutral" />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="Hiring funnel" subtitle="Candidate conversion through pipeline stages">
                {funnel.length === 0 ? (
                  <EmptyState compact title="No pipeline data yet" />
                ) : (
                  <ul className="space-y-3">
                    {funnel.map(row => (
                      <li key={row.stage} className="flex items-center gap-3">
                        <span className="w-24 flex-shrink-0 truncate text-xs text-ink-soft sm:w-32">{getStage(row.stage).label}</span>
                        <div className="h-6 flex-1 overflow-hidden rounded-md bg-surface-sunken">
                          <div className="h-full rounded-md bg-navy-600 transition-all" style={{ width: `${Math.max(row.conv, 4)}%` }} />
                        </div>
                        <span className="w-8 flex-shrink-0 text-right text-xs font-semibold text-ink">{row.count}</span>
                        <span className="w-9 flex-shrink-0 text-right text-xs text-muted">{row.conv}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>

              <Panel title="Source effectiveness" subtitle="Candidates by source channel">
                <DonutChart segments={sourceSegments} />
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Panel title="Monthly placements" subtitle="Offer accepted + joined — last 6 months">
                {monthlyChartData.length === 0 ? (
                  <EmptyState compact title="No placement data yet" />
                ) : (
                  <BarChart data={monthlyChartData} />
                )}
              </Panel>

              <Panel title="Vendor performance">
                {vendors.length === 0 ? (
                  <EmptyState compact title="No vendor data yet" />
                ) : (
                  <ul className="space-y-3">
                    {vendors.map(v => (
                      <li key={v.name}>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="flex-1 truncate text-xs text-ink-soft">{v.name}</span>
                          <span className="ml-2 text-xs font-medium text-ink">{v.rate}%</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <div className={`h-full rounded-full ${vendorBarTone(v.rate)}`} style={{ width: `${v.rate}%` }} />
                          </div>
                          <span className="w-20 text-right text-xs text-muted">{v.submits} submits</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>

            <section className="zh-card overflow-hidden">
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <h2 className="text-base font-semibold text-ink">Recruiter productivity</h2>
                <p className="mt-0.5 text-xs text-muted">All time</p>
              </div>
              {recruiters.length === 0 ? (
                <EmptyState compact title="No recruiter data yet" />
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <caption className="sr-only">Recruiter productivity</caption>
                    <thead className="bg-surface">
                      <tr>
                        {['Recruiter', 'Assigned jobs', 'Candidates sourced', 'Shortlisted', 'Submissions', 'Placements'].map(h => (
                          <th key={h} scope="col" className="border-b border-line px-4 py-2.5 text-left text-xs font-medium text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recruiters.map(r => (
                        <tr key={r.recruiter_name} className="border-b border-line last:border-0">
                          <td className="px-4 py-3 font-medium text-ink">{r.recruiter_name}</td>
                          <td className="px-4 py-3 text-ink-soft">{r.assigned_jobs}</td>
                          <td className="px-4 py-3 text-ink-soft">{r.candidates_sourced}</td>
                          <td className="px-4 py-3 text-ink-soft">{r.shortlisted}</td>
                          <td className="px-4 py-3 text-ink-soft">{r.submitted}</td>
                          <td className="px-4 py-3 font-semibold text-navy-600">{r.placements}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
