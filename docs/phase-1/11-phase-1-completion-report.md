# Document 11: Phase 1 Pre-Implementation Readiness & Validation Report

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Phase Gate Governance Report  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Executive Summary & Review Affirmation

This report confirms the review and hardening of the Phase 1 architectural specifications for the School Management System (SMS).

In accordance with architectural review instructions:
1. **Existing E-Commerce Preservation:** `catalog_db`, `cart_db`, `orders_db`, and `payments_db` remain completely unmodified, independent, and dedicated to e-commerce. They are **not** repurposed. Future school domains (`academic-service`, `student-records-service`, etc.) will receive dedicated databases (`school_*_db`) in later phases.
2. **Phase 1 Permissions Scope:** The 7 canonical roles are defined, but Phase 1 activates **only** identity, tenancy, branch, session, and audit permissions. Student attendance, grades, parent-child linking, invoices, and fee payments are strictly documented as **Reserved for Later Phases**.
3. **RLS Boundary:** Tenant Row-Level Security is implemented and tested **only** on the Phase 1 tenant-owned tables in `auth_db`.
4. **Hardened Tenant Resolution:** In production, tenant resolution relies strictly on the incoming hostname. `X-Tenant-Domain` fallback is permitted **only** in explicitly configured local development (`NODE_ENV === 'development'` and `ALLOW_HEADER_TENANT_RESOLVER === 'true'`).
5. **No Code Modified Yet:** Zero application code, migrations, or AWS infrastructure resources have been modified or deployed.

---

## 2. Pre-Implementation Validation Plan

### 2.1 Complete List of Files to Be Created or Modified in Phase 1

| File Path | Action | Description / Purpose |
| :--- | :---: | :--- |
| `projects/telugu-pickles/services/package.json` | **Modify** | Add `knex` (`^3.1.0`) and migration scripts (`migrate`, `migrate:rollback`, `seed:superadmin`). |
| `projects/telugu-pickles/services/auth-service/knexfile.js` | **Create** | Knex configuration connecting to `auth_db` for migrations and seeds. |
| `projects/telugu-pickles/services/auth-service/migrations/20260301000001_create_tenants_and_branches.js` | **Create** | Migration: `tenants` and `branches` tables. |
| `projects/telugu-pickles/services/auth-service/migrations/20260301000002_create_users_and_memberships.js` | **Create** | Migration: Non-destructive addition to `users` and creates `user_tenant_memberships`. |
| `projects/telugu-pickles/services/auth-service/migrations/20260301000003_create_rbac_tables.js` | **Create** | Migration: `roles`, `permissions`, `role_permissions`, `membership_roles`. Seeds Phase 1 roles/perms. |
| `projects/telugu-pickles/services/auth-service/migrations/20260301000004_create_domains_and_sessions.js` | **Create** | Migration: `tenant_domains` and `refresh_tokens`. |
| `projects/telugu-pickles/services/auth-service/migrations/20260301000005_create_audit_logs.js` | **Create** | Migration: Append-only `audit_logs` table. |
| `projects/telugu-pickles/services/auth-service/migrations/20260301000006_enable_rls_and_policies.js` | **Create** | Migration: Creates `school_app_user` role and enables RLS on `branches`, `user_tenant_memberships`, `membership_roles`. |
| `projects/telugu-pickles/services/auth-service/seeds/01_superadmin.js` | **Create** | Bootstrap script for platform SuperAdmin. |
| `projects/telugu-pickles/services/auth-service/seeds/02_demo_schools.js` | **Create** | Bootstrap script for Demo School A and Demo School B. |
| `projects/telugu-pickles/services/common/db.js` | **Modify** | Add `withTenantContext` executing `SET LOCAL app.current_tenant_id = $1`. |
| `projects/telugu-pickles/services/common/auth.js` | **Modify** | Add RS256 token signing and verification with multi-tenant claims. |
| `projects/telugu-pickles/services/auth-service/src/index.js` | **Modify** | Add `/api/v1` routes: `/auth/*`, `/tenants/*`, `/branches/*`, `/memberships/*`, `/sessions/*`. Preserve legacy `/auth/*`. |
| `projects/telugu-pickles/services/gateway/src/index.js` | **Modify** | Add hardened tenant resolver (Host-first), strip `X-Verified-*` headers, route `/api/v1/*`. |
| `projects/telugu-pickles/services/test/tenant-resolution.test.js` | **Create** | Automated tests for hardened tenant resolution and header bypass prevention. |
| `projects/telugu-pickles/services/test/tenant-isolation.test.js` | **Create** | Automated tests for cross-tenant isolation and PostgreSQL RLS on `auth_db`. |
| `projects/telugu-pickles/services/test/pool-context.test.js` | **Create** | Automated tests for connection pool context cleanliness. |
| `projects/telugu-pickles/services/test/rbac.test.js` | **Create** | Automated tests for Phase 1 RBAC and branch-scoping rules. |

