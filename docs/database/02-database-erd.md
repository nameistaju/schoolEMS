# Document 02: Entity-Relationship (ER) Diagrams

**Document Status:** TECHNICAL SPECIFICATION — APPROVED BASELINE  
**Classification:** Database Architecture & Visual Domain Models  
**Database Topology:** Single Database `auth_db` | Cross-Schema `public` & `sis`  
**Date:** March 2026  
**Author:** Principal Enterprise Data Modeler & Visual Systems Architect  

---

## 1. High-Level System ERD: Cross-Schema Boundary

The following diagram illustrates how the Phase 1 Identity foundation in schema `public` relates to the Phase 2 Student Information System in schema `sis`:

```mermaid
erDiagram
    TENANTS ||--o{ BRANCHES : "contains campuses"
    TENANTS ||--o{ USERS : "has identity records"
    TENANTS ||--o{ ACADEMIC_YEARS : "schedules cycles"
    BRANCHES ||--o{ CLASSES : "organizes grade levels"
    CLASSES ||--o{ SECTIONS : "contains classrooms"
    BRANCHES ||--o{ STUDENTS : "admits pupils"
    STUDENTS ||--o{ STUDENT_ENROLLMENTS : "enrolled in"
    SECTIONS ||--o{ STUDENT_ENROLLMENTS : "rostered into"
    ACADEMIC_YEARS ||--o{ STUDENT_ENROLLMENTS : "valid for"
    STUDENTS ||--o{ STUDENT_GUARDIANS : "cared by"
    GUARDIANS ||--o{ STUDENT_GUARDIANS : "cares for"
    SECTIONS ||--o{ ATTENDANCE_SESSIONS : "conducts roll-call"
    ATTENDANCE_SESSIONS ||--o{ STUDENT_ATTENDANCE : "records presence"
    CLASSES ||--o{ FEE_STRUCTURES : "priced at"
    STUDENTS ||--o{ STUDENT_FEE_ALLOCATIONS : "invoiced with"
    STUDENT_FEE_ALLOCATIONS ||--o{ FEE_PAYMENTS : "credited by"

    TENANTS {
        uuid id PK
        string name
        string slug
    }
    BRANCHES {
        uuid id PK
        uuid tenant_id FK
        string name
    }
    USERS {
        uuid id PK
        string email
        string full_name
    }
    STUDENTS {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        string admission_number
        string first_name
        string last_name
    }
    GUARDIANS {
        uuid id PK
        uuid tenant_id FK
        string first_name
        string last_name
        string phone
    }
    CLASSES {
        uuid id PK
        uuid branch_id FK
        string name
    }
    SECTIONS {
        uuid id PK
        uuid class_id FK
        string name
    }
    ACADEMIC_YEARS {
        uuid id PK
        uuid tenant_id FK
        string code
        boolean is_current
    }
    STUDENT_ENROLLMENTS {
        uuid id PK
        uuid student_id FK
        uuid section_id FK
        uuid academic_year_id FK
        string status
    }
    ATTENDANCE_SESSIONS {
        uuid id PK
        uuid section_id FK
        date session_date
    }
    STUDENT_ATTENDANCE {
        uuid id PK
        uuid attendance_session_id FK
        uuid student_id FK
        string status
    }
    FEE_STRUCTURES {
        uuid id PK
        uuid class_id FK
        numeric amount
    }
    STUDENT_FEE_ALLOCATIONS {
        uuid id PK
        uuid student_id FK
        numeric allocated_amount
        numeric paid_amount
    }
    FEE_PAYMENTS {
        uuid id PK
        uuid student_fee_allocation_id FK
        numeric amount_paid
        string receipt_number
    }
```

---

## 2. Identity, Multi-Tenancy & RBAC ERD (Schema `public`)

Covers Phase 1 authentication, user accounts, tenant domains, roles, permissions, session tokens, and audit trails:

