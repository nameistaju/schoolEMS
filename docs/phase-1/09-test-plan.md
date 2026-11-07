# Document 09: Test Plan & Quality Assurance Gates

**Document Status:** PHASE 1 IMPLEMENTATION PLAN CORRECTED — READY FOR DEVELOPMENT IMPLEMENTATION  
**Classification:** Quality Assurance & Security Validation  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Final Security Corrections Applied)  

---

## 1. Quality Assurance Mandate

The Phase 0 audit revealed that the existing repository possesses only two test files with seven total assertions. Phase 1 introduces a comprehensive automated test framework covering authentication, cryptographic tokens, role-based authorization, connection pool hygiene, and database-level Row-Level Security (RLS) enforcement.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1 TESTING PYRAMID                         │
└────────────────────────────────────────────────────────────────────────┘

              [ Security & Penetration Tests ]
              - Production Hostname Resolution Bypass Tests
              - JWT Algorithm Isolation (HS256 vs RS256)
              - Audit Log Immutability (Reject UPDATE/DELETE)
              - Cross-Tenant Data Tampering via RLS
                              │
              [ Integration & API Route Tests ]
              - Gateway Tenant Domain Resolution
              - Cookie Session & Refresh Rotation
              - SuperAdmin & SchoolAdmin Workflows
                              │
              [ Database & RLS Kernel Unit Tests ]
              - Connection Pool Context Cleanup (COMMIT & ROLLBACK)
              - Physical Connection Reuse Isolation
              - Non-privileged Role RLS Enforcement on auth_db
