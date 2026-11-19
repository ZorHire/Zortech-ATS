import { useEffect, useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail, KeyRound, CheckCircle2, Trash2, ExternalLink,
  Eye, EyeOff, ShieldCheck, ArrowLeft,
  AlertTriangle, Wifi,
} from "lucide-react";
import {
  useGetEmailConfigQuery, useSaveEmailConfigMutation,
  useDeleteEmailConfigMutation, useTestEmailConfigMutation,
} from "../store/api/emailApi";
import { Badge, Button, ErrorState, PageHeader, Skeleton, useConfirm } from "../components/ui";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import CompanyMailboxCard from "../components/email/CompanyMailboxCard";

type Provider = "zoho" | "zoho_in" | "zoho_eu" | "google_workspace";

const PROVIDERS: { value: Provider; label: string; sub: string }[] = [
  { value: "zoho", label: "Zoho Mail", sub: "smtp.zoho.com · Global" },
  { value: "zoho_in", label: "Zoho Mail India", sub: "smtp.zoho.in · India" },
  { value: "zoho_eu", label: "Zoho Mail Europe", sub: "smtp.zoho.eu · EU" },
  { value: "google_workspace", label: "Google Workspace", sub: "smtp.gmail.com" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StepNum({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-navy-600 text-xs font-semibold text-white" aria-hidden="true">
      {n}
    </span>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 break-all font-medium text-navy-600 hover:underline">
      {children} <ExternalLink size={11} aria-hidden="true" />
    </a>
  );
}

export default function EmailSettingsPage() {
  // Company admins also manage the company-wide mailbox used for system emails.
  const role = useAppSelector(selectCurrentUser)?.role;
  const isCompanyAdmin = role === "super_admin" || role === "accounts_manager";
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo");
  const notify = useNotify();
  const confirm = useConfirm();
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;

  const { data: config, isLoading: loading, isError, error: loadError, refetch, isFetching } = useGetEmailConfigQuery();
  const [saveEmailConfig, { isLoading: saving }] = useSaveEmailConfigMutation();
  const [deleteEmailConfig, { isLoading: removing }] = useDeleteEmailConfigMutation();
  const [testEmailConfig, { isLoading: testing }] = useTestEmailConfigMutation();

  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [provider, setProvider] = useState<Provider>("zoho");
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; appPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!config) return;
    if (config.email) setEmail(config.email);
    if (config.provider === "zoho_in") setProvider("zoho_in");
    else if (config.provider === "zoho_eu") setProvider("zoho_eu");
    else if (config.provider === "google_workspace") setProvider("google_workspace");
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { email?: string; appPassword?: string } = {};
    if (!email.trim()) errs.email = "Enter the email address to send from.";
    else if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!appPassword.trim()) errs.appPassword = "Paste the app password.";
    setFieldErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) return;
    try {
      await saveEmailConfig({ email: email.trim(), appPassword, provider }).unwrap();
      setAppPassword("");
      notify.success("Email connected successfully.");
      if (returnTo) {
        setRedirecting(true);
        setTimeout(() => navigate(returnTo), 1200);
      }
    } catch (err) {
      setFormError(getErrorMessage(err, "Failed to save. Please try again."));
    }
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: "Disconnect email?",
      message: "You won't be able to send emails until you reconnect.",
      confirmText: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEmailConfig().unwrap();
      setEmail("");
      setAppPassword("");
      setTestResult(null);
      notify.success("Email configuration removed.");
    } catch {
      notify.error("Failed to remove configuration.");
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    try {
      const result = await testEmailConfig().unwrap();
      setTestResult({ ok: true, message: result.message || "Connection successful." });
    } catch (err) {
      setTestResult({ ok: false, message: getErrorMessage(err, "Connection test failed. Check your credentials.") });
    }
  };

  const isConnected = config?.configured;
  const isCorrupted = config?.configured && config?.is_corrupted;

  const statusBadge = loading || isError ? null : isCorrupted ? (
    <Badge tone="danger">Reconnect required</Badge>
  ) : isConnected ? (
    <Badge tone="success" className="max-w-[16rem] truncate">Connected · {config?.email}</Badge>
  ) : (
    <Badge tone="warning">Not connected</Badge>
  );

  return (
    <>
      <PageHeader
        title="Email settings"
        subtitle={isCompanyAdmin ? "Your own mailbox for emails you send, and the company mailbox for system and AI-agent emails" : "Connect your mailbox to send emails directly from ZorHire"}
        actions={
          <>
            {statusBadge}
            {returnTo && (
              <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate(returnTo)}>
                Back
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="mx-auto max-w-2xl space-y-4" role="status" aria-label="Loading email settings">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-36 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <div className="zh-card mx-auto max-w-2xl">
            <ErrorState error={loadError} onRetry={refetch} retrying={isFetching} />
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-6">
            {returnTo && !isConnected && (
              <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-warning-50 px-4 py-3.5 text-sm text-warning-700">
                <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  To send emails you need to connect your company email first.
                  Complete the form below, then you'll be returned automatically.
                </span>
              </div>
            )}

            {/* Status card */}
            <section className={`zh-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5 ${isCorrupted ? "border-danger-600/30" : ""}`}>
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg ${
                  isCorrupted ? "bg-danger-50 text-danger-600" : isConnected ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-600"
                }`}>
                  {isCorrupted
                    ? <AlertTriangle size={20} aria-hidden="true" />
                    : isConnected
                      ? <CheckCircle2 size={20} aria-hidden="true" />
                      : <Mail size={20} aria-hidden="true" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${isCorrupted ? "text-danger-700" : "text-ink"}`}>
                    {isCorrupted ? "Credentials corrupt — reconnect required" : isConnected ? "SMTP connected" : "No email connected"}
                  </p>
                  <p className="mt-0.5 break-words text-xs text-muted">
                    {isCorrupted
                      ? `Stored password for ${config?.email} can no longer be decrypted. Re-enter your app password below.`
                      : isConnected
                        ? `Sending from ${config?.email}${config?.updated_at ? ` · updated ${new Date(config.updated_at).toLocaleDateString()}` : ""}`
                        : "You must connect an email before sending campaigns or candidate emails."}
                  </p>
                </div>
              </div>
              {isConnected && !isCorrupted && (
                <Button variant="secondary" size="sm" onClick={handleTest} loading={testing} loadingText="Testing…" icon={<Wifi size={14} />} className="self-start sm:self-auto">
                  Test connection
                </Button>
              )}
            </section>

            {testResult && (
              <div role={testResult.ok ? "status" : "alert"} className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
                testResult.ok
                  ? "border-success-600/20 bg-success-50 text-success-700"
                  : "border-danger-600/20 bg-danger-50 text-danger-700"
              }`}>
                {testResult.ok
                  ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  : <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />}
                <span className="break-words">{testResult.message}</span>
              </div>
            )}

            {/* Provider selector */}
            <fieldset className="zh-card p-4 sm:p-5">
              <legend className="sr-only">Email provider</legend>
              <p className="mb-3 text-sm font-semibold text-ink" aria-hidden="true">Email provider</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {PROVIDERS.map((opt) => {
                  const active = provider === opt.value;
                  return (
                    <label key={opt.value}
                      className={`flex cursor-pointer flex-col items-start rounded-lg border px-4 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-navy-600/30 ${
                        active ? "border-navy-600 bg-navy-50 text-navy-800" : "border-line bg-white text-ink-soft hover:border-line-strong"
                      }`}>
                      <input type="radio" name={fid("provider")} value={opt.value} checked={active}
                        onChange={() => setProvider(opt.value)} className="sr-only" />
                      <span className="font-semibold">{opt.label}</span>
                      <span className="mt-0.5 text-xs text-muted">{opt.sub}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Step-by-step instructions */}
            <section className="space-y-4 rounded-xl border border-navy-100 bg-navy-50 p-4 sm:p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-navy-700">
                <ShieldCheck size={17} aria-hidden="true" />
                {provider === "google_workspace"
                  ? "How to generate a Google App Password"
                  : "How to generate a Zoho Mail App Password"}
              </h2>

              {provider !== "google_workspace" ? (
                <ol className="space-y-3 text-sm text-ink-soft">
                  <li className="flex gap-3"><StepNum n={1} /><span>Log in to Zoho Mail{" — "}<ExtLink href="https://mail.zoho.com">mail.zoho.com</ExtLink></span></li>
                  <li className="flex gap-3"><StepNum n={2} /><span>Go to <strong>Settings → Security → App Passwords</strong>{" — "}<ExtLink href="https://accounts.zoho.com/home#security/app-password">accounts.zoho.com</ExtLink></span></li>
                  <li className="flex gap-3"><StepNum n={3} /><span>Click <strong>Generate New Password</strong>, enter <code className="rounded bg-navy-100 px-1 text-xs">ZorHire</code> as the app name, and click <strong>Generate</strong>.</span></li>
                  <li className="flex gap-3"><StepNum n={4} /><span>Copy the generated app password and paste it in the field below.</span></li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-ink-soft">
                  <li className="flex gap-3"><StepNum n={1} /><span>Log in to your Google Account and go to <strong>Security → 2-Step Verification</strong> — make sure it is turned <strong>On</strong>.</span></li>
                  <li className="flex gap-3"><StepNum n={2} /><span>Go to <strong>Security → App Passwords</strong>{" — "}<ExtLink href="https://myaccount.google.com/apppasswords">myaccount.google.com/apppasswords</ExtLink></span></li>
                  <li className="flex gap-3"><StepNum n={3} /><span>Select app <strong>Mail</strong> and device <strong>Other</strong>, type <code className="rounded bg-navy-100 px-1 text-xs">ZorHire</code>, click <strong>Generate</strong>.</span></li>
                  <li className="flex gap-3"><StepNum n={4} /><span>Copy the 16-character password shown and paste it in the field below.</span></li>
                </ol>
              )}

              <p className="border-t border-navy-100 pt-3 text-xs text-muted">
                <strong>Important:</strong> Use your <strong>App Password</strong> — NOT your regular login password.
                {provider !== "google_workspace" && " Also ensure SMTP access is enabled under Zoho Mail Settings → Security."}{" "}
                Only company domain emails are supported.
                {provider === "zoho_in" && (
                  <span className="mt-1.5 block font-medium text-navy-700">
                    Use this option if your Zoho account was created at <strong>zoho.in</strong> or your company is based in India.
                  </span>
                )}
              </p>
            </section>

            {/* Connect / Update form */}
            <section className="zh-card p-4 sm:p-5" aria-labelledby={fid("form-h")}>
              <h2 id={fid("form-h")} className="mb-4 text-sm font-semibold text-ink">
                {isConnected ? "Update configuration" : "Connect email"}
              </h2>
              <form onSubmit={handleSave} noValidate className="space-y-4">
                {formError && (
                  <div role="alert" className="rounded-lg border border-danger-600/20 bg-danger-50 px-4 py-3 text-sm font-medium text-danger-700">
                    {formError}
                  </div>
                )}
                {redirecting && (
                  <p role="status" className="text-sm text-success-700">Connected. Redirecting you back…</p>
                )}

                <div>
                  <label htmlFor={fid("email")} className="zh-label">
                    {provider === "google_workspace" ? "Google Workspace email address" : "Zoho email address"}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input id={fid("email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourcompany.com" autoComplete="email"
                      aria-invalid={!!fieldErrors.email || undefined}
                      aria-describedby={fieldErrors.email ? fid("email-err") : undefined}
                      className="zh-input pl-9" />
                  </div>
                  {fieldErrors.email && <p id={fid("email-err")} className="mt-1 text-xs text-danger-600">{fieldErrors.email}</p>}
                </div>

                <div>
                  <label htmlFor={fid("pwd")} className="zh-label">App password</label>
                  <div className="relative">
                    <KeyRound size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
                    <input id={fid("pwd")} type={showPassword ? "text" : "password"} value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      autoComplete="new-password" spellCheck={false}
                      placeholder={isConnected ? "Enter new password to update" : "xxxx xxxx xxxx xxxx"}
                      aria-invalid={!!fieldErrors.appPassword || undefined}
                      aria-describedby={`${fid("pwd-hint")}${fieldErrors.appPassword ? ` ${fid("pwd-err")}` : ""}`}
                      className="zh-input pl-9 pr-11 font-mono tracking-wider" />
                    <button type="button" onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide app password" : "Show app password"}
                      aria-pressed={showPassword}
                      className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted hover:text-ink">
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.appPassword && <p id={fid("pwd-err")} className="mt-1 text-xs text-danger-600">{fieldErrors.appPassword}</p>}
                  <p id={fid("pwd-hint")} className="mt-1.5 text-xs text-muted">Paste the app password exactly as shown — spaces are stripped automatically.</p>
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center">
                  {isConnected && (
                    <Button variant="ghost" onClick={handleRemove} loading={removing} icon={<Trash2 size={16} />}
                      className="text-danger-600 hover:bg-danger-50 hover:text-danger-700">
                      Disconnect
                    </Button>
                  )}
                  <Button type="submit" loading={saving} loadingText="Saving…" icon={<CheckCircle2 size={16} />} className="sm:ml-auto">
                    {isConnected ? "Update email" : "Connect email"}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        )}
        {isCompanyAdmin && <CompanyMailboxCard />}
      </div>
    </>
  );
}
