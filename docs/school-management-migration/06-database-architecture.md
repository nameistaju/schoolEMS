# Document 06: Database Architecture & Data Modeling

**Document Status:** Final  
**Classification:** Database Architecture Specification  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Managed Database Modernization (Amazon Aurora Serverless v2)

The current in-cluster PostgreSQL 16 StatefulSet (`gitops/k8s/database/postgres.yml`) is replaced with an enterprise-managed **Amazon Aurora PostgreSQL Serverless v2** cluster deployed across three AWS Availability Zones.

### 1.1 Architecture Highlights
* **High Availability & Fault Tolerance:** Multi-AZ cluster with one primary writer instance and one auto-scaling read replica. Automated failover in under 30 seconds.
* **Elastic Scaling:** Dynamic scaling from 0.5 ACU (Aurora Capacity Units) up to 16 ACUs based on real-time CPU and memory demand, supporting massive spikes during morning attendance submissions and exam result announcements.
* **Automated Data Protection:** Continuous backups streamed to Amazon S3 with 35-day Point-in-Time Recovery (PITR) to any second within the retention window.
* **Storage Encryption:** AWS KMS Customer Managed Keys (CMK) encrypting database storage, automated snapshots, and read replica traffic.

---

## 2. Core Relational Data Model

All schemas enforce Row-Level Security (RLS) with mandatory foreign keys referencing `tenants(id)` and `branches(id)`.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              RELATIONAL DATA SCHEMA                                    │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [ tenants ] ─────────► [ branches ] ─────────► [ academic_years ]
      │                      │
      ├───► [ users ] ───────┼────────► [ user_tenant_memberships ]
      │         ▲            │
      │         │            ├────────► [ classes ] ──► [ sections ] ──► [ subjects ]
      │         │            │                                              │
      │         │            ├────────► [ students ] ──► [ student_enrollments ]
      │         │            │              │                   │
      │         │            │              ├──► [ attendance_logs ]
      │         │            │              └──► [ student_grades ] ◄── [ exams ]
      │         │            │
      │         └────────────┼────────► [ staff ]
      │                      │
      └──────────────────────┴────────► [ fee_structures ] ──► [ fee_invoices ] ──► [ payments ]
```

---

## 3. Comprehensive Target Database DDL Specifications

### 3.1 Tenant & Organization Structure (`identity_db`)

```sql
-- 1. Tenants (Educational Trusts or School Groups)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(60) NOT NULL UNIQUE,          -- Subdomain e.g. "dps-delhi"
    custom_domain VARCHAR(150) UNIQUE,         -- Optional e.g. "portal.dpsdelhi.in"
    subscription_tier VARCHAR(20) NOT NULL DEFAULT 'STANDARD', -- FREE, STANDARD, ENTERPRISE
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Branches (Campuses)
CREATE TABLE branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    code VARCHAR(20) NOT NULL,                 -- e.g. "DEL-NORTH"
    phone VARCHAR(20),
    email VARCHAR(120),
    address JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_branch_code UNIQUE (tenant_id, code)
);

-- 3. Academic Years
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,                 -- e.g. "2026-2027"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_academic_year UNIQUE (tenant_id, name)
);

-- 4. Users (All Platform Actors)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(200) NOT NULL UNIQUE,
    phone VARCHAR(20),
    password_hash VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_secret VARCHAR(100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. User Tenant & Branch Memberships (Multi-Role mapping)
CREATE TABLE user_tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL,                 -- SUPERADMIN, PRINCIPAL, TEACHER, STUDENT, PARENT, ACCOUNTANT
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_tenant_branch_role UNIQUE (user_id, tenant_id, branch_id, role)
);
```

---

### 3.2 Academic & Enrollment Structure (`academic_db`)

```sql
-- 6. Classes (Grades)
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,                 -- e.g. "Grade 10"
    level INTEGER NOT NULL,                    -- 10
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_class_branch UNIQUE (tenant_id, branch_id, name)
);

-- 7. Sections
CREATE TABLE sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name VARCHAR(20) NOT NULL,                 -- e.g. "Section A"
    max_capacity SMALLINT NOT NULL DEFAULT 40,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_class_section UNIQUE (class_id, name)
);

