# Document 13: Phase 1 Independent Source-Code Security & Architecture Review

**Document Status:** COMPLETED & AUDITED  
**Classification:** Security Architecture & Vulnerability Assessment  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026  
**Auditor:** Principal Security Engineer & Independent Software Architect  
**Final Decision:** **PASS WITH CONDITIONS**  

---

## 1. Executive Summary

An independent, read-only security and architectural review of the completed Phase 1 Multi-Tenant Foundation and Identity Service was conducted on branch `feature/phase-1-identity`.

While the previous integration validation report confirmed that all 37 tests passed against PostgreSQL 18.6 with real Row-Level Security (RLS) enforcement and live HTTP routing, this independent code audit verified whether the architectural guarantees hold up against hostile input, edge-case authentication flows, and privilege escalation scenarios.

### Summary of Findings
| Severity | Count | Key Area |
| :--- | :---: | :--- |
| **CRITICAL** | 1 | Platform-level login automatically grants `SuperAdmin` role to any authenticated user. |
| **HIGH** | 2 | Unrestricted role assignment allows `Principal`/`SchoolAdmin` to assign `SuperAdmin`; Missing fail-fast check for production asymmetric keys. |
| **MEDIUM** | 3 | Hardcoded DDL credentials; Direct upstream ingress header trust; SuperAdmin bootstrap lacks database role mapping. |
| **LOW** | 2 | Stateless 15-minute access token invalidation window; Gateway header sanitization omissions. |
| **INFORMATIONAL** | 1 | Schema owner assignment dependent on environment variable in local migration runner. |

---

## 2. Repository & Branch Integrity Verification

* **Current Branch:** `feature/phase-1-identity`
* **Upstream:** `origin/feature/phase-1-identity` (synchronized at commit `9e8d448`)
* **Working Tree State:** Completely clean (`git status --short` returns 0 modified files).
* **Commit Lineage:**
  - `9e8d448` `test(phase-1): add real PostgreSQL RLS & HTTP integration suites, apply security gate fixes, and generate validation report`
  - `b823f0a` `refactor(frontend): execute batch 1 cleanup of legacy e-commerce components and routes`
  - `471348b` `feat(phase-1): implement multi-tenant identity service, RS256 auth, knex migrations, RLS context, and automated tests`
  - `6ff3ce3` `docs(phase-1): apply final specification fixes for migration ownership, RFC domains, and RLS breakdown`
  - `76a6333` `docs(phase-1): incorporate final security corrections into Phase 1 specifications`
  - `ca97383` `chore: baseline repository snapshot prior to Phase 1`
* **Legacy E-Commerce Protection:** Zero files modified or deleted in `catalog-service`, `cart-service`, `orders-service`, or `payments-service`.
* **Credential Hygiene:** No `.env`, `*.pem`, `*.key`, `.bootstrap-credentials.json`, or database dumps are tracked in Git. Exclusions verified in `.gitignore`.

---

## 3. Database Security & Role Architecture Audit

### 3.1 Knex Migrations (01–06)
- **Migration 01 (`20260301000001_create_tenants_and_branches.js`):** Creates `tenants` and `branches`. Foreign key constraint `branches.tenant_id REFERENCES tenants(id) ON DELETE RESTRICT` prevents accidental cascading destruction of campus branches when deleting a tenant. Unique constraint on `(tenant_id, code)` enforces uniqueness within a school.
- **Migration 02 (`20260301000002_create_users_and_memberships.js`):** Backward-compatible upgrade of legacy `users` table via `IF NOT EXISTS` column additions (`full_name`, `status`, `email_verified_at`, `last_login_at`, `updated_at`). Down migration drops `user_tenant_memberships` but preserves `users` table and historical data.
- **Migration 03 (`20260301000003_create_rbac_tables.js`):** Correctly confines Phase 1 permissions to tenancy, campus, identity, membership, and session operations. No future academic or financial permissions are present. Seeds the 7 standard system roles (`SuperAdmin`, `SchoolAdmin`, `Principal`, `Teacher`, `Accountant`, `Student`, `Parent`).
- **Migration 04 (`20260301000004_create_domains_and_sessions.js`):** Provisions `tenant_domains` and `refresh_tokens`. Includes single-domain uniqueness and SHA-256 token hashing index.
- **Migration 05 (`20260301000005_create_audit_logs.js`):** Append-only audit log table with foreign keys `ON DELETE SET NULL`.
- **Migration 06 (`20260301000006_enable_rls_and_policies.js`):** Establishes the 3-tier role hierarchy:
  - `school_schema_owner`: `NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE`.
  - `school_migration_user`: `LOGIN IN ROLE school_schema_owner`.
  - `school_app_user`: `LOGIN NOBYPASSRLS`.
  - Grants on `audit_logs`: strictly `INSERT` and `SELECT`. `UPDATE`, `DELETE`, and `TRUNCATE` are revoked.

