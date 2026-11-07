# Document 05: Multi-Tenancy Architecture & Isolation Design

**Document Status:** Final  
**Classification:** Security & Data Architecture Specification  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Multi-Tenant Tenancy Model & Hierarchy

The platform employs a **Hierarchical Multi-Tenant Model** designed to mirror the organizational reality of educational institutions:

```
[ SaaS Platform Level ]
       │
       ▼
[ Tenant (School Educational Trust / Board) ]  <── Root Isolation Boundary (tenant_id)
       │
       ├─── [ Branch 1: Main Campus ]         <── Sub-Isolation Boundary (branch_id)
       │         ├── Academic Year 2026-2027
       │         └── Academic Year 2025-2026
       │
       └─── [ Branch 2: North Campus ]        <── Sub-Isolation Boundary (branch_id)
                 └── Academic Year 2026-2027
```

### Tenancy Definitions:
* **Tenant (`tenant_id`):** The legal or corporate educational entity (e.g., Delhi Public School Society, Oakridge International). All data isolation policies strictly enforce boundaries at this level.
* **Branch (`branch_id`):** A physical campus or school branch belonging to a tenant (e.g., DPS RK Puram, DPS Noida). Users can be assigned to one or more branches.
* **Academic Year (`academic_year_id`):** Temporal division for curricular progress, attendance, grades, and fee structures.

---

## 2. Tenant Identification Strategy

### 2.1 The Golden Rule of Multi-Tenant Security
> **CRITICAL RULE:** The application must **NEVER trust a tenant ID supplied directly by the frontend** via request bodies, query parameters, or arbitrary headers (`X-Tenant-Id`) without cryptographic verification.

### 2.2 Inbound Request Resolution Flow

```
[ Inbound HTTP Request ]
       │
       ▼
1. Extract Host Header (e.g., "dps-delhi.schoolsaas.com" or Custom Domain "portal.dpsdelhi.in")
       │
       ▼
2. Gateway resolves Host against Tenant Domain Cache (Redis) -> derives resolved_tenant_id
       │
       ├─── UNAUTHENTICATED (e.g. /login):
       │      Gateway tags request with verified tenant context for that domain.
       │      Login validates that credentials belong to that specific tenant.
       │
       └─── AUTHENTICATED (Bearer JWT in HttpOnly Cookie / Header):
              3. Verify JWT signature using identity-service public key.
              4. Extract tenant_id from cryptographically signed claims.
              5. Assert that JWT tenant_id MATCHES resolved_tenant_id from the domain.
                 (If mismatch -> 403 Forbidden: Tenant Cross-Talk Blocked).
              6. Forward verified context to downstream microservices in trusted internal headers.
```

---

## 3. Cryptographic Tenant-Aware JWT Token Design

Tokens are signed using asymmetric cryptography (RS256) by `identity-service`. Downstream microservices verify signatures locally using a cached public key.

### 3.1 Claims Schema
```json
{
  "iss": "https://auth.schoolsaas.com",
  "sub": "usr_9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "aud": "schoolsaas-api",
  "iat": 1772866800,
  "exp": 1772867700,
  "jti": "tok_1f8a9e2c4b5d6e7f",
  
  "tenant": {
    "id": "ten_01HZX87654321A",
    "slug": "dps-delhi",
    "tier": "enterprise"
  },
  
  "branch": {
    "id": "brn_01HZX98765432B",
    "name": "Main Campus"
  },
  
  "user": {
    "name": "Ananya Sharma",
    "email": "ananya.sharma@dpsdelhi.in",
    "role": "TEACHER",
    "permissions": [
      "attendance:read",
      "attendance:write",
      "grades:write",
      "students:read"
    ]
  }
}
```

---

## 4. Database-Level Isolation: PostgreSQL Row-Level Security (RLS)

### 4.1 Tenancy Strategy Comparison