```mermaid
erDiagram
    TENANTS ||--o{ BRANCHES : "has branches"
    TENANTS ||--o{ TENANT_DOMAINS : "mapped to"
    TENANTS ||--o{ USER_TENANT_MEMBERSHIPS : "employs or enrolls"
    USERS ||--o{ USER_TENANT_MEMBERSHIPS : "holds membership in"
    USER_TENANT_MEMBERSHIPS ||--o{ MEMBERSHIP_ROLES : "assigned"
    ROLES ||--o{ MEMBERSHIP_ROLES : "conferred upon"
    ROLES ||--o{ ROLE_PERMISSIONS : "contains"
    PERMISSIONS ||--o{ ROLE_PERMISSIONS : "granted to"
    USERS ||--o{ REFRESH_TOKENS : "maintains sessions"
    TENANTS ||--o{ AUDIT_LOGS : "logs events"
    USERS ||--o{ AUDIT_LOGS : "acts in"
    PLATFORM_ADMINS ||--o{ AUDIT_LOGS : "audited"

    TENANTS {
        uuid id PK
        string name
        string slug
        string status
        timestamptz created_at
    }
    BRANCHES {
        uuid id PK
        uuid tenant_id FK
        string name
        string code
        boolean is_main
    }
    TENANT_DOMAINS {
        uuid id PK
        uuid tenant_id FK
        string domain
        boolean is_primary
    }
    USERS {
        uuid id PK
        string email
        string password_hash
        string full_name
        boolean is_active
    }
    USER_TENANT_MEMBERSHIPS {
        uuid id PK
        uuid user_id FK
        uuid tenant_id FK
        uuid default_branch_id FK
        string status
    }
    ROLES {
        uuid id PK
        uuid tenant_id FK
        string name
        boolean is_system
    }
    PERMISSIONS {
        uuid id PK
        string code
        string module
        string description
    }
    ROLE_PERMISSIONS {
        uuid role_id PK,FK
        uuid permission_id PK,FK
    }
    MEMBERSHIP_ROLES {
        uuid membership_id PK,FK
        uuid role_id PK,FK
    }
    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        string token_hash
        string family_id
        boolean is_revoked
        timestamptz expires_at
    }
    AUDIT_LOGS {
        uuid id PK
        uuid tenant_id FK
        uuid actor_id FK
        string action
        string target_resource
        jsonb metadata
    }
    PLATFORM_ADMINS {
        uuid id PK
        uuid user_id FK
        string superadmin_role
    }
```

---

## 3. Student Profiles, Sensitive Records & Admissions ERD

Models student demographics, salted national ID hash, student photos (OD-05), segregated health and safeguarding records, and the prospective admissions pipeline:

```mermaid
erDiagram
    TENANTS ||--o{ STUDENTS : "admits"
    BRANCHES ||--o{ STUDENTS : "campus pupil"
    STUDENTS ||--o| STUDENT_PHOTOS : "profile portrait (OD-05)"
    STUDENTS ||--o{ STUDENT_DOCUMENTS : "uploaded proofs"
    STUDENTS ||--o| STUDENT_HEALTH_RECORDS : "segregated medical file"
    STUDENTS ||--o| STUDENT_SAFEGUARDING_RECORDS : "segregated protection file"
    BRANCHES ||--o{ ADMISSION_APPLICATIONS : "receives applications"
    CLASSES ||--o{ ADMISSION_APPLICATIONS : "target class"
    ADMISSION_APPLICATIONS ||--o{ STUDENT_DOCUMENTS : "submitted documents"
    BRANCHES ||--o{ ADMISSION_NUMBER_SEQUENCES : "increments counter"

    STUDENTS {
        uuid id PK
        uuid tenant_id FK
        uuid branch_id FK
        string admission_number UK
        date admission_date
        string first_name
        string last_name
        date date_of_birth
        string gender
        string status
        string national_id_hash
        string national_id_masked
        string emergency_contact_phone
    }
    STUDENT_PHOTOS {
        uuid id PK
        uuid student_id FK
        string file_name
        string stored_file_path
        string mime_type
        integer file_size_bytes
        string sha256_checksum
        boolean is_active
    }
    STUDENT_DOCUMENTS {
        uuid id PK
        uuid student_id FK
        uuid application_id FK
        string document_type
        string stored_file_path
        integer file_size_bytes
        string sha256_checksum
    }
    STUDENT_HEALTH_RECORDS {
        uuid id PK
        uuid student_id FK,UK
        boolean has_critical_allergy
        text allergies_summary
        text medical_conditions
        text emergency_protocol
    }
    STUDENT_SAFEGUARDING_RECORDS {
        uuid id PK
        uuid student_id FK,UK
        string protection_tier
        boolean custody_alert_flag
        text confidential_notes
        uuid designated_safeguarding_lead_id FK
    }
    ADMISSION_APPLICATIONS {
        uuid id PK
        uuid branch_id FK
        uuid target_class_id FK
        string application_number UK
        string first_name
        string last_name
        string guardian_phone
        string status
    }
    ADMISSION_NUMBER_SEQUENCES {
        uuid id PK
        uuid branch_id FK
        uuid academic_year_id FK
        string prefix
        integer last_number
    }
```