### 3.2 Evaluation of Guarantees
- The runtime application user (`school_app_user`) does NOT own tables and has `NOBYPASSRLS`.
- `knexfile.js` contains `pool.afterCreate` hook:
  ```javascript
  const user = process.env.PG_MIGRATION_USER || process.env.PGUSER;
  if (user === 'school_migration_user' || process.env.SET_SCHEMA_OWNER === 'true') {
    conn.query('SET ROLE school_schema_owner;', (err) => done(err, conn));
  }
  ```
  This guarantees that migrations executed as `school_migration_user` assign table ownership to `school_schema_owner`.

---

## 4. PostgreSQL Row-Level Security (RLS) Audit

### 4.1 Policy Definitions & Table Coverage
RLS is enabled and forced on 3 tables: `branches`, `user_tenant_memberships`, and `membership_roles`.

```sql
CREATE POLICY tenant_isolation_branches ON branches
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```
- **SELECT Enforcement (`USING`):** Evaluates `tenant_id = NULLIF(...)`. If context is missing or empty, `NULLIF` yields `NULL`, evaluating to `NULL` (falsy) — fail-closed.
- **INSERT Enforcement (`WITH CHECK`):** Evaluates new record `tenant_id`. Cross-tenant insert throws an immediate RLS violation.
- **UPDATE Enforcement (`USING` & `WITH CHECK`):** `USING` prevents selecting or updating another tenant's rows (0 rows affected). `WITH CHECK` prevents reassigning a tenant's row to another tenant ID (`tenant_id = new_tenant_id`).
- **DELETE Enforcement (`USING`):** Cross-tenant delete affects 0 rows.
- **Indirect RLS (`membership_roles`):**
  Uses subquery:
  ```sql
  USING (membership_id IN (
    SELECT id FROM user_tenant_memberships
    WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  ))
  ```
  Enforces tenant boundary on roles through parent membership record.

### 4.2 Context Helper & Connection Pool Hygiene (`common/db.js`)
`withTenantContext(poolOrClient, tenantId, callback)`:
1. Validates `tenantId` format against RFC UUID regex (`UUID_REGEX`) before acquiring a database client.
2. Parameterized execution: `SELECT set_config($1, $2, $3)` with `['app.current_tenant_id', tenantId, true]`. Setting is strictly transaction-scoped (`is_local = true`).
3. Explicit `COMMIT` and `ROLLBACK` handling with rethrown exceptions.
4. `finally` block executes session variable reset: `SELECT set_config('app.current_tenant_id', '', false)` and releases the client. Connection pool reuse does not leak tenant context across clients.

---

## 5. Gateway and Tenant Resolution Audit

### 5.1 Gateway Implementation (`gateway/src/index.js`)
- **Forwarded Host Stripping:** Line 45 unconditionally executes:
  ```javascript
  delete req.headers['x-forwarded-host'];
  ```
- **Authoritative Inbound Host Injection:** Line 113 injects the verified TCP Host header:
  ```javascript
  if (req.headers.host) {
    proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
  }
  ```
- **Header Tampering Defense:** Lines 46–49 strip `x-tenant-domain` and `x-tenant-id` when `NODE_ENV === 'production'`.

