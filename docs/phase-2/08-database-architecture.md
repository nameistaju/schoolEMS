# Document 08: Database Architecture & Entity-Relationship (ER) Schema

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Database Architecture & Physical Data Modeling  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal Database Architect & Data Engineer  

---

## 1. Database Boundary & Topology Resolution

### 1.1 Resolution of Database Ambiguity: The `auth_db` Decision
In the initial Phase 1 foundation, the operational database was named `auth_db`. In preliminary Phase 2 drafts, references to both `auth_db` and `school_db` created naming and connection ambiguity.

**Formal Resolution (ADR-02):**
- The platform standardizes on the existing local PostgreSQL 18.6 database: **`auth_db`**.
- Phase 1 identity, authentication, tenant, and audit tables remain intact under the **`public`** schema (`public.tenants`, `public.branches`, `public.users`, `public.roles`, `public.memberships`, `public.platform_admins`, `public.audit_logs`).
- All Phase 2 Student Information System entities reside in a dedicated PostgreSQL schema named **`sis`**.
- Cross-schema foreign keys (`REFERENCES public.tenants(id)`, `REFERENCES public.branches(id)`, `REFERENCES public.users(id)`) connect the schemas within the same database instance.
- No existing Phase 1 tables are renamed, dropped, or moved. Phase 1 migrations (01 through 07) remain completely untouched.

### 1.2 Rationale for Single Database with Dedicated Schema
1. **Atomic Onboarding Transactions:** Admitting a student requires an atomic ACID transaction spanning `sis.admission_applications`, `sis.admission_number_sequences`, `sis.students`, `sis.guardians`, `sis.student_guardians`, `sis.student_enrollments`, and `public.audit_logs`. A cross-database setup would require two-phase commit (2PC) or asynchronous eventual consistency, which introduces orphan risks and complex failure recovery.
2. **True Relational Integrity:** Enforces database-level cascading integrity and foreign key constraints without microservice-level eventual consistency workarounds.
3. **Local-First & Cloud-Independent:** Consumes minimal resources, executes flawlessly on local Windows 11 / WSL PostgreSQL 18.6, and eliminates multi-database connection pooling overhead.
4. **Clean Decoupling for Future Splitting:** Because all SIS entities reside strictly within schema `sis`, future evolution to an independent physical database (e.g., if tenant scale requires micro-databases) can be accomplished cleanly by exporting schema `sis` and swapping cross-schema FKs for API boundaries.

---

## 2. Entity-Relationship (ER) Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 SCHEMA: public (Phase 1)                               │
│                                                                                        │
│   ┌────────────────────────┐         1:N         ┌────────────────────────┐            │
│   │     public.tenants     │────────────────────►│    public.branches     │            │
│   └───────────┬────────────┘                     └───────────┬────────────┘            │
│               │                                              │                         │
│               │ 1:N                                          │ 1:N                     │
│               ▼                                              ▼                         │
│   ┌────────────────────────┐                     ┌────────────────────────┐            │
│   │      public.users      │                     │   public.audit_logs    │            │
│   └────────────────────────┘                     └────────────────────────┘            │
└───────────────┼──────────────────────────────────────────────┼─────────────────────────┘
                │                                              │
════════════════╪══════════════════════════════════════════════╪══════════════════════════
                │ Cross-Schema Foreign Keys                    │
