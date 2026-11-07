# Stage 1 Product Scope: Multi-Tenant School Management SaaS (MVP)

**Document Status:** PRODUCT ARCHITECTURE & FUNCTIONAL SCOPE  
**Document Classification:** Planning & Engineering Specification (Read-Only Planning)  
**Target Pilot Scope:** Initial Onboarding & Demonstration for 1–2 Independent Schools  
**Runtime Environment:** 100% Local-First (Windows 11, WSL Ubuntu, Node.js 20+, PostgreSQL 18.6)  
**Cloud Infrastructure:** **NONE (Zero AWS Dependencies, Cloud-Independent)**  
**Date:** March 2026  
**Author:** Principal Product Architect & Lead Systems Engineer  

---

## 1. Executive Summary & Objective

The objective of Stage 1 is to build a functional, maintainable, multi-tenant School Management SaaS tailored for the pilot onboarding and live demonstration of **1–2 pilot educational institutions** (e.g. Apex Academy and Horizon International).

Rather than delivering a bloated enterprise feature wishlist or relying on mock interfaces, the platform delivers a **lean, complete, and robust operational core**. The system is engineered without artificial hardcoded limits on students or staff, but initial deployment, validation, and user acceptance testing focus on small, highly observable school deployments.

### Cardinal Product Principles:
1. **Verifiable End-to-End Workflows:** No placeholder buttons, empty function stubs, or fake mock API responses. Every button in the UI performs an actual database transaction.
2. **Defensive Multi-Tenancy:** Hard multi-tenant isolation enforced at the PostgreSQL database kernel level using Row-Level Security (RLS) under the unprivileged runtime role `school_app_user`.
3. **Role-Specific Experience:** Clean, distinct operational portals for seven target personas: Platform SuperAdmin, School Admin, Principal, Teacher, Student, Parent / Guardian, and Accountant.
4. **Cloud-Independent Local-First:** Runs 100% locally on standard developer workstations (Windows 11 / WSL) with zero external cloud dependencies or paid APIs.

---

## 2. Target Personas & Security Purview Matrix

The platform establishes distinct operational boundaries for seven user personas:

| Persona | Primary Operational Role | Operational Purview | Data Access Boundaries |
| :--- | :--- | :---: | :--- |
| **Platform SuperAdmin** | SaaS Platform Operator | Global Platform | Onboards schools (tenants), provisions primary domains, monitors platform health. Strictly denied access to sensitive student health and safeguarding records. |
| **School Admin** | Trust Executive / General Manager | Tenant-Wide (All Branches) | Manages school configuration, campus branches, academic years, fee structures, staff memberships, and institution-wide announcements. |
| **Principal** | Campus Academic Head | Branch-Scoped | Manages grade classes, sections, teacher allocations, admissions approvals, attendance oversight, and campus safeguarding files. |
| **Teacher** | Classroom Educator | Section & Subject Scoped | Marks daily attendance for assigned sections, creates homework assignments, views student allergy emergency flags. Strictly blocked from full medical and child protection files. |
| **Student** | Learner / Enrolled Pupil | Self Only | Views personal class timetable, attendance percentage, assigned homework, and school announcements. |
| **Parent / Guardian** | Family Custodian | Linked Children Only | Views attendance records, fee dues, and announcements strictly for children explicitly mapped in `student_guardians`. Access to Child A conveys zero access to Child B. |
| **Accountant** | Campus Bursar / Finance Officer | Branch / Tenant Financial | Configures fee categories, records fee payments, issues receipts, tracks outstanding balances. Strictly blocked from student academic grades and health files. |

---

## 3. Current Architecture & Codebase Baseline

