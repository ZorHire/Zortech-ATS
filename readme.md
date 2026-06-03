# ZorHire — ATS Platform

A comprehensive, enterprise-grade Applicant Tracking System built for staffing agencies and HR departments. ZorHire features **multi-tenancy**, **role-based access control (RBAC)**, an **invite-only user system**, **AI-assisted document parsing** for resumes, job descriptions, and vendor profiles, a **per-user SMTP email system** with AES-256-GCM encrypted credentials, and a **Razorpay-powered subscription billing system**.

---

## Project Overview

ZorHire centralizes recruitment operations in a secure, modular environment — covering the full lifecycle from job intake to candidate placement. The platform is designed as a **SaaS multi-tenant ATS** where a platform owner (ZorHire) onboards client companies (tenants), each of which operates in full data isolation with their own subscription, users, jobs, and candidates.

---

## Core Features

### Access & Security
- **Invite-Only Access** — Public registration is disabled. Users are invited and managed by an Administrator only.
- **Forced Password Update** — New users receive a temporary password and must change it on first login.
- **Self-Service Password Reset** — Users can reset their password directly from the login page. No admin intervention required.
- **Role-Based Access Control** — Granular permissions enforced at both route and database level across all API endpoints. Five roles: `super_admin`, `accounts_manager`, `vendor_manager`, `recruiter`, `vendor_user`.
- **Multi-Tenant Isolation** — All data is scoped per organization (`tenant_id`). Tenants never access each other's records.
- **JWT Authentication** — Stateless sessions. JWT embeds `tenant_id`, `user_id`, `role`, and `vendor_id` (for `vendor_user` accounts) for zero-overhead per-request filtering.

### Company & Subscription Management
- **Multi-Tenant Platform** — The platform owner manages all client companies from a dedicated **Companies** page (`/companies`, `super_admin` + platform-owner only). Supports bulk-delete, status toggle (active/inactive), and onboard-by tracking.
- **Company Bootstrap** — New tenants can be bootstrapped directly from the admin UI, creating their tenant record, seeding an initial `super_admin` user, and associating a subscription plan in one flow.
- **Subscription Billing** — Three-tier plan system (**Starter**, **Growth**, **Enterprise**) with monthly/yearly toggle. Payments processed via **Razorpay** (order creation → checkout → signature verification). Subscription status (`active`, `cancelled`, `expired`, `trial`) and billing cycle stored per tenant.
- **Pricing Page** — In-app pricing page (`/pricing`) with interactive plan cards, monthly/yearly toggle, Razorpay payment flow, and a trust footer (Secure Payments, Razorpay branding, Talk to Sales).
- **Subscription Page** — Shows the current plan tier, billing cycle, user seat limit, and next billing date with cancel option.
- **Onboarding Flow** — New tenants follow an onboarding wizard (`/onboarding`) to configure their workspace after subscribing.

### Recruitment Core
- **Candidate Management** — Full candidate profiles with professional history, skills, resume upload, inline PDF resume preview, download button, and an immutable activity timeline. Candidates can be deleted from the card view.
- **Job Lifecycle** — End-to-end job management: JD intake, skill matching, recruiter assignment, and stage tracking. Jobs can be deleted directly from the card view.
- **Pipeline View** — Kanban-style pipeline board for visualizing and updating candidate stages across jobs. Supports 11 forward stages: `new → sourced → screened → shortlisted → submitted_to_client → client_interview_scheduled → interview_completed → selected → offer_extended → offer_accepted → joined`, plus `disqualified`.
- **Application Status Actions** — From the Candidate modal, recruiters can:
  - **Move to Next Stage** — advances the candidate's pipeline stage in one click via the live API.
  - **Send Individual Email** — sends a personalized shortlisting email from the recruiter's own SMTP account.
  - **Schedule Interview** — collects date, time, interview type (video / phone / in-person), interviewer name, meeting link, and duration; dispatches a formatted invite email and persists the record to the database.
