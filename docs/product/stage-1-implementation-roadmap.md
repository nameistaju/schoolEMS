# Stage 1 Implementation Roadmap: Multi-Tenant School Management SaaS (MVP)

**Document Status:** ENGINEERING EXECUTION ROADMAP  
**Document Classification:** Planning & Implementation Sequencing (Read-Only Planning)  
**Target Delivery:** Stage 1 MVP (Release 1: Core Operations + Release 2: Daily School Experience)  
**Runtime Environment:** 100% Local-First (Windows 11, WSL Ubuntu, Node.js 20+, PostgreSQL 18.6)  
**Cloud Infrastructure:** **NONE (Zero AWS Dependencies, Cloud-Independent)**  
**Date:** March 2026  
**Author:** Principal System Architect & Delivery Lead  

---

## 1. Implementation Philosophy & Phasing Strategy

To guarantee that the codebase remains maintainable, reliable, and completely functional after every development session, the Stage 1 MVP execution follows three foundational engineering principles:

1. **Strict Dependency-Ordered Sequencing:** No feature is built before its foundational database schemas, foreign keys, and access controls are fully operational and verified.
2. **Consolidated Domain Service:** Rather than deploying multiple fragmented microservices, all Stage 1 SIS capabilities (academics, admissions, enrollment, attendance, announcements, timetable, and basic fees) reside within a single cohesive backend domain microservice: **`student-records-service`** (Service 2, Port 4002). This maintains sub-50ms local response times, low memory consumption on developer workstations, and enables atomic ACID transactions across multi-table workflows.
3. **No Placeholders or Dead Ends:** Every module must fulfill the Definition of Done (DoD) before advancing to the next sprint. UI views must be wired to live API endpoints, and API endpoints must persist data into real PostgreSQL tables protected by Row-Level Security.

---

## 2. Inter-Module Dependency Architecture

The following directed graph maps the strict prerequisite dependencies between Stage 1 modules. Development must strictly follow this dependency order:

```
┌────────────────────────────────────────────────────────┐
│ [1.0] Phase 1 Identity Foundation (Active & Verified)  │
│  - Tenants, Branches, Users, RS256 Auth, Memberships   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ [1.1] Schema `sis` & Core Academic Taxonomy            │
│  - Academic Years & Terms (`sis.academic_years`)       │
│  - Classes, Sections & Subjects (`sis.classes`)        │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐
│ [1.2] Admissions Pipeline ││ [1.3] Faculty Allocation │
│  - Applications & Intake  ││  - Class Teachers         │
│  - Atomic Sequence Counter││  - Subject Teachers       │
└─────────────┬─────────────┘└─────────────┬─────────────┘
              │                            │
              ▼                            ▼
┌────────────────────────────────────────────────────────┐
│ [1.4] Student Profiles, Guardians & Roster Enrollment  │
│  - Permanent Students & Segregated Health/Safeguarding │
│  - Guardian Network & Child-Specific Permissions       │
│  - Active Section Cohort Enrollment Ledger             │
└─────────────┬────────────────────────────┬─────────────┘
              │                            │
              ├────────────────────────────┼────────────────────────────┐
              ▼                            ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐┌───────────────────────────┐
│ [1.5] Daily Attendance    ││ [1.6] Announcements Engine││ [1.7] Admin Dashboards    │
│  - Batch Section Marking  ││  - Role/Branch Targeted   ││  - SuperAdmin, SchoolAdmin│
│  - Daily Absence Summaries││  - Live Broadcast Feed    ││  - Campus Principal Views │
└─────────────┬─────────────┘└───────────────────────────┘└───────────────────────────┘
              │
              │ ════════════════════════════════════════════════════════════════════════
              │ BOUNDARY: RELEASE 1 COMPLETE ──► RELEASE 2 BEGINS
              │ ════════════════════════════════════════════════════════════════════════
              │
              ├────────────────────────────┬────────────────────────────┐
              ▼                            ▼                            ▼
┌───────────────────────────┐┌───────────────────────────┐┌───────────────────────────┐
│ [2.1] Timetable & Homework││ [2.2] Basic Fee Engine    ││ [2.3] Role Portals        │
│  - Weekly Section Grid    ││  - Fee Structure Headers  ││  - Teacher Portal         │
│  - Assignment Publishing  ││  - Collections & Receipts ││  - Student Portal         │
│  - Student Submissions    ││  - Outstanding Balance    ││  - Parent Multi-Child View│
└─────────────┬─────────────┘└─────────────┬─────────────┘└───────────────────────────┘
              │                            │
              └────────────────────────────┴────────────────────────────┐
                                                                        ▼
                                                         ┌─────────────────────────────┐
                                                         │ [2.4] Operational Reports   │
                                                         │  - Enrollment Summaries     │
                                                         │  - Attendance Registers     │
                                                         │  - Fee Balance Statements   │
                                                         └─────────────────────────────┘
```