┌───────────────▼──────────────────────────────────────────────▼─────────────────────────┐
│                                 SCHEMA: sis (Phase 2)                                  │
│                                                                                        │
│   ┌────────────────────────┐                     ┌────────────────────────┐            │
│   │   sis.academic_years   │                     │      sis.classes       │            │
│   │ - id, name, code       │                     │ - id, branch_id, name  │            │
│   │ - is_current (Unique)  │                     │ - stage, sequence_order│            │
│   └───────────┬────────────┘                     └───────────┬────────────┘            │
│               │                                              │                         │
│               │ 1:N                                          │ 1:N                     │
│               ▼                                              ▼                         │
│   ┌────────────────────────┐                     ┌────────────────────────┐            │
│   │   sis.academic_terms   │                     │      sis.sections      │            │
│   │ - id, academic_year_id │                     │ - id, class_id, name   │            │
│   │ - name, start/end date │                     │ - max_capacity, teacher│            │
│   └────────────────────────┘                     └───────────┬────────────┘            │
│                                                              │                         │
│                                                              │ 1:N                     │
│                                                              ▼                         │
│   ┌────────────────────────┐         1:N         ┌────────────────────────┐            │
│   │      sis.students      │────────────────────►│sis.student_enrollments │            │
│   │ - id, admission_number │                     │ - id, student_id       │            │
│   │ - demographics, status │                     │ - academic_year_id     │            │
│   │ - national_id_hash     │                     │ - section_id, roll_no  │            │
│   └───────────┬────────────┘                     │ - status ('active')    │            │
│               │                                  └────────────────────────┘            │
│   ┌───────────┴──────────────────────────────┐                                         │
│   │ 1:1                                      │ 1:1                                     │
│   ▼                                          ▼                                         │
│ ┌────────────────────────┐         ┌────────────────────────┐                          │
│ │sis.student_health_recs │         │sis.student_safeguarding│                          │
│ │ - blood_group, doctor  │         │ - protection_tier      │                          │
│ │ - allergies, conditions│         │ - court_orders, flags  │                          │
│ └────────────────────────┘         └────────────────────────┘                          │
│               │                                                                        │
│               ├──────────────────────────────────────────────┐                         │
│               │ 1:N                                          │ 1:N                     │
│               ▼                                              ▼                         │
│   ┌────────────────────────┐         N:1         ┌────────────────────────┐            │
│   │  sis.student_guardians │◄────────────────────│      sis.guardians     │            │
│   │ - student_id           │                     │ - id, name, phone      │            │
│   │ - guardian_id          │                     │ - email, user_id (FK)  │            │
│   │ - permissions, custody │                     │ - emergency_priority   │            │
│   └───────────┬────────────┘                     └────────────────────────┘            │
│               │                                                                        │
│               │ 1:N                                                                    │
│               ▼                                                                        │
│   ┌────────────────────────┐                                                           │
│   │  sis.guardian_consents │                                                           │
│   │ - consent_type         │                                                           │
│   │ - dpdp_section9_status │                                                           │
│   └────────────────────────┘                                                           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Physical Schema Specification & Migration Sequencing

### 3.1 Independent Migration Pipeline for SIS
To guarantee complete isolation between Phase 1 and Phase 2 lifecycle management:
- Phase 1 migrations reside in `services/identity-service/src/database/migrations` and track execution in `public.knex_migrations`.
- Phase 2 migrations reside in `services/student-records-service/src/database/migrations` and track execution in **`sis.knex_migrations_sis`**.

### 3.2 Migration Inventory

| Migration Index | File Name | Entities Created | Purpose |
| :---: | :--- | :--- | :--- |
| **08** | `20260301000008_create_sis_schema_and_academic_structure.js` | Schema `sis`, `academic_years`, `academic_terms`, `classes`, `sections` | Establishes `sis` namespace, calendars, grade stages, and classrooms. |
| **09** | `20260301000009_create_students_and_sensitive_records.js` | `students`, `student_health_records`, `student_safeguarding_records`, `student_documents` | Core demographic profiles and segregated sensitive medical/safeguarding tables. |
| **10** | `20260301000010_create_guardians_and_consents.js` | `guardians`, `student_guardians`, `guardian_consents` | Family network, granular child permissions, custody alerts, and DPDP consents. |
| **11** | `20260301000011_create_admissions_and_sequences.js` | `admission_applications`, `application_documents`, `admission_number_sequences` | Prospective candidate pipeline, document checklist, and atomic counter. |
| **12** | `20260301000012_create_enrollments_and_transfers.js` | `student_enrollments`, `student_transfers` | Academic section enrollments, inter-branch relocations, and TC clearance. |
| **13** | `20260301000013_enable_sis_rls_and_grants.js` | RLS Policies & Grants | Strict tenant-isolation policies and runtime grants for `school_app_user`. |

---

## 4. Comprehensive Indexing Strategy

Indexes are tailored to support high-concurrency lookups and sub-50ms API response times:

