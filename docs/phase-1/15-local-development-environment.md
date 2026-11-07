# Document 15: Local Development Environment & Operator Runbook

**Document Status:** FINAL / VERIFIED  
**Classification:** DevOps & Developer Environment Runbook  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026  
**Target Environment:** Local Workstation (Windows 11, WSL 2 / Ubuntu 24.04 LTS, Node.js 20+, PostgreSQL 18+)  
**Cloud Dependency:** **NONE (100% Local-First / Zero AWS Infrastructure Required)**

---

## 1. Overview & Architecture Philosophy

SchoolEMS is engineered with a **strict local-first architecture**. All platform capabilities — including the React 18 single-page application, reverse-proxy API Gateway, asymmetric RS256 authentication service, database migrations, and Row-Level Security (RLS) enforcement — execute locally on a single developer workstation without any external cloud accounts, AWS resources, or paid SaaS services.

---

## 2. Prerequisites & System Requirements

Before running the platform, ensure the following tools are installed on your workstation:

| Component | Minimum Version | Verified Local Version | Purpose |
| :--- | :---: | :---: | :--- |
| **Operating System** | Windows 10/11 or Linux | Windows 11 Pro + WSL 2 | Host OS with Linux compatibility |
| **Node.js** | `>= 20.0.0 LTS` | `v24.x` / `v20.x` | JavaScript runtime for Gateway & Services |
| **npm** | `>= 10.0.0` | `10.x` | Package management and lifecycle scripts |
| **PostgreSQL** | `>= 16.0` | `18.6` (WSL Ubuntu) | Relational database with native RLS support |
| **PowerShell** | `5.1+` or `7.x` | `7.x / Windows PowerShell` | Local orchestration scripts |
| **Bash** | `4.x+` | WSL Bash / Git Bash | Linux/macOS launcher scripts |

> [!NOTE]
> No AWS credentials, AWS CLI profiles, or Terraform state files are required. All cloud integration points are decoupled behind provider abstractions.

---

## 3. PostgreSQL Database Setup (WSL 2 / Native)

The platform requires a running PostgreSQL instance accessible at `127.0.0.1:5432`.

### Option A: WSL 2 (Ubuntu 24.04 LTS) — Verified Configuration

1. **Verify PostgreSQL Cluster Status:**
   ```bash
   wsl -u root su - postgres -c "pg_lsclusters"
   ```
   *Expected Output:* Cluster `18 main` is `online` on port `5432`.

2. **Start PostgreSQL Cluster (if stopped):**
   ```bash
   wsl -u root service postgresql start
   wsl -u root systemctl start postgresql@18-main
   ```

3. **Verify Host Port Forwarding (WSL $\rightarrow$ Windows):**
   PostgreSQL must listen on all addresses (`listen_addresses = '*'`) so that Windows processes can reach `127.0.0.1:5432`:
   ```bash
   # Inside /etc/postgresql/18/main/postgresql.conf
   listen_addresses = '*'
   ```
   Ensure `/etc/postgresql/18/main/pg_hba.conf` allows local connections:
   ```text
   # IPv4 local connections:
   host    all             all             127.0.0.1/32            md5
   host    all             all             127.0.0.1/32            scram-sha-256
   ```

### Option B: Native Windows PostgreSQL

If running native PostgreSQL on Windows:
1. Ensure the Windows PostgreSQL service (`postgresql-x64-18` or similar) is running in `services.msc`.
2. Ensure port `5432` is open and listening.

---

## 4. Environment Configuration

### File Locations
- Example template: `projects/telugu-pickles/services/.env.example`
- Active local config: `projects/telugu-pickles/services/.env`

### Security & Git Safety
- `.env` and `.bootstrap-credentials.json` are **explicitly ignored** in `.gitignore`.
- `.env.example` contains only safe non-sensitive defaults for local development.

### Configuration Template (`.env.example`)
```ini
# Local Development Environment Configuration
NODE_ENV=development
PGHOST=127.0.0.1
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
DB_NAME=auth_db
JWT_SECRET=dev-only-change-me
GATEWAY_INTERNAL_SECRET=internal-gateway-secret-dev-2026
ALLOW_HEADER_TENANT_RESOLVER=true
AUTH_RATE_LIMIT_PER_MIN=100
GATEWAY_PORT=8080
```

