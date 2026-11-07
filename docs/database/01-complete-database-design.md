# Document 01: Complete Physical Database Design & Schema Specification

**Document Status:** TECHNICAL SPECIFICATION — APPROVED BASELINE  
**Classification:** Database Architecture & Physical Data Modeling  
**Database Topology:** Single PostgreSQL 18.6 Database `auth_db`  
**Schema Partitioning:** Existing Phase 1 in `public` | Phase 2 SIS in `sis`  
**Runtime Security Model:** PostgreSQL Row-Level Security (RLS) under `school_app_user` (NOBYPASSRLS)  
**Date:** March 2026  
**Author:** Principal Database Architect & Data Systems Engineer  

---

## 1. Physical Architecture, Schema Topology & Standards

### 1.1 Physical Database Topology
SchoolEMS standardizes on a single local PostgreSQL 18.6 database instance named **`auth_db`**.
- **Schema `public`:** Houses Phase 1 Identity, Authentication, Multi-Tenant Hierarchy, and Platform Administration entities. Migrations 01–07 are permanently anchored here and tracked in `public.knex_migrations`.
- **Schema `sis`:** Houses all Phase 2 Student Information System entities. Migrations starting at 08 are managed in an independent pipeline tracked in **`sis.knex_migrations_sis`**.
- **Cross-Schema Relational Integrity:** Tables in schema `sis` maintain direct foreign keys to `public.tenants(id)`, `public.branches(id)`, and `public.users(id)`. This provides full ACID relational integrity across identity and academic operations.

### 1.2 Data Typing, Formatting & Naming Standards
1. **Identifiers (Primary Keys):** All tables utilize `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
2. **Naming Conventions:** All schema names, table names, and column names use lowercase `snake_case`.
3. **Audit Timestamps:** Every table contains `created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()`.
4. **Financial Exactness (Invariable):** All monetary figures (fees, concessions, balances, payments) use `NUMERIC(12, 2)` (never `float` or `double`). Negative amounts are forbidden via `CHECK (amount >= 0)`. Currency is strictly `INR` (Indian Rupee, ₹).
5. **Identity Privacy (Invariable):** Raw national identification numbers (e.g., Aadhaar) are never stored in plaintext. Tables store `national_id_hash VARCHAR(64)` (salted SHA-256) and `national_id_masked VARCHAR(20)` (e.g., `●●●● ●●●● 8192`).
6. **Soft Deletion Policy:** Operational tables supporting soft deletion use `deleted_at TIMESTAMPTZ NULL`. Financial payments, receipt sequences, attendance records, and audit logs are append-only and strictly forbid deletion.

---

## 2. Exhaustive Schema Specifications by Domain

### 2.1 Domain 1: Institutional Setup & Academic Calendars

#### Table 1: `sis.academic_years`
Represents an institutional academic cycle (e.g. "2026-2027").
```sql
CREATE TABLE sis.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,              -- e.g. "Academic Year 2026-2027"
  code VARCHAR(20) NOT NULL,              -- e.g. "AY-2026-27"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  is_locked BOOLEAN NOT NULL DEFAULT false, -- Set true after annual rollover
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_ay_dates CHECK (end_date > start_date),
  CONSTRAINT uq_sis_ay_code UNIQUE (tenant_id, code)
);

-- Partial unique index ensuring exactly one current academic year per tenant
CREATE UNIQUE INDEX uq_sis_current_ay ON sis.academic_years (tenant_id) WHERE is_current = true;
CREATE INDEX idx_sis_ay_tenant ON sis.academic_years (tenant_id);
```

#### Table 2: `sis.academic_terms`
Subdivisions of an academic year (e.g. "Term 1", "Semester 2").
```sql
CREATE TABLE sis.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,              -- e.g. "Term 1 (Autumn)"
  term_code VARCHAR(20) NOT NULL,         -- e.g. "T1"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_term_dates CHECK (end_date > start_date),
  CONSTRAINT uq_sis_term_code UNIQUE (academic_year_id, term_code)
);

CREATE INDEX idx_sis_terms_ay ON sis.academic_terms (academic_year_id);
```

#### Table 3: `sis.academic_calendar_events`
Institutional calendar entries, term breaks, public holidays, and exam windows.
```sql
CREATE TABLE sis.academic_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL = all branches
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE CASCADE,
  event_title VARCHAR(150) NOT NULL,
  event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('holiday', 'examination', 'term_break', 'event', 'pd_day')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_instructional_day BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_cal_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_sis_calendar_lookup ON sis.academic_calendar_events (tenant_id, branch_id, start_date, end_date);
