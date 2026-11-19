import { useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { useGetJobVersionsQuery } from "../../store/api/jdLifecycleApi";
import { Skeleton } from "../ui";

interface Props {
  jobId: string;
}

export default function JdVersionHistory({ jobId }: Props) {
  const [open, setOpen] = useState(false);
  const { data: versions = [], isLoading } = useGetJobVersionsQuery(jobId, { skip: !open });

  return (
    <section className="zh-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-surface"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-ink">
          <History size={16} className="text-muted" />
          Version History
        </span>
        {open ? (
          <ChevronUp size={16} className="text-muted" />
        ) : (
          <ChevronDown size={16} className="text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-line px-5 py-4">
          {isLoading && (
            <div className="space-y-3 py-1" role="status" aria-label="Loading versions">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-56" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-48" />
            </div>
          )}

          {!isLoading && versions.length === 0 && (
            <p className="py-2 text-sm text-muted">
              No versions yet. Versions are created when a JD is submitted for review.
            </p>
          )}

          {!isLoading && versions.length > 0 && (
            <ol className="relative ml-2 space-y-4 border-l border-line">
              {versions.map((v) => (
                <li key={v.id} className="ml-4">
                  <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-navy-600" />
                  <p className="text-sm font-semibold text-ink">
                    Version {v.version_num}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Submitted by {v.submitted_by_name ?? "Unknown"} ·{" "}
                    {new Date(v.created_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
