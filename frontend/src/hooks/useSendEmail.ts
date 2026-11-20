import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { ApiError } from "../lib/api";

export interface EmailToast {
  message: string;
  type: "success" | "error";
  /** When true the toast renders a "Connect email →" link to /settings/email */
  showConfigLink?: boolean;
}

/** Outcome of a send attempt. Callers that ignore the return value keep working as before. */
export interface SendEmailResult {
  ok: boolean;
  message: string;
  /** True when the user was redirected to email settings (email not configured). */
  redirected?: boolean;
}

export interface SendEmailOptions {
  subject?: string;
  body?: string;
  firstName?: string;
}

export function useSendEmail() {
  const [sending, setSending] = useState(false);
  const [emailToast, setEmailToast] = useState<EmailToast | null>(null);
  const navigate = useNavigate();

  const showToast = (toast: EmailToast) => {
    setEmailToast(toast);
    setTimeout(() => setEmailToast(null), 4500);
  };

  const sendEmail = useCallback(
    async (to: string, options: SendEmailOptions = {}): Promise<SendEmailResult> => {
      if (!to) {
        const message = "No email address available for this contact.";
        showToast({ message, type: "error" });
        return { ok: false, message };
      }

      setSending(true);
      try {
        await api.post("/email/send-single", {
          to,
          firstName: options.firstName,
          subject: options.subject ?? "Exciting Opportunity from ZorHire",
          body: options.body,
        });
        const message = `Email sent to ${to}`;
        showToast({ message, type: "success" });
        return { ok: true, message };
      } catch (err: any) {
        // ApiError carries the full response body including `code`
        const code =
          err instanceof ApiError ? (err.data?.code as string | undefined) : undefined;
        const serverMsg =
          err instanceof ApiError
            ? (err.data?.message as string | undefined)
            : (err?.message as string | undefined);

        if (code === "EMAIL_NOT_CONFIGURED") {
          // Hard-redirect to setup page; returnTo brings the user back after connecting
          navigate(
            `/settings/email?returnTo=${encodeURIComponent(window.location.pathname)}`,
          );
          return { ok: false, message: "Email is not configured. Connect your email to send.", redirected: true };
        }

        if (code === "SMTP_AUTH_FAILED" || code === "EMAIL_DECRYPT_FAILED") {
          const message = serverMsg ?? "Invalid email credentials. Please reconnect your email.";
          showToast({ message, type: "error", showConfigLink: true });
          return { ok: false, message };
        }

        if (code === "SMTP_NOT_ENABLED") {
          const message = serverMsg ?? "SMTP access is disabled on your Zoho account. Enable it in Zoho Mail → Settings → Security.";
          showToast({ message, type: "error", showConfigLink: true });
          return { ok: false, message };
        }

        if (code === "SMTP_LIMIT_REACHED") {
          const message = "Email sending limit reached. Please try again later.";
          showToast({ message, type: "error" });
          return { ok: false, message };
        }

        const message = serverMsg ?? "Failed to send email. Please try again.";
        showToast({ message, type: "error" });
        return { ok: false, message };
      } finally {
        setSending(false);
      }
    },
    [navigate],
  );

  return { sendEmail, sending, emailToast };
}
