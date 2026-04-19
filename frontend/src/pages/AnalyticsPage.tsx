import { Users, Clock, Target, Award, ArrowUp, ArrowDown } from 'lucide-react';
import Header from '../components/layout/Header';

function BarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map(d => d.value));
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
  let cumulative = 0;
  const radius = 40;
  const cx = 50;
  const cy = 50;

  const paths = segments.map(seg => {
    const start = (cumulative / total) * 360;
    const end = ((cumulative + seg.value) / total) * 360;
    cumulative += seg.value;

    const startRad = ((start - 90) * Math.PI) / 180;
    const endRad = ((end - 90) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const largeArc = end - start > 180 ? 1 : 0;

    return { ...seg, d: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z` };
  });

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
        {paths.map(p => (
          <path key={p.label} d={p.d} fill={p.color} stroke="white" strokeWidth="1" />
        ))}
        <circle cx={cx} cy={cy} r="22" fill="white" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="text-xs font-bold fill-gray-900" style={{ fontSize: '9px' }}>
          {total}
        </text>
        <text x={cx} y={cy + 8} textAnchor="middle" dominantBaseline="middle" className="fill-gray-500" style={{ fontSize: '6px' }}>
          total
        </text>
      </svg>
      <div className="space-y-1.5">
        {segments.map(seg => (
          <div key={seg.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-xs text-gray-600">{seg.label}</span>
            <span className="text-xs font-semibold text-gray-900 ml-auto pl-4">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricRow({ label, value, prev, unit }: { label: string; value: number; prev: number; unit: string }) {
  const change = ((value - prev) / prev) * 100;
  const up = change >= 0;
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">{value}{unit}</span>
        <span className={`flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-500'}`}>
          {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(change).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function downloadCSV(filename: string, rows: string[][]) {
  const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const funnelData = [
    { stage: 'Sourced', count: 248, conv: 100 },
    { stage: 'Screened', count: 187, conv: 75 },
    { stage: 'Shortlisted', count: 124, conv: 50 },
    { stage: 'Submitted', count: 89, conv: 36 },
    { stage: 'Interviewed', count: 56, conv: 23 },
    { stage: 'Selected', count: 34, conv: 14 },
    { stage: 'Offer Extended', count: 22, conv: 9 },
    { stage: 'Offer Accepted', count: 18, conv: 7 },
  ];

  const recruiterData = [
    { name: 'Ravi Kumar', jobs: 5, sourced: 124, shortlisted: 48, submitted: 31, placed: 12, score: 94 },
    { name: 'Meera Patel', jobs: 4, sourced: 98, shortlisted: 36, submitted: 22, placed: 9, score: 87 },
    { name: 'Aakash Singh', jobs: 6, sourced: 156, shortlisted: 52, submitted: 38, placed: 14, score: 96 },
    { name: 'Pooja Sharma', jobs: 3, sourced: 67, shortlisted: 24, submitted: 15, placed: 6, score: 78 },
  ];

  const handleExportReport = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows: string[][] = [
      ['ZorHire Analytics Report — Last 30 Days', today],
      [],
      ['HIRING FUNNEL'],
      ['Stage', 'Candidates', 'Conversion %'],
      ...funnelData.map(r => [r.stage, String(r.count), `${r.conv}%`]),
      [],
      ['KEY METRICS'],
      ['Metric', 'Value', 'Previous', 'Change'],
      ['Time to Source', '6 days', '8 days', '-25%'],
      ['Time to Screen', '3 days', '5 days', '-40%'],
      ['Time to Submit', '9 days', '11 days', '-18%'],
      ['Interview → Offer', '68%', '62%', '+10%'],
      ['Offer Accept Rate', '81%', '76%', '+7%'],
      [],
      ['SUMMARY STATS'],
      ['Metric', 'Value'],
      ['Total Placements', '94'],
      ['Avg. Time-to-Fill', '18 days'],
      ['Offer Accept Rate', '81%'],
      ['Candidate Pipeline', '1247'],
      [],
      ['RECRUITER PRODUCTIVITY'],
      ['Recruiter', 'Assigned Jobs', 'Candidates Sourced', 'Shortlisted', 'Submissions', 'Placements', 'Activity Score'],
      ...recruiterData.map(r => [r.name, String(r.jobs), String(r.sourced), String(r.shortlisted), String(r.submitted), String(r.placed), String(r.score)]),
    ];
    downloadCSV(`zorhire-analytics-${today}.csv`, rows);
  };

  const handleExportRecruiterCSV = () => {
    const rows: string[][] = [
      ['Recruiter', 'Assigned Jobs', 'Candidates Sourced', 'Shortlisted', 'Submissions', 'Placements', 'Activity Score'],
      ...recruiterData.map(r => [r.name, String(r.jobs), String(r.sourced), String(r.shortlisted), String(r.submitted), String(r.placed), String(r.score)]),
    ];
    downloadCSV(`recruiter-productivity-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title="Analytics & Reports"
        subtitle="Real-time recruitment performance insights"
        actions={
          <div className="flex gap-2">
            <select className="text-sm px-3 py-2 border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>Last 30 days</option>
              <option>Last 90 days</option>
              <option>This Quarter</option>
              <option>This Year</option>
            </select>
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 bg-white"
            >
              Export Report
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Placements', value: '94', change: '+12%', up: true, icon: Award, color: 'bg-blue-500' },
            { label: 'Avg. Time-to-Fill', value: '18 days', change: '-3 days', up: true, icon: Clock, color: 'bg-emerald-500' },
            { label: 'Offer Accept Rate', value: '81%', change: '+5%', up: true, icon: Target, color: 'bg-violet-500' },
            { label: 'Candidate Pipeline', value: '1,247', change: '+18%', up: true, icon: Users, color: 'bg-amber-500' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon size={17} className="text-white" />
                </div>
                <span className={`text-xs font-medium flex items-center gap-0.5 ${stat.up ? 'text-emerald-600' : 'text-red-500'}`}>
                  {stat.up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                  {stat.change}
                </span>
              </div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Hiring Funnel</h3>
            <p className="text-xs text-gray-400 mb-5">Candidate conversion through pipeline stages</p>
            <div className="space-y-3">
              {funnelData.map(row => (
                <div key={row.stage} className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-28 flex-shrink-0">{row.stage}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-md flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${row.conv}%` }}
                    >
                      <span className="text-xs font-bold text-white">{row.count}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{row.conv}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Source Effectiveness</h3>
            <p className="text-xs text-gray-400 mb-5">Placements by candidate source channel</p>
            <DonutChart segments={[
              { label: 'LinkedIn', value: 32, color: '#2563eb' },
              { label: 'Naukri', value: 24, color: '#f97316' },
              { label: 'Vendors', value: 18, color: '#10b981' },
              { label: 'Indeed', value: 12, color: '#6366f1' },
              { label: 'Referral', value: 8, color: '#ec4899' },
            ]} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Monthly Placements</h3>
            <p className="text-xs text-gray-400 mb-5">Last 6 months</p>
            <BarChart data={[
              { label: 'Oct', value: 12, color: '#93c5fd' },
              { label: 'Nov', value: 18, color: '#93c5fd' },
              { label: 'Dec', value: 9, color: '#93c5fd' },
              { label: 'Jan', value: 21, color: '#93c5fd' },
              { label: 'Feb', value: 16, color: '#93c5fd' },
              { label: 'Mar', value: 18, color: '#3b82f6' },
            ]} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Key Metrics</h3>
            <MetricRow label="Time to Source" value={6} prev={8} unit=" days" />
            <MetricRow label="Time to Screen" value={3} prev={5} unit=" days" />
            <MetricRow label="Time to Submit" value={9} prev={11} unit=" days" />
            <MetricRow label="Interview → Offer" value={68} prev={62} unit="%" />
            <MetricRow label="Offer Accept Rate" value={81} prev={76} unit="%" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Vendor Performance</h3>
            <div className="space-y-3">
              {[
                { name: 'TalentBridge Staffing', rate: 87, submits: 142, color: 'bg-emerald-500' },
                { name: 'HireRight Solutions', rate: 72, submits: 89, color: 'bg-blue-500' },
                { name: 'PeopleFirst Agency', rate: 65, submits: 56, color: 'bg-amber-500' },
                { name: 'TechTalent Hub', rate: 41, submits: 23, color: 'bg-red-400' },
              ].map(v => (
                <div key={v.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 truncate flex-1">{v.name}</span>
                    <span className="text-xs font-medium text-gray-900 ml-2">{v.rate}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v.color}`} style={{ width: `${v.rate}%` }} />
                    </div>
                    <span className="text-xs text-gray-400 w-14 text-right">{v.submits} submits</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-gray-900">Recruiter Productivity</h3>
              <p className="text-xs text-gray-400">This quarter</p>
            </div>
            <button onClick={handleExportRecruiterCSV} className="text-sm text-blue-600 hover:underline">Download CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  {['Recruiter', 'Assigned Jobs', 'Candidates Sourced', 'Shortlisted', 'Submissions', 'Placements', 'Activity Score'].map(h => (
                    <th key={h} className="text-left py-2 px-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recruiterData.map(r => (
                  <tr key={r.name} className="hover:bg-gray-50">
                    <td className="py-2.5 px-3 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2.5 px-3 text-gray-600">{r.jobs}</td>
                    <td className="py-2.5 px-3 text-gray-600">{r.sourced}</td>
                    <td className="py-2.5 px-3 text-gray-600">{r.shortlisted}</td>
                    <td className="py-2.5 px-3 text-gray-600">{r.submitted}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-blue-600">{r.placed}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full max-w-16">
                          <div className={`h-full rounded-full ${r.score >= 90 ? 'bg-emerald-500' : r.score >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${r.score}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{r.score}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
