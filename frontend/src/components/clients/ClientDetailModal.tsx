import type { ReactNode } from "react";
import { X, Mail, Phone, Globe } from "lucide-react";

interface ClientDetailModalProps {
  client: any;
  onClose: () => void;
}

function Field({ label, value }: { label: string; value?: string | number | boolean | null }) {
  if (!value && value !== 0 && value !== false) return null;
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : String(value);
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{display}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
        <div className="h-px bg-gray-100 mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-x-8 gap-y-4">{children}</div>
    </div>
  );
}

export default function ClientDetailModal({ client, onClose }: ClientDetailModalProps) {
  const stakeholders: any[] = client.stakeholders || [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
              {(client.name || client.client_name || "?").charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-black text-[#111111]">{client.name || client.client_name}</h2>
              <p className="text-xs text-gray-400 mt-0.5">{client.industry || "No industry specified"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {client.client_type && (
              <span className="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold border border-blue-100">
                {client.client_type}
              </span>
            )}
            {client.client_priority && (
              <span className={`text-xs px-3 py-1 rounded-full font-bold border ${
                client.client_priority === "High"
                  ? "bg-red-50 text-red-700 border-red-100"
                  : client.client_priority === "Medium"
                  ? "bg-amber-50 text-amber-700 border-amber-100"
                  : "bg-green-50 text-green-700 border-green-100"
              }`}>
                {client.client_priority} Priority
              </span>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-[#111111]">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Basic Info */}
          <Section title="Basic Information">
            <Field label="Company Size" value={client.company_size} />
            <Field label="Headquarters" value={client.headquarters_location} />
            {client.operating_locations?.length > 0 && (
              <div className="col-span-2 space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Operating Locations</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {client.operating_locations.map((loc: string) => (
                    <span key={loc} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-lg">{loc}</span>
                  ))}
                </div>
              </div>
            )}
            {client.website && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Website</p>
                <a href={client.website} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-medium">
                  <Globe size={12} /> {client.website}
                </a>
              </div>
            )}
            {client.linkedin && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">LinkedIn</p>
                <a href={client.linkedin} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-medium">{client.linkedin}</a>
              </div>
            )}
          </Section>

          {/* Primary Contact */}
          <Section title="Primary Contact">
            <Field label="Contact Name" value={client.primary_contact_name || client.contact_name} />
            <Field label="Alternate Contact" value={client.alternate_contact} />
            {client.primary_contact_email && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</p>
                <a href={`mailto:${client.primary_contact_email}`} className="text-sm text-blue-600 hover:underline flex items-center gap-1 font-medium">
                  <Mail size={12} /> {client.primary_contact_email}
                </a>
              </div>
            )}
            {client.primary_contact_phone && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Phone</p>
                <span className="text-sm text-gray-800 font-medium flex items-center gap-1">
                  <Phone size={12} /> {client.primary_contact_phone}
                </span>
              </div>
            )}
          </Section>

          {/* Business Details */}
          {(client.engagement_type || client.hiring_volume || client.sla || client.working_hours || client.billing_model) && (
            <Section title="Business & Billing">
              <Field label="Engagement Type" value={client.engagement_type} />
              <Field label="Hiring Volume" value={client.hiring_volume} />
              <Field label="Active Requirements" value={client.active_requirements} />
              <Field label="SLA" value={client.sla} />
              <Field label="Working Hours" value={client.working_hours} />
              <Field label="Billing Model" value={client.billing_model} />
              <Field label="Currency" value={client.currency} />
              <Field label="Markup" value={client.markup} />
              <Field label="Payment Terms" value={client.payment_terms} />
              <Field label="Invoice Cycle" value={client.invoice_cycle} />
              <Field label="Billing Contact" value={client.billing_contact} />
            </Section>
          )}

          {/* Contract */}
          {(client.contract_start || client.contract_end || client.msa_signed || client.nda_signed) && (
            <Section title="Contract">
              <Field label="Contract Start" value={client.contract_start ? new Date(client.contract_start).toLocaleDateString() : null} />
              <Field label="Contract End" value={client.contract_end ? new Date(client.contract_end).toLocaleDateString() : null} />
              <Field label="MSA Signed" value={client.msa_signed} />
              <Field label="NDA Signed" value={client.nda_signed} />
            </Section>
          )}

          {/* Internal */}
          {(client.account_manager || client.delivery_lead || client.recruiters?.length > 0) && (
            <Section title="Internal Mapping">
              <Field label="Account Manager" value={client.account_manager} />
              <Field label="Delivery Lead" value={client.delivery_lead} />
              {client.recruiters?.length > 0 && (
                <div className="col-span-2 space-y-0.5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recruiters</p>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {client.recruiters.map((r: string) => (
                      <span key={r} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg font-medium">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Stakeholders */}
          {stakeholders.length > 0 && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Stakeholders</p>
                <div className="h-px bg-gray-100 mt-1" />
              </div>
              <div className="space-y-3">
                {stakeholders.map((s: any, i: number) => (
                  <div key={i} className="p-4 border border-gray-100 rounded-2xl bg-gray-50/40 grid grid-cols-2 gap-3">
                    <Field label="Name" value={s.name} />
                    <Field label="Role" value={s.role} />
                    <Field label="Email" value={s.email} />
                    <Field label="Phone" value={s.phone} />
                    {s.timezone && <Field label="Timezone" value={s.timezone} />}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags & Notes */}
          {(client.tags?.length > 0 || client.notes) && (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tags & Notes</p>
                <div className="h-px bg-gray-100 mt-1" />
              </div>
              {client.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {client.tags.map((t: string) => (
                    <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">{t}</span>
                  ))}
                </div>
              )}
              {client.notes && (
                <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded-2xl border border-gray-100 leading-relaxed">{client.notes}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
