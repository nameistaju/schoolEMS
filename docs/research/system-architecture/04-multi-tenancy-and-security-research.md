# Document 04: Multi-Tenancy, Authorization and Security Technical Research

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Security Architecture, Multi-Tenant Isolation & Threat Modeling  
**Primary Standards:** OWASP Multi-Tenant Security Cheat Sheet, OWASP Authorization Cheat Sheet, PostgreSQL 18 Documentation  
**Date:** March 2026  
**Author:** Principal Security Architect & Lead DevSecOps Engineer  

---

## 1. Multi-Tenant Isolation Architecture

In a multi-tenant Software-as-a-Service (SaaS) application, preventing cross-tenant data leakage is the foundational security imperative. A failure in tenant isolation (e.g. School A viewing the student directory or financial balances of School B) constitutes a catastrophic system failure and severe regulatory breach.

The **OWASP Multi-Tenant Security Cheat Sheet** defines three core isolation patterns:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-TENANT ISOLATION ARCHITECTURES                            │
├─────────────────────┬─────────────────────────────────┬────────────────────────────────┤
│ Isolation Pattern   │ Architectural Characteristics   │ Security & Operational Profile │
├─────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ **Database-per-**   │ Each tenant has a dedicated     │ Highest physical isolation.    │
│ **Tenant**          │ physical PostgreSQL database.   │ High cost; severe connection   │
│                     │                                 │ pooling and migration penalty. │
├─────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ **Schema-per-**     │ Single database; each tenant    │ High logical isolation.        │
│ **Tenant**          │ has a dedicated SQL schema.     │ Migration sprawl across N      │
│                     │                                 │ schemas; connection bloat.     │
├─────────────────────┼─────────────────────────────────┼────────────────────────────────┤
│ **Shared-Table with**│ Single unified schema; all      │ Kernel-enforced isolation.     │
│ **Row-Level Security**│ rows carry tenant_id; enforced  │ Zero migration sprawl; single  │
│ **(RLS)**           │ by PostgreSQL kernel RLS.       │ connection pool; low overhead. │
└─────────────────────┴─────────────────────────────────┴────────────────────────────────┘
```

### 1.1 Empirical Evaluation for SchoolEMS
- For the SchoolEMS pilot (1–2 schools initially, scaling cleanly to dozens), **Shared-Table Multi-Tenancy with PostgreSQL Row-Level Security (RLS)** is selected.
- It eliminates the operational nightmare of running migrations across dozens of disparate schemas while providing mathematical, kernel-level enforcement that cannot be bypassed by missing application-layer `WHERE` clauses.

---

## 2. PostgreSQL Row-Level Security (RLS) Mechanics

PostgreSQL 18 Row-Level Security operates at the storage engine level, filtering rows before they are returned to queries and checking incoming rows during mutations.

### 2.1 Essential DDL & Policy Formulation
To guarantee complete isolation, every tenant-owned table must enforce four distinct commands:

```sql
-- 1. Enable RLS on the table
ALTER TABLE sis.students ENABLE ROW LEVEL SECURITY;

-- 2. Force RLS (Ensures table owner cannot bypass policies)
ALTER TABLE sis.students FORCE ROW LEVEL SECURITY;

-- 3. Define fail-closed policy using current_setting
CREATE POLICY tenant_isolation_students ON sis.students
  FOR ALL
  TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

### 2.2 Critical RLS Mechanisms Explained
1. **`USING` vs. `WITH CHECK`:**
   - The `USING` expression applies to existing rows (`SELECT`, `UPDATE`, `DELETE`). It functions as an invisible, un-bypassable `WHERE` clause.
   - The `WITH CHECK` expression applies to new or modified rows (`INSERT`, `UPDATE`). It ensures an authenticated tenant cannot insert a row with another tenant's `tenant_id`.
2. **`NULLIF(current_setting('...', true), '')::uuid`:**
   - `current_setting('setting_name', true)` retrieves the session variable. The second parameter (`missing_ok = true`) returns `NULL` or empty string `''` if the variable is not set, preventing runtime SQL errors.
   - `NULLIF(val, '')` converts an empty string into SQL `NULL`.
   - The comparison `tenant_id = NULL` evaluates to `UNKNOWN`/`FALSE` in SQL three-valued logic.
   - **Fail-Closed Guarantee:** If an application query runs without explicitly setting `app.current_tenant_id`, the comparison evaluates to `FALSE`, and **PostgreSQL returns exactly 0 rows**.
3. **Role Separation (NOBYPASSRLS):**
   - The runtime application user `school_app_user` must be explicitly created with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`.
   - Superusers and roles with `BYPASSRLS` completely ignore RLS policies. Therefore, application connection pools must NEVER connect as a superuser (e.g. `postgres`).

---

## 3. Connection-Pool Reuse & Tenant-Context Leakage

A critical vulnerability in pooled database architectures is **context leakage**: if Connection #1 is used by Tenant A and sets `app.current_tenant_id = Tenant_A`, and is then returned to the Knex connection pool without being reset, Connection #1 might later be assigned to a query from Tenant B without setting context, inadvertently granting Tenant B access to Tenant A's data.

### 3.1 Mitigation Strategy: Transaction-Local Configuration (`SET LOCAL`)
PostgreSQL provides `SET LOCAL` (or `set_config($1, $2, true)`), which binds the configuration parameter strictly to the current database transaction block:

```sql
BEGIN;
  -- The third parameter 'true' specifies is_local = true
  SELECT set_config('app.current_tenant_id', '11111111-1111-1111-1111-111111111111', true);
  
  -- Business query executes inside RLS context
  SELECT * FROM sis.students;
