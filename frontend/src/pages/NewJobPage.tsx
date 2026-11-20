import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";
import { isLowConfidence, confidenceInputClass, ConfidenceBadge } from "../lib/confidenceIndicator";
import { useGetClientsQuery, useParseJdMutation, useCreateJobMutation } from "../store/api/jobApi";
import { useNotify } from "../hooks/useNotify";
import { getErrorMessage } from "../lib/format";
import { Button, PageHeader, Spinner } from "../components/ui";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "closed_filled", label: "Closed Filled" },
  { value: "closed_cancelled", label: "Closed Cancelled" },
];

/** Only add the low-confidence highlight; zh-input supplies the normal border. */
const flagClass = (flagged: boolean) => (flagged ? confidenceInputClass(true) : "");

function Field({ id, label, flagged, error, children, className = "" }: {
  id: string; label: string; flagged?: boolean; error?: string | null; children: ReactNode; className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="zh-label">
        {label}
        {flagged && <span className={ConfidenceBadge}>needs review</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1 text-xs text-danger-600">{error}</p>}
    </div>
  );
}

export default function NewJobPage() {
  const navigate = useNavigate();
  const { data: clients = [] } = useGetClientsQuery();
  const [parseJd, { isLoading: jdParsing }] = useParseJdMutation();
  const [createJob, { isLoading: creating }] = useCreateJobMutation();
  const notify = useNotify();
  const [jdParseMessage, setJdParseMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    location: "",
    status: "draft",
    priority: "medium",
    department: "",
    work_mode: "onsite",
    employment_type: "full_time",
    experience_min: 0,
    experience_max: 3,
    salary_min: 0,
    salary_max: 0,
    headcount: 1,
    description: "",
    mandatory_skills: "",
    preferred_skills: "",
  });

  const handleJDUpload = async (file: File) => {
    setJdParseMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const parsed = await parseJd(body).unwrap();
      setFormData((current) => ({
        ...current,
        title: (parsed.title as string) || current.title,
        location: (parsed.location as string) || current.location,
        department: parsed.department || current.department,
        work_mode: parsed.work_mode || current.work_mode,
        experience_min:
          parsed.experience_min !== undefined
            ? (parsed.experience_min as number)
            : current.experience_min,
        experience_max:
          parsed.experience_max !== undefined
            ? (parsed.experience_max as number)
            : current.experience_max,
        salary_min:
          parsed.salary_min !== undefined
            ? (parsed.salary_min as number)
            : current.salary_min,
        salary_max:
          parsed.salary_max !== undefined
            ? (parsed.salary_max as number)
            : current.salary_max,
        mandatory_skills:
          parsed.mandatory_skills && parsed.mandatory_skills.length > 0
            ? parsed.mandatory_skills.join(", ")
            : Array.isArray(parsed.required_skills) && (parsed.required_skills as string[]).length > 0
              ? (parsed.required_skills as string[]).join(", ")
              : current.mandatory_skills,
        preferred_skills:
          parsed.preferred_skills && parsed.preferred_skills.length > 0
            ? parsed.preferred_skills.join(", ")
            : current.preferred_skills,
        description: (parsed.description as string) || current.description,
      }));
      setLowConfidenceFields(parsed.low_confidence_fields || []);

      setJdParseMessage({
        type: "success",
        text: "JD parsed successfully. Review fields and edit as needed.",
      });
    } catch (error) {
      console.error("JD parse failed:", error);
      setJdParseMessage({ type: "error", text: "Could not extract data, please fill manually." });
    }
  };

  const expError =
    formData.experience_min > formData.experience_max
      ? "Minimum experience cannot be greater than maximum."
      : null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    if (expError) { notify.warning(expError); return; }
    try {
      await createJob({
        ...formData,
        mandatory_skills: formData.mandatory_skills
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== ""),
        preferred_skills: formData.preferred_skills
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== ""),
      }).unwrap();
      notify.success("Job created");
      navigate("/jobs");
    } catch (error) {
      notify.error(getErrorMessage(error, "Unable to create job. Please verify all fields and try again."));
    }
  };

  const titleFlagged = isLowConfidence(lowConfidenceFields, "title");
  const locationFlagged = isLowConfidence(lowConfidenceFields, "location");
  const departmentFlagged = isLowConfidence(lowConfidenceFields, "department");
  const workModeFlagged = isLowConfidence(lowConfidenceFields, "work_mode");
  const mandatorySkillsFlagged = isLowConfidence(lowConfidenceFields, "mandatory_skills", "required_skills");
  const preferredSkillsFlagged = isLowConfidence(lowConfidenceFields, "preferred_skills");

  return (
    <>
      <PageHeader
        title="Create job description"
        subtitle="Build a new JD and assign it to your hiring pipeline"
        breadcrumbs={[{ label: "Jobs", to: "/jobs" }, { label: "New job" }]}
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <form onSubmit={handleSubmit} className="zh-card mx-auto max-w-4xl">
          <div className="space-y-6 p-5 sm:p-6">
            {/* JD Upload → Auto-fill */}
            <div className="rounded-xl border border-dashed border-navy-200 bg-navy-50/50 p-4">
              <p className="zh-label">Upload a JD to auto-fill (PDF / DOCX / TXT)</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label
                  htmlFor="new-job-file"
                  className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-surface ${jdParsing ? "pointer-events-none opacity-60" : ""}`}
                >
                  {jdParsing ? <Spinner size={16} tone="dark" /> : <Upload size={16} />}
                  {jdParsing ? "Parsing…" : "Choose file"}
                </label>
                <input
                  id="new-job-file"
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="sr-only"
                  disabled={jdParsing}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleJDUpload(file);
                  }}
                />
                {jdParseMessage && (
                  <span
                    role={jdParseMessage.type === "error" ? "alert" : "status"}
                    className={`flex items-center gap-1.5 text-xs font-medium ${
                      jdParseMessage.type === "success" ? "text-success-700" : "text-danger-600"
                    }`}
                  >
                    {jdParseMessage.type === "success" ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {jdParseMessage.text}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="new-job-title" label="Job title" flagged={titleFlagged}>
                <input
                  id="new-job-title"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`zh-input ${flagClass(titleFlagged)}`}
                  placeholder="Senior Product Designer"
                />
              </Field>
              <Field id="new-job-client" label="Client">
                <select
                  id="new-job-client"
                  required
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  className="zh-input"
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="new-job-location" label="Location" flagged={locationFlagged}>
                <input
                  id="new-job-location"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className={`zh-input ${flagClass(locationFlagged)}`}
                  placeholder="Bangalore"
                />
              </Field>
              <Field id="new-job-status" label="Status">
                <select
                  id="new-job-status"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="zh-input"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id="new-job-department" label="Department" flagged={departmentFlagged}>
                <input
                  id="new-job-department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className={`zh-input ${flagClass(departmentFlagged)}`}
                  placeholder="Engineering"
                />
              </Field>
              <Field id="new-job-work-mode" label="Work mode" flagged={workModeFlagged}>
                <select
                  id="new-job-work-mode"
                  value={formData.work_mode}
                  onChange={(e) => setFormData({ ...formData, work_mode: e.target.value })}
                  className={`zh-input ${flagClass(workModeFlagged)}`}
                >
                  <option value="onsite">Onsite</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="remote">Remote</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field id="new-job-priority" label="Priority">
                <select
                  id="new-job-priority"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="zh-input"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
              <Field id="new-job-exp-min" label="Experience min (yrs)">
                <input
                  id="new-job-exp-min"
                  type="number"
                  min={0}
                  value={formData.experience_min}
                  onChange={(e) => setFormData({ ...formData, experience_min: Number(e.target.value) })}
                  className="zh-input"
                />
              </Field>
              <Field id="new-job-exp-max" label="Experience max (yrs)" error={expError}>
                <input
                  id="new-job-exp-max"
                  type="number"
                  min={0}
                  value={formData.experience_max}
                  onChange={(e) => setFormData({ ...formData, experience_max: Number(e.target.value) })}
                  aria-invalid={!!expError}
                  aria-describedby={expError ? "new-job-exp-max-error" : undefined}
                  className="zh-input"
                />
              </Field>
              <Field id="new-job-budget-min" label="Budget min (₹)">
                <input
                  id="new-job-budget-min"
                  type="number"
                  min={0}
                  value={formData.salary_min}
                  onChange={(e) => setFormData({ ...formData, salary_min: Number(e.target.value) })}
                  className="zh-input"
                  placeholder="0"
                />
              </Field>
              <Field id="new-job-budget-max" label="Budget max (₹)">
                <input
                  id="new-job-budget-max"
                  type="number"
                  min={0}
                  value={formData.salary_max}
                  onChange={(e) => setFormData({ ...formData, salary_max: Number(e.target.value) })}
                  className="zh-input"
                  placeholder="0"
                />
              </Field>
              <Field id="new-job-headcount" label="Headcount">
                <input
                  id="new-job-headcount"
                  type="number"
                  min={1}
                  value={formData.headcount}
                  onChange={(e) => setFormData({ ...formData, headcount: Number(e.target.value) })}
                  className="zh-input"
                />
              </Field>
            </div>

            <Field id="new-job-mandatory" label="Primary skills (comma-separated)" flagged={mandatorySkillsFlagged}>
              <input
                id="new-job-mandatory"
                value={formData.mandatory_skills}
                onChange={(e) => setFormData({ ...formData, mandatory_skills: e.target.value })}
                className={`zh-input ${flagClass(mandatorySkillsFlagged)}`}
                placeholder="React, Node.js, Product Management"
              />
            </Field>

            <Field id="new-job-preferred" label="Preferred skills (comma-separated)" flagged={preferredSkillsFlagged}>
              <input
                id="new-job-preferred"
                value={formData.preferred_skills}
                onChange={(e) => setFormData({ ...formData, preferred_skills: e.target.value })}
                className={`zh-input ${flagClass(preferredSkillsFlagged)}`}
                placeholder="GraphQL, Kubernetes (good to have)"
              />
            </Field>

            <Field id="new-job-description" label="Description">
              <textarea
                id="new-job-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                className="zh-input"
                placeholder="Provide core JD, responsibilities and must-have skills."
              />
            </Field>
          </div>

          <div className="flex flex-col-reverse gap-2 rounded-b-xl border-t border-line bg-surface px-5 py-3 sm:flex-row sm:justify-end sm:px-6">
            <Button variant="secondary" onClick={() => navigate("/jobs")} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" loading={creating} loadingText="Saving…" disabled={jdParsing || !!expError}>
              {jdParsing ? "Parsing JD…" : "Create job"}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
