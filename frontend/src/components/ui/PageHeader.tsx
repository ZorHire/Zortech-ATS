import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  to?: string;
}

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** e.g. [{ label: "Jobs", to: "/jobs" }, { label: "SAP FICO Consultant" }] */
  breadcrumbs?: Crumb[];
  /** Primary action last (right-most). */
  actions?: ReactNode;
  /** Optional row under the title (tabs, filters). */
  children?: ReactNode;
}

/** One header pattern for every in-app page: breadcrumbs, title, subtitle, actions. */
export default function PageHeader({ title, subtitle, breadcrumbs, actions, children }: PageHeaderProps) {
  return (
    <div className="border-b border-line bg-white px-4 pb-4 pt-5 sm:px-6 lg:px-8">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {breadcrumbs.map((c, i) => (
              <li key={`${c.label}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={14} aria-hidden="true" className="text-line-strong" />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-ink hover:underline underline-offset-2">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-ink-soft">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-ink sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