```

---

## 2. Test Suite Specifications

### 2.1 Test Suite 1: Authentication & JWT Isolation (`test/auth.test.js`)
* **TC-AUTH-01 (RS256 Success):** Valid credentials with active tenant domain successfully issues RS256 access token and secure `tp_refresh` cookie.
* **TC-AUTH-02 (Legacy HS256 Rejection on School API):** Presenting a legacy e-commerce HS256 token to any `/api/v1/*` endpoint returns `401 Unauthorized: Invalid token algorithm`.
* **TC-AUTH-03 (School RS256 Rejection on Legacy API):** Presenting an RS256 token to legacy `/auth/me` or `/orders` returns `401 Unauthorized`.
* **TC-AUTH-04 (Alg 'none' Attack):** Presenting a forged token with `{"alg": "none"}` is strictly rejected.
* **TC-AUTH-05 (Issuer & Audience Verification):** Tokens with mismatched `iss` or `aud` return 401.
* **TC-AUTH-06 (Expired Access Token):** Access token expires after 15 minutes; expired token returns 401.
* **TC-AUTH-07 (Refresh Token Rotation):** Refreshing rotated refresh token returns a new access token and rotated refresh token.
* **TC-AUTH-08 (Token Reuse Detection):** Presenting an already-rotated refresh token immediately revokes the entire token family.
* **TC-AUTH-09 (Logout):** Invalidation of refresh credentials and clearing of browser cookies.

---

### 2.2 Test Suite 2: Tenant Resolution & Ingress Hardening (`test/tenant-resolution.test.js`)
* **TC-RES-01 (Production Hostname Enforcement):** In production mode (`NODE_ENV=production`), a request with `Host: apex-academy.schoolsaas.com` resolves successfully.
* **TC-RES-02 (Production Header Bypass Prevention):** In production mode, an attacker sending `Host: apex-academy.schoolsaas.com` with `X-Tenant-Domain: horizon-intl.schoolsaas.com` is strictly resolved to **Apex Academy**. The header is stripped and ignored.
* **TC-RES-03 (Production Spoofed ID Rejection):** In production mode, sending `X-Tenant-Id` or `X-Verified-Tenant-Id` in request headers is stripped at ingress.
* **TC-RES-04 (Unknown Domain Rejection):** A request to an unverified hostname returns `400 Bad Request: Unrecognized or unverified school domain`.
* **TC-RES-05 (Controlled Dev Fallback):** In development mode (`NODE_ENV=development` AND `ALLOW_HEADER_TENANT_RESOLVER=true`), `X-Tenant-Domain` resolves the tenant if provided to facilitate local CLI testing.

---

### 2.3 Test Suite 3: Cross-Tenant Isolation & RLS Enforcement on `auth_db` (`test/tenant-isolation.test.js`)
*Setup:* Creates two isolated fictional schools (`Apex Academy` and `Horizon International`), each with an administrator and campus branches in `auth_db`.

* **TC-ISO-01:** Administrator A querying `GET /api/v1/branches` receives only Apex Academy branches.
* **TC-ISO-02:** Administrator A attempting `GET /api/v1/branches/:horizonBranchId` receives 404 Not Found.
* **TC-ISO-03:** Administrator A attempting to modify Horizon (`PATCH /api/v1/tenants/:horizonId`) is rejected with 403 Forbidden.
* **TC-ISO-04 (Payload Tampering):** Passing `"tenantId": "{horizonId}"` in a POST/PUT body does not override the verified tenant context.
* **TC-ISO-05 (Database Kernel Test on `auth_db`):** Executing a raw SQL query `SELECT * FROM branches;` using `school_app_user` with `app.current_tenant_id` set to Apex Academy returns zero rows belonging to Horizon International.
* **TC-ISO-06 (Fail-Closed Test):** Executing `SELECT * FROM branches;` without setting `app.current_tenant_id` returns exactly 0 rows.
* **TC-ISO-07 (Broad UUID Format Acceptance):** Valid UUIDs (v1, v4, v7) are accepted by `withTenantContext`; non-UUID strings are rejected before query execution.

---

### 2.4 Test Suite 4: Connection Pool Context Cleanliness (`test/pool-context.test.js`)
* **TC-POOL-01 (Context Cleanup on COMMIT):**
  1. Connection $C_1$ checked out; `SELECT set_config('app.current_tenant_id', Tenant_A, true)` executed.
  2. Transaction commits; $C_1$ released.
  3. Connection $C_1$ checked out again: assert `current_setting('app.current_tenant_id', true)` is empty and an unscoped query returns 0 rows.
* **TC-POOL-02 (Context Cleanup on ROLLBACK):**
  1. Connection $C_1$ checked out; transaction begun with Tenant A context.
  2. Query throws error; transaction rolls back; $C_1$ released.
  3. Next checkout of $C_1$: assert `app.current_tenant_id` is clean and unassigned.
* **TC-POOL-03 (Role Ownership & Privileges):**
  1. Verify `school_app_user` has `NOBYPASSRLS`.
  2. Verify `school_app_user` is not the owner of any table.
  3. Verify `school_app_user` cannot execute `ALTER TABLE ... DISABLE ROW LEVEL SECURITY`.
* **TC-POOL-04 (Audit Log Immutability):**
  1. `school_app_user` attempting `UPDATE audit_logs SET action = 'tampered'` fails with `permission denied for table audit_logs`.
  2. `school_app_user` attempting `DELETE FROM audit_logs` fails with `permission denied for table audit_logs`.

---

### 2.5 Test Suite 5: Role-Based Access Control (Phase 1 Scope) (`test/rbac.test.js`)
* **TC-RBAC-01:** `SchoolAdmin` can create campuses and invite members within their own school.
* **TC-RBAC-02:** `SchoolAdmin` attempting to assign `SuperAdmin` role is denied with 403 Forbidden.
* **TC-RBAC-03:** `Teacher` attempting to access `/api/v1/memberships/invite` is denied with 403 Forbidden.
* **TC-RBAC-04:** `Teacher` assigned to Branch 1 cannot access or modify records scoped to Branch 2.
* **TC-RBAC-05:** `SuperAdmin` can suspend tenants and inspect platform-wide audit logs.
* **TC-RBAC-06:** Non-admin roles (Teacher, Student, Parent, Accountant) can access only self-service identity endpoints (`/auth/me`, `/sessions`).
