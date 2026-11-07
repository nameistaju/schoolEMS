# Document 03: Academic Structure & Enrollment Integrity (Revised)

**Document Status:** REVISED DESIGN SPECIFICATION — READY FOR REVIEW  
**Classification:** Academic Domain Modeling & Progression Logic  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026 (Revised)  
**Author:** Principal System Architect & Educational Domain Specialist  
**Database Schema:** `sis` (within database `auth_db`)  

---

## 1. Domain Separation & Temporal Enrollment Ledger

SchoolEMS enforces an immutable separation between a student's permanent profile (`sis.students`) and their temporal academic-year placement (`sis.student_enrollments`).

A student is never "in Grade 7" as a static attribute. Rather, a student has an **active enrollment** in Grade 7 Section A for the **2026–2027 Academic Year**. When the student advances to Grade 8 in 2027–2028, the Grade 7 enrollment record is marked `status = 'promoted'`, preserving all historical attendance, report cards, fee receipts, and teacher evaluations completely intact.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ACADEMIC STRUCTURE HIERARCHY                          │
└─────────────────────────────────────────────────────────────────────────────────┘
                                         │
                             [ sis.academic_years ]
                           (e.g., "2026–2027", Current)
                                         │
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
           [ sis.academic_terms ]                  [ sis.academic_terms ]
                (Term 1)                                (Term 2)
                     │
                     ▼
             [ sis.classes ]
             (Grade 8, Middle School, Branch: Main Campus)
                     │
                     ▼
            [ sis.sections ]
            (Section A, Room: 204, Capacity: 35)
            Class Teacher: Staff UUID (Ms. Sharma)
                     │
                     ▼
       [ sis.student_enrollments ]
       (Temporal Ledger: Student UUID + Section UUID + Roll #)
```

---

## 2. Enrollment Integrity & Temporal Consistency Rules

To prevent data corruption during promotions, transfers, and withdrawals, the database enforces four strict temporal invariants:

### Invariant 1: Single Active Enrollment per Academic Year
A student can have at most **one** active enrollment across all branches in a given academic year. A student cannot be actively enrolled in Section A and Section B simultaneously:
```sql
CREATE UNIQUE INDEX uq_student_single_active_enrollment 
  ON sis.student_enrollments (tenant_id, student_id, academic_year_id) 
  WHERE status = 'active';
```

### Invariant 2: Non-Overlapping Enrollment Dates
When a student transfers sections or branches mid-year, the previous enrollment must have an explicit exit date (`exited_at`), and the new enrollment commences on or after that date:
```sql
CONSTRAINT chk_enrollment_dates CHECK (exited_at IS NULL OR exited_at >= enrolled_at)
```

### Invariant 3: Unique Roll Numbers within Section & Academic Year
Roll numbers identify students on daily attendance registers and physical examination rosters. Within a specific section and academic year, roll numbers must be distinct for all active students:
```sql
CREATE UNIQUE INDEX uq_section_roll_number 
  ON sis.student_enrollments (section_id, academic_year_id, roll_number) 
  WHERE roll_number IS NOT NULL AND status = 'active';
```

### Invariant 4: Capacity Limit Enforcement
Classroom sections specify `max_capacity` (e.g. 35 students). Every enrollment, section transfer, and batch promotion executes a capacity check within a transaction. If adding the student would exceed `max_capacity`, the operation aborts with `409 SECTION_CAPACITY_EXCEEDED`.

---

## 3. Academic Structure Entities (Schema: `sis`)

### 3.1 `sis.academic_years`
Defines the institutional calendar cycle for a school tenant.
- Fields: `id`, `tenant_id`, `name` (e.g. `"2026–2027"`), `code` (`"AY26"`), `start_date`, `end_date`, `is_current`, `status` (`'upcoming'`, `'active'`, `'completed'`, `'archived'`).
- Invariant: Exactly one academic year can have `is_current = true` per tenant:
  ```sql
  CREATE UNIQUE INDEX uq_tenant_current_ay ON sis.academic_years (tenant_id) WHERE is_current = true;
  ```

### 3.2 `sis.academic_terms`
Subdivisions (semesters, trimesters) for grading and fee installment schedules.
- Fields: `id`, `tenant_id`, `academic_year_id`, `name` (e.g. `"Semester 1"`), `term_number`, `start_date`, `end_date`.

### 3.3 `sis.classes` (Grade Standards)
Defines the grade level standard offered at a specific campus branch.
- Fields: `id`, `tenant_id`, `branch_id`, `name` (`"Grade 6"`), `code` (`"G06"`), `stage` (`'early_years'`, `'primary'`, `'middle'`, `'secondary'`, `'senior_secondary'`), `sequence_order` (rank order).
- Invariant: Class codes must be unique per branch: `UNIQUE (branch_id, code)`.

### 3.4 `sis.sections` (Cohort Classrooms)
The physical cohort grouping of students within a grade standard.
- Fields: `id`, `tenant_id`, `branch_id`, `class_id`, `name` (`"A"`), `room_number`, `max_capacity` (default: 40), `class_teacher_id` (FK `public.users(id)`).
- Invariant: Section names must be unique within a class: `UNIQUE (class_id, name)`.

### 3.5 `sis.student_enrollments` (The Master Ledger)
- Fields: `id`, `tenant_id`, `branch_id`, `academic_year_id`, `class_id`, `section_id`, `student_id`, `roll_number`, `status` (`'active'`, `'promoted'`, `'retained'`, `'transferred'`, `'withdrawn'`), `enrolled_at`, `exited_at`.

---

## 4. Student Progression & Mobility Workflows

### 4.1 Intra-Grade Section Transfer Workflow
When a student moves between sections (e.g. from 8-A to 8-B):
1. **Validation:** Check target section has available capacity (`current_active_count < max_capacity`).
2. **Transaction Execution:**
   - Update existing enrollment: `status = 'transferred'`, `exited_at = CURRENT_DATE`.
   - Insert new enrollment: `section_id = 8-B`, `status = 'active'`, `enrolled_at = CURRENT_DATE`.
   - Insert audit record into `sis.section_transfers`: records `from_section_id`, `to_section_id`, `reason`, `approved_by`.

### 4.2 Annual Batch Promotion Engine (Cohort Advancement)
At academic year closure, entire grade cohorts are evaluated for advancement:
1. **Pre-Flight Validation:** Target academic year must be active; target class sections must have sufficient collective capacity.
2. **Atomic Execution:**
   - Mark current academic year enrollments as `'promoted'` (or `'retained'` for academic repeats).
   - Create new enrollment records in the target academic year with initial roll numbers.
   - Preserves all historical records in the prior academic year without mutation.

### 4.3 Student Withdrawal & Transfer Certificate (TC) Issuance
When a student departs the institution:
1. **Clearance Gate:** Clear-dues approvals required from Library, Laboratory, and Accounts.
2. **Exit Execution:**
   - Current enrollment marked `status = 'withdrawn'`, `exited_at = CURRENT_DATE`.
   - Student profile in `sis.students` marked `status = 'withdrawn'` or `'transferred'`.
   - Generates serial-numbered Transfer Certificate record in `sis.student_withdrawals`.

---

## 5. PostgreSQL DDL Blueprint (Schema: `sis`)

```sql
-- 1. Academic Years Table
CREATE TABLE IF NOT EXISTS sis.academic_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  status VARCHAR(20) NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_ay_dates CHECK (end_date > start_date),
  CONSTRAINT chk_ay_status CHECK (status IN ('upcoming', 'active', 'completed', 'archived')),
  CONSTRAINT uq_tenant_ay_code UNIQUE (tenant_id, code),
  CONSTRAINT uq_ay_tenant_composite UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_current_ay 
  ON sis.academic_years (tenant_id) WHERE is_current = true;

-- 2. Academic Terms Table
CREATE TABLE IF NOT EXISTS sis.academic_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  term_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  CONSTRAINT chk_term_dates CHECK (end_date > start_date),
  CONSTRAINT uq_ay_term_number UNIQUE (academic_year_id, term_number)
);