### 5.2 Tenant Resolver (`auth-service/src/middleware/tenant-resolver.js`)
- Strips port numbers correctly (`hostHeader.split(':')[0].toLowerCase().trim()`).
- In production, `ALLOW_HEADER_TENANT_RESOLVER` cannot be enabled because the check requires `NODE_ENV === 'development'`.
- Database lookup verifies `verification_status = 'verified'` and rejects suspended tenants with `403 TENANT_SUSPENDED`.

---

## 6. Authentication and Session Security Audit

### 6.1 Cryptographic Tokens (`common/auth.js`)
- **Algorithm Segregation:** Enforces `decodedHeader.header.alg === 'RS256'`. Legacy `HS256` tokens are rejected with `Invalid token algorithm: strictly RS256 required`.
- **Key Identifier Verification:** Verifies `decodedHeader.header.kid === SCHOOL_KEY_ID`.
- **UUID Format Claim Validation:** Validates `sub`, `tenant_id`, `membership_id`, and `branch_id` against UUID regex in both `signSchoolToken` and `verifySchoolToken`.
- **Claims Verification:** Built-in validation of `issuer` (`https://auth.schoolsaas.com`), `audience` (`schoolsaas-api`), and expiration.

### 6.2 Refresh Token Family & Compromise Detection (`auth.js`)
- Refresh tokens are generated as 40-byte cryptographically secure random bytes and stored as SHA-256 hashes (`token_hash`).
- Each refresh chain is assigned a `family_id` (UUID).
- On `/api/v1/auth/refresh`:
  - If a token with `revoked_at IS NOT NULL` is submitted, the system flags a replay attack, immediately revokes ALL active tokens sharing the same `family_id`, and returns `401 SESSION_COMPROMISED`.
  - Legitimate refresh revokes the old token (`replaced_by = newTokenHashed`), creates a new token in the same family, issues a new 15-minute RS256 access token, and emits a rotated `tp_refresh` cookie (`httpOnly: true`, `secure: production`, `sameSite: 'strict'`, `path: '/api/v1/auth'`).

---

## 7. Detailed Findings & Vulnerability Register

