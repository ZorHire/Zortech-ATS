import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Bookmark, Play, Search, Trash2 } from "lucide-react";
import {
  Badge,
  buttonClasses,
  EmptyState,
  ErrorState,
  PageHeader,
  TableSkeleton,
  useConfirm,
} from "../components/ui";
import { useNotify } from "../hooks/useNotify";
import { describeApiError } from "../store/api/baseApi";
import {
  useGetSavedSearchesQuery,
  useDeleteSavedSearchMutation,
  type SavedSearch,
} from "../store/api/savedSearchesApi";
import { savedQueryToSearch, searchUrl, summarizeSearch } from "../components/resume-search/searchUrl";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function SavedSearchesPage() {
  const { data: searches = [], isLoading, isError, error, refetch, isFetching } = useGetSavedSearchesQuery();
  const [deleteSearch] = useDeleteSavedSearchMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const confirm = useConfirm();
  const notify = useNotify();

  const filtered = searches.filter((s) => !filter || s.name.toLowerCase().includes(filter.trim().toLowerCase()));

  const handleDelete = async (s: SavedSearch) => {
    const ok = await confirm({
      title: "Delete saved search?",
      message: `"${s.name}" and any email alerts for it will be removed.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    setDeletingId(s.id);
    try {
      await deleteSearch(s.id).unwrap();
      notify.success("Saved search deleted");
    } catch (err) {
      notify.error(describeApiError(err, "Couldn't delete this search."));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Saved searches"
        subtitle="Re-run the resume searches you use often"
        breadcrumbs={[{ label: "Resume search", to: "/search" }, { label: "Saved searches" }]}
        actions={
          <Link to="/search" className={buttonClasses("primary", "md")}>
            <Search size={16} aria-hidden="true" />
            New search
          </Link>
        }
      />

      <div className="space-y-4 p-4 sm:p-6 lg:p-8">
        {searches.length > 0 && (
          <div className="max-w-sm">
            <label htmlFor="saved-filter" className="sr-only">
              Filter saved searches by name
            </label>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
              <input
                id="saved-filter"
                type="search"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by name…"
                className="zh-input py-2 pl-9"
              />
            </div>
          </div>
        )}

        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : isError ? (
          <div className="zh-card">
            <ErrorState error={error} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="zh-card">
            <EmptyState
              icon={<Bookmark size={22} aria-hidden="true" />}
              title={searches.length === 0 ? "No saved searches yet" : "No searches match your filter"}
              description={
                searches.length === 0 ? "Run a resume search and choose “Save search” to keep it here." : undefined
              }
              action={
                searches.length === 0 ? (
                  <Link to="/search" className={buttonClasses("secondary", "md")}>
                    Go to resume search
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ul className="zh-card divide-y divide-line">
            {filtered.map((s) => {
              const search = savedQueryToSearch(s.query ?? {});
              return (
                <li key={s.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-ink">{s.name}</h2>
                      {s.email_alerts && (
                        <Badge tone="warning" icon={<Bell size={12} aria-hidden="true" />}>
                          Alerts on
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted">{summarizeSearch(search)}</p>
                    <p className="mt-0.5 text-xs text-muted">Saved {fmtDate(s.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={searchUrl(search)}
                      className={buttonClasses("secondary", "sm")}
                      aria-label={`Run saved search ${s.name}`}
                    >
                      <Play size={14} aria-hidden="true" />
                      Run
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      disabled={deletingId === s.id}
                      aria-label={`Delete saved search ${s.name}`}
                      className="rounded-lg p-2 text-muted transition-colors hover:bg-danger-50 hover:text-danger-600 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