- **Interview Management** — Full interview lifecycle tracking within the Candidate modal Activity tab. View all scheduled/completed interviews per application, update status (Completed / Cancelled / No Show) with one click, and jump to meeting links directly. Interview count badge visible on the Activity tab.
- **Activity Timeline** — The Activity tab in the Candidate modal shows a unified view of pipeline stage transitions (with actor, timestamp, and notes) and all interviews for the selected application.
- **JD Assignments** — Dedicated page (`/assigned-jds`) for tracking job description assignments per recruiter or vendor team.

### Clients & Vendors
- **Client Management** — Create detailed client profiles (contact info, billing model, SLA, contract dates, stakeholders, tags, preferred skills, evaluation criteria, and 30+ extended fields) and view them as cards on the Jobs page. Clicking a card opens a full read-only detail view. Clients can be deleted from the card.
- **Vendor Management** — Manage staffing vendors with profile parsing and skill indexing. Vendors can be deleted individually from the card or in bulk via the selection action bar.
- **Vendor Portal (Read-Only)** — Users with the `vendor_user` role see only the Jobs page, filtered to jobs assigned to their vendor (`jobs.assigned_vendor_id`). All action buttons, status filters, and client cards are hidden. They can track the full candidate pipeline for their jobs but cannot mutate any data.

### Email System
- **Per-User SMTP** — Each user configures their own outbound email credentials (host, port, username, password). Passwords are stored encrypted with **AES-256-GCM**. Emails are sent from the individual user's address, not a shared server account.
- **Email Settings Page** — Users connect their SMTP provider (Gmail, Zoho, Outlook, custom), test the connection, and update or remove credentials. Status shown inline. Supports a `returnTo` redirect after connecting.
- **Email Campaigns** — Dedicated Campaigns page (`/campaigns`) for managing bulk outreach. Create campaigns from 4 built-in templates (Outreach, Interview Invite, Offer Update, Follow-up), save as drafts, select recipients from the full candidate list, and send. Tracks recipient count, delivered count, and status (draft / sending / sent / failed) with retry and delete support.
- **SMTP Chain** — Email resolution order: user SMTP → company SMTP → error. No platform-level credentials are hardcoded.

### Analytics & Search
- **Analytics** — Recruitment metrics and reporting dashboard with export support.
- **Resume Search** — Cross-candidate skill and keyword search with top-match scoring and extended filters.
- **Dashboard** — Stat cards, SVG charts (no Recharts), activity feed, and snapshot metrics.

### Document Parsing
- Upload resumes, job descriptions, or vendor profiles (PDF, DOCX, DOC, TXT, max 8 MB) and auto-populate structured fields.
- **AI-first**: **Gemini AI** (`gemini-2.5-flash-lite`) performs structured field extraction.
- **Local fallback**: pdf-parse + mammoth + section-map heuristics when Gemini is unavailable.

### Admin
- **Admin Panel** — User invitations, role assignment, and account management. When creating a `vendor_user`, admins select the linked vendor company from a dropdown — the association is stored in `profiles.vendor_id` and embedded in the JWT.

---

## Tech Stack

### Frontend

| Technology | Version | Role |
|---|---|---|
| **React** | 18 | UI framework |
| **TypeScript** | 5 | Type safety |
| **Vite** | 5 | Dev server & production build |
| **Tailwind CSS** | 3 | Utility-first responsive UI |
| **React Router** | v7 | Client-side routing |
| **Zustand** | — | Global state management |
| **Lucide React** | — | Icon library |

> No Recharts — all charts are pure SVG/CSS for zero-dependency rendering.

### Backend

| Technology | Version | Role |
|---|---|---|
| **Node.js** | 20 | Runtime |
| **Express** | 5 | HTTP framework |
| **PostgreSQL** (NeonDB) | — | Relational data store via `pg` |
| **Firebase Functions** | v7 | Cloud Run deployment wrapper |
| **Firebase Admin** | — | Firebase integration |
| **JWT** | — | Stateless auth |
| **bcryptjs** | — | Password hashing |
| **Nodemailer** | — | Transactional email via SMTP |
| **Gemini AI** | `gemini-2.5-flash-lite` | Document parsing (resumes, JDs, vendors) |
| **pdf-parse** | v1 | Local PDF extraction (fallback) |
| **mammoth** | — | Local DOCX/DOC extraction (fallback) |
| **busboy** | — | Multipart file upload (Cloud Run compatible) |

