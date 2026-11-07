# Document 03: Architectural Decision Records (ADRs)

**Document Status:** TECHNICAL SPECIFICATION — APPROVED BASELINE  
**Classification:** Architectural Governance & Decision Records  
**Scope:** Core Systems, Database Topology, Security & Domain Workflows  
**Date:** March 2026  
**Author:** Principal Software Architect & Lead Systems Engineer  

---

## Index of Architectural Decision Records

| ADR ID | Decision Title | Decision Status | Category |
| :---: | :--- | :---: | :--- |
| **ADR-01** | Cohesive SIS Service vs. Distributed Microservices | **APPROVED** | Service Architecture |
| **ADR-02** | Single Database (`auth_db`) with Schema Partitioning | **APPROVED** | Database Architecture |
| **ADR-03** | Schema `public` Identity vs. Dedicated Schema `sis` | **APPROVED** | Schema Namespace |
| **ADR-04** | Dual-Tier Multi-Tenancy: Gateway Context & Kernel RLS | **APPROVED** | Security & Isolation |
| **ADR-05** | M:N Student-Guardian Kinship with Scoped Child Access | **APPROVED** | Domain Modeling |
| **ADR-06** | Entity Separation: Admission Applications vs. Students | **APPROVED** | Lifecycle Modeling |
| **ADR-07** | Controlled Promotion Review Wizard for Rollover (OD-01)| **APPROVED** | Educational Operations |
| **ADR-08** | Normalized Attendance Sessions & Offline Cache (OD-02) | **APPROVED** | Reliability & Audit |
| **ADR-09** | Two-Stage Staged Ingestion for Student Bulk Import | **APPROVED** | Data Pipeline |
| **ADR-10** | Double-Entry Fee Ledger & Principal Waivers (OD-04) | **APPROVED** | Financial Integrity |
| **ADR-11** | Self-Service Staff Leave with Principal Approval Flow | **APPROVED** | Operational Workflow |
| **ADR-12** | Local-First File Storage with DB Metadata (OD-05) | **APPROVED** | Storage Infrastructure |
| **ADR-13** | Append-Only Cryptographic & Transaction Audit Logs | **APPROVED** | Compliance & Audit |
| **ADR-14** | Selective Soft-Deletion vs. Immutable Historical Logs | **APPROVED** | Data Lifecycle |

---

## Detailed Architectural Decision Records

### ADR-01: Cohesive SIS Service vs. Distributed Microservices
- **Context:** The educational domain contains 33 functional modules across Admissions, Students, Attendance, Timetables, Homework, Fees, and Staff Leave. We needed to choose between decomposing into multiple fine-grained microservices (e.g. `admissions-service`, `attendance-service`, `fees-service`) versus building a single, cohesive `student-records-service`.
- **Options Considered:**
  1. *Fine-Grained Microservices:* 6 independent services, each with separate HTTP interfaces, repos, and connection pools.
  2. *Single Cohesive SIS Service:* One cohesive Node.js service (`student-records-service` on port `4002`) structured with clean modular domain boundaries.
- **Decision:** **Option 2: Single Cohesive SIS Service.**
- **Reasoning:** For an initial 1–2 school pilot, microservices introduce severe distributed complexity: distributed transactions (2PC/Sagas) for student admissions and rollover, multiple failure points, excessive local memory consumption, and port sprawl. A cohesive service provides ACID transactions across admissions and fees while maintaining modular internal folder boundaries.
- **Consequences:** Eliminates distributed failure modes. Future scaling can extract specific high-throughput domains if necessary.

---

### ADR-02: Single Database (`auth_db`) with Schema Partitioning
- **Context:** Deciding whether the SIS service should connect to a new physical database (`school_db`) or share the existing local PostgreSQL 18.6 instance `auth_db`.
- **Options Considered:**
  1. *Multiple Physical Databases:* `auth_db` for identity; `school_db` for SIS operations.
  2. *Single Database with Logical Schemas:* `auth_db` housing schema `public` (Phase 1) and schema `sis` (Phase 2).
- **Decision:** **Option 2: Single Database (`auth_db`) with Schema Partitioning.**
- **Reasoning:** Connecting to the same physical database enables direct PostgreSQL cross-schema foreign keys (`REFERENCES public.tenants(id)`, `REFERENCES public.users(id)`). This guarantees referential integrity without API synchronization overhead and permits atomic transactions across user memberships and student enrollments.
- **Consequences:** Local resource usage remains minimal. Cross-schema foreign keys are enforced by PostgreSQL.

---

### ADR-03: Schema `public` Identity vs. Dedicated Schema `sis`
- **Context:** Determining how Phase 2 tables are organized within `auth_db` without risking corruption of existing Phase 1 identity tables.
- **Options Considered:**
  1. *Flat Namespace in `public`:* Place all 30 new tables into `public`.
  2. *Dedicated `sis` Namespace:* Isolate all SIS tables into PostgreSQL schema `sis`.