```

---

### 2.2 Domain 2: Academic Structure (Classes, Sections & Subjects)

#### Table 4: `sis.classes`
Represents an academic grade level or standard (e.g. "Grade 10").
```sql
CREATE TABLE sis.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,              -- e.g. "Grade 10"
  stage VARCHAR(30) NOT NULL,             -- e.g. "Primary", "Middle", "Secondary", "Senior Secondary"
  sequence_order INTEGER NOT NULL,        -- e.g. 10 (used for progression order)
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_sis_class_name UNIQUE (branch_id, name)
);

CREATE INDEX idx_sis_classes_branch ON sis.classes (branch_id, sequence_order);
```

#### Table 5: `sis.sections`
Represents a physical classroom group within a class (e.g. "Grade 10-A").
```sql
CREATE TABLE sis.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  name VARCHAR(20) NOT NULL,              -- e.g. "A"
  max_capacity INTEGER NOT NULL DEFAULT 40 CHECK (max_capacity > 0),
  room_number VARCHAR(30) NULL,
  class_teacher_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_sis_section_name UNIQUE (class_id, name)
);

CREATE INDEX idx_sis_sections_class ON sis.sections (class_id);
CREATE INDEX idx_sis_sections_teacher ON sis.sections (class_teacher_id);
```

#### Table 6: `sis.subjects`
Master subject catalog offered by the school (e.g. "Mathematics", "Science").
```sql
CREATE TABLE sis.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,             -- e.g. "Mathematics"
  code VARCHAR(20) NOT NULL,              -- e.g. "MATH-10"
  is_elective BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_subject_code UNIQUE (branch_id, code)
);

CREATE INDEX idx_sis_subjects_branch ON sis.subjects (branch_id);
```

#### Table 7: `sis.section_subject_teachers`
Assigns a faculty instructor to teach a specific subject to a section.
```sql
CREATE TABLE sis.section_subject_teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES sis.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE CASCADE,
  periods_per_week INTEGER NOT NULL DEFAULT 5 CHECK (periods_per_week > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_sec_sub_year UNIQUE (section_id, subject_id, academic_year_id)
);

CREATE INDEX idx_sis_sec_subj_teacher ON sis.section_subject_teachers (teacher_id, academic_year_id);
CREATE INDEX idx_sis_sec_subj_sec ON sis.section_subject_teachers (section_id);
```

---

### 2.3 Domain 3: Student Profiles, Admissions & Sensitive Segregation

#### Table 8: `sis.admission_number_sequences`
Atomic counter sequence per branch/year ensuring sequential admission IDs (e.g. `APEX-2026-0001`).
```sql
CREATE TABLE sis.admission_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  prefix VARCHAR(20) NOT NULL,            -- e.g. "APEX-26-"
  last_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_adm_seq UNIQUE (branch_id, academic_year_id)
);
```

#### Table 9: `sis.admission_applications`
Prospective student pipeline for tracking applications prior to formal enrollment.
```sql
CREATE TABLE sis.admission_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  application_number VARCHAR(30) NOT NULL, -- e.g. "APP-2026-0142"
  target_class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other', 'unspecified')),
  guardian_name VARCHAR(100) NOT NULL,
  guardian_email VARCHAR(100) NOT NULL,
  guardian_phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'interview_scheduled', 'approved', 'rejected', 'enrolled')),
  decision_notes TEXT NULL,
  decided_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_app_number UNIQUE (tenant_id, application_number)
);

CREATE INDEX idx_sis_adm_apps_triage ON sis.admission_applications (tenant_id, branch_id, status, target_class_id);
```

#### Table 10: `sis.students`
The core student identity and demographic profile.
```sql
CREATE TABLE sis.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  admission_number VARCHAR(30) NOT NULL,  -- e.g. "APEX-2026-0001"
  admission_date DATE NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) NULL,
  last_name VARCHAR(50) NOT NULL,
  preferred_name VARCHAR(50) NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL CHECK (gender IN ('male', 'female', 'other', 'unspecified')),
  blood_group VARCHAR(10) NULL CHECK (blood_group IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'graduated', 'transferred', 'withdrawn', 'suspended')),
  user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL, -- Link to student portal user
  national_id_hash VARCHAR(64) NULL,      -- Salted SHA-256 for duplicate check
  national_id_masked VARCHAR(20) NULL,    -- e.g. "●●●● ●●●● 8192"
  emergency_contact_phone VARCHAR(20) NOT NULL,
  address_street TEXT NOT NULL,
  address_city VARCHAR(100) NOT NULL,
  address_state VARCHAR(100) NOT NULL,
  address_postal_code VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  deleted_at TIMESTAMPTZ NULL,
  CONSTRAINT uq_sis_adm_number UNIQUE (tenant_id, admission_number)
);

