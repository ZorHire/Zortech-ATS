import { useState } from "react";
import { X, Plus, Trash2, ChevronDown } from "lucide-react";
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

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
      {text}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
  );
}

function InputField({
  label, value, onChange, type = "text", placeholder, required, colSpan,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; colSpan?: boolean;
}) {
  return (
    <div className={`space-y-1.5${colSpan ? " col-span-2" : ""}`}>
      <FieldLabel text={label} required={required} />
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
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
  return (
    <div className={`space-y-1.5${colSpan ? " col-span-2" : ""}`}>
      <FieldLabel text={label} />
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
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
  return (
    <div className={`space-y-1.5${colSpan ? " col-span-2" : ""}`}>
      <FieldLabel text={label} />
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all appearance-none"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
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
    <div className={`space-y-1.5${colSpan ? " col-span-2" : ""}`}>
      <FieldLabel text={label} />
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl cursor-pointer" onClick={() => onChange(!checked)}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 rounded accent-blue-600"
          onClick={(e) => e.stopPropagation()}
        />
        <label htmlFor={id} className="text-sm text-gray-600 cursor-pointer select-none">{label}</label>
      </div>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="col-span-2 pt-3 pb-1">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</p>
      <div className="h-px bg-gray-100 mt-1.5" />
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
    "w-full px-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl max-h-[88vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">

        {/* ── Header ── */}
        <div className="px-8 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-black text-[#111111] tracking-tight">Client Information</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add a new client with complete details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-white rounded-xl transition-all text-gray-400 hover:text-[#111111]"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 flex-shrink-0 overflow-x-auto px-2">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`py-3.5 px-4 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                activeTab === i
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-8">

            {/* TAB 0 — Basic Info + Primary Contact */}
            {activeTab === 0 && (
              <div className="grid grid-cols-2 gap-5">
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
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-gray-700">Stakeholders</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Add multiple points of contact at this client
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addStakeholder}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors"
                  >
                    <Plus size={14} />
                    Add Stakeholder
                  </button>
                </div>

                {stakeholders.length === 0 && (
                  <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl">
                    <p className="text-sm text-gray-400 font-medium">No stakeholders added yet</p>
                    <p className="text-xs text-gray-300 mt-1">Click "Add Stakeholder" to begin</p>
                  </div>
                )}

                {stakeholders.map((s, i) => (
                  <div key={i} className="p-5 border border-gray-100 rounded-2xl bg-gray-50/40 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        Stakeholder {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeStakeholder(i)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <FieldLabel text="Name" />
                        <input type="text" value={s.name}
                          onChange={(e) => updateStakeholder(i, "name", e.target.value)}
                          placeholder="Full name" className={stakeholderInputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel text="Role" />
                        <input type="text" value={s.role}
                          onChange={(e) => updateStakeholder(i, "role", e.target.value)}
                          placeholder="e.g. Hiring Manager" className={stakeholderInputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel text="Email" />
                        <input type="email" value={s.email}
                          onChange={(e) => updateStakeholder(i, "email", e.target.value)}
                          placeholder="email@company.com" className={stakeholderInputCls} />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel text="Phone" />
                        <input type="text" value={s.phone}
                          onChange={(e) => updateStakeholder(i, "phone", e.target.value)}
                          placeholder="+91 98765 43210" className={stakeholderInputCls} />
                      </div>
                      <div className="col-span-2 space-y-1.5">
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
              <div className="grid grid-cols-2 gap-5">
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
              <div className="grid grid-cols-2 gap-5">
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
              <div className="grid grid-cols-2 gap-5">
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

          {/* ── Footer ── */}
          <div className="px-8 py-6 border-t border-gray-100 flex-shrink-0">
            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
                {error}
              </div>
            )}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-4 bg-gray-50 text-[#111111] font-black text-sm rounded-[20px] border border-gray-100 hover:bg-gray-100 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-4 bg-[#111111] text-white font-black text-sm rounded-[20px] hover:scale-[1.02] transition-all shadow-xl shadow-gray-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {loading ? "Saving..." : "Save Client"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
