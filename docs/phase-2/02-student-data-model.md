# Document 02: Student Data Model & Segregated Records (Revised)

**Document Status:** REVISED DESIGN SPECIFICATION — READY FOR REVIEW  
**Classification:** Domain Data Modeling & Entity Specification  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026 (Revised)  
**Author:** Principal System Architect & Database Engineer  
**Database Schema:** `sis` (within database `auth_db`)  

---

## 1. Domain Separation & Data Isolation Architecture

Following the Phase 2 design review, medical, psychological, and child-safeguarding information is **completely segregated** from the ordinary student profile.

A critical vulnerability in legacy school management platforms is packing health, counseling, and custody details into a wide `students` table. Because ordinary classroom teachers, front-desk receptionists, and sports coaches routinely query student rosters, wide tables inevitably expose confidential medical conditions, dietary vulnerabilities, and child-protection flags to unauthorized personnel.

### Physical Architecture of Segregated Student Records:
- **`sis.students` (Core Profile):** Contains standard demographic and permanent institutional facts. Accessible to authorized administrative staff and teachers for classroom roster operations.
- **`sis.student_health_records` (Physical Health & Emergency Care):** Contains allergies, chronic conditions, and emergency medical protocols. Accessible strictly to school medical staff, designated first-aiders, and authorized administrators. Teachers receive only emergency alerts (e.g. "Severe Peanut Allergy - Epipen Required") without full medical file access.
- **`sis.student_safeguarding_records` (Child Protection & Legal Custody):** Contains court-mandated custody restrictions, restraining orders, and confidential welfare evaluations. Accessible strictly to the Principal, designated Child Protection Officer (CPO), and School Legal Counsel.
- **`sis.student_documents` (Verified Attachments):** Contains verified physical scans (birth certificate, previous marks sheet, transfer certificate).

