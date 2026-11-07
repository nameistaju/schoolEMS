# Document 03: Migration and Database Operations Specification

**Document Status:** TECHNICAL SPECIFICATION — APPROVED BASELINE  
**Classification:** Database Operations, Lifecycle & Disaster Recovery  
**Database Topology:** Single Database `auth_db` | Schema `sis` Pipeline  
**Date:** March 2026  
**Author:** Lead Database Reliability Engineer & Principal DevSecOps Architect  

---

## 1. Phase 1 Migration Protection & Schema Isolation

### 1.1 Invariant: Phase 1 Immutability
Phase 1 established the Identity, Multi-Tenancy, and Platform Access foundation under PostgreSQL schema `public`.
- **Permanent Freeze:** Migrations `20260301000001` through `20260301000007` in `projects/school-management/services/auth-service/migrations` are permanently frozen. They must NEVER be renamed, edited, combined, or re-run.
- **Tracking Table Isolation:** Phase 1 migrations are recorded exclusively in `public.knex_migrations`. The SIS service must never read or mutate this table.
- **Legacy Database Protection:** Legacy e-commerce tables (`catalog`, `cart`, `orders`, `payments`) residing in separate databases or schemas are completely decoupled and must never be altered or repurposed.

### 1.2 SIS Independent Migration Pipeline
To guarantee complete operational isolation:
- All Student Information System migrations reside in:
  `projects/school-management/services/student-records-service/src/database/migrations/`
- SIS migrations are recorded exclusively in:
  **`sis.knex_migrations_sis`**
- Knex configuration file:
  `projects/school-management/services/student-records-service/knexfile.js`
  ```javascript
  module.exports = {
    client: 'pg',
    connection: {
      host: process.env.PGHOST || '127.0.0.1',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.DB_NAME || 'auth_db',
      user: process.env.PG_MIGRATION_USER || 'school_migration_user',
      password: process.env.PG_MIGRATION_PASSWORD,
    },
    migrations: {
      directory: './src/database/migrations',
      tableName: 'knex_migrations_sis',
      schemaName: 'sis',
    },
  };
  ```

---

## 2. Ordered SIS Migration Inventory (Migrations 08–16)

The SIS schema is provisioned through 9 sequential, fully idempotent Knex migrations:

| Migration Index | File Name | Entities & Tables Created | Purpose & Scope |
| :---: | :--- | :--- | :--- |
| **08** | `20260301000008_create_sis_schema_and_academic_structure.js` | Schema `sis`, `academic_years`, `academic_terms`, `academic_calendar_events`, `classes`, `sections`, `subjects`, `section_subject_teachers` | Initializes namespace `sis`, grade hierarchy, calendar schedules, and teacher allocations. |
| **09** | `20260301000009_create_admissions_and_students.js` | `admission_number_sequences`, `admission_applications`, `students`, `student_photos`, `student_documents` | Student identity, atomic admission numbers, portrait photos (OD-05), and uploaded documents. |
| **10** | `20260301000010_create_segregated_sensitive_records.js` | `student_health_records`, `student_safeguarding_records` | Segregated medical and child protection files with isolated role access boundaries. |
| **11** | `20260301000011_create_guardians_and_consents.js` | `guardians`, `student_guardians`, `guardian_consents` | Family network, legal custody, pickup authorization, and DPDP Section 9 consents. |
| **12** | `20260301000012_create_enrollments_and_rollover.js` | `student_enrollments`, `academic_rollover_logs`, `academic_rollover_items`, `student_import_jobs`, `student_import_rows` | Cohort section enrollments, Promotion Review Wizard (OD-01), and bulk import staging. |
| **13** | `20260301000013_create_attendance_and_announcements.js` | `attendance_sessions`, `student_attendance`, `attendance_audit_logs`, `announcements`, `announcement_audiences` | Daily roll-call engine (OD-02), attendance audit logs, and in-app communications. |
| **14** | `20260301000014_create_timetable_and_assignments.js` | `timetable_periods`, `timetable_slots`, `assignments`, `assignment_completions` | Bell schedules, weekly classroom timetable, teacher clash prevention, and homework. |
| **15** | `20260301000015_create_fees_and_concessions.js` | `fee_categories`, `fee_structures`, `fee_concession_categories`, `student_fee_allocations`, `fee_concessions`, `fee_receipt_sequences`, `fee_payments` | Fee schedules, student ledgers, cashier receipts, and Principal concession waivers (OD-04). |
| **16** | `20260301000016_create_staff_leave_and_enable_rls.js` | `staff_leave_requests`, `staff_leave_audits`, RLS Policies on all 30 `sis` tables, runtime table grants for `school_app_user` | Completes operational schema, activates kernel-level RLS, and sets unprivileged grants. |

