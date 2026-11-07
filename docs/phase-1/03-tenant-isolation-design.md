# Document 03: Tenant Isolation & Database Row-Level Security Design

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Security Architecture Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Multi-Tenant Threat Model & Isolation Boundaries

Tenant isolation in Phase 1 establishes defense-in-depth across the network, API gateway, application runtime, and database kernel.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DEFENSE-IN-DEPTH ISOLATION                      │
└────────────────────────────────────────────────────────────────────────┘

[ Layer 1: Edge & Ingress ]
  - Header Sanitization: Gateway strips all incoming X-Verified-* headers.
  - Tenant Resolution: Gateway maps incoming hostname to a verified tenant_id.
  - Header Fallback Hardening: X-Tenant-Domain allowed ONLY in explicitly
    configured local development (NODE_ENV=development && ALLOW_HEADER_TENANT_RESOLVER=true).
    Strictly rejected in production.

[ Layer 2: API & Gateway ]
  - JWT Signature Validation: Gateway verifies RS256 signature using public key.
  - Tenant Cross-Check: Rejects request if jwt.tenant_id != resolved_tenant_id.

[ Layer 3: Application Middleware ]
  - Transaction Context: withTenantContext binds app.current_tenant_id per transaction.
  - Branch Scope: Asserts membership_roles authorize the target branch.

[ Layer 4: Database Kernel (PostgreSQL) ]
  - Non-privileged application role: school_app_user (NOBYPASSRLS).
  - Row-Level Security (RLS) policies filter every SELECT, INSERT, UPDATE, DELETE.
  - Phase 1 Scope: Enforced strictly on tenant-owned tables in auth_db.
```

---

## 2. Hardened Tenant Resolution Specification

### 2.1 Production vs. Development Resolution Rules
To prevent malicious tenant impersonation, tenant resolution rules are strictly segregated by environment:

```javascript
// Hardened Gateway Tenant Resolver Logic
function resolveTenantFromRequest(req, tenantDomainCache) {
  const host = (req.headers.host || '').split(':')[0].toLowerCase();
  
  // 1. Production Mode: Strict Hostname Resolution ONLY
  if (process.env.NODE_ENV === 'production') {
    // Strip any spoofed header immediately
    delete req.headers['x-tenant-domain'];
    delete req.headers['x-tenant-id'];
    
    const tenantId = tenantDomainCache.get(host);
    if (!tenantId) {
      throw new HttpError(400, 'Unrecognized or unverified school domain');
    }
    return tenantId;
  }
  
  // 2. Development Mode: Allow *.localhost or controlled local testing fallback
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_HEADER_TENANT_RESOLVER === 'true') {
    const overrideDomain = req.headers['x-tenant-domain'];
    if (overrideDomain) {
      const tenantId = tenantDomainCache.get(overrideDomain.toLowerCase());
      if (tenantId) return tenantId;
    }
  }
  
  // Fall back to standard host resolution
  const tenantId = tenantDomainCache.get(host);
  if (!tenantId) {
    throw new HttpError(400, 'Unrecognized local school domain');
  }
  return tenantId;
}
```

* **Production Guarantee:** In production, `X-Tenant-Domain` is unconditionally stripped and ignored. No client can bypass DNS/hostname-based tenant resolution.
* **Never Trust Body or Params:** The application **never** trusts client-supplied `tenant_id` parameters in request bodies, query parameters, or arbitrary headers.

---

## 3. Row-Level Security (RLS) Implementation Boundary

### 3.1 Strict Phase 1 Boundary Definition
* **Tables Subject to RLS in Phase 1:** Tenant RLS is enabled and enforced **strictly on tenant-owned tables in `auth_db`**:
  * `branches`
  * `user_tenant_memberships`
  * `membership_roles`
* **Exempt / Unaffected Tables in Phase 1:**
  * Global platform tables in `auth_db`: `users`, `tenants`, `permissions`, `tenant_domains`, and `audit_logs` are managed via parameterized queries and platform authorization middleware.
  * **E-Commerce Databases:** `catalog_db`, `cart_db`, `orders_db`, and `payments_db` **do not have RLS**. They remain legacy single-tenant databases dedicated to e-commerce.

### 3.2 Database Roles & RLS Policies in `auth_db`

```sql
-- 1. Create runtime application role with no bypass privileges
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_app_user') THEN
    CREATE ROLE school_app_user WITH LOGIN PASSWORD 'runtime_secure_pass' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- 2. Grant permissions
GRANT USAGE ON SCHEMA public TO school_app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO school_app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO school_app_user;

-- 3. Enable and Force RLS on Phase 1 Tenant Tables
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_branches ON branches
    FOR ALL
    TO school_app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE user_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_memberships ON user_tenant_memberships
    FOR ALL
    TO school_app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_membership_roles ON membership_roles
    FOR ALL
    TO school_app_user
    USING (
      membership_id IN (
        SELECT id FROM user_tenant_memberships 
        WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
    )
    WITH CHECK (
      membership_id IN (
        SELECT id FROM user_tenant_memberships 
        WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
      )
    );
```

---

## 4. How Future Domain Services Will Independently Enforce RLS

When downstream school domain services are implemented in future phases, each service will connect to its own dedicated database and independently configure its own RLS policies:

```
[ Phase 3: academic-service ] ──► [ school_academic_db ]
  * Tables: classes, sections, subjects, syllabi
  * Each table contains: tenant_id UUID NOT NULL
  * RLS Policy: USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)

[ Phase 2, 4, 5: student-records-service ] ──► [ school_records_db ]
  * Tables: students, staff, attendance_logs, exams, student_grades
  * Each table contains: tenant_id UUID NOT NULL, branch_id UUID
  * RLS Policy: USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)

[ Phase 6: finance-service ] ──► [ school_finance_db ]
  * Tables: fee_structures, fee_invoices, fee_payments
  * Each table contains: tenant_id UUID NOT NULL
  * RLS Policy: USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
```

Each service will independently wrap its database transactions with `withTenantContext(pool, req.verifiedTenantId, callback)`, ensuring that database-level isolation is uniform, verified, and complete across all future microservices.