### 4.1 Primary Keys & Foreign Key B-Trees
- Every table uses `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
- Every foreign key column has an explicit B-tree index to optimize relational joins and cascading constraint checks.

### 4.2 Partial Unique Indexes
- **Single Current Academic Year:**
  ```sql
  CREATE UNIQUE INDEX uq_sis_current_ay ON sis.academic_years (tenant_id) WHERE is_current = true;
  ```
- **Single Active Section Enrollment per Academic Year:**
  ```sql
  CREATE UNIQUE INDEX uq_sis_active_enrollment ON sis.student_enrollments (student_id, academic_year_id) WHERE status = 'active';
  ```
- **Single Primary Guardian per Student:**
  ```sql
  CREATE UNIQUE INDEX uq_sis_single_primary_guardian ON sis.student_guardians (student_id) WHERE is_primary = true;
  ```

### 4.3 Search & Query Optimization Indexes
- **Student Name Search (Compound Lowercase):**
  ```sql
  CREATE INDEX idx_sis_students_name_search ON sis.students (tenant_id, lower(last_name), lower(first_name));
  ```
- **Section Roster by Roll Number:**
  ```sql
  CREATE INDEX idx_sis_enrollment_roster ON sis.student_enrollments (section_id, roll_number) WHERE status = 'active';
  ```
- **Voluntary National ID Hash Lookup:**
  ```sql
  CREATE INDEX idx_sis_students_national_id ON sis.students (tenant_id, national_id_hash) WHERE national_id_hash IS NOT NULL;
  ```
- **Admission Application Triage:**
  ```sql
  CREATE INDEX idx_sis_admissions_triage ON sis.admission_applications (tenant_id, branch_id, status, target_class_id);
  ```

---

## 5. Three-Tier PostgreSQL Privilege Model Applied to Schema `sis`

Phase 2 enforces the exact database security model established and verified in Phase 1:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASE 2 DATABASE PRIVILEGE MODEL                     │
├──────────────────────────┬─────────────────────────┬───────────────────┤
│ Role                     │ Connection Type         │ Allowed Actions   │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ school_schema_owner      │ NOLOGIN                 │ Owns schema sis,  │
│                          │ NOBYPASSRLS             │ all tables, views,│
│                          │                         │ sequences & RLS.  │
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ school_migration_user    │ LOGIN (Migrations only) │ Granted USAGE,    │
│                          │                         │ CREATE on sis.    │
│                          │                         │ Runs SET ROLE     │
│                          │                         │ school_schema_owner│
├──────────────────────────┼─────────────────────────┼───────────────────┤
│ school_app_user          │ LOGIN (Runtime Service) │ Granted USAGE on  │
│                          │ NOBYPASSRLS             │ schema sis.       │
│                          │                         │ SELECT, INSERT,   │
│                          │                         │ UPDATE, DELETE on │
│                          │                         │ sis data tables.  │
│                          │                         │ USAGE on sequences│
└──────────────────────────┴─────────────────────────┴───────────────────┘
```

### 5.1 Schema DDL & Privilege Provisioning Script

```sql
-- Connect to database auth_db as superuser/admin
\c auth_db;

-- 1. Create schema sis owned by school_schema_owner
CREATE SCHEMA IF NOT EXISTS sis AUTHORIZATION school_schema_owner;

-- 2. Grant migration user execution rights
GRANT USAGE, CREATE ON SCHEMA sis TO school_migration_user;

-- 3. Grant runtime application user runtime rights
GRANT USAGE ON SCHEMA sis TO school_app_user;

-- 4. Set Default Privileges for future objects created in schema sis
ALTER DEFAULT PRIVILEGES FOR ROLE school_schema_owner IN SCHEMA sis
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE school_schema_owner IN SCHEMA sis
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO school_app_user;
```

---

## 6. Knex Configuration for `student-records-service`

The `student-records-service` configures its Knex connection pool to operate strictly within schema `sis` while maintaining access to public lookup tables:

```javascript
// services/student-records-service/src/database/knexfile.js
module.exports = {
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'auth_db',
    user: process.env.DB_USER || 'school_app_user',
    password: process.env.DB_PASSWORD,
  },
  pool: {
    min: 2,
    max: 10,
    afterCreate: (conn, done) => {
      // Ensure search path prioritizes sis, then public
      conn.query('SET search_path = sis, public;', (err) => {
        done(err, conn);
      });
    },
  },
  migrations: {
    directory: './migrations',
    tableName: 'knex_migrations_sis',
    schemaName: 'sis',
  },
};
```
