# ZorHire — ATS Platform

A comprehensive, enterprise-grade Applicant Tracking System built for staffing agencies and HR departments. ZorHire features **multi-tenancy**, **role-based access control (RBAC)**, an **invite-only user system**, **AI-assisted document parsing** for resumes, job descriptions, and vendor profiles, and a **per-user SMTP email system** with AES-256-GCM encrypted credentials.

---

## Project Overview

ZorHire centralizes recruitment operations in a secure, modular environment — covering the full lifecycle from job intake to candidate placement.

### Core Features

- **Invite-Only Access** — Public registration is disabled. Users are invited and managed by an Administrator only.
- **Forced Password Update** — New users receive a temporary password and must change it on first login.
- **Role-Based Access Control** — Granular permissions across all API endpoints: Super Admin, ATS Admin, Vendor Manager, Recruiter, Sourcing Specialist.
- **Multi-Tenant Isolation** — All data is scoped per organization; tenants never access each other's records.
- **Candidate Management** — Full candidate profiles with professional history, skills, resume upload, inline resume preview, and an immutable activity timeline. Candidates can be deleted directly from the card view.
- **Job Lifecycle** — End-to-end job management: JD intake, skill matching, recruiter assignment, and stage tracking. Jobs can be deleted directly from the card view.
- **Pipeline View** — Kanban-style pipeline board for visualizing and updating candidate stages across jobs. Supports 11 forward stages: `new → sourced → screened → shortlisted → submitted_to_client → client_interview_scheduled → interview_completed → selected → offer_extended → offer_accepted → joined`, plus `disqualified`.
- **Application Status Actions** — From the Candidate modal, recruiters can:
  - **Move to Next Stage** — advances the candidate's pipeline stage in one click via the live API.
  - **Send Individual Email** — sends a personalized shortlisting email from the recruiter's own SMTP account.
  - **Schedule Interview** — collects date, time, and interview type (video / phone / in-person) and dispatches a formatted interview invite email.
- **Client Management** — Create detailed client profiles (contact info, billing model, SLA, contract dates, stakeholders, tags) and view them as cards on the Jobs page. Clicking a card opens a full read-only detail view. Clients can be deleted directly from the card.
- **Vendor Management** — Manage staffing vendors with profile parsing and skill indexing. Vendors can be deleted individually from the card or in bulk via the selection action bar.
- **Document Parsing** — Upload resumes, job descriptions, or vendor profiles (PDF, DOCX, DOC, TXT) and auto-populate structured fields. Uses **Gemini AI** (`gemini-2.5-flash-lite`) for cloud-based intelligent parsing with a **local rule-based fallback** (pdf-parse / mammoth + section-map architecture).
- **Per-User SMTP Email System** — Each user configures their own outbound email credentials (host, port, username, password). Passwords are stored encrypted with **AES-256-GCM**. Emails are sent from the individual user's address, not a shared server account.
- **Bulk Email Campaigns** — Target candidates by stage or skill with templated bulk email blasts.
- **Analytics** — Recruitment metrics and reporting dashboard.
- **Resume Search** — Cross-candidate skill and keyword search.
- **Admin Dashboard** — User invitations, role assignment, and account management.

---

## Tech Stack

### Frontend

- **React 18** + **TypeScript**
- **Vite** — optimized dev server and production builds
- **Tailwind CSS** — utility-first responsive UI
- **Lucide React** — icon library
- **React Router v6** — client-side routing

### Backend

- **Node.js 20** + **Express 5**
- **PostgreSQL** (NeonDB) — relational data store via `pg`
- **Firebase Functions v7** + **Firebase Admin** — Cloud Run deployment
- **JWT** — stateless session management
- **bcryptjs** — password hashing
- **Nodemailer** — transactional email via configurable SMTP
- **Gemini AI** (`gemini-2.5-flash-lite`) — cloud-based AI document parsing (resumes, JDs, vendor profiles)
- **pdf-parse v1** — local PDF text extraction (fallback)
- **mammoth** — local DOCX/DOC text extraction (fallback)
- **busboy** — multipart file upload handling (Cloud Run compatible; replaces multer)