CREATE INDEX idx_sis_students_lookup ON sis.students (tenant_id, branch_id, status);
CREATE INDEX idx_sis_students_name ON sis.students (tenant_id, lower(last_name), lower(first_name));
CREATE INDEX idx_sis_students_national_id ON sis.students (tenant_id, national_id_hash) WHERE national_id_hash IS NOT NULL;
```

#### Table 11: `sis.student_photos`
Metadata and filesystem reference for student portrait images (OD-05).
```sql
CREATE TABLE sis.student_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  stored_file_path VARCHAR(500) NOT NULL, -- Relative path under uploads/sis/
  mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes <= 2097152), -- 2MB max
  sha256_checksum VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_active_photo UNIQUE (student_id) WHERE is_active = true
);

CREATE INDEX idx_sis_photos_student ON sis.student_photos (student_id);
```

#### Table 12: `sis.student_documents`
Uploaded admission documents, birth certificates, and previous school transfer certificates.
```sql
CREATE TABLE sis.student_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  application_id UUID NULL REFERENCES sis.admission_applications(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('birth_certificate', 'transfer_certificate', 'immunization_record', 'previous_marksheet', 'identity_proof', 'other')),
  file_name VARCHAR(255) NOT NULL,
  stored_file_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50) NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes <= 5242880), -- 5MB max
  sha256_checksum VARCHAR(64) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_doc_target CHECK (student_id IS NOT NULL OR application_id IS NOT NULL)
);

CREATE INDEX idx_sis_docs_student ON sis.student_documents (student_id);
CREATE INDEX idx_sis_docs_app ON sis.student_documents (application_id);
```

#### Table 13: `sis.student_health_records` (Segregated)
Segregated health table with strict role isolation (Principal, Admin, Nurse; Teachers see allergy summary only).
```sql
CREATE TABLE sis.student_health_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  has_critical_allergy BOOLEAN NOT NULL DEFAULT false,
  allergies_summary TEXT NULL,           -- Visible to classroom teachers for safety
  medical_conditions TEXT NULL,          -- Confidential; restricted from teachers
  medications_prescribed TEXT NULL,      -- Confidential; restricted from teachers
  emergency_protocol TEXT NULL,          -- Instructions for critical events
  primary_physician_name VARCHAR(100) NULL,
  primary_physician_phone VARCHAR(20) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_student_health UNIQUE (student_id)
);

CREATE INDEX idx_sis_health_student ON sis.student_health_records (student_id);
```

#### Table 14: `sis.student_safeguarding_records` (Segregated)
High-confidentiality child safeguarding notes and court custody orders.
```sql
CREATE TABLE sis.student_safeguarding_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  protection_tier VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (protection_tier IN ('standard', 'monitoring', 'active_child_protection', 'restricted_custody')),
  custody_alert_flag BOOLEAN NOT NULL DEFAULT false,
  court_order_reference VARCHAR(100) NULL,
  confidential_notes TEXT NOT NULL,
  designated_safeguarding_lead_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_student_safeguard UNIQUE (student_id)
);

CREATE INDEX idx_sis_safeguard_student ON sis.student_safeguarding_records (student_id);
```

---

### 2.4 Domain 4: Guardian Network & Kinship Scoping

#### Table 15: `sis.guardians`
Master guardian identity records.
```sql
CREATE TABLE sis.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20) NULL,
  relationship VARCHAR(30) NOT NULL,     -- e.g. "Father", "Mother", "Grandparent", "Legal Guardian"
  occupation VARCHAR(100) NULL,
  user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL, -- Linked portal login
  address_street TEXT NULL,
  address_city VARCHAR(100) NULL,
  address_state VARCHAR(100) NULL,
  address_postal_code VARCHAR(20) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_guardian_email UNIQUE (tenant_id, lower(email))
);

CREATE INDEX idx_sis_guardians_tenant ON sis.guardians (tenant_id);
CREATE INDEX idx_sis_guardians_user ON sis.guardians (user_id);
```

#### Table 16: `sis.student_guardians`
Resolves M:N kinship mappings, legal custody, and pickup authorizations.
```sql
CREATE TABLE sis.student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES sis.guardians(id) ON DELETE RESTRICT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  has_legal_custody BOOLEAN NOT NULL DEFAULT true,
  can_pickup BOOLEAN NOT NULL DEFAULT true,
  receives_academic_reports BOOLEAN NOT NULL DEFAULT true,
  receives_fee_invoices BOOLEAN NOT NULL DEFAULT true,
  emergency_priority INTEGER NOT NULL DEFAULT 1 CHECK (emergency_priority BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_stu_guardian UNIQUE (student_id, guardian_id)
);

