import type { ReactNode } from "react";
import { TableSkeleton } from "./Skeleton";
import { EmptyState, ErrorState } from "./States";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Tailwind width / alignment classes for th + td. */
  className?: string;
  /** Hide on small screens (e.g. "hidden md:table-cell"). */
  responsive?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** Accessible name for the table. */
  caption?: string;
}

/**
 * Standard list table: horizontal scroll on narrow screens, sticky header,
 * and built-in loading / error / empty states so pages can't forget them.
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  empty,
  caption,
}: DataTableProps<T>) {
  if (loading && !rows?.length) return <TableSkeleton columns={Math.min(columns.length, 6)} />;
  if (error && !rows?.length)
    return (
      <div className="zh-card">
        <ErrorState error={error} onRetry={onRetry} compact />
      </div>
    );
  if (!rows?.length)
    return <div className="zh-card">{empty ?? <EmptyState title="Nothing here yet" compact />}</div>;

  return (
    <div className="zh-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="sticky top-0 z-[1] bg-surface">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`border-b border-line px-4 py-2.5 text-left text-xs font-medium text-muted ${c.className ?? ""} ${c.responsive ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-b border-line last:border-0 ${onRowClick ? "cursor-pointer hover:bg-surface" : ""}`}
              >
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle text-ink ${c.className ?? ""} ${c.responsive ?? ""}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
