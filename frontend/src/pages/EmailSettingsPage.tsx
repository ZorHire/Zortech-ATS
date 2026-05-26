import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Mail,
  KeyRound,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ArrowLeft,
  AlertTriangle,
  Wifi,
  Settings,
} from "lucide-react";
import api from "../lib/api";

interface EmailConfig {
  configured: boolean;
  email?: string;
  provider?: string;
  updated_at?: string;
  is_corrupted?: boolean;
}

export default function EmailSettingsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo");

  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [email, setEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [provider, setProvider] = useState<"zoho" | "google_workspace">("zoho");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // ── Load current config ──────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const body = (await api.get("/email/config")) as EmailConfig;
        setConfig(body);
        if (body.email) setEmail(body.email);
        if (body.provider === "google_workspace")
          setProvider("google_workspace");
      } catch {
        setConfig({ configured: false });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const flash = (type: "success" | "error", msg: string) => {
    if (type === "success") {
      setSuccess(msg);
      setError(null);
      setTimeout(() => setSuccess(null), 4000);
    } else {
      setError(msg);
      setSuccess(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  // ── Save config ──────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !appPassword.trim()) {
      flash("error", "Both email and app password are required.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/email/config", { email: email.trim(), appPassword, provider });
      setConfig({
        configured: true,
        email: email.trim(),
        provider,
        updated_at: new Date().toISOString(),
      });
      setAppPassword("");
      flash("success", "Email connected successfully.");

      if (returnTo) {
        setTimeout(() => navigate(returnTo), 1200);
      }
    } catch (err: any) {
      flash(
        "error",
        err?.data?.message ?? err?.message ?? "Failed to save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  // ── Remove config ────────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (
      !window.confirm(
        "Remove your connected email? You won't be able to send emails until you reconnect.",
      )
    )
      return;
    setRemoving(true);
    try {
      await api.delete("/email/config");
      setConfig({ configured: false });
      setEmail("");
      setAppPassword("");
      flash("success", "Email configuration removed.");
    } catch {
      flash("error", "Failed to remove configuration.");
    } finally {
      setRemoving(false);
    }
  };

  // ── Test SMTP connection ─────────────────────────────────────────────────
  const handleTest = async () => {
    setTestResult(null);
    setTesting(true);
    try {
      const body = (await api.post("/email/config/test", {})) as {
        ok: boolean;
        message: string;
      };
      setTestResult({ ok: true, message: body.message });
    } catch (err: any) {
      const msg: string =
        err?.data?.message ??
        err?.message ??
        "Connection test failed. Check your credentials.";
      setTestResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  const isConnected = config?.configured;
  const isCorrupted = config?.configured && config?.is_corrupted;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 overflow-hidden">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center gap-3">
          {returnTo && (
            <button
              onClick={() => navigate(returnTo)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-50 rounded-xl flex items-center justify-center">
              <Settings size={15} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-black text-gray-900">Email Settings</h1>
              <p className="text-xs text-gray-400 mt-0.5">Connect your SMTP to send emails directly from ZorHire</p>
            </div>
          </div>
        </div>
        {!loading && (
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${
            isCorrupted ? "bg-red-50 text-red-700" : isConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isCorrupted ? "bg-red-500" : isConnected ? "bg-emerald-500" : "bg-amber-400"}`} />
            {isCorrupted ? "Reconnect Required" : isConnected ? `Connected · ${config?.email}` : "Not Connected"}
          </span>
        )}
      </div>

      {/* ── Scrollable content ── */}
      <div className="flex-1 overflow-y-auto p-6">

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5">

            {/* Redirect notice */}
            {returnTo && !isConnected && (
              <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                <AlertTriangle size={17} className="shrink-0 mt-0.5" />
                <span>
                  To send emails you need to connect your company email first.
                  Complete the form below, then you'll be returned automatically.
                </span>
              </div>
            )}

            {/* Status card */}
            <div className={`bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${
              isCorrupted ? "border-red-200" : isConnected ? "border-emerald-100" : "border-amber-100"
            }`}>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isCorrupted ? "bg-red-50" : isConnected ? "bg-emerald-50" : "bg-amber-50"
              }`}>
                {isCorrupted
                  ? <AlertTriangle size={20} className="text-red-500" />
                  : isConnected
                    ? <CheckCircle2 size={20} className="text-emerald-600" />
                    : <Mail size={20} className="text-amber-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-black ${isCorrupted ? "text-red-700" : "text-gray-900"}`}>
                  {isCorrupted ? "Credentials Corrupt — Reconnect Required" : isConnected ? "SMTP Connected" : "No Email Connected"}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">
                  {isCorrupted
                    ? `Stored password for ${config?.email} can no longer be decrypted. Re-enter your app password below.`
                    : isConnected
                      ? `Sending from ${config?.email}${config?.updated_at ? ` · updated ${new Date(config.updated_at).toLocaleDateString()}` : ""}`
                      : "You must connect an email before sending campaigns or candidate emails."}
                </p>
              </div>
              {isConnected && !isCorrupted && (
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors disabled:opacity-60 flex-shrink-0"
                >
                  {testing ? <Loader2 size={13} className="animate-spin" /> : <Wifi size={13} />}
                  {testing ? "Testing…" : "Test"}
                </button>
              )}
            </div>

            {/* Test result */}
            {testResult && (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm border ${
                testResult.ok
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : "bg-red-50 border-red-200 text-red-800"
              }`}>
                {testResult.ok
                  ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  : <AlertTriangle size={16} className="shrink-0 mt-0.5" />}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Feedback banners */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {error}
              </div>
            )}
            {success && (
              <div className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium flex items-center gap-2">
                <CheckCircle2 size={15} />
                {success}
                {returnTo && (
                  <span className="ml-1 text-emerald-600 font-normal">Redirecting you back…</span>
                )}
              </div>
            )}

            {/* ── Provider selector ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Email Provider</p>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: "zoho", label: "Zoho Mail", sub: "smtp.zoho.com" },
                    { value: "google_workspace", label: "Google Workspace", sub: "smtp.gmail.com" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setProvider(opt.value)}
                    className={`flex flex-col items-start px-4 py-3.5 rounded-xl border text-sm transition-colors ${
                      provider === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-white"
                    }`}
                  >
                    <span className="font-bold">{opt.label}</span>
                    <span className="text-xs mt-0.5 opacity-70">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Step-by-step instructions ── */}
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5 space-y-4">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                <ShieldCheck size={17} />
                {provider === "zoho"
                  ? "How to generate a Zoho Mail App Password"
                  : "How to generate a Google App Password"}
              </div>

              {provider === "zoho" ? (
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">1</span>
                    <span>
                      Log in to Zoho Mail{" — "}
                      <a href="https://mail.zoho.com" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-blue-600 hover:underline font-medium">
                        mail.zoho.com <ExternalLink size={11} />
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">2</span>
                    <span>
                      Go to <strong>Settings → Security → App Passwords</strong>{" — "}
                      <a href="https://accounts.zoho.com/home#security/app-password" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-blue-600 hover:underline font-medium">
                        accounts.zoho.com <ExternalLink size={11} />
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">3</span>
                    <span>
                      Click <strong>Generate New Password</strong>, enter{" "}
                      <code className="bg-blue-100 px-1 rounded text-xs">ZorHire</code>{" "}
                      as the app name, and click <strong>Generate</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">4</span>
                    <span>Copy the generated app password and paste it in the field below.</span>
                  </li>
                </ol>
              ) : (
                <ol className="space-y-3 text-sm text-gray-700">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">1</span>
                    <span>
                      Log in to your Google Account and go to{" "}
                      <strong>Security → 2-Step Verification</strong> — make sure it is turned <strong>On</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">2</span>
                    <span>
                      Go to <strong>Security → App Passwords</strong>{" — "}
                      <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-blue-600 hover:underline font-medium">
                        myaccount.google.com/apppasswords <ExternalLink size={11} />
                      </a>
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">3</span>
                    <span>
                      Select app <strong>Mail</strong> and device <strong>Other</strong>, type{" "}
                      <code className="bg-blue-100 px-1 rounded text-xs">ZorHire</code>, click <strong>Generate</strong>.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[11px] font-bold">4</span>
                    <span>Copy the 16-character password shown and paste it in the field below.</span>
                  </li>
                </ol>
              )}

              <p className="text-xs text-gray-500 border-t border-blue-100 pt-3">
                <strong>Important:</strong> Use your <strong>App Password</strong> — NOT your regular login password.
                {provider === "zoho" &&
                  " Also ensure SMTP access is enabled under Zoho Mail Settings → Security."}{" "}
                Only company domain emails are supported.
              </p>
            </div>

            {/* ── Connect / Update form ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                {isConnected ? "Update Configuration" : "Connect Email"}
              </p>
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    {provider === "zoho" ? "Zoho Email Address" : "Google Workspace Email Address"}
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@yourcompany.com"
                      required
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">App Password</label>
                  <div className="relative">
                    <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={appPassword}
                      onChange={(e) => setAppPassword(e.target.value)}
                      placeholder={isConnected ? "Enter new password to update" : "xxxx xxxx xxxx xxxx"}
                      className="w-full pl-9 pr-10 py-2.5 text-sm border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 font-mono tracking-wider transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    Paste the app password exactly as shown — spaces are stripped automatically.
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 flex-wrap">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#111111] hover:bg-black disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    {saving ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        {isConnected ? "Update Email" : "Connect Email"}
                      </>
                    )}
                  </button>

                  {isConnected && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      disabled={removing}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-60"
                    >
                      {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      Disconnect
                    </button>
                  )}
                </div>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