CREATE UNIQUE INDEX uq_sis_single_primary_guardian ON sis.student_guardians (student_id) WHERE is_primary = true;
CREATE INDEX idx_sis_stu_guard_student ON sis.student_guardians (student_id);
CREATE INDEX idx_sis_stu_guard_guardian ON sis.student_guardians (guardian_id);
```

#### Table 17: `sis.guardian_consents`
Digital consent management for educational media, excursions, and DPDP Section 9 verifications.
```sql
CREATE TABLE sis.guardian_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_guardian_id UUID NOT NULL REFERENCES sis.student_guardians(id) ON DELETE CASCADE,
  consent_type VARCHAR(50) NOT NULL CHECK (consent_type IN ('photography_media', 'field_trip_travel', 'emergency_medical_treatment', 'data_processing_dpdp')),
  is_granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_guardian_consent UNIQUE (student_guardian_id, consent_type)
);
```

---

### 2.5 Domain 5: Cohort Enrolments & Academic Rollover (OD-01)

#### Table 18: `sis.student_enrollments`
Enrolls a student into a specific section for an academic year.
```sql
CREATE TABLE sis.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE RESTRICT,
  roll_number INTEGER NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'promoted', 'retained', 'transferred', 'withdrawn')),
  enrollment_date DATE NOT NULL,
  exit_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_section_roll UNIQUE (section_id, roll_number) WHERE status = 'active'
);

-- Exactly one active enrollment per student per academic year
CREATE UNIQUE INDEX uq_sis_active_enrollment ON sis.student_enrollments (student_id, academic_year_id) WHERE status = 'active';
CREATE INDEX idx_sis_enrollments_lookup ON sis.student_enrollments (section_id, academic_year_id, status);
CREATE INDEX idx_sis_enrollments_student ON sis.student_enrollments (student_id);
```

#### Table 19: `sis.academic_rollover_logs`
Header log tracking execution of the Annual Academic Rollover Wizard (OD-01).
```sql
CREATE TABLE sis.academic_rollover_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  from_academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  to_academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  total_candidates INTEGER NOT NULL DEFAULT 0,
  promoted_count INTEGER NOT NULL DEFAULT 0,
  retained_count INTEGER NOT NULL DEFAULT 0,
  graduated_count INTEGER NOT NULL DEFAULT 0,
  executed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress', 'completed', 'failed', 'rolled_back')),
  execution_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_rollover_years CHECK (from_academic_year_id <> to_academic_year_id)
);

CREATE INDEX idx_sis_rollover_branch ON sis.academic_rollover_logs (branch_id, to_academic_year_id);
```

#### Table 20: `sis.academic_rollover_items`
Individual line item recording each student's promotion decision during rollover.
```sql
CREATE TABLE sis.academic_rollover_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  rollover_log_id UUID NOT NULL REFERENCES sis.academic_rollover_logs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE RESTRICT,
  from_section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE RESTRICT,
  to_section_id UUID NULL REFERENCES sis.sections(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('promoted', 'retained', 'graduated', 'left_school')),
  previous_roll_number INTEGER NULL,
  new_roll_number INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_rollover_items_log ON sis.academic_rollover_items (rollover_log_id);
CREATE INDEX idx_sis_rollover_items_stu ON sis.academic_rollover_items (student_id);
```

---

### 2.6 Domain 6: Bulk Import Engine

#### Table 21: `sis.student_import_jobs`
Tracks batch student roster import operations (CSV/XLSX).
```sql
CREATE TABLE sis.student_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  file_name VARCHAR(255) NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  successful_rows INTEGER NOT NULL DEFAULT 0,
  failed_rows INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'validating', 'validated', 'importing', 'completed', 'failed')),
  error_summary JSONB NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_import_jobs ON sis.student_import_jobs (tenant_id, branch_id, status);
```

#### Table 22: `sis.student_import_rows`
Staging table storing raw ingested lines and individual validation errors.
```sql
CREATE TABLE sis.student_import_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  import_job_id UUID NOT NULL REFERENCES sis.student_import_jobs(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data JSONB NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'error', 'imported')),
  validation_errors JSONB NULL,
  imported_student_id UUID NULL REFERENCES sis.students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_import_rows_job ON sis.student_import_rows (import_job_id, status);
