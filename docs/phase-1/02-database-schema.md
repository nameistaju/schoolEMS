# Document 02: Foundational Multi-Tenant Database Schema (`auth_db`)

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Database Architecture Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Schema Scope & Database Boundary

The Phase 1 database schema is implemented **strictly inside `auth_db`**. 

* **Preserved Databases (Untouched):** `catalog_db`, `cart_db`, `orders_db`, and `payments_db` remain completely unmodified and dedicated to e-commerce.
* **Future School Databases (Excluded from Phase 1):** `school_academic_db`, `school_records_db`, and `school_finance_db` are deferred to Phases 2 through 6.
* **Phase 1 Tables (`auth_db`):** Exactly 11 tables are managed via versioned Knex migrations:
  1. `tenants`
  2. `branches`
  3. `users` (Extended from existing e-commerce table)
  4. `user_tenant_memberships`
  5. `roles`
  6. `permissions`
  7. `role_permissions`
  8. `membership_roles`
  9. `tenant_domains`
  10. `refresh_tokens`
  11. `audit_logs`

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1 FOUNDATIONAL ENTITY MODEL                               │
└────────────────────────────────────────────────────────────────────────────────────────┘

   [ tenants ] ──────────┬──────────► [ branches ]
        │                │                 ▲
        │                │                 │ (branch scope)
        │                ├──────────► [ membership_roles ] ◄─── [ roles ]
        │                │                 ▲                       │
        │                │                 │                       ▼
        ▼                ▼                 │             [ role_permissions ]
 [ tenant_domains ] [ user_tenant_memberships ]                    │
                         │                                         ▼
                         │                                  [ permissions ]
                         ▼
                     [ users ] ◄───────── [ refresh_tokens ]
                         │
                         ▼
                   [ audit_logs ]
```

---

## 2. Backward Compatibility with Existing `users` Table

The existing `auth-service` database migration in `services/auth-service/src/index.js` creates:
```sql
CREATE TABLE IF NOT EXISTS users (
   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   name          VARCHAR(120) NOT NULL,
   email         VARCHAR(200) NOT NULL UNIQUE,
   phone         VARCHAR(20),
   password_hash VARCHAR(100) NOT NULL,
   created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

To preserve existing demo accounts (such as `demo@telugupickles.in`), the Knex migration applies non-destructive additions:
* Adds `full_name VARCHAR(200)` and populates `full_name = name`.
* Adds `status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'locked', 'disabled'))`.
* Adds `email_verified_at TIMESTAMPTZ`.
* Adds `last_login_at TIMESTAMPTZ`.
* Adds `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
* Retains column `name` for backward compatibility with existing e-commerce auth endpoints (`/auth/me`).

---

## 3. Complete DDL Specification for `auth_db`

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TENANTS (School Organizations / Trusts)
-- ============================================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
    timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
    contact_email VARCHAR(255),
    contact_phone VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- ============================================================================
-- 2. BRANCHES (School Campuses)
-- ============================================================================
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_code_per_tenant UNIQUE (tenant_id, code)
);

CREATE INDEX idx_branches_tenant ON branches(tenant_id);

-- ============================================================================
-- 3. USERS (Platform-wide Identity Accounts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120),                                    -- Preserved from legacy table
    full_name VARCHAR(200) NOT NULL,                      -- Standardized field
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('invited', 'active', 'locked', 'disabled')),
    email_verified_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email_lower ON users(lower(email));
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- 4. USER_TENANT_MEMBERSHIPS (Association of Users with Schools)
-- ============================================================================
CREATE TABLE user_tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('invited', 'active', 'suspended', 'revoked')),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_membership_tenant_user UNIQUE (tenant_id, user_id)
);

CREATE INDEX idx_memberships_tenant ON user_tenant_memberships(tenant_id);
CREATE INDEX idx_memberships_user ON user_tenant_memberships(user_id);

-- ============================================================================
-- 5. ROLES (Platform and Tenant Roles)
-- ============================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform roles
    role_key VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_role_key_per_tenant UNIQUE (tenant_id, role_key)
);

-- ============================================================================
-- 6. PERMISSIONS (Atomic Capabilities)
-- ============================================================================
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(100) NOT NULL UNIQUE,
    module VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. ROLE_PERMISSIONS (Role to Capability Mapping)
-- ============================================================================
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

-- ============================================================================
-- 8. MEMBERSHIP_ROLES (Role Assignments with Optional Branch Scope)
-- ============================================================================
CREATE TABLE membership_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES user_tenant_memberships(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE, -- NULL = Tenant-wide scope
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_membership_role_branch UNIQUE (membership_id, role_id, branch_id)
);

CREATE INDEX idx_membership_roles_member ON membership_roles(membership_id);
CREATE INDEX idx_membership_roles_branch ON membership_roles(branch_id);

-- ============================================================================
-- 9. TENANT_DOMAINS (Subdomain & Custom Domain Routing)
-- ============================================================================
CREATE TABLE tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    domain_type VARCHAR(20) NOT NULL DEFAULT 'subdomain'
        CHECK (domain_type IN ('subdomain', 'custom')),
    verification_status VARCHAR(30) NOT NULL DEFAULT 'verified'
        CHECK (verification_status IN ('pending', 'verified', 'failed')),
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verified_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tenant_domains_lookup ON tenant_domains(lower(domain), verification_status);

-- ============================================================================
-- 10. REFRESH_TOKENS (Hashed Refresh Session Storage)
-- ============================================================================
CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES user_tenant_memberships(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of random token
    family_id UUID NOT NULL,               -- Rotation chain identifier
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(family_id);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ============================================================================
-- 11. AUDIT_LOGS (Immutable Security & Operation Records)
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL, -- NULL for platform events
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_tenant_time ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```