---

### 2.2 List of Existing Files That Must Remain Untouched

The following files are **explicitly preserved and must not be modified or deleted**:

* **E-Commerce Backend Services:**
  * `projects/telugu-pickles/services/catalog-service/**` (All files, including `products.js`, `index.js`).
  * `projects/telugu-pickles/services/cart-service/**` (All files).
  * `projects/telugu-pickles/services/order-service/**` (All files).
  * `projects/telugu-pickles/services/payment-service/**` (All files).
  * `projects/telugu-pickles/services/common/pricing.js` (E-commerce pricing calculation).
* **Databases & Data Stores:**
  * `catalog_db` (Pickles catalog data).
  * `cart_db` (Shopping cart state).
  * `orders_db` (Order records and line items).
  * `payments_db` (Payment transactions).
* **Frontend Application:**
  * `projects/telugu-pickles/frontend/**` (All React components, pages, CSS, assets).
* **Infrastructure as Code:**
  * `projects/Infrastructure/**` (All Terraform files, modules, state configurations).
* **GitOps & Delivery:**
  * `gitops/**` (All Kubernetes manifests, Kustomize files, Argo Rollouts).
* **Workflows & Scripts:**
  * `.github/workflows/**` (All GitHub Actions pipelines).
  * `scripts/**` (All operational shell scripts).
* **AIOps Engine:**
  * `projects/aiops-assistant/**` (Kira Lambda and Streamlit UI).

---

### 2.3 Exact Database Tables Planned for `auth_db`

| Table Name | Tenant Scoped? | RLS Enforced in Phase 1? | Purpose |
| :--- | :---: | :---: | :--- |
| `tenants` | Platform | No (Admin managed) | School organizations and trusts |
| `branches` | Yes (`tenant_id`) | **YES** | School campuses |
| `users` | Platform | No (Email unique) | Platform-wide user identity accounts |
| `user_tenant_memberships` | Yes (`tenant_id`) | **YES** | User association with schools |
| `roles` | Optional (`tenant_id`) | No (Tenant scoped queries) | Platform and custom tenant roles |
| `permissions` | Platform | No (Global catalog) | Atomic permission keys |
| `role_permissions` | Platform | No (Mapping) | Role-to-permission associations |
| `membership_roles` | Yes (via membership) | **YES** | Role assignments with optional branch scoping |
| `tenant_domains` | Yes (`tenant_id`) | No (Public routing lookup) | Subdomains and custom domains |
| `refresh_tokens` | Yes (via user) | No (Internal auth token store) | Hashed refresh session tokens |
| `audit_logs` | Yes (`tenant_id`) | No (Append-only security log) | Immutable security audit trail |

---

### 2.4 Migration Safety & Rollback Strategy

1. **Pre-Migration Safety:**
   * Existing `users` table in `auth_db` is backed up logically: `CREATE TABLE IF NOT EXISTS users_backup_pre_phase1 AS SELECT * FROM users;`.
   * Migrations run within explicit transactions (`BEGIN ... COMMIT`).