### Infrastructure

- **Firebase Hosting** — serves the Vite SPA (`frontend/dist`)
- **Firebase Cloud Run** — hosts the Express API (`backend/`)
- **NeonDB** — serverless PostgreSQL

---

## Project Structure

```
zortech-hosting/
├── .env                          # Unified environment config (not committed)
├── firebase.json                 # Firebase Hosting + Functions config
│
├── frontend/                     # Vite + React SPA
│   └── src/
│       ├── components/
│       │   ├── candidates/
│       │   │   ├── CandidateModal.tsx       # Full candidate detail + pipeline actions
│       │   │   ├── AddCandidateModal.tsx    # Add new candidate form
│       │   │   └── ComposeEmailModal.tsx    # Compose & send individual email
│       │   ├── clients/
│       │   │   ├── ClientInfoModal.tsx      # Create/edit client form (30+ fields)
│       │   │   └── ClientDetailModal.tsx    # Read-only client detail view
│       │   ├── pipeline/
│       │   │   ├── PipelineJobSelector.tsx  # Job selector for pipeline board
│       │   │   ├── KanbanColumn.tsx         # Kanban stage column
│       │   │   └── CandidateCard.tsx        # Draggable candidate card
│       │   ├── subscription/
│       │   │   └── PricingCards.tsx         # Plan cards with Razorpay integration
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx              # Collapsible navigation sidebar
│       │   │   ├── Layout.tsx               # Root layout wrapper
│       │   │   └── Header.tsx               # Page header (profile/avatar)
│       │   ├── DashboardModal.tsx           # Dashboard detail modal
│       │   ├── DashboardCard.tsx            # Stat card component
│       │   ├── EmailToast.tsx               # Email send toast notification
│       │   └── ErrorBoundary.tsx            # Global error boundary
│       ├── pages/
│       │   ├── DashboardPage.tsx            # Stat cards, SVG charts, activity feed
│       │   ├── CandidatesPage.tsx           # Candidate table with filters
│       │   ├── JobsPage.tsx                 # Jobs grid + client cards
│       │   ├── JobDetailPage.tsx            # Job detail + applicants
│       │   ├── NewJobPage.tsx               # Create new job with JD parsing
│       │   ├── PipelinePage.tsx             # Kanban pipeline board
│       │   ├── VendorsPage.tsx              # Vendor management
│       │   ├── AssignedJDsPage.tsx          # JD assignments per recruiter/vendor
│       │   ├── AnalyticsPage.tsx            # Recruitment analytics + export
│       │   ├── ResumeSearchPage.tsx         # Cross-candidate resume search
│       │   ├── EmailSettingsPage.tsx        # Per-user SMTP configuration
│       │   ├── EmailCampaignsPage.tsx       # Bulk email campaign management
│       │   ├── AdminPage.tsx                # User management, invites, roles
│       │   ├── CompaniesPage.tsx            # Multi-tenant company management (platform owner)
│       │   ├── SubscriptionPage.tsx         # Current subscription status + cancel
│       │   ├── PricingPage.tsx              # Plan selection + Razorpay billing
│       │   ├── PublicPricingPage.tsx        # Public-facing pricing (pre-login)
│       │   ├── SubscribePage.tsx            # Post-signup subscription selection
│       │   ├── OnboardingPage.tsx           # New tenant onboarding wizard
│       │   ├── LoginPage.tsx                # Login
│       │   ├── ResetPasswordPage.tsx        # Self-service password reset
│       │   └── ChangePasswordPage.tsx       # Forced first-login password change
│       ├── services/
│       │   └── billing.service.ts           # Razorpay billing API + PLANS constant
│       ├── lib/
│       │   └── api.ts                       # Typed fetch wrapper (get/post/patch/delete)
│       └── contexts/
│           └── AuthContext.tsx              # Auth state, profile, subscription context
│
├── backend/                      # Express API (Node.js)
│   └── src/
│       ├── index.ts               # Entry point — mounts Express app, CORS, routes
│       ├── config/
│       │   └── env.ts             # Validated environment config
│       ├── db/
│       │   ├── index.ts           # PostgreSQL pool (NeonDB)
│       │   ├── migrate.ts         # Additive schema migrations (IF NOT EXISTS guards)
│       │   └── migrations/        # Numbered .sql migration files (sorted, idempotent)
│       ├── middleware/
│       │   ├── auth.ts            # JWT auth + tenant isolation
│       │   ├── fileUpload.ts      # busboy-based multipart handler
│       │   └── validation.ts      # Request validation middleware
│       └── modules/
│           ├── admin/
│           │   ├── admin.controller.ts      # User invitations & management
│           │   ├── admin.routes.ts
│           │   └── analytics.controller.ts  # Recruitment analytics queries
│           ├── auth/
│           │   ├── auth.controller.ts       # Login, password change, reset
│           │   └── auth.routes.ts
│           ├── candidates/
│           │   ├── candidates.controller.ts # Candidate CRUD & activity log
│           │   └── candidates.routes.ts
│           ├── clients/
│           │   ├── clients.controller.ts    # Client CRUD (30+ extended fields, stakeholders)
│           │   └── clients.routes.ts
│           ├── email/
│           │   ├── email.controller.ts      # SMTP config, send-single, bulk campaigns
│           │   └── email.routes.ts
│           ├── jobs/
│           │   ├── jobs.controller.ts       # Job lifecycle management
│           │   └── jobs.routes.ts
│           ├── parse/
│           │   ├── parse.controller.ts      # Resume / JD / Vendor parse endpoints
│           │   ├── parse.routes.ts
│           │   └── parse.utils.ts           # Text extraction & AI/fallback field parsing
│           ├── pipeline/
│           │   ├── pipeline.controller.ts   # Stage moves & pipeline_events log
│           │   └── pipeline.routes.ts
│           └── vendors/
│               ├── vendors.controller.ts    # Vendor management + bulk delete
│               └── vendors.routes.ts
│
└── functions/                    # Firebase Cloud Functions wrapper
    └── src/
        └── index.ts              # Proxies to backend Express app
```

