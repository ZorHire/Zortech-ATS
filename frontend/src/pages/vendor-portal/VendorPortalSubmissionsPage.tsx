import { Users } from "lucide-react";
import VendorPortalLayout from "../../components/vendor-portal/VendorPortalLayout";
import { useGetVendorSubmissionsQuery } from "../../store/api/vendorPortalApi";
import { DataTable, EmptyState, PageHeader, StageBadge, StatCard } from "../../components/ui";
import type { Column } from "../../components/ui";

type Submission = NonNullable<ReturnType<typeof useGetVendorSubmissionsQuery>["data"]>[number];

const COLUMNS: Column<Submission>[] = [
  {
    key: "candidate",
    header: "Candidate",
    cell: (s) => (
      <>
        <p className="font-medium text-ink">{s.candidate_full_name}</p>
        <p className="text-xs text-muted">{s.candidate_email}</p>
        {s.experience_years != null && <p className="text-xs text-muted">{s.experience_years} yrs exp</p>}
      </>
    ),
  },
  {
    key: "job",
    header: "Job",
    cell: (s) => (
      <>
        <p className="font-medium text-ink">{s.job_title}</p>
        {s.client_name && <p className="text-xs text-muted">{s.client_name}</p>}
        {s.job_location && <p className="text-xs text-muted">{s.job_location}</p>}
      </>
    ),
  },
  {
    key: "status",
    header: "Status",
    cell: (s) => (
      <>
        {s.pipeline_stage ? <StageBadge stage={s.pipeline_stage} /> : <span className="text-xs text-muted">Pending</span>}
        {s.rejection_reason && <p className="mt-1 text-xs text-danger-600">{s.rejection_reason}</p>}
      </>
    ),
  },
  {
    key: "submitted",
    header: "Submitted",
    className: "whitespace-nowrap",
    cell: (s) => (
      <span className="text-xs text-muted">
        {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      </span>
    ),
  },
];

export default function VendorPortalSubmissionsPage() {
  const { data: submissions = [], isLoading, error, refetch } = useGetVendorSubmissionsQuery();

  const count = (stages: string[]) => submissions.filter((s) => stages.includes(s.pipeline_stage ?? "")).length;

  return (
    <VendorPortalLayout>
      <PageHeader title="My submissions" subtitle="Track all candidates you have submitted and their current status." />

      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
        {submissions.length > 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Total" value={submissions.length} tone="neutral" />
            <StatCard label="Under review" value={count(["new", "sourced", "screened"])} />
            <StatCard label="Shortlisted" value={count(["shortlisted", "submitted_to_client"])} tone="brand" />
            <StatCard label="Placed" value={count(["joined"])} tone="success" />
          </div>
        )}

        <DataTable
          caption="My submissions"
          columns={COLUMNS}
          rows={submissions}
          rowKey={(s) => s.id}
          loading={isLoading}
          error={error}
          onRetry={refetch}
          empty={
            <EmptyState
              icon={<Users size={22} aria-hidden="true" />}
              title="No submissions yet"
              description="Go to Assigned jobs and submit your first candidate."
            />
          }
        />
      </div>
    </VendorPortalLayout>
  );
}
