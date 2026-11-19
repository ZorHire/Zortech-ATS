import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useSubmitCandidateMutation } from "../../store/api/vendorPortalApi";
import { Button, Modal } from "../ui";

interface Props {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}

const FORM_ID = "vendor-submit-candidate";

export default function VendorSubmitModal({ jobId, jobTitle, onClose }: Props) {
  const [submitCandidate, { isLoading }] = useSubmitCandidateMutation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    candidate_full_name: "",
    candidate_email: "",
    candidate_phone: "",
    experience_years: "",
    skills: "",
    cover_note: "",
  });

  const set = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const skills = form.skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await submitCandidate({
        job_id: jobId,
        candidate_full_name: form.candidate_full_name.trim(),
        candidate_email: form.candidate_email.trim(),
        candidate_phone: form.candidate_phone.trim() || undefined,
        experience_years: form.experience_years ? parseFloat(form.experience_years) : undefined,
        skills: skills.length ? skills : undefined,
        cover_note: form.cover_note.trim() || undefined,
      }).unwrap();

      setSuccess(true);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { message?: string } })?.data?.message ??
        "Failed to submit candidate.";
      setError(msg);
    }
  };

  if (success) {
    return (
      <Modal open onClose={onClose} size="sm" hideHeader closeOnBackdrop footer={<Button onClick={onClose} fullWidth>Done</Button>}>
        <div className="py-2 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-600">
            <CheckCircle2 size={24} aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-ink">Candidate submitted</h2>
          <p className="mt-1 text-sm text-muted">
            Submitted for <span className="font-medium text-ink">{jobTitle}</span>. Track status in My submissions.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Submit candidate"
      description={jobTitle}
      preventClose={isLoading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} loading={isLoading} loadingText="Submitting…">
            Submit candidate
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg border border-danger-600/20 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="vs-name" className="zh-label">
              Full name <span className="text-danger-600">*</span>
            </label>
            <input
              id="vs-name"
              type="text"
              required
              value={form.candidate_full_name}
              onChange={set("candidate_full_name")}
              placeholder="e.g. Priya Sharma"
              className="zh-input"
            />
          </div>

          <div>
            <label htmlFor="vs-email" className="zh-label">
              Email <span className="text-danger-600">*</span>
            </label>
            <input
              id="vs-email"
              type="email"
              required
              value={form.candidate_email}
              onChange={set("candidate_email")}
              placeholder="priya@example.com"
              className="zh-input"
            />
          </div>

          <div>
            <label htmlFor="vs-phone" className="zh-label">Phone</label>
            <input
              id="vs-phone"
              type="tel"
              value={form.candidate_phone}
              onChange={set("candidate_phone")}
              placeholder="+91 98765 43210"
              className="zh-input"
            />
          </div>

          <div>
            <label htmlFor="vs-exp" className="zh-label">Experience (years)</label>
            <input
              id="vs-exp"
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={form.experience_years}
              onChange={set("experience_years")}
              placeholder="5"
              className="zh-input"
            />
          </div>

          <div>
            <label htmlFor="vs-skills" className="zh-label">
              Skills <span className="font-normal text-muted">(comma-separated)</span>
            </label>
            <input
              id="vs-skills"
              type="text"
              value={form.skills}
              onChange={set("skills")}
              placeholder="React, Node.js, PostgreSQL"
              className="zh-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="vs-note" className="zh-label">Cover note</label>
          <textarea
            id="vs-note"
            rows={3}
            value={form.cover_note}
            onChange={set("cover_note")}
            placeholder="Why is this candidate a strong fit for this role?"
            className="zh-input resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
