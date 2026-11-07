# Document 02: Education Domain Technical Research

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Domain Modeling, Education Systems & Standards Comparison  
**Primary Reference Standard:** Ed-Fi Data Standard v4 (Ed-Fi Alliance)  
**Date:** March 2026  
**Author:** Principal Education Domain Analyst & Enterprise Data Modeler  

---

## 1. Domain Overview & Enterprise Terminology

Educational institutions operate on deeply interconnected, time-bounded relational structures. Unlike generic business ERPs where transactions are linear and continuous, school operations are cyclical (governed by academic years and terms) and heavily structured around cohort grouping, pedagogical supervision, and parental legal custody.

This research analyzes the core concepts of the education domain, compares them with established industry standards (principally the **Ed-Fi Data Standard v4**), and outlines their concrete implications for the SchoolEMS Stage 1 MVP.

---

## 2. Analysis of Core Educational Domain Areas

### 2.1 Tenants, Schools & Campus Branches
- **Domain Concept:** Educational governance typically involves a governing trust or corporate entity (the Tenant) that operates one or more physical campuses (Branches or Schools). For example, "Apex Educational Trust" may operate an "Apex Academy — City Campus" and an "Apex Academy — Valley Campus".
- **Ed-Fi Standard Alignment:** Ed-Fi models this using `EducationOrganization`, specifically subclassing into `LocalEducationAgency` (the school district/tenant) and `School` (the individual campus).
- **Relational Implication:** 
  - Tenant (`public.tenants`) represents the top-level boundary for licensing, user identity, and master catalog definitions.
  - Branch (`public.branches`) represents the physical facility where classrooms exist, attendance is marked, and local administration occurs.
  - Multi-campus schools require cross-branch visibility for executive administrators (School Admin), but strict branch confinement for campus leaders (Principals) and teaching staff.

### 2.2 Academic Years & Academic Terms
- **Domain Concept:** Schools operate on annual academic cycles (e.g., April 1, 2026 to March 31, 2027 in India, or September to June internationally). Years are subdivided into discrete instructional periods (Terms, Semesters, or Trimesters).
- **Ed-Fi Standard Alignment:** Modeled via `SchoolYearType` and `Session`/`GradingPeriod`.
- **Relational Implication:**
  - An academic year must possess a temporal boundary (`start_date`, `end_date`), a current active marker (`is_current`), and a post-rollover immutability lock (`is_locked`).
  - Exactly one academic year may be designated as `is_current` per tenant at any given point in time (enforced via partial unique index).
  - All enrollments, section assignments, fee allocations, and timetable schedules must bind to a specific `academic_year_id`.

### 2.3 Students, Demographics & Voluntary National ID
- **Domain Concept:** A student is an individual receiving instruction. Demographic records include name, birth date, gender, blood group, emergency contact phone, and residential address.
- **National Identifier Privacy:** In Indian schools, student admission often involves recording the Aadhaar number. However, storing raw 12-digit Aadhaar numbers in plaintext creates severe regulatory and privacy liabilities.
- **Relational Implication:**
  - Raw national identifiers must never be stored.
  - Use a per-tenant salted cryptographic hash (`national_id_hash VARCHAR(64)`) for duplicate detection during admissions.
  - Store a masked token for administrative verification and UI display (`national_id_masked VARCHAR(20)`, e.g., `●●●● ●●●● 8192`).

### 2.4 Guardians, Kinship Network & DPDP Parental Consents
- **Domain Concept:** Minor students cannot act independently in legal or administrative matters; they are represented by parents or lawful guardians. Families exhibit complex topological structures:
  - Sibling relationships: One parent represents multiple children across different classes.
  - Shared or divided custody: Multiple guardians represent one child with differing legal rights (e.g. Father has visitation; Mother has sole legal custody; Grandparent has pickup authorization).
- **Ed-Fi Standard Alignment:** Ed-Fi separates `Student` and `Parent` into distinct master entities, joining them through a rich association entity: `StudentParentAssociation`.
- **Relational Implication:**
  - A flat model (storing parent details directly on the student record) fails for siblings and divorced families.
  - SchoolEMS must utilize a normalized M:N relationship: `sis.guardians` linked to `sis.students` via `sis.student_guardians`.
  - The junction table must track granular permissions: `is_primary`, `has_legal_custody`, `can_pickup`, `receives_fee_invoices`, and `emergency_priority`.
  - Exactly one guardian per student can be designated as `is_primary = true` (enforced via partial unique index).
  - Digital parental consents under Section 9 of the DPDP Act 2023 must be explicitly tracked in `sis.guardian_consents`.