```

---

### 2.7 Domain 7: Daily Attendance Engine (OD-02)

#### Table 23: `sis.attendance_sessions`
Daily attendance session register representing roll-call for a section on a date.
```sql
CREATE TABLE sis.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE RESTRICT,
  session_date DATE NOT NULL,
  session_type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (session_type IN ('daily', 'morning', 'afternoon', 'period')),
  period_number INTEGER NULL,
  taken_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_locked BOOLEAN NOT NULL DEFAULT false, -- Locked after daily lock window
  locked_at TIMESTAMPTZ NULL,
  total_present INTEGER NOT NULL DEFAULT 0,
  total_absent INTEGER NOT NULL DEFAULT 0,
  total_late INTEGER NOT NULL DEFAULT 0,
  total_excused INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_attendance_session UNIQUE (section_id, session_date, session_type, period_number)
);

CREATE INDEX idx_sis_att_session_lookup ON sis.attendance_sessions (section_id, session_date);
CREATE INDEX idx_sis_att_session_branch ON sis.attendance_sessions (branch_id, session_date);
```

#### Table 24: `sis.student_attendance`
Individual student roll-call entry for an attendance session.
```sql
CREATE TABLE sis.student_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  attendance_session_id UUID NOT NULL REFERENCES sis.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused', 'half_day')),
  arrival_time TIME NULL,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_student_att_session UNIQUE (attendance_session_id, student_id)
);

CREATE INDEX idx_sis_stu_att_session ON sis.student_attendance (attendance_session_id);
CREATE INDEX idx_sis_stu_att_student ON sis.student_attendance (student_id, status);
```

#### Table 25: `sis.attendance_audit_logs`
Immutable audit record for any post-submission attendance modifications.
```sql
CREATE TABLE sis.attendance_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_attendance_id UUID NOT NULL REFERENCES sis.student_attendance(id) ON DELETE CASCADE,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  reason TEXT NOT NULL,
  modified_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_att_audit_record ON sis.attendance_audit_logs (student_attendance_id);
```

---

### 2.8 Domain 8: In-App Communications & Announcements

#### Table 26: `sis.announcements`
Broadcast notices, emergency alerts, and circulars.
```sql
CREATE TABLE sis.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NULL REFERENCES public.branches(id) ON DELETE CASCADE, -- NULL = tenant-wide
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'standard' CHECK (priority IN ('standard', 'important', 'urgent', 'emergency')),
  publish_date TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  expires_at TIMESTAMPTZ NULL,
  author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_announcements_lookup ON sis.announcements (tenant_id, branch_id, is_published, publish_date);
```

#### Table 27: `sis.announcement_audiences`
Defines targeted recipient roles (e.g. Teacher, Student, Parent, Staff).
```sql
CREATE TABLE sis.announcement_audiences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  announcement_id UUID NOT NULL REFERENCES sis.announcements(id) ON DELETE CASCADE,
  target_role VARCHAR(50) NOT NULL CHECK (target_role IN ('all', 'SchoolAdmin', 'Principal', 'Teacher', 'Student', 'Parent', 'Accountant')),
  target_class_id UUID NULL REFERENCES sis.classes(id) ON DELETE CASCADE, -- Optional class filter
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_ann_audience UNIQUE (announcement_id, target_role, target_class_id)
);

CREATE INDEX idx_sis_ann_audience_lookup ON sis.announcement_audiences (target_role, target_class_id);
```

---

### 2.9 Domain 9: Timetable & Homework / Assignments

#### Table 28: `sis.timetable_periods`
Defines standard time bell schedule for a branch (e.g. "Period 1: 08:30–09:15").
```sql
CREATE TABLE sis.timetable_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,              -- e.g. "Period 1", "Morning Break"
  period_order INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_break BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_period_time CHECK (end_time > start_time),
  CONSTRAINT uq_sis_branch_period UNIQUE (branch_id, period_order)
);

CREATE INDEX idx_sis_periods_branch ON sis.timetable_periods (branch_id, period_order);
```

#### Table 29: `sis.timetable_slots`
Maps a weekly day and period to a section, subject, teacher, and room.
```sql
CREATE TABLE sis.timetable_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE CASCADE,
  period_id UUID NOT NULL REFERENCES sis.timetable_periods(id) ON DELETE RESTRICT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Monday, 7=Sunday
  subject_id UUID NOT NULL REFERENCES sis.subjects(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  room_number VARCHAR(30) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_section_slot UNIQUE (academic_year_id, section_id, day_of_week, period_id)
);

