import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { ApiError } from "../lib/api";

export interface EmailToast {
  message: string;
  type: "success" | "error";
  /** When true the toast renders a "Connect email →" link to /settings/email */
  showConfigLink?: boolean;
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
    async (to: string, options: SendEmailOptions = {}) => {
      if (!to) {
        showToast({ message: "No email address available for this contact.", type: "error" });
        return;
      }

      setSending(true);
      try {
        await api.post("/email/send-single", {
          to,
          firstName: options.firstName,
          subject: options.subject ?? "Exciting Opportunity from ZorHire",
          body: options.body,
        });
        showToast({ message: `Email sent to ${to}`, type: "success" });
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
          return;
        }

        if (code === "SMTP_AUTH_FAILED" || code === "EMAIL_DECRYPT_FAILED") {
          showToast({
            message: serverMsg ?? "Invalid email credentials. Please reconnect your email.",
            type: "error",
            showConfigLink: true,
          });
          return;
        }

        if (code === "SMTP_NOT_ENABLED") {
          showToast({
            message: serverMsg ?? "SMTP access is disabled on your Zoho account. Enable it in Zoho Mail → Settings → Security.",
            type: "error",
            showConfigLink: true,
          });
          return;
        }

        if (code === "SMTP_LIMIT_REACHED") {
          showToast({
            message: "Email sending limit reached. Please try again later.",
            type: "error",
          });
          return;
        }

        showToast({
          message: serverMsg ?? "Failed to send email. Please try again.",
          type: "error",
        });
      } finally {
        setSending(false);
      }
    },
    [navigate],
  );

  return { sendEmail, sending, emailToast };
}
