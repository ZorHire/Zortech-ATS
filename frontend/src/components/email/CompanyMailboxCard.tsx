import { useEffect, useId, useState } from "react";
import { Building2, CheckCircle2, Eye, EyeOff, Send, Trash2 } from "lucide-react";
import {
  useDeleteCompanyEmailConfigMutation,
  useGetCompanyEmailConfigQuery,
  useSaveCompanyEmailConfigMutation,
  useTestCompanyEmailConfigMutation,
} from "../../store/api/emailApi";
import { Badge, Button, ErrorState, Skeleton, useConfirm } from "../ui";
import { useNotify } from "../../hooks/useNotify";
import { getErrorMessage } from "../../lib/format";

const PROVIDERS = [
  { value: "zoho_in", label: "Zoho Mail India (smtp.zoho.in)" },
  { value: "zoho", label: "Zoho Mail Global (smtp.zoho.com)" },
  { value: "zoho_eu", label: "Zoho Mail Europe (smtp.zoho.eu)" },
  { value: "google_workspace", label: "Google Workspace (smtp.gmail.com)" },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Company-wide sender for this company's system and AI-agent emails (screening
 * invites, interview scheduling links, password resets, demo requests).
 * One per company: every company using ZorHire connects its own mailbox.
 */
export default function CompanyMailboxCard() {
  const notify = useNotify();
  const confirm = useConfirm();
  const ids = { email: useId(), name: useId(), provider: useId(), pw: useId() };
  const { data, isLoading, isError, error, refetch, isFetching } = useGetCompanyEmailConfigQuery();
  const [save, { isLoading: saving }] = useSaveCompanyEmailConfigMutation();
  const [remove, { isLoading: removing }] = useDeleteCompanyEmailConfigMutation();
  const [test, { isLoading: testing }] = useTestCompanyEmailConfigMutation();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [provider, setProvider] = useState("zoho_in");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [editing, setEditing] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (data?.configured) {
      setEmail(data.email ?? "");
      setDisplayName(data.display_name ?? "");
      setProvider(data.provider ?? "zoho_in");
    }
  }, [data]);

  const connected = !!data?.configured && !data.is_corrupted;
  const showForm = !connected || editing;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address.";
    if (!password.trim()) next.password = "Enter the app password for this mailbox.";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await save({ email: email.trim(), appPassword: password, provider, displayName: displayName.trim() || undefined }).unwrap();
      setPassword("");
      setEditing(false);
      notify.success("Company mailbox connected. System emails will be sent from it.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not connect the mailbox. Check the address and app password."));
    }
  };

  const disconnect = async () => {
    const ok = await confirm({
      title: "Disconnect the company mailbox?",
      message: "Screening invites, scheduling links and other system emails will stop until a mailbox is connected again (AI agents fall back to the job's recruiter mailbox where one is set).",
      confirmText: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    try {
      await remove().unwrap();
      setEmail(""); setDisplayName(""); setPassword("");
      notify.success("Company mailbox disconnected.");
    } catch (err) {
      notify.error(getErrorMessage(err, "Could not disconnect the mailbox."));
    }
  };

  const sendTest = async () => {
    try {
      const r = await test().unwrap();
      notify.success(r.message);
    } catch (err) {
      notify.error(getErrorMessage(err, "Test email failed."));
    }
  };

  return (
    <section className="zh-card p-5 sm:p-6" aria-labelledby="company-mailbox-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600">
            <Building2 size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="company-mailbox-title" className="text-base font-semibold text-ink">Company mailbox</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">
              The address your company's system emails come from: AI screening invites, interview scheduling links,
              password resets and demo requests. Each company connects its own mailbox; only admins can change it.
            </p>
          </div>
        </div>
        {!isLoading && !isError && (
          <Badge tone={connected ? "success" : data?.is_corrupted ? "danger" : "warning"}>
            {connected ? "Connected" : data?.is_corrupted ? "Needs reconnecting" : "Not connected"}
          </Badge>
        )}
      </div>

      <div className="mt-5 border-t border-line pt-5">
        {isLoading ? (
          <div className="space-y-3" role="status" aria-label="Loading company mailbox">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : isError ? (
          <ErrorState error={error} onRetry={refetch} retrying={isFetching} compact />
        ) : !showForm ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 text-sm">
              <p className="font-medium text-ink">{data?.display_name ? `${data.display_name} <${data.email}>` : data?.email}</p>
              <p className="text-muted">{PROVIDERS.find((p) => p.value === data?.provider)?.label ?? data?.provider}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={<Send size={16} />} onClick={sendTest} loading={testing}>Send test email</Button>
              <Button variant="secondary" onClick={() => setEditing(true)}>Change</Button>
              <Button variant="ghost" icon={<Trash2 size={16} />} onClick={disconnect} loading={removing}
                className="text-danger-600 hover:bg-danger-50 hover:text-danger-700">
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label htmlFor={ids.email} className="zh-label">Mailbox address</label>
              <input id={ids.email} type="email" autoComplete="off" className="zh-input" placeholder="hiring@yourcompany.com"
                value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email}
                aria-describedby={errors.email ? `${ids.email}-err` : undefined} />
              {errors.email && <p id={`${ids.email}-err`} className="mt-1 text-xs text-danger-600">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor={ids.name} className="zh-label">Sender name <span className="font-normal text-muted">(optional)</span></label>
              <input id={ids.name} type="text" className="zh-input" placeholder="e.g. ZorTech Hiring" maxLength={80}
                value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label htmlFor={ids.provider} className="zh-label">Mail provider</label>
              <select id={ids.provider} className="zh-input" value={provider} onChange={(e) => setProvider(e.target.value)}>
                {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={ids.pw} className="zh-label">App password</label>
              <div className="relative">
                <input id={ids.pw} type={showPw ? "text" : "password"} autoComplete="new-password" className="zh-input pr-10"
                  placeholder="App-specific password, not the login password"
                  value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? `${ids.pw}-err` : `${ids.pw}-hint`} />
                <button type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password
                ? <p id={`${ids.pw}-err`} className="mt-1 text-xs text-danger-600">{errors.password}</p>
                : <p id={`${ids.pw}-hint`} className="mt-1 text-xs text-muted">We check it with the mail server before saving, and store it encrypted.</p>}
            </div>
            <div className="flex flex-col-reverse gap-2 md:col-span-2 sm:flex-row sm:justify-end">
              {connected && <Button variant="ghost" onClick={() => { setEditing(false); setPassword(""); setErrors({}); }}>Cancel</Button>}
              <Button type="submit" loading={saving} loadingText="Checking and saving…" icon={<CheckCircle2 size={16} />}>
                {connected ? "Save mailbox" : "Connect company mailbox"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