-- Ensure a teacher cannot be double-booked in two sections at the same period
CREATE UNIQUE INDEX uq_sis_teacher_no_conflict ON sis.timetable_slots (academic_year_id, teacher_id, day_of_week, period_id);
CREATE INDEX idx_sis_slots_section ON sis.timetable_slots (section_id, day_of_week);
CREATE INDEX idx_sis_slots_teacher ON sis.timetable_slots (teacher_id, day_of_week);
```

#### Table 30: `sis.assignments`
Teacher-created homework, coursework, and reading assignments.
```sql
CREATE TABLE sis.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES sis.subjects(id) ON DELETE RESTRICT,
  teacher_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  assigned_date DATE NOT NULL,
  due_date DATE NOT NULL,
  max_marks NUMERIC(5, 2) NULL CHECK (max_marks > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_hw_dates CHECK (due_date >= assigned_date)
);

CREATE INDEX idx_sis_assignments_section ON sis.assignments (section_id, due_date);
CREATE INDEX idx_sis_assignments_teacher ON sis.assignments (teacher_id);
```

#### Table 31: `sis.assignment_completions`
Tracks individual student submission or completion status.
```sql
CREATE TABLE sis.assignment_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  assignment_id UUID NOT NULL REFERENCES sis.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'submitted', 'evaluated', 'overdue')),
  submission_text TEXT NULL,
  submitted_at TIMESTAMPTZ NULL,
  marks_awarded NUMERIC(5, 2) NULL,
  feedback_notes TEXT NULL,
  graded_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  graded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_stu_assignment UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_sis_completions_student ON sis.assignment_completions (student_id, status);
CREATE INDEX idx_sis_completions_assign ON sis.assignment_completions (assignment_id);
```

---

### 2.10 Domain 10: Fees, Receipts, Concessions & Waivers (OD-04)

#### Table 32: `sis.fee_categories`
Master ledger categories (e.g. "Annual Tuition", "Laboratory Fee", "Computer Fee").
```sql
CREATE TABLE sis.fee_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,            -- e.g. "Annual Tuition Fee"
  code VARCHAR(20) NOT NULL,             -- e.g. "TUIT-ANN"
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_fee_cat_code UNIQUE (tenant_id, code)
);
```

#### Table 33: `sis.fee_structures`
Defines fee pricing templates per class and academic year.
```sql
CREATE TABLE sis.fee_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  fee_category_id UUID NOT NULL REFERENCES sis.fee_categories(id) ON DELETE RESTRICT,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_fee_structure UNIQUE (branch_id, academic_year_id, class_id, fee_category_id)
);

CREATE INDEX idx_sis_fee_struct ON sis.fee_structures (branch_id, academic_year_id, class_id);
```

#### Table 34: `sis.fee_concession_categories`
Authorized institutional concession categories (OD-04, e.g. "Sibling Discount", "Staff Dependent", "Merit Scholarship").
```sql
CREATE TABLE sis.fee_concession_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name VARCHAR(100) NOT NULL,            -- e.g. "Sibling Discount"
  code VARCHAR(20) NOT NULL,             -- e.g. "CONC-SIB"
  concession_type VARCHAR(20) NOT NULL CHECK (concession_type IN ('percentage', 'fixed_amount')),
  default_value NUMERIC(12, 2) NOT NULL CHECK (default_value >= 0),
  requires_principal_approval BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_conc_cat_code UNIQUE (tenant_id, code)
);
```

#### Table 35: `sis.student_fee_allocations`
Student ledger debit balance reflecting assessed fee obligations.
```sql
CREATE TABLE sis.student_fee_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  fee_structure_id UUID NOT NULL REFERENCES sis.fee_structures(id) ON DELETE RESTRICT,
  allocated_amount NUMERIC(12, 2) NOT NULL CHECK (allocated_amount >= 0),
  concession_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (concession_amount >= 0),
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'waived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_fee_amounts CHECK (concession_amount <= allocated_amount AND (paid_amount + concession_amount) <= allocated_amount),
  CONSTRAINT uq_sis_stu_fee_alloc UNIQUE (student_id, fee_structure_id)
);