### Initial Configuration Step
If `.env` does not exist in your services workspace:
```powershell
cd projects/telugu-pickles/services
Copy-Item .env.example .env
```

---

## 5. Database Provisioning & Three-Tier Role Model

SchoolEMS uses a three-tier database role separation model. Before running migrations, the roles and database can be bootstrapped:

```
                      ┌────────────────────────────────────────┐
                      │          postgres (Superuser)          │
                      │         (Local Database Admin)         │
                      └───────────────────┬────────────────────┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
   ┌───────────────────────────┐                     ┌───────────────────────────┐
   │    school_schema_owner    │                     │   school_migration_user   │
   │ - NOLOGIN                 │                     │ - LOGIN                   │
   │ - Owns all DDL objects    │◄────────────────────┤ - Executes SET ROLE       │
   │ - Defines RLS policies    │  (Role Membership)  │   school_schema_owner     │
   └─────────────┬─────────────┘                     └───────────────────────────┘
                 │
                 ▼ (Grants DML only)
   ┌───────────────────────────┐
   │      school_app_user      │
   │ - LOGIN (Runtime Service) │
   │ - NOBYPASSRLS             │
   │ - DML on tables           │
   │ - Append-only audit logs  │
   └───────────────────────────┘
```

1. **Database Creation:**
   The target database is `auth_db`. If it does not exist:
   ```bash
   # From PowerShell or Bash
   cd projects/telugu-pickles/services
   # The migration tool will create missing tables in auth_db
   ```

2. **Database Isolation Guardrail:**
   - **Never** drop or modify legacy databases (`catalog_db`, `cart_db`, `orders_db`, `payments_db`).
   - All Phase 1 identity, tenant, and RBAC tables reside exclusively in `auth_db`.
   - Automated tests create and tear down disposable databases prefixed with `disposable_*` and do not alter `auth_db`.

---

## 6. Migration Execution & Rollback Commands

All database schemas are managed via Knex migrations located in `auth-service/migrations/`.

From `projects/telugu-pickles/services/`:

### Run Latest Migrations
```powershell
npm run migrate
```
Applies all 7 sequential migrations:
1. `20260301000001_create_tenants_and_branches.js` — Institutions and campus branches.
2. `20260301000002_create_users_and_memberships.js` — Extended users and tenant memberships.
3. `20260301000003_create_rbac_tables.js` — Roles, permissions, and role assignments.
4. `20260301000004_create_domains_and_sessions.js` — Verified domains and refresh token families.
5. `20260301000005_create_audit_logs.js` — Append-only compliance log.
6. `20260301000006_enable_rls_and_policies.js` — Row-Level Security policies & role grants.
7. `20260301000007_create_platform_admins.js` — Dedicated platform administrator table.

### Roll Back Last Migration Batch
```powershell
npm run migrate:rollback
```

---

## 7. Demo Data Seeding & Bootstrap Accounts

### Seed Demonstration Schools (Apex Academy & Horizon International)
```powershell
npm run seed:demo-schools
```
This populates:
- **Tenant A:** Apex Academy (`apex.example`) with Main Campus (`MAIN`) and North Campus (`NORTH`).
- **Tenant B:** Horizon International (`horizon.example`) with City Campus (`CITY`).
- Verified school domains for host-based tenant resolution.
- Standard roles: `SchoolAdmin`, `Principal`, `Teacher`, `Accountant`, `Student`, `Parent`.

### Seed Platform SuperAdmin Bootstrap
```powershell
npm run seed:superadmin
```
Creates an immutable platform SuperAdmin in `platform_admins` and `users` (Password auto-generated or passed via `SUPERADMIN_PASSWORD`).

### Pre-Seeded Local Accounts (Default Password: `DemoPassword@2026`)

| Institution | Persona / Role | Email | Domain Context |
| :--- | :--- | :--- | :--- |
| **Apex Academy** | SchoolAdmin | `admin@apex.example` | `apex.example` |
| **Apex Academy** | Teacher | `teacher@apex.example` | `apex.example` |
| **Apex Academy** | Student | `student@apex.example` | `apex.example` |
| **Horizon International** | SchoolAdmin | `admin@horizon.example` | `horizon.example` |
| **Platform Root** | SuperAdmin | `superadmin@schoolsaas.internal` | Root / No Tenant |