---

## 4. Guardian Network, Kinship & Consents ERD

Models parent/guardian identities, M:N kinship mappings, legal custody, and DPDP digital consents:

```mermaid
erDiagram
    TENANTS ||--o{ GUARDIANS : "family network"
    USERS ||--o| GUARDIANS : "portal user account"
    STUDENTS ||--o{ STUDENT_GUARDIANS : "parental relations"
    GUARDIANS ||--o{ STUDENT_GUARDIANS : "linked pupils"
    STUDENT_GUARDIANS ||--o{ GUARDIAN_CONSENTS : "grants permissions"

    GUARDIANS {
        uuid id PK
        uuid tenant_id FK
        uuid user_id FK
        string first_name
        string last_name
        string email UK
        string phone
        string relationship
    }
    STUDENT_GUARDIANS {
        uuid id PK
        uuid student_id FK
        uuid guardian_id FK
        boolean is_primary
        boolean has_legal_custody
        boolean can_pickup
        boolean receives_fee_invoices
        integer emergency_priority
    }
    GUARDIAN_CONSENTS {
        uuid id PK
        uuid student_guardian_id FK
        string consent_type
        boolean is_granted
        timestamptz granted_at
        string ip_address
    }
```

---

## 5. Academic Structure & Student Enrolment ERD

Models academic years, terms, grade classes, classroom sections, subject catalog, and student cohort enrollments:

```mermaid
erDiagram
    TENANTS ||--o{ ACADEMIC_YEARS : "schedules"
    ACADEMIC_YEARS ||--o{ ACADEMIC_TERMS : "subdivided into"
    BRANCHES ||--o{ CLASSES : "defines grades"
    CLASSES ||--o{ SECTIONS : "subdivided into sections"
    USERS ||--o{ SECTIONS : "class teacher"
    BRANCHES ||--o{ SUBJECTS : "curriculum catalog"
    SECTIONS ||--o{ SECTION_SUBJECT_TEACHERS : "teaches subject"
    SUBJECTS ||--o{ SECTION_SUBJECT_TEACHERS : "taught in"
    USERS ||--o{ SECTION_SUBJECT_TEACHERS : "assigned instructor"
    STUDENTS ||--o{ STUDENT_ENROLLMENTS : "cohort placement"
    SECTIONS ||--o{ STUDENT_ENROLLMENTS : "rostered in"
    ACADEMIC_YEARS ||--o{ STUDENT_ENROLLMENTS : "active during"

    ACADEMIC_YEARS {
        uuid id PK
        uuid tenant_id FK
        string name
        string code UK
        date start_date
        date end_date
        boolean is_current
        boolean is_locked
    }
    ACADEMIC_TERMS {
        uuid id PK
        uuid academic_year_id FK
        string name
        string term_code
        date start_date
        date end_date
    }
    CLASSES {
        uuid id PK
        uuid branch_id FK
        string name
        string stage
        integer sequence_order
    }
    SECTIONS {
        uuid id PK
        uuid class_id FK
        string name
        integer max_capacity
        string room_number
        uuid class_teacher_id FK
    }
    SUBJECTS {
        uuid id PK
        uuid branch_id FK
        string name
        string code UK
        boolean is_elective
    }
    SECTION_SUBJECT_TEACHERS {
        uuid id PK
        uuid section_id FK
        uuid subject_id FK
        uuid teacher_id FK
        uuid academic_year_id FK
        integer periods_per_week
    }
    STUDENT_ENROLLMENTS {
        uuid id PK
        uuid student_id FK
        uuid academic_year_id FK
        uuid class_id FK
        uuid section_id FK
        integer roll_number
        string status
        date enrollment_date
    }
```

---

## 6. Daily Attendance Engine ERD (OD-02)

Models daily section roll-call sessions, individual presence marks, and modification audit logs:

```mermaid
erDiagram
    SECTIONS ||--o{ ATTENDANCE_SESSIONS : "conducts roll-call"
    USERS ||--o{ ATTENDANCE_SESSIONS : "taken by teacher"
    ATTENDANCE_SESSIONS ||--o{ STUDENT_ATTENDANCE : "contains marks"
    STUDENTS ||--o{ STUDENT_ATTENDANCE : "recorded pupil"
    STUDENT_ATTENDANCE ||--o{ ATTENDANCE_AUDIT_LOGS : "audited changes"
    USERS ||--o{ ATTENDANCE_AUDIT_LOGS : "modified by"

    ATTENDANCE_SESSIONS {
        uuid id PK
        uuid branch_id FK
        uuid section_id FK
        date session_date
        string session_type
        uuid taken_by FK
        boolean is_locked
        integer total_present
        integer total_absent
        integer total_late
    }
    STUDENT_ATTENDANCE {
        uuid id PK
        uuid attendance_session_id FK
        uuid student_id FK
        string status
        time arrival_time
        string remarks
    }
    ATTENDANCE_AUDIT_LOGS {
        uuid id PK
        uuid student_attendance_id FK
        string previous_status
        string new_status
        text reason
        uuid modified_by FK
        timestamptz created_at
    }
```