CREATE INDEX idx_sis_fee_alloc_student ON sis.student_fee_allocations (student_id, status);
CREATE INDEX idx_sis_fee_alloc_due ON sis.student_fee_allocations (tenant_id, status, due_date);
```

#### Table 36: `sis.fee_concessions`
Individual concession applications and Principal approval workflows (OD-04).
```sql
CREATE TABLE sis.fee_concessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_fee_allocation_id UUID NOT NULL REFERENCES sis.student_fee_allocations(id) ON DELETE CASCADE,
  concession_category_id UUID NOT NULL REFERENCES sis.fee_concession_categories(id) ON DELETE RESTRICT,
  concession_amount NUMERIC(12, 2) NOT NULL CHECK (concession_amount > 0),
  justification TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  approved_by UUID NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ NULL,
  decision_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_concessions_alloc ON sis.fee_concessions (student_fee_allocation_id);
CREATE INDEX idx_sis_concessions_pending ON sis.fee_concessions (tenant_id, status) WHERE status = 'pending';
```

#### Table 37: `sis.fee_receipt_sequences`
Atomic counter sequence per branch/year ensuring strictly sequential financial receipts.
```sql
CREATE TABLE sis.fee_receipt_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  prefix VARCHAR(20) NOT NULL,            -- e.g. "REC-APEX-26-"
  last_receipt_number INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_receipt_seq UNIQUE (branch_id, academic_year_id)
);
```

#### Table 38: `sis.fee_payments`
Immutable financial credit ledger recording verified cashier collections.
```sql
CREATE TABLE sis.fee_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_fee_allocation_id UUID NOT NULL REFERENCES sis.student_fee_allocations(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(30) NOT NULL,    -- Sequential official receipt
  amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
  payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'cheque', 'bank_transfer', 'pos_dd')),
  payment_reference VARCHAR(100) NULL,    -- Cheque/UTR/Transaction number
  payment_date DATE NOT NULL,
  received_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  remarks VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_sis_receipt_num UNIQUE (tenant_id, receipt_number)
);

CREATE INDEX idx_sis_payments_alloc ON sis.fee_payments (student_fee_allocation_id);
CREATE INDEX idx_sis_payments_receipt ON sis.fee_payments (tenant_id, receipt_number);
```

---

### 2.11 Domain 11: Staff Leave Management

#### Table 39: `sis.staff_leave_requests`
Teacher and staff leave submissions and administrative approval pipeline.
```sql
CREATE TABLE sis.staff_leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  staff_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  leave_type VARCHAR(30) NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'maternity', 'unpaid', 'bereavement')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC(4, 1) NOT NULL CHECK (total_days > 0),
  reason TEXT NOT NULL,
  substitute_teacher_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ NULL,
  decision_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT chk_sis_leave_dates CHECK (end_date >= start_date)
);

CREATE INDEX idx_sis_leave_staff ON sis.staff_leave_requests (staff_id, status);
CREATE INDEX idx_sis_leave_branch_pending ON sis.staff_leave_requests (branch_id, status) WHERE status = 'pending';
```

#### Table 40: `sis.staff_leave_audits`
Immutable record of leave approval/rejection lifecycle transitions.
```sql
CREATE TABLE sis.staff_leave_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  leave_request_id UUID NOT NULL REFERENCES sis.staff_leave_requests(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX idx_sis_leave_audit ON sis.staff_leave_audits (leave_request_id);
```

---

## 3. Row-Level Security (RLS) Policy Declarations

Every table created under schema `sis` enforces strict tenant isolation via fail-closed PostgreSQL Row-Level Security policies:

```sql
DO $$
DECLARE
  tbl text;
  sis_tables text[] := ARRAY[
    'academic_years', 'academic_terms', 'academic_calendar_events',
    'classes', 'sections', 'subjects', 'section_subject_teachers',
    'admission_number_sequences', 'admission_applications', 'students',
    'student_photos', 'student_documents', 'student_health_records',
    'student_safeguarding_records', 'guardians', 'student_guardians',
    'guardian_consents', 'student_enrollments', 'academic_rollover_logs',
    'academic_rollover_items', 'student_import_jobs', 'student_import_rows',
    'attendance_sessions', 'student_attendance', 'attendance_audit_logs',
    'announcements', 'announcement_audiences', 'timetable_periods',
    'timetable_slots', 'assignments', 'assignment_completions',
    'fee_categories', 'fee_structures', 'fee_concession_categories',
    'student_fee_allocations', 'fee_concessions', 'fee_receipt_sequences',
    'fee_payments', 'staff_leave_requests', 'staff_leave_audits'
  ];
BEGIN
  FOREACH tbl IN ARRAY sis_tables LOOP
    EXECUTE format('ALTER TABLE sis.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE sis.%I FORCE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_%I ON sis.%I;', tbl, tbl);
    EXECUTE format('
      CREATE POLICY tenant_isolation_%I ON sis.%I
        FOR ALL
        TO school_app_user
        USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)
        WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid);
    ', tbl, tbl);
  END LOOP;
