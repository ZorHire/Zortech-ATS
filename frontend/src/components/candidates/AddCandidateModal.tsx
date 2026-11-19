import { useState } from "react";
import { isLowConfidence } from "../../lib/confidenceIndicator";
import { useParseResumeMutation, useAddCandidateToJobMutation } from "../../store/api/candidateApi";
import { useNotify } from "../../hooks/useNotify";
import { Badge, Button, Modal } from "../ui";

interface Props {
  jobId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const sourceLabels: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  naukri: "Naukri",
  monster: "Monster",
  vendor: "Vendor",
  referral: "Referral",
  direct: "Direct",
  other: "Other",
};

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  current_title: "",
  current_company: "",
  experience_years: 0,
  current_location: "",
  preferred_location: "",
  notice_period_days: 30,
  current_ctc: "",
  expected_ctc: "",
  skills: "",
  source: "direct",
};

export default function AddCandidateModal({ jobId, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({ ...emptyForm });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParseMessage, setResumeParseMessage] = useState("");
  const [resumeParseError, setResumeParseError] = useState("");
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);

  const [parseResume, { isLoading: resumeParsing }] = useParseResumeMutation();
  const [addCandidateToJob, { isLoading: submitting }] = useAddCandidateToJobMutation();
  const notify = useNotify();

  const [contactTouched, setContactTouched] = useState(false);

  const parseResumeFile = async (file: File) => {
    setResumeParseMessage("");
    setResumeParseError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await parseResume(body).unwrap();
      if (
        !parsed ||
        Object.keys(parsed).length === 0 ||
        (!(parsed as any).name && !(parsed as any).email && !(parsed as any).phone &&
          (!(parsed as any).skills || (parsed as any).skills.length === 0))
      ) {
        setResumeParseError("Could not auto-fill from this resume. Please fill in the fields manually.");
        return;
      }
      const p = parsed as any;
      setFormData((cur) => ({
        ...cur,
        first_name: p.name?.split(" ")[0] || cur.first_name,
        last_name: p.name?.split(" ").slice(1).join(" ") || cur.last_name,
        email: p.email || cur.email,
        phone: p.phone || cur.phone,
        current_title: p.current_title || cur.current_title,
        current_company: p.current_company || cur.current_company,
        current_location: p.current_location || cur.current_location,
        experience_years: p.experience_years !== undefined ? p.experience_years : cur.experience_years,
        skills: p.skills?.length > 0 ? p.skills.join(", ") : cur.skills,
        preferred_location: p.preferred_location || cur.preferred_location,
        notice_period_days: p.notice_period_days !== undefined ? p.notice_period_days : cur.notice_period_days,
        current_ctc: p.current_ctc !== undefined ? String(p.current_ctc) : cur.current_ctc,
        expected_ctc: p.expected_ctc !== undefined ? String(p.expected_ctc) : cur.expected_ctc,
      }));
      setLowConfidenceFields(parsed.low_confidence_fields || []);
      setResumeParseMessage("Resume parsed successfully. Review fields and edit as needed.");
    } catch {
      setResumeParseError("Could not extract data, please fill manually.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim() && !formData.phone.trim()) {
      setContactTouched(true);
      notify.warning("Please provide at least an email or phone number.");
      return;
    }
    if (submitting) return;
    try {
      const fd = new FormData();
      fd.append("first_name", formData.first_name);
      fd.append("last_name", formData.last_name);
      fd.append("email", formData.email);
      fd.append("phone", formData.phone);
      fd.append("current_title", formData.current_title);
      fd.append("current_company", formData.current_company);
      fd.append("experience_years", String(formData.experience_years));
      fd.append("current_location", formData.current_location);
      fd.append("preferred_location", formData.preferred_location);
      fd.append("notice_period_days", String(formData.notice_period_days));
      if (formData.current_ctc) fd.append("current_ctc", formData.current_ctc);
      if (formData.expected_ctc) fd.append("expected_ctc", formData.expected_ctc);
      fd.append("source", formData.source);
      fd.append(
        "skills",
        JSON.stringify(formData.skills.split(",").map((s) => s.trim()).filter(Boolean)),
      );
      if (resumeFile) fd.append("resume", resumeFile);

      await addCandidateToJob({ jobId, body: fd }).unwrap();
      notify.success("Candidate added to job");
      onSuccess();
      onClose();
    } catch (err: any) {
      notify.error(err?.data?.message || err?.message || "Failed to add candidate");
    }
  };

  const flagged = (...keys: string[]) => isLowConfidence(lowConfidenceFields, ...keys);
  const inputClass = (isFlagged: boolean) => `zh-input ${isFlagged ? "border-warning-600 bg-warning-50" : ""}`;

  type FieldKey = keyof typeof emptyForm;
  const FIELDS: { key: FieldKey; label: string; type: string; placeholder?: string; required?: boolean; aliases: string[] }[] = [
    { key: "first_name", label: "First name", type: "text", placeholder: "e.g. John", required: true, aliases: ["name"] },
    { key: "last_name", label: "Last name", type: "text", placeholder: "e.g. Doe", required: true, aliases: ["name"] },
    { key: "email", label: "Email address", type: "email", placeholder: "john.doe@example.com", aliases: ["email"] },
    { key: "phone", label: "Phone number", type: "text", placeholder: "+91 XXXXX XXXXX", aliases: ["phone"] },
    { key: "current_title", label: "Current title", type: "text", placeholder: "e.g. Senior Software Engineer", aliases: ["current_title"] },
    { key: "current_company", label: "Current company", type: "text", placeholder: "e.g. Google", aliases: ["current_company"] },
    { key: "experience_years", label: "Experience (years)", type: "number", aliases: [] },
    { key: "current_location", label: "Location", type: "text", placeholder: "e.g. Pune", aliases: ["current_location"] },
    { key: "preferred_location", label: "Preferred location", type: "text", placeholder: "e.g. Bangalore or Remote", aliases: ["preferred_location"] },
    { key: "notice_period_days", label: "Notice period (days)", type: "number", aliases: ["notice_period_days"] },
    { key: "current_ctc", label: "Current CTC (annual)", type: "number", placeholder: "e.g. 1200000", aliases: ["current_ctc"] },
    { key: "expected_ctc", label: "Expected CTC (annual)", type: "number", placeholder: "e.g. 1500000", aliases: ["expected_ctc"] },
    { key: "skills", label: "Skills (comma separated)", type: "text", placeholder: "React, Node.js, TypeScript", aliases: ["skills"] },
  ];
  const numeric: FieldKey[] = ["experience_years", "notice_period_days"];
  const contactMissing = contactTouched && !formData.email.trim() && !formData.phone.trim();

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      preventClose={submitting}
      title="Add candidate to job"
      description="Upload a resume to auto-fill, then review the details."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-candidate-to-job-form"
            disabled={resumeParsing}
            loading={submitting}
            loadingText="Adding…"
          >
            {resumeParsing ? "Parsing…" : "Add to job"}
          </Button>
        </>
      }
    >
      <form id="add-candidate-to-job-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="acm-resume" className="zh-label">Resume</label>
          <input
            id="acm-resume"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                const file = e.target.files[0];
                setResumeFile(file);
                parseResumeFile(file);
              }
            }}
            className="zh-input file:mr-3 file:rounded-md file:border-0 file:bg-navy-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-navy-700"
          />
          <p className="mt-1 text-xs text-muted">PDF, DOC or DOCX. We'll fill in the fields below.</p>
          {resumeFile && <p className="mt-1 text-xs text-muted">Selected: {resumeFile.name}</p>}
          {resumeParsing && <p className="mt-1 text-xs text-navy-600" role="status">Parsing resume, please wait…</p>}
          {resumeParseMessage && <p className="mt-1 text-xs text-success-700" role="status">{resumeParseMessage}</p>}
          {resumeParseError && <p className="mt-1 text-xs text-danger-600" role="alert">{resumeParseError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const isFlagged = f.aliases.length > 0 && flagged(...f.aliases);
            const id = `acm-${f.key}`;
            return (
              <div key={f.key}>
                <label htmlFor={id} className="zh-label">
                  {f.label}
                  {f.required && <span className="text-danger-600"> *</span>}
                  {isFlagged && <Badge tone="warning" className="ml-2">Needs review</Badge>}
                </label>
                <input
                  id={id}
                  required={f.required}
                  type={f.type}
                  min={f.type === "number" ? 0 : undefined}
                  value={formData[f.key]}
                  onChange={(e) =>
                    setFormData({ ...formData, [f.key]: numeric.includes(f.key) ? Number(e.target.value) : e.target.value })
                  }
                  aria-invalid={f.key === "email" && contactMissing ? true : undefined}
                  aria-describedby={f.key === "email" && contactMissing ? "acm-contact-error" : undefined}
                  className={inputClass(isFlagged)}
                  placeholder={f.placeholder}
                />
                {f.key === "email" && contactMissing && (
                  <p id="acm-contact-error" className="mt-1 text-xs text-danger-600">Add an email or a phone number.</p>
                )}
              </div>
            );
          })}
          <div>
            <label htmlFor="acm-source" className="zh-label">Source</label>
            <select
              id="acm-source"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="zh-input"
            >
              {Object.entries(sourceLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