---

## 3. Rollback Procedures & Idempotency Rules

### 3.1 Migration Reversibility Standards
Every migration file must implement a symmetrical, non-destructive `down` function:
1. `down` functions drop tables in the strict reverse order of creation to prevent foreign key dependency errors (`CASCADE` is used only where explicitly verified).
2. RLS policies and sequence triggers are dropped prior to dropping parent tables.
3. Rollbacks must be verified in local integration testing before any migration is approved.

### 3.2 Migration Execution Protocol
```bash
# Execute SIS forward migrations
npx knex migrate:latest --knexfile ./knexfile.js

# Rollback last migration batch
npx knex migrate:rollback --knexfile ./knexfile.js

# Verify migration status
npx knex migrate:status --knexfile ./knexfile.js
```

---

## 4. Local-First Backup and Disaster Recovery Operations

All backup and restore operations are executed locally using standard PostgreSQL tools (`pg_dump`, `pg_restore`) targeting the WSL2 Ubuntu PostgreSQL 18.6 instance. Zero cloud or AWS tools are required.

### 4.1 Schema-Specific and Full Database Backup
```bash
# 1. Backup ONLY the Phase 2 SIS schema (Custom compressed format)
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d auth_db \
  --schema=sis \
  --format=custom \
  --file=./backups/auth_db_sis_$(date +%Y%m%d_%H%M%S).dump

# 2. Backup the ENTIRE auth_db (Public identity + SIS schemas)
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d auth_db \
  --format=custom \
  --file=./backups/auth_db_full_$(date +%Y%m%d_%H%M%S).dump

# 3. Plain text SQL DDL schema-only export for git architectural tracking
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d auth_db \
  --schema=sis \
  --schema-only \
  --file=./backups/sis_schema_definition.sql
```

### 4.2 Disaster Recovery & Schema Restoration
```bash
# Clean restoration of schema sis from dump
pg_restore -h 127.0.0.1 -p 5432 -U postgres -d auth_db \
  --clean \
  --if-exists \
  --schema=sis \
  ./backups/auth_db_sis_latest.dump
```

---

## 5. Local Demonstration Seeding Strategy

To validate all Release 1 and Release 2 features during pilot demonstration, a deterministic, idempotent seed script is provided:

### 5.1 Pilot Institution: "Apex Academy"
- **Tenant:** Apex Educational Trust (`apex-trust`)
- **Branches:**
  1. `Apex Academy — City Campus` (Main Campus, code: `CITY`)
  2. `Apex Academy — Valley Campus` (Branch Campus, code: `VALLEY`)
- **Academic Year:** `Academic Year 2026-2027` (`AY-2026-27`, `is_current = true`)
- **Academic Structure:**
  - 2 Classes: `Grade 9` (Secondary), `Grade 10` (Secondary)
  - 4 Sections: `Grade 9-A`, `Grade 9-B`, `Grade 10-A`, `Grade 10-B` (Capacity: 35 each)
  - 5 Subjects: `Mathematics`, `English Language`, `General Science`, `Social Studies`, `Computer Applications`
- **Users & Personas Provisioned:**
  - `superadmin@schoolsaas.com` (Platform SuperAdmin)
  - `admin@apex.schoolsaas.com` (School Admin)
  - `principal.city@apex.schoolsaas.com` (Principal — City Campus)
  - `teacher.math@apex.schoolsaas.com` (Teacher — Mathematics)
  - `accountant@apex.schoolsaas.com` (Accountant / Bursar)
  - `parent.sharma@apex.schoolsaas.com` (Parent of 2 enrolled children — OD-03 demonstration)
  - `student.aarav@apex.schoolsaas.com` (Student — Grade 10-A)
- **Cohort Data:**
  - 40 Students admitted across sections with portrait photos (OD-05).
  - 30 Guardians mapped with kinship and DPDP consents.
  - Complete daily attendance sessions for current month with present/absent/late marks (OD-02).
  - Full fee structures (₹45,000 Annual Tuition, ₹12,000 Lab Fee), active allocations, sample cashier payments with official receipts, and 1 pending sibling concession for Principal approval (OD-04).
  - 2 Staff leave requests (1 approved, 1 pending Principal decision).
