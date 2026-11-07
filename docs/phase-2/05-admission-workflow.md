# Document 05: Admission Workflow & Onboarding Pipeline

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Business Workflow & Onboarding Architecture  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal System Architect & Operations Engineer  

---

## 1. Domain Overview & Application vs. Student Separation

A common architectural flaw in legacy school management platforms is creating active student records immediately upon receiving an initial inquiry or application form.

This creates severe operational and legal compliance vulnerabilities:
- **Polluted Rosters:** Withdrawn inquiries, rejected applicants, or candidates who decline offers appear in active classroom lists.
- **Premature Admission Numbers:** Issuing permanent institutional admission numbers before seat acceptance and fee settlement creates fragmented gaps in official registry books and state reporting logs.
- **Privacy Over-Collection:** Under Section 6 and Section 9 of the India Digital Personal Data Protection (DPDP) Act 2023, retaining sensitive health, guardian, and biometric identifiers for non-matriculating candidates violates data minimization principles.

### Core Architectural Principle: Strict Stage Boundary
**An Admission Application is a prospective candidate workflow entity.** It remains completely segregated in the `sis.admission_applications` table throughout the recruitment, document intake, and evaluation lifecycle.

A record in the permanent `sis.students` table is instantiated **only** when the application is formally approved, admission terms are accepted, required verification documents are validated, and the onboarding transaction commits.

---

## 2. End-to-End Admission State Machine

```
[ Candidate / Parent / Desk Intake ]
                 │
                 │ 1. Submits Online / Counter Application
                 ▼
┌─────────────────────────────────┐
│   sis.admission_applications    │
│   Status: 'submitted'           │
│   Ref: APP-2026-0812            │
└────────────────┬────────────────┘
                 │
                 │ 2. Registrar Initiates Verification & Deduplication Scan
                 ▼
┌─────────────────────────────────┐
│   sis.admission_applications    │
│   Status: 'under_review'        │
└────────────────┬────────────────┘
                 │
                 ├─────────────────────────────────┐
                 │ Assessment / Interview Required │ Direct Disqualification / Age Ineligible
                 ▼                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│   sis.admission_applications    │       │   sis.admission_applications    │
│   Status: 'assessment_pending'  │       │   Status: 'rejected'            │
└────────────────┬────────────────┘       │   (Mandatory Reason Documented) │
                 │                        └─────────────────────────────────┘
                 │ Capacity Exceeded
                 ▼
┌─────────────────────────────────┐
│   sis.admission_applications    │
│   Status: 'waitlisted'          │
└────────────────┬────────────────┘
                 │
                 │ 3. Principal Approves Offer
                 ▼
┌─────────────────────────────────┐
│   sis.admission_applications    │
│   Status: 'approved'            │
└────────────────┬────────────────┘
                 │
                 │ 4. Guardian Accepts & Completes Enrollment
                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                   ATOMIC ONBOARDING TRANSACTION                  │
│                                                                  │
│ 1. Acquire row lock on `sis.admission_number_sequences`          │
│ 2. Increment & RETURNING next sequence number (e.g., 0042)        │
│ 3. Format admission number: {TENANT}-{BRANCH}-{YEAR}-{SEQ:04d}   │
│ 4. INSERT INTO `sis.students` (Status: 'admitted')               │
│ 5. LINK / INSERT `sis.guardians` & `sis.student_guardians`       │
│ 6. PROMOTE verified documents from `sis.application_documents`   │
│    to `sis.student_documents`                                    │
│ 7. INSERT INTO `sis.student_enrollments` (Section assignment)    │
│ 8. UPDATE `sis.admission_applications` (Status: 'enrolled')      │
│ 9. WRITE Audit Log (`sis.audit_logs`: 'admissions.enrolled')     │
└────────────────────────────────┬─────────────────────────────────┘
                                 │
                                 ▼
                    [ Active Enrolled Student ]
```

---

## 3. Duplicate Detection & Identity Verification Algorithm

Before an application moves from `'submitted'` to `'under_review'`, the system executes an automated duplicate detection scan across both active student archives and existing applications within the tenant.

### 3.1 Detection Passes
1. **Deterministic Exact Match:**
   Checks for active students in the same tenant:
   ```sql
   SELECT id, admission_number, current_status 
   FROM sis.students 
   WHERE tenant_id = :tenant_id 
     AND LOWER(first_name) = LOWER(:first_name) 
     AND LOWER(last_name) = LOWER(:last_name) 
     AND date_of_birth = :dob;
   ```
