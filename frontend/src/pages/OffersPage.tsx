import React from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ExternalLink,
  Briefcase,
  MapPin,
} from "lucide-react";
import {
  useGetOfferStatsQuery,
  useGetOffersQuery,
  useGetPlacementsQuery,
  type OfferRecord,
  type PlacementRecord,
} from "../store/api/offersApi";
import {
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  StageBadge,
  StatCard,
  Button,
  buttonClasses,
} from "../components/ui";
import type { Column } from "../components/ui";
import { formatINR } from "../lib/format";

type MainTab = "offers" | "placements";
type OfferFilter = "all" | "offer_extended" | "offer_accepted" | "offer_rejected";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysSince(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/** Fields shared by offer and placement rows. */
type Row = OfferRecord | PlacementRecord;

function sharedColumns<T extends Row>(): Column<T>[] {
  return [
    {
      key: "candidate",
      header: "Candidate",
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">
            {row.first_name} {row.last_name}
          </p>
          <p className="truncate text-xs text-muted">{row.candidate_email}</p>
          {row.current_title && <p className="mt-0.5 text-xs text-muted">{row.current_title}</p>}
        </div>
      ),
    },
    {
      key: "job",
      header: "Job",
      cell: (row) => (
        <div>
          <p className="font-medium text-ink">{row.job_title}</p>
          {row.job_location && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <MapPin size={11} aria-hidden="true" />
              {row.job_location}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      cell: (row) => row.client_name || <span className="text-muted">—</span>,
    },
    {
      key: "ctc",
      header: "CTC (current → expected)",
      className: "whitespace-nowrap",
      cell: (row) => (
        <div className="flex items-center gap-2 text-xs">
          <span title="Current CTC" className="text-ink-soft">
            {formatINR(row.current_ctc)}
          </span>
          <span className="text-line-strong" aria-hidden="true">
            →
          </span>
          <span title="Expected CTC" className="font-medium text-success-700">
            {formatINR(row.expected_ctc)}
          </span>
        </div>
      ),
    },
  ];
}

function pipelineColumn<T extends Row>(): Column<T> {
  return {
    key: "link",
    header: <span className="sr-only">Open</span>,
    className: "whitespace-nowrap",
    cell: (row) => (
      <Link
        to={`/jobs/${row.job_id}`}
        className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline"
      >
        <ExternalLink size={12} aria-hidden="true" />
        Pipeline
      </Link>
    ),
  };
}

const OFFER_COLUMNS: Column<OfferRecord>[] = [
  ...sharedColumns<OfferRecord>(),
  {
    key: "date",
    header: "Date",
    className: "whitespace-nowrap",
    cell: (row) => (
      <div className="text-ink-soft">
        {formatDate(row.stage_updated_at)}
        <p className="mt-0.5 text-xs text-muted">{daysSince(row.stage_updated_at)}d ago</p>
      </div>
    ),
  },
  { key: "status", header: "Status", cell: (row) => <StageBadge stage={row.stage} /> },
  pipelineColumn<OfferRecord>(),
];

const PLACEMENT_COLUMNS: Column<PlacementRecord>[] = [
  ...sharedColumns<PlacementRecord>(),
  {
    key: "date",
    header: "Placement date",
    className: "whitespace-nowrap",
    cell: (row) => <span className="text-ink-soft">{formatDate(row.placement_date)}</span>,
  },
  { key: "status", header: "Status", cell: (row) => <StageBadge stage={row.stage} /> },
  pipelineColumn<PlacementRecord>(),
];

const OFFER_FILTER_TABS: { key: OfferFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "offer_extended", label: "Pending" },
  { key: "offer_accepted", label: "Accepted" },
  { key: "offer_rejected", label: "Declined" },
];

export default function OffersPage() {
  const [mainTab, setMainTab] = React.useState<MainTab>("offers");
  const [offerFilter, setOfferFilter] = React.useState<OfferFilter>("all");

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useGetOfferStatsQuery();
  const {
    data: offers = [],
    isLoading: offersLoading,
    isError: offersIsError,
    error: offersError,
    refetch: refetchOffers,
  } = useGetOffersQuery();
  const {
    data: placements = [],
    isLoading: placementsLoading,
    isError: placementsIsError,
    error: placementsError,
    refetch: refetchPlacements,
  } = useGetPlacementsQuery();

  const filteredOffers =
    offerFilter === "all" ? offers : offers.filter((o) => o.stage === offerFilter);

  const pipelineAction = (
    <Link to="/jobs" className={buttonClasses("primary")}>
      Go to jobs
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Offers & placements"
        subtitle="Track offer letters and successful placements across all jobs"
      />
      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {statsError ? (
          <div className="zh-card">
            <ErrorState
              compact
              title="Couldn't load offer stats"
              error={statsErr}
              onRetry={refetchStats}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pending"
              value={stats?.pending ?? 0}
              hint="Awaiting response"
              icon={<Clock size={18} />}
              tone="navy"
              loading={statsLoading}
            />
            <StatCard
              label="Accepted"
              value={stats?.accepted ?? 0}
              hint="Offers accepted"
              icon={<CheckCircle2 size={18} />}
              tone="success"
              loading={statsLoading}
            />
            <StatCard
              label="Declined"
              value={stats?.declined ?? 0}
              hint="Offers declined"
              icon={<XCircle size={18} />}
              tone="danger"
              loading={statsLoading}
            />
            <StatCard
              label="Placements"
              value={stats?.placements ?? 0}
              hint="Candidates joined"
              icon={<TrendingUp size={18} />}
              tone="brand"
              loading={statsLoading}
            />
          </div>
        )}

        <div
          role="tablist"
          aria-label="Offers or placements"
          className="flex w-full gap-1 rounded-lg bg-surface-sunken p-1 sm:w-fit"
        >
          {(["offers", "placements"] as MainTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={mainTab === tab}
              onClick={() => setMainTab(tab)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-5 py-1.5 text-sm font-medium transition-colors sm:flex-none ${
                mainTab === tab ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              {tab === "offers" ? (
                <Briefcase size={14} aria-hidden="true" />
              ) : (
                <Users size={14} aria-hidden="true" />
              )}
              {tab === "offers" ? "Offers" : "Placements"}
            </button>
          ))}
        </div>

        {mainTab === "offers" && (
          <>
            <div className="flex flex-wrap gap-2" aria-label="Filter offers by status">
              {OFFER_FILTER_TABS.map((tab) => {
                const active = offerFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setOfferFilter(tab.key)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-navy-600 bg-navy-600 text-white"
                        : "border-line bg-white text-ink-soft hover:border-line-strong"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-1.5 opacity-70">
                      {tab.key === "all"
                        ? offers.length
                        : offers.filter((o) => o.stage === tab.key).length}
                    </span>
                  </button>
                );
              })}
            </div>

            <DataTable
              caption="Offers"
              columns={OFFER_COLUMNS}
              rows={offersIsError ? undefined : filteredOffers}
              rowKey={(r) => r.application_id}
              loading={offersLoading}
              error={offersIsError ? offersError : undefined}
              onRetry={refetchOffers}
              empty={
                offers.length === 0 ? (
                  <EmptyState
                    icon={<Briefcase size={22} aria-hidden="true" />}
                    title="No offers yet"
                    description="Candidates moved to an offer stage in a job pipeline show up here."
                    action={pipelineAction}
                  />
                ) : (
                  <EmptyState
                    icon={<Briefcase size={22} aria-hidden="true" />}
                    title="No offers in this view"
                    action={
                      <Button variant="secondary" onClick={() => setOfferFilter("all")}>
                        Show all offers
                      </Button>
                    }
                  />
                )
              }
            />
          </>
        )}

        {mainTab === "placements" && (
          <DataTable
            caption="Placements"
            columns={PLACEMENT_COLUMNS}
            rows={placementsIsError ? undefined : placements}
            rowKey={(r) => r.application_id}
            loading={placementsLoading}
            error={placementsIsError ? placementsError : undefined}
            onRetry={refetchPlacements}
            empty={
              <EmptyState
                icon={<Users size={22} aria-hidden="true" />}
                title="No placements yet"
                description="Accepted offers and joined candidates appear here."
                action={pipelineAction}
              />
            }
          />
        )}
      </div>
    </>
  );
}
