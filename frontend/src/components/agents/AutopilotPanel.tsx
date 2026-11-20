import { useId, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, Bot, CalendarPlus, Save, X } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Skeleton, buttonClasses, useConfirm } from "../ui";
import { useNotify } from "../../hooks/useNotify";
import { describeApiError } from "../../store/api/baseApi";
import {
  useGetAgentActivityQuery,
  useGetAutopilotQuery,
  useUpdateAutopilotMutation,
} from "../../store/api/agentsApi";
import type { AutopilotSettings } from "../../types/agents";
import AgentActivityList from "./AgentActivityList";

type Draft = Omit<AutopilotSettings, "job_id" | "updated_at">;
type DraftErrors = Partial<Record<keyof Draft, string>>;

const SLOT_FORMAT = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function toDraft(s: AutopilotSettings): Draft {
  return {
    enabled: s.enabled,
    shortlist_threshold: s.shortlist_threshold,
    screen_pass_threshold: s.screen_pass_threshold,
    auto_screen: s.auto_screen,
    auto_schedule: s.auto_schedule,
    interview_duration_min: s.interview_duration_min,
    interview_slots: [...(s.interview_slots ?? [])].sort(),
    daily_outreach_cap: s.daily_outreach_cap,
  };
}

function sameDraft(a: Draft, b: Draft): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isWholeIn(n: number, min: number, max: number) {
  return Number.isInteger(n) && n >= min && n <= max;
}

function validate(d: Draft): DraftErrors {
  const e: DraftErrors = {};
  if (!isWholeIn(d.shortlist_threshold, 0, 100)) e.shortlist_threshold = "Enter a whole number from 0 to 100.";
  if (!isWholeIn(d.screen_pass_threshold, 0, 100)) e.screen_pass_threshold = "Enter a whole number from 0 to 100.";
  if (!isWholeIn(d.interview_duration_min, 15, 240)) e.interview_duration_min = "Enter 15 to 240 minutes.";
  if (!isWholeIn(d.daily_outreach_cap, 0, 1000)) e.daily_outreach_cap = "Enter a whole number from 0 to 1000.";
  if (d.enabled && d.auto_schedule && d.interview_slots.filter((s) => new Date(s).getTime() > Date.now()).length === 0) {
    e.interview_slots = "Add at least one future slot, or turn off auto schedule.";
  }
  return e;
}

