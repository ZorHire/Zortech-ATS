import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  MousePointerClick,
  Users,
  UserMinus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  BarChart3,
} from 'lucide-react';
import Header from '../components/layout/Header';
import {
  useGetCampaignAnalyticsQuery,
  useGetCampaignRecipientsQuery,
  useListUnsubscribesQuery,
  useRemoveUnsubscribeMutation,
} from '../store/api/emailApi';
import type { CampaignRecipient } from '../store/api/emailApi';

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      <p className="text-xs font-medium text-gray-400 mt-1 uppercase tracking-wide">{label}</p>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:   { label: 'Pending',   icon: <Clock size={11} />,        className: 'bg-amber-100 text-amber-700' },
  delivered: { label: 'Delivered', icon: <CheckCircle2 size={11} />, className: 'bg-emerald-100 text-emerald-700' },
  bounced:   { label: 'Bounced',   icon: <XCircle size={11} />,      className: 'bg-orange-100 text-orange-600' },
  failed:    { label: 'Failed',    icon: <AlertCircle size={11} />,   className: 'bg-red-100 text-red-600' },
};

function RecipientRow({ r }: { r: CampaignRecipient }) {
  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">{r.name || '—'}</p>
        <p className="text-xs text-gray-500">{r.email}</p>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.className}`}>
          {cfg.icon}
          {cfg.label}
        </span>
        {r.bounce_reason && (
          <p className="text-xs text-red-500 mt-0.5 max-w-[200px] truncate" title={r.bounce_reason}>
            {r.bounce_reason}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {r.open_count > 0 ? (
          <div>
            <span className="text-sm font-semibold text-emerald-700">{r.open_count}</span>
            {r.last_opened_at && (
              <p className="text-xs text-gray-400">
                {new Date(r.last_opened_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {r.click_count > 0 ? (
          <div>
            <span className="text-sm font-semibold text-blue-700">{r.click_count}</span>
            {r.last_clicked_at && (
              <p className="text-xs text-gray-400">
                {new Date(r.last_clicked_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <span className="text-sm text-gray-300">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        {r.unsubscribed ? (
          <span className="text-xs text-red-500 font-medium">Unsubscribed</span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── Unsubscribe management tab ───────────────────────────────────────────────

function UnsubscribesTab() {
  const { data, isLoading } = useListUnsubscribesQuery();
  const [removeUnsubscribe, { isLoading: removing }] = useRemoveUnsubscribeMutation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 size={22} className="animate-spin text-gray-400" />
      </div>
    );
  }

  const list = data?.unsubscribes ?? [];

  if (list.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <UserMinus size={32} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No unsubscribes yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Email</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Campaign</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Date</th>
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {list.map((u) => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-800">{u.email}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{u.campaign_name ?? '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-400">
                {new Date(u.unsubscribed_at).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => removeUnsubscribe(u.email)}
                  disabled={removing}
                  className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  Re-subscribe
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<'overview' | 'recipients' | 'unsubscribes'>('overview');

  const { data: analyticsData, isLoading: loadingAnalytics } = useGetCampaignAnalyticsQuery(id!, { skip: !id });
  const { data: recipientsData, isLoading: loadingRecipients } = useGetCampaignRecipientsQuery(id!, {
    skip: !id || tab !== 'recipients',
  });

  if (loadingAnalytics) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Campaign Analytics" subtitle="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title="Campaign Analytics" subtitle="Not found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500 text-sm">Campaign not found.</p>
        </div>
      </div>
    );
  }

  const { campaign, analytics, top_links } = analyticsData;

  const statusColor: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    scheduled: 'bg-amber-100 text-amber-700',
    sending: 'bg-blue-100 text-blue-700',
    sent: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-600',
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Header
        title={campaign.name}
        subtitle={campaign.subject}
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Link to="/campaigns" className="hover:text-blue-600 flex items-center gap-1 transition-colors">
            <ArrowLeft size={14} />
            Campaigns
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium truncate">{campaign.name}</span>
          <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-medium ${statusColor[campaign.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {campaign.status}
          </span>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Delivered"
            value={analytics.delivered}
            sub={`of ${campaign.recipient_count ?? 0} sent`}
            icon={<Mail size={16} className="text-white" />}
            color="bg-blue-500"
          />
          <StatCard
            label="Open rate"
            value={`${analytics.open_rate}%`}
            sub={`${analytics.unique_opens} unique opens`}
            icon={<BarChart3 size={16} className="text-white" />}
            color="bg-emerald-500"
          />
          <StatCard
            label="Click rate"
            value={`${analytics.click_rate}%`}
            sub={`${analytics.unique_clicks} unique clicks`}
            icon={<MousePointerClick size={16} className="text-white" />}
            color="bg-violet-500"
          />
          <StatCard
            label="Unsubscribes"
            value={analytics.unsubscribes}
            sub={analytics.bounced > 0 ? `${analytics.bounced} bounced` : undefined}
            icon={<UserMinus size={16} className="text-white" />}
            color="bg-rose-500"
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200">
          {(['overview', 'recipients', 'unsubscribes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                tab === t
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Overview tab */}
        {tab === 'overview' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Funnel */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Engagement funnel</h3>
              {[
                { label: 'Sent', value: campaign.recipient_count ?? 0, color: 'bg-blue-500', pct: 100 },
                { label: 'Delivered', value: analytics.delivered, color: 'bg-emerald-500', pct: campaign.recipient_count ? Math.round((analytics.delivered / campaign.recipient_count) * 100) : 0 },
                { label: 'Opened', value: analytics.unique_opens, color: 'bg-violet-500', pct: analytics.delivered ? Math.round((analytics.unique_opens / analytics.delivered) * 100) : 0 },
                { label: 'Clicked', value: analytics.unique_clicks, color: 'bg-amber-500', pct: analytics.unique_opens ? Math.round((analytics.unique_clicks / analytics.unique_opens) * 100) : 0 },
              ].map((row) => (
                <div key={row.label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{row.label}</span>
                    <span className="font-medium text-gray-800">{row.value} <span className="text-gray-400">({row.pct}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${row.color} rounded-full transition-all`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Top clicked links */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Top clicked links</h3>
              {top_links.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No clicks tracked yet</p>
              ) : (
                <div className="space-y-3">
                  {top_links.map((link, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline truncate flex items-center gap-1"
                        >
                          <span className="truncate">{link.url}</span>
                          <ExternalLink size={10} className="flex-shrink-0" />
                        </a>
                      </div>
                      <span className="text-xs font-semibold text-gray-700 flex-shrink-0">
                        {link.clicks} click{link.clicks !== 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 sm:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Delivery breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Delivered', value: analytics.delivered, color: 'text-emerald-700' },
                  { label: 'Bounced',   value: analytics.bounced,   color: 'text-orange-600' },
                  { label: 'Failed',    value: analytics.failed,    color: 'text-red-600' },
                  { label: 'Unsubscribed', value: analytics.unsubscribes, color: 'text-rose-600' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recipients tab */}
        {tab === 'recipients' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {loadingRecipients ? (
              <div className="flex justify-center py-10">
                <Loader2 size={22} className="animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Recipient</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Status</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Opens</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Clicks</th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Unsub</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {recipientsData?.recipients.map((r) => (
                      <RecipientRow key={r.id} r={r} />
                    ))}
                    {!recipientsData?.recipients.length && (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                          <Users size={28} className="mx-auto mb-2 opacity-30" />
                          No recipient data yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Unsubscribes tab */}
        {tab === 'unsubscribes' && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <UnsubscribesTab />
          </div>
        )}
      </div>
    </div>
  );
}