---

## 7. Academic Calendar & Student Bulk Import ERD

Models institutional event schedules and staged batch student ingestion:

```mermaid
erDiagram
    ACADEMIC_YEARS ||--o{ ACADEMIC_CALENDAR_EVENTS : "schedules events"
    BRANCHES ||--o{ ACADEMIC_CALENDAR_EVENTS : "campus holidays"
    BRANCHES ||--o{ STUDENT_IMPORT_JOBS : "executes batch import"
    ACADEMIC_YEARS ||--o{ STUDENT_IMPORT_JOBS : "target year"
    STUDENT_IMPORT_JOBS ||--o{ STUDENT_IMPORT_ROWS : "stages rows"
    STUDENTS ||--o| STUDENT_IMPORT_ROWS : "created student"

    ACADEMIC_CALENDAR_EVENTS {
        uuid id PK
        uuid academic_year_id FK
        uuid branch_id FK
        string event_title
        string event_type
        date start_date
        date end_date
        boolean is_instructional_day
    }
    STUDENT_IMPORT_JOBS {
        uuid id PK
        uuid branch_id FK
        uuid academic_year_id FK
        string file_name
        integer total_rows
        integer successful_rows
        integer failed_rows
        string status
    }
    STUDENT_IMPORT_ROWS {
        uuid id PK
        uuid import_job_id FK
        integer row_number
        jsonb raw_data
        string status
        jsonb validation_errors
        uuid imported_student_id FK
    }
```

---

## 8. Academic Rollover & Promotion Review ERD (OD-01)

Models year-end cohort progression, promotion review wizard logs, and historical student actions:

```mermaid
erDiagram
    BRANCHES ||--o{ ACADEMIC_ROLLOVER_LOGS : "campus rollover"
    ACADEMIC_YEARS ||--o{ ACADEMIC_ROLLOVER_LOGS : "from academic year"
    ACADEMIC_YEARS ||--o{ ACADEMIC_ROLLOVER_LOGS : "to academic year"
    ACADEMIC_ROLLOVER_LOGS ||--o{ ACADEMIC_ROLLOVER_ITEMS : "records promotion items"
    STUDENTS ||--o{ ACADEMIC_ROLLOVER_ITEMS : "evaluated student"
    SECTIONS ||--o{ ACADEMIC_ROLLOVER_ITEMS : "from section"
    SECTIONS ||--o{ ACADEMIC_ROLLOVER_ITEMS : "to section"

    ACADEMIC_ROLLOVER_LOGS {
        uuid id PK
        uuid branch_id FK
        uuid from_academic_year_id FK
        uuid to_academic_year_id FK
        integer total_candidates
        integer promoted_count
        integer retained_count
        integer graduated_count
        string status
        uuid executed_by FK
    }
    ACADEMIC_ROLLOVER_ITEMS {
        uuid id PK
        uuid rollover_log_id FK
        uuid student_id FK
        uuid from_section_id FK
        uuid to_section_id FK
        string action
        integer previous_roll_number
        integer new_roll_number
    }
```

---

## 9. Timetable & Homework / Assignments ERD

Models bell schedule periods, weekly classroom timetables, teacher conflict prevention, and homework assignments:

