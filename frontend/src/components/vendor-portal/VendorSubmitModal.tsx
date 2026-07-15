import { useState } from "react";
import { useSubmitCandidateMutation } from "../../store/api/vendorPortalApi";

interface Props {
  jobId: string;
  jobTitle: string;
  onClose: () => void;
}

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md w-full mx-4 text-center">
          <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Submitted!</h3>
          <p className="text-sm text-gray-500 mb-6">
            Candidate submitted for <span className="font-medium">{jobTitle}</span>. Track status in My Submissions.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-teal-600 text-white py-2.5 rounded-lg font-medium hover:bg-teal-700 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-teal-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-white font-semibold text-lg">Submit Candidate</h2>
              <p className="text-teal-100 text-sm truncate">{jobTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-teal-200 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={form.candidate_full_name}
                onChange={set("candidate_full_name")}
                placeholder="e.g. Priya Sharma"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={form.candidate_email}
                onChange={set("candidate_email")}
                placeholder="priya@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={form.candidate_phone}
                onChange={set("candidate_phone")}
                placeholder="+91 98765 43210"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Experience (years)</label>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={form.experience_years}
                onChange={set("experience_years")}
                placeholder="5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Skills
                <span className="text-gray-400 font-normal ml-1">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={form.skills}
                onChange={set("skills")}
                placeholder="React, Node.js, PostgreSQL"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cover Note</label>
            <textarea
              rows={3}
              value={form.cover_note}
              onChange={set("cover_note")}
              placeholder="Why is this candidate a strong fit for this role?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-teal-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Submitting…" : "Submit Candidate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