```
┌─────────────────────────────────────────────────────────────┐
│                      sis.students                           │
│                      (Core Profile)                         │
│ - id, tenant_id, branch_id, admission_number                │
│ - first_name, middle_name, last_name, DOB, gender           │
│ - nationality, mother_tongue, residential_address           │
│ - status, admission_date                                    │
└──────────────┬───────────────────────────────┬──────────────┘
               │ 1:1                           │ 1:1
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│  sis.student_health_records │ │sis.student_safeguarding_rec │
│ (Segregated Medical File)   │ │ (Child Protection & Custody)│
│ - medical_conditions        │ │ - safeguarding_risk_level   │
│ - allergies, dietary_reqs   │ │ - custody_court_order_ref   │
│ - emergency_protocol        │ │ - restricted_contacts       │
│ - physician_contact         │ │ - special_needs_tier        │
│ Accessible: Medical / Admin │ │ Accessible: Principal / CPO │
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Field Classification & Sensitivity Taxonomy

### 2.1 Core Student Profile (`sis.students`)

| Field Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Permanent student identifier. |
| `tenant_id` | `UUID` | Foreign Key `public.tenants(id)`, `NOT NULL` | Tenant boundary for PostgreSQL Row-Level Security. |
| `branch_id` | `UUID` | Foreign Key `public.branches(id)`, `NOT NULL` | Physical campus branch where student is admitted. |
| `admission_number` | `VARCHAR(64)` | `NOT NULL`, Unique per tenant/branch | Human-readable permanent institutional number. |
| `first_name` | `VARCHAR(100)` | `NOT NULL` | Legal first name as per birth certificate. |
| `middle_name` | `VARCHAR(100)` | Nullable | Middle name or patronymic. |
| `last_name` | `VARCHAR(100)` | `NOT NULL` | Legal family name / surname. |
| `preferred_name` | `VARCHAR(100)` | Nullable | Informal name for day-to-day address. |
| `date_of_birth` | `DATE` | `NOT NULL` | Verified date of birth. Must meet entry criteria. |
| `gender` | `VARCHAR(20)` | `NOT NULL`, Check enum | `male`, `female`, `non_binary`, `prefer_not_to_say`, `other`. |
| `blood_group` | `VARCHAR(10)` | Nullable | Basic blood group (`A+`, `B+`, `O+`, `AB+`, etc.). |
| `nationality` | `VARCHAR(50)` | Default: `'Indian'` | Country of citizenship. |
| `mother_tongue` | `VARCHAR(50)` | Nullable | Primary language spoken at home. |
| `religion` | `VARCHAR(50)` | Nullable | Optional; collected strictly for statutory minority quota census. |
| `caste_category` | `VARCHAR(50)` | Nullable | Optional for India jurisdiction (`General`, `OBC`, `SC`, `ST`, `EWS`). |
| `residential_address`| `JSONB` | Nullable | `{ line1, line2, city, state, postal_code, country }`. |
| `permanent_address`  | `JSONB` | Nullable | Permanent hometown address if different from residence. |
| `profile_photo_url`  | `VARCHAR(500)` | Nullable | Storage path for profile image. |
| `previous_school_name`| `VARCHAR(200)`| Nullable | Previous school attended before admission. |
| `previous_board`     | `VARCHAR(100)` | Nullable | CBSE, ICSE, State Board, Cambridge, IB, etc. |
| `last_grade_passed`  | `VARCHAR(50)`  | Nullable | Last standard successfully passed. |
| `tc_number`          | `VARCHAR(100)` | Nullable | Previous school Transfer Certificate serial number. |
| `tc_issue_date`      | `DATE`         | Nullable | Issue date of previous Transfer Certificate. |
| `national_id_hash`   | `VARCHAR(64)`  | Nullable | Voluntary salted SHA-256 hash of national ID. Plaintext never stored. |
| `national_id_masked` | `VARCHAR(20)`  | Nullable | Voluntary display mask (e.g. `XXXX-XXXX-4321`). |
| `status`             | `VARCHAR(30)`  | Default: `'admitted'` | Institutional status (see state machine). |
| `admission_date`     | `DATE`         | `NOT NULL` | Formal matriculation date. |

> [!IMPORTANT]
> **National Identification Policy (India Context):**
> In compliance with the Supreme Court of India's judgment (*Justice K.S. Puttaswamy v. Union of India*), **Aadhaar is not mandatory for school admission**. Collection of national identification is strictly voluntary. If provided, the plaintext Aadhaar number is **never stored**; only a pseudonymized salted hash (`national_id_hash`) and a 4-digit display mask (`national_id_masked`) are retained.

---

### 2.2 Health & Emergency Care Record (`sis.student_health_records`)
Separated table containing physical health attributes. Accessible only to medical staff and authorized administrators.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique health record identifier. |
| `tenant_id` | `UUID` | Foreign Key `public.tenants(id)`, `NOT NULL` | RLS boundary. |
| `student_id` | `UUID` | Foreign Key `sis.students(id)`, `NOT NULL`, Unique | Owning student reference (1:1). |
| `medical_conditions` | `TEXT` | Nullable | Chronic illnesses (e.g. asthma, epilepsy, diabetes). |
| `allergies` | `TEXT` | Nullable | Severe food, drug, or environmental allergies. |
| `dietary_requirements` | `TEXT` | Nullable | Vegetarian, vegan, halal, celiac / gluten-free, etc. |
| `regular_medications`| `TEXT` | Nullable | Medications administered on campus during school hours. |
| `emergency_protocol` | `TEXT` | Nullable | Immediate steps required in medical crisis (e.g. Epipen dosage). |
| `physician_name` | `VARCHAR(100)` | Nullable | Family pediatrician / emergency doctor name. |
| `physician_phone` | `VARCHAR(20)` | Nullable | Direct emergency phone number of family doctor. |
| `health_insurance_ref`| `VARCHAR(100)` | Nullable | Insurance policy reference for emergency hospital admissions. |
| `updated_at` | `TIMESTAMPTZ` | Default: `now()` | Last medical update timestamp. |
| `updated_by` | `UUID` | Foreign Key `public.users(id)` | Staff member who validated health records. |

---

### 2.3 Safeguarding & Custody Record (`sis.student_safeguarding_records`)
Highly restricted table containing legal custody disputes and child protection monitoring records. Accessible exclusively to Principal, Child Protection Officer, and School Legal Counsel.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Unique safeguarding record identifier. |
| `tenant_id` | `UUID` | Foreign Key `public.tenants(id)`, `NOT NULL` | RLS boundary. |
| `student_id` | `UUID` | Foreign Key `sis.students(id)`, `NOT NULL`, Unique | Owning student reference (1:1). |
| `safeguarding_risk_level` | `VARCHAR(20)` | Default: `'standard'` | `'standard'`, `'elevated'`, `'critical'`. |
| `custody_court_order_ref`| `VARCHAR(100)`| Nullable | Family Court / legal custody case number. |
| `restricted_contact_names`| `TEXT` | Nullable | Named individuals strictly barred from campus or pickup. |
| `special_needs_tier` | `VARCHAR(30)` | Nullable | Individualized Education Program (IEP) / SEN tier. |
| `counselor_notes` | `TEXT` | Nullable | Confidential pastoral care and psychological notes. |
| `is_monitored` | `BOOLEAN` | Default: `false` | Active welfare monitoring flag. |
| `flagged_by` | `UUID` | Foreign Key `public.users(id)` | Officer who created safeguarding flag. |
| `updated_at` | `TIMESTAMPTZ` | Default: `now()` | Timestamp of last review. |

---

## 3. Student Lifecycle State Machine

```
              ┌────────────────┐
              │    applied     │ (Application under review in admissions pipeline)
              └───────┬────────┘
                      │ Admission Approved & Offer Accepted
                      ▼
              ┌────────────────┐
              │    admitted    │ (Permanent profile created; awaiting first section enrollment)
              └───────┬────────┘
                      │ Initial Section Enrollment
                      ▼
              ┌────────────────┐
 ┌───────────►│     active     │◄────────────┐
 │            └───────┬────────┘             │
 │                    │                      │
 │            Disciplinary Action / Medical Leave
 │                    ▼                      │
 │            ┌────────────────┐             │
 │            │   suspended    │─────────────┘ (Reinstated)
 │            └───────┬────────┘
 │                    │
 │            Campus Relocation / School Transfer
 │                    ▼
 │            ┌────────────────┐
 │            │  transferred   │ (TC issued; historical enrollments preserved)
 │            └────────────────┘
 │
 │            Early Departure
 │                    ▼
 │            ┌────────────────┐
 │            │   withdrawn    │ (Drop-out or non-completion withdrawal)
 │            └────────────────┘
 │
 │            Final Grade Completed
 │                    ▼
 │            ┌────────────────┐
 │            │   graduated    │ (Successfully completed highest curriculum grade)
 │            └───────┬────────┘
 │                    │
 │            Statutory Retention Expiry
 │                    ▼
 │            ┌────────────────┐
 │            │    archived    │ (PII redacted/purged per retention schedule)
 └────────────┴────────────────┘