2. **Rollback Strategy:**
   * If any migration fails, Knex rolls back the entire batch automatically.
   * `npm run migrate:rollback` safely executes `down()` methods in reverse order:
     1. `down`: Drops RLS policies on `branches`, `user_tenant_memberships`, `membership_roles`.
     2. `down`: Drops `audit_logs`.
     3. `down`: Drops `refresh_tokens` and `tenant_domains`.
     4. `down`: Drops RBAC tables.
     5. `down`: Reverts column additions on `users`.
     6. `down`: Drops `branches` and `tenants`.
3. **Data Preservation Guarantee:**
   * No existing rows in `users` are dropped or modified destructively.
   * Legacy columns (`id`, `name`, `email`, `phone`, `password_hash`, `created_at`) are preserved.

---

### 2.5 Compatibility Assessment: Auth Service & API Gateway

1. **Existing `auth-service` Compatibility:**
   * Legacy routes (`POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `PUT /auth/me`) are preserved alongside the new versioned routes (`POST /api/v1/auth/login`, etc.).
   * E-commerce frontend calls to `/api/auth/*` continue to function without interruption.
2. **Existing `gateway` Compatibility:**
   * Existing proxy route `/api/auth` $\rightarrow$ `auth-service:4001` remains intact.
   * New proxy route `/api/v1/auth` and `/api/v1/*` routes route to `auth-service:4001`.
   * Gateway health check `/api/health` continues polling all 5 upstream services normally.

---

### 2.6 Security Test Matrix to Prove Tenant Isolation

| Test Case | Target Layer | Expected Result |
| :--- | :--- | :--- |
| **TC-SEC-01** | Gateway Ingress | External request with spoofed `X-Tenant-Domain` in production mode is stripped; tenant resolved strictly from `Host`. |
| **TC-SEC-02** | Gateway Ingress | External request with spoofed `X-Tenant-Id` or `X-Verified-Tenant-Id` is stripped immediately. |
| **TC-SEC-03** | Auth Middleware | User from School A attempting to use JWT at School B domain receives `403 Forbidden`. |
| **TC-SEC-04** | API / Branches | Admin from School A attempting `GET /api/v1/branches/:schoolBBranchId` receives `404 Not Found`. |
| **TC-SEC-05** | API / Tenancy | Admin from School A attempting `PATCH /api/v1/tenants/:schoolBId` receives `403 Forbidden`. |
| **TC-SEC-06** | Database Kernel | Direct query `SELECT * FROM branches;` with `app.current_tenant_id = School_A` returns 0 rows of School B. |
| **TC-SEC-07** | Database Kernel | Direct query `SELECT * FROM branches;` without setting `app.current_tenant_id` fails closed (returns 0 rows). |
| **TC-SEC-08** | Connection Pool | Checking out connection after School A transaction commits reveals `app.current_tenant_id` is clean and unassigned. |

---

### 2.7 Unresolved Decisions & Assumptions

1. **Assumption — Asymmetric Key Provisioning in Dev:** In local development, an RSA 2048-bit keypair will be generated on service boot if environment variables `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` are not set. In production, keys must be passed via AWS Secrets Manager.
2. **Assumption — Redis Availability:** Redis is assumed available in staging/production for distributed rate limiting and token revocation caches. In local development Docker Compose, in-memory token tracking is used as an acceptable fallback.
3. **Unresolved Decision — Custom Domain SSL Termination:** Phase 1 implements database mapping for custom domains (`tenant_domains`), but automated ACM certificate provisioning for third-party custom domains (e.g. via AWS CloudFront / ALB SNI) is deferred to Phase 10.

---

## 3. Governance Sign-Off

The Phase 1 specifications, database schemas, security designs, and test suites have been reviewed and corrected in accordance with all instructions.

**STATUS: DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL.**