-- 8. Subjects
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                -- e.g. "Mathematics"
    code VARCHAR(20) NOT NULL,                 -- e.g. "MATH-10"
    is_elective BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_subject_code UNIQUE (tenant_id, code)
);
```

---

### 3.3 Student Records, Staff & Attendance (`records_db`)

```sql
-- 9. Students
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable until student portal login created
    admission_number VARCHAR(50) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    blood_group VARCHAR(5),
    emergency_contact JSONB NOT NULL,
    address JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_admission UNIQUE (tenant_id, admission_number)
);

-- 10. Guardians (Parents)
CREATE TABLE guardians (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship VARCHAR(30) NOT NULL,         -- FATHER, MOTHER, LEGAL_GUARDIAN
    occupation VARCHAR(100),
    annual_income NUMERIC(12,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Student-Guardian Mapping
CREATE TABLE student_guardians (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    guardian_id UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (student_id, guardian_id)
);

-- 12. Attendance Logs (Partitioned by Date for High Query Performance)
CREATE TABLE attendance_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    student_id UUID NOT NULL,
    section_id UUID NOT NULL,
    date DATE NOT NULL,
    status VARCHAR(15) NOT NULL,               -- PRESENT, ABSENT, LATE, EXCUSED
    recorded_by UUID NOT NULL,                 -- Teacher user_id
    remarks TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (date, id)
) PARTITION BY RANGE (date);

-- Automatically create quarterly partitions
CREATE TABLE attendance_logs_2026_q1 PARTITION OF attendance_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');
CREATE TABLE attendance_logs_2026_q2 PARTITION OF attendance_logs
    FOR VALUES FROM ('2026-04-01') TO ('2026-07-01');
```

---

### 3.4 Examination & Grading (`records_db`)

```sql
-- 13. Exams
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,                -- e.g. "Term 1 Final Examination"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. Student Grades
CREATE TABLE student_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(5,2) NOT NULL,
    max_marks NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    grade VARCHAR(5),                          -- A+, A, B, C, F
    comments TEXT,
    graded_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_exam_subject UNIQUE (exam_id, student_id, subject_id)
);
```

---

### 3.5 Fee & Financial Management (`finance_db`)

```sql
-- 15. Fee Structures
CREATE TABLE fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    academic_year_id UUID NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    fee_type VARCHAR(50) NOT NULL,             -- TUITION, TRANSPORT, LAB, ADMISSION
    amount_in_cents BIGINT NOT NULL,           -- In smallest currency unit (e.g. Paisa or Cents)
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 16. Fee Invoices
CREATE TABLE fee_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) NOT NULL,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    total_amount_in_cents BIGINT NOT NULL,
    discount_amount_in_cents BIGINT NOT NULL DEFAULT 0,
    paid_amount_in_cents BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL,               -- ISSUED, PARTIALLY_PAID, PAID, OVERDUE, VOID
    due_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invoice_number UNIQUE (tenant_id, invoice_number)
);

-- 17. Fee Payments (Transactions)
CREATE TABLE fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES fee_invoices(id) ON DELETE RESTRICT,
    transaction_ref VARCHAR(100) NOT NULL UNIQUE,
    amount_in_cents BIGINT NOT NULL,
    payment_method VARCHAR(30) NOT NULL,       -- STRIPE, RAZORPAY, CASH, CHEQUE, UPI
    status VARCHAR(20) NOT NULL,               -- SUCCESS, PENDING, FAILED
    receipt_s3_url VARCHAR(500),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 4. Modern Migration Management Framework

The existing implementation uses hardcoded SQL string arrays inside `service/index.js`. This is completely replaced with **Knex.js** or **Prisma** migration files integrated directly into the CI/CD pipeline:

1. Migrations are stored in versioned files: `migrations/YYYYMMDDHHMMSS_create_tenants.js`.
2. Each migration implements `exports.up(knex)` and `exports.down(knex)`.
3. In production, migrations run as a **pre-sync Kubernetes Job** managed by Argo CD before new application pods are rolled out. If a migration fails, Argo Rollouts halts deployment immediately.
