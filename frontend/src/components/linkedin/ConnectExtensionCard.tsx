import { useState } from "react";
import { CheckCircle2, Chrome, Copy, Download, ExternalLink, KeyRound, Linkedin, Monitor, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { Badge, Button, ErrorState, Skeleton, useConfirm } from "../ui";
import {
  useCreateConnectionCodeMutation,
  useGetLinkedInAccountQuery,
  useRevokeConnectionMutation,
  useUpdateLinkedInAccountMutation,
} from "../../store/api/linkedinApi";
import { useNotify } from "../../hooks/useNotify";
import { getErrorMessage } from "../../lib/format";
import { DESKTOP_DOWNLOAD, clientVersionLabel, desktop, isDesktopApp } from "../../lib/desktop";

export const EXTENSION_ZIP = "/downloads/zorhire-assistant.zip";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`;
};

/**
 * Setup and status for the ZorHire Assistant Chrome extension. The recruiter stays signed
 * in to LinkedIn in their own Chrome; ZorHire only talks to the extension with a revocable
 * connection code, so no LinkedIn password ever reaches ZorHire.
 */
export default function ConnectExtensionCard() {
  const notify = useNotify();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch, isFetching } = useGetLinkedInAccountQuery(undefined, { pollingInterval: 30000 });
  const [createCode, { isLoading: creating }] = useCreateConnectionCodeMutation();
  const [revoke] = useRevokeConnectionMutation();
  const [updateAccount, { isLoading: saving }] = useUpdateLinkedInAccountMutation();
  const [code, setCode] = useState<string | null>(null);

  if (isLoading) return <div className="zh-card p-5"><Skeleton className="h-5 w-1/3" /><Skeleton className="mt-3 h-16 w-full" /></div>;
  if (isError || !data) return <div className="zh-card"><ErrorState error={error} onRetry={refetch} retrying={isFetching} compact /></div>;

  const li = data.linkedin;
  const ready = data.connected && !!li;

  const generate = async () => {
    try {
      const r = await createCode().unwrap();
      setCode(r.code);
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not create a connection code."));
    }
  };
  const copy = async () => {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    notify.success("Code copied. Paste it into the ZorHire Assistant extension.");
  };
  const setRecruiter = async (value: string) => {
    try {
      await updateAccount({ recruiter_lite_override: value === "auto" ? null : value === "yes" }).unwrap();
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not save."));
    }
  };
  const remove = async (id: string) => {
    const ok = await confirm({ title: "Disconnect this browser?", message: "The extension in that browser stops working until it's connected again with a new code.", confirmText: "Disconnect", danger: true });
    if (ok) await revoke(id);
  };

  return (
    <section className="zh-card p-5 sm:p-6" aria-labelledby="li-connect-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
            <Linkedin size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 id="li-connect-title" className="text-base font-semibold text-ink">Your LinkedIn connection</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">
              {isDesktopApp
                ? "The agent is built into this ZorHire app and works in its LinkedIn tabs, signed in to your own LinkedIn."
                : "The agent works through the ZorHire Assistant extension in your own Chrome, signed in to your own LinkedIn."}
              {" "}ZorHire never asks for or stores your LinkedIn password.
            </p>
          </div>
        </div>
        <Badge tone={ready && data.extension_online ? "success" : ready ? "warning" : "neutral"}>
          {ready
            ? data.extension_online ? (isDesktopApp ? "App online" : "Extension online") : (isDesktopApp ? "App offline" : "Extension offline")
            : isDesktopApp ? "Connecting" : "Not set up"}
        </Badge>
      </div>

      {li?.paused_reason && (
        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand-200 bg-warning-50 p-3 text-sm text-warning-700">
          <span className="flex items-center gap-2"><PauseCircle size={16} aria-hidden="true" />
            Paused: {li.paused_reason}. It resumes on its own {li.paused_until ? new Date(li.paused_until).toLocaleString() : "later"}.
          </span>
          <Button size="sm" variant="secondary" icon={<PlayCircle size={14} />} loading={saving}
            onClick={() => updateAccount({ resume: true })}>Resume now</Button>
        </div>
      )}

      {ready && li ? (
        <div className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Signed in as</p>
            <p className="mt-1 truncate font-medium text-ink">{li.name ?? "LinkedIn user"}</p>
            <p className="truncate text-sm text-muted">{li.headline}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone={li.has_premium ? "success" : "neutral"}>{li.has_premium ? "Premium" : "Free account"}</Badge>
              <Badge tone={li.recruiter_lite ? "success" : "neutral"}>{li.recruiter_lite ? "Recruiter Lite" : "No Recruiter Lite"}</Badge>
            </div>
            <p className="mt-2 text-xs text-muted">Last seen {ago(li.last_seen_at)}{li.ext_version ? ` · ${clientVersionLabel(li.ext_version)}` : ""}</p>
          </div>
          <div>
            <label htmlFor="li-recruiter" className="text-xs font-medium uppercase tracking-wide text-muted">Recruiter Lite</label>
            <select id="li-recruiter" className="zh-input mt-1" disabled={saving}
              value={li.recruiter_lite_override === null ? "auto" : li.recruiter_lite_override ? "yes" : "no"}
              onChange={(e) => setRecruiter(e.target.value)}>
              <option value="auto">Detect automatically ({li.recruiter_lite_detected ? "found" : "not found"})</option>
              <option value="yes">I have an active Recruiter Lite subscription</option>
              <option value="no">I don't have Recruiter Lite</option>
            </select>
            <p className="mt-1 text-xs text-muted">With Recruiter Lite, campaigns can use its richer filters and InMail drafts.</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Invitations</p>
            <p className="mt-1 text-sm text-ink">{data.limits.sent_today} today (max {data.limits.daily_cap}) · {data.limits.sent_this_week} of {data.limits.weekly_cap} this week</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-label="Invitations this week"
              aria-valuemin={0} aria-valuemax={data.limits.weekly_cap} aria-valuenow={data.limits.sent_this_week}>
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, (100 * data.limits.sent_this_week) / data.limits.weekly_cap)}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted">Kept under LinkedIn's own weekly limit so your account stays in good standing.</p>
          </div>
        </div>
      ) : isDesktopApp ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="max-w-2xl text-sm text-muted">
            This app connects to your ZorHire account on its own. Sign in to LinkedIn in the app's &quot;LinkedIn agent&quot; tab;
            within a minute this card shows your account and Recruiter Lite. You can also click <b>Assistant</b> in the top bar, then <b>Run now</b>.
          </p>
          <Button size="sm" variant="secondary" icon={<ExternalLink size={14} />} onClick={() => desktop?.openTool("https://www.linkedin.com/login")}>
            Open LinkedIn
          </Button>
        </div>
      ) : (
        <>
        <p className="mt-5 flex flex-wrap items-center gap-2 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-700">
          <Monitor size={16} aria-hidden="true" />
          On Windows? The ZorHire app has the agent built in, with no extension to install.
          <a href={DESKTOP_DOWNLOAD} className="inline-flex items-center gap-1 font-medium underline">
            <Download size={14} aria-hidden="true" /> Download ZorHire for Windows
          </a>
        </p>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          <li className="rounded-lg border border-line p-4">
            <p className="flex items-center gap-2 font-medium text-ink"><Chrome size={16} aria-hidden="true" /> 1. Install the extension</p>
            <p className="mt-1 text-sm text-muted">Download and unzip it. In Chrome, open <code className="rounded bg-surface-sunken px-1">chrome://extensions</code>, turn on Developer mode, click <b>Load unpacked</b> and pick the unzipped folder.</p>
            <a href={EXTENSION_ZIP} download className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-navy-600 hover:underline">
              <Download size={14} aria-hidden="true" /> Download ZorHire Assistant
            </a>
          </li>
          <li className="rounded-lg border border-line p-4">
            <p className="flex items-center gap-2 font-medium text-ink"><KeyRound size={16} aria-hidden="true" /> 2. Connect it to ZorHire</p>
            <p className="mt-1 text-sm text-muted">Create a code, then paste it in the extension (click the ZorHire icon in Chrome's toolbar).</p>
            {code ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate rounded bg-surface-sunken px-2 py-1.5 text-xs" aria-label="Connection code">{code}</code>
                  <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={copy}>Copy</Button>
                </div>
                <p className="mt-1 text-xs text-muted">Shown once. Treat it like a password.</p>
              </div>
            ) : (
              <Button className="mt-3" size="sm" icon={<KeyRound size={14} />} loading={creating} onClick={generate}>Create connection code</Button>
            )}
          </li>
          <li className="rounded-lg border border-line p-4">
            <p className="flex items-center gap-2 font-medium text-ink"><CheckCircle2 size={16} aria-hidden="true" /> 3. Stay signed in to LinkedIn</p>
            <p className="mt-1 text-sm text-muted">Log in to <a className="text-navy-600 hover:underline" href="https://www.linkedin.com/login" target="_blank" rel="noreferrer">linkedin.com</a> in the same Chrome. The extension detects your account and Recruiter Lite, and this card turns green.</p>
          </li>
        </ol>
        </>
      )}

      {data.tokens.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">Connected browsers and apps ({data.tokens.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
            {data.tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span>{t.label ?? "Browser"} · connected {new Date(t.created_at).toLocaleDateString()} · {t.last_used_at ? `active ${ago(t.last_used_at)}` : "not used yet"}</span>
                <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => remove(t.id)} aria-label="Disconnect this browser">Disconnect</Button>
              </li>
            ))}
          </ul>
          {!code && <Button className="mt-2" size="sm" variant="link" onClick={generate}>Connect another browser</Button>}
          {code && data.tokens.length > 0 && ready && (
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface-sunken px-2 py-1.5 text-xs">{code}</code>
              <Button size="sm" variant="secondary" icon={<Copy size={14} />} onClick={copy}>Copy</Button>
            </div>
          )}
        </details>
      )}
    </section>
  );
}