---

## 3. Sprint-by-Sprint Implementation Roadmap

Stage 1 is divided into eight sequential engineering sprints spanning Release 1 and Release 2.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               STAGE 1 SPRINT DELIVERY SCHEDULE                                   │
├──────────┬───────────┬──────────────────────────────────────────┬──────────────┬─────────────────┤
│ Sprint   │ Release   │ Milestone Focus Area                     │ Complexity   │ Primary Target  │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 1 │ Rel 1     │ Database Migrations (Schema `sis` & RLS) │ **Medium**   │ Database / DDL  │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 2 │ Rel 1     │ Service Scaffolding & Academic Core APIs │ **Medium**   │ Backend (:4002) │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 3 │ Rel 1     │ Admissions, Demographics & Guardians     │ **High**     │ Backend & Local │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 4 │ Rel 1     │ Enrollment, Attendance & Announcements   │ **Medium**   │ Backend & Logic │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 5 │ Rel 1     │ Frontend Auth Refactor & Admin Consoles  │ **High**     │ Frontend UI     │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 6 │ Rel 2     │ Timetable, Homework & Teacher Portal     │ **Medium**   │ Full-Stack      │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 7 │ Rel 2     │ Basic Fee Structures & Collection Ledger │ **High**     │ Full-Stack      │
├──────────┼───────────┼──────────────────────────────────────────┼──────────────┼─────────────────┤
│ Sprint 8 │ Rel 2     │ Parent/Student Portals & Reports         │ **Medium**   │ Full-Stack & E2E│
└──────────┴───────────┴──────────────────────────────────────────┴──────────────┴─────────────────┤
```

---

## 4. Detailed Sprint Specifications

### Sprint 1: Database Migrations (Schema `sis` & PostgreSQL RLS)
- **Target Release:** Release 1 (Core Operations)
- **Estimated Complexity:** **Medium**
- **Prerequisites:** Phase 1 migrations (`01` through `07`) active in `auth_db`.
- **Deliverables:**
  - Create directory `projects/school-management/services/student-records-service/src/database/migrations`.
  - Migration 08: `create_sis_schema_and_academic_structure.js` (`sis` schema, `academic_years`, `academic_terms`, `classes`, `sections`, `subjects`, `section_subject_teachers`).
  - Migration 09: `create_students_and_sensitive_records.js` (`students`, `student_health_records`, `student_safeguarding_records`, `student_documents`).
  - Migration 10: `create_guardians_and_consents.js` (`guardians`, `student_guardians`, `guardian_consents`).
  - Migration 11: `create_admissions_and_sequences.js` (`admission_applications`, `application_documents`, `admission_number_sequences`).
  - Migration 12: `create_enrollments_attendance_announcements.js` (`student_enrollments`, `student_transfers`, `student_attendance`, `announcements`, `announcement_audiences`).
  - Migration 13: `enable_sis_rls_and_grants.js` (PostgreSQL RLS on all 18 tables, grants to `school_app_user`).
- **Acceptance Gate:**
  - Migrations execute cleanly under `school_migration_user` (running `SET ROLE school_schema_owner`).
  - Rollback reverts cleanly via tracking table `sis.knex_migrations_sis`.
  - Phase 1 tests (60/60) continue passing at 100%.

---

### Sprint 2: Service Scaffolding & Academic Structure Core
- **Target Release:** Release 1 (Core Operations)
- **Estimated Complexity:** **Medium**
- **Prerequisites:** Sprint 1 database tables deployed.
- **Deliverables:**
  - Scaffold `services/student-records-service` on port `4002`.
  - Integrate `common/service.js`, `common/auth.js`, `common/db.js`.
  - Implement routes and controllers:
    - `POST/GET /api/v1/sis/academic-years` (Calendar years with current active invariant).
    - `POST/GET /api/v1/sis/classes` (Grade levels scoped by campus branch).
    - `POST/GET /api/v1/sis/sections` (Classrooms with max capacity thresholds).
    - `POST/GET /api/v1/sis/subjects` (Course catalog).
    - `POST /api/v1/sis/sections/:id/teachers` (Class teacher & subject faculty assignments).
  - Update `services/gateway/src/index.js` to route `/api/v1/sis/*` to `http://localhost:4002`.
- **Acceptance Gate:**
  - Automated integration tests verify CRUD operations for academic taxonomy.
  - Gateway proxies requests and enforces header sanitization.

---

### Sprint 3: Admissions Pipeline, Student Profiles & Guardian Network
- **Target Release:** Release 1 (Core Operations)
- **Estimated Complexity:** **High**
- **Prerequisites:** Sprint 2 academic structure routes active.
- **Deliverables:**
  - Implement `LocalStorageProvider` for local document attachments under `uploads/sis/`.
  - Admissions state machine in `routes/v1/admissions.js` (`submitted` $\to$ `under_review` $\to$ `approved` $\to$ `enrolled`).
  - Concurrency-safe sequence allocator on `sis.admission_number_sequences` with transient deadlock retry handler.
  - Atomic matriculation transaction converting approved application into permanent `sis.students` and `sis.student_enrollments` records.
  - Segregated health endpoints (`GET/PUT /api/v1/sis/students/:id/health`) with mandatory `X-Access-Reason`.
  - Segregated safeguarding endpoints (`GET/POST /api/v1/sis/students/:id/safeguarding`) restricted to Principal/CPO.
  - Guardian link manager (`POST /api/v1/sis/students/:id/guardians`) with child-specific permission flags and DPDP Act Section 9 consent logging.
- **Acceptance Gate:**
  - 25 concurrent admission requests execute without duplicate numbers or deadlock crashes.
  - Negative RBAC tests prove teachers and accountants are blocked from health/safeguarding endpoints.

---

### Sprint 4: Cohort Enrollment, Daily Attendance & Announcements
- **Target Release:** Release 1 (Core Operations)
- **Estimated Complexity:** **Medium**
- **Prerequisites:** Sprint 3 student profiles and sections active.
- **Deliverables:**
  - Section enrollment controller with single active seat constraint and unique roll numbers.
  - Section capacity guard rejecting enrollments exceeding `max_capacity` with `409 Conflict`.
  - Batch daily attendance entry engine (`POST /api/v1/sis/sections/:id/attendance`).
  - Attendance summary calculations per student and section.
  - In-app announcement publishing engine (`POST/GET /api/v1/sis/announcements`) with role-based and campus audience filters.
- **Acceptance Gate:**
  - Marking attendance for 40 students commits in a single transaction in $< 100$ms.
  - Announcements created for "Teachers Only" are invisible to Student/Parent tokens.

---

### Sprint 5: Frontend Authentication Refactor & Administrative Consoles
- **Target Release:** Release 1 (Core Operations)
- **Estimated Complexity:** **High**
- **Prerequisites:** Sprints 1–4 backend APIs operational.
- **Deliverables:**
  - Refactor `projects/school-management/frontend`:
    - Remove legacy e-commerce strings, assets, and mock demo accounts.
    - Wire `AuthContext.jsx` to `/api/v1/auth/login` supporting subdomain and custom domain resolution.
    - Implement role-based navigation sidebar and header branding.
  - **SuperAdmin Console:** Tenant list, school creation modal, domain management.
  - **SchoolAdmin Console:** Campus branch setup, academic calendar manager, staff invitation console.
  - **Principal Console:** Class & section manager, admissions triage queue, student directory, announcement publisher.
- **Acceptance Gate:**
  - Administrator can log in, create a campus branch, define a class, admit a student, and view them in the student roster entirely through the UI.
  - Frontend production build (`npm run build`) completes with zero errors.

---

### Sprint 6: Timetable, Homework Engine & Teacher Portal
- **Target Release:** Release 2 (Daily School Experience)
- **Estimated Complexity:** **Medium**
- **Prerequisites:** Release 1 verified and stable.
- **Deliverables:**
  - Backend migrations and routes for `sis.timetable_slots` and `sis.assignments`.
  - Teacher schedule validator preventing double-booking across sections.
  - Assignment creation API with due dates and subject links.
  - **Teacher Portal UI:**
    - Assigned classroom roster with student photo and allergy emergency flags.
    - Mobile-friendly one-click attendance marking sheet.
    - Homework assignment publisher.
    - Weekly timetable view.
- **Acceptance Gate:**
  - Teacher can mark daily attendance and assign homework in $< 3$ clicks.
  - Attempting to schedule a teacher for two classes at the same period throws `409 Conflict`.

---

### Sprint 7: Basic Fee Structures & Collection Ledger
- **Target Release:** Release 2 (Daily School Experience)
- **Estimated Complexity:** **High**
- **Prerequisites:** Student enrollments and classes active.
- **Deliverables:**
  - Migrations and routes for `sis.fee_categories`, `sis.fee_structures`, `sis.fee_payments`.
  - Term fee structure definition per grade level (Tuition Fee, Lab Fee, Admission Fee).
  - Batch fee allocation to enrolled students.
  - Accountant payment recording endpoint generating sequential receipt numbers.
  - Real-time balance calculator ($\text{Billed} - \text{Paid} = \text{Outstanding}$).
  - **Accountant Console UI:**
    - Student fee search and account statement.
    - Collect payment modal (Cash, Cheque, Bank Transfer, UPI).
    - Printable fee receipt generator.
- **Acceptance Gate:**
  - Payment splits cleanly across allocated fee categories.
  - Overpayment or negative payment entries are strictly rejected.

---

### Sprint 8: Parent & Student Portals, Reports & Pilot Delivery
- **Target Release:** Release 2 (Daily School Experience)
- **Estimated Complexity:** **Medium**
- **Prerequisites:** Sprints 1–7 complete.
- **Deliverables:**
  - **Parent Portal UI:**
    - Child switcher supporting parents with multiple enrolled siblings.
    - Daily attendance calendar with color-coded present/absent days.
    - Homework checklist with due date indicators.
    - Fee dues card with payment history and printable receipts.
    - School announcement feed.
  - **Student Portal UI:**
    - Personal schedule, homework tracker, attendance percentage.
  - **Reporting Modules:**
    - Campus enrollment summary (by grade, section, and gender).
    - Monthly attendance register (highlighting $< 75\%$ attendance).
    - Fee collection summary vs. outstanding dues report.
  - End-to-end integration and smoke test runbook for pilot demonstration.
- **Acceptance Gate:**
  - Complete end-to-end user journeys demonstrated for all 7 personas.
  - 100% of automated unit, integration, and security tests passing.

---

## 5. Complexity Estimation & Risk Analysis Matrix

| Module Name | Estimated Complexity | Technical & Operational Rationale | Key Risk & Mitigation Strategy |
| :--- | :---: | :--- | :--- |
| **Academic Structure** | **Low** | Standard hierarchical relational modeling (`Year` $\to$ `Term` $\to$ `Class` $\to$ `Section`). | Risk: Term date overlap. Mitigation: Database check constraints on date intervals. |
| **Admissions & Sequences** | **High** | Multi-step state machine, file upload handling, atomic row-level locks on sequence counter. | Risk: Deadlock or sequence gap under concurrency. Mitigation: Atomic `UPDATE ... RETURNING` and exponential backoff retry handler. |
| **Sensitive Records** | **Medium** | Physical segregation into 1:1 tables with specialized RBAC and mandatory purpose audit trails. | Risk: Accidental data leakage in join queries. Mitigation: Omitted from default ORM projections; dedicated endpoints only. |
| **Attendance Engine** | **Medium** | High-volume daily writes; batch submission payloads; mobile responsiveness. | Risk: Slow writes during morning roll call. Mitigation: Single batch `INSERT ... ON CONFLICT DO UPDATE` query; composite index on `(section_id, attendance_date)`. |
| **Frontend Auth Refactor**| **High** | Transitioning legacy single-store frontend to multi-tenant, role-aware SPA with 7 distinct portals. | Risk: Token storage and route guard leaks. Mitigation: Centralized `AuthContext` with strict role-based layout wrappers. |
| **Timetable Scheduling** | **Medium** | Matrix scheduling grid with teacher and classroom collision detection. | Risk: Double-booking faculty. Mitigation: Unique constraint on `(tenant_id, academic_year_id, day_of_week, period_number, teacher_id)`. |
| **Fee Collection Ledger**| **High** | Financial accounting calculations, partial payments, sequential receipt numbers, non-repudiation. | Risk: Ledger balance discrepancies. Mitigation: Strict ACID transactions; immutable payment records; computed balances. |
| **Parent Portal** | **Medium** | Multi-child context switching, responsive card layouts, student-level isolation. | Risk: Sibling access leakage. Mitigation: Backend asserts active `student_guardians` mapping on every child request. |

---

## 6. Comprehensive Testing Strategy for Every Module

Every module in Stage 1 must be accompanied by automated tests across five test tiers before being marked complete:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STAGE 1 TEST HARNESS TIERS                      │
├────────────────────┬───────────────────────────────────────────────────┤
│ Test Tier          │ Scope & Validation Method                         │
├────────────────────┼───────────────────────────────────────────────────┤
│ **1. Unit Tests**  │ Validation logic, fee balance math, date interval │
│                    │ calculations, password hashing (`node:test`).     │
├────────────────────┼───────────────────────────────────────────────────┤
│ **2. API Tests**   │ Supertest HTTP endpoint contracts, JSON envelope  │
│                    │ assertions, status codes (`200`, `201`, `400`).   │
├────────────────────┼───────────────────────────────────────────────────┤
│ **3. Negative RBAC**│ Asserts `403 Forbidden` when unauthorized roles    │
│                    │ attempt privileged actions (e.g. Teacher hitting  │
│                    │ safeguarding; Accountant hitting grades).         │
├────────────────────┼───────────────────────────────────────────────────┤
│ **4. Real RLS**    │ Connects to PostgreSQL 18.6 in WSL as role        │
│                    │ `school_app_user` with `SET LOCAL app.current_    │
│                    │ tenant_id`. Proves cross-tenant queries return 0. │
├────────────────────┼───────────────────────────────────────────────────┤
│ **5. UI Build**    │ Executes `npm run build` in `frontend/` to verify │
│                    │ TypeScript/JSX compilation and zero build errors. │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 7. Stage 1 Acceptance Gates & Definition of Done

Stage 1 Release 1 and Release 2 may only be declared complete when all criteria of the following checklist are satisfied:

- [ ] **Architecture:** All SIS capabilities reside in `student-records-service` (:4002) connecting to `auth_db` schema `sis`.
- [ ] **Data Isolation:** All 18 tables under schema `sis` enforce PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`).
- [ ] **Local-First:** System boots, runs, and tests completely offline on Windows 11 / WSL without AWS dependencies.
- [ ] **Zero Mock Responses:** Every route reads from and writes to real PostgreSQL tables.
- [ ] **Zero Dead Code:** Legacy e-commerce components and unused routes are removed or archived.
- [ ] **Admission Concurrency:** Concurrency test validates 25+ simultaneous admissions generate sequential numbers without collisions.
- [ ] **Sensitive Data Security:** Teachers and accountants cannot query `sis.student_health_records` or `sis.student_safeguarding_records`.
- [ ] **Guardian Governance:** Guardian child-access checks prevent cross-child or cross-tenant leakage.
- [ ] **Financial Integrity:** Payment recording issues sequential receipt numbers and updates outstanding balances accurately.
- [ ] **Frontend Quality:** Responsive layouts for all 7 role portals; zero non-functional buttons; explicit loading and error states.
- [ ] **Automated Test Suite:** 100% of automated tests pass against real PostgreSQL in WSL. Existing Phase 1 tests continue passing.
- [ ] **Documentation:** System architecture, API contracts, and user guides are fully synchronized with actual code.
