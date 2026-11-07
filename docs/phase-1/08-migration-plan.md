# Document 08: Database Schema Migration & Rollback Plan

**Document Status:** PHASE 1 IMPLEMENTATION PLAN CORRECTED — READY FOR DEVELOPMENT IMPLEMENTATION  
**Classification:** Database Operations & DevOps Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Final Security Corrections Applied)  

---

## 1. Migration Strategy & Tooling Decision (Knex.js)

To move away from hardcoded raw SQL strings in application startup files while avoiding heavy ORM dependencies, Phase 1 introduces **Knex.js** as the standardized SQL-first migration engine.

### Core Migration Principles
1. **Scope Boundary:** Migrations apply **strictly to `auth_db`**. The e-commerce databases (`catalog_db`, `cart_db`, `orders_db`, `payments_db`) are not touched.
2. **Controlled Migration Role:** Migrations execute as `school_migration_user` (which belongs to `school_schema_owner`), not as the PostgreSQL superuser.
3. **Idempotent & Transactional:** Every migration runs inside a PostgreSQL transaction (`BEGIN ... COMMIT`). If any statement fails, the entire migration rolls back automatically.
4. **Reversible (Bi-Directional):** Every migration file must export both `up(knex)` and `down(knex)` methods.
5. **Version-Tracked:** The `knex_migrations` table records executed migration timestamps, filenames, and execution batches.
6. **Decoupled from Application Boot:** Migrations are executed via dedicated deployment scripts (`npm run migrate`) or Kubernetes PreSync Jobs, never on ordinary HTTP server startup.

---

## 2. Phase 1 Migration Inventory & Sequence (`auth_db`)

Migrations are located in `projects/telugu-pickles/services/auth-service/migrations/`:

```
projects/telugu-pickles/services/auth-service/migrations/
├── 20260301000001_create_tenants_and_branches.js
├── 20260301000002_create_users_and_memberships.js
├── 20260301000003_create_rbac_tables.js
├── 20260301000004_create_domains_and_sessions.js
├── 20260301000005_create_audit_logs.js
└── 20260301000006_enable_rls_and_policies.js
```

### 2.1 Migration 01: `create_tenants_and_branches.js`
* **`up(knex)`:** Creates `tenants` and `branches` tables with foreign keys and unique constraints.
* **`down(knex)`:** Drops `branches` then `tenants`.

### 2.2 Migration 02: `create_users_and_memberships.js`
* **`up(knex)`:**
  - Non-destructively alters existing `users` table: retains `name`, adds `full_name` (copies from `name`), widens `email` to `VARCHAR(255)`, adds `status`, `email_verified_at`, `last_login_at`, and `updated_at`.
  - Creates `user_tenant_memberships` table.
* **`down(knex)`:** Drops `user_tenant_memberships`; reverts added columns from `users`.

### 2.3 Migration 03: `create_rbac_tables.js`
* **`up(knex)`:** Creates `roles`, `permissions`, `role_permissions`, and `membership_roles`. Seeds Phase 1 canonical permissions and system roles (`SuperAdmin`, `SchoolAdmin`, `Principal`, `Teacher`, `Student`, `Parent`, `Accountant`).
* **`down(knex)`:** Drops `membership_roles`, `role_permissions`, `permissions`, and `roles`.

### 2.4 Migration 04: `create_domains_and_sessions.js`
* **`up(knex)`:** Creates `tenant_domains` and `refresh_tokens`.
* **`down(knex)`:** Drops `refresh_tokens` and `tenant_domains`.

### 2.5 Migration 05: `create_audit_logs.js`
* **`up(knex)`:** Creates append-only `audit_logs` table.
* **`down(knex)`:** Drops `audit_logs`.

### 2.6 Migration 06: `enable_rls_and_policies.js`
* **`up(knex)`:**
  - Sets up the three-tier role structure: `school_schema_owner` (`NOLOGIN`), `school_migration_user`, `school_app_user` (`NOBYPASSRLS`).
  - Sets table-specific grants: DML on operational tables; `INSERT, SELECT` ONLY on `audit_logs`.
  - Enables and forces RLS on Phase 1 tables: `branches`, `user_tenant_memberships`, and `membership_roles`.
  - Creates `tenant_isolation_policy` using `app.current_tenant_id`.
* **`down(knex)`:**
  - Drops RLS policies.
  - Disables RLS on `branches`, `user_tenant_memberships`, and `membership_roles`.

---

## 3. SuperAdmin Bootstrap & Demo Data Seeding Specifications

### 3.1 Production SuperAdmin Bootstrap (`seeds/prod/01_superadmin_bootstrap.js`)
* **Trigger:** `npm run seed:superadmin`
* **Secret Guard:** Must require `BOOTSTRAP_SUPERADMIN_SECRET` (length $\ge 32$). If absent, aborts immediately.
* **Credential Hygiene:**
  * **Never prints generated passwords to CI/CD logs or stdout.**
  * If `SUPERADMIN_PASSWORD` is supplied in the environment, validates complexity and uses it.
  * If generated dynamically, writes credentials to a local permission-restricted file (`.bootstrap-credentials.json`, mode `0600`, listed in `.gitignore`).
* **Idempotency:** Checks `SELECT id FROM users WHERE email = lower($1)`. If SuperAdmin already exists, exits successfully with notice: `SuperAdmin already exists, skipping creation`. Never overwrites existing credentials.

### 3.2 Development Fictional Demo School Seeding (`seeds/dev/02_demo_schools.js`)
* **Trigger:** `npm run seed:demo-schools`
* **Production Guard:** Throws an immediate exception if `NODE_ENV === 'production'`.
* **Fictional Data (RFC 2606 Compliant):**
  * **School A:** *Apex Academy* (`slug: apex-academy`), Campuses: `Main Campus`, `North Campus`. Admin: `admin@apex.example.edu`.
  * **School B:** *Horizon International* (`slug: horizon-intl`), Campus: `Main Campus`. Admin: `admin@horizon.example.edu`.
* **Idempotency:** `ON CONFLICT (slug) DO NOTHING`.
