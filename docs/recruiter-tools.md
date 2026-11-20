# Recruiter time-savers

Three features added on 20 Nov 2026, on top of the LinkedIn agent (docs/linkedin-agent.md).

## 1. Save to ZorHire (ZorHire Assistant extension)

One click turns a profile you're looking at into a ZorHire candidate.

- **Where:** a "Save to ZorHire" button appears on LinkedIn profiles (`linkedin.com/in/…`) and
  Naukri recruiter pages (`resdex.naukri.com`, `recruit.naukri.com`). On any other site (Indeed,
  foundit, GitHub, company pages…) click the extension icon → **Save this page to ZorHire**.
- **What happens:** the extension sends the page's visible text to ZorHire, which reads it with
  the resume parser (Gemini; rule-based fallback). LinkedIn's headline ("Title at Company") wins
  over the parser for title and company. You check and edit the fields, optionally pick a job,
  attach a resume file (or tick "fetch the resume linked on this page"), and save.
- **Duplicates / ownership:** before saving it shows anyone already in ZorHire with the same
  profile link, email, phone (last 10 digits) or name+company, who added them, when, and which
  pipelines they're in. Same link/email/phone blocks a second record unless you choose "Save as
  a new candidate anyway"; "Add new details to this candidate" fills only empty fields.
- **Added to a job:** joins the pipeline as **Sourced** with a note.
- It never clicks "view phone/email" on Naukri (that uses paid credits) and only downloads a
  resume when you tick the box.
- API: `GET /v1/extension/jobs`, `POST /v1/extension/capture/preview`, `POST /v1/extension/capture/save`,
  `POST /v1/extension/candidates/:id/resume`. Resume files use the same storage as the Add
  candidate form on this branch (server disk); when merged with main they must move to R2 with it.

## 2. Client submission pack

On any pipeline card: **Client profile** → `/submission/:applicationId`.

- **Create with AI** (Claude, agent `submission_writer`, $40/month cap): reads the resume
  against the job and writes a headline, "why this candidate" bullets, a skills-vs-job table
  (strong / some / not shown, with evidence), recent experience, education, certifications and a
  short recruiter's note. It's told never to invent facts or include contact details or personal
  attributes, and a scrubber removes any email/phone/URL that slips through.
  Without Claude it drafts from the candidate record.
- **Edit** every section; **Hide candidate's email and phone** (on by default) and **Show CTC**.
- **Print / PDF:** a clean A4 page (ZorTech logo on the platform-owner company).
- **Email to client:** pre-filled with the client's primary contact; sent from your own mailbox
  (or the company mailbox); the profile is in the email body; attaching the original resume is
  opt-in with a warning that it usually contains contact details. Moves the candidate to
  **Submitted to client** (logged in the pipeline history) unless you untick it.
- Table `submission_packs` (migration 023). API under `/v1/submissions/applications/:id`.

## 3. WhatsApp from each recruiter's own number

**Settings → WhatsApp → My WhatsApp number**: each recruiter enters the number they want to use.

| Mode | Setup | How it works |
|---|---|---|
| **Click to send** (default) | None. Any WhatsApp or WhatsApp Business number | ZorHire writes the message and opens WhatsApp (`wa.me` link → phone app or WhatsApp Web, signed in with that number). You press Send, then "I sent it". Replies stay in WhatsApp. |
| **Automatic** | Company connects WhatsApp Business Platform once; the recruiter's number is added to that account in Meta's WhatsApp Manager | Sends straight from ZorHire. Replies, delivered/read ticks come back via webhook and show on the candidate. |

- **Candidate window → WhatsApp tab:** conversation, quick messages (Interested? / Share CV /
  Interview reminder / Still interested?), composer.
- **Automatic-mode rules (WhatsApp's, not ours):** a free-form message is only allowed within 24
  hours of the candidate's last message. Otherwise ZorHire sends the company's approved template
  (Settings → WhatsApp → template name), whose body must have `{{1}}` = first name and `{{2}}` =
  your message, e.g. "Hi {{1}}, {{2}}". Meta charges per conversation.
- **Company setup (admins):** WhatsApp Business Account ID, a permanent System User access token
  (`whatsapp_business_messaging`), the app secret, and the template. ZorHire checks them with Meta,
  lists the numbers on the account, and shows the webhook URL + verify token to paste into the
  Meta app (subscribe to "messages"). Tokens are encrypted (AES-256-GCM, same key as mailboxes).
- **Webhook:** `GET/POST /v1/whatsapp/webhook`, raw body, `X-Hub-Signature-256` checked against
  the owning company's app secret; replies matched to candidates by the last 10 phone digits.
- Tables `tenant_whatsapp_config`, `user_whatsapp`, `whatsapp_messages` (migration 024).
- Not done yet: the AI agents (screening invite, interview booking link) still use email only;
  wiring them to WhatsApp in automatic mode is a follow-up.

## Tested

105 API checks on Postgres 17 across the LinkedIn agent, job boards, capture, submission packs
and WhatsApp (including webhook signatures, duplicate detection and tenant isolation), a
frontend production build, and the new screens in the browser. Not tested against live
LinkedIn/Naukri pages, Claude, Meta's API or a real mailbox.
