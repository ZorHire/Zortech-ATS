import type { ReactNode } from "react";
import { Mail, Phone, Globe } from "lucide-react";
import { Badge, Modal } from "../ui";
import type { BadgeTone } from "../ui";

interface ClientDetailModalProps {
  client: any;
  onClose: () => void;
}

function FieldShell({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 space-y-0.5${wide ? " sm:col-span-2" : ""}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (!value && value !== 0 && value !== false) return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <FieldShell label={label}>
      <p className="break-words text-sm text-ink">{display}</p>
    </FieldShell>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="border-b border-line pb-1.5 text-sm font-semibold text-ink">{title}</h3>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <SectionTitle title={title} />
      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

const PRIORITY_TONE: Record<string, BadgeTone> = { High: "danger", Medium: "warning", Low: "success" };

export default function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const stakeholders: any[] = client.stakeholders || [];
  const name = client.name || client.client_name;

  return (
    <Modal
      open
      onClose={onClose}
      closeOnBackdrop
      size="lg"
      title={
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-600 text-lg font-semibold text-white"
          >
            {(name || "?").charAt(0)}
          </span>
          <span className="min-w-0 truncate">{name}</span>
        </span>
      }
      description={client.industry || "No industry specified"}
    >
      <div className="space-y-8">
        {(client.client_type || client.client_priority) && (
          <div className="flex flex-wrap gap-2">
            {client.client_type && <Badge tone="navy">{client.client_type}</Badge>}
            {client.client_priority && (
              <Badge tone={PRIORITY_TONE[client.client_priority] ?? "success"}>{client.client_priority} priority</Badge>
            )}
          </div>
        )}

        {/* Basic Info */}
        <Section title="Basic information">
          <Field label="Company size" value={client.company_size} />
          <Field label="Headquarters" value={client.headquarters_location} />
          {client.operating_locations?.length > 0 && (
            <FieldShell label="Operating locations" wide>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {client.operating_locations.map((loc: string) => (
                  <Badge key={loc}>{loc}</Badge>
                ))}
              </div>
            </FieldShell>
          )}
          {client.website && (
            <FieldShell label="Website">
              <a
                href={client.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 break-all text-sm text-navy-600 hover:underline"
              >
                <Globe size={12} className="shrink-0" /> {client.website}
              </a>
            </FieldShell>
          )}
          {client.linkedin && (
            <FieldShell label="LinkedIn">
              <a href={client.linkedin} target="_blank" rel="noreferrer" className="break-all text-sm text-navy-600 hover:underline">
                {client.linkedin}
              </a>
            </FieldShell>
          )}
        </Section>

        {/* Primary Contact */}
        <Section title="Primary contact">
          <Field label="Contact name" value={client.primary_contact_name || client.contact_name} />
          <Field label="Alternate contact" value={client.alternate_contact} />
          {client.primary_contact_email && (
            <FieldShell label="Email">
              <a
                href={`mailto:${client.primary_contact_email}`}
                className="flex items-center gap-1 break-all text-sm text-navy-600 hover:underline"
              >
                <Mail size={12} className="shrink-0" /> {client.primary_contact_email}
              </a>
            </FieldShell>
          )}
          {client.primary_contact_phone && (
            <FieldShell label="Phone">
              <span className="flex items-center gap-1 text-sm text-ink">
                <Phone size={12} className="shrink-0 text-muted" /> {client.primary_contact_phone}
              </span>
            </FieldShell>
          )}
        </Section>

        {/* Business Details */}
        {(client.engagement_type || client.hiring_volume || client.sla || client.working_hours || client.billing_model) && (
          <Section title="Business & billing">
            <Field label="Engagement type" value={client.engagement_type} />
            <Field label="Hiring volume" value={client.hiring_volume} />
            <Field label="Active requirements" value={client.active_requirements} />
            <Field label="SLA" value={client.sla} />
            <Field label="Working hours" value={client.working_hours} />
            <Field label="Billing model" value={client.billing_model} />
            <Field label="Currency" value={client.currency} />
            <Field label="Markup" value={client.markup} />
            <Field label="Payment terms" value={client.payment_terms} />
            <Field label="Invoice cycle" value={client.invoice_cycle} />
            <Field label="Billing contact" value={client.billing_contact} />
          </Section>
        )}

        {/* Contract */}
        {(client.contract_start || client.contract_end || client.msa_signed || client.nda_signed) && (
          <Section title="Contract">
            <Field label="Contract start" value={client.contract_start ? new Date(client.contract_start).toLocaleDateString() : null} />
            <Field label="Contract end" value={client.contract_end ? new Date(client.contract_end).toLocaleDateString() : null} />
            <Field label="MSA signed" value={client.msa_signed} />
            <Field label="NDA signed" value={client.nda_signed} />
          </Section>
        )}

        {/* Internal */}
        {(client.account_manager || client.delivery_lead || client.recruiters?.length > 0) && (
          <Section title="Internal mapping">
            <Field label="Account manager" value={client.account_manager} />
            <Field label="Delivery lead" value={client.delivery_lead} />
            {client.recruiters?.length > 0 && (
              <FieldShell label="Recruiters" wide>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {client.recruiters.map((r: string) => (
                    <Badge key={r} tone="navy">{r}</Badge>
                  ))}
                </div>
              </FieldShell>
            )}
          </Section>
        )}

        {/* Stakeholders */}
        {stakeholders.length > 0 && (
          <section className="space-y-4">
            <SectionTitle title="Stakeholders" />
            <div className="space-y-3">
              {stakeholders.map((s: any, i: number) => (
                <div key={i} className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-2">
                  <Field label="Name" value={s.name} />
                  <Field label="Role" value={s.role} />
                  <Field label="Email" value={s.email} />
                  <Field label="Phone" value={s.phone} />
                  {s.timezone && <Field label="Timezone" value={s.timezone} />}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tags & Notes */}
        {(client.tags?.length > 0 || client.notes) && (
          <section className="space-y-4">
            <SectionTitle title="Tags & notes" />
            {client.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {client.tags.map((t: string) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
            )}
            {client.notes && (
              <p className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-4 text-sm leading-relaxed text-ink-soft">
                {client.notes}
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