### Finding C-01: Platform-Level Login Vulnerability Grants `SuperAdmin` to Any User
* **Severity:** **CRITICAL**
* **Location:** [`projects/telugu-pickles/services/auth-service/src/routes/v1/auth.js#L102-L113`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/src/routes/v1/auth.js#L102-L113)
* **Evidence:**
  ```javascript
  } else {
    // Platform level login (SuperAdmin only)
    const { rows: saRows } = await pool.query(
      `SELECT r.role_key
       FROM roles r
       WHERE r.role_key = 'SuperAdmin' AND r.tenant_id IS NULL`
    );
    if (saRows.length > 0) {
      roles = ['SuperAdmin'];
    } else {
      return sendError(res, 'TENANT_REQUIRED', 'School tenant context required', 400, null, req);
    }
  }
  ```
* **Vulnerability Description:** When a user logs in without a tenant subdomain (e.g. at `schoolsaas.com` or via direct API call without `Host` matching a tenant), the system attempts to authenticate a platform SuperAdmin. However, the query merely checks whether the `SuperAdmin` role exists in the `roles` table. It does NOT check whether `user.id` is associated with that role. Because the `SuperAdmin` system role always exists (seeded in migration 03), `saRows.length > 0` evaluates to `true` for **any registered user** who enters valid credentials, granting them full `SuperAdmin` access across the entire platform.
* **Remediation:** Introduce a database-backed platform role mechanism (e.g. `users.is_superadmin BOOLEAN DEFAULT false` column or a dedicated `platform_superadmins` table). Check `SELECT 1 FROM platform_superadmins WHERE user_id = $1` or `WHERE id = $1 AND is_superadmin = true`.

---

### Finding H-01: Unrestricted Role Assignment Privilege Escalation
* **Severity:** **HIGH**
* **Location:** [`projects/telugu-pickles/services/auth-service/src/routes/v1/memberships.js#L63-L77`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/src/routes/v1/memberships.js#L63-L77) and [`L224-L244`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/src/routes/v1/memberships.js#L224-L244)
* **Evidence:**
  ```javascript
  const { rows: roleRows } = await client.query(
    `SELECT id, role_key FROM roles WHERE role_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL) LIMIT 1`,
    [roleKey, tenantId]
  );
  ```
* **Vulnerability Description:** Both `POST /api/v1/memberships/invite` (accessible by `Principal` and `SchoolAdmin`) and `POST /api/v1/memberships/:id/roles` (accessible by `SchoolAdmin`) accept an arbitrary `roleKey` in the request body. Because system roles have `tenant_id IS NULL`, the query successfully returns the role ID for `SuperAdmin`. Consequently:
  1. A `SchoolAdmin` or `Principal` can invite or assign a user with `roleKey: 'SuperAdmin'`, granting platform-wide privileges.
  2. A `Principal` can promote another user to `SchoolAdmin`.
* **Remediation:** Enforce role hierarchy and disallow assignment of `SuperAdmin` via tenant-level membership endpoints. Filter assignable roles:
  ```javascript
  const ASSIGNABLE_ROLES = {
    SchoolAdmin: ['Principal', 'Teacher', 'Accountant', 'Student', 'Parent'],
    Principal: ['Teacher', 'Student', 'Parent'],
  };
  ```

---

### Finding H-02: Missing Production Fail-Fast for Asymmetric RSA Keypair
* **Severity:** **HIGH**
* **Location:** [`projects/telugu-pickles/services/common/auth.js#L49-L62`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/common/auth.js#L49-L62)
* **Evidence:**
  ```javascript
  let privateKey = process.env.JWT_PRIVATE_KEY;
  let publicKey = process.env.JWT_PUBLIC_KEY;

  if (!privateKey || !publicKey) {
    // Generate development/ephemeral RSA 2048 keypair
    const keyPair = crypto.generateKeyPairSync('rsa', { ... });
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
  }
  ```
* **Vulnerability Description:** In `common/auth.js`, line 9 enforces that `JWT_SECRET` must be set in production, but there is no equivalent check for `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`. If the identity service starts in production without these environment variables, it silently generates an in-memory ephemeral RSA keypair. In a horizontally scaled container deployment (e.g., Kubernetes with 2+ replicas), each pod will have a different keypair, causing valid tokens signed by Pod A to fail verification on Pod B, and all user sessions to be invalidated on container restart.
* **Remediation:** Add a fail-fast check:
  ```javascript
  if ((!process.env.JWT_PRIVATE_KEY || !process.env.JWT_PUBLIC_KEY) && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be provided in production');
  }
  ```

---

### Finding M-01: Hardcoded Default Passwords in Migration 06 DDL
* **Severity:** **MEDIUM**
* **Location:** [`projects/telugu-pickles/services/auth-service/migrations/20260301000006_enable_rls_and_policies.js#L20-L30`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/migrations/20260301000006_enable_rls_and_policies.js#L20-L30)
* **Evidence:**
  ```sql
  CREATE ROLE school_migration_user WITH LOGIN PASSWORD 'migration_secure_pass' ...
  CREATE ROLE school_app_user WITH LOGIN PASSWORD 'runtime_secure_pass' ...
  ```
* **Vulnerability Description:** Default fallback passwords are hardcoded in the DDL script. If executed against staging or production databases without prior role creation, predictable credentials will be assigned to administrative database accounts.
* **Remediation:** Ensure migration scripts verify if roles already exist before creating, or use AWS Secrets Manager / Terraform to provision database users prior to running Knex migrations.

---

### Finding M-02: Direct Upstream Ingress Vulnerability (Header Spoofing)
* **Severity:** **MEDIUM**
* **Location:** [`projects/telugu-pickles/services/auth-service/src/middleware/tenant-resolver.js#L28`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/src/middleware/tenant-resolver.js#L28)
* **Evidence:**
  ```javascript
  domain = resolveDomainFromHost(req.headers['x-forwarded-host'] || req.headers['host']);
  ```
* **Vulnerability Description:** `tenant-resolver.js` trusts `req.headers['x-forwarded-host']` without verifying whether the request originated from the internal API Gateway. While the Gateway properly sanitizes external headers, if the `auth-service` container port (4001) is accessible directly on the internal network or via misconfigured ingress, an attacker can supply an arbitrary `X-Forwarded-Host` header to resolve a different school tenant.
* **Remediation:** In production, authenticate requests between Gateway and upstream microservices using a shared secret header (`X-Gateway-Secret`) or Kubernetes NetworkPolicies that block ingress from sources other than the gateway.

---

### Finding M-03: SuperAdmin Bootstrap Lacks Database Role Mapping
* **Severity:** **MEDIUM**
* **Location:** [`projects/telugu-pickles/services/auth-service/seeds/prod/01_superadmin_bootstrap.js#L59-L77`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/seeds/prod/01_superadmin_bootstrap.js#L59-L77)
* **Evidence:** The bootstrap script creates a user in `users`, checks that `SuperAdmin` exists in `roles`, and commits without writing a relationship record.
* **Vulnerability Description:** Because `user_tenant_memberships` requires `tenant_id NOT NULL`, a SuperAdmin (who belongs to the SaaS platform rather than a specific school) cannot be assigned a role in `membership_roles`. This missing relationship in the schema caused the implementation flaw in Finding C-01.
* **Remediation:** Add `is_superadmin BOOLEAN DEFAULT false` to `users` or create a `platform_roles` mapping table, and update `01_superadmin_bootstrap.js` to set `is_superadmin = true`.

---

### Finding L-01: Stateless Access Token Revocation Gap
* **Severity:** **LOW**
* **Location:** [`projects/telugu-pickles/services/common/auth.js#L140-L185`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/common/auth.js#L140-L185)
* **Vulnerability Description:** When a user logs out (`/api/v1/auth/logout`), executes `/logout-all`, or is ejected from a school, their database `refresh_tokens` are revoked immediately. However, existing RS256 access tokens remain cryptographically valid until their 15-minute expiration period expires.
* **Remediation:** Acceptable for Phase 1. In Phase 2/3, introduce a fast token revocation check in Redis or evaluate `user.status` and `membership.status` during high-privilege operations.

---

### Finding L-02: Gateway Header Sanitization Incomplete
* **Severity:** **LOW**
* **Location:** [`projects/telugu-pickles/services/gateway/src/index.js#L44-L49`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/gateway/src/index.js#L44-L49)
* **Vulnerability Description:** The gateway deletes `x-forwarded-host`, `x-tenant-domain`, and `x-tenant-id`, but does not strip `x-verified-*` headers.
* **Remediation:** Add wildcard stripping for `x-verified-*` headers:
  ```javascript
  for (const h of Object.keys(req.headers)) {
    if (h.startsWith('x-verified-')) delete req.headers[h];
  }
  ```

---

### Finding I-01: Local Schema Owner Assignment Depends on Environment Variable
* **Severity:** **INFORMATIONAL**
* **Location:** [`projects/telugu-pickles/services/auth-service/knexfile.js#L15-L22`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/auth-service/knexfile.js#L15-L22)
* **Vulnerability Description:** If migrations are executed locally by a developer using the `postgres` superuser account without setting `SET_SCHEMA_OWNER=true`, the newly created tables will be owned by `postgres` instead of `school_schema_owner`.
* **Remediation:** Configure migration runner scripts to always invoke migrations under the `school_migration_user` account.

---

## 8. Test Quality & Coverage Gap Analysis

### 8.1 Test Inventory Breakdown
The repository test suite contains 37 tests categorized as follows:
- **Unit Tests (11 tests):**
  - RS256 token sign & claim round-trip.
  - Algorithm segregation (RS256 rejects HS256; legacy HS256 rejects RS256).
  - RFC UUID claim format validation (v1, v4, v7).
  - Refresh token generation and SHA-256 hashing.
  - Legacy pricing, cart, and authentication unit tests.
- **Mock-Based Tests (8 tests):**
  - `withTenantContext` transaction execution sequence (`BEGIN` -> `set_config` -> `COMMIT`/`ROLLBACK` -> reset -> release).
  - `tenantResolver` domain parsing, suspended tenant rejection, unknown tenant 404, and development override flag gating.
  - `requireSchoolAuth` role checking, student/parent administrative role blocking, branch scoping.
- **Real PostgreSQL Integration Tests (4 tests / 12 assertions):**
  - Migration 01–06 clean execution and rollback on disposable PostgreSQL database.
  - Legacy `users` table backward compatibility.
  - 3-tier database role verification (`school_schema_owner` NOLOGIN, `school_app_user` NOBYPASSRLS).
  - `audit_logs` append-only privilege verification (INSERT/SELECT only, UPDATE/DELETE/TRUNCATE blocked).
  - Live PostgreSQL RLS tests (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, fail-closed on missing context, connection pool context cleanup).
- **Real HTTP API Integration Tests (5 tests):**
  - SuperAdmin tenant onboarding (Tenant A & B).
  - Branch creation and listing within Tenant A context.
  - Cross-tenant attack blocked with `403 Forbidden` (`Tenant Cross-Talk Blocked`).
  - Member invitation and role assignment.
  - Session refresh token rotation, cookie formatting, and family reuse compromise detection.
- **Security Regression Tests (9 tests):**
  - Validates tamper rejection, missing token 401, algorithm substitution attacks, and cross-talk boundary enforcement.

### 8.2 Missing Negative Tests & Security Gaps
1. **Missing Platform Login Negative Test:** There was no test verifying that a regular school member or student cannot log in at the root platform level without a tenant context. This allowed Finding C-01 to go undetected.
2. **Missing Privilege Escalation Test:** No test verified whether a `Principal` could invite or assign the `SuperAdmin` role.
3. **Missing Production Key Enforcement Test:** No test asserted that `common/auth.js` throws an exception in `NODE_ENV === 'production'` when `JWT_PRIVATE_KEY` is omitted.

---

## 9. Actionable Remediation Checklist (Pre-Deployment & Frontend Gate)

The following items must be resolved before proceeding with frontend integration or production deployment:

1. **[CRITICAL] Fix Platform Login & Add SuperAdmin Identification:**
   - Add `is_superadmin BOOLEAN NOT NULL DEFAULT false` to the `users` table (via Knex migration).
   - In `routes/v1/auth.js`, update platform login to verify:
     ```javascript
     if (!user.is_superadmin) {
       return sendError(res, 'TENANT_REQUIRED', 'School tenant context required', 400, null, req);
     }
     ```
   - Update `seeds/prod/01_superadmin_bootstrap.js` to set `is_superadmin = true`.
2. **[HIGH] Restrict Role Assignment & Prevent Privilege Escalation:**
   - In `routes/v1/memberships.js`, reject any attempt to invite or assign `SuperAdmin` from tenant endpoints.
   - Enforce that `Principal` can only assign non-administrative staff and student roles (`Teacher`, `Student`, `Parent`).
3. **[HIGH] Enforce Production Asymmetric Key Requirements:**
   - In `common/auth.js`, throw a fatal exception if `NODE_ENV === 'production'` and `JWT_PRIVATE_KEY` or `JWT_PUBLIC_KEY` is undefined.
4. **[MEDIUM] Strip Custom Headers at Gateway:**
   - In `gateway/src/index.js`, strip all incoming `x-verified-*` headers.
5. **[MEDIUM] Add Missing Negative Tests:**
   - Add automated test: non-admin platform login rejected with 400.
   - Add automated test: Principal assigning SuperAdmin rejected with 403.
   - Add automated test: production boot without RSA keys throws error.

---

## 10. Final Decision

**DECISION: PASS WITH CONDITIONS**

The foundational multi-tenant isolation, PostgreSQL Row-Level Security architecture, asymmetric RS256 token verification, API Gateway host routing, and refresh token rotation mechanics are well-implemented, secure, and validated against real PostgreSQL engines.

However, deployment to production or exposure of the platform login endpoint is blocked until the 3 Critical/High findings (C-01, H-01, H-02) and their corresponding negative test suites are remediated.
