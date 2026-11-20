import { useId, useState } from "react";
import { Plus, Trash2, ChevronDown, Users } from "lucide-react";
import { Button, EmptyState, Modal } from "../ui";
import api from "../../lib/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stakeholder {
  name: string;
  role: string;
  email: string;
  phone: string;
  timezone: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const emptyStakeholder = (): Stakeholder => ({
  name: "", role: "", email: "", phone: "", timezone: "",
});

const TABS = ["Basic Info", "Stakeholders", "Business & Billing", "Contract & AI", "Internal"];

// ─── Reusable field primitives ────────────────────────────────────────────────

const span = (colSpan?: boolean) => (colSpan ? " sm:col-span-2" : "");

function FieldLabel({ text, required, htmlFor }: { text: string; required?: boolean; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="zh-label">
      {text}
      {required && <span className="ml-0.5 text-danger-600">*</span>}
    </label>
  );
}

function InputField({
  label, value, onChange, type = "text", placeholder, required, colSpan,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; colSpan?: boolean;
}) {
  const id = useId();
  return (
    <div className={span(colSpan)}>
      <FieldLabel text={label} required={required} htmlFor={id} />
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="zh-input"
      />
    </div>
  );
}

function TextareaField({
  label, value, onChange, placeholder, rows = 2, colSpan,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; colSpan?: boolean;
}) {
  const id = useId();
  return (
    <div className={span(colSpan)}>
      <FieldLabel text={label} htmlFor={id} />
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="zh-input resize-none"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options, colSpan,
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; colSpan?: boolean;
}) {
  const id = useId();
  return (
    <div className={span(colSpan)}>
      <FieldLabel text={label} htmlFor={id} />
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="zh-input appearance-none pr-9"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
    </div>
  );
}

