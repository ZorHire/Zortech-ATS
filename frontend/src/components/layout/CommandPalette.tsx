import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bookmark,
  Briefcase,
  Building,
  CalendarPlus,
  FileText,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Users,
} from "lucide-react";
import { useAppSelector } from "../../hooks/useAppSelector";
import { selectCurrentUser } from "../../store/slices/authSlice";
import { selectSubscription } from "../../store/slices/subscriptionSlice";
import { selectServerUnreachable } from "../../store/slices/connectionSlice";
import { useSearchCandidatesQuery } from "../../store/api/candidateApi";
import { useGetClientsQuery, useGetJobsQuery } from "../../store/api/jobApi";
import { describeApiError } from "../../store/api/baseApi";
import { NAV_GROUPS, visibleNavItems } from "./navConfig";

// ─── Types ───────────────────────────────────────────────────────────────────

type Kind = "candidate" | "job" | "client" | "page" | "action";

interface PaletteItem {
  /** Unique within its kind. */
  id: string;
  kind: Kind;
  label: string;
  hint?: string;
  to: string;
}

interface Group {
  key: string;
  label: string;
  items: PaletteItem[];
}

const STAFF = ["super_admin", "accounts_manager", "vendor_manager", "recruiter"];
const INTERVIEW_ROLES = ["super_admin", "accounts_manager", "recruiter"];
const PER_GROUP = 5;
const DEBOUNCE_MS = 250;

const KIND_ICON: Record<Kind, LucideIcon> = {
  candidate: Users,
  job: Briefcase,
  client: Building,
  page: FileText,
  action: Plus,
};

// ─── Recent items (localStorage, best effort) ─────────────────────────────────

const RECENT_KEY = "zorhire.palette.recent";
const RECENT_MAX = 6;