END $$;
```

---

## 4. Atomic Transaction Boundaries & Financial Rules

### 4.1 Admission Application to Enrolled Student Conversion
When an application status transitions to `enrolled`, the system executes an atomic transaction:
```sql
BEGIN;
  -- 1. Increment atomic admission number sequence with row-level lock
  SELECT last_number FROM sis.admission_number_sequences 
  WHERE branch_id = $1 AND academic_year_id = $2 FOR UPDATE;
  
  -- 2. Insert into sis.students with newly generated admission_number
  INSERT INTO sis.students (...) VALUES (...) RETURNING id;
  
  -- 3. Upsert guardian into sis.guardians and link in sis.student_guardians
  INSERT INTO sis.guardians (...) VALUES (...) RETURNING id;
  INSERT INTO sis.student_guardians (...) VALUES (...);
  
  -- 4. Create active enrollment in sis.student_enrollments
  INSERT INTO sis.student_enrollments (student_id, academic_year_id, class_id, section_id, status) ...;
  
  -- 5. Allocate fee obligations based on active fee_structures for class
  INSERT INTO sis.student_fee_allocations (...) SELECT ... FROM sis.fee_structures WHERE ...;
  
  -- 6. Update admission_applications status to 'enrolled'
  UPDATE sis.admission_applications SET status = 'enrolled' WHERE id = $3;
COMMIT;
```

### 4.2 Cashier Fee Payment Recording
When an accountant collects a fee payment:
```sql
BEGIN;
  -- 1. Lock fee allocation row to prevent concurrent payment race conditions
  SELECT allocated_amount, concession_amount, paid_amount 
  FROM sis.student_fee_allocations WHERE id = $1 FOR UPDATE;
  
  -- 2. Verify: (paid_amount + concession_amount + new_payment) <= allocated_amount
  
  -- 3. Atomically increment receipt sequence
  UPDATE sis.fee_receipt_sequences 
  SET last_receipt_number = last_receipt_number + 1 
  WHERE branch_id = $2 AND academic_year_id = $3
  RETURNING last_receipt_number, prefix;
  
  -- 4. Insert immutable record into sis.fee_payments
  INSERT INTO sis.fee_payments (student_fee_allocation_id, receipt_number, amount_paid, ...) ...;
  
  -- 5. Update paid_amount and re-evaluate status ('paid' or 'partially_paid')
  UPDATE sis.student_fee_allocations 
  SET paid_amount = paid_amount + $4,
      status = CASE WHEN (paid_amount + $4 + concession_amount) >= allocated_amount THEN 'paid' ELSE 'partially_paid' END,
      updated_at = clock_timestamp()
  WHERE id = $1;
COMMIT;
```

### 4.3 Concession Approval & Ledger Application (OD-04)
When a Principal approves a fee concession:
```sql
BEGIN;
  -- 1. Lock allocation row
  SELECT allocated_amount, concession_amount, paid_amount 
  FROM sis.student_fee_allocations WHERE id = $1 FOR UPDATE;
  
  -- 2. Ensure concession does not exceed remaining unpaid balance:
  -- CHECK: concession_amount <= (allocated_amount - paid_amount - existing_concession)
  
  -- 3. Update concession request status to 'approved'
  UPDATE sis.fee_concessions SET status = 'approved', approved_by = $2, decided_at = clock_timestamp() WHERE id = $3;
  
  -- 4. Credit allocation ledger
  UPDATE sis.student_fee_allocations 
  SET concession_amount = concession_amount + $4,
      status = CASE WHEN (paid_amount + concession_amount + $4) >= allocated_amount THEN 'paid' ELSE status END
  WHERE id = $1;
COMMIT;
```

### 4.4 Annual Rollover Execution (OD-01)
Promotion review wizard executes inside a single top-level ACID transaction block:
- Verifies target academic year exists and is not locked.
- Updates existing enrollments for promoted candidates from `status = 'active'` to `status = 'promoted'`.
- Inserts new enrollment rows in target academic year with target section.
- Locks source academic year: `UPDATE sis.academic_years SET is_locked = true WHERE id = $source_year`.
- Emits log in `sis.academic_rollover_logs` and line items in `sis.academic_rollover_items`.
- If any section capacity constraint fails, the entire transaction rolls back cleanly.