function CheckboxField({
  id, label, checked, onChange, colSpan,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void; colSpan?: boolean;
}) {
  return (
    <div className={`flex items-end${span(colSpan)}`}>
      <label
        htmlFor={id}
        className="flex w-full cursor-pointer select-none items-center gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5 text-sm text-ink hover:border-line-strong"
      >
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 rounded accent-navy-600"
        />
        {label}
      </label>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="border-b border-line pb-1.5 pt-2 sm:col-span-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientInfoModal({ onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Basic
  const [clientName, setClientName] = useState("");
  const [clientType, setClientType] = useState("Direct");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [hqLocation, setHqLocation] = useState("");
  const [opLocations, setOpLocations] = useState("");

  // Primary Contact
  const [contactName, setContactName] = useState("");
  const [designation, setDesignation] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [alternateContact, setAlternateContact] = useState("");

  // Stakeholders
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);

  // Business
  const [engagementType, setEngagementType] = useState("Contract");
  const [hiringVolume, setHiringVolume] = useState("");
  const [activeReq, setActiveReq] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [sla, setSla] = useState("");
  const [workingHours, setWorkingHours] = useState("");

  // Billing
  const [billingModel, setBillingModel] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [markup, setMarkup] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [invoiceCycle, setInvoiceCycle] = useState("");
  const [billingContact, setBillingContact] = useState("");

  // Contract
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [msaSigned, setMsaSigned] = useState(false);
  const [ndaSigned, setNdaSigned] = useState(false);

  // AI
  const [preferredSkills, setPreferredSkills] = useState("");
  const [typicalRoles, setTypicalRoles] = useState("");
  const [candidatePref, setCandidatePref] = useState("");
  const [hiringStrategy, setHiringStrategy] = useState("");
  const [interviewProcess, setInterviewProcess] = useState("");
  const [evalCriteria, setEvalCriteria] = useState("");

  // Performance
  const [positionsClosed, setPositionsClosed] = useState("");
  const [avgClosure, setAvgClosure] = useState("");
  const [interviewRatio, setInterviewRatio] = useState("");
  const [offerRate, setOfferRate] = useState("");

  // Communication
  const [preferredChannel, setPreferredChannel] = useState("");
  const [updateFreq, setUpdateFreq] = useState("");
  const [autoReport, setAutoReport] = useState(false);

  // Internal
  const [accountManager, setAccountManager] = useState("");
  const [deliveryLead, setDeliveryLead] = useState("");
  const [recruiters, setRecruiters] = useState("");

  // Tags & Notes
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");

  // ── Stakeholder helpers ────────────────────────────────────────────────────
  const addStakeholder = () => setStakeholders((prev) => [...prev, emptyStakeholder()]);
  const removeStakeholder = (i: number) =>
    setStakeholders((prev) => prev.filter((_, idx) => idx !== i));
  const updateStakeholder = (i: number, field: keyof Stakeholder, val: string) =>
    setStakeholders((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: val } : s))
    );

  const splitArr = (val: string) =>
    val.split(",").map((s) => s.trim()).filter(Boolean);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) {
      setError("Client name is required.");
      setActiveTab(0);
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError("Please enter a valid primary contact email.");
      setActiveTab(0);
      return;
    }

    setError("");
    setLoading(true);
    try {
      await api.post("/clients", {
        client_name: clientName,
        client_type: clientType,
        industry,
        company_size: companySize,
        website,
        linkedin,
        headquarters_location: hqLocation,
        operating_locations: splitArr(opLocations),
        contact_name: contactName,
        primary_contact_name: contactName,
        primary_contact_email: contactEmail,
        primary_contact_phone: contactPhone,
        alternate_contact: alternateContact,
        stakeholders,
        engagement_type: engagementType,
        hiring_volume: hiringVolume ? parseInt(hiringVolume, 10) : null,
        active_requirements: activeReq ? parseInt(activeReq, 10) : null,
        client_priority: priority,
        sla,
        working_hours: workingHours,
        billing_model: billingModel,
        currency,
        markup,
        payment_terms: paymentTerms,
        invoice_cycle: invoiceCycle,
        billing_contact: billingContact,
        contract_start: contractStart || null,
        contract_end: contractEnd || null,
        msa_signed: msaSigned,
        nda_signed: ndaSigned,
        preferred_skills: splitArr(preferredSkills),
        typical_roles: splitArr(typicalRoles),
        candidate_preference: candidatePref,
        hiring_strategy: hiringStrategy,
        interview_process: interviewProcess,
        evaluation_criteria: evalCriteria,
        positions_closed: positionsClosed ? parseInt(positionsClosed, 10) : null,
        avg_closure_time: avgClosure ? parseFloat(avgClosure) : null,
        interview_ratio: interviewRatio ? parseFloat(interviewRatio) : null,
        offer_acceptance_rate: offerRate ? parseFloat(offerRate) : null,
        preferred_channel: preferredChannel,
        update_frequency: updateFreq,
        auto_report: autoReport,
        account_manager: accountManager,
        delivery_lead: deliveryLead,
        recruiters: splitArr(recruiters),
        tags: splitArr(tags),
        notes,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } }; message?: string })
          ?.response?.data?.message ||
        (err as { message?: string })?.message ||
        "Failed to save client. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ─── Stakeholder tab ────────────────────────────────────────────────────────
  const stakeholderInputCls =
    "zh-input";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Add client"
      description="Add a new client with complete details"
      preventClose={loading}
      bodyClassName="!p-0"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form="client-info-form" loading={loading} loadingText="Saving...">
            Save client
          </Button>
        </>
      }
    >
        {/* ── Tabs ── */}
        <div role="tablist" className="sticky top-0 z-[1] flex overflow-x-auto border-b border-line bg-white px-3 sm:px-4">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === i}
              onClick={() => setActiveTab(i)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                activeTab === i
                  ? "border-navy-600 text-navy-700"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Form ── */}
        <form id="client-info-form" onSubmit={handleSubmit}>
          <div className="px-5 py-5 sm:px-6">
            {error && (
              <div role="alert" className="mb-4 rounded-lg border border-danger-600/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {error}
              </div>
            )}

            {/* TAB 0 — Basic Info + Primary Contact */}
            {activeTab === 0 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionDivider title="Basic Client Information" />

                <InputField label="Client Name" value={clientName} onChange={setClientName}
                  required placeholder="e.g. TechCorp India" colSpan />
                <SelectField label="Client Type" value={clientType} onChange={setClientType}
                  options={["Direct", "Implementation Partner", "Vendor"]} />
                <InputField label="Industry" value={industry} onChange={setIndustry}
                  placeholder="e.g. Technology" />
                <InputField label="Company Size" value={companySize} onChange={setCompanySize}
                  placeholder="e.g. 500–1000" />
                <InputField label="Website" value={website} onChange={setWebsite}
                  type="url" placeholder="https://example.com" />
                <InputField label="LinkedIn" value={linkedin} onChange={setLinkedin}
                  placeholder="https://linkedin.com/company/..." />
                <InputField label="Headquarters Location" value={hqLocation} onChange={setHqLocation}
                  placeholder="e.g. Bangalore, India" colSpan />
                <InputField label="Operating Locations (comma separated)" value={opLocations}
                  onChange={setOpLocations} placeholder="Mumbai, Delhi, Chennai" colSpan />

                <SectionDivider title="Primary Contact" />

                <InputField label="Contact Name" value={contactName} onChange={setContactName}
                  placeholder="e.g. Priya Sharma" />
                <InputField label="Designation" value={designation} onChange={setDesignation}
                  placeholder="e.g. HR Director" />
                <InputField label="Email" value={contactEmail} onChange={setContactEmail}
                  type="email" placeholder="contact@company.com" />
                <InputField label="Phone" value={contactPhone} onChange={setContactPhone}
                  placeholder="+91 98765 43210" />
                <InputField label="Alternate Contact (optional)" value={alternateContact}
                  onChange={setAlternateContact} placeholder="Alt email or phone" colSpan />
              </div>
            )}

            {/* TAB 1 — Stakeholders */}
            {activeTab === 1 && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">Stakeholders</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      Add multiple points of contact at this client
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={addStakeholder} icon={<Plus size={14} />}>
                    Add stakeholder
                  </Button>
                </div>

                {stakeholders.length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-line">
                    <EmptyState
                      compact
                      icon={<Users size={22} aria-hidden="true" />}
                      title="No stakeholders added yet"
                      description='Click "Add stakeholder" to add a point of contact.'
                    />
                  </div>
                )}

                {stakeholders.map((s, i) => (
                  <div key={i} className="space-y-4 rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-ink">
                        Stakeholder {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStakeholder(i)}
                        aria-label={`Remove stakeholder ${i + 1}`}
                        className="rounded-lg p-1.5 text-danger-600 transition-colors hover:bg-danger-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <FieldLabel text="Name" />
                        <input type="text" value={s.name}
                          onChange={(e) => updateStakeholder(i, "name", e.target.value)}
                          placeholder="Full name" className={stakeholderInputCls} />
                      </div>
                      <div>
                        <FieldLabel text="Role" />
                        <input type="text" value={s.role}
                          onChange={(e) => updateStakeholder(i, "role", e.target.value)}
                          placeholder="e.g. Hiring Manager" className={stakeholderInputCls} />
                      </div>
                      <div>
                        <FieldLabel text="Email" />
                        <input type="email" value={s.email}
                          onChange={(e) => updateStakeholder(i, "email", e.target.value)}
                          placeholder="email@company.com" className={stakeholderInputCls} />
                      </div>
                      <div>
                        <FieldLabel text="Phone" />
                        <input type="text" value={s.phone}
                          onChange={(e) => updateStakeholder(i, "phone", e.target.value)}
                          placeholder="+91 98765 43210" className={stakeholderInputCls} />
                      </div>
                      <div className="sm:col-span-2">
                        <FieldLabel text="Timezone" />
                        <input type="text" value={s.timezone}
                          onChange={(e) => updateStakeholder(i, "timezone", e.target.value)}
                          placeholder="e.g. IST (UTC+5:30)" className={stakeholderInputCls} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 2 — Business & Billing */}
            {activeTab === 2 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionDivider title="Business Details" />

                <SelectField label="Engagement Type" value={engagementType}
                  onChange={setEngagementType} options={["Contract", "Full-Time", "C2H"]} />
                <SelectField label="Priority" value={priority}
                  onChange={setPriority} options={["High", "Medium", "Low"]} />
                <InputField label="Hiring Volume" value={hiringVolume}
                  onChange={setHiringVolume} type="number" placeholder="e.g. 20" />
                <InputField label="Active Requirements" value={activeReq}
                  onChange={setActiveReq} type="number" placeholder="e.g. 5" />
                <InputField label="SLA" value={sla} onChange={setSla}
                  placeholder="e.g. 72 hours TAT" colSpan />
                <InputField label="Working Hours" value={workingHours}
                  onChange={setWorkingHours} placeholder="e.g. 9AM–6PM IST" colSpan />

                <SectionDivider title="Billing Information" />

                <InputField label="Billing Model" value={billingModel}
                  onChange={setBillingModel} placeholder="e.g. Fixed Fee / Retainer" />
                <SelectField label="Currency" value={currency} onChange={setCurrency}
                  options={["INR", "USD", "GBP", "EUR", "AED", "SGD"]} />
                <InputField label="Markup %" value={markup} onChange={setMarkup}
                  placeholder="e.g. 15%" />
                <InputField label="Payment Terms" value={paymentTerms}
                  onChange={setPaymentTerms} placeholder="e.g. Net 30" />
                <InputField label="Invoice Cycle" value={invoiceCycle}
                  onChange={setInvoiceCycle} placeholder="e.g. Monthly" />
                <InputField label="Billing Contact" value={billingContact}
                  onChange={setBillingContact} placeholder="billing@company.com" colSpan />
              </div>
            )}

            {/* TAB 3 — Contract & AI */}
            {activeTab === 3 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionDivider title="Contract Details" />

                <InputField label="Contract Start" value={contractStart}
                  onChange={setContractStart} type="date" />
                <InputField label="Contract End" value={contractEnd}
                  onChange={setContractEnd} type="date" />
                <CheckboxField id="msa_signed" label="Master Service Agreement (MSA) Signed"
                  checked={msaSigned} onChange={setMsaSigned} />
                <CheckboxField id="nda_signed" label="Non-Disclosure Agreement (NDA) Signed"
                  checked={ndaSigned} onChange={setNdaSigned} />

                <SectionDivider title="AI & Hiring Intelligence" />

                <InputField label="Preferred Skills (comma separated)" value={preferredSkills}
                  onChange={setPreferredSkills} placeholder="React, Node.js, AWS" colSpan />
                <InputField label="Typical Roles (comma separated)" value={typicalRoles}
                  onChange={setTypicalRoles} placeholder="Frontend Dev, Backend Dev" colSpan />
                <TextareaField label="Candidate Preference" value={candidatePref}
                  onChange={setCandidatePref}
                  placeholder="Preferred candidate profile and background..." colSpan />
                <TextareaField label="Hiring Strategy" value={hiringStrategy}
                  onChange={setHiringStrategy}
                  placeholder="Hiring approach and sourcing strategy..." colSpan />
                <TextareaField label="Interview Process" value={interviewProcess}
                  onChange={setInterviewProcess}
                  placeholder="Interview rounds, format, panel composition..." colSpan />
                <TextareaField label="Evaluation Criteria" value={evalCriteria}
                  onChange={setEvalCriteria}
                  placeholder="Key criteria for candidate evaluation..." colSpan />
              </div>
            )}

            {/* TAB 4 — Internal */}
            {activeTab === 4 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <SectionDivider title="Performance Metrics" />

                <InputField label="Positions Closed" value={positionsClosed}
                  onChange={setPositionsClosed} type="number" placeholder="0" />
                <InputField label="Avg. Closure Time (days)" value={avgClosure}
                  onChange={setAvgClosure} type="number" placeholder="e.g. 25" />
                <InputField label="Interview Ratio (%)" value={interviewRatio}
                  onChange={setInterviewRatio} type="number" placeholder="e.g. 30" />
                <InputField label="Offer Acceptance Rate (%)" value={offerRate}
                  onChange={setOfferRate} type="number" placeholder="e.g. 80" />

                <SectionDivider title="Communication Preferences" />

                <InputField label="Preferred Channel" value={preferredChannel}
                  onChange={setPreferredChannel} placeholder="e.g. Email / Slack / WhatsApp" />
                <InputField label="Update Frequency" value={updateFreq}
                  onChange={setUpdateFreq} placeholder="e.g. Weekly / Bi-weekly" />
                <CheckboxField id="auto_report" label="Enable automated status reports"
                  checked={autoReport} onChange={setAutoReport} colSpan />

                <SectionDivider title="Internal Mapping" />

                <InputField label="Account Manager" value={accountManager}
                  onChange={setAccountManager} placeholder="Internal account manager" />
                <InputField label="Delivery Lead" value={deliveryLead}
                  onChange={setDeliveryLead} placeholder="Internal delivery lead" />
                <InputField label="Recruiters (comma separated)" value={recruiters}
                  onChange={setRecruiters} placeholder="Recruiter1, Recruiter2" colSpan />

                <SectionDivider title="Tags & Notes" />

                <InputField label="Tags (comma separated)" value={tags} onChange={setTags}
                  placeholder="tech, priority, enterprise" colSpan />
                <TextareaField label="Notes" value={notes} onChange={setNotes}
                  placeholder="Internal notes about this client..." rows={4} colSpan />
              </div>
            )}
          </div>
        </form>
    </Modal>
  );
}
