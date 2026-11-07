# SchoolEMS — Local Development Setup Guide

This guide walks you through setting up and running **SchoolEMS** (Multi-Tenant School Management Platform SaaS) on your local development workstation.

---

## 1. Architecture Overview

```text
Browser (React 18 + Vite SPA :5173)
   │
   ▼  HTTP / REST (Host header resolution)
API Gateway (:8080)
   ├── auth-service (:4001)        -> Identity, Tenants, Branches, RS256 Tokens
   └── student-records-service (:4002) -> Students, Attendance, Classes, Fees
         │
         ▼  Direct PostgreSQL Pool (withTenantContext / Kernel RLS)
   PostgreSQL 18.6 Database ('auth_db' :5432)
         ├── Schema 'public' (Phase 1 Identity)
         └── Schema 'sis'    (Phase 2 SIS Domain)
```

---

## 2. Prerequisites

- **Node.js**: `v20.x LTS` or higher
- **PostgreSQL**: `18.x` (running locally or via WSL2 Ubuntu)
- **PowerShell** (Windows) or **Bash** (Linux / macOS / WSL)

---

## 3. Quick Start (One-Click Launcher)

### On Windows:
```powershell
.\start-dev.ps1
```

### On Linux / macOS / WSL:
```bash
./start-dev.sh
```

The script automatically:
1. Verifies PostgreSQL is active on port `5432`.
2. Runs database migrations on `auth_db`.
3. Concurrently launches the Gateway (`:8080`), Auth Service (`:4001`), and Frontend SPA (`:5173`).

---

## 4. Manual Step-by-Step Setup

### Step 1: Install Dependencies
```bash
# Backend services
cd services
npm install

# Frontend
cd ../frontend
npm install
cd ..
```

### Step 2: Database Setup & Migrations
```bash
cd services
npm run migrate
```

### Step 3: Seed Demonstration Data
```bash
# Seed platform SuperAdmin
npm run seed:superadmin

# Seed pilot institutions (Apex Academy & Horizon International)
npm run seed:demo-schools
```

### Step 4: Run Application
```bash
# From services directory:
npm run dev
```

---

## 5. Access URLs & Seeded Demo Accounts

### Service URLs:
- **Frontend Web Application:** [http://localhost:5173](http://localhost:5173)
- **API Gateway Health Check:** [http://localhost:8080/api/health](http://localhost:8080/api/health)
- **Authentication Service:** [http://localhost:4001](http://localhost:4001)

### Demonstration Accounts:
| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Platform SuperAdmin** | `superadmin@schoolsaas.internal` | `SuperAdmin@2026` | Global Platform |
| **Apex SchoolAdmin** | `admin@apex.example` | `DemoPassword@2026` | Tenant Apex |
| **Horizon SchoolAdmin** | `admin@horizon.example` | `DemoPassword@2026` | Tenant Horizon |
| **Apex Teacher** | `teacher@apex.example` | `DemoPassword@2026` | Branch Campus |
| **Apex Student** | `student@apex.example` | `DemoPassword@2026` | Self Roster |

---

## 6. Running Automated Tests

```bash
# In WSL environment:
wsl -d Ubuntu -- bash -c "cd /mnt/c/Users/bantu/Desktop/JuneAWSAIOpsProj-main/services && npm test"
```