```

---

## 4. PostgreSQL DDL Blueprint (Schema: `sis`)

```sql
-- Ensure dedicated schema exists
CREATE SCHEMA IF NOT EXISTS sis;

-- 1. Core Students Table
CREATE TABLE IF NOT EXISTS sis.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  admission_number VARCHAR(64) NOT NULL,
  
  -- Demographics
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  preferred_name VARCHAR(100),
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  blood_group VARCHAR(10),
  nationality VARCHAR(50) DEFAULT 'Indian',
  mother_tongue VARCHAR(50),
  religion VARCHAR(50),
  caste_category VARCHAR(50),
  
  -- Contact & Address
  residential_address JSONB,
  permanent_address JSONB,
  profile_photo_url VARCHAR(500),
  
  -- Prior Education
  previous_school_name VARCHAR(200),
  previous_board VARCHAR(100),
  last_grade_passed VARCHAR(50),
  tc_number VARCHAR(100),
  tc_issue_date DATE,
  
  -- Voluntary Pseudonymized National ID
  national_id_hash VARCHAR(64),
  national_id_masked VARCHAR(20),
  
  -- Lifecycle & Audit
  status VARCHAR(30) NOT NULL DEFAULT 'admitted',
  admission_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT uq_tenant_branch_admission_number UNIQUE (tenant_id, branch_id, admission_number),
  CONSTRAINT uq_student_tenant_composite UNIQUE (tenant_id, id),
  CONSTRAINT chk_student_gender CHECK (gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say', 'other')),
  CONSTRAINT chk_student_status CHECK (status IN ('applied', 'admitted', 'active', 'suspended', 'transferred', 'withdrawn', 'graduated', 'archived'))
);

CREATE INDEX IF NOT EXISTS idx_sis_students_tenant_branch ON sis.students(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_sis_students_status ON sis.students(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sis_students_name ON sis.students(tenant_id, lower(last_name), lower(first_name));

-- 2. Segregated Student Health Records Table (1:1)
CREATE TABLE IF NOT EXISTS sis.student_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL UNIQUE REFERENCES sis.students(id) ON DELETE CASCADE,
  
  medical_conditions TEXT,
  allergies TEXT,
  dietary_requirements TEXT,
  regular_medications TEXT,
  emergency_protocol TEXT,
  physician_name VARCHAR(100),
  physician_phone VARCHAR(20),
  health_insurance_ref VARCHAR(100),
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,

  CONSTRAINT uq_health_tenant_student UNIQUE (tenant_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sis_health_student ON sis.student_health_records(tenant_id, student_id);

-- 3. Segregated Safeguarding & Child Protection Table (1:1)
CREATE TABLE IF NOT EXISTS sis.student_safeguarding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL UNIQUE REFERENCES sis.students(id) ON DELETE CASCADE,
  
  safeguarding_risk_level VARCHAR(20) NOT NULL DEFAULT 'standard',
  custody_court_order_ref VARCHAR(100),
  restricted_contact_names TEXT,
  special_needs_tier VARCHAR(30),
  counselor_notes TEXT,
  is_monitored BOOLEAN NOT NULL DEFAULT false,
  
  flagged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_safeguarding_risk CHECK (safeguarding_risk_level IN ('standard', 'elevated', 'critical')),
  CONSTRAINT uq_safeguarding_tenant_student UNIQUE (tenant_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_sis_safeguarding_student ON sis.student_safeguarding_records(tenant_id, student_id);

-- 4. Student Documents Table
CREATE TABLE IF NOT EXISTS sis.student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_hash_sha256 VARCHAR(64) NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_doc_verification_status CHECK (verification_status IN ('pending', 'verified', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_sis_docs_student ON sis.student_documents(tenant_id, student_id);
```