### 2.5 Admissions Pipeline vs. Confirmed Cohort Enrollment
- **Domain Concept:** Prospective applicant processing is fundamentally distinct from active classroom instruction:
  - An applicant is an inquiry undergoing review, document verification, and interview.
  - An enrolled student is a registered pupil assigned an official admission number, class section, roll number, and fee schedule.
- **Relational Implication:**
  - Segregating `sis.admission_applications` from `sis.students` prevents the active student register from becoming polluted with rejected or abandoned inquiries.
  - Converting an approved application to an active student requires an atomic ACID database transaction: incrementing the sequential admission counter, creating the student record, creating guardian links, and generating initial fee ledger debits.

### 2.6 Classes, Classroom Sections, Subjects & Teacher Allocations
- **Domain Concept:**
  - **Class (Grade Standard):** The broad academic standard or grade level (e.g. "Grade 10").
  - **Section:** The physical cohort group of students who learn together in a specific homeroom (e.g. "Grade 10-A").
  - **Subject:** A curriculum course offering (e.g. "Mathematics").
  - **Faculty Allocation:** The assignment of an instructor to teach a specific subject to a section for an academic year (e.g. Mr. Sharma teaches Mathematics to Section 10-A).
- **Ed-Fi Standard Alignment:** Ed-Fi distinguishes `Course` (curriculum definition), `CourseOffering` (campus offering), `Section` (scheduled meeting group), and `StaffSectionAssociation`.
- **Relational Implication:**
  - Sections must enforce physical maximum seating capacities (`max_capacity`) to prevent classroom overcrowding.
  - Teacher allocations must be tracked in `sis.section_subject_teachers` to govern timetable generation, homework creation rights, and daily attendance roll-call permissions.

### 2.7 Daily Attendance Engine: Sessions, Roll-Call & Audit Trails (OD-02)
- **Domain Concept:** Attendance verifies the physical presence and safety of minors under institutional custody. Attendance tracking occurs daily or period-by-period.
- **Ed-Fi Standard Alignment:** Ed-Fi strictly separates the administrative act of taking attendance (`SectionAttendanceTakenEvent`) from individual student outcomes (`StudentSectionAttendanceEvent`). It emphasizes event-based affirmative logging over implicit assumptions.
- **Relational Implication:**
  - SchoolEMS adopts the Ed-Fi header-detail pattern:
    - `sis.attendance_sessions`: Captures that attendance was taken for a section on a date by an authenticated teacher, tracking summary totals and lock status.
    - `sis.student_attendance`: Records individual status (`present`, `absent`, `late`, `excused`, `half_day`).
  - **Offline Connection Resilience (OD-02):** In classroom environments with unreliable Wi-Fi, the client SPA must preserve roll-call marks in-memory during submission failures and synchronize once reconnected.
  - **Audit Immutability:** Any post-submission modification must record an immutable entry in `sis.attendance_audit_logs` capturing previous status, new status, modifier ID, and mandatory explanation.

### 2.8 Annual Academic Rollover & Controlled Promotion Wizard (OD-01)
- **Domain Concept:** At the end of an academic year, students transition to the subsequent academic year. While most students are promoted to the next grade standard, real schools have exceptions: retained students (repeating a grade), students transferring to other institutions, and graduating cohorts.
- **Relational Implication:**
  - Automated batch scripts that blindly increment grade levels cause operational chaos.
  - In accordance with **OD-01**, SchoolEMS mandates an interactive **Promotion Review Wizard** (`SCR-ADM-18`).
  - Roster promotions are executed inside a single top-level ACID transaction block, updating source enrollments to `promoted`/`retained` and creating new active enrollments in target sections while logging the complete audit trail in `sis.academic_rollover_logs` and `sis.academic_rollover_items`.

### 2.9 Bulk Ingestion Pipeline & Duplicate Prevention
- **Domain Concept:** Onboarding a new school requires ingesting hundreds or thousands of existing student demographic and enrollment records from legacy spreadsheets (CSV/XLSX).
- **Relational Implication:**
  - Direct import into production tables risks partial failure corruption.
  - A two-stage pipeline is required: raw files are uploaded to `sis.student_import_jobs`, parsed line-by-line into `sis.student_import_rows`, validated against schema rules and duplicate checks, and only committed to `sis.students` once 100% validated or explicitly confirmed by the School Admin.

