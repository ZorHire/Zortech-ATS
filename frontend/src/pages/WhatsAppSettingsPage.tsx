import { useEffect, useId, useState } from "react";
import { CheckCircle2, Copy, MessageCircle, Smartphone, Trash2 } from "lucide-react";
import { Badge, Button, ErrorState, PageHeader, Skeleton, useConfirm } from "../components/ui";
import {
  useGetCompanyWhatsAppQuery,
  useGetMyWhatsAppQuery,
  useRemoveCompanyWhatsAppMutation,
  useRemoveMyWhatsAppMutation,
  useSaveCompanyWhatsAppMutation,
  useSaveMyWhatsAppMutation,
} from "../store/api/whatsappApi";
import type { WhatsAppMode } from "../store/api/whatsappApi";
import { useAppSelector } from "../hooks/useAppSelector";
import { selectCurrentUser } from "../store/slices/authSlice";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";

const pretty = (d?: string | null) => (d ? `+${d.slice(0, d.length - 10)} ${d.slice(-10, -5)} ${d.slice(-5)}` : "");

export default function WhatsAppSettingsPage() {
  const user = useAppSelector(selectCurrentUser);
  const isAdmin = user?.role === "super_admin" || user?.role === "accounts_manager";
  return (
    <div>
      <PageHeader title="WhatsApp" subtitle="Message candidates on WhatsApp from your own number. Every message is saved on the candidate's record." />
      <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <MyNumberCard />
        {isAdmin && <CompanyCard />}
      </div>
    </div>
  );
}

function MyNumberCard() {
  const id = useId();
  const notify = useNotify();
  const confirm = useConfirm();
  const { data, isLoading, isError, error, refetch } = useGetMyWhatsAppQuery();
  const [save, { isLoading: saving }] = useSaveMyWhatsAppMutation();
  const [remove] = useRemoveMyWhatsAppMutation();
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<WhatsAppMode>("click");

  useEffect(() => {
    if (data?.number) { setPhone(`+${data.number.phone_e164}`); setMode(data.number.mode); }
  }, [data]);

  if (isLoading) return <div className="zh-card p-5"><Skeleton className="h-24 w-full" /></div>;
  if (isError) return <div className="zh-card"><ErrorState error={error} onRetry={refetch} compact /></div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await save({ phone, mode }).unwrap(); notify.success("Your WhatsApp number is saved."); }
    catch (err) { notify.error(getErrorMessage(err, "Could not save your number.")); }
  };

  return (
    <section className="zh-card p-5 sm:p-6" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-50 text-success-700"><Smartphone size={20} aria-hidden="true" /></span>
          <div>
            <h2 id={`${id}-t`} className="text-base font-semibold text-ink">My WhatsApp number</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">The number candidates will see your messages from. Each recruiter uses their own.</p>
          </div>
        </div>
        {data?.number && <Badge tone="success">{pretty(data.number.phone_e164)} · {data.number.mode === "api" ? "Automatic" : "Click to send"}</Badge>}
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4 border-t border-line pt-5">
        <div className="max-w-sm">
          <label htmlFor={`${id}-p`} className="zh-label">WhatsApp number (with country code)</label>
          <input id={`${id}-p`} className="zh-input" inputMode="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <fieldset>
          <legend className="zh-label">How messages are sent</legend>
          <div className="grid gap-2 md:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 ${mode === "click" ? "border-navy-400 bg-navy-50" : "border-line"}`}>
              <input type="radio" name={`${id}-m`} className="mt-1" checked={mode === "click"} onChange={() => setMode("click")} />
              <span><b className="text-sm text-ink">Click to send</b> <Badge tone="success">No setup</Badge>
                <span className="block text-xs text-muted">Works with any WhatsApp or WhatsApp Business number. ZorHire writes the message and opens WhatsApp (phone or WhatsApp Web); you press Send. Make sure WhatsApp is signed in with this number.</span></span>
            </label>
            <label className={`flex items-start gap-2 rounded-lg border p-3 ${data?.company_api ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${mode === "api" ? "border-navy-400 bg-navy-50" : "border-line"}`}>
              <input type="radio" name={`${id}-m`} className="mt-1" disabled={!data?.company_api} checked={mode === "api"} onChange={() => setMode("api")} />
              <span><b className="text-sm text-ink">Automatic</b>
                <span className="block text-xs text-muted">{data?.company_api
                  ? "Sends straight from ZorHire through your company's WhatsApp Business account, and replies show up here. Your number must be added to that account in Meta's WhatsApp Manager."
                  : "Needs your company's WhatsApp Business account to be connected by an admin."}</span></span>
            </label>
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving} icon={<CheckCircle2 size={16} />}>Save my number</Button>
          {data?.number && <Button variant="ghost" icon={<Trash2 size={16} />} onClick={async () => {
            if (await confirm({ title: "Remove your WhatsApp number?", message: "You won't be able to message candidates on WhatsApp until you add it again. Past messages stay on the candidates.", confirmText: "Remove", danger: true })) await remove();
          }}>Remove</Button>}
        </div>
      </form>
    </section>
  );
}

