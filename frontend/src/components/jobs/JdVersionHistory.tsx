import { useState } from "react";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { useGetJobVersionsQuery } from "../../store/api/jdLifecycleApi";

interface Props {
  jobId: string;
}

export default function JdVersionHistory({ jobId }: Props) {
  const [open, setOpen] = useState(false);
  const { data: versions = [], isLoading } = useGetJobVersionsQuery(jobId, { skip: !open });

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <History size={15} className="text-gray-400" />
          Version History
        </span>
        {open ? (
          <ChevronUp size={15} className="text-gray-400" />
        ) : (
          <ChevronDown size={15} className="text-gray-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <div className="w-4 h-4 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
              Loading…
            </div>
          )}

          {!isLoading && versions.length === 0 && (
            <p className="text-xs text-gray-400 py-2">
              No versions yet. Versions are created when a JD is submitted for review.
            </p>
          )}

          {!isLoading && versions.length > 0 && (
            <ol className="relative border-l border-gray-200 ml-2 space-y-4">
              {versions.map((v) => (
                <li key={v.id} className="ml-4">
                  <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
                  <p className="text-xs font-semibold text-gray-700">
                    Version {v.version_num}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
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
    </div>
  );
}
