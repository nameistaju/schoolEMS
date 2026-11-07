# SchoolEMS — Enterprise Multi-Tenant School Management Platform (SaaS)

[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.x%20Vite-blue.svg)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18%2B%20RLS%20Enabled-336791.svg)](https://www.postgresql.org/)
[![Security](https://img.shields.io/badge/Auth-RS256%20Asymmetric%20JWT-red.svg)](docs/phase-1/04-authentication-and-jwt.md)
[![Testing](https://img.shields.io/badge/Tests-56%2F56%20Passing-brightgreen.svg)](docs/phase-1/14-security-remediation-report.md)
[![Architecture](https://img.shields.io/badge/Architecture-Multi--Tenant%20SaaS-orange.svg)](docs/school-management-migration/04-target-school-saas-architecture.md)
[![Local-First](https://img.shields.io/badge/Environment-Local--First%20%28No%20AWS%20Lock--in%29-purple.svg)](#local-development--quickstart)

> **SchoolEMS** is an enterprise-grade, multi-tenant Educational Operations and School Management SaaS platform. Built for educational trusts, multi-campus school chains, and independent K-12 institutions, SchoolEMS delivers ironclad tenant isolation via **PostgreSQL Row-Level Security (RLS)**, asymmetric **RS256 JWT authentication**, hierarchical **Role-Based Access Control (RBAC)**, and a local-first microservice architecture engineered for eventual high-scale cloud deployment.

---

## Table of Contents

- [About The Project](#about-the-project)
  - [The Problem](#the-problem)
  - [The Solution](#the-solution)
  - [Key Platform Capabilities](#key-platform-capabilities)
- [System Architecture](#system-architecture)
  - [High-Level Topology](#high-level-topology)
  - [Microservice Ecosystem](#microservice-ecosystem)
- [Multi-Tenancy & Security Model](#multi-tenancy--security-model)
  - [PostgreSQL Row-Level Security (RLS)](#postgresql-row-level-security-rls)
  - [Three-Tier Database Role Architecture](#three-tier-database-role-architecture)
  - [Authentication & Token Lifecycle](#authentication--token-lifecycle)
  - [Role Hierarchy & Privilege Escalation Prevention](#role-hierarchy--privilege-escalation-prevention)
  - [API Gateway Ingress Boundary](#api-gateway-ingress-boundary)
- [Technology Stack](#technology-stack)
- [Repository Structure](#repository-structure)
- [Local Development & Quickstart](#local-development--quickstart)
  - [Prerequisites](#prerequisites)
  - [One-Click Launch](#one-click-launch)
  - [Manual Step-by-Step Setup](#manual-step-by-step-setup)
  - [Service Ports & Endpoints](#service-ports--endpoints)
  - [Pre-Seeded Demo Accounts](#pre-seeded-demo-accounts)
- [Testing & Security Verification](#testing--security-verification)
- [10-Phase Project Roadmap](#10-phase-project-roadmap)
- [Architecture Documentation Index](#architecture-documentation-index)
- [License & Security Disclosures](#license--security-disclosures)

---

## About The Project

### The Problem
Traditional school management systems are either brittle legacy monoliths or single-tenant deployments that are expensive to maintain, vulnerable to cross-institution data exposure, and incapable of supporting multi-campus institutional hierarchies. Many platforms rely solely on application-level filtering (`WHERE tenant_id = ?`), which creates severe data leak vulnerabilities whenever an engineer writes an unconstrained SQL query or an ORM misbehaves.

### The Solution
**SchoolEMS** re-engineers educational administration into a secure, commercial-grade SaaS platform:
- **Defense-in-Depth Tenant Isolation:** Multi-tenancy is enforced at the database engine level via PostgreSQL Row-Level Security (RLS). Even if application code has a bug, the database guarantees that Tenant A can never read or mutate Tenant B's records.
- **Hierarchical Governance:** Supports multi-branch school networks (e.g., Main Campus, North Campus) under unified tenant ownership while allowing branch-scoped staff and student permissions.
- **Cryptographic Security:** Built on asymmetric RSA-2048 keypairs, automatic refresh-token family rotation, and append-only database audit logs.
- **Local-First Engineering:** Zero external cloud accounts or paid vendor services are required for development and testing. The complete platform runs locally on standard Docker / WSL / Node.js setups.

### Key Platform Capabilities
1. **Multi-Tenant Foundation & IAM (Phase 1 — Fully Implemented):** Subdomain-based tenant resolution, 7 canonical roles, RS256 token verification, session lifecycle management, and strict role inheritance.
2. **Student Information System (SIS) (Phase 2):** Complete student lifecycle, guardian linking, verifiable consent workflows, and demographic records.
3. **Academic Structure & Scheduling (Phase 3):** Academic years, terms, classes, sections, course catalogs, and collision-free timetable generation.
4. **Attendance Management (Phase 4):** Daily classroom attendance, subject-wise tracking, RFID/biometric hardware ingestion, and real-time absence alerts.
5. **Examinations & Grading (Phase 5):** Exam schedules, multi-component grading scales, transcript compilation, and automated report card generation.
6. **Fee Management & Invoicing (Phase 6):** Fee structure allocation, scholarship/concession discounts, scheduled installments, receipt generation, and offline/online reconciliation.
7. **Parent & Student Portals (Phase 7):** Responsive self-service portals for grades, homework, fee payments, and institution announcements.
8. **Operations & Fleet Management (Phase 8):** School bus transport route tracking, hostel room allotments, library book management, and broadcast notifications.
9. **Operational Intelligence & AIOps (Phase 9):** Automated performance analytics, proactive at-risk student detection, anomaly monitoring, and operational assistants.
10. **Enterprise Cloud Deployment (Phase 10):** Production AWS infrastructure with Terraform, Amazon EKS, Aurora PostgreSQL Serverless v2, and GitOps pipelines.

---

## System Architecture

### High-Level Topology

```
                              [ CLIENT TRAFFIC ]
                         (Browser / Mobile Web App)
                                     │
                      Host: apex.example (or custom domain)
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │   school-gateway (Port 8080)  │
                     │  - Reverse Proxy (HTTP)       │
                     │  - Host-based Tenant Resolver │
                     │  - Header Sanitization        │
                     │  - Rate Limiting              │
                     └───────────────┬───────────────┘
                                     │
            X-Tenant-Domain / X-Tenant-Id / X-Gateway-Secret
                                     │
          ┌──────────────────────────┴──────────────────────────┐
          ▼                                                     ▼
┌──────────────────────────────┐              ┌─────────────────────────────────┐
│ school-frontend (Port 5173)  │              │  identity-service (Port 4001)   │
│ - React 18 + Vite SPA        │              │  - User Auth & RS256 Signing    │
│ - Tenant-aware session state │              │  - Multi-Tenant & Branch IAM    │
│ - Role-based route guards    │              │  - Session Token Rotation       │
└──────────────────────────────┘              │  - RBAC Permission Enforcement  │
                                              └────────────────┬────────────────┘
                                                               │
                                               PostgreSQL Connection Pool
                                               (Role: school_app_user)
                                                               │
                                                               ▼
                                              ┌─────────────────────────────────┐
                                              │       PostgreSQL 18+ DB         │
                                              │  Database: auth_db              │
                                              │  - Row-Level Security (RLS)     │
                                              │  - Three-tier Role Hierarchy    │
                                              │  - Append-only Audit Logs       │
                                              └─────────────────────────────────┘
```

### Microservice Ecosystem

| Service | Port | Status | Primary Responsibilities |
| :--- | :---: | :---: | :--- |
| **`school-gateway`** | `8080` | **Active** | API entrypoint, host/subdomain tenant resolution, header stripping, rate limiting. |
| **`identity-service`** | `4001` | **Active** | Tenant onboarding, user authentication, RS256 token issuance, RBAC, session rotation. |
| **`student-records-service`** | `4002` | *Roadmap* | Admissions, student profiles, guardian relationships, staff records. |
| **`academic-service`** | `4003` | *Roadmap* | Classes, sections, subjects, timetables, and academic year enrollment. |
| **`finance-service`** | `4004` | *Roadmap* | Fee categories, payment ledger, invoicing, concessions, and reconciliations. |
| **`operations-service`** | `4005` | *Roadmap* | Attendance tracking, notifications, transport routes, and facilities. |
| **`school-frontend`** | `5173` | **Active** | React 18 SPA with tenant branding, role portals, and authentication views. |

---

## Multi-Tenancy & Security Model

### PostgreSQL Row-Level Security (RLS)
The database engine enforces isolation on every table containing tenant data (`branches`, `academic_years`, `roles`, `user_tenant_memberships`, `domains`, `audit_logs`, etc.). 

Every application transaction initializes the session context using a parameterized helper:
```sql
SET LOCAL app.current_tenant_id = '01912345-6789-7abc-def0-123456789abc';
```

RLS policies evaluate this setting dynamically. If `app.current_tenant_id` is missing, blank, or invalid, the policy **fails closed**:
```sql
CREATE POLICY tenant_isolation_policy ON branches
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```
Direct queries executed without the proper tenant context return zero rows.

### Three-Tier Database Role Architecture
To guarantee that the running application cannot alter database schemas or bypass RLS policies, SchoolEMS divides database operations across three distinct PostgreSQL roles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATABASE PRIVILEGE MODEL                        │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ Role                     │ Attributes              │ Allowed Actions   │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ school_schema_owner      │ NOLOGIN                 │ Owns all tables,  │
│                          │ NOBYPASSRLS             │ sequences, and    │
│                          │                         │ RLS policies.     │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ school_migration_user    │ LOGIN (Migrations only) │ Can execute       │
│                          │ Inherits schema owner   │ SET ROLE          │
│                          │ via SET ROLE            │ school_schema_owner│
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ school_app_user          │ LOGIN (Runtime app)     │ SELECT, INSERT,   │
│                          │ NOBYPASSRLS             │ UPDATE, DELETE    │
│                          │ Cannot assume owner     │ on data tables.   │
│                          │                         │ INSERT only on    │
│                          │                         │ audit_logs.       │
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

### Authentication & Token Lifecycle
- **Asymmetric RS256 Tokens:** Access tokens are signed using RSA-2048 private keys (`PEM`) and verified using matching public keys. Downstream microservices only need the public key to authenticate requests.
- **Key Rotation Registry:** Tokens include a `kid` (Key ID) header, enabling seamless cryptographic key rotation across microservices without downtime.
- **Refresh Token Family Rotation:** Refresh tokens are cryptographically random strings stored as SHA-256 hashes. Each refresh generates a new token and revokes the predecessor. If a previously consumed token is presented again (replay attack), the entire session family is instantly revoked.
- **Independent Platform SuperAdmin:** Platform SuperAdmins are stored in an isolated `platform_admins` table. They cannot be granted, invited, or modified via ordinary tenant membership APIs.

### Role Hierarchy & Privilege Escalation Prevention
SchoolEMS defines 7 canonical roles with strict delegation boundaries:

```
[ Platform SuperAdmin ] ──────────► Manages tenants, platform global configuration
          │
          ▼
   [ SchoolAdmin ] ──────────────► Manages school settings, campuses, staff & roles
          │
          ▼
    [ Principal ] ───────────────► Academic head; manages teachers, classes, curriculum
          │
          ├────────────────────────┬────────────────────────┐
          ▼                        ▼                        ▼
     [ Teacher ]             [ Accountant ]           [ FrontDesk ]
          │
          ├────────────────────────┐
          ▼                        ▼
     [ Student ]               [ Parent ]
```

* **Delegation Guardrails:** A `SchoolAdmin` cannot invite or assign a `SuperAdmin`. A `Principal` cannot grant `SchoolAdmin` or `SuperAdmin`. Self-promotion is strictly rejected (`403 Forbidden`).

### API Gateway Ingress Boundary
The `school-gateway` acts as the single public entrypoint:
- **Host Resolution:** Inspects incoming `Host` headers (`apex.example` -> Tenant ID) against verified domains in `auth_db`.
- **Anti-Spoofing Header Sanitization:** Automatically strips all incoming client `X-Verified-*` headers case-insensitively before proxying.
- **Gateway Secret:** Injects an internal `X-Gateway-Secret` so upstream services can verify traffic originated from the trusted gateway.

---

## Technology Stack

| Layer | Technology | Details |
| :--- | :--- | :--- |
| **Frontend UI** | **React 18 + Vite** | Single Page Application with React Router 6, Tailwind/CSS modules, and Lucide icons. |
| **API Gateway** | **Node.js + Express** | High-performance reverse proxy using `http-proxy-middleware` and custom tenant resolution. |
| **Microservices** | **Node.js 20+ LTS** | Modular Express microservices adhering to Domain-Driven Design (DDD). |
| **Database** | **PostgreSQL 18** | Relational data persistence with native Row-Level Security (RLS) and UUID v4/v7. |
| **Data Access** | **Knex.js + pg** | SQL query builder, deterministic migration engine, and connection pooling. |
| **Auth & Crypto** | **RS256 + Bcrypt + SHA-256** | Asymmetric RSA-2048 token signing (`jsonwebtoken`), salted password hashing (`bcryptjs`). |
| **Dev Tooling** | **PowerShell, Bash, WSL 2** | One-click developer orchestration scripts (`start-dev.ps1`, `start-dev.sh`). |
| **Test Runner** | **Node.js Native Test (`node:test`)** | Ultra-fast unit, integration, and security regression suite (0 external test dependencies). |
| **Future Cloud (AWS)** | **EKS + Aurora + S3 + SQS** | *Target Phase 10:* Kubernetes container orchestration, Aurora Serverless v2, encrypted S3 buckets. |

---

## Repository Structure

```
schoolEMS/
├── start-dev.ps1                 # One-click Windows PowerShell local dev launcher
├── start-dev.sh                  # One-click Linux/macOS Bash local dev launcher
├── docs/                         # Engineering specifications & audit records
│   ├── phase-1/                  # Phase 1 architecture, security, and test reports
│   │   ├── 01-phase-1-architecture.md
│   │   ├── 02-database-schema.md
│   │   ├── 03-tenant-isolation-design.md
│   │   ├── 04-authentication-and-jwt.md
│   │   ├── 05-rbac-permissions-matrix.md
│   │   ├── 06-api-contracts.md
│   │   ├── 07-security-controls.md
│   │   ├── 12-integration-validation-report.md
│   │   ├── 13-independent-security-review.md
│   │   └── 14-security-remediation-report.md
│   └── school-management-migration/ # Master 10-phase migration architecture
│       ├── 04-target-school-saas-architecture.md
│       ├── 05-multi-tenancy-design.md
│       ├── 06-database-architecture.md
│       └── 11-implementation-roadmap.md
├── projects/
│   └── telugu-pickles/           # Application Workspace (Actively modernizing to SchoolEMS)
│       ├── frontend/             # React 18 + Vite Frontend Application
│       │   ├── src/
│       │   │   ├── components/   # UI components, Navigation, Role guards
│       │   │   ├── context/      # AuthContext and TenantContext
│       │   │   └── pages/        # Login, Portal, and Administrative views
│       │   └── package.json
│       └── services/             # Backend Services Workspace
│           ├── common/           # Shared core libraries
│           │   ├── auth.js       # RS256 token issuance, key validation & rotation
│           │   ├── db.js         # PostgreSQL pool & withTenantContext RLS helper
│           │   └── service.js    # Express bootstrap, CORS, metrics, tenant extractor
│           ├── gateway/          # API Gateway (Port 8080)
│           ├── auth-service/     # Identity & Access Management Service (Port 4001)
│           │   ├── migrations/   # Knex migrations 01 through 07
│           │   ├── seeds/        # Bootstrap & dev seeding scripts
│           │   └── src/          # Auth routes, session management, membership APIs
│           ├── test/             # Automated test suite (56 automated tests)
│           └── package.json
```

---

## Local Development & Quickstart

SchoolEMS is built **local-first**. No cloud subscriptions, AWS credentials, or third-party paid services are needed to run, test, and inspect the platform locally.

### Prerequisites
- **Node.js:** `>= 20.0.0`
- **npm:** `>= 10.0.0`
- **PostgreSQL:** `>= 16.0` (Running locally on port `5432` or via WSL Ubuntu)

### One-Click Launch

#### Windows (PowerShell)
```powershell
.\start-dev.ps1
```

#### Linux / macOS / WSL (Bash)
```bash
chmod +x ./start-dev.sh
./start-dev.sh
```

The script automatically ensures PostgreSQL is running, applies pending database migrations, and boots the Gateway (`:8080`), Auth Service (`:4001`), and Vite Frontend (`:5173`) concurrently.

---

### Manual Step-by-Step Setup

If you prefer to run services individually:

#### 1. Configure Environment
```bash
cd projects/telugu-pickles/services
cp .env.example .env
```
Default configuration connects to local PostgreSQL at `127.0.0.1:5432` with username `postgres` and database `auth_db`.

#### 2. Run Database Migrations
```bash
npm run migrate
```
Executes all 7 foundational migrations:
1. `create_tenants_and_branches`
2. `create_users_and_memberships`
3. `create_rbac_tables`
4. `create_domains_and_sessions`
5. `create_audit_logs`
6. `enable_rls_and_policies`
7. `create_platform_admins`

#### 3. Seed Demo Data & Bootstrap
```bash
# Seed demo schools (Apex Academy and Horizon International)
npm run seed:demo-schools

# (Optional) Seed platform SuperAdmin account
npm run seed:superadmin
```

#### 4. Launch Services
```bash
# In projects/telugu-pickles/services
npm run dev
```

---

### Service Ports & Endpoints

| Service | Local URL | Health Check / Entrypoint |
| :--- | :--- | :--- |
| **Frontend UI** | `http://localhost:5173` | Interactive Web Application |
| **API Gateway** | `http://localhost:8080` | `http://localhost:8080/api/health` |
| **Identity Service** | `http://localhost:4001` | `http://localhost:4001/health` |
| **PostgreSQL Database**| `127.0.0.1:5432` | Database: `auth_db` |

---

### Pre-Seeded Demo Accounts

When `npm run seed:demo-schools` is executed, the following pre-configured demonstration accounts are available (Default password: `DemoPassword@2026`):

| Organization | Persona | Email | Domain / Host Context |
| :--- | :--- | :--- | :--- |
| **Apex Academy** | School Admin | `admin@apex.example` | `apex.example` |
| **Apex Academy** | Teacher | `teacher@apex.example` | `apex.example` |
| **Apex Academy** | Student | `student@apex.example` | `apex.example` |
| **Horizon International** | School Admin | `admin@horizon.example` | `horizon.example` |
| **Platform-Wide** | SuperAdmin | `superadmin@schoolsaas.internal` | Platform Root / Global |

---

## Testing & Security Verification

SchoolEMS maintains an automated, zero-external-dependency test suite utilizing Node.js's native test runner (`node:test`).

```bash
cd projects/telugu-pickles/services
npm test
```

### Test Coverage Highlights (56 Passing Tests)
- **RS256 Asymmetric Token Suite (15 Tests):** Validates keypair generation, algorithm confusion prevention (strict rejection of HS256), UUID format assertions, signature roundtrips, and cryptographic key rotation.
- **PostgreSQL Migration & Rollback Suite (4 Tests):** Confirms sequential DDL execution under `school_schema_owner`, idempotency, and flawless rollback behavior.
- **Row-Level Security Verification (4 Tests):** Connects as unprivileged `school_app_user` (`NOBYPASSRLS`) to prove that queries across tenant boundaries return empty sets or fail.
- **Negative Security & Escalation Suite (19 Tests):**
  - **C-01:** Proves non-admin users cannot log in at the platform root without tenant context.
  - **H-01:** Proves `SchoolAdmin` and `Principal` users cannot escalate privileges or assign unauthorized administrative roles.
  - **H-02:** Proves mismatched or invalid RSA keypairs fail fast at startup.
  - **M-02 & L-02:** Proves untrusted client headers are stripped and unauthorized reverse proxy headers are discarded.
- **API Integration & Session Suite (14 Tests):** Validates tenant onboarding, campus branch creation, role assignment, and refresh token family compromise revocation.

```
✔ API: SuperAdmin onboards Tenant A (Apex Academy) and Tenant B (Horizon) (369ms)
✔ RS256 token: signs and verifies with valid UUID claims (11ms)
✔ Real PostgreSQL RLS Tests: Multi-Tenant Data Isolation with school_app_user (68ms)
✔ Security C-01.1: Ordinary user cannot log in at platform root without tenant context (810ms)
✔ Security H-01.1: SchoolAdmin cannot invite someone with role SuperAdmin (1.7ms)
✔ Security H-02.4: validateKeypair rejects mismatched RSA keypairs (80ms)
✔ Security L-02: Gateway strips all X-Verified-* headers case-insensitively (0.1ms)
ℹ tests 56 | suites 0 | pass 56 | fail 0 | cancelled 0 | skipped 0
```

---

## 10-Phase Project Roadmap

The transformation of this platform follows a rigorous zero-regression, 10-phase delivery roadmap:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 10-PHASE ROADMAP STATUS                                │
├──────────┬──────────────────────────────────────────┬──────────────┬───────────────────┤
│ Phase    │ Scope & Deliverables                     │ Status       │ Automated Tests   │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 0  │ Repository Audit & Master Architecture   │ Completed    │ Verification pass │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 1  │ Multi-Tenant Foundation & Identity IAM   │ Completed    │ 56/56 Passing     │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 2  │ School, Student & Staff Management (SIS) │ In Planning  │ Target Phase 2    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 3  │ Academic Structure & Timetable Engine    │ Backlog      │ Target Phase 3    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 4  │ Attendance Management (Biometric/RFID)   │ Backlog      │ Target Phase 4    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 5  │ Examination, Grading & Report Cards      │ Backlog      │ Target Phase 5    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 6  │ Fee Management & Financial Accounting    │ Backlog      │ Target Phase 6    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 7  │ Guardian & Student Self-Service Portals  │ Backlog      │ Target Phase 7    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 8  │ Transport, Hostel & School Operations    │ Backlog      │ Target Phase 8    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 9  │ Kira AIOps & Educational Analytics       │ Backlog      │ Target Phase 9    │
├──────────┼──────────────────────────────────────────┼──────────────┼───────────────────┤
│ Phase 10 │ Production AWS EKS & Aurora Hardening    │ Backlog      │ Target Phase 10   │
└──────────┴──────────────────────────────────────────┴──────────────┴───────────────────┘
```

---

## Architecture Documentation Index

Comprehensive design specifications and audit reports are documented in the `docs/` tree:

### Phase 1 Specifications & Verification
- [01: Phase 1 Architecture Specification](docs/phase-1/01-phase-1-architecture.md) — Multi-tenant foundation blueprint.
- [02: Database Schema Specification](docs/phase-1/02-database-schema.md) — 7 migration schemas and constraints.
- [03: Tenant Isolation Design](docs/phase-1/03-tenant-isolation-design.md) — PostgreSQL RLS policies and session variables.
- [04: Authentication & JWT Architecture](docs/phase-1/04-authentication-and-jwt.md) — RS256 token signing and refresh rotation.
- [05: RBAC Permissions Matrix](docs/phase-1/05-rbac-permissions-matrix.md) — Granular permissions across 7 roles.
- [06: API Contracts Specification](docs/phase-1/06-api-contracts.md) — Endpoints, request schemas, and responses.
- [07: Security Controls & Hardening](docs/phase-1/07-security-controls.md) — Gateway defenses and audit logs.
- [12: Integration Validation Report](docs/phase-1/12-integration-validation-report.md) — 37 integration test suite results.
- [13: Independent Security Review](docs/phase-1/13-independent-security-review.md) — Formal review detailing C-01, H-01, H-02, M-01, M-02.
- [14: Security Remediation Report](docs/phase-1/14-security-remediation-report.md) — Final remediation proofs bringing test count to 56/56.

### Master Architecture Blueprints
- [04: Target School Management SaaS Architecture](docs/school-management-migration/04-target-school-saas-architecture.md) — Target state topology and services.
- [05: Multi-Tenancy Design](docs/school-management-migration/05-multi-tenancy-design.md) — Deep dive into isolation strategies.
- [06: Database Architecture](docs/school-management-migration/06-database-architecture.md) — Aurora PostgreSQL schemas and role models.
- [11: Phased Implementation Roadmap](docs/school-management-migration/11-implementation-roadmap.md) — Master 10-phase execution plan.

---

## License & Security Disclosures

This project is licensed under the MIT License.  
For responsible disclosure of security vulnerabilities or multi-tenant isolation concerns, please review [docs/phase-1/07-security-controls.md](docs/phase-1/07-security-controls.md) or open an advisory issue in the repository.