- **Decision:** **Option 2: Dedicated `sis` Namespace.**
- **Reasoning:** Schema `sis` completely isolates educational tables from identity tables. Phase 1 migrations (01–07) remain completely untouched and tracked in `public.knex_migrations`. Phase 2 uses an independent migration pipeline tracked in `sis.knex_migrations_sis`.
- **Consequences:** Prevents namespace collisions, allows isolated schema-level permissions and backups, and cleanly organizes database objects.

---

### ADR-04: Dual-Tier Multi-Tenancy: Gateway Context & Kernel RLS
- **Context:** SchoolEMS is a multi-tenant SaaS. A tenant breach (School A seeing School B's students) is a catastrophic security failure.
- **Options Considered:**
  1. *Application-Only Filtering:* Adding `WHERE tenant_id = ?` to every Knex query.
  2. *Dual-Tier Isolation:* Gateway header sanitization + cryptographic JWT claim extraction + PostgreSQL kernel Row-Level Security (RLS) forced on all tables.
- **Decision:** **Option 2: Dual-Tier Isolation.**
- **Reasoning:** Application-only filtering is prone to human error (a missing `WHERE` clause leaks all records). Kernel RLS under unprivileged role `school_app_user` enforces data isolation at the database level. If `app.current_tenant_id` is missing or invalid, PostgreSQL returns 0 rows (fail-closed).
- **Consequences:** Eliminates single points of failure in tenancy enforcement. Slight query planning overhead (~0.2ms) is negligible for pilot scale.

---

### ADR-05: M:N Student-Guardian Kinship with Scoped Child Access
- **Context:** Real-world families have complex structures: siblings in different grades, shared custody, blended families, and distinct emergency contacts.
- **Options Considered:**
  1. *Embedded Guardian Columns:* Columns on `students` table (`father_name`, `mother_phone`).
  2. *Normalized M:N Kinship Model:* Independent `guardians` table linked via `student_guardians` junction table with granular custody, pickup, and billing flags.
- **Decision:** **Option 2: Normalized M:N Kinship Model.**
- **Reasoning:** Embedded columns cannot handle siblings without duplicating records, fail to handle divorced parents with legal custody disputes, and make parent portal logins difficult. The junction model enables a single guardian login to access all linked children cleanly via the child selector pill (OD-03).
- **Consequences:** Requires joins to retrieve guardian info; fully resolved by indexed foreign keys.

---

### ADR-06: Entity Separation: Admission Applications vs. Students
- **Context:** Determining whether prospective applicants and enrolled students should share the `students` table or use distinct entities.
- **Options Considered:**
  1. *Single Table with Status Flag:* `students` table with `status = 'applicant'`.
  2. *Distinct Entity Lifecycles:* `sis.admission_applications` for prospective triage; `sis.students` for enrolled institutional pupils.
- **Decision:** **Option 2: Distinct Entity Lifecycles.**
- **Reasoning:** Inquiries and rejected applications do not require roll numbers, fee allocations, attendance registers, or portal accounts. Segregation keeps the active student register clean and prevents applicant records from cluttering daily classroom rosters.
- **Consequences:** Transitioning an approved applicant to an enrolled student requires an atomic conversion transaction.

---

### ADR-07: Controlled Promotion Review Wizard for Rollover (OD-01)
- **Context:** At the end of an academic year, students must progress to the next grade standard.
- **Options Considered:**
  1. *Automated Batch Script:* Background job that automatically bumps all students up one grade.
  2. *Controlled Promotion Review Wizard (OD-01):* UI wizard allowing administrators to review every section roster, flag individual students for retention, set target sections, and execute the rollover atomically.
- **Decision:** **Option 2: Controlled Promotion Review Wizard (OD-01).**
- **Reasoning:** In real schools, promotions are never 100% uniform. Students fail exams, transfer schools, repeat grades, or are reassigned to different sections to balance class dynamics. An automated batch job causes messy manual corrections.
- **Consequences:** Requires administrative review UI (`SCR-ADM-18`); provides complete operational control and immutable execution logs in `sis.academic_rollover_logs`.

---

### ADR-08: Normalized Attendance Sessions & Offline Cache (OD-02)
- **Context:** Attendance must be marked daily in classroom environments where Wi-Fi or local connectivity may drop momentarily.
- **Options Considered:**
  1. *Flat Daily Attendance Table:* One row per student per day with loose section tagging.
  2. *Header-Detail Session Model with Client-Side Cache (OD-02):* `sis.attendance_sessions` header for the classroom event, `sis.student_attendance` for individual student marks, backed by browser in-memory preservation during disconnections.
- **Decision:** **Option 2: Header-Detail Model with In-Memory Cache (OD-02).**
- **Reasoning:** The header-detail pattern enables instant verification of whether a section's register has been submitted, enforces a daily lock window, and records summary tallies. In-memory client caching ensures teachers do not lose roll-call data if the connection flickers during submission.
- **Consequences:** Requires `attendance_audit_logs` to track post-submission corrections.

---

### ADR-09: Two-Stage Staged Ingestion for Student Bulk Import
- **Context:** Onboarding a new school requires importing hundreds of existing student records via CSV/XLSX.
- **Options Considered:**
  1. *Direct Ingestion:* Parse CSV and directly insert into `sis.students`.
  2. *Two-Stage Staged Pipeline:* Upload raw file to `sis.student_import_jobs`, parse rows into `sis.student_import_rows`, run comprehensive validation, and prompt user to resolve errors before committing.
- **Decision:** **Option 2: Two-Stage Staged Pipeline.**
- **Reasoning:** Direct ingestion causes partial failure disasters (half the school imported, half failed due to duplicate names or missing dates). Staging allows dry-run validation, row-by-row error reporting, and all-or-nothing batch insertion.
- **Consequences:** Requires staging tables; prevents database corruption from dirty CSV files.

---

### ADR-10: Double-Entry Fee Ledger & Principal Waivers (OD-04)
- **Context:** School fee management requires financial exactness, transparent debit/credit tracking, and controlled concessions.
- **Options Considered:**
  1. *Mutable Balance Field:* Single `current_balance` column updated in-place.
  2. *Structured Allocation & Payment Ledger (OD-04):* `student_fee_allocations` debits, `fee_payments` immutable credits, and controlled `fee_concessions` with Principal approval workflows.
- **Decision:** **Option 2: Structured Allocation & Payment Ledger (OD-04).**
- **Reasoning:** In-place balance mutation destroys financial auditability. The allocation-payment ledger provides a permanent paper trail, guarantees sequential receipt numbers (`sis.fee_receipt_sequences`), and enforces Principal authorization for waivers.
- **Consequences:** All monetary values strictly use `NUMERIC(12, 2)` and currency `INR`. Cleared payments are immutable.

---

### ADR-11: Self-Service Staff Leave with Principal Approval Flow
- **Context:** Managing teacher and administrative staff leave requests and classroom coverage.
- **Options Considered:**
  1. *Informal Administrative Entry:* Admin manually logs teacher absences.
  2. *Self-Service Workflow:* Staff submit leave requests via portal; Principal reviews, assigns substitute teachers, and approves/rejects with audit logging.
- **Decision:** **Option 2: Self-Service Workflow.**
- **Reasoning:** Enables staff accountability, automated substitute teacher assignment in timetables, and historical leave tracking.
- **Consequences:** Requires leave requests and audit tables (`sis.staff_leave_requests`, `sis.staff_leave_audits`).

---

### ADR-12: Local-First File Storage with DB Metadata (OD-05)
- **Context:** Storing student portrait photographs and admission documents without introducing paid cloud services (AWS S3).
- **Options Considered:**
  1. *Cloud Object Storage (S3 / GCS):* Requires external cloud credentials and egress bandwidth.
  2. *Database Bytea Blobs:* Storing binary files directly inside PostgreSQL columns.
  3. *Local Filesystem with DB Metadata (OD-05):* Save files in `uploads/sis/`, validate magic bytes, enforce max 2MB (photos) / 5MB (docs), and store metadata in database.
- **Decision:** **Option 3: Local Filesystem with DB Metadata (OD-05).**
- **Reasoning:** Preserves the local-first workstation execution model, avoids bloating the PostgreSQL WAL and memory cache with binary blobs, and avoids cloud costs or internet dependencies.
- **Consequences:** Files are streamed through authenticated endpoints verifying tenant ownership.

---

### ADR-13: Append-Only Cryptographic & Transaction Audit Logs
- **Context:** Critical operations (admissions, attendance edits, fee waivers) must be tamper-evident.
- **Options Considered:**
  1. *Application Console Logging:* Standard JSON stdout logs.
  2. *Database Append-Only Audit Tables:* `public.audit_logs` and `sis.attendance_audit_logs` with PostgreSQL grants revoking `UPDATE` and `DELETE`.
- **Decision:** **Option 2: Database Append-Only Audit Tables.**
- **Reasoning:** Console logs can be truncated, lost during container restarts, or missed during incident analysis. Database-level append-only tables guarantee that even an authenticated application user cannot alter history.
- **Consequences:** Requires periodic log archiving in high-throughput environments.

---

### ADR-14: Selective Soft-Deletion vs. Immutable Historical Logs
- **Context:** Determining how data deletions are handled across different entities.
- **Options Considered:**
  1. *Universal Hard Deletion:* `DELETE FROM table WHERE id = ?`.
  2. *Universal Soft Deletion:* `deleted_at` on every table.
  3. *Selective Policy:* Soft deletion (`deleted_at`) on mutable structural entities (classes, sections, student profiles); strict hard deletion ban on financial payments, receipt sequences, attendance sessions, and audit logs.
- **Decision:** **Option 3: Selective Policy.**
- **Reasoning:** Master records (e.g. classes, profiles) may be archived or removed during setup mistakes. However, deleting fee payments, receipts, or attendance marks violates accounting standards and educational governance.
- **Consequences:** Financial and attendance tables reject `DELETE` via database triggers or schema permissions.