/** `YYYY-MM-DDTHH:mm` in local time, for <input type="datetime-local"> min. */
function localInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Accessible on/off switch. */
function Switch({
  checked,
  onChange,
  label,
  disabled,
  size = "md",
  describedBy,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  size?: "md" | "lg";
  describedBy?: string;
}) {
  const lg = size === "lg";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-300 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55 ${
        lg ? "h-8 w-14" : "h-6 w-11"
      } ${checked ? "bg-success-600" : "bg-line-strong"}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block transform rounded-full bg-white shadow transition-transform ${
          lg ? "h-6 w-6" : "h-4 w-4"
        } ${checked ? (lg ? "translate-x-7" : "translate-x-6") : "translate-x-1"}`}
      />
    </button>
  );
}

function FieldError({ id, children }: { id: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="mt-1 text-xs text-danger-600">
      {children}
    </p>
  );
}

/** Slider + number box for a 0-100 threshold. */
function ThresholdField({
  label,
  hint,
  value,
  onChange,
  error,
  disabled,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (n: number) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  return (
    <div>
      <label htmlFor={`${id}-num`} className="zh-label">
        {label}
      </label>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          aria-label={`${label} slider`}
          aria-valuetext={`${value} out of 100`}
          aria-describedby={hintId}
          className="h-2 min-w-0 flex-1 cursor-pointer accent-navy-600 disabled:cursor-not-allowed"
        />
        <input
          id={`${id}-num`}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={`${hintId}${error ? ` ${errId}` : ""}`}
          className="zh-input w-20 px-2.5 py-1.5 text-center"
        />
      </div>
      <p id={hintId} className="mt-1 text-xs text-muted">
        {hint}
      </p>
      <FieldError id={errId}>{error}</FieldError>
    </div>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  error,
  disabled,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="zh-label">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          disabled={disabled}
          aria-invalid={!!error || undefined}
          aria-describedby={`${hint ? `${id}-hint` : ""}${error ? ` ${id}-err` : ""}`.trim() || undefined}
          className="zh-input w-28 px-2.5 py-1.5"
        />
        {suffix && <span className="text-sm text-muted">{suffix}</span>}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-line bg-surface p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        <p id={id} className="mt-0.5 text-xs text-muted">
          {description}
        </p>
      </div>
      <Switch checked={checked} onChange={onChange} label={label} describedBy={id} disabled={disabled} />
    </div>
  );
}

function SlotsEditor({
  slots,
  onChange,
  error,
  disabled,
}: {
  slots: string[];
  onChange: (slots: string[]) => void;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const now = Date.now();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const add = () => {
    if (!value) {
      setAddError("Pick a date and time first.");
      return;
    }
    const d = new Date(value); // datetime-local is interpreted in the viewer's time zone
    if (Number.isNaN(d.getTime())) {
      setAddError("That date and time isn't valid.");
      return;
    }
    if (d.getTime() <= Date.now()) {
      setAddError("Pick a time in the future.");
      return;
    }
    const iso = d.toISOString();
    if (slots.some((s) => new Date(s).getTime() === d.getTime())) {
      setAddError("That slot is already in the list.");
      return;
    }
    onChange([...slots, iso].sort());
    setValue("");
    setAddError(null);
  };

  const pastCount = slots.filter((s) => new Date(s).getTime() <= now).length;

  return (
    <div>
      <label htmlFor={id} className="zh-label">
        Interview slots
      </label>
      <p className="mb-2 text-xs text-muted">
        Candidates who pass screening pick one of these times. Shown in your time zone ({tz}).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          type="datetime-local"
          value={value}
          min={localInputValue(new Date())}
          onChange={(e) => {
            setValue(e.target.value);
            setAddError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          disabled={disabled}
          aria-invalid={!!addError || undefined}
          aria-describedby={addError ? `${id}-adderr` : undefined}
          className="zh-input py-2 sm:max-w-xs"
        />
        <Button variant="secondary" icon={<CalendarPlus size={16} />} onClick={add} disabled={disabled}>
          Add slot
        </Button>
      </div>
      <FieldError id={`${id}-adderr`}>{addError}</FieldError>

      {slots.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line-strong p-3 text-center text-sm text-muted">
          No slots yet.
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Offered interview slots">
          {slots.map((s) => {
            const past = new Date(s).getTime() <= now;
            const label = SLOT_FORMAT.format(new Date(s));
            return (
              <li
                key={s}
                className={`inline-flex items-center gap-1.5 rounded-lg border py-1 pl-2.5 pr-1 text-sm ${
                  past ? "border-line bg-surface-sunken text-muted line-through" : "border-navy-100 bg-navy-50 text-navy-700"
                }`}
              >
                <time dateTime={s}>{label}</time>
                {past && <span className="sr-only">(past)</span>}
                <button
                  type="button"
                  onClick={() => onChange(slots.filter((x) => x !== s))}
                  disabled={disabled}
                  aria-label={`Remove slot ${label}`}
                  className="rounded p-1 text-muted hover:bg-white hover:text-danger-600 disabled:opacity-50"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {pastCount > 0 && (
        <p className="mt-2 text-xs text-muted">
          {pastCount} past slot{pastCount === 1 ? " is" : "s are"} crossed out and will be removed when you save.
        </p>
      )}
      <FieldError id={`${id}-err`}>{error}</FieldError>
    </div>
  );
}

function AutopilotForm({ jobId, settings }: { jobId: string; settings: AutopilotSettings }) {
  const notify = useNotify();
  const confirm = useConfirm();
  const [updateAutopilot, { isLoading: saving }] = useUpdateAutopilotMutation();
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings));
  const [toggling, setToggling] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const copyId = useId();
  // Settings fold away while autopilot is off, so the job details stay near the top.
  const [expanded, setExpanded] = useState(settings.enabled);

  const saved = useMemo(() => toDraft(settings), [settings]);
  const dirty = !sameDraft({ ...draft, enabled: saved.enabled }, saved);
  const errors = validate({ ...draft, enabled: settings.enabled });
  const visibleErrors = showErrors ? errors : {};
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const confirmTurnOn = () =>
    confirm({
      title: "Turn on autopilot for this job?",
      message:
        "Autopilot will score new candidates, and candidates it shortlists will automatically get emails from your mailbox: a screening interview invite and, if they pass, a link to book an interview. It never rejects anyone — low scores go to Needs review.",
      confirmText: "Turn on autopilot",
    });

  const buildBody = (): Partial<AutopilotSettings> => ({
    shortlist_threshold: draft.shortlist_threshold,
    screen_pass_threshold: draft.screen_pass_threshold,
    auto_screen: draft.auto_screen,
    auto_schedule: draft.auto_schedule,
    interview_duration_min: draft.interview_duration_min,
    interview_slots: draft.interview_slots.filter((s) => new Date(s).getTime() > Date.now()),
    daily_outreach_cap: draft.daily_outreach_cap,
  });

  // The master switch saves immediately. Turning it on also saves any unsaved
  // settings, so autopilot never starts with values the recruiter didn't see saved.
  const toggleEnabled = async (next: boolean) => {
    let body: Partial<AutopilotSettings> = { enabled: next };
    if (next) {
      const onErrors = validate({ ...draft, enabled: true });
      if (Object.keys(onErrors).length > 0) {
        setShowErrors(true);
        notify.warning(
          onErrors.interview_slots && Object.keys(onErrors).length === 1
            ? "Add at least one future interview slot (or turn off auto schedule) before turning on autopilot."
            : "Please fix the highlighted settings before turning on autopilot.",
        );
        return;
      }
      if (!(await confirmTurnOn())) return;
      if (dirty) body = { ...buildBody(), enabled: true };
    }
    setToggling(true);
    try {
      const result = await updateAutopilot({ jobId, body }).unwrap();
      if (next && dirty) {
        setDraft(toDraft(result));
        setShowErrors(false);
      } else {
        setDraft((d) => ({ ...d, enabled: result.enabled }));
      }
      notify.success(result.enabled ? "Autopilot is on for this job" : "Autopilot is off for this job");
    } catch (err) {
      notify.error(describeApiError(err, "Couldn't change autopilot. Please try again."));
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      notify.error("Please fix the highlighted settings.");
      return;
    }
    try {
      const result = await updateAutopilot({ jobId, body: buildBody() }).unwrap();
      setDraft(toDraft(result));
      setShowErrors(false);
      notify.success("Autopilot settings saved");
    } catch (err) {
      notify.error(describeApiError(err, "Couldn't save autopilot settings. Please try again."));
    }
  };

  const busy = saving || toggling;
  const hasPastSlots = draft.interview_slots.some((s) => new Date(s).getTime() <= Date.now());

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
            <Bot size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-ink">Autopilot</h2>
              <Badge tone={settings.enabled ? "success" : "neutral"}>{settings.enabled ? "On" : "Off"}</Badge>
            </div>
            <p id={copyId} className="mt-0.5 max-w-2xl text-sm text-muted">
              Autopilot shortlists, screens and schedules candidates for this job. It never rejects anyone — low
              scores go to Needs review.
            </p>
          </div>
        </div>
        <Switch
          size="lg"
          checked={settings.enabled}
          onChange={toggleEnabled}
          label="Autopilot for this job"
          describedBy={copyId}
          disabled={busy}
        />
      </div>

      {!(expanded || settings.enabled || dirty) ? (
        <div className="mt-4 border-t border-line pt-4">
          <Button variant="link" size="sm" onClick={() => setExpanded(true)} aria-expanded={false}>
            Set up autopilot for this job
          </Button>
        </div>
      ) : (
        <>
        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-line pt-5 lg:grid-cols-2">
          <ThresholdField
            label="Shortlist threshold"
            hint="Candidates scoring at or above this are shortlisted. Below it, they go to Needs review."
            value={draft.shortlist_threshold}
            onChange={(n) => set("shortlist_threshold", n)}
            error={visibleErrors.shortlist_threshold}
            disabled={busy}
          />
          <ThresholdField
            label="Screening pass score"
            hint="Screening scores at or above this move on to scheduling. Below it, Needs review."
            value={draft.screen_pass_threshold}
            onChange={(n) => set("screen_pass_threshold", n)}
            error={visibleErrors.screen_pass_threshold}
            disabled={busy}
          />
          <ToggleRow
            label="Auto screen"
            description="Email shortlisted candidates a link to a short AI screening interview."
            checked={draft.auto_screen}
            onChange={(b) => set("auto_screen", b)}
            disabled={busy}
          />
          <ToggleRow
            label="Auto schedule"
            description="Email candidates who pass screening a link to pick an interview slot."
            checked={draft.auto_schedule}
            onChange={(b) => set("auto_schedule", b)}
            disabled={busy}
          />
          <NumberField
            label="Interview duration"
            value={draft.interview_duration_min}
            onChange={(n) => set("interview_duration_min", n)}
            min={15}
            max={240}
            step={5}
            suffix="minutes"
            error={visibleErrors.interview_duration_min}
            disabled={busy}
          />
          <NumberField
            label="Daily outreach cap"
            hint="Most candidate emails autopilot sends per day for this job."
            value={draft.daily_outreach_cap}
            onChange={(n) => set("daily_outreach_cap", n)}
            min={0}
            max={1000}
            suffix="emails / day"
            error={visibleErrors.daily_outreach_cap}
            disabled={busy}
          />
          <div className="lg:col-span-2">
            <SlotsEditor
              slots={draft.interview_slots}
              onChange={(slots) => set("interview_slots", slots)}
              error={visibleErrors.interview_slots}
              disabled={busy}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col-reverse items-stretch gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted" aria-live="polite">
            {dirty
              ? "You have unsaved changes."
              : settings.updated_at
                ? `Last saved ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(settings.updated_at))}`
                : "Default settings — not saved yet."}
          </p>
          <div className="flex gap-2">
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft(toDraft(settings));
                  setShowErrors(false);
                }}
                disabled={busy}
              >
                Discard
              </Button>
            )}
            <Button icon={<Save size={16} />} onClick={save} loading={saving} loadingText="Saving…" disabled={toggling || (!dirty && !hasPastSlots)}>
              Save settings
            </Button>
          </div>
        </div>
        </>
      )}
    </>
  );
}

function JobActivity({ jobId }: { jobId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGetAgentActivityQuery({ jobId, limit: 10 });
  return (
    <div className="mt-6 border-t border-line pt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Activity size={15} className="text-navy-600" aria-hidden="true" />
          Agent activity for this job
        </h3>
        <Link to={`/agents?jobId=${encodeURIComponent(jobId)}`} className={buttonClasses("link", "sm", "text-sm")}>
          View all activity
        </Link>
      </div>
      {isLoading ? (
        <div className="space-y-2" role="status" aria-label="Loading activity">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-3/4" />
        </div>
      ) : isError ? (
        <ErrorState compact error={error} onRetry={refetch} retrying={isFetching} />
      ) : !data || data.length === 0 ? (
        <p className="rounded-lg bg-surface p-4 text-center text-sm text-muted">
          No agent activity yet. When autopilot is on, every step it takes shows up here.
        </p>
      ) : (
        <AgentActivityList events={data.slice(0, 10)} hideJob dense />
      )}
    </div>
  );
}

/** Per-job autopilot switch + settings, with this job's latest agent events. */
export default function AutopilotPanel({ jobId }: { jobId: string }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useGetAutopilotQuery(jobId);

  return (
    <section className="zh-card p-5 sm:p-6" aria-label="Autopilot">
      {isLoading ? (
        <div className="space-y-3" role="status" aria-label="Loading autopilot settings">
          <div className="flex items-center justify-between gap-4">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-8 w-14 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full" />
        </div>
      ) : isError || !data ? (
        isError ? (
          <ErrorState compact title="Couldn't load autopilot" error={error} onRetry={refetch} retrying={isFetching} />
        ) : (
          <EmptyState compact icon={<Bot size={22} />} title="Autopilot isn't available for this job" />
        )
      ) : (
        <AutopilotForm key={jobId} jobId={jobId} settings={data} />
      )}
      <JobActivity jobId={jobId} />
    </section>
  );
}