### Infrastructure

- **Firebase Hosting** — serves the Vite SPA (`frontend/dist`)
- **Firebase Cloud Run** — hosts the Express API (`backend/`)
- **NeonDB** — serverless PostgreSQL

---

## Project Structure

```
zortech-hosting/
├── .env                        # Unified environment config (not committed)
├── firebase.json               # Firebase Hosting + Functions config
├── errors.md                   # Local error log (not committed)
│
├── frontend/                   # Vite + React SPA
│   ├── public/
│   │   └── favicon.png         # App logo / favicon
│   └── src/
│       ├── components/
│       │   ├── candidates/
│       │   │   └── CandidateModal.tsx      # Full candidate detail + pipeline actions
│       │   ├── clients/
│       │   │   ├── ClientInfoModal.tsx     # Create/edit client form
│       │   │   └── ClientDetailModal.tsx   # Read-only client detail view
│       │   ├── layout/
│       │   │   └── Sidebar.tsx             # Navigation sidebar with logo
│       │   └── pipeline/
│       │       └── PipelineJobSelector.tsx # Job selector for pipeline board
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── CandidatesPage.tsx
│       │   ├── JobsPage.tsx                # Jobs grid + client cards section
│       │   ├── JobDetailPage.tsx
│       │   ├── NewJobPage.tsx
│       │   ├── PipelinePage.tsx
│       │   ├── VendorsPage.tsx
│       │   ├── AnalyticsPage.tsx
│       │   ├── ResumeSearchPage.tsx
│       │   ├── EmailSettingsPage.tsx
│       │   ├── AdminPage.tsx
│       │   ├── LoginPage.tsx
│       │   └── ChangePasswordPage.tsx
│       └── contexts/
│           └── AuthContext.tsx
│
├── backend/                    # Express API (Node.js)
│   └── src/
│       ├── index.ts            # Entry point — mounts Express app
│       ├── db.ts               # PostgreSQL pool (NeonDB)
│       ├── middleware/
│       │   ├── auth.ts         # JWT auth + tenant isolation
│       │   └── parseFileUpload.ts  # busboy-based multipart handler
│       └── modules/
│           ├── admin/          # User invitations & management
│           ├── auth/           # Login, password change
│           ├── candidates/     # Candidate CRUD & activity log
│           ├── clients/        # Client CRUD (extended profile fields)
│           ├── email/          # Per-user SMTP config + send-single + bulk campaigns
│           ├── jobs/           # Job lifecycle management
│           ├── parse/
│           │   ├── parse.controller.ts  # Resume / JD / Vendor parse endpoints
│           │   └── parse.utils.ts       # Text extraction & field parsing logic
│           ├── pipeline/       # Pipeline stage management & history
│           └── vendors/        # Vendor management
│
└── functions/                  # Firebase Cloud Functions wrapper
    └── src/
        └── index.ts            # Proxies to backend Express app
```

---

## Environment Variables

All configuration lives in a single `.env` at the project root.

| Variable               | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `SERVER_PORT`          | Local Express server port                                     |
| `SERVER_DATABASE_URL`  | PostgreSQL connection string                                  |
| `SERVER_JWT_SECRET`    | JWT signing secret                                            |
| `SERVER_NODE_ENV`      | `development` or `production`                                 |
| `VITE_API_URL`         | Frontend API base URL                                         |
| `SERVER_SMTP_HOST`     | Default SMTP host (used as fallback if user has no config)    |
| `SERVER_SMTP_PORT`     | Default SMTP port                                             |
| `SERVER_SMTP_SECURE`   | TLS flag (`true`/`false`)                                     |
| `EMAIL_ENCRYPTION_KEY` | AES-256-GCM key for encrypting per-user SMTP passwords in DB  |

> **Note:** Individual user SMTP credentials (username, password, from-address) are stored per-user in the database, encrypted with `EMAIL_ENCRYPTION_KEY`. There is no shared `SERVER_SMTP_USER` / `SERVER_SMTP_PASS` — each user sends email from their own account.

---

## Email System

ZorHire uses a **per-user SMTP model**:

1. Each user configures their own SMTP credentials via **Email Settings**.
2. The password is encrypted with **AES-256-GCM** before being stored in the database.
3. When sending an email (shortlisting, interview invite, bulk campaign), the server decrypts the user's credentials at runtime and sends via **Nodemailer**.
4. Available email actions:
   - `POST /email/config` — save/update SMTP config for current user
   - `GET /email/config` — fetch current user's SMTP config (password masked)
   - `POST /email/send-single` — send a single email to a candidate
   - `POST /email/send-bulk` — send templated bulk emails

---

## Pipeline Stages

Candidates move through a defined set of stages per job application:

| Stage                        | Label                    |
| ---------------------------- | ------------------------ |
| `new`                        | New                      |
| `sourced`                    | Sourced                  |
| `screened`                   | Screening                |
| `shortlisted`                | Shortlisted              |
| `submitted_to_client`        | Submitted to Client      |
| `client_interview_scheduled` | Interview Scheduled      |
| `interview_completed`        | Interview Completed      |
| `selected`                   | Selected                 |
| `offer_extended`             | Offer Extended           |
| `offer_accepted`             | Offer Accepted           |
| `joined`                     | Joined                   |
| `disqualified`               | Disqualified             |

Stage transitions are recorded in `pipeline_events` with the actor, timestamp, and optional note.

---

## Document Parsing

The `/v1/parse` endpoints accept multipart file uploads (PDF, DOCX, DOC, TXT, max 8 MB) and return structured JSON.

| Endpoint                | Returns                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/parse/resume` | `name`, `email`, `phone`, `skills`, `experience_years`, `current_title`, `current_company`, `current_location`, `summary`, `parsed`, `raw_text`     |
| `POST /v1/parse/jd`     | `title`, `location`, `required_skills`, `experience_min`, `experience_max`, `budget_text`, `salary_min`, `salary_max`, `description`, `parsed`      |
| `POST /v1/parse/vendor` | `company_name`, `email`, `phone`, `skills`, `location`, `summary`                                                                                   |

> `parsed: false` is returned (with `raw_text` containing the full extracted text) when key fields could not be determined, allowing the frontend to prompt the user for manual input rather than silently returning empty fields.

**Extraction pipeline:**

1. **pdf-parse v1** — PDF text extraction (local)
2. **mammoth** — DOCX / DOC extraction (local)
3. **UTF-8 buffer read** — plain TXT (local)

Extracted text is then passed to **Gemini AI** (`gemini-2.5-flash-lite`) for structured field extraction. The local rule-based parser (section-map architecture, see below) serves as the fallback when Gemini is unavailable.

**Pre-processing applied before any field parsing:**
- **Spaced-character repair** — fixes PDFs where characters are extracted individually (`"J o h n D o e"` → `"JohnDoe"`)
- **Non-ASCII strip** — removes encoding artifacts (`[^\x00-\x7F]`)
- **Whitespace normalisation** — collapses tabs, double spaces; strips noise lines (< 2 chars)

**Parsing architecture — section-map + heuristics (no AI):**
- `buildSectionMap` walks the document once, mapping 60+ heading aliases to canonical sections (`skills`, `experience`, `summary`, etc.)
- Each field parser queries the map; no repeated full-document scans
- `parseExperienceYears` calculates from date ranges (`Jan 2019 – Present`) with overlap merging
- `parseWorkHistory` uses three patterns: inline `"at"`, pipe-separated entries, multi-line blocks

**Skills extraction — four-tier priority:**
1. Labeled skills section block
2. Proficiency phrases (`"proficient in"`, `"experience with"`, etc.)
3. Tech keyword scan — 70+ known technologies matched against full text
4. Dense-enumeration lines — any line with ≥3 delimited short tokens

Skills parsing handles multi-sub-section formats (`Languages:`, `Frameworks:`, `Tools:`, etc.) and returns a flat deduplicated list.

---

## Deployment

```bash
# Build frontend
cd frontend && npm run build

# Deploy everything (Hosting + Functions)
firebase deploy

# Deploy functions only
firebase deploy --only functions

# Deploy hosting only
firebase deploy --only hosting
```