### 2.10 Timetable Schedules & Teacher Conflict Prevention
- **Domain Concept:** The master timetable coordinates the utilization of teachers, rooms, and student sections across a weekly bell schedule.
- **Relational Implication:**
  - Timetable periods (`sis.timetable_periods`) define the branch bell schedule (e.g. Period 1: 08:30–09:15).
  - Timetable slots (`sis.timetable_slots`) bind a section, day of the week, period, subject, and teacher.
  - **Hard Relational Invariant:** A teacher cannot be scheduled to teach two different sections during the exact same period and day. This must be enforced by a database unique constraint: `UNIQUE (academic_year_id, teacher_id, day_of_week, period_id)`.

### 2.11 Fee Structures, Student Allocations, Collections & Receipts (OD-04)
- **Domain Concept:** Private school revenue depends on tuition, laboratory, computer, and facility fee schedules. Fee management requires double-entry accounting exactness:
  - **Fee Structure:** Institutional fee pricing defined per grade level and academic year.
  - **Student Fee Allocation:** Debit ledger entry assessing a student's financial obligation.
  - **Fee Payment:** Credit ledger entry recording cashier collection (cash, cheque, bank transfer, POS) issuing an official receipt.
  - **Fee Concession (OD-04):** Institutional tuition discount (e.g. sibling discount, staff ward, merit scholarship).
- **Relational Implication:**
  - All financial amounts must strictly use PostgreSQL `NUMERIC(12, 2)` (never floating point).
  - Currency is strictly `INR` (Indian Rupee, ₹).
  - Official receipt numbers must be strictly sequential per branch/year via an atomic counter (`sis.fee_receipt_sequences`).
  - Concessions must follow a controlled workflow: cashier requests an authorized category; Principal approves before the allocation balance is credited.
  - Historical cleared payments are immutable.

### 2.12 Basic Staff Leave Management
- **Domain Concept:** Teachers and administrative staff require structured leave management (casual, sick, earned, maternity) to ensure continuous classroom coverage and substitute teacher scheduling.
- **Relational Implication:**
  - Staff submit leave requests (`sis.staff_leave_requests`) specifying dates, reason, and optional substitute teacher.
  - Campus Principal reviews, assigns classroom coverage, and marks `approved` or `rejected` with audit records stored in `sis.staff_leave_audits`.

---

## 3. Comparison with External Standards (Ed-Fi Fit Analysis)

| Educational Domain Concept | Ed-Fi v4 Standard Equivalent | SchoolEMS Stage 1 Scope | Rationalization & MVP Boundary |
| :--- | :--- | :---: | :--- |
| **School Organization** | `EducationOrganization`, `School` | `public.tenants`, `public.branches` | **Adopted.** Clean 2-tier multi-campus hierarchy. |
| **Student Demographics** | `Student`, `StudentSchoolAssociation` | `sis.students`, `sis.student_enrollments` | **Adopted.** Separates person identity from yearly cohort enrollment. |
| **Parent/Guardian Kinship**| `Parent`, `StudentParentAssociation` | `sis.guardians`, `sis.student_guardians` | **Adopted.** M:N kinship model with legal custody and pickup flags. |
| **Attendance Events** | `SectionAttendanceTakenEvent`, `StudentSectionAttendanceEvent` | `sis.attendance_sessions`, `sis.student_attendance` | **Adopted.** Header-detail session model with offline resilience (OD-02). |
| **Curriculum & Section** | `Course`, `CourseOffering`, `Section` | `sis.subjects`, `sis.classes`, `sis.sections` | **Simplified.** Merged Course/CourseOffering into direct `subjects` catalog. |
| **Staff & Allocations** | `Staff`, `StaffSectionAssociation` | `public.users`, `sis.section_subject_teachers` | **Adopted.** Assigns teacher to subject/section. |
| **Special Education (IEP)**| `StudentSpecialEducationProgramAssociation` | *Excluded from Stage 1* | **Out of Scope.** High complexity; unnecessary for 1–2 pilot schools. |
| **State Longitudinal Data**| State Reporting Descriptors & CEDS | *Excluded from Stage 1* | **Out of Scope.** External US-specific reporting standards are not applicable to Indian pilot schools. |
| **Digital Content / SCORM**| `LearningStandard`, `LearningResource` | *Excluded from Stage 1* | **Out of Scope.** Stage 1 focuses on administrative operations, not LMS content authoring. |
