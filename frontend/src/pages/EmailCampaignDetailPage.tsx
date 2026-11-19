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
  BarChart3,
} from 'lucide-react';
import {
  useGetCampaignAnalyticsQuery,
  useGetCampaignRecipientsQuery,
  useListUnsubscribesQuery,
  useRemoveUnsubscribeMutation,
} from '../store/api/emailApi';
import type { CampaignRecipient } from '../store/api/emailApi';
import {
  Badge,
  CardGridSkeleton,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatCard,
  buttonClasses,
} from '../components/ui';
import type { BadgeTone, Column } from '../components/ui';
import { useNotify } from '../hooks/useNotify';
import { getErrorMessage, getErrorStatus } from '../lib/format';

// ─── Status mappings (one per status type) ───────────────────────────────────

/** Per-recipient delivery status. */
const RECIPIENT_STATUS: Record<string, { label: string; icon: React.ReactNode; tone: BadgeTone }> = {
  pending:   { label: 'Pending',   icon: <Clock size={11} aria-hidden="true" />,        tone: 'neutral' },
  delivered: { label: 'Delivered', icon: <CheckCircle2 size={11} aria-hidden="true" />, tone: 'success' },
  bounced:   { label: 'Bounced',   icon: <XCircle size={11} aria-hidden="true" />,      tone: 'warning' },
  failed:    { label: 'Failed',    icon: <AlertCircle size={11} aria-hidden="true" />,  tone: 'danger' },
};

