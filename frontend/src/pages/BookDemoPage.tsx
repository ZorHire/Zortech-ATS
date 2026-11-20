import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CalendarCheck, CheckCircle2, Mail, Users, Workflow, Building2 } from "lucide-react";
import { useRequestDemoMutation } from "../store/api/demoApi";
import type { DemoRequestBody } from "../store/api/demoApi";
import { Button } from "../components/ui";

const SALES_EMAIL = "tech@zortechs.in";
const TEAM_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

type FieldErrors = Partial<Record<keyof DemoRequestBody, string>>;

const EMPTY: DemoRequestBody = {
  name: "",
  email: "",
  company: "",
  role: "",
  phone: "",
  teamSize: "",
  message: "",
  website: "",
};

function validate(f: DemoRequestBody): FieldErrors {
  const e: FieldErrors = {};
  if (f.name.trim().length < 2) e.name = "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) e.email = "Please enter a valid work email.";
  if (f.company.trim().length < 2) e.company = "Please enter your company name.";
  if (f.phone && !/^[+\d][\d\s()-]{6,}$/.test(f.phone.trim())) e.phone = "Please enter a valid phone number.";
  return e;
}

/** Pre-filled email, used when the form can't reach the server. */
function mailtoFor(f: DemoRequestBody): string {
  const lines = [
    `Name: ${f.name}`,
    `Company: ${f.company}`,
    f.role && `Role: ${f.role}`,
    `Email: ${f.email}`,
    f.phone && `Phone: ${f.phone}`,
    f.teamSize && `Team size: ${f.teamSize}`,
    f.message && `\n${f.message}`,
  ].filter(Boolean);
  return `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`ZorHire demo request: ${f.company}`)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

const inputCls = "zh-input";

function Field({
  id,
  label,
  optional,
  error,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="zh-label">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}

export default function BookDemoPage() {
  const [form, setForm] = useState<DemoRequestBody>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [sentMessage, setSentMessage] = useState("");
  const [sendFailed, setSendFailed] = useState(false);
  const [requestDemo, { isLoading }] = useRequestDemoMutation();

  const set = (key: keyof DemoRequestBody) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSendFailed(false);
    try {
      const res = await requestDemo(form).unwrap();
      setSentMessage(res.message || "Thanks! We'll be in touch within one business day.");
    } catch (err) {
      const e2 = err as { status?: number; data?: { errors?: FieldErrors } };
      if (e2.status === 400 && e2.data?.errors) {
        setErrors(e2.data.errors);
        return;
      }
      // Server down, mailbox not configured, or rate-limited: never lose the lead.
      setSendFailed(true);
    }
  };

  const fieldProps = (key: keyof DemoRequestBody) => ({
    id: `demo-${key}`,
    value: form[key] ?? "",
    onChange: set(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `demo-${key}-error` : undefined,
  });

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} aria-hidden="true" />
            <img src="/brand/zortech-logo.png" alt="ZorTech" className="h-6 w-auto" />
            <span className="hidden border-l border-line pl-2 font-semibold text-navy-700 sm:inline">ZorHire</span>
          </Link>
          <Link to="/login" className="text-sm font-semibold text-navy-600 hover:underline">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_minmax(0,480px)] lg:py-16">
        <section>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">ZorHire ATS</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-navy-800 sm:text-4xl">
            Book a demo
          </h1>
          <p className="mt-4 max-w-md text-base leading-7 text-muted">
            See how ZorHire runs jobs, candidates, vendors and client submissions in one place. In about 30 minutes we'll
            walk through your hiring workflow and, if it's a fit, set up your company workspace.
          </p>
          <ul className="mt-8 space-y-4">
            {[
              { icon: Workflow, text: "Pipeline, interviews and offers for every open role" },
              { icon: Users, text: "Vendor submissions, scorecards and a client portal" },
              { icon: Building2, text: "Your own company workspace, set up by our team" },
              { icon: CalendarCheck, text: "We reply within one business day to schedule" },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-ink">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Icon size={15} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>

        <section className="zh-card p-6 sm:p-8">
          {sentMessage ? (
            <div className="py-8 text-center" role="status">
              <CheckCircle2 size={44} className="mx-auto text-success-600" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-semibold text-navy-800">Request received</h2>
              <p className="mt-2 text-sm text-muted">{sentMessage}</p>
              <Link to="/" className="mt-6 inline-block text-sm font-semibold text-navy-600 hover:underline">
                Back to home
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-4">
              <h2 className="text-lg font-semibold text-navy-800">Tell us about your team</h2>

              {sendFailed && (
                <div role="alert" className="rounded-lg border border-brand-300 bg-brand-50 p-3 text-sm text-warning-700">
                  We couldn't send your request right now.{" "}
                  <a href={mailtoFor(form)} className="inline-flex items-center gap-1 font-semibold underline">
                    <Mail size={14} aria-hidden="true" /> Email it to {SALES_EMAIL}
                  </a>{" "}
                  instead. Your details are already filled in.
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="demo-name" label="Full name" error={errors.name}>
                  <input {...fieldProps("name")} autoComplete="name" className={inputCls} />
                </Field>
                <Field id="demo-email" label="Work email" error={errors.email}>
                  <input {...fieldProps("email")} type="email" autoComplete="email" className={inputCls} />
                </Field>
                <Field id="demo-company" label="Company" error={errors.company}>
                  <input {...fieldProps("company")} autoComplete="organization" className={inputCls} />
                </Field>
                <Field id="demo-role" label="Your role" optional>
                  <input {...fieldProps("role")} autoComplete="organization-title" placeholder="e.g. Head of TA" className={inputCls} />
                </Field>
                <Field id="demo-phone" label="Phone" optional error={errors.phone}>
                  <input {...fieldProps("phone")} type="tel" autoComplete="tel" placeholder="+91" className={inputCls} />
                </Field>
                <Field id="demo-teamSize" label="Recruiting team size" optional>
                  <select {...fieldProps("teamSize")} className={inputCls}>
                    <option value="">Select…</option>
                    {TEAM_SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s} people
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field id="demo-message" label="What would you like to see?" optional>
                <textarea {...fieldProps("message")} rows={3} maxLength={2000} className={inputCls} />
              </Field>

              {/* Honeypot for bots: hidden from people and assistive tech */}
              <div aria-hidden="true" className="absolute -left-[10000px] h-0 w-0 overflow-hidden">
                <label htmlFor="demo-website">Website</label>
                <input id="demo-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
              </div>

              <Button type="submit" size="lg" fullWidth loading={isLoading} loadingText="Sending…">
                Request a demo
              </Button>
              <p className="text-center text-xs text-muted">
                Prefer email? Write to{" "}
                <a href={`mailto:${SALES_EMAIL}`} className="font-medium text-navy-600 hover:underline">
                  {SALES_EMAIL}
                </a>
              </p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
