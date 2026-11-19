import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { BookmarkPlus, Briefcase, Clock, ExternalLink, Mail, MapPin, Phone, Timer, X } from "lucide-react";
import type { Candidate } from "../../types";
import { Badge, buttonClasses, Button } from "../ui";
import type { BadgeTone } from "../ui";
import { isMatchedSkill } from "./searchUrl";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function matchTone(score: number): BadgeTone {
  if (score >= 88) return "success";
  if (score >= 75) return "navy";
  if (score >= 60) return "warning";
  return "danger";
}

function noticeLabel(days?: number | null) {
  if (days == null) return null;
  if (days === 0) return "Immediate joiner";
  return `${days} days notice`;
}

interface CandidatePreviewDrawerProps {
  candidate: Candidate;
  score?: number;
  /** Lower-cased search terms; matching skills are highlighted. */
  highlightTerms?: string[];
  onClose: () => void;
  onAddToJob: (c: Candidate) => void;
  onEmail: (c: Candidate) => void;
}

/**
 * Right-side panel with a candidate's key details, opened from a resume-search
 * row. Esc / close button / backdrop close it; focus is trapped and returned.
 */
export default function CandidatePreviewDrawer({
  candidate,
  score,
  highlightTerms = [],
  onClose,
  onAddToJob,
  onEmail,
}: CandidatePreviewDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      opener?.focus?.();
    };
  }, []);

  const c = candidate;
  const name = `${c.first_name} ${c.last_name}`.trim();
  const skills = c.skills ?? [];
  const matched = skills.filter((s) => isMatchedSkill(s, highlightTerms));
  const others = skills.filter((s) => !isMatchedSkill(s, highlightTerms));
  const notice = noticeLabel(c.notice_period_days);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy-950/30" aria-hidden="true" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col bg-white shadow-pop"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold text-ink">
              {name}
            </h2>
            <p className="truncate text-sm text-muted">
              {[c.current_title, c.current_company].filter(Boolean).join(" at ") || "No current role on file"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="-mr-2 rounded-lg p-2 text-muted hover:bg-surface-sunken hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            {score != null && <Badge tone={matchTone(score)}>{score}% match</Badge>}
            {c.source && <Badge tone="neutral">{c.source.charAt(0).toUpperCase() + c.source.slice(1)}</Badge>}
          </div>

          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2 text-ink-soft">
              <Clock size={14} className="text-muted" aria-hidden="true" />
              <dt className="sr-only">Experience</dt>
              <dd>{c.experience_years ? `${c.experience_years} years` : "Experience not set"}</dd>
            </div>
            <div className="flex items-center gap-2 text-ink-soft">
              <Timer size={14} className="text-muted" aria-hidden="true" />
              <dt className="sr-only">Notice period</dt>
              <dd>{notice ?? "Notice not set"}</dd>
            </div>
            <div className="flex items-center gap-2 text-ink-soft">
              <MapPin size={14} className="text-muted" aria-hidden="true" />
              <dt className="sr-only">Location</dt>
              <dd className="truncate">
                {c.current_location || "Location not set"}
                {c.preferred_location && c.preferred_location !== c.current_location ? ` (prefers ${c.preferred_location})` : ""}
              </dd>
            </div>
            {c.current_company && (
              <div className="flex items-center gap-2 text-ink-soft">
                <Briefcase size={14} className="text-muted" aria-hidden="true" />
                <dt className="sr-only">Company</dt>
                <dd className="truncate">{c.current_company}</dd>
              </div>
            )}
            {c.email && (
              <div className="flex min-w-0 items-center gap-2 text-ink-soft sm:col-span-2">
                <Mail size={14} className="text-muted" aria-hidden="true" />
                <dt className="sr-only">Email</dt>
                <dd className="truncate">
                  <a href={`mailto:${c.email}`} className="text-navy-600 hover:underline">
                    {c.email}
                  </a>
                </dd>
              </div>
            )}
            {c.phone && (
              <div className="flex items-center gap-2 text-ink-soft sm:col-span-2">
                <Phone size={14} className="text-muted" aria-hidden="true" />
                <dt className="sr-only">Phone</dt>
                <dd>
                  <a href={`tel:${c.phone}`} className="text-navy-600 hover:underline">
                    {c.phone}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <section aria-labelledby={`${titleId}-skills`}>
            <h3 id={`${titleId}-skills`} className="mb-2 text-xs font-medium text-muted">
              Skills{matched.length > 0 ? ` (${matched.length} matched)` : ""}
            </h3>
            {skills.length === 0 ? (
              <p className="text-sm text-muted">No skills on file.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {matched.map((s) => (
                  <li key={s} className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-800">
                    <span className="sr-only">Matched: </span>
                    {s}
                  </li>
                ))}
                {others.map((s) => (
                  <li key={s} className="rounded-md bg-surface-sunken px-2 py-0.5 text-xs text-ink-soft">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {c.summary && (
            <section aria-labelledby={`${titleId}-summary`}>
              <h3 id={`${titleId}-summary`} className="mb-1 text-xs font-medium text-muted">
                Summary
              </h3>
              <p className="whitespace-pre-line text-sm text-ink-soft">{c.summary}</p>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-line bg-surface px-5 py-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" icon={<Mail size={16} />} onClick={() => onEmail(c)} disabled={!c.email}>
            Email
          </Button>
          <Button variant="secondary" icon={<BookmarkPlus size={16} />} onClick={() => onAddToJob(c)}>
            Add to job
          </Button>
          <Link to={`/candidates/${c.id}`} data-autofocus className={buttonClasses("primary", "md", "gap-2")}>
            <ExternalLink size={16} aria-hidden="true" />
            Open profile
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