-- 3. Classes (Grades) Table
CREATE TABLE IF NOT EXISTS sis.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  name VARCHAR(50) NOT NULL,
  code VARCHAR(20) NOT NULL,
  stage VARCHAR(30) NOT NULL,
  sequence_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_class_stage CHECK (stage IN ('early_years', 'primary', 'middle', 'secondary', 'senior_secondary')),
  CONSTRAINT uq_branch_class_code UNIQUE (branch_id, code),
  CONSTRAINT uq_class_tenant_composite UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sis_classes_branch ON sis.classes(branch_id, sequence_order);

-- 4. Sections Table
CREATE TABLE IF NOT EXISTS sis.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  name VARCHAR(20) NOT NULL,
  room_number VARCHAR(50),
  max_capacity INTEGER NOT NULL DEFAULT 40,
  class_teacher_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_section_capacity CHECK (max_capacity > 0),
  CONSTRAINT uq_class_section_name UNIQUE (class_id, name),
  CONSTRAINT uq_section_tenant_composite UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sis_sections_class ON sis.sections(class_id);
CREATE INDEX IF NOT EXISTS idx_sis_sections_teacher ON sis.sections(class_teacher_id);

-- 5. Student Enrollments Ledger Table
CREATE TABLE IF NOT EXISTS sis.student_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  class_id UUID NOT NULL REFERENCES sis.classes(id) ON DELETE RESTRICT,
  section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE RESTRICT,
  roll_number INTEGER,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
  exited_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_enrollment_status CHECK (status IN ('active', 'promoted', 'retained', 'transferred', 'withdrawn')),
  CONSTRAINT chk_enrollment_dates CHECK (exited_at IS NULL OR exited_at >= enrolled_at)
);

-- Invariant 1: Exactly one active enrollment per student per academic year
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_active_ay_enrollment 
  ON sis.student_enrollments (tenant_id, student_id, academic_year_id) 
  WHERE status = 'active';

-- Invariant 3: Unique roll number in section per academic year
CREATE UNIQUE INDEX IF NOT EXISTS uq_section_roll_number 
  ON sis.student_enrollments (section_id, academic_year_id, roll_number) 
  WHERE roll_number IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_sis_enrollments_section ON sis.student_enrollments(section_id, status);
CREATE INDEX IF NOT EXISTS idx_sis_enrollments_student ON sis.student_enrollments(student_id);

-- 6. Section Transfers Audit Log Table
CREATE TABLE IF NOT EXISTS sis.section_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  academic_year_id UUID NOT NULL REFERENCES sis.academic_years(id) ON DELETE RESTRICT,
  from_section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE RESTRICT,
  to_section_id UUID NOT NULL REFERENCES sis.sections(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  approved_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Student Withdrawals & Transfer Certificate (TC) Table
CREATE TABLE IF NOT EXISTS sis.student_withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE RESTRICT,
  tc_serial_number VARCHAR(100) NOT NULL,
  exit_reason VARCHAR(50) NOT NULL,
  exit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  clearance_verified_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  tc_document_url VARCHAR(500),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_tenant_tc_serial UNIQUE (tenant_id, tc_serial_number)
);
```
