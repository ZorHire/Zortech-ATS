# ZorHire — Codebase Guide

A complete reference for anyone new to this project. Covers architecture, features, every API endpoint, database schema, roles, and how everything connects.

---

## Table of Contents

1. [What Is This App?](#1-what-is-this-app)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Environment Variables](#4-environment-variables)
5. [Roles & Permissions](#5-roles--permissions)
6. [API Reference — All Endpoints](#6-api-reference--all-endpoints)
7. [Database Schema](#7-database-schema)
8. [Frontend Pages](#8-frontend-pages)
9. [Key Frontend Components](#9-key-frontend-components)
10. [Services & Integrations](#10-services--integrations)
11. [Authentication Flow](#11-authentication-flow)
12. [File Upload & Resume Parsing Flow](#12-file-upload--resume-parsing-flow)
13. [Email System](#13-email-system)
14. [Deployment](#14-deployment)
15. [Local Development](#15-local-development)

---

## 1. What Is This App?

**ZorHire** is a multi-tenant Applicant Tracking System (ATS) built for recruitment agencies. It lets teams manage clients, post jobs, track candidates through a hiring pipeline, coordinate with vendors, and send emails — all from one platform.

**Core capabilities:**

- Multi-tenant: each company (tenant) has isolated data
- Role-based access: 5 roles with different permissions
- Kanban pipeline: drag candidates through hiring stages
- AI parsing: upload a resume/JD and Gemini AI extracts structured data
- Per-user email: each recruiter sends from their own email address
- Vendor portal: vendors get restricted access to see only their assigned jobs

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| **API (production)** | Node.js + Express, deployed as Firebase Cloud Functions (v2) on Cloud Run |
| **API (local dev)** | Same Express app run directly with `nodemon` |
| **Database** | PostgreSQL (hosted on NeonDB — serverless Postgres) |
| **Frontend** | React 18 + TypeScript, bundled with Vite |
| **Hosting** | Firebase Hosting (serves the built React app) |
| **AI** | Google Gemini 2.5 Flash Lite — resume, JD, and vendor profile parsing |
| **Email** | Nodemailer with per-user SMTP (Zoho / Gmail App Passwords) |
| **Auth** | JWT (JSON Web Tokens), bcrypt password hashing |
| **File handling** | Busboy (Cloud Run compatible multipart parser) |
| **Rate limiting** | express-rate-limit v8 |
| **Security** | Helmet, CORS allowlist, AES-256-GCM encryption for stored passwords |

---

## 3. Project Structure

```
zortech-hosting/
├── functions/               ← Firebase Cloud Functions (production API)
│   ├── src/
│   │   ├── index.ts         ← Express app entry, all middleware, exports `api`
│   │   ├── config/
│   │   │   ├── env.ts       ← Loads environment variables
│   │   │   └── rolePermissions.ts  ← Role → permission mappings
│   │   ├── db/
│   │   │   └── index.ts     ← PostgreSQL connection pool (NeonDB)
│   │   ├── middleware/
│   │   │   ├── auth.ts      ← JWT verify, authorize(), tenantIsolation()
│   │   │   ├── permissions.ts      ← requirePermission() middleware
│   │   │   ├── candidateUpload.ts  ← Busboy multipart handler for candidates
│   │   │   ├── parseFileUpload.ts  ← Busboy multipart handler for parse routes
│   │   │   └── validation.ts       ← Request body validation
│   │   ├── modules/
│   │   │   ├── auth/        ← login, register, reset-password, change-password, /me
│   │   │   ├── admin/       ← user management, analytics
│   │   │   ├── candidates/  ← CRUD + resume upload + CSV export + search
│   │   │   ├── clients/     ← Client company CRUD + stakeholders
│   │   │   ├── jobs/        ← Job posting CRUD
│   │   │   ├── vendors/     ← Vendor agency CRUD
│   │   │   ├── pipeline/    ← Kanban: add to pipeline, move stages, history
│   │   │   └── email/       ← SMTP config, send single, send bulk, templates, campaigns
│   │   ├── routes/
│   │   │   └── parse.routes.ts  ← Resume / JD / Vendor AI parsing
│   │   └── services/
│   │       └── gemini.service.ts  ← Gemini AI API calls
│   └── package.json
│
├── backend/                 ← Standalone Express server (local dev / fallback)
│   └── src/                 ← Same structure as functions/src/
│       └── db/
│           ├── schema.sql   ← Full DB schema (CREATE TABLE IF NOT EXISTS)
│           ├── migrate.ts   ← Additive migration runner (never drops data)
│           └── migrations/  ← Incremental SQL migration files
│
├── frontend/                ← React SPA
│   ├── src/
│   │   ├── App.tsx          ← Router, ProtectedRoute, role-based redirects
│   │   ├── main.tsx         ← React entry point
│   │   ├── lib/
│   │   │   └── api.ts       ← Fetch wrapper (auth headers, retries, ApiError)
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx  ← useAuth() hook, token storage, login/logout
│   │   ├── hooks/
│   │   │   └── useSendEmail.ts  ← Shared email-send logic
│   │   ├── pages/           ← One file per page/route
│   │   ├── components/      ← Reusable UI components
│   │   ├── types/
│   │   │   └── index.ts     ← All TypeScript interfaces and enums
│   │   └── services/
│   │       └── resumeSearch.service.ts
│   └── vite.config.ts       ← envDir: '../' (reads root .env)
│
├── .env                     ← Single env file for all parts (Vite reads via envDir)
├── firebase.json            ← Firebase Hosting + Functions config
├── errors.md                ← Full log of every bug found and fixed
└── CODEBASE_GUIDE.md        ← This file
```

---

## 4. Environment Variables

All variables live in the root `.env` file. Vite is configured (`envDir: '../'`) to read from there.

```env
# ── Backend / Functions ──────────────────────────────────────
SERVER_PORT=5000                          # Local dev port
SERVER_DATABASE_URL=postgresql://...      # NeonDB connection string
SERVER_JWT_SECRET=<min 32 chars>          # JWT signing secret
SERVER_NODE_ENV=development

# ── Frontend (Vite picks up VITE_ prefix) ───────────────────
VITE_API_URL=https://api-xxxx-uc.a.run.app/v1  # Firebase Function URL

# ── Email (optional system-level fallback) ───────────────────
SERVER_SMTP_HOST=smtppro.zoho.in
SERVER_SMTP_PORT=465
SERVER_SMTP_SECURE=true

# ── Encryption key for stored user SMTP passwords ────────────
EMAIL_ENCRYPTION_KEY=<64-char hex>        # AES-256-GCM key

# ── Gemini AI ────────────────────────────────────────────────
GEMINI_API_KEY=<your key>
```

Firebase Functions secrets (set via `firebase functions:secrets:set`):
`SERVER_DATABASE_URL`, `SERVER_JWT_SECRET`, `SERVER_EMAIL_ENCRYPTION_KEY`, `GEMINI_API_KEY`

---

## 5. Roles & Permissions

### Role Hierarchy

| Role | Who Uses It | Access Level |
|---|---|---|
| `super_admin` | Owner / top-level admin | Everything — no restrictions |
| `accounts_manager` | Account manager | Everything except system settings |
| `recruiter` | Recruiter / HR staff | Candidates, jobs, pipeline, email |
| `vendor_manager` | Manages vendor relationships | View-only on most things |
| `vendor_user` | Vendor employee | Only jobs assigned to their vendor |

### What Each Role Can Do

```
super_admin       →  all permissions (wildcard *)

accounts_manager  →  user:*, candidate:*, job:*, client:*, vendor:*,
                      pipeline:*, email:*

recruiter         →  candidate:*, job:*, client:view, vendor:view,
                      pipeline:*, email:*

vendor_manager    →  candidate:view, job:view, client:view,
                      vendor:view, pipeline:view

vendor_user       →  job:view (own vendor's jobs only), pipeline:view
```

### How RBAC Works in Code

Every protected route stacks three middleware functions:

```
authMiddleware    →  verifies JWT, attaches req.user (id, role, tenant_id, permissions)
tenantIsolation   →  ensures req.user.tenant_id exists
authorize([roles]) →  checks req.user.role is in the allowed list
```

Example from jobs routes:
```ts
router.post("/", authMiddleware, tenantIsolation, authorize(["super_admin", "accounts_manager", "recruiter"]), jobController.createJob);
```

---

## 6. API Reference — All Endpoints

Base URL (production): `https://api-7vmtatmuqq-uc.a.run.app/v1`
Base URL (local): `http://localhost:5000/api/v1`

All endpoints except Auth require: `Authorization: Bearer <token>`

---

### Auth — `/v1/auth`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/login` | No | Public | Login with email + password. Returns JWT + profile. |
| POST | `/register` | No | Public | Self-register (gets `recruiter` role). |
| POST | `/reset-password` | No | Public | Reset password by email (no token needed). |
| POST | `/change-password` | Yes | All | Change own password (requires current password). |
| GET | `/me` | Yes | All | Get current user profile + role + permissions. |
| POST | `/setup` | No | SETUP_TOKEN | One-time bootstrap to create first super_admin. |

**Login request:**
```json
{ "email": "user@example.com", "password": "secret" }
```
**Login response:**
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "email": "...", "role": "recruiter", "full_name": "...", "tenant_id": "..." }
}
```

---

### Admin — `/v1/admin`

Roles required: `super_admin`, `accounts_manager`

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List all users in the tenant |
| POST | `/users` | Create a new user. Sends invite email (non-fatal if email not configured). |
| PATCH | `/users/:id` | Update user (name, role, active status) |
| DELETE | `/users/:id` | Delete user |
| POST | `/users/:id/reset-password` | Admin resets another user's password |

**Create user request:**
```json
{
  "email": "new@example.com",
  "password": "temp1234",
  "full_name": "Jane Doe",
  "role": "recruiter",
  "vendor_id": "<uuid>"   // only needed when role = vendor_user
}
```

---

### Clients — `/v1/clients`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/` | All | List all clients (paginated) |
| GET | `/:id` | All | Get single client + stakeholders |
| POST | `/` | super_admin, accounts_manager | Create client (50+ fields) |
| PATCH | `/:id` | super_admin, accounts_manager | Update client |
| DELETE | `/:id` | super_admin, accounts_manager | Soft-delete client |

**Key client fields:** name, client_type, industry, company_size, tier, headquarters_location, msa_signed, nda_signed, billing_model, sla_hours, tags, notes, stakeholders[]

---

### Jobs — `/v1/jobs`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/` | All | List jobs. `vendor_user` only sees their assigned jobs. |
| GET | `/:id` | All | Get job details. `vendor_user` gets 403 if not their job. |
| POST | `/` | super_admin, accounts_manager, recruiter | Create job posting |
| PATCH | `/:id` | super_admin, accounts_manager, recruiter | Update job |
| DELETE | `/:id` | super_admin, accounts_manager, recruiter | Delete job |

**Key job fields:** title, client_id, status, work_mode, employment_type, experience_min/max, salary_min/max, priority, mandatory_skills[], assigned_vendor_id, sla_deadline

**Job statuses:** `draft` → `pending_review` → `active` → `on_hold` → `closed_filled` / `closed_cancelled` / `expired`

---

### Candidates — `/v1/candidates`

Multipart routes (POST, PATCH) are mounted before `express.json()` to allow file upload.

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/` | All | List candidates (paginated, tenant-isolated) |
| GET | `/search` | All | Full-text search candidates by query string |
| GET | `/export` | All | Download candidates as CSV |
| GET | `/:id` | All | Get candidate details |
| GET | `/:id/resume` | All | Stream resume file (PDF/DOCX stored as BYTEA in DB) |
| POST | `/` | super_admin, accounts_manager, recruiter | Create candidate. Accepts `multipart/form-data` with optional `resume` file. |
| PATCH | `/:id` | super_admin, accounts_manager, recruiter | Update candidate + optional new resume |
| DELETE | `/:id` | super_admin, accounts_manager, recruiter | Delete candidate |

**Resume storage:** Uploaded as binary (BYTEA) in PostgreSQL. Served back via `GET /:id/resume` with correct `Content-Type`. Frontend fetches with auth header → creates blob URL → shows inline iframe preview + download.

---

### Vendors — `/v1/vendors`

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/` | All | List vendors |
| GET | `/:id` | All | Get vendor + performance metrics |
| POST | `/` | super_admin, accounts_manager | Create vendor |
| PATCH | `/:id` | super_admin, accounts_manager | Update vendor |
| DELETE | `/:id` | super_admin, accounts_manager | Delete vendor |

**Key vendor fields:** company_name, tier (preferred/standard/blocked), quality_score, submission_count, shortlist_rate, fill_rate, sla_adherence, industry_specializations[], geographies[]

---

### Pipeline — `/v1/pipeline`

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/add` | super_admin, accounts_manager, recruiter | Add candidate to a job's pipeline |
| GET | `/jobs/:jobId/applications` | All | Get all applications for a job (Kanban data) |
| POST | `/jobs/:jobId/applications` | super_admin, accounts_manager, recruiter | Create application (link candidate to job) |
| PATCH | `/applications/:id/stage` | super_admin, accounts_manager, recruiter | Move application to new stage |
| GET | `/applications/:id/history` | All | Full audit trail of stage changes |

**Pipeline stages (in order):**
`new` → `sourced` → `screened` → `shortlisted` → `submitted_to_client` → `client_interview_scheduled` → `interview_completed` → `selected` → `offer_extended` → `offer_accepted` / `offer_rejected` → `joined` / `disqualified`

---

### Email — `/v1/email`

#### SMTP Configuration (per-user)

| Method | Path | Description |
|---|---|---|
| GET | `/config` | Get current user's SMTP setup (never returns the password) |
| POST | `/config` | Save SMTP config. Password is AES-256-GCM encrypted before storing. |
| DELETE | `/config` | Remove SMTP config |
| POST | `/config/test` | Test connection — decrypts password, runs `transporter.verify()` |

**Save config request:**
```json
{
  "smtp_host": "smtppro.zoho.in",
  "smtp_port": 465,
  "smtp_secure": true,
  "smtp_user": "you@domain.com",
  "smtp_pass": "apppassword"  // stored encrypted, never returned
}
```

#### Sending

| Method | Path | Description |
|---|---|---|
| GET | `/templates` | List available email templates |
| POST | `/send-single` | Send one email from the calling user's SMTP |
| POST | `/send` | Send bulk emails |

**Send single request:**
```json
{
  "to": "candidate@email.com",
  "subject": "Interview Invitation",
  "body": "<p>Hello...</p>"
}
```

#### Campaigns — `/v1/email-campaigns`

| Method | Path | Description |
|---|---|---|
| GET | `/` | List campaigns |
| POST | `/` | Create campaign (draft) |
| POST | `/:id/send` | Send campaign to all recipients |

---

### Parse (AI) — `/v1/parse`

Multipart — send file as `multipart/form-data` with field name `file`.

| Method | Path | Description | Returns |
|---|---|---|---|
| POST | `/resume` | Upload resume PDF/DOCX → Gemini extracts structured data | name, email, phone, skills[], experience_years, current_title, current_company, location, summary |
| POST | `/jd` | Upload job description → Gemini extracts structured data | title, location, required_skills[], experience_min/max, salary_min/max, budget_text, description |
| POST | `/vendor` | Upload vendor profile → Gemini extracts structured data | company_name, email, phone, skills[], location, summary |

**Parsing pipeline:**
1. Busboy receives file
2. `pdf-parse` (PDF) or `mammoth` (DOCX) or UTF-8 decode (TXT) extracts raw text
3. Text cleaned (non-ASCII stripped, spaced-character PDFs fixed)
4. Sent to Gemini 2.5 Flash Lite with a structured prompt
5. Response parsed as JSON and returned

---

### Health Check

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | No | Returns `{ status: "ok", db: "connected" }` or `{ status: "degraded" }` |

---

## 7. Database Schema

All tables include `tenant_id` for data isolation. All user-generated tables include soft-delete (`deleted_at`) or `is_active`.

### tenants
```
id (uuid PK), name, slug (unique), domain (unique), is_active, created_at, updated_at
```

### users
```
id (uuid PK), email (unique), password (bcrypt), must_change_password (bool), is_active, created_at, updated_at
```

### tenant_memberships
```
id (uuid PK), user_id (FK→users), tenant_id (FK→tenants),
role (enum: super_admin | accounts_manager | recruiter | vendor_manager | vendor_user),
is_active, created_at, updated_at
```
*This table determines what role a user has within a tenant.*

### profiles
```
id (uuid PK FK→users), email, full_name, avatar_url, phone, department,
vendor_id (FK→vendors, nullable — set for vendor_user role),
created_at, updated_at
```

### clients
```
id (uuid PK), tenant_id, name, client_type, industry, company_size, tier,
website, linkedin, logo_url, headquarters_location, operating_locations[],
primary_contact_name/email/phone, engagement_type, hiring_volume,
billing_model, currency, markup, payment_terms, contract_start/end,
msa_signed (bool), nda_signed (bool), preferred_skills[], typical_roles[],
sla_hours, account_manager, tags[], notes, is_active,
created_by (FK→users), created_at, updated_at, deleted_at
```

### client_stakeholders
```
id (uuid PK), client_id (FK), tenant_id, name, role, email, phone, timezone, created_at
```

### jobs
```
id (uuid PK), tenant_id, client_id (FK),
title, department, location, work_mode (remote|hybrid|onsite),
employment_type (full_time|part_time|contract|internship),
experience_min, experience_max, salary_min, salary_max, currency,
headcount, priority (low|medium|high|critical),
status (draft|pending_review|active|on_hold|closed_filled|closed_cancelled|expired),
description, mandatory_skills[], preferred_skills[],
assigned_recruiter_id (FK→users), assigned_vendor_id (FK→vendors),
target_start_date, sla_deadline,
created_by (FK→users), approved_by, approved_at, created_at, updated_at, deleted_at
```

### candidates
```
id (uuid PK), tenant_id,
first_name, last_name, email, phone,
current_title, current_company, experience_years,
current_location, preferred_location, notice_period_days,
current_ctc, expected_ctc, skills[],
summary, source (linkedin|indeed|naukri|vendor|referral|direct|other),
resume_url, resume_data (BYTEA), resume_mime_type,
gdpr_consent (bool), is_active,
created_by (FK→users), created_at, updated_at, deleted_at
```

### job_applications
```
id (uuid PK), tenant_id, job_id (FK), candidate_id (FK),
stage (new|sourced|screened|shortlisted|submitted_to_client|
       client_interview_scheduled|interview_completed|selected|
       offer_extended|offer_accepted|offer_rejected|joined|disqualified),
ai_score, ai_match_breakdown (jsonb), rejection_reason, notes,
assigned_to (FK→users), created_at, updated_at
```

### pipeline_events
```
id (uuid PK), tenant_id, application_id (FK),
from_stage, to_stage, changed_by (FK→users), note, created_at
```
*Immutable audit log — never updated or deleted.*

### vendors
```
id (uuid PK), tenant_id,
company_name, registration_number, gst_id,
primary_contact_name/email/phone,
industry_specializations[], geographies[],
tier (preferred|standard|blocked),
quality_score, submission_count, shortlist_rate, fill_rate, sla_adherence,
is_active, created_at, updated_at, deleted_at
```

### user_email_config
```
id (uuid PK), user_id (FK, UNIQUE per tenant), tenant_id,
email, encrypted_password (AES-256-GCM: iv:tag:ciphertext),
provider (default: gmail), is_active, created_at, updated_at
```

### email_campaigns
```
id (uuid PK), tenant_id, name, subject, body,
status (draft|scheduled|sending|sent|failed),
recipient_count, delivered_count, opened_count, clicked_count, bounced_count,
scheduled_at, sent_at, created_by (FK), created_at, updated_at
```

### interviews
```
id (uuid PK), tenant_id, application_id (FK),
interview_type (phone|video|face_to_face),
scheduled_at, duration_minutes, interviewer_name/email, meeting_link,
feedback_score, feedback_notes,
status (scheduled|completed|cancelled|no_show),
created_by (FK), created_at, updated_at
```

---

## 8. Frontend Pages

All pages are protected by `ProtectedRoute`. `vendor_user` is restricted to `/jobs` and `/pipeline` only.

| Route | File | What It Does |
|---|---|---|
| `/login` | LoginPage.tsx | Email/password login. Includes inline forgot-password flow (no separate page). |
| `/change-password` | ChangePasswordPage.tsx | Forced on first login if `must_change_password = true`. |
| `/` | DashboardPage.tsx | Overview: active jobs count, pipeline metrics, SLA alerts, recent activity. |
| `/jobs` | JobsPage.tsx | Job cards with status filters. Create/edit/delete jobs. Link to pipeline. For vendor_user: only assigned jobs, read-only. |
| `/jobs/new` | NewJobPage.tsx | Create job form with optional JD file upload (parses with AI to pre-fill fields). |
| `/jobs/:id` | JobDetailPage.tsx | Full job details view. |
| `/pipeline/:jobId` | PipelinePage.tsx | Kanban board for one job. Drag candidates between stages. View stage history. |
| `/candidates` | CandidatesPage.tsx | Candidate table. Upload resume (AI-parsed). Edit profiles. Send emails. Export CSV. |
| `/vendors` | VendorsPage.tsx | Vendor cards with performance metrics. Create/edit/delete. Send job descriptions by email. |
| `/search` | ResumeSearchPage.tsx | Full-text resume search. Add matching candidates to any job's pipeline. Send bulk emails. |
| `/admin` | AdminPage.tsx | User management (create, edit, reset password, delete). Role assignment. Vendor linking for vendor_user role. |
| `/analytics` | AnalyticsPage.tsx | Charts: hiring funnel, stage distribution, recruiter productivity. Client-side CSV export. |
| `/settings/email` | EmailSettingsPage.tsx | Connect personal SMTP (Zoho or Gmail). Test connection. |

---

## 9. Key Frontend Components

### Layout
- **Sidebar.tsx** — Navigation links filtered by role. Shows only pages the current role can access.
- **Header.tsx** — Top bar with user info and logout.
- **Layout.tsx** — Wraps all pages with Sidebar + Header.

### Candidates
- **CandidateModal.tsx** — View/edit candidate details. Fetches resume as blob → inline PDF preview, download, full-screen. Compose email inline.
- **ComposeEmailModal.tsx** — Email composer with subject/body. Preloaded with draft templates.

### Pipeline
- **KanbanColumn.tsx** — One stage column. Renders candidate cards, accepts drops.
- **CandidateCard.tsx** — Card within a Kanban column. Shows name, title, score.
- **PipelineJobSelector.tsx** — Dropdown to switch between jobs on the pipeline page.

### Clients
- **ClientInfoModal.tsx** — Full client creation/edit form (50+ fields, tabbed sections).
- **ClientDetailModal.tsx** — Read-only client detail view.

### Auth
- **ProtectedRoute** (in App.tsx) — Redirects unauthenticated users to `/login`. Redirects `vendor_user` away from restricted pages.

### API Client (lib/api.ts)
```typescript
api.get(endpoint)              // GET with Authorization header
api.post(endpoint, body)       // POST — auto-handles FormData vs JSON
api.patch(endpoint, body)      // PATCH
api.delete(endpoint)           // DELETE
```
Features: auto-retries on 5xx, auto-logout on 401, throws `ApiError` with `status` + `data` for error handling.

### Auth Context (contexts/AuthContext.tsx)
```typescript
const { user, profile, login, logout, isLoading } = useAuth();
```
Stores JWT in `localStorage`. Decodes token for `user.role`. Calls `GET /auth/me` on app load to get full profile.

---

## 10. Services & Integrations

### Gemini AI (services/gemini.service.ts)

**Model:** `gemini-2.5-flash-lite` (free tier, fast)
**API:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent`

Three functions, each sends the extracted text + a structured prompt and parses the JSON response:

| Function | Input | Output |
|---|---|---|
| `parseResumeWithGemini(text)` | Resume plain text | `{ name, email, phone, skills[], experience_years, current_title, current_company, location, summary }` |
| `parseJobDescriptionWithGemini(text)` | JD plain text | `{ title, location, required_skills[], experience_min, experience_max, salary_min, salary_max, budget_text, description }` |
| `parseVendorWithGemini(text)` | Vendor profile text | `{ company_name, email, phone, skills[], location, summary }` |

### Email Service (modules/email/)

Each user connects their own email account under Settings → Email. The app stores the SMTP app-password encrypted (AES-256-GCM) in `user_email_config`. When sending:

1. Look up `user_email_config` by `user_id`
2. Decrypt the stored password
3. Create a Nodemailer transporter on the fly
4. Send — from the user's own email address

Supported providers: **Zoho** (`smtppro.zoho.in:465/SSL`) and **Google Workspace / Gmail** (`smtp.gmail.com:587/STARTTLS`)

If no config exists: returns `EMAIL_NOT_CONFIGURED` error (HTTP 503).

### File Extraction (parse pipeline)

```
Uploaded file (PDF/DOCX/TXT)
  ↓ Busboy (Cloud Run compatible multipart parser)
  ↓ pdf-parse v1 (PDF) / mammoth (DOCX) / UTF-8 decode (TXT)
  ↓ normalizeText() — strips non-ASCII, collapses whitespace
  ↓ fixSpacedText() — repairs "J o h n D o e" artifacts from PDF fonts
  ↓ Gemini AI → structured JSON
  ↓ Returned to frontend
```

---

## 11. Authentication Flow

```
1. User → POST /auth/login { email, password }
2. Backend: finds user in DB, verifies bcrypt hash
3. Backend: looks up tenant_memberships → gets role + tenant_id
4. Backend: signs JWT { id, email, role, tenant_id, vendor_id }
5. Frontend: stores JWT in localStorage
6. All API requests: { Authorization: "Bearer <jwt>" }
7. authMiddleware: verifies JWT → attaches req.user
8. tenantIsolation: verifies req.user.tenant_id exists
9. authorize([roles]): checks req.user.role is allowed
```

**Token expiry:** Configured in `SERVER_JWT_SECRET` setup. On 401 response, frontend clears token and redirects to `/login`.

**Must-change-password:** If `users.must_change_password = true`, frontend redirects to `/change-password` before any other page.

---

## 12. File Upload & Resume Parsing Flow

### Why Busboy instead of Multer

Firebase Cloud Run pre-buffers the entire HTTP body before Express sees it. Multer reads from the Node.js stream, which is already consumed — causing `busboy: Unexpected end of form`. The custom `candidateUpload.ts` middleware detects `req.rawBody instanceof Buffer` and re-wraps it into a readable stream for Busboy.

### Resume Storage

Resumes are stored as **BYTEA (binary)** in PostgreSQL — not on disk (Cloud Run has no persistent disk). The `GET /candidates/:id/resume` endpoint reads the binary from DB and streams it back with the correct `Content-Type`. The frontend fetches this endpoint (with auth header) and creates a blob URL for inline preview and download.

---

## 13. Email System

### Per-User SMTP

Every recruiter/admin connects their own email under `/settings/email`. This means:
- Emails sent to candidates come from the recruiter's address, not a shared system email
- Each user's app password is stored AES-256-GCM encrypted (key from `EMAIL_ENCRYPTION_KEY`)
- Password is never returned by the API — only `email` and `provider` are exposed

### Invite Emails (Admin → New User)

When an admin creates a new user, the backend (not frontend) sends the welcome/invite email:
- Uses the **admin's** SMTP config
- If admin has no SMTP configured → user is still created, `emailSent: false` is returned
- Frontend shows a warning toast, not a hard error

### Rate Limiting on Auth Route

`POST /auth/login` and other auth endpoints are behind `authLimiter`:
- 20 requests per 15 minutes per IP
- Returns 429 with `{ message: "Too many attempts. Please try again in 15 minutes." }`

---

## 14. Deployment

### Firebase Functions (API)

```bash
cd functions
npm run build          # TypeScript compile → functions/lib/
firebase deploy --only functions
```

The `api` export in `functions/src/index.ts` becomes the Cloud Run service. URL pattern: `https://api-<hash>-<region>.a.run.app`

Secrets must be set before deploying:
```bash
firebase functions:secrets:set SERVER_DATABASE_URL
firebase functions:secrets:set SERVER_JWT_SECRET
firebase functions:secrets:set SERVER_EMAIL_ENCRYPTION_KEY
firebase functions:secrets:set GEMINI_API_KEY
```

### Firebase Hosting (Frontend)

```bash
cd frontend
npm run build          # Vite builds → frontend/dist/
firebase deploy --only hosting
```

Firebase Hosting serves `frontend/dist/`. All unmatched routes rewrite to `index.html` (SPA routing).

### Full Deploy (Both)

```bash
firebase deploy --only functions,hosting
```

### Database Migrations

```bash
cd backend
npm run migrate        # Runs migrate.ts — additive only, never drops data
```

`migrate.ts` is safe to run repeatedly:
- `CREATE TABLE IF NOT EXISTS` — no-op if table exists
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` — no-op if column exists
- Seed rows use `ON CONFLICT DO NOTHING`

---

## 15. Local Development

### Backend (standalone Express)

```bash
cd backend
npm install
npm run dev            # nodemon on port 5000
```

Reads from root `.env`. API available at `http://localhost:5000/api/v1`.

### Frontend

```bash
cd frontend
npm install
npm run dev            # Vite dev server on port 5173
```

Point `VITE_API_URL` to `http://localhost:5000/api/v1` in `.env` for local backend, or leave it as the Firebase URL to develop against production API.

### Firebase Functions (local emulator)

```bash
cd functions
npm run build
firebase emulators:start --only functions
```

---

## Quick Reference — Common Tasks

| Task | Where to look |
|---|---|
| Add a new API endpoint | `functions/src/modules/<module>/<module>.routes.ts` + controller |
| Add a new role | `functions/src/config/rolePermissions.ts` + update `authorize()` calls in routes |
| Add a DB column | Add `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` to `backend/src/db/migrate.ts` and update `schema.sql` |
| Change what a page shows | `frontend/src/pages/<PageName>.tsx` |
| Change navigation visibility | `frontend/src/components/layout/Sidebar.tsx` → `roles` array on each nav item |
| Change which roles can access a route | `authorize([...])` in the route file |
| Change Gemini model | `functions/src/services/gemini.service.ts` → `GEMINI_URL` constant |
| Debug a production error | Check Firebase Functions logs in Cloud Console → Functions → Logs |
| Full bug/fix history | `errors.md` — every bug with root cause and fix |