An exhaustive audit of the existing repository structure reveals the current architectural foundation:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CURRENT ARCHITECTURE BASELINE                           │
├──────────────────────────┬─────────────────────────────────────────────────────────────┤
│ Architectural Layer      │ Current Implementation State                                │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **API Gateway (:8080)**  │ Node.js/Express reverse proxy in `services/gateway`.        │
│                          │ Enforces Host-to-tenant resolution, header sanitization    │
│                          │ (case-insensitive `X-Verified-*` stripping), rate limiting. │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **Identity Service**     │ Active on port 4001 in `services/auth-service`.             │
│ **(:4001)**              │ Implements RS256 token issuance, keypair rotation, session  │
│                          │ family refresh tokens, tenant onboarding, branch management,│
│                          │ membership invitations, and dedicated `platform_admins`.    │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **Shared Libraries**     │ Located in `services/common`:                               │
│                          │ - `auth.js`: RS256 signing, validation, key registry.       │
│                          │ - `db.js`: PostgreSQL connection pool & `withTenantContext`. │
│                          │ - `service.js`: Standard Express framework & health probes. │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **Database (`auth_db`)** │ PostgreSQL 18.6 in WSL. Schema `public` contains 7 active   │
│                          │ migrations (01–07) covering tenants, branches, users,       │
│                          │ roles, memberships, domains, sessions, audit_logs, admins. │
├──────────────────────────┼─────────────────────────────────────────────────────────────┤
│ **Frontend UI (:5173)**  │ React 18 + Vite SPA in `projects/school-management/frontend`.│
│                          │ Currently has basic layout, `Home.jsx`, and legacy e-commerce│
│                          │ `Auth.jsx`. Requires school-branded authentication & portals│
└──────────────────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 4. Comprehensive MVP Feature-to-Code Mapping & Classification