```mermaid
erDiagram
    BRANCHES ||--o{ TIMETABLE_PERIODS : "bell schedule"
    ACADEMIC_YEARS ||--o{ TIMETABLE_SLOTS : "timetable cycle"
    SECTIONS ||--o{ TIMETABLE_SLOTS : "section schedule"
    TIMETABLE_PERIODS ||--o{ TIMETABLE_SLOTS : "period time"
    SUBJECTS ||--o{ TIMETABLE_SLOTS : "scheduled subject"
    USERS ||--o{ TIMETABLE_SLOTS : "assigned teacher"
    SECTIONS ||--o{ ASSIGNMENTS : "class coursework"
    SUBJECTS ||--o{ ASSIGNMENTS : "subject task"
    USERS ||--o{ ASSIGNMENTS : "assigned by"
    ASSIGNMENTS ||--o{ ASSIGNMENT_COMPLETIONS : "student submissions"
    STUDENTS ||--o{ ASSIGNMENT_COMPLETIONS : "completed by"

    TIMETABLE_PERIODS {
        uuid id PK
        uuid branch_id FK
        string name
        integer period_order
        time start_time
        time end_time
        boolean is_break
    }
    TIMETABLE_SLOTS {
        uuid id PK
        uuid academic_year_id FK
        uuid section_id FK
        uuid period_id FK
        integer day_of_week
        uuid subject_id FK
        uuid teacher_id FK
        string room_number
    }
    ASSIGNMENTS {
        uuid id PK
        uuid section_id FK
        uuid subject_id FK
        uuid teacher_id FK
        string title
        date assigned_date
        date due_date
        numeric max_marks
    }
    ASSIGNMENT_COMPLETIONS {
        uuid id PK
        uuid assignment_id FK
        uuid student_id FK
        string status
        text submission_text
        numeric marks_awarded
        timestamptz submitted_at
    }
```

---

## 10. Fees, Receipts, Concessions & Staff Leave ERD (OD-04)

Models fee structure schedules, student debits, cashier payment ledger, receipt sequences, Principal concessions (OD-04), and staff leave workflow:

```mermaid
erDiagram
    TENANTS ||--o{ FEE_CATEGORIES : "ledger categories"
    CLASSES ||--o{ FEE_STRUCTURES : "grade pricing"
    FEE_CATEGORIES ||--o{ FEE_STRUCTURES : "category"
    FEE_STRUCTURES ||--o{ STUDENT_FEE_ALLOCATIONS : "invoiced from"
    STUDENTS ||--o{ STUDENT_FEE_ALLOCATIONS : "debit ledger"
    STUDENT_FEE_ALLOCATIONS ||--o{ FEE_PAYMENTS : "payment credit"
    BRANCHES ||--o{ FEE_RECEIPT_SEQUENCES : "increments receipts"
    TENANTS ||--o{ FEE_CONCESSION_CATEGORIES : "authorized waivers (OD-04)"
    STUDENT_FEE_ALLOCATIONS ||--o{ FEE_CONCESSIONS : "concession applied"
    FEE_CONCESSION_CATEGORIES ||--o{ FEE_CONCESSIONS : "category"
    USERS ||--o{ FEE_CONCESSIONS : "approved by principal"
    BRANCHES ||--o{ STAFF_LEAVE_REQUESTS : "campus leave"
    USERS ||--o{ STAFF_LEAVE_REQUESTS : "applicant staff"
    STAFF_LEAVE_REQUESTS ||--o{ STAFF_LEAVE_AUDITS : "approval lifecycle"

    FEE_CATEGORIES {
        uuid id PK
        string name
        string code UK
    }
    FEE_STRUCTURES {
        uuid id PK
        uuid branch_id FK
        uuid class_id FK
        uuid fee_category_id FK
        numeric amount
        date due_date
    }
    STUDENT_FEE_ALLOCATIONS {
        uuid id PK
        uuid student_id FK
        uuid fee_structure_id FK
        numeric allocated_amount
        numeric concession_amount
        numeric paid_amount
        string status
    }
    FEE_PAYMENTS {
        uuid id PK
        uuid student_fee_allocation_id FK
        string receipt_number UK
        numeric amount_paid
        string payment_method
        date payment_date
        uuid received_by FK
    }
    FEE_RECEIPT_SEQUENCES {
        uuid id PK
        uuid branch_id FK
        uuid academic_year_id FK
        string prefix
        integer last_receipt_number
    }
    FEE_CONCESSION_CATEGORIES {
        uuid id PK
        string name
        string code UK
        string concession_type
        numeric default_value
        boolean requires_principal_approval
    }
    FEE_CONCESSIONS {
        uuid id PK
        uuid student_fee_allocation_id FK
        uuid concession_category_id FK
        numeric concession_amount
        string status
        uuid approved_by FK
    }
    STAFF_LEAVE_REQUESTS {
        uuid id PK
        uuid branch_id FK
        uuid staff_id FK
        string leave_type
        date start_date
        date end_date
        numeric total_days
        string status
        uuid decided_by FK
    }
    STAFF_LEAVE_AUDITS {
        uuid id PK
        uuid leave_request_id FK
        string action
        uuid performed_by FK
        timestamptz created_at
    }
```
