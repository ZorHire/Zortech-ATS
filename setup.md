# Local Setup Guide

Follow these instructions to get the ZorHire platform running on your local machine.

## 📋 Prerequisites

- **Node.js**: v18 or higher recommended.
- **PostgreSQL**: v14 or higher (or a cloud instance like Neon).
- **npm**: v9 or higher.

## 🛠️ Step-by-Step Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd zortech-hosting
```

### 2. Configure Environment Variables
Create a `.env` file in the **root** directory and populate it with your local settings.

```env
# Backend Configuration
SERVER_PORT=5000
SERVER_DATABASE_URL=postgresql://user:password@localhost:5432/zortech_hosting
SERVER_JWT_SECRET=your_development_secret_key
SERVER_NODE_ENV=development

# Frontend Configuration (Vite)
VITE_API_URL=http://localhost:5000/api/v1
```

### 3. Install Dependencies
Install dependencies for both the backend and frontend from the root:

```bash
# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 4. Database Migration
Ensure your PostgreSQL database exists. Then, run the migration script to set up the schema and seed the initial admin user.

```bash
cd backend
npm run migrate
```
*(Note: This uses a custom Node.js script to execute the SQL in `backend/src/db/schema.sql`, so you do not need `psql` installed locally.)*

### 5. Run the Application

#### **Start the Backend**
```bash
cd backend
npm run dev
```
The server will start on `http://localhost:5000`.

#### **Start the Frontend**
Open a new terminal and run:
```bash
cd frontend
npm run dev
```
The application will be available at `http://localhost:5173`.

---

## 🔑 Default Admin Account

Once the migration is complete, you can log in with the following account to start inviting your team:

- **Email**: `hr@zortechs.in`
- **Password**: `Solutions1!`

## 🐳 Production Build
To create production-ready builds:

- **Backend**: `cd backend && npm run build`
- **Frontend**: `cd frontend && npm run build`