---

## 8. Startup Commands & Workflows

### Option 1: One-Click Launch (Recommended)

#### Windows PowerShell
```powershell
.\start-dev.ps1
```

#### Linux / macOS / WSL Bash
```bash
chmod +x ./start-dev.sh
./start-dev.sh
```

**What the launcher does automatically:**
1. Verifies PostgreSQL is active on port `5432`.
2. Runs Knex database migrations against `auth_db`.
3. Concurrently boots:
   - `school-gateway` on port `8080` (Blue logs)
   - `identity-service` on port `4001` (Green logs)
   - `school-frontend` on port `5173` (Magenta logs)

### Option 2: Individual Service Startup

If debugging or developing a single service:

```powershell
cd projects/telugu-pickles/services

# Start only API Gateway
npm run start:gateway

# Start only Identity Auth Service
npm run start:auth

# Start Frontend UI (in frontend directory)
cd ../frontend
npm run dev
```

---

## 9. Service URLs & Port Mappings

| Service | Port | Endpoint | Purpose |
| :--- | :---: | :--- | :--- |
| **Vite Frontend UI** | `5173` | `http://localhost:5173` | Web portal and authentication UI |
| **API Gateway** | `8080` | `http://localhost:8080` | Single public API entrypoint |
| **Gateway Health Check** | `8080` | `http://localhost:8080/api/health` | Gateway status check |
| **Identity Service** | `4001` | `http://localhost:4001` | Core authentication & tenant IAM |
| **Identity Health Check**| `4001` | `http://localhost:4001/health/live` | Process liveness check |
| **PostgreSQL Database** | `5432` | `127.0.0.1:5432` | Database instance (`auth_db`) |

---

## 10. Automated Testing Commands

Execute the automated test suite with 60 comprehensive tests (including real PostgreSQL RLS and negative security tests):

```powershell
cd projects/telugu-pickles/services

# Run all 60 automated tests
npm test

# If WSL requires a wake-up probe before test execution:
npm run test:wsl
```

*Expected Result:*
```text
ℹ tests 60 | suites 0 | pass 60 | fail 0 | cancelled 0 | duration_ms ~2300ms
```

---

## 11. Troubleshooting Common Issues

### Issue 1: `ECONNREFUSED 127.0.0.1:5432`
- **Cause:** PostgreSQL cluster in WSL or Windows is stopped, or WSL entered an idle sleep state.
- **Solution:**
  ```powershell
  wsl -u root su - postgres -c "pg_lsclusters"
  wsl -u root service postgresql start
  wsl -u root systemctl start postgresql@18-main
  ```

### Issue 2: `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`
- **Cause:** Missing `PGPASSWORD` in environment or empty password field.
- **Solution:** Verify `projects/telugu-pickles/services/.env` has `PGPASSWORD=postgres`.

### Issue 3: `TENANT_REQUIRED (400)` on Root Platform Login
- **Cause:** Attempting to log in at the root platform level without tenant context using an ordinary school account.
- **Solution:** Ordinary users (`Student`, `Teacher`, `SchoolAdmin`) must provide an institutional Host header (`apex.example`) or log in via their school's subdomain. Only verified accounts in `platform_admins` can log in at the platform root.

### Issue 4: `Vite build fails / port 5173 already in use`
- **Cause:** A previous Vite process is running in the background.
- **Solution:** Terminate zombie Node processes:
  ```powershell
  Stop-Process -Name node -Force
  ```

---

## 12. Shutdown & Cleanup Procedures

To stop all local development services cleanly:

1. **In the Concurrently Terminal:**
   Press `Ctrl + C` and confirm with `Y`.

2. **Verify Port Release:**
   ```powershell
   Get-NetTCPConnection -LocalPort 5173, 8080, 4001 -ErrorAction SilentlyContinue
   ```

3. **Stop WSL PostgreSQL (Optional):**
   If you wish to stop the database cluster:
   ```bash
   wsl -u root service postgresql stop
   ```