| Strategy | Architecture | Pros | Cons | Recommendation |
| :--- | :--- | :--- | :--- | :--- |
| **Database-Per-Tenant** | Dedicated RDS/Aurora database per school. | Maximum isolation; trivial backup/restore per tenant. | High infrastructure cost; connection pool exhaustion; operational overhead. | Reserve for Tier-1 Enterprise customers only. |
| **Schema-Per-Tenant** | Dedicated schema per school inside shared DB. | Clean isolation; shared compute costs. | Migration complexity scales linearly with tenant count (1000 schemas = 1000 migration runs). | Not recommended. |
| **Shared Database + RLS** | Shared database, shared tables, every table contains `tenant_id`. Enforced by PostgreSQL kernel. | Lowest operational cost; seamless scaling; centralized migrations; mathematically verified isolation. | Requires strict discipline in connection pooling and query context setup. | **RECOMMENDED PRIMARY STRATEGY** |

---

### 4.2 Row-Level Security Implementation Architecture

Every table across all domain databases includes `tenant_id UUID NOT NULL` and `branch_id UUID`.

#### Step 1: Base Table Definition
```sql
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    admission_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_admission UNIQUE (tenant_id, admission_number)
);

CREATE INDEX idx_students_tenant ON students(tenant_id, branch_id);
```

#### Step 2: Enable RLS and Create Isolation Policies
```sql
-- Enable Row Level Security on the table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (prevents bypass)
ALTER TABLE students FORCE ROW LEVEL SECURITY;

-- Create Tenant Isolation Policy
CREATE POLICY tenant_isolation_policy ON students
    FOR ALL
    TO application_user
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
    WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

#### Step 3: Application Pool Context Injection (`services/common/db.js`)
When a microservice retrieves a connection from the pool to handle a request, it **must** inject the tenant context into the PostgreSQL session transaction:

```javascript
async function withTenantContext(pool, tenantId, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Set session variable for RLS policy (scoped strictly to this transaction)
    await client.query('SELECT set_config($1, $2, true)', ['app.current_tenant_id', tenantId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Release connection back to pool cleanly
    client.release();
  }
}
```

*If an attacker tampers with code or omits a `WHERE tenant_id = ...` clause, PostgreSQL's kernel automatically filters out all rows belonging to other tenants. If `app.current_tenant_id` is empty, the query returns zero rows.*

---

## 5. Tenant-Specific Cloud Storage Isolation (AWS S3)

Educational platforms store sensitive documents (student report cards, birth certificates, parent identity proofs, fee payment receipts).

### 5.1 S3 Key Partitioning Structure
```
s3://schoolsaas-tenant-assets/
  ├── {tenant_id}/
  │     ├── branding/
  │     │     └── logo.png
  │     └── {branch_id}/
  │           ├── students/
  │           │     └── {student_id}/
  │           │           ├── profile.jpg
  │           │           └── birth_certificate.pdf
  │           └── fee_receipts/
  │                 └── {invoice_id}.pdf
```

### 5.2 Secure Document Access via Scoped Pre-Signed URLs
Microservices never stream raw files through application memory. All file uploads and downloads utilize **AWS S3 Pre-Signed URLs** generated with strict tenant validation:
1. Microservice verifies that the requesting user belongs to `tenant_id`.
2. Microservice generates an S3 Pre-Signed URL with a **5-minute expiration window**.
3. S3 URL is returned to the frontend for direct browser-to-S3 transfer, offloading bandwidth from the EKS cluster.

---

## 6. Tenant-Level Audit Logging & Reporting

Every write operation across the system generates an immutable audit log record stored in a dedicated partitioned audit table:

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID,
    actor_id UUID NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,      -- e.g., 'GRADE_MODIFIED', 'FEE_WAIVED'
    entity_type VARCHAR(100) NOT NULL, -- e.g., 'student_grades'
    entity_id UUID NOT NULL,
    old_state JSONB,
    new_state JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
) PARTITION BY RANGE (timestamp);
```

*Audit logs are retained for 7 years in immutable S3 storage (Object Lock enabled) to satisfy compliance and educational accreditation standards.*