---

## Environment Variables

All configuration lives in a single `.env` at the project root.

| Variable | Purpose |
|---|---|
| `SERVER_PORT` | Local Express server port |
| `SERVER_DATABASE_URL` | PostgreSQL connection string |
| `SERVER_JWT_SECRET` | JWT signing secret |
| `SERVER_NODE_ENV` | `development` or `production` |
| `VITE_API_URL` | Frontend API base URL |
| `EMAIL_ENCRYPTION_KEY` | AES-256-GCM key for encrypting per-user SMTP passwords |
| `GEMINI_API_KEY` | Google Gemini AI key for document parsing |
| `RAZORPAY_KEY_ID` | Razorpay public key |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key |
| `UPLOAD_DIR` | Absolute path for uploaded file storage |

> There is no shared `SERVER_SMTP_USER` / `SERVER_SMTP_PASS`. Each user sends email from their own SMTP account. Credentials are stored per-user in the database, encrypted with `EMAIL_ENCRYPTION_KEY`.

---

## API Reference

### Auth
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/auth/login` | Authenticate, receive JWT |
| `POST` | `/v1/auth/change-password` | Change password (forced or self-service) |
| `POST` | `/v1/auth/reset-password` | Self-service password reset |

### Email
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/email/config` | Fetch current user's SMTP config (password masked) |
| `POST` | `/v1/email/config` | Save / update SMTP config |
| `DELETE` | `/v1/email/config` | Remove SMTP config |
| `POST` | `/v1/email/config/test` | Send test email to verify SMTP credentials |
| `POST` | `/v1/email/send-single` | Send a single email to a candidate |
| `POST` | `/v1/email/send-bulk` | Send templated bulk emails |
| `GET` | `/v1/email-campaigns` | List all campaigns for the tenant |
| `POST` | `/v1/email-campaigns` | Create a campaign draft |
| `POST` | `/v1/email-campaigns/:id/send` | Dispatch a campaign to selected recipients |
| `DELETE` | `/v1/email-campaigns/:id` | Delete a campaign |

