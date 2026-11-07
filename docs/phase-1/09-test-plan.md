# Document 09: Test Plan & Quality Assurance Gates

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Quality Assurance & Security Validation  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Quality Assurance Mandate

The Phase 0 audit revealed that the existing repository possesses only two test files with seven total assertions. Phase 1 introduces a comprehensive automated test framework covering authentication, cryptographic tokens, role-based authorization, connection pool hygiene, and database-level Row-Level Security (RLS) enforcement.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1 TESTING PYRAMID                         │
└────────────────────────────────────────────────────────────────────────┘

              [ Security & Penetration Tests ]
              - Production Hostname Resolution Bypass Tests
              - Cross-Tenant Data Tampering via RLS
              - Refresh Token Reuse Detection
                              │
              [ Integration & API Route Tests ]
              - Gateway Tenant Domain Resolution
              - Cookie Session & Refresh Rotation
              - SuperAdmin & SchoolAdmin Workflows
                              │
              [ Database & RLS Kernel Unit Tests ]
              - Connection Pool Context Leakage
              - Non-privileged Role RLS Enforcement on auth_db
              - Knex Bi-directional Migration Tests
```

---

## 2. Test Suite Specifications

### 2.1 Test Suite 1: Authentication & Session Lifecycle (`test/auth.test.js`)
* **TC-AUTH-01:** Valid credentials with active tenant domain successfully issues access token and secure `tp_refresh` cookie.
* **TC-AUTH-02:** Incorrect password returns generic 401 error without revealing user existence.
* **TC-AUTH-03:** User with status `disabled` or `locked` is rejected with 403 Forbidden.
* **TC-AUTH-04:** Attempted login to a `suspended` school returns 403 Forbidden.
* **TC-AUTH-05:** Access token expires after 15 minutes; expired token returns 401 Unauthorized.
* **TC-AUTH-06:** Tampered token signature (e.g. modified payload or header) fails cryptographic verification.
* **TC-AUTH-07:** Refresh token rotation returns a new access token and new rotated refresh token.
* **TC-AUTH-08 (Security Critical):** Presenting an already-rotated refresh token triggers **Token Reuse Detection**, revokes the entire token family, and logs a high-severity security incident.
* **TC-AUTH-09:** `POST /api/v1/auth/logout` invalidates the active refresh token and clears browser cookies.

---

### 2.2 Test Suite 2: Tenant Resolution & Ingress Hardening (`test/tenant-resolution.test.js`)
* **TC-RES-01 (Production Hostname Enforcement):** In production mode (`NODE_ENV=production`), a request with `Host: dps-delhi.schoolsaas.com` resolves successfully.
* **TC-RES-02 (Production Header Bypass Prevention):** In production mode (`NODE_ENV=production`), an attacker sending `Host: dps-delhi.schoolsaas.com` with `X-Tenant-Domain: oakridge.schoolsaas.com` is strictly resolved to **DPS Delhi**. The header is stripped and ignored.
* **TC-RES-03 (Production Spoofed ID Rejection):** In production mode, sending `X-Tenant-Id` or `X-Verified-Tenant-Id` in request headers is stripped at ingress and has zero effect on tenant resolution.
* **TC-RES-04 (Unknown Domain Rejection):** A request to an unverified or unknown hostname (e.g. `Host: evil.com`) returns `400 Bad Request: Unrecognized or unverified school domain`.
* **TC-RES-05 (Controlled Dev Fallback):** In development mode (`NODE_ENV=development` AND `ALLOW_HEADER_TENANT_RESOLVER=true`), `X-Tenant-Domain` resolves the tenant if provided to facilitate local CLI testing.

---

### 2.3 Test Suite 3: Cross-Tenant Isolation & RLS Enforcement on `auth_db` (`test/tenant-isolation.test.js`)
*Setup:* Creates two isolated schools (`TENANT_A` and `TENANT_B`), each with an administrator and campus branches in `auth_db`.

* **TC-ISO-01:** Administrator A querying `GET /api/v1/branches` receives only Tenant A branches.
* **TC-ISO-02:** Administrator A attempting `GET /api/v1/branches/:tenantBBranchId` receives 404 Not Found or 403 Forbidden.
* **TC-ISO-03:** Administrator A attempting to modify Tenant B (`PATCH /api/v1/tenants/:tenantBId`) is rejected with 403 Forbidden.
* **TC-ISO-04 (Payload Tampering):** Passing `"tenantId": "{tenantB}"` in a POST/PUT body does not override the verified tenant context.
* **TC-ISO-05 (Database Kernel Test on `auth_db`):** Executing a raw SQL query `SELECT * FROM branches;` using `school_app_user` with `app.current_tenant_id` set to Tenant A returns zero rows belonging to Tenant B.
* **TC-ISO-06 (Fail-Closed Test):** Executing `SELECT * FROM branches;` without setting `app.current_tenant_id` returns exactly 0 rows.

---

### 2.4 Test Suite 4: Connection Pool Context Cleanliness (`test/pool-context.test.js`)
*Objective:* Verify that pooled database connections do not leak tenant context across requests.

* **TC-POOL-01:**
  1. Connection $C_1$ is checked out from the pool.
  2. Transaction begins; `set_config('app.current_tenant_id', Tenant_A, true)` is executed.
  3. Query returns Tenant A rows.
  4. Transaction commits; $C_1$ is released back to the pool.
  5. Connection $C_1$ is checked out again.
  6. Direct query executed without `withTenantContext`: assert that `current_setting('app.current_tenant_id', true)` is empty and 0 rows are returned.

---

### 2.5 Test Suite 5: Role-Based Access Control (Phase 1 Scope) (`test/rbac.test.js`)
* **TC-RBAC-01:** `SchoolAdmin` can create campuses and invite members within their own school.
* **TC-RBAC-02:** `SchoolAdmin` attempting to assign `SuperAdmin` role is denied with 403 Forbidden.
* **TC-RBAC-03:** `Teacher` attempting to access `/api/v1/memberships/invite` is denied with 403 Forbidden.
* **TC-RBAC-04:** `Teacher` assigned to Branch 1 cannot access or modify records scoped to Branch 2.
* **TC-RBAC-05:** `SuperAdmin` can suspend tenants and inspect platform-wide audit logs.
* **TC-RBAC-06:** Non-admin roles (Teacher, Student, Parent, Accountant) can access only self-service identity endpoints (`/auth/me`, `/sessions`).
