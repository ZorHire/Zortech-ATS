import { useState } from "react";
import { Mail } from "lucide-react";
import { useSendEmail } from "../../hooks/useSendEmail";
import { useNotify } from "../../hooks/useNotify";
import { Button, Modal } from "../ui";

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
  const notify = useNotify();

  const applyTemplate = (idx: number) => {
    const t = TEMPLATES[idx];
    setSubject(t.subject(positionHint));
    setBody(t.body(firstName, positionHint));
    setActiveTemplate(idx);
  };

  const handleSend = async () => {
    if (!subject.trim() || !body.trim() || sending) return;
    const result = await sendEmail(to, { subject, body, firstName });
    if (result.ok) {
      notify.success(result.message);
      onSent?.();
      onClose();
      return;
    }
    // Keep the modal open with the draft intact so the user can retry.
    if (result.redirected) {
      notify.warning(result.message);
      onClose();
      return;
    }
    notify.error(result.message);
  };

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && !sending;

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      preventClose={sending}
      title="Compose email"
      description={`To ${toName} · ${to}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={!canSend && !sending} loading={sending} loadingText="Sending…" icon={<Mail size={15} />}>
            Send email
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Quick templates */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted">Quick templates</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.label}
                type="button"
                onClick={() => applyTemplate(i)}
                aria-pressed={activeTemplate === i}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTemplate === i
                    ? "border-navy-600 bg-navy-600 text-white"
                    : "border-line bg-white text-ink-soft hover:border-navy-300 hover:text-navy-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="compose-subject" className="zh-label">Subject</label>
          <input
            id="compose-subject"
            type="text"
            value={subject}
            onChange={(e) => { setSubject(e.target.value); setActiveTemplate(null); }}
            placeholder="Enter email subject…"
            className="zh-input"
          />
        </div>

        <div>
          <label htmlFor="compose-body" className="zh-label">Message</label>
          <textarea
            id="compose-body"
            value={body}
            onChange={(e) => { setBody(e.target.value); setActiveTemplate(null); }}
            placeholder="Write your message here…"
            rows={10}
            className="zh-input resize-none leading-relaxed"
          />
        </div>
      </div>
    </Modal>
  );
}
