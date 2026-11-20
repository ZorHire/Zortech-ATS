import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, CalendarCheck, CalendarPlus, Clock, LinkIcon, RefreshCw, WifiOff } from "lucide-react";
import { Button, Spinner } from "../components/ui";
import { SchedulingError, confirmSchedulingSlot, getSchedulingInvite } from "../lib/schedulingApi";
import type { SchedulingErrorKind } from "../lib/schedulingApi";
import type { SchedulingInvite } from "../types/agents";

/**
 * Public candidate page: pick one of the offered interview times.
 * No app shell and no auth — the token in the URL is the only credential.
 */

const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long" });
const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const FULL_FMT = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZoneName: "short",
});

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(slots: string[]) {
  const groups = new Map<string, { label: string; slots: { iso: string; date: Date }[] }>();
  [...slots]
    .map((iso) => ({ iso, date: new Date(iso) }))
    .filter((s) => !Number.isNaN(s.date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((s) => {
      const key = dayKey(s.date);
      if (!groups.has(key)) groups.set(key, { label: DAY_FMT.format(s.date), slots: [] });
      groups.get(key)!.slots.push(s);
    });
  return [...groups.values()];
}

// ---- .ics (RFC 5545) ----
function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function icsText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
function downloadIcs(invite: SchedulingInvite, slotIso: string) {
  const start = new Date(slotIso);
  const end = new Date(start.getTime() + (invite.duration_min || 30) * 60000);
  const uid = `${start.getTime()}-${Math.random().toString(36).slice(2)}@zorhire`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ZorTech//ZorHire//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(`Interview: ${invite.job_title} — ${invite.company_name}`)}`,
    `DESCRIPTION:${icsText(
      `Your ${invite.duration_min}-minute interview for ${invite.job_title} with ${invite.company_name}. The recruiter will send joining details.`,
    )}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "interview.ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface px-4 py-6 sm:py-10">
      <main className="mx-auto w-full max-w-lg">
        <div className="mb-5 flex items-center gap-3">
          <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
          <span className="border-l border-line pl-3 text-sm font-semibold text-navy-700">Interview scheduling</span>
        </div>
        {children}
      </main>
    </div>
  );
}

function Message({
  icon,
  tone = "neutral",
  title,
  children,
  action,
}: {
  icon: ReactNode;
  tone?: "neutral" | "danger" | "success";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const toneCls =
    tone === "danger" ? "bg-danger-50 text-danger-600" : tone === "success" ? "bg-success-50 text-success-700" : "bg-surface-sunken text-muted";
  return (
    <div className="zh-card space-y-3 p-6 text-center sm:p-8" role={tone === "danger" ? "alert" : "status"}>
      <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${toneCls}`}>{icon}</div>
      <h1 className="text-lg font-semibold text-ink">{title}</h1>
      {children && <div className="text-sm text-muted">{children}</div>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}

function ErrorScreen({ kind, message, onRetry }: { kind: SchedulingErrorKind; message: string; onRetry: () => void }) {
  if (kind === "invalid") {
    return (
      <Message icon={<LinkIcon size={22} aria-hidden="true" />} tone="danger" title="This link isn't valid">
        Please check you opened the full link from your email, or reply to the recruiter for a new one.
      </Message>
    );
  }
  if (kind === "expired") {
    return (
      <Message icon={<Clock size={22} aria-hidden="true" />} title="This link has expired">
        Reply to the recruiter's email and they'll send you new times.
      </Message>
    );
  }
  return (
    <Message
      icon={kind === "network" ? <WifiOff size={22} aria-hidden="true" /> : <AlertTriangle size={22} aria-hidden="true" />}
      tone="danger"
      title={kind === "network" ? "You seem to be offline" : "Something went wrong"}
      action={
        <Button variant="secondary" icon={<RefreshCw size={16} />} onClick={onRetry}>
          Try again
        </Button>
      }
    >
      {message}
    </Message>
  );
}

function Confirmed({ invite, slot, fresh }: { invite: SchedulingInvite; slot: string; fresh: boolean }) {
  const d = new Date(slot);
  return (
    <Message
      icon={<CalendarCheck size={22} aria-hidden="true" />}
      tone="success"
      title={fresh ? "You're booked in" : "Your interview is already booked"}
      action={
        <Button variant="secondary" icon={<CalendarPlus size={16} />} onClick={() => downloadIcs(invite, slot)}>
          Add to calendar
        </Button>
      }
    >
      <p className="font-medium text-ink">
        <time dateTime={slot}>{Number.isNaN(d.getTime()) ? slot : FULL_FMT.format(d)}</time>
      </p>
      <p className="mt-1">
        {invite.duration_min}-minute interview for {invite.job_title} with {invite.company_name}.
        {fresh ? " We've let the recruiter know — they'll send the joining details." : ""}
      </p>
    </Message>
  );
}

export default function ScheduleInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<SchedulingInvite | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<SchedulingError | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedSlot, setConfirmedSlot] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      setLoadError(new SchedulingError("invalid", "Missing link."));
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getSchedulingInvite(token);
      setInvite(data);
    } catch (err) {
      setLoadError(err instanceof SchedulingError ? err : new SchedulingError("server", "Something went wrong."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.title = "Pick your interview time · ZorHire";
  }, []);

  const tz = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const days = useMemo(
    () => groupByDay((invite?.slots ?? []).filter((s) => new Date(s).getTime() > Date.now())),
    [invite],
  );

  const submit = async () => {
    if (!token || !selected || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await confirmSchedulingSlot(token, selected);
      setConfirmedSlot(res.slot || selected);
    } catch (err) {
      const e = err instanceof SchedulingError ? err : new SchedulingError("server", "Something went wrong.");
      if (e.kind === "slot_taken") {
        setSubmitError(e.message);
        setSelected(null);
        // Refresh the list so the taken time disappears.
        try {
          setInvite(await getSchedulingInvite(token));
        } catch {
          /* keep the old list */
        }
      } else if (e.kind === "expired") {
        // 410: booked meanwhile (e.g. another tab) or expired — reload to show the right screen.
        await load();
      } else if (e.kind === "invalid") {
        setLoadError(e);
      } else {
        setSubmitError(e.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Spinner size={32} tone="brand" label="Loading available times" />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <ErrorScreen kind={loadError.kind} message={loadError.message} onRetry={load} />
      </Shell>
    );
  }

  if (!invite) return null;

  if (confirmedSlot) {
    return (
      <Shell>
        <Confirmed invite={invite} slot={confirmedSlot} fresh />
      </Shell>
    );
  }

  if (invite.status === "booked") {
    return (
      <Shell>
        {invite.chosen_slot ? (
          <Confirmed invite={invite} slot={invite.chosen_slot} fresh={false} />
        ) : (
          <Message icon={<CalendarCheck size={22} aria-hidden="true" />} tone="success" title="Your interview is already booked">
            Check your email for the details.
          </Message>
        )}
      </Shell>
    );
  }

  if (invite.status === "expired") {
    return (
      <Shell>
        <ErrorScreen kind="expired" message="" onRetry={load} />
      </Shell>
    );
  }

  const firstName = invite.candidate_first_name?.trim();

  return (
    <Shell>
      <div className="zh-card overflow-hidden">
        <div className="border-b border-line p-5 sm:p-6">
          <h1 className="text-lg font-semibold leading-snug text-ink sm:text-xl">
            Hi{firstName ? ` ${firstName}` : ""}, pick a time for your {invite.job_title} interview with{" "}
            {invite.company_name}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} aria-hidden="true" />
              {invite.duration_min} minutes
            </span>
            <span>Times shown in your time zone ({tz})</span>
          </p>
        </div>

        {days.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm font-medium text-ink">No times are available right now.</p>
            <p className="mt-1 text-sm text-muted">Reply to the recruiter's email and they'll send you new options.</p>
          </div>
        ) : (
          <fieldset className="space-y-5 p-5 sm:p-6" disabled={submitting}>
            <legend className="sr-only">Available interview times</legend>
            {days.map((day) => (
              <div key={day.label} role="group" aria-label={day.label}>
                <h2 className="mb-2 text-sm font-semibold text-ink">{day.label}</h2>
                <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3">
                  {day.slots.map((s) => {
                    const checked = selected === s.iso;
                    const end = new Date(s.date.getTime() + invite.duration_min * 60000);
                    return (
                      <label
                        key={s.iso}
                        className={`relative flex cursor-pointer flex-col items-center rounded-lg border px-2 py-2.5 text-center text-sm transition-colors focus-within:ring-2 focus-within:ring-navy-300 ${
                          checked
                            ? "border-navy-600 bg-navy-600 text-white"
                            : "border-line bg-white text-ink hover:border-navy-300 hover:bg-navy-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="slot"
                          value={s.iso}
                          checked={checked}
                          onChange={() => {
                            setSelected(s.iso);
                            setSubmitError(null);
                          }}
                          className="sr-only"
                          aria-label={`${day.label}, ${TIME_FMT.format(s.date)} to ${TIME_FMT.format(end)}`}
                        />
                        <span className="font-semibold">{TIME_FMT.format(s.date)}</span>
                        <span className={`text-xs ${checked ? "text-navy-100" : "text-muted"}`}>
                          to {TIME_FMT.format(end)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>
        )}

        {days.length > 0 && (
          <div className="sticky bottom-0 space-y-2 border-t border-line bg-white p-4 sm:p-5">
            {submitError && (
              <p role="alert" className="text-sm text-danger-600">
                {submitError}
              </p>
            )}
            <p className="text-sm text-muted" aria-live="polite">
              {selected ? (
                <>
                  Selected: <span className="font-medium text-ink">{FULL_FMT.format(new Date(selected))}</span>
                </>
              ) : (
                "Choose a time above."
              )}
            </p>
            <Button fullWidth size="lg" onClick={submit} disabled={!selected} loading={submitting} loadingText="Confirming…">
              Confirm this time
            </Button>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted">Can't make any of these? Reply to the recruiter's email.</p>
    </Shell>
  );
}
