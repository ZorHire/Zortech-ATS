# ZorHire — ATS Platform

A comprehensive, enterprise-grade Applicant Tracking System built for staffing agencies and HR departments. ZorHire features **multi-tenancy**, **role-based access control (RBAC)**, an **invite-only user system**, and **AI-assisted document parsing** for resumes, job descriptions, and vendor profiles.

---

## Project Overview

ZorHire centralizes recruitment operations in a secure, modular environment — covering the full lifecycle from job intake to candidate placement.

### Core Features

- **Invite-Only Access** — Public registration is disabled. Users are invited and managed by an Administrator only.
- **Forced Password Update** — New users receive a temporary password and must change it on first login.
- **Role-Based Access Control** — Granular permissions across all API endpoints: Super Admin, ATS Admin, Vendor Manager, Recruiter, Sourcing Specialist.
- **Multi-Tenant Isolation** — All data is scoped per organization; tenants never access each other's records.
- **Candidate Management** — Full candidate profiles with professional history, skills, resume upload, inline resume preview, and an immutable activity timeline.
- **Job Lifecycle** — End-to-end job management: JD intake, skill matching, recruiter assignment, and stage tracking.
- **Pipeline View** — Kanban-style pipeline board for visualizing and updating candidate stages across jobs.
- **Vendor Management** — Manage staffing vendors with profile parsing and skill indexing.
- **Document Parsing** — Upload resumes, job descriptions, or vendor profiles (PDF, DOCX, DOC, TXT) and auto-populate structured fields. Uses **Apache Tika** as the primary extractor with a **pdf-parse / mammoth** local fallback.
- **Email System** — Per-tenant SMTP configuration with AES-256 encrypted app-password storage. Bulk email campaigns for candidates.
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

### Backend (Firebase Cloud Functions)

- **Node.js 20** + **Express 5**
- **PostgreSQL** (NeonDB) — relational data store via `pg`
- **Firebase Functions v7** + **Firebase Admin** — Cloud Run deployment
- **JWT** — stateless session management
- **bcryptjs** — password hashing
- **Nodemailer** — transactional email via configurable SMTP
- **pdf-parse v1** — PDF text extraction fallback
- **mammoth** — DOCX/DOC text extraction fallback
- **Apache Tika** — primary document text extractor (PDF, DOCX, DOC, TXT)
- **busboy** — multipart file upload handling (Cloud Run compatible)

### Infrastructure

- **Firebase Hosting** — serves the Vite SPA (`frontend/dist`)
- **Firebase Cloud Run** — hosts the Express API (`functions/`)
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
│       │   └── layout/
│       │       └── Sidebar.tsx # Navigation sidebar with logo
│       ├── pages/
│       │   ├── DashboardPage.tsx
│       │   ├── CandidatesPage.tsx
│       │   ├── JobsPage.tsx
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
└── functions/                  # Firebase Cloud Functions (Express API)
    └── src/
        ├── index.ts            # Entry point — mounts Express app
        ├── middleware/
        │   ├── auth.ts         # JWT auth + tenant isolation
        │   └── parseFileUpload.ts  # busboy-based multipart handler
        ├── modules/
        │   ├── admin/          # User invitations & management
        │   ├── auth/           # Login, password change
        │   ├── candidates/     # Candidate CRUD & activity log
        │   ├── clients/        # Client management
        │   ├── email/          # SMTP config & bulk email
        │   ├── jobs/           # Job lifecycle management
        │   ├── parse/
        │   │   ├── parse.controller.ts  # Resume / JD / Vendor parse endpoints
        │   │   └── parse.utils.ts       # Text extraction & field parsing logic
        │   ├── pipeline/       # Pipeline stage management
        │   └── vendors/        # Vendor management
        ├── routes/
        │   └── parse.routes.ts
        └── services/
            └── tika.service.ts # Apache Tika HTTP client
```

---

## Environment Variables

All configuration lives in a single `.env` at the project root.

| Variable               | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `SERVER_PORT`          | Local Express server port                          |
| `SERVER_DATABASE_URL`  | PostgreSQL connection string                       |
| `SERVER_JWT_SECRET`    | JWT signing secret                                 |
| `SERVER_NODE_ENV`      | `development` or `production`                      |
| `VITE_API_URL`         | Frontend API base URL                              |
| `TIKA_URL`             | Apache Tika server URL for document parsing        |
| `SERVER_SMTP_HOST`     | SMTP host for outbound email                       |
| `SERVER_SMTP_PORT`     | SMTP port                                          |
| `SERVER_SMTP_SECURE`   | TLS flag (`true`/`false`)                          |
| `SERVER_SMTP_USER`     | SMTP username                                      |
| `SERVER_SMTP_PASS`     | SMTP app password                                  |
| `SERVER_EMAIL_FROM`    | Sender address                                     |
| `EMAIL_ENCRYPTION_KEY` | AES-256 key for encrypting per-user SMTP passwords |

---

## Document Parsing

The `/v1/parse` endpoints accept multipart file uploads (PDF, DOCX, DOC, TXT, max 8 MB) and return structured JSON.

| Endpoint                | Returns                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /v1/parse/resume` | `name`, `email`, `phone`, `skills`, `experience_years`, `current_title`, `current_company`, `current_location`, `summary`            |
| `POST /v1/parse/jd`     | `title`, `location`, `required_skills`, `experience_min`, `experience_max`, `budget_text`, `salary_min`, `salary_max`, `description` |
| `POST /v1/parse/vendor` | `company_name`, `email`, `phone`, `skills`, `location`, `summary`                                                                    |

**Extraction pipeline:**

1. **Apache Tika** (primary) — reliable extraction for all formats including complex PDFs.
2. **pdf-parse v1 / mammoth** (fallback) — used automatically when Tika is unreachable.

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
