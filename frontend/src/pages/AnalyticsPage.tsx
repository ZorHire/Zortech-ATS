import React from 'react';
import { Users, Clock, Target, Award, Download } from 'lucide-react';
import Header from '../components/layout/Header';
import { useGetAnalyticsQuery } from '../store/api/analyticsApi';

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
  { key: 'all', label: 'All Time' },
  { key: '30d', label: '30 Days' },
  { key: '90d', label: '90 Days' },
  { key: '6m', label: '6 Months' },
  { key: '1y', label: '1 Year' },
];

const SOURCE_COLORS: Record<string, string> = {
  linkedin: '#2563eb', indeed: '#f97316', naukri: '#16a34a',
  vendor: '#10b981', referral: '#ec4899', direct: '#6366f1',
  glassdoor: '#f59e0b', monster: '#ef4444', other: '#94a3b8',
};

const STAGE_LABELS: Record<string, string> = {
  new: 'New', sourced: 'Sourced', screened: 'Screened', shortlisted: 'Shortlisted',
  submitted_to_client: 'Submitted', client_interview_scheduled: 'Interview Sched.',
  interview_completed: 'Interviewed', selected: 'Selected',
  offer_extended: 'Offer Extended', offer_accepted: 'Offer Accepted', joined: 'Joined',
};

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-32">
      {data.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-medium text-gray-700">{d.value}</span>
          <div className="w-full rounded-t-md transition-all" style={{ height: `${(d.value / max) * 80}px`, backgroundColor: d.color }} />
          <span className="text-xs text-gray-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return <p className="text-sm text-gray-400 py-4">No candidate data yet</p>;
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
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
        {paths.map(p => <path key={p.label} d={p.d} fill={p.color} stroke="white" strokeWidth="1" />)}
        <circle cx={cx} cy={cy} r="22" fill="white" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '9px', fontWeight: 'bold', fill: '#111827' }}>{total}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '6px', fill: '#6b7280' }}>total</text>
      </svg>
      <div className="space-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600 capitalize">{seg.label}</span>
            <span className="text-xs font-semibold text-gray-900 ml-auto pl-4">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [preset, setPreset] = React.useState<Preset>('all');
  const dateRange = getDateRange(preset);
  const { data, isLoading } = useGetAnalyticsQuery(
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
    color: i === monthly.length - 1 ? '#3b82f6' : '#93c5fd',
  }));

  const sourceSegments = sources.map(s => ({
    label: s.source,
    value: s.count,
    color: SOURCE_COLORS[s.source] ?? '#94a3b8',
  }));

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Analytics & Reports" subtitle="Real-time recruitment performance insights" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Analytics & Reports"
        subtitle="Real-time recruitment performance insights"
        actions={
          <div className="flex items-center gap-2">
            {/* Date range preset chips */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    preset === p.key
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 bg-white transition-colors"
            >
              <Download size={15} />
              Export CSV
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Placements', value: summary?.total_placements ?? 0, icon: Award, color: 'bg-blue-500' },
            { label: 'Active Jobs', value: summary?.active_jobs ?? 0, icon: Clock, color: 'bg-emerald-500' },
            { label: 'Offer Accept Rate', value: summary?.offer_accept_rate != null ? `${summary.offer_accept_rate}%` : '—', icon: Target, color: 'bg-violet-500' },
            { label: 'Candidate Pipeline', value: summary?.total_candidates?.toLocaleString() ?? 0, icon: Users, color: 'bg-amber-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <stat.icon size={17} className="text-white" />
                </div>
              </div>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Hiring Funnel */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Hiring Funnel</h3>
            <p className="text-xs text-gray-400 mb-5">Candidate conversion through pipeline stages</p>
            {funnel.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No pipeline data yet</p>
            ) : (
              <div className="space-y-3">
                {funnel.map(row => (
                  <div key={row.stage} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-32 flex-shrink-0">{STAGE_LABELS[row.stage] ?? row.stage}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-md flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max(row.conv, 4)}%` }}
                      >
                        <span className="text-xs font-bold text-white">{row.count}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 w-8 text-right">{row.conv}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source Effectiveness */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Source Effectiveness</h3>
            <p className="text-xs text-gray-400 mb-5">Candidates by source channel</p>
            <DonutChart segments={sourceSegments} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Placements */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Monthly Placements</h3>
            <p className="text-xs text-gray-400 mb-5">Offer accepted + joined — last 6 months</p>
            {monthlyChartData.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No placement data yet</p>
            ) : (
              <BarChart data={monthlyChartData} />
            )}
          </div>

          {/* Vendor Performance */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Vendor Performance</h3>
            {vendors.length === 0 ? (
              <p className="text-sm text-gray-400 py-4">No vendor data yet</p>
            ) : (
              <div className="space-y-3">
                {vendors.map(v => (
                  <div key={v.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700 truncate flex-1">{v.name}</span>
                      <span className="text-xs font-medium text-gray-900 ml-2">{v.rate}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${v.rate >= 70 ? 'bg-emerald-500' : v.rate >= 50 ? 'bg-blue-500' : v.rate >= 30 ? 'bg-amber-500' : 'bg-red-400'}`}
                          style={{ width: `${v.rate}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-400 w-16 text-right">{v.submits} submits</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recruiter Productivity */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recruiter Productivity</h3>
              <p className="text-xs text-gray-400">All time</p>
            </div>
          </div>
          {recruiters.length === 0 ? (
            <p className="text-sm text-gray-400 py-4">No recruiter data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    {['Recruiter', 'Assigned Jobs', 'Candidates Sourced', 'Shortlisted', 'Submissions', 'Placements'].map(h => (
                      <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recruiters.map(r => (
                    <tr key={r.recruiter_name} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">{r.recruiter_name}</td>
                      <td className="py-2.5 px-3 text-gray-600">{r.assigned_jobs}</td>
                      <td className="py-2.5 px-3 text-gray-600">{r.candidates_sourced}</td>
                      <td className="py-2.5 px-3 text-gray-600">{r.shortlisted}</td>
                      <td className="py-2.5 px-3 text-gray-600">{r.submitted}</td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-blue-600">{r.placements}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