Every feature across Release 1 and Release 2 is classified into one of four states based on actual code inspection:
- **Existing and Reusable:** Implemented, verified, and ready for immediate operational integration.
- **Partially Implemented:** Core backend or database foundation exists; requires endpoint expansion or frontend interface.
- **Needs Modification:** Existing code requires refactoring or alignment with School SaaS patterns.
- **Missing:** Not yet implemented in source code; fully planned and ready for implementation.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  MVP FEATURE CLASSIFICATION MATRIX                                     │
├────┬───────────────────────────────┬─────────┬──────────────────────────┬──────────────────────────────┤
│ #  │ Functional Module             │ Release │ Classification           │ Implementation Reference     │
├────┼───────────────────────────────┼─────────┼──────────────────────────┼──────────────────────────────┤
│ 1  │ School Onboarding & Setup     │ Rel 1   │ Existing and reusable    │ `tenants.js`, `branches.js`  │
│ 2  │ Branch / Campus Management    │ Rel 1   │ Existing and reusable    │ `branches.js`, DB `branches` │
│ 3  │ Authentication & Sessions     │ Rel 1   │ Existing and reusable    │ `auth.js`, `sessions.js`     │
│ 4  │ Role-Based Delegation (RBAC)  │ Rel 1   │ Existing and reusable    │ `memberships.js`, DB `roles` │
│ 5  │ User Invitation & Management  │ Rel 1   │ Existing and reusable    │ `POST /api/v1/memberships`   │
│ 6  │ Frontend Auth & Role Context  │ Rel 1   │ Needs modification       │ `Auth.jsx` (Legacy pickle UI)│
│ 7  │ Academic Year & Term Setup    │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 8  │ Classes & Sections Management │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 9  │ Student Admission & Demograph.│ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 10 │ Student Photographs (OD-05)   │ Rel 1   │ Missing                  │ File upload & preview        │
│ 11 │ Segregated Health Records     │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 12 │ Segregated Safeguarding Notes │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 13 │ Guardian Network & Scoping    │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 14 │ Student Cohort Enrollment     │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 15 │ Subjects & Teacher Assignment │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 16 │ Daily Attendance Engine(OD-02)│ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 17 │ In-App Announcements          │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 18 │ Role-Specific Dashboards      │ Rel 1   │ Missing                  │ Planned in Frontend UI       │
│ 19 │ Academic Calendar             │ Rel 1   │ Missing                  │ Planned in `sis` schema      │
│ 20 │ Student Bulk Import           │ Rel 1   │ Missing                  │ CSV/XLSX validation engine   │
│ 21 │ Academic Year Rollover (OD-01)│ Rel 1   │ Missing                  │ Promotion Review Wizard      │
│ 22 │ Teacher Portal                │ Rel 2   │ Missing                  │ Planned in Frontend UI       │
│ 23 │ Student Portal                │ Rel 2   │ Missing                  │ Planned in Frontend UI       │
│ 24 │ Parent Portal / Switcher(OD-03)Rel 2   │ Missing                  │ Planned in Frontend UI       │
│ 25 │ Class & Teacher Timetable     │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 26 │ Homework & Assignments        │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 27 │ Basic Fee Structure Allocator │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 28 │ Fee Collection & Receipts     │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 29 │ Fee Concessions & Waivers(OD-04)Rel 2  │ Missing                  │ Controlled approval workflow │
│ 30 │ Outstanding Balance Tracker   │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 31 │ Attendance & Enrollment Rpts  │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 32 │ Financial Fee Summaries       │ Rel 2   │ Missing                  │ Planned in `sis` schema      │
│ 33 │ Basic Staff Leave Management  │ Rel 2   │ Missing                  │ Leave request & approval     │
└────┴───────────────────────────────┴─────────┴──────────────────────────┴──────────────────────────────┘
```

---

## 5. Release 1 — Core Operations (Detailed Module Scope)

Release 1 establishes the complete administrative and operational spine necessary to onboard a school, configure its physical and academic structures, admit students, assign faculty, and track daily attendance.

### 5.1 School & Branch Setup
- **Classification:** **Existing and reusable**
- **Existing Backend:** `POST /api/v1/tenants`, `GET /api/v1/tenants`, `POST /api/v1/branches`, `GET /api/v1/branches`.
- **Database Tables:** `public.tenants`, `public.branches`, `public.tenant_domains`.
- **Scope for Stage 1:**
  - Administrative UI console for SuperAdmin to view, create, and configure schools.
  - SchoolAdmin console to configure campus details (e.g. Hyderabad Main, Secunderabad North).

### 5.2 Academic Year & Term Setup
- **Classification:** **Missing**
- **Database Target:** `sis.academic_years`, `sis.academic_terms`.
- **Key Constraints:** Partial unique index `uq_sis_current_ay` ensuring exactly one current academic year per tenant.
- **Backend Endpoints:**
  - `POST /api/v1/sis/academic-years` (Name: "2026–2027", Code: "AY-2026-27", Start/End Dates).
  - `GET /api/v1/sis/academic-years` (List calendar periods with active flag).
  - `POST /api/v1/sis/academic-years/:id/terms` (Terms: Term 1, Term 2, Annual).

### 5.3 Authentication, User Management & Hierarchical RBAC
- **Classification:** **Partially implemented / Needs modification**
- **Existing Backend:** Robust RS256 authentication in `services/auth-service/src/routes/v1/auth.js`, membership invitations in `memberships.js`, session management in `sessions.js`.
- **Required Modification:**
  - Refactor frontend `Auth.jsx` to remove legacy e-commerce mock credentials (`demo@telugupickles.in`).
  - Wire frontend login to real seeded school accounts (`admin@apex.example`, `teacher@apex.example`).
  - Provide SchoolAdmin user management console to invite teachers, accountants, and staff with role delegation guardrails.

### 5.4 Classes, Sections, Subjects & Teacher Assignments
- **Classification:** **Missing**
- **Database Target:** `sis.classes`, `sis.sections`, `sis.subjects`, `sis.section_subject_teachers`.
- **Key Constraints:**
  - `sis.classes`: Scoped by `(tenant_id, branch_id, name)`.
  - `sis.sections`: Hard maximum capacity threshold (`max_capacity`, default: 40).
  - `class_teacher_id REFERENCES public.users(id)`: Designates the primary class teacher.
- **Backend Endpoints:**
  - `POST/GET /api/v1/sis/classes` (Grade 1 through Grade 12).
  - `POST/GET /api/v1/sis/sections` (Sections: A, B, C; assigned room and class teacher).
  - `POST/GET /api/v1/sis/subjects` (English, Mathematics, Science, Social Studies).
  - `POST /api/v1/sis/sections/:id/teachers` (Allocate subject teachers to sections).

### 5.5 Student Admission, Demographics & Concurrency-Safe Sequence Numbers
- **Classification:** **Missing**
- **Database Target:** `sis.students`, `sis.admission_applications`, `sis.admission_number_sequences`.
- **Concurrency Architecture:** Dedicated counter table `sis.admission_number_sequences` using atomic `UPDATE ... RETURNING` row locks. Prevents collisions under concurrent admissions.
- **Backend Endpoints:**
  - `POST /api/v1/sis/admissions/applications` (Candidate intake, target class, guardian details).
  - `GET /api/v1/sis/admissions/applications` (Registrar application triage queue).
  - `POST /api/v1/sis/admissions/applications/:id/approve` (Atomic matriculation transaction allocating sequential admission number and creating student profile).
  - `GET/PATCH /api/v1/sis/students/:id` (Demographic profile management).

### 5.6 Physical Segregation of Sensitive Records (Health & Safeguarding)
- **Classification:** **Missing**
- **Database Target:** `sis.student_health_records` (1:1), `sis.student_safeguarding_records` (1:1).
- **Access Policies:**
  - `sis.student_health_records`: Medical staff, campus nurse, SchoolAdmin (audited). Teachers view dietary allergy alerts only.
  - `sis.student_safeguarding_records`: Principal and Designated Safeguarding Lead (DSL) only. Teachers, accountants, and platform SuperAdmin are strictly denied.
- **Backend Endpoints:**
  - `GET/PUT /api/v1/sis/students/:id/health` (Requires `sis.health.read` + `X-Access-Reason`).
  - `GET/POST /api/v1/sis/students/:id/safeguarding` (Requires `sis.safeguarding.read` + `X-Access-Reason`).

### 5.7 Guardian Network & Child-Specific Governance
- **Classification:** **Missing**
- **Database Target:** `sis.guardians`, `sis.student_guardians`, `sis.guardian_consents`.
- **Key Logic:**
  - Many-to-many relationship supporting single parents, blended families, and court guardians.
  - Sibling isolation: Linking to Child A never confers access to Child B.
  - Legal custody tracking (`access_status`: `active`, `suspended`, `revoked`, `court_restricted`).
  - India DPDP Act 2023 Section 9 minor processing consent logged in `sis.guardian_consents`.
- **Backend Endpoints:**
  - `POST/GET /api/v1/sis/students/:id/guardians` (Link guardian with specific permission flags).
  - `POST /api/v1/sis/students/:id/consents` (Record verifiable parental consent).

### 5.8 Academic Enrollment & Section Management
- **Classification:** **Missing**
- **Database Target:** `sis.student_enrollments`, `sis.student_transfers`.
- **Invariants:**
  - Student actively enrolled in at most one section per academic year (`uq_sis_active_enrollment`).
  - Section roll numbers unique within active cohort (`uq_sis_section_roll_number`).
  - Section enrollment rejected with `409 Conflict` if active count equals `max_capacity`.
- **Backend Endpoints:**
  - `POST /api/v1/sis/enrollments` (Enroll student into class section).
  - `POST /api/v1/sis/enrollments/transfer` (Transfer between sections with reason logging).

### 5.9 Daily Attendance Management Engine
- **Classification:** **Missing**
- **Database Target:** `sis.student_attendance`.
- **Architecture:**
  - Recorded at the section level per calendar date: `(tenant_id, section_id, attendance_date, student_id)`.
  - Attendance statuses: `present`, `absent`, `late`, `excused`, `half_day`.
  - Batch entry API designed for rapid mobile/tablet marking by the assigned class teacher.
- **Backend Endpoints:**
  - `GET /api/v1/sis/sections/:id/attendance?date=YYYY-MM-DD` (Fetch active roster with today's status).
  - `POST /api/v1/sis/sections/:id/attendance` (Batch submit/update daily section attendance).
  - `GET /api/v1/sis/students/:id/attendance/summary` (Attendance percentage and absence history).

### 5.10 In-App Announcements Engine
- **Classification:** **Missing**
- **Database Target:** `sis.announcements`, `sis.announcement_audiences`.
- **Architecture:** Broadcast notices targeting specific branches and roles (e.g. "School Closed Tomorrow due to Rain" targeted to Branch A parents and teachers).
- **Backend Endpoints:**
  - `POST /api/v1/sis/announcements` (Admin/Principal creates notice with target audience filter).
  - `GET /api/v1/sis/announcements` (Feed filtered automatically by caller's role, tenant, and branch).

### 5.11 Role-Specific Administrative Dashboards
- **Classification:** **Missing**
- **Frontend Target:**
  - **SuperAdmin Dashboard:** Active tenant count, total schools, platform health.
  - **SchoolAdmin Dashboard:** Total student headcount, active campus count, teacher count, recent admissions, quick actions.
  - **Principal Dashboard:** Campus enrollment by grade, daily campus attendance rate, pending admission applications, urgent safeguarding flags.

### 5.12 Academic Calendar
- **Classification:** **Missing**
- **Database Target:** `sis.academic_calendar_events`.
- **Capabilities:**
  - Calendar month and agenda views of school academic events and holidays.
  - Track term dates, vacations, administrative holidays, and institution events.
  - Scoped to active academic year and branch.
  - Role-based permissions: SchoolAdmin and Principal create/edit/delete; Teachers, Students, and Parents view published calendar.
  - Explicitly excludes complex exam scheduling or third-party external calendar sync.

### 5.13 Student Bulk Import
- **Classification:** **Missing**
- **Capabilities:**
  - Ingest bulk student cohorts via CSV and XLSX spreadsheet templates.
  - Downloadable standardized header template with required fields.
  - Client-side and server-side row validation: date formats, gender, blood group, guardian phone.
  - In-flight duplicate detection against existing admission numbers and student legal names.
  - Interactive validation table highlighting errors before database commit.
  - Atomically reuses existing `sis.students`, `sis.guardians`, and `sis.student_enrollments` tables.
  - Enforces strict tenant and branch isolation; no duplicate student records created.

### 5.14 Academic Year Rollover & Promotion Review (OD-01)
- **Classification:** **Missing**
- **Capabilities:**
  - Controlled administrative promotion review wizard for academic year rollover.
  - Displays eligible enrolled students with current grade and section.
  - Authorised administrators review and adjust proposed next-year class/section assignments.
  - Prominently highlights students requiring review (academic holds, attendance flags, administrative review).
  - Allows inline corrections before confirmation.
  - Requires explicit final confirmation modal before applying cohort promotions.
  - Generates immutable audit log entries recording timestamp, executing administrator, and affected cohorts.
  - Enforces atomic database transaction preventing duplicate or partial rollover.
  - Preserves historical enrollment records across prior academic years.
  - Explicitly excludes automatic blanket promotion or complex prerequisite scoring.

---

## 6. Release 2 — Daily School Experience (Detailed Module Scope)

Release 2 introduces the interactive day-to-day portals and financial tools required for daily academic life, parental transparency, and tuition fee collection.

### 6.1 Teacher Portal
- **Classification:** **Missing**
- **Capabilities:**
  - View assigned classrooms and daily timetable schedule.
  - One-click daily attendance marking with automated absence count.
  - Publish homework assignments with due dates and instructions.
  - View classroom student roster with emergency medical alert flags.

### 6.2 Student Portal
- **Classification:** **Missing**
- **Capabilities:**
  - Personal profile and enrolled section view.
  - Daily timetable and class schedule.
  - Homework tracker with pending and completed assignment filters.
  - Personal attendance percentage indicator.
  - School announcements noticeboard.

### 6.3 Parent / Guardian Portal (Multi-Child View)
- **Classification:** **Missing**
- **Capabilities:**
  - **Child Switcher:** Seamlessly switch between multiple children enrolled in the school trust.
  - Daily attendance tracking and absence alerts per child.
  - Assigned homework view per child.
  - Tuition fee dues, payment history, and downloadable receipt records.
  - School announcement broadcast feed.

### 6.4 Academic Timetable & Scheduling
- **Classification:** **Missing**
- **Database Target:** `sis.timetable_slots`, `sis.section_timetables`.
- **Architecture:** Standard weekly grid (Monday–Saturday, 8 period slots per day). Validates teacher collision (preventing teacher from being assigned to two simultaneous classes).
- **Backend Endpoints:**
  - `POST/GET /api/v1/sis/sections/:id/timetable` (Configure and view weekly schedule).
  - `GET /api/v1/sis/teachers/:id/timetable` (Teacher's personal schedule).

### 6.5 Homework & Assignments Management
- **Classification:** **Missing**
- **Database Target:** `sis.assignments`, `sis.assignment_submissions`.
- **Capabilities:** Teacher publishes homework for a section/subject. Students and parents view title, description, and submission due date. Simple acknowledgment/completion toggle for students.

### 6.6 Basic Fee Structures & Allocations
- **Classification:** **Missing**
- **Database Target:** `sis.fee_categories`, `sis.fee_structures`, `sis.student_fee_allocations`.
- **Architecture:**
  - Fee heads: Tuition Fee, Admission Fee, Laboratory Fee, Term Exam Fee.
  - Structured per grade level for an academic year (e.g. Grade 5 Tuition: ₹25,000 per term).
  - Batch allocated to students upon section enrollment.

### 6.7 Fee Collection, Receipts & Transaction Log
- **Classification:** **Missing**
- **Database Target:** `sis.fee_payments`.
- **Architecture:**
  - Cash, cheque, bank transfer, and UPI reference recording by campus accountant.
  - Generates immutable sequential receipt number: `{TENANT}-{BRANCH}-REC-{YEAR}-{SEQ:05d}`.
  - Calculates real-time allocated amount against outstanding fee heads.
- **Backend Endpoints:**
  - `POST /api/v1/sis/students/:id/payments` (Record payment, issue receipt).
  - `GET /api/v1/sis/students/:id/payments` (Payment ledger and printable receipt view).

### 6.8 Outstanding Balance Tracker & Account Statements
- **Classification:** **Missing**
- **Capabilities:**
  - Live computation: $\text{Outstanding Balance} = \text{Total Allocated Fees} - \text{Total Payments Cleared}$.
  - Filterable student fee account statement for parents and billing administrators.

### 6.9 Attendance & Enrollment Operational Reports
- **Classification:** **Missing**
- **Capabilities:**
  - Campus enrollment summary broken down by grade, gender, and section.
  - Monthly attendance register report highlighting students with $< 75\%$ attendance.
  - Printable tabular layout for board compliance and inspection.

### 6.10 Basic Financial Fee Summaries
- **Classification:** **Missing**
- **Capabilities:**
  - Total fees billed vs. total fees collected vs. total outstanding dues per grade and campus.
  - Daily collection cash book summary for campus accountant.

### 6.11 Fee Concessions & Waivers (OD-04)
- **Classification:** **Missing**
- **Capabilities:**
  - Controlled fee concession and waiver management workflow.
  - Predefined concession categories (e.g. Sibling Discount, Staff Child, Merit Concession).
  - Configurable concession type (fixed amount vs. percentage), linked student, and applicable fee head.
  - Cashier actions restricted strictly to selecting active approved concession categories within system limits.
  - Ad-hoc manual fee waivers require explicit two-person authorization from Principal or SchoolAdmin.
  - Immutable audit trail recording requesting cashier, approving administrator, decision timestamp, and rationale.
  - Live adjustment of outstanding balances in ledgers and receipts; strictly prevents modification of historical cleared payments.
  - Excludes complex scholarship scoring, payroll deductions, and payment gateway automation.

### 6.12 Basic Staff Leave Management
- **Classification:** **Missing**
- **Capabilities:**
  - Standard employee leave request and administrative approval workflow.
  - Staff submits leave request specifying leave dates (start/end) and plain-text reason.
  - Authorised supervisors (Principal or SchoolAdmin) review, approve, or reject pending requests.
  - Clear request lifecycle states: `Pending`, `Approved`, `Rejected`.
  - Comprehensive historical audit of past requests, approver identity, and decision notes.
  - Excludes payroll salary calculations, complex leave accrual algorithms, or automated substitute attendance reassignments.

---

## 7. Explicitly Deferred Capabilities (Later Releases)

The following enterprise modules are **strictly excluded** from Stage 1 (Release 1 and Release 2) to maintain engineering focus and guarantee a lean, reliable pilot:

- **Examinations & Report Cards:** Grading scales, GPA calculation, hall tickets, marks entry, and CBSE/ICSE report card generators (Phase 5).
- **Transport & Fleet Operations:** Bus routes, stops, vehicle tracking, and driver allocations (Phase 7).
- **Library Management:** Book cataloging, ISBN lookup, issue/return circulation, fine calculations (Phase 7).
- **Staff Payroll & HR:** Salary structures, payslips, leaves, tax deductions, and provident fund tracking (Phase 6).
- **Advanced Predictive Analytics:** AI forecasting, student performance risk projections, dropout risk modeling.
- **Online Payment Gateway Integrations:** Razorpay, Stripe, or BillDesk webhooks (Cash, Cheque, and Bank Transfer reference intake is sufficient for initial pilot).
- **Native Mobile Applications:** iOS / Android apps (Mobile-responsive web SPA satisfies pilot needs).
- **External SMS & WhatsApp Messaging:** Twilio, Gupshup, or MSG91 integrations (In-app announcements satisfy pilot communication needs).

---

## 8. Architectural & Security Safeguards

To prevent regressions and maintain the hardened Phase 1 standard:
1. **Single Cohesive Domain Service:** All SIS, academic, admission, attendance, and fee logic will live in **`student-records-service`** on port `4002`. This avoids microservice proliferation and guarantees ACID transaction integrity.
2. **PostgreSQL RLS Engine Enforcement:** All tables created under schema `sis` will have RLS enabled and forced (`FORCE ROW LEVEL SECURITY`), running under connection role `school_app_user`.
3. **Fail-Closed Context:** Missing or invalid tenant context (`app.current_tenant_id`) returns 0 rows.
4. **Local-First File Storage:** Verification documents and photos use `LocalStorageProvider` under `uploads/sis/` with binary magic byte validation and UUID file hashing. Zero AWS S3 dependencies.
5. **RS256 JWT Authorization:** Ingress through `school-gateway` (:8080) forwards verified JWT claims. Microservice authorization evaluates role, tenant, and branch claims on every call.