/** Campaign status. */
const CAMPAIGN_STATUS_TONES: Record<string, BadgeTone> = {
  draft: 'neutral',
  scheduled: 'warning',
  sending: 'info',
  sent: 'success',
  failed: 'danger',
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const RECIPIENT_COLUMNS: Column<CampaignRecipient>[] = [
  {
    key: 'recipient',
    header: 'Recipient',
    cell: (r) => (
      <div className="min-w-0">
        <p className="font-medium text-ink">{r.name || '—'}</p>
        <p className="truncate text-xs text-muted">{r.email}</p>
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (r) => {
      const cfg = RECIPIENT_STATUS[r.status] ?? RECIPIENT_STATUS.pending;
      return (
        <div>
          <Badge tone={cfg.tone} icon={cfg.icon}>{cfg.label}</Badge>
          {r.bounce_reason && (
            <p className="mt-0.5 max-w-[200px] truncate text-xs text-danger-600" title={r.bounce_reason}>
              {r.bounce_reason}
            </p>
          )}
        </div>
      );
    },
  },
  {
    key: 'opens',
    header: 'Opens',
    className: 'text-center',
    cell: (r) =>
      r.open_count > 0 ? (
        <div>
          <span className="font-semibold text-ink">{r.open_count}</span>
          {r.last_opened_at && <p className="text-xs text-muted">{fmtDate(r.last_opened_at)}</p>}
        </div>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'clicks',
    header: 'Clicks',
    className: 'text-center',
    cell: (r) =>
      r.click_count > 0 ? (
        <div>
          <span className="font-semibold text-navy-600">{r.click_count}</span>
          {r.last_clicked_at && <p className="text-xs text-muted">{fmtDate(r.last_clicked_at)}</p>}
        </div>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: 'unsub',
    header: 'Unsubscribed',
    className: 'text-center',
    cell: (r) => (r.unsubscribed ? <Badge tone="danger">Unsubscribed</Badge> : <span className="text-muted">—</span>),
  },
];

// ─── Unsubscribe management tab ───────────────────────────────────────────────

function UnsubscribesTab() {
  const notify = useNotify();
  const { data, isLoading, isError, error, refetch } = useListUnsubscribesQuery();
  const [removeUnsubscribe, { isLoading: removing }] = useRemoveUnsubscribeMutation();

  const handleResubscribe = async (email: string) => {
    try {
      await removeUnsubscribe(email).unwrap();
      notify.success(`${email} re-subscribed`);
    } catch (err) {
      notify.error(getErrorMessage(err, 'Failed to re-subscribe'));
    }
  };

  type Unsub = NonNullable<typeof data>['unsubscribes'][number];
  const columns: Column<Unsub>[] = [
    { key: 'email', header: 'Email', cell: (u) => <span className="text-ink">{u.email}</span> },
    { key: 'campaign', header: 'Campaign', cell: (u) => <span className="text-ink-soft">{u.campaign_name ?? '—'}</span> },
    { key: 'date', header: 'Date', className: 'whitespace-nowrap', cell: (u) => <span className="text-xs text-muted">{fmtDate(u.unsubscribed_at)}</span> },
    {
      key: 'action',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right whitespace-nowrap',
      cell: (u) => (
        <button
          type="button"
          onClick={() => handleResubscribe(u.email)}
          disabled={removing}
          className="text-xs font-medium text-navy-600 hover:underline disabled:opacity-50"
        >
          Re-subscribe
        </button>
      ),
    },
  ];

  return (
    <DataTable
      caption="Unsubscribed addresses"
      columns={columns}
      rows={isError ? undefined : data?.unsubscribes}
      rowKey={(u) => u.id}
      loading={isLoading}
      error={isError ? error : undefined}
      onRetry={refetch}
      empty={
        <EmptyState
          compact
          icon={<UserMinus size={22} aria-hidden="true" />}
          title="No unsubscribes yet"
          description="People who unsubscribe from any campaign are listed here."
        />
      }
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'recipients' | 'unsubscribes';
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'recipients', label: 'Recipients' },
  { key: 'unsubscribes', label: 'Unsubscribes' },
];

const BACK_LINK = (
  <Link to="/campaigns" className={buttonClasses('secondary')}>
    <ArrowLeft size={16} aria-hidden="true" /> All campaigns
  </Link>
);

export default function EmailCampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('overview');

  const {
    data: analyticsData,
    isLoading: loadingAnalytics,
    isFetching: fetchingAnalytics,
    isError: analyticsIsError,
    error: analyticsError,
    refetch: refetchAnalytics,
  } = useGetCampaignAnalyticsQuery(id!, { skip: !id });
  const {
    data: recipientsData,
    isLoading: loadingRecipients,
    isError: recipientsIsError,
    error: recipientsError,
    refetch: refetchRecipients,
  } = useGetCampaignRecipientsQuery(id!, {
    skip: !id || tab !== 'recipients',
  });

  const crumbsBase = [{ label: 'Campaigns', to: '/campaigns' }];

  if (loadingAnalytics) {
    return (
      <>
        <PageHeader breadcrumbs={[...crumbsBase, { label: 'Loading…' }]} title={<Skeleton className="h-7 w-56" />} />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <CardGridSkeleton />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </>
    );
  }

  const notFound = !analyticsData && (!analyticsIsError || getErrorStatus(analyticsError) === 404);

  if (!analyticsData) {
    return (
      <>
        <PageHeader breadcrumbs={[...crumbsBase, { label: notFound ? 'Not found' : 'Error' }]} title="Campaign analytics" />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
          <div className="zh-card">
            {notFound ? (
              <EmptyState
                icon={<Mail size={22} aria-hidden="true" />}
                title="Campaign not found"
                description="It may have been deleted, or the link is wrong."
                action={BACK_LINK}
              />
            ) : (
              <ErrorState error={analyticsError} onRetry={refetchAnalytics} retrying={fetchingAnalytics} />
            )}
          </div>
        </div>
      </>
    );
  }

  const { campaign, analytics, top_links } = analyticsData;

  const funnel = [
    { label: 'Sent', value: campaign.recipient_count ?? 0, color: 'bg-navy-600', pct: 100 },
    { label: 'Delivered', value: analytics.delivered, color: 'bg-navy-400', pct: campaign.recipient_count ? Math.round((analytics.delivered / campaign.recipient_count) * 100) : 0 },
    { label: 'Opened', value: analytics.unique_opens, color: 'bg-brand-500', pct: analytics.delivered ? Math.round((analytics.unique_opens / analytics.delivered) * 100) : 0 },
    { label: 'Clicked', value: analytics.unique_clicks, color: 'bg-brand-300', pct: analytics.unique_opens ? Math.round((analytics.unique_clicks / analytics.unique_opens) * 100) : 0 },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[...crumbsBase, { label: campaign.name }]}
        title={
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate">{campaign.name}</span>
            <Badge tone={CAMPAIGN_STATUS_TONES[campaign.status] ?? 'neutral'} className="shrink-0">
              {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
            </Badge>
          </span>
        }
        subtitle={campaign.subject}
        actions={BACK_LINK}
      >
        <div role="tablist" aria-label="Campaign sections" className="-mb-4 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Delivered"
            value={analytics.delivered}
            hint={`of ${campaign.recipient_count ?? 0} sent`}
            icon={<Mail size={18} />}
            tone="navy"
          />
          <StatCard
            label="Open rate"
            value={`${analytics.open_rate}%`}
            hint={`${analytics.unique_opens} unique opens`}
            icon={<BarChart3 size={18} />}
            tone="success"
          />
          <StatCard
            label="Click rate"
            value={`${analytics.click_rate}%`}
            hint={`${analytics.unique_clicks} unique clicks`}
            icon={<MousePointerClick size={18} />}
            tone="brand"
          />
          <StatCard
            label="Unsubscribes"
            value={analytics.unsubscribes}
            hint={analytics.bounced > 0 ? `${analytics.bounced} bounced` : undefined}
            icon={<UserMinus size={18} />}
            tone="danger"
          />
        </div>

        {tab === 'overview' && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section className="zh-card min-w-0 p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink">Engagement funnel</h2>
              <ul className="space-y-3">
                {funnel.map((row) => (
                  <li key={row.label}>
                    <div className="mb-1 flex justify-between text-xs text-ink-soft">
                      <span>{row.label}</span>
                      <span className="font-medium text-ink">
                        {row.value} <span className="font-normal text-muted">({row.pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                      <div className={`h-full rounded-full transition-all ${row.color}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="zh-card min-w-0 p-4 sm:p-5">
              <h2 className="mb-4 text-sm font-semibold text-ink">Top clicked links</h2>
              {top_links.length === 0 ? (
                <EmptyState compact icon={<MousePointerClick size={20} aria-hidden="true" />} title="No clicks tracked yet" />
              ) : (
                <ol className="space-y-3">
                  {top_links.map((link, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span className="w-4 text-xs font-semibold text-muted">{i + 1}</span>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-1 text-xs text-navy-600 hover:underline"
                      >
                        <span className="truncate">{link.url}</span>
                        <ExternalLink size={10} className="flex-shrink-0" aria-hidden="true" />
                      </a>
                      <span className="flex-shrink-0 text-xs font-semibold text-ink">
                        {link.clicks} click{link.clicks !== 1 ? 's' : ''}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="zh-card p-4 sm:p-5 md:col-span-2">
              <h2 className="mb-4 text-sm font-semibold text-ink">Delivery breakdown</h2>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Delivered', value: analytics.delivered, color: 'text-success-700' },
                  { label: 'Bounced', value: analytics.bounced, color: 'text-warning-700' },
                  { label: 'Failed', value: analytics.failed, color: 'text-danger-600' },
                  { label: 'Unsubscribed', value: analytics.unsubscribes, color: 'text-danger-700' },
                ].map((item) => (
                  <div key={item.label} className="text-center">
                    <dd className={`font-display text-2xl font-semibold ${item.color}`}>{item.value}</dd>
                    <dt className="mt-0.5 text-xs text-muted">{item.label}</dt>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}

        {tab === 'recipients' && (
          <DataTable
            caption="Campaign recipients"
            columns={RECIPIENT_COLUMNS}
            rows={recipientsIsError ? undefined : recipientsData?.recipients}
            rowKey={(r) => r.id}
            loading={loadingRecipients}
            error={recipientsIsError ? recipientsError : undefined}
            onRetry={refetchRecipients}
            empty={
              <EmptyState
                compact
                icon={<Users size={22} aria-hidden="true" />}
                title="No recipient data yet"
                description="Delivery details appear here once the campaign has been sent."
              />
            }
          />
        )}

        {tab === 'unsubscribes' && <UnsubscribesTab />}
      </div>
    </>
  );
}