function readRecent(): PaletteItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is PaletteItem =>
          !!x && typeof x === "object" && typeof x.id === "string" && typeof x.label === "string" && typeof x.to === "string" && typeof x.kind === "string",
      )
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function pushRecent(item: PaletteItem) {
  try {
    const next = [item, ...readRecent().filter((r) => !(r.kind === item.kind && r.id === item.id))].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: recents are a convenience only */
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function includes(term: string, ...fields: (string | undefined | null)[]) {
  return fields.some((f) => !!f && f.toLowerCase().includes(term));
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);
/** "⌘K" on Mac, "Ctrl K" elsewhere. */
export const PALETTE_SHORTCUT_LABEL = IS_MAC ? "⌘K" : "Ctrl K";

function isEditable(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
}

/** Another dialog (modal, drawer, confirm) is open; the palette shouldn't stack on it. */
function otherDialogOpen(): boolean {
  return !!document.querySelector('[aria-modal="true"]:not([data-command-palette])');
}

/**
 * Global shortcuts: Ctrl+K / ⌘K toggles the palette anywhere; "/" opens it
 * when the user isn't typing in a field.
 */
export function useCommandPaletteShortcut(open: boolean, setOpen: (open: boolean) => void) {
  const openRef = useRef(open);
  openRef.current = open;
  const setRef = useRef(setOpen);
  setRef.current = setOpen;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const isK = e.key === "k" || e.key === "K";
      if (isK && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
        if (!openRef.current && otherDialogOpen()) return;
        e.preventDefault();
        setRef.current(!openRef.current);
        return;
      }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !openRef.current) {
        if (isEditable(e.target) || otherDialogOpen()) return;
        e.preventDefault();
        setRef.current(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <PalettePanel onClose={onClose} />;
}

function PalettePanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const profile = useAppSelector(selectCurrentUser);
  const subscription = useAppSelector(selectSubscription);
  const unreachable = useAppSelector(selectServerUnreachable);
  const role = profile?.role;
  const isStaff = !!role && STAFF.includes(role);
  const canSeeJobs = isStaff || role === "vendor_user";

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<PaletteItem[]>(() => readRecent());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const listId = `${baseId}-list`;
  const titleId = `${baseId}-title`;

  const term = query.trim().toLowerCase();
  const debounced = useDebounced(query.trim(), DEBOUNCE_MS);
  const candidateTerm = debounced.length >= 2 ? debounced : "";

  // Candidates: server search, debounced, paused while the API is unreachable.
  const cands = useSearchCandidatesQuery(
    { query: candidateTerm, location: "All", experience: "All", noticePeriod: "Any", page: 1, limit: PER_GROUP },
    { skip: !isStaff || !candidateTerm || unreachable },
  );
  // Jobs and clients: no search endpoint, so filter the cached lists client-side.
  const jobs = useGetJobsQuery(undefined, { skip: !canSeeJobs });
  const clients = useGetClientsQuery(undefined, { skip: !isStaff });

  const pages = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = visibleNavItems(role, !!subscription?.isPlatformOwner).map((n) => ({
      id: n.path,
      kind: "page",
      label: n.label,
      hint: n.group,
      to: n.path,
    }));
    if (isStaff) items.push({ id: "/search/saved", kind: "page", label: "Saved searches", hint: "Talent", to: "/search/saved" });
    return items;
  }, [role, subscription?.isPlatformOwner, isStaff]);

  const actions = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = [];
    if (isStaff) {
      list.push({ id: "new-job", kind: "action", label: "New job", hint: "Create a job opening", to: "/jobs/new" });
      list.push({ id: "add-candidate", kind: "action", label: "Add candidate", hint: "Go to Candidates", to: "/candidates" });
      list.push({ id: "resume-search", kind: "action", label: "Resume search", hint: "Search your database", to: "/search" });
    }
    if (role && INTERVIEW_ROLES.includes(role)) {
      list.push({ id: "book-interview", kind: "action", label: "Book interview", hint: "Go to Interviews", to: "/interviews" });
    }
    return list;
  }, [isStaff, role]);

  const groups = useMemo<Group[]>(() => {
    if (!term) {
      const g: Group[] = [];
      if (recent.length) g.push({ key: "recent", label: "Recent", items: recent });
      if (actions.length) g.push({ key: "actions", label: "Actions", items: actions });
      return g;
    }
    const g: Group[] = [];
    const candItems: PaletteItem[] =
      candidateTerm && !cands.isError
        ? (cands.currentData?.results ?? []).slice(0, PER_GROUP).map(({ candidate: c }) => ({
            id: c.id,
            kind: "candidate",
            label: `${c.first_name} ${c.last_name}`.trim(),
            hint: [c.current_title, c.current_location].filter(Boolean).join(" · ") || c.email,
            to: `/candidates/${c.id}`,
          }))
        : [];
    if (candItems.length) g.push({ key: "candidates", label: "Candidates", items: candItems });

    const jobItems: PaletteItem[] = (jobs.data ?? [])
      .filter((j) => includes(term, j.title, j.client?.name, j.location, j.department))
      .slice(0, PER_GROUP)
      .map((j) => ({
        id: j.id,
        kind: "job",
        label: j.title,
        hint: [j.client?.name, j.location, j.status].filter(Boolean).join(" · "),
        to: `/jobs/${j.id}`,
      }));
    if (jobItems.length) g.push({ key: "jobs", label: "Jobs", items: jobItems });

    const clientItems: PaletteItem[] = (clients.data ?? [])
      .filter((c) => includes(term, c.name, c.city, c.industry, c.primary_contact_name))
      .slice(0, PER_GROUP)
      .map((c) => ({
        id: c.id,
        kind: "client",
        label: c.name,
        hint: [c.industry, c.city].filter(Boolean).join(" · "),
        to: "/clients",
      }));
    if (clientItems.length) g.push({ key: "clients", label: "Clients", items: clientItems });

    const pageItems = pages.filter((p) => includes(term, p.label, p.hint)).slice(0, PER_GROUP);
    if (pageItems.length) g.push({ key: "pages", label: "Pages", items: pageItems });

    const actionItems: PaletteItem[] = actions.filter((a) => includes(term, a.label, a.hint));
    if (isStaff) {
      actionItems.push({
        id: "search-resumes",
        kind: "action",
        label: `Search resumes for “${query.trim()}”`,
        to: `/search?${new URLSearchParams({ q: query.trim() }).toString()}`,
      });
    }
    if (actionItems.length) g.push({ key: "actions", label: "Actions", items: actionItems });
    return g;
  }, [term, query, recent, actions, pages, candidateTerm, cands.currentData, cands.isError, jobs.data, clients.data, isStaff]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : -1;
  const optionId = (i: number) => `${baseId}-opt-${i}`;

  // New query -> back to the first result.
  useEffect(() => setActive(0), [term]);

  // Keep the active option visible.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // Focus, scroll lock, focus return, Esc from anywhere in the panel.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeRef.current();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  const select = (item: PaletteItem) => {
    pushRecent(item);
    setRecent(readRecent());
    onClose();
    navigate(item.to);
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!flat.length) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + delta + flat.length) % flat.length);
    } else if (e.key === "Home" && e.ctrlKey) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End" && e.ctrlKey) {
      e.preventDefault();
      setActive(Math.max(flat.length - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) select(flat[activeIndex]);
    } else if (e.key === "Tab") {
      // Single focus stop: keep focus in the input.
      e.preventDefault();
    }
  };

  const typing = !!term && query.trim() !== debounced;
  const searchingCandidates = isStaff && !!candidateTerm && cands.isFetching;
  const busy = typing || searchingCandidates;

  const notices: string[] = [];
  if (term && isStaff && unreachable) notices.push("Can't reach the ZorHire server. Candidate search is paused until it's back.");
  else if (term && cands.isError) notices.push(`Candidates: ${describeApiError(cands.error, "search failed.")}`);
  if (jobs.isError) notices.push(`Jobs: ${describeApiError(jobs.error, "couldn't load.")}`);
  if (term && clients.isError) notices.push(`Clients: ${describeApiError(clients.error, "couldn't load.")}`);

  let index = -1;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:p-4 sm:pt-[12vh]">
      <div className="absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]" aria-hidden="true" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-command-palette
        className="relative flex max-h-full w-full flex-col overflow-hidden bg-white shadow-pop sm:max-h-[70vh] sm:max-w-2xl sm:rounded-2xl"
      >
        <h2 id={titleId} className="sr-only">
          Search ZorHire
        </h2>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={flat.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            aria-label="Search candidates, jobs, clients and pages"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder={isStaff ? "Search candidates, jobs, clients, pages…" : "Search jobs and pages…"}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-muted/70 focus-visible:shadow-none"
          />
          {busy && <Loader2 size={16} className="shrink-0 animate-spin text-muted" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-line px-1.5 py-0.5 text-xs font-medium text-muted hover:text-ink"
            aria-label="Close search"
          >
            Esc
          </button>
        </div>

        {notices.length > 0 && (
          <div role="status" className="space-y-1 border-b border-line bg-warning-50 px-4 py-2">
            {notices.map((n) => (
              <p key={n} className="flex items-start gap-2 text-xs text-warning-700">
                <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                {n}
              </p>
            ))}
          </div>
        )}

        <div ref={listRef} id={listId} role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-y-auto py-2">
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${baseId}-${g.key}`} className="pb-1">
              <div id={`${baseId}-${g.key}`} className="px-4 pb-1 pt-2 text-xs font-medium text-muted">
                {g.label}
              </div>
              {g.items.map((item) => {
                index += 1;
                const i = index;
                const selected = i === activeIndex;
                const Icon = itemIcon(item);
                return (
                  <div
                    key={`${g.key}-${item.kind}-${item.id}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    onMouseMove={() => i !== activeIndex && setActive(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(item)}
                    className={`mx-2 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 ${selected ? "bg-navy-50 text-navy-800" : "text-ink"}`}
                  >
                    <Icon size={16} className={selected ? "text-navy-600" : "text-muted"} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      {item.hint && <span className="block truncate text-xs text-muted">{item.hint}</span>}
                    </span>
                    {selected && <span className="hidden text-xs text-muted sm:inline" aria-hidden="true">Enter</span>}
                  </div>
                );
              })}
            </div>
          ))}

          {flat.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted">
              {term ? (busy ? "Searching…" : `No matches for “${query.trim()}”.`) : "Type to search candidates, jobs, clients and pages."}
            </p>
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-line bg-surface px-4 py-2 text-xs text-muted sm:flex">
          <span>↑↓ to move</span>
          <span>Enter to open</span>
          <span>Esc to close</span>
          <span className="ml-auto">{PALETTE_SHORTCUT_LABEL} or / to open</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const ACTION_ICONS: Record<string, LucideIcon> = {
  "new-job": Plus,
  "add-candidate": UserPlus,
  "resume-search": Search,
  "search-resumes": Search,
  "book-interview": CalendarPlus,
  "/search/saved": Bookmark,
};

const PAGE_ICONS: Record<string, LucideIcon> = Object.fromEntries(
  NAV_GROUPS.flatMap((g) => g.items.map((i) => [i.path, i.icon] as const)),
);

function itemIcon(item: PaletteItem): LucideIcon {
  if (item.kind === "page") return PAGE_ICONS[item.id] ?? ACTION_ICONS[item.id] ?? KIND_ICON.page;
  if (item.kind === "action") return ACTION_ICONS[item.id] ?? KIND_ICON.action;
  return KIND_ICON[item.kind];
}
