# Document 03: Tenant Isolation, Row-Level Security & Database Privilege Design

**Document Status:** PHASE 1 IMPLEMENTATION PLAN CORRECTED — READY FOR DEVELOPMENT IMPLEMENTATION  
**Classification:** Security Architecture Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Final Security Corrections Applied)  

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
  - JWT Signature & Algorithm Validation: Gateway verifies RS256 signature using public key.
    Explicitly rejects legacy HS256 tokens on school endpoints.
  - Tenant Cross-Check: Rejects request if jwt.tenant_id != resolved_tenant_id.

[ Layer 3: Application Middleware ]
  - Transaction Context: withTenantContext binds app.current_tenant_id per transaction.
  - UUID Validation: Broad UUID regex validates format without restricting UUID versions.
  - Branch Scope: Asserts membership_roles authorize the target branch.

[ Layer 4: Database Kernel (PostgreSQL) ]
  - Three-Role Privilege Model: school_schema_owner (NOLOGIN), school_migration_user,
    school_app_user (NOBYPASSRLS).
  - Row-Level Security (RLS) policies filter every SELECT, INSERT, UPDATE, DELETE.
  - Phase 1 Scope: Enforced strictly on tenant-owned tables in auth_db.
  - Audit Protection: school_app_user granted INSERT, SELECT ONLY on audit_logs.
```

---

## 2. Hardened Three-Tier Database Role & Privilege Design

To guarantee least-privilege access and ensure that RLS cannot be bypassed, table ownership is strictly decoupled from runtime execution:

```
[ Role 1: Migration Identity (school_migration_user) ]
  ├── Used strictly during CI/CD deployments and Knex migration runs
  ├── Inherits ownership role: IN ROLE school_schema_owner
  └── NEVER used for application runtime connection pooling
            │
            ▼
[ Role 2: Schema Owner Group Role (school_schema_owner) ]
  ├── NOLOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE
  ├── Owns public schema and all tables (tenants, branches, etc.)
  ├── Holds DDL permissions (CREATE TABLE, ALTER TABLE, CREATE POLICY)
  └── Cannot be logged into directly by any service
            │
            ▼
[ Role 3: Runtime Application Role (school_app_user) ]
  ├── LOGIN, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOBYPASSRLS
  ├── Used by the Node.js Express connection pool
  ├── Does NOT own any tables; cannot alter tables; cannot disable RLS
  └── Table-Specific Grants:
        - DML (SELECT, INSERT, UPDATE, DELETE) on operational tables
        - Append-Only (INSERT, SELECT ONLY) on audit_logs
```

### Exact Database Provisioning DDL:
```sql
-- 1. Create Schema Owner (NOLOGIN group role)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_schema_owner') THEN
    CREATE ROLE school_schema_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;

-- 2. Create Controlled Migration Identity
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_migration_user') THEN
    CREATE ROLE school_migration_user WITH LOGIN PASSWORD 'migration_secure_pass' 
      NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE school_schema_owner;
  END IF;
END $$;

-- 3. Create Runtime Application Role (NOBYPASSRLS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_app_user') THEN
    CREATE ROLE school_app_user WITH LOGIN PASSWORD 'runtime_secure_pass' 
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;

-- 4. Schema Ownership
ALTER SCHEMA public OWNER TO school_schema_owner;

-- 5. Correct Default Privileges for Tables Created by school_schema_owner
ALTER DEFAULT PRIVILEGES FOR ROLE school_schema_owner IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE school_schema_owner IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO school_app_user;

-- 6. Table-Specific Least Privilege Grants on Operational Tables
GRANT USAGE ON SCHEMA public TO school_app_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON 
    tenants, branches, users, user_tenant_memberships, 
    roles, permissions, role_permissions, membership_roles, 
    tenant_domains, refresh_tokens TO school_app_user;

-- 7. Audit Logs Protection: Append-Only (NO UPDATE, NO DELETE, NO TRUNCATE)
GRANT INSERT, SELECT ON audit_logs TO school_app_user;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM school_app_user;
```

---

## 3. Parameterized Transaction-Scoped `set_config`

### 3.1 Implementation Specification (`services/common/db.js`)

Broad UUID validation accepts valid RFC 4122 / RFC 9562 UUID formats (versions 1 through 8):
$$\text{UUID\_REGEX} = \texttt{/\textasciicircum}[0-9a-f]\{8\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{4\}-[0-9a-f]\{12\}\$\texttt{/i}$$

```javascript
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function withTenantContext(pool, tenantId, callback) {
  if (!tenantId || typeof tenantId !== 'string' || !UUID_REGEX.test(tenantId)) {
    throw new Error('Tenant context error: valid UUID format is required');
  }

  const client = await pool.connect();
  try {
    // 1. Begin explicit transaction
    await client.query('BEGIN');
    
    // 2. Parameterized transaction-scoped context setting (is_local = true)
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
    
    // 3. Execute domain queries
    const result = await callback(client);
    
    // 4. Commit transaction (cleans up transaction-scoped setting)
    await client.query('COMMIT');
    return result;
  } catch (err) {
    // 5. Rollback on failure (cleans up transaction-scoped setting)
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // 6. Release physical connection back to pool with clean session state
    client.release();
  }
}
```

### 3.2 Verification of Context Cleanup & Connection Reuse
* **Commit Cleanup:** When `COMMIT` is executed, PostgreSQL automatically resets `app.current_tenant_id` to its pre-transaction state (`NULL` or default).
* **Rollback Cleanup:** When `ROLLBACK` is executed, all transaction modifications and local `set_config` parameters are completely discarded.
* **Physical Connection Reuse:** When connection $C_1$ is released and subsequently checked out by another request (or an unscoped background worker), `current_setting('app.current_tenant_id', true)` evaluates to `NULL`. Unscoped queries return **0 rows** against RLS-protected tables.

---

## 4. Limitations of Application-Controlled Tenant Context

> [!CAUTION]
> **ARCHITECTURAL SECURITY BOUNDARY:**
> PostgreSQL `set_config('app.current_tenant_id', ...)` relies on the application supplying the correct tenant UUID.
> 1. PostgreSQL does not independently verify whether the connecting user is legally authorized to represent that tenant ID.
> 2. If an application bug, arbitrary SQL injection, or compromised microservice sets the wrong tenant UUID, PostgreSQL will enforce the *supplied* tenant UUID, not the *intended* one.
> 3. Therefore, RLS is a **secondary defense** preventing accidental data leakage and query omission bugs. The **primary boundary** remains cryptographic JWT verification, strict role authorization middleware, and parameterized SQL queries.

---

## 5. Row-Level Security Policies on Phase 1 Tables

RLS is enabled and forced on the Phase 1 tenant-owned tables in `auth_db`:

```sql
-- 1. Branches Table
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_branches ON branches
    FOR ALL
    TO school_app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 2. User Tenant Memberships Table
ALTER TABLE user_tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenant_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_memberships ON user_tenant_memberships
    FOR ALL
    TO school_app_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 3. Membership Roles Table
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
