import { useState } from "react";
import { X, Mail, Loader2 } from "lucide-react";
import { useSendEmail } from "../../hooks/useSendEmail";

interface Props {
  to: string;
  toName: string;
  /** Optional role/position name for template placeholders */
  positionHint?: string;
  onClose: () => void;
  onSent?: () => void;
}

interface Template {
  label: string;
  subject: (pos: string) => string;
  body: (name: string, pos: string) => string;
}

const TEMPLATES: Template[] = [
  {
    label: "Shortlisted",
    subject: (pos) => `You've been shortlisted — ${pos}`,
    body: (name, pos) =>
      `Hi ${name},\n\nThank you for your interest in the ${pos} role.\n\nWe are pleased to inform you that your profile has been shortlisted. We were impressed with your experience and believe you could be a great fit for our team.\n\nWe will be in touch shortly to schedule the next steps. Please feel free to reply to this email if you have any questions.\n\nBest regards,\nRecruitment Team`,
  },
  {
    label: "Interview Invite",
    subject: (pos) => `Interview Invitation — ${pos}`,
    body: (name, pos) =>
      `Hi ${name},\n\nWe are excited to invite you for an interview for the ${pos} position.\n\nCould you please share your availability for the next few days so we can schedule a convenient time? The interview will be conducted via video call and should last approximately 45–60 minutes.\n\nWe look forward to speaking with you!\n\nBest regards,\nRecruitment Team`,
  },
  {
    label: "Not Selected",
    subject: (pos) => `Update on your application — ${pos}`,
    body: (name, pos) =>
      `Hi ${name},\n\nThank you for your time and interest in the ${pos} role at our organization.\n\nAfter careful consideration, we have decided to move forward with another candidate whose experience more closely matches our current requirements. This was a difficult decision as we received many strong applications.\n\nWe appreciate your effort and wish you the very best in your career journey. We will keep your profile on record for future opportunities.\n\nKind regards,\nRecruitment Team`,
  },
  {
    label: "Follow-up",
    subject: () => "Following up on your application",
    body: (name) =>
      `Hi ${name},\n\nI hope you are doing well! I wanted to follow up regarding your recent application and check if you are still interested in exploring this opportunity.\n\nPlease feel free to reply to this email or let us know a good time to connect for a quick conversation.\n\nLooking forward to hearing from you!\n\nBest regards,\nRecruitment Team`,
  },
];

export default function ComposeEmailModal({ to, toName, positionHint = "the position", onClose, onSent }: Props) {
  const firstName = toName.split(" ")[0] || toName;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [activeTemplate, setActiveTemplate] = useState<number | null>(null);
  const { sendEmail, sending } = useSendEmail();

  const applyTemplate = (idx: number) => {
    const t = TEMPLATES[idx];
    setSubject(t.subject(positionHint));
    setBody(t.body(firstName, positionHint));
    setActiveTemplate(idx);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    await sendEmail(to, { subject, body, firstName });
    onSent?.();
    onClose();
  };

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in slide-in-from-bottom-4 duration-200">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Mail size={18} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">Compose Email</h2>
              <p className="text-xs text-gray-400 mt-0.5">to {toName} · {to}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {/* Quick templates */}
        <div className="px-6 pt-4 pb-2 flex-shrink-0">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick templates</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(i)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  activeTemplate === i
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fields */}
        <div className="px-6 pb-2 flex-1 overflow-y-auto space-y-4 pt-3">
          {/* Subject */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setActiveTemplate(null); }}
              placeholder="Enter email subject..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Message</label>
            <textarea
              value={body}
              onChange={(e) => { setBody(e.target.value); setActiveTemplate(null); }}
              placeholder="Write your message here..."
              rows={10}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 bg-gray-50 text-gray-700 font-black text-sm rounded-[16px] border border-gray-200 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="flex-[2] py-3 bg-blue-600 text-white font-black text-sm rounded-[16px] hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail size={15} />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
