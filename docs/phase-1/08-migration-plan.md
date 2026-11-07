# Document 08: Database Schema Migration & Rollback Plan

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Database Operations & DevOps Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Migration Strategy & Tooling Decision (Knex.js)

To move away from hardcoded raw SQL strings in application startup files while avoiding heavy ORM dependencies, Phase 1 introduces **Knex.js** as the standardized SQL-first migration engine.

### Core Migration Principles
1. **Scope Boundary:** Migrations apply **strictly to `auth_db`**. The e-commerce databases (`catalog_db`, `cart_db`, `orders_db`, `payments_db`) are not touched.
2. **Idempotent & Transactional:** Every migration runs inside a PostgreSQL transaction (`BEGIN ... COMMIT`). If any statement fails, the entire migration rolls back automatically.
3. **Reversible (Bi-Directional):** Every migration file must export both `up(knex)` and `down(knex)` methods.
4. **Version-Tracked:** The `knex_migrations` table records executed migration timestamps, filenames, and execution batches.
5. **Decoupled from Application Boot:** Migrations are executed via dedicated deployment scripts (`npm run migrate`) or Kubernetes PreSync Jobs, never on ordinary HTTP server startup.

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
  - Non-destructively alters existing `users` table: adds `full_name` (copies from `name`), `status`, `email_verified_at`, `last_login_at`, and `updated_at`.
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
  - Creates `school_app_user` database role with `NOBYPASSRLS`.
  - Enables and forces RLS on Phase 1 tables: `branches`, `user_tenant_memberships`, and `membership_roles`.
  - Creates `tenant_isolation_policy` using `app.current_tenant_id`.
* **`down(knex)`:**
  - Drops RLS policies.
  - Disables RLS on `branches`, `user_tenant_memberships`, and `membership_roles`.

---

## 3. Rollback & Emergency Procedures

If a migration fails or regressions are detected during deployment:
```bash
# Rollback the most recent migration batch
npm run migrate:rollback

# Verify database status
npm run migrate:status
```
*Zero Data Loss Assurance: Migrations modifying existing columns use expand-and-contract patterns; columns are never dropped without a multi-release transition phase.*