2. **Guardian Phone Correlation:**
   Identifies whether the applicant belongs to an existing family:
   ```sql
   SELECT g.id, g.first_name, g.last_name, sg.student_id
   FROM sis.guardians g
   JOIN sis.student_guardians sg ON sg.guardian_id = g.id
   WHERE g.tenant_id = :tenant_id AND g.phone = :guardian_phone;
   ```
3. **Voluntary National ID Hash Match (Salted):**
   If a voluntary national identifier (e.g. Aadhaar) is supplied:
   ```sql
   SELECT id, admission_number 
   FROM sis.students 
   WHERE tenant_id = :tenant_id 
     AND national_id_hash = digest(:id_salt || :input_id, 'sha256');
   ```

### 3.2 Detection Outcomes & Resolution
- **Sibling Match:** If the guardian matches but child demographics differ, the system flags:  
  `"SIBLING DETECTED: Matches Guardian [UUID]. Link to existing family profile?"`  
  This avoids creating redundant guardian profiles while preserving tenant isolation.
- **Duplicate Identity Match:** If both child demographics and guardian phone match an existing student, the status cannot advance without registrar manual review and approval:  
  `"POTENTIAL DUPLICATE DETECTED: Matches Student ID [UUID] (Admission # APX-BR1-2024-0012). Re-admission or Data Error?"`

---

## 4. Admission Number Generation Architecture

The institutional admission number is a permanent legal identifier assigned to an enrolled student.

### 4.1 Strict Flaw Avoidance: No `COUNT(*)` or `MAX()`
Generating admission numbers using `SELECT COUNT(*) + 1 FROM students` or `SELECT MAX(admission_number)` is **strictly prohibited**:
1. **Concurrency Race Conditions:** Two concurrent admission approvals calculate the exact same sequence number, producing duplicate key constraint violations (`uq_students_tenant_admission_no`).
2. **Deletion / Rollback Distortion:** Historical student departures or transaction aborts alter counts, leading to reuse or misalignment.
3. **Table Scans:** Aggregating large student tables degrades latency under peak enrollment periods.

### 4.2 Branch-Scoped Concurrency-Safe Sequence Model
Admission numbers are generated using a dedicated counter table scoped by tenant, branch, academic year, and prefix:

$$\text{Admission Number} = \langle\text{TENANT\_CODE}\rangle - \langle\text{BRANCH\_CODE}\rangle - \langle\text{YEAR}\rangle - \langle\text{SEQUENCE:04d}\rangle$$

*Example:* `APEX-BR1-2026-0042` (Apex Academy, Branch 1, Academic Year 2026-27, 42nd enrolled student).

```sql
CREATE TABLE IF NOT EXISTS sis.admission_number_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  prefix VARCHAR(30) NOT NULL,
  last_sequence INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_sis_admission_seq UNIQUE (tenant_id, branch_id, academic_year_id, prefix)
);
```

### 4.3 Atomic Generation & Concurrency Mechanics
The sequence allocation executes within the application's onboarding transaction using PostgreSQL's atomic row-level locking on `UPDATE`:

```sql
UPDATE sis.admission_number_sequences
SET last_sequence = last_sequence + 1,
    updated_at = now()
WHERE tenant_id = $1 
  AND branch_id = $2 
  AND academic_year_id = $3 
  AND prefix = $4
RETURNING last_sequence;
```

#### Concurrency and Failure Behavior:
- **Serialization Guarantee:** PostgreSQL places an exclusive row-level lock (`X` lock) on the matched row in `sis.admission_number_sequences` until the transaction ends. Concurrent approval transactions queue orderly on the row lock.
- **Rollback Consistency:** If any subsequent operation in the onboarding transaction fails (e.g., section capacity check, foreign key validation), the entire transaction rolls back. Because the `UPDATE` is inside the transaction, the sequence counter also rolls back to its prior value. No sequence number is consumed or lost.
- **Deadlock Avoidance:** All onboarding transactions acquire the sequence lock in the identical operational sequence (Lock Sequence $\to$ Insert Student $\to$ Insert Guardians $\to$ Insert Enrollment $\to$ Commit).
- **Retry Policy:** Application code wraps onboarding in a transient error retry handler (up to 3 retries with jittered exponential backoff) for PostgreSQL error code `40P01` (Deadlock Detected) or `55P03` (Lock Not Available).

---

## 5. PostgreSQL Schema DDL (Schema: `sis`)