COMMIT;
-- At COMMIT or ROLLBACK, PostgreSQL automatically resets app.current_tenant_id to default
```

### 3.2 Defensive Pool Wrapper Implementation
In `projects/school-management/services/common/db.js`, the wrapper `withTenantContext` enforces defense-in-depth:
1. Validates `tenant_id` format via UUID regular expression before acquiring a client.
2. Emits `BEGIN`.
3. Sets `SELECT set_config('app.current_tenant_id', tenantId, true)`.
4. Executes the business callback.
5. Emits `COMMIT` on success, or `ROLLBACK` on error.
6. In an unconditional `finally` block, explicitly executes `SELECT set_config('app.current_tenant_id', '', false)` before releasing the client back to the pool.

---

## 4. Multi-Layered Authorization Architecture

SchoolEMS implements a hybrid **RBAC + ReBAC (Role-Based + Relationship-Based Access Control)** architecture:

```
┌────────────────────────────────────────────────────────┐
│                     CLIENT BROWSER                     │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTPS Request with Bearer RS256 JWT
                           ▼
┌────────────────────────────────────────────────────────┐
│                API GATEWAY INGRESS (:8080)             │
│  - Strips untrusted X-Forwarded-* & X-Verified-*       │
│  - Injects X-Gateway-Secret                            │
│  - Resolves Tenant Domain                              │
└──────────────────────────┬─────────────────────────────┘
                           │ Forward with internal secret
                           ▼
┌────────────────────────────────────────────────────────┐
│            SERVICE LAYER MIDDLEWARE (:4001, :4002)     │
│  - Verifies RS256 Signature (Trusted Public Key)       │
│  - Validates Expiry & Audience                         │
│  - Coarse RBAC: Checks user roles (Admin, Teacher...)  │
│  - ReBAC: Verifies record linkage (Parent -> Child)    │
└──────────────────────────┬─────────────────────────────┘
                           │ withTenantContext(pool, tenant_id)
                           ▼
┌────────────────────────────────────────────────────────┐
│           DATABASE KERNEL RLS (PostgreSQL 18)          │
│  - Evaluates app.current_tenant_id                     │
│  - Returns 0 rows if context missing (Fail-Closed)     │
└────────────────────────────────────────────────────────┘
```

### 4.1 Persona Access & Purview Rules

| Persona | Coarse RBAC Role | Fine-Grained ReBAC Enforcement | Database Enforcement |
| :--- | :--- | :--- | :--- |
| **SuperAdmin** | `SuperAdmin` | Platform-wide tenant management only. | Blocked from all `sis.*` student tables. |
| **SchoolAdmin** | `SchoolAdmin` | Tenant-wide. Can access all branches under tenant. | RLS matches `claims.tenant_id`. |
| **Principal** | `Principal` | Campus-scoped. Can only access assigned `branch_id`. | RLS + query check: `branch_id = claims.branch_id`. |
| **Teacher** | `Teacher` | Section-scoped. Can only mark attendance and view rosters for assigned sections. | Query join: `sis.section_subject_teachers.teacher_id = claims.sub`. |
| **Student** | `Student` | Self-scoped. Can only view personal records. | Query join: `sis.students.user_id = claims.sub`. |
| **Parent** | `Parent` | Child-scoped. Can only view children explicitly linked in `student_guardians`. | Query join: `sis.student_guardians.guardian_id` mapped to `claims.sub`. |
| **Accountant** | `Accountant` | Branch/Tenant finance. Blocked from medical/safeguarding notes. | RBAC role check; blocked from health tables. |

---

## 5. Security Threat Modeling (STRIDE Analysis)

| Threat Category (STRIDE) | Attack Vector / Scenario | Architectural Defense & Mitigation |
| :--- | :--- | :--- |
| **Spoofing** | Attacker spoofs `X-Forwarded-Host` or `X-Tenant-Id` header to impersonate another school. | Gateway strips untrusted external tenant headers; `auth-service` resolves domain cryptographically or issues RS256 token with embedded `tenant_id`. |
| **Tampering** | User modifies JWT payload to grant themselves `SuperAdmin` or change `tenant_id`. | Tokens signed via RS256 asymmetric private key. Verification uses public key; tampering invalidates cryptographic signature immediately. |
| **Repudiation** | Staff member denies altering marked attendance or approving fee waiver. | Append-only audit logs in `public.audit_logs` and `sis.attendance_audit_logs`. `school_app_user` lacks `UPDATE`/`DELETE` grants on audit tables. |
| **Information Disclosure** | Parent guesses URL `/api/v1/sis/students/<id>` to view another student's report. | API enforces ReBAC join against `sis.student_guardians`. Non-linked student returns `404 Not Found`. RLS blocks cross-tenant access. |
| **Denial of Service** | Malicious actor spams `/api/v1/auth/login` to exhaust server resources. | Ingress Gateway enforces fixed-window rate limiting (20 requests / min per IP) returning `429 Too Many Requests`. |
| **Elevation of Privilege** | Cashier attempts to grant themselves fee waiver without Principal approval. | Concessions require explicit two-stage workflow: requested in `sis.fee_concessions`, approved strictly by `Principal` role. |
