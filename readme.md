# ZorHire - ATS Platform

A comprehensive, enterprise-grade Applicant Tracking System (ATS) built with a modern stack. ZorHire is designed for staffing agencies and HR departments, featuring **multi-tenancy**, **role-based access control (RBAC)**, and an **invite-only user management system**.

## 🚀 Project Overview

ZorHire streamlines the recruitment process by providing a centralized, secure environment to manage jobs, candidates, clients, and vendors. It is built to be modular, scalable, and secure by design.

### **Core Features**

- **Invite-Only Access**: Public registration is disabled. Users can only be invited and managed by an Administrator.
- **Forced Password Update**: New users are assigned a temporary password and must update it upon their first login.
- **Admin User Management**: Dedicated dashboard for admins to invite team members, assign specific roles, and manage account status.
- **Candidate Management**: Modular candidate profiles with:
  - Detailed professional history and skills.
  - **Resume Preview**: Direct viewing of uploaded resumes within the browser.
  - **Activity Timeline**: Immutable log of all candidate interactions and stage changes.
- **Job Lifecycle**: Full management from JD intake to candidate placement, including skill matching and recruiter assignment.
- **Multi-Tenant Isolation**: Robust data separation ensuring each organization (tenant) only accesses its own data.
- **RBAC Security**: Granular permissions (Super Admin, ATS Admin, Senior Recruiter, Recruiter, etc.) protecting every API endpoint.
- **Bulk Operations**: Mass candidate selection for email campaigns and pipeline updates.

## 🛠️ Tech Stack

### **Frontend**
- **React 18** with **TypeScript**
- **Vite** for optimized development and builds.
- **Tailwind CSS** for a modern, responsive UI.
- **Lucide React** for high-quality iconography.

### **Backend**
- **Node.js** & **Express**
- **PostgreSQL** for relational data integrity.
- **Domain-Based Architecture**: Modular folder structure for high maintainability.
- **JWT (JsonWebToken)** for secure, stateless session management.
- **Bcrypt** for enterprise-grade password hashing.

## 📁 Project Structure

```text
zortech-hosting/
├── .env                # Centralized configuration (Unified Env)
├── backend/            # Express server & PostgreSQL logic
│   ├── src/
│   │   ├── config/     # Environment & global configs
│   │   ├── middleware/ # Auth, RBAC, and Validation logic
│   │   ├── modules/    # Domain-based modules (admin, auth, jobs, etc.)
│   │   └── db/         # Database connection, schema & migration
├── frontend/           # Vite + React application
│   ├── src/
│   │   ├── components/ # Modular & reusable UI components
│   │   ├── pages/      # Dashboard, Admin, and Entity pages
│   │   └── lib/        # API client & auth utilities
└── docs/               # Additional documentation
```

## 🔐 Unified Configuration

ZorHire uses a **single source of truth** for environment variables via a root-level `.env` file. This centralizes settings like database URLs and API endpoints while maintaining clear separation between the frontend and backend codebases.