```sql
-- Set search path context
SET search_path = sis, public;

-- 1. Admission Applications Table
CREATE TABLE IF NOT EXISTS sis.admission_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  target_class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  
  -- Tracking Reference
  application_number VARCHAR(50) NOT NULL,
  
  -- Applicant Demographics
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(20) NOT NULL,
  
  -- Voluntary Identity Token (Salted SHA-256)
  national_id_hash VARCHAR(64),
  national_id_last4 VARCHAR(4),
  
  -- Primary Guardian Information (Pre-Enrollment Intake)
  guardian_first_name VARCHAR(100) NOT NULL,
  guardian_last_name VARCHAR(100) NOT NULL,
  guardian_relationship VARCHAR(30) NOT NULL,
  guardian_phone VARCHAR(20) NOT NULL,
  guardian_email VARCHAR(200),
  
  -- Residential Address
  residential_address JSONB,
  
  -- Academic History
  previous_school_name VARCHAR(200),
  last_grade_passed VARCHAR(50),
  
  -- State Workflow
  status VARCHAR(30) NOT NULL DEFAULT 'submitted',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT,
  rejection_reason TEXT,
  
  -- Link to Matriculated Student (Set upon successful onboarding)
  enrolled_student_id UUID REFERENCES sis.students(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_admission_app_tenant_ref UNIQUE (tenant_id, application_number),
  CONSTRAINT chk_admission_app_status CHECK (status IN (
    'draft', 'submitted', 'under_review', 'assessment_pending', 
    'waitlisted', 'approved', 'rejected', 'enrolled', 'withdrawn', 'cancelled'
  ))
);

-- Indices for Admission Querying & Filtering
CREATE INDEX IF NOT EXISTS idx_admissions_tenant_status 
  ON sis.admission_applications (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_admissions_tenant_branch 
  ON sis.admission_applications (tenant_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_admissions_target_class 
  ON sis.admission_applications (target_class_id, status);

CREATE INDEX IF NOT EXISTS idx_admissions_guardian_phone 
  ON sis.admission_applications (tenant_id, guardian_phone);

-- 2. Application Document Attachments
CREATE TABLE IF NOT EXISTS sis.application_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  application_id UUID NOT NULL REFERENCES sis.admission_applications(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_app_doc_type CHECK (document_type IN (
    'birth_certificate', 'transfer_certificate', 'previous_marksheet', 
    'identity_proof', 'address_proof', 'medical_clearance', 'other'
  )),
  CONSTRAINT chk_app_doc_verification CHECK (verification_status IN (
    'pending', 'verified', 'rejected'
  ))
);

CREATE INDEX IF NOT EXISTS idx_app_docs_app_id 
  ON sis.application_documents (application_id);
```

---

## 6. Row-Level Security (RLS) & Multi-Tenant Isolation

Admission records contain prospective personal data and must be strictly isolated by `tenant_id` and authorized `branch_id`.

```sql
-- Enable RLS
ALTER TABLE sis.admission_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.admission_number_sequences FORCE ROW LEVEL SECURITY;

ALTER TABLE sis.admission_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.admission_applications FORCE ROW LEVEL SECURITY;

ALTER TABLE sis.application_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sis.application_documents FORCE ROW LEVEL SECURITY;

-- Sequences Isolation Policy
CREATE POLICY rls_sis_admission_sequences ON sis.admission_number_sequences
  FOR ALL
  TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Applications Isolation Policy (Tenant + Branch Enforcement)
CREATE POLICY rls_sis_admission_applications ON sis.admission_applications
  FOR ALL
  TO school_app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    AND (
      current_setting('app.current_branch_id', true) IS NULL 
      OR current_setting('app.current_branch_id', true) = ''
      OR branch_id = NULLIF(current_setting('app.current_branch_id', true), '')::UUID
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    AND (
      current_setting('app.current_branch_id', true) IS NULL 
      OR current_setting('app.current_branch_id', true) = ''
      OR branch_id = NULLIF(current_setting('app.current_branch_id', true), '')::UUID
    )
  );

-- Application Documents Policy
CREATE POLICY rls_sis_application_docs ON sis.application_documents
  FOR ALL
  TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
```

---

## 7. Data Minimization & Retention for Prospective Candidates

Under the DPDP Act 2023, data collected for a specific purpose cannot be retained indefinitely when that purpose has lapsed.

### Retention Rules:
1. **Enrolled Candidates:** Application record is marked `'enrolled'` and referenced by `sis.students.id`. Demographics and verified documents are promoted to permanent student tables.
2. **Rejected / Withdrawn Candidates:**
   - Retained in status `'rejected'` or `'withdrawn'` for the duration of the current academic cycle plus 12 months (to handle re-application inquiries or compliance reviews).
   - Automated retention job executes soft-anonymization after 12 months: residential address and uploaded documents are purged (`storage_path` unlinked and deleted from local storage); baseline audit log of the application reference and rejection rationale is preserved for statistical reporting.