function CompanyCard() {
  const id = useId();
  const notify = useNotify();
  const confirm = useConfirm();
  const { data, isLoading } = useGetCompanyWhatsAppQuery();
  const [save, { isLoading: saving }] = useSaveCompanyWhatsAppMutation();
  const [remove] = useRemoveCompanyWhatsAppMutation();
  const [f, setF] = useState({ waba_id: "", access_token: "", app_secret: "", template_name: "", template_lang: "en" });
  const [numbers, setNumbers] = useState<{ id: string; number: string; name: string }[] | null>(null);

  useEffect(() => {
    if (data?.connected) setF((x) => ({ ...x, waba_id: data.waba_id ?? "", template_name: data.template_name ?? "", template_lang: data.template_lang ?? "en" }));
  }, [data]);

  if (isLoading || !data) return <div className="zh-card p-5"><Skeleton className="h-24 w-full" /></div>;
  const copy = async (t: string) => { await navigator.clipboard.writeText(t); notify.success("Copied."); };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const r = await save({ ...f, access_token: f.access_token || undefined, app_secret: f.app_secret || undefined, template_name: f.template_name || undefined }).unwrap();
      setNumbers(r.numbers ?? null);
      setF((x) => ({ ...x, access_token: "", app_secret: "" }));
      notify.success("WhatsApp Business connected.");
    } catch (err) { notify.error(getErrorMessage(err, "Could not connect WhatsApp Business.")); }
  };
  const field = (key: keyof typeof f, label: string, hint: string, secret = false) => (
    <div>
      <label htmlFor={`${id}-${key}`} className="zh-label">{label}</label>
      <input id={`${id}-${key}`} className="zh-input" type={secret ? "password" : "text"} autoComplete="off" value={f[key]}
        placeholder={secret && data.connected ? "Saved (leave blank to keep)" : ""} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );

  return (
    <section className="zh-card p-5 sm:p-6" aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 text-navy-600"><MessageCircle size={20} aria-hidden="true" /></span>
          <div>
            <h2 id={`${id}-t`} className="text-base font-semibold text-ink">Company WhatsApp Business (optional)</h2>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">Connect your WhatsApp Business Platform account so recruiters can send automatically and see replies in ZorHire. Meta charges per conversation. Admins only.</p>
          </div>
        </div>
        <Badge tone={data.connected ? "success" : data.needs_reconnect ? "danger" : "neutral"}>{data.connected ? "Connected" : data.needs_reconnect ? "Needs reconnecting" : "Not connected"}</Badge>
      </div>
      <form onSubmit={submit} className="mt-5 grid gap-4 border-t border-line pt-5 md:grid-cols-2">
        {field("waba_id", "WhatsApp Business Account ID", "WhatsApp Manager → Account tools → Account ID.")}
        {field("access_token", "Permanent access token", "A System User token with whatsapp_business_messaging permission.", true)}
        {field("app_secret", "App secret", "Meta app → App settings → Basic. Used to verify incoming replies.", true)}
        <div className="grid grid-cols-[1fr_96px] gap-2">
          {field("template_name", "Message template name", "An approved template whose body has {{1}} (first name) and {{2}} (your message). Needed to start chats.")}
          {field("template_lang", "Language", "e.g. en, en_US")}
        </div>
        {data.connected && data.verify_token && (
          <div className="md:col-span-2 rounded-lg bg-surface-sunken p-3 text-sm">
            <p className="font-medium text-ink">Webhook (paste these into your Meta app → WhatsApp → Configuration)</p>
            <div className="mt-2 flex items-center gap-2"><span className="w-28 text-muted">Callback URL</span><code className="flex-1 truncate">{data.webhook_url}</code><Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => copy(data.webhook_url)}>Copy</Button></div>
            <div className="mt-1 flex items-center gap-2"><span className="w-28 text-muted">Verify token</span><code className="flex-1 truncate">{data.verify_token}</code><Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => copy(data.verify_token!)}>Copy</Button></div>
            <p className="mt-1 text-xs text-muted">Subscribe to the "messages" field.</p>
          </div>
        )}
        {numbers && (
          <div className="md:col-span-2 text-sm">
            <p className="font-medium text-ink">Numbers on this account</p>
            <ul className="mt-1 list-disc pl-5 text-muted">{numbers.map((n) => <li key={n.id}>{n.number} · {n.name}</li>)}</ul>
            <p className="mt-1 text-xs text-muted">Recruiters whose number is listed here can choose "Automatic" on their own WhatsApp settings.</p>
          </div>
        )}
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" loading={saving} loadingText="Checking with WhatsApp…">{data.connected ? "Save" : "Connect WhatsApp Business"}</Button>
          {data.connected && <Button variant="ghost" icon={<Trash2 size={16} />} onClick={async () => {
            if (await confirm({ title: "Disconnect WhatsApp Business?", message: "Recruiters on automatic sending switch to click-to-send.", confirmText: "Disconnect", danger: true })) await remove();
          }}>Disconnect</Button>}
        </div>
      </form>
    </section>
  );
}