### Document Parsing
| Method | Endpoint | Returns |
|---|---|---|
| `POST` | `/v1/parse/resume` | `name`, `email`, `phone`, `skills`, `experience_years`, `current_title`, `current_company`, `current_location`, `summary`, `parsed`, `raw_text` |
| `POST` | `/v1/parse/jd` | `title`, `location`, `required_skills`, `experience_min`, `experience_max`, `budget_text`, `salary_min`, `salary_max`, `description`, `parsed` |
| `POST` | `/v1/parse/vendor` | `company_name`, `email`, `phone`, `skills`, `location`, `summary` |

> `parsed: false` is returned (with `raw_text`) when key fields could not be determined, prompting the frontend for manual input.

---

## RBAC — Roles & Access

| Role | Access |
|---|---|
| `super_admin` | Full access to all features; Companies page visible only when platform owner flag is set |
| `accounts_manager` | Jobs, Candidates, Vendors, Analytics, Admin, Campaigns, Email Settings, Subscription |
| `vendor_manager` | Jobs, Candidates, Vendors, JD Assignments, Analytics |
| `recruiter` | Jobs, Candidates, Resume Search, Campaigns, Email Settings |
| `vendor_user` | Read-only Jobs page, filtered to their assigned vendor's jobs only |

RBAC is enforced at **both the route level** (middleware checks `req.user.role`) and the **database level** (all queries include `tenant_id` and role-specific filters).

---

## Pipeline Stages

| Stage | Label |
|---|---|
| `new` | New |
| `sourced` | Sourced |
| `screened` | Screening |
| `shortlisted` | Shortlisted |
| `submitted_to_client` | Submitted to Client |
| `client_interview_scheduled` | Interview Scheduled |
| `interview_completed` | Interview Completed |
| `selected` | Selected |
| `offer_extended` | Offer Extended |
| `offer_accepted` | Offer Accepted |
| `joined` | Joined |
| `disqualified` | Disqualified |

Stage transitions are recorded in `pipeline_events` with the actor, timestamp, and optional note.

---

## Document Parsing Architecture

**Extraction pipeline (file → text):**
1. **pdf-parse v1** — PDF text extraction (local)
2. **mammoth** — DOCX / DOC extraction (local)
3. **UTF-8 buffer read** — plain TXT (local)

**Structured field extraction:**
- **Primary**: Gemini AI (`gemini-2.5-flash-lite`) parses extracted text into structured JSON
- **Fallback**: Local section-map heuristics (see below) when Gemini is unavailable

**Pre-processing (applied before parsing):**
- Spaced-character repair — fixes PDFs where characters are extracted individually (`"J o h n"` → `"John"`)
- Non-ASCII strip — removes encoding artifacts
- Whitespace normalisation — collapses tabs/double spaces; strips noise lines (< 2 chars)

**Fallback parsing architecture — section-map + heuristics:**
- `buildSectionMap` walks the document once, mapping 60+ heading aliases to canonical sections (`skills`, `experience`, `summary`, etc.)
- `parseExperienceYears` calculates from date ranges with overlap merging
- `parseWorkHistory` handles three formats: inline `"at"`, pipe-separated, and multi-line blocks

**Skills extraction — four-tier priority:**
1. Labeled skills section
2. Proficiency phrases (`"proficient in"`, `"experience with"`, etc.)
3. Tech keyword scan — 70+ known technologies
4. Dense-enumeration lines — any line with ≥3 delimited short tokens

---

## Database Migrations

Migrations are **additive-only** — they never drop tables or columns, preserving all existing data.

```bash
# Run migrations
npx ts-node backend/src/db/migrate.ts
```

- Base schema is applied via `schema.sql` using `CREATE TABLE IF NOT EXISTS`
- Additive column changes are run inline (all guarded with `IF NOT EXISTS`)
- Numbered `.sql` files in `backend/src/db/migrations/` are applied in sort order (idempotent)

---

## Deployment

```bash
# Build frontend
cd frontend && npm run build

# Deploy everything (Hosting + Cloud Run)
firebase deploy

# Deploy functions only
firebase deploy --only functions

# Deploy hosting only
firebase deploy --only hosting
```
