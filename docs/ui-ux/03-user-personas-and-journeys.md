# Document 03: User Personas & End-to-End User Journeys

**Document Status:** APPROVED WORKFLOW SPECIFICATION  
**Classification:** Enterprise UX Architecture, Persona Profiles & Journey Maps  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  
**Governing Standard:** `docs/ENGINEERING_STANDARDS.md` & Approved Operational Decisions (OD-01 to OD-05)  

---

## 1. Persona Profiles & Purviews

To avoid generic "one-size-fits-all" dashboard anti-patterns, SchoolEMS tailors information architecture, actions, and data tables to seven distinct personas.

*(Note: Persona names, institutions, and contact details below are illustrative test profiles and development fixtures derived from `seeds/dev/02_demo_schools.js`, not real individuals or commercial customers).*

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   THE SEVEN OPERATIONAL PERSONAS                                       │
├────┬─────────────────────┬──────────────────┬──────────────────────┬───────────────────────────────────┤
│ #  │ Persona (Fixture)   │ Canonical Role   │ Primary Environment  │ Core Motivations & Frustrations   │
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 1  │ **Vikram Malhotra** │ Platform         │ Desktop Workstation  │ Needs visibility into tenant      │
│    │ Platform Operator   │ SuperAdmin       │ (1080p, Chrome)      │ health; strictly denied access to │
│    │                     │                  │                      │ tenant-private student data.      │
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 2  │ **Col. R. S. Verma**│ School Admin     │ Office Desktop       │ Oversees multi-campus operations; │
│    │ Managing Director   │                  │ (Dual Monitor)       │ manages academic setup, rollover, │
│    │                     │                  │                      │ admissions, and staff leave.      │
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 3  │ **Dr. Meenakshi S.**│ Principal        │ Laptop & Tablet      │ Focuses on teacher assignments,   │
│    │ Campus Principal    │                  │ (14" Laptop, iPad)   │ student attendance, promotion     │
│    │                     │                  │                      │ approvals, and leave reviews.     │
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 4  │ **K. Srilatha**     │ Teacher          │ Classroom Laptop     │ Takes morning homeroom roll with  │
│    │ Class Teacher       │                  │ & Smartphone (Mobile)│ safe review; submits leave; posts │
│    │                     │                  │                      │ homework (Release 2).             │
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 5  │ **Aarav Sharma**    │ Student          │ Home Laptop / Shared │ Checks timetable, homework, and   │
│    │ Enrolled Student    │                  │ Family Device        │ announcements (Release 2).        │
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 6  │ **Rajesh Sharma**   │ Parent /         │ Smartphone (Mobile   │ Tracks 2 linked children via      │
│    │ Linked Guardian     │ Guardian         │ Safari / Chrome)     │ persistent switcher; checks       │
│    │                     │                  │                      │ attendance, dues, notices (Rel 2).│
├────┼─────────────────────┼──────────────────┼──────────────────────┼───────────────────────────────────┤
│ 7  │ **S. Ramanathan**   │ Accountant       │ Cashier Desk PC      │ Collects fees, enters concession  │
│    │ Campus Bursar       │                  │ (Numeric Keypad)     │ categories, and prints receipts   │
│    │                     │                  │                      │ (Release 2).                      │
└────┴─────────────────────┴──────────────────┴──────────────────────┴───────────────────────────────────┘
```

---

## 2. Twelve End-to-End User Journey Maps

---

### Journey 01: School Tenant Onboarding & Setup (Release 1)
* **Actor:** Platform SuperAdmin
* **Goal:** Onboard a new school organization with its primary domain and initial administrator credentials.
* **Starting Point:** Platform Administration Dashboard (`/platform/schools`).
* **Step-by-Step Flow:**
  1. Clicks `+ Onboard School`.
  2. Modal opens: enters School Name (e.g. `Apex Academy Test`), Subdomain Slug (`apex-test`), Primary Domain (`apex.example`), and Timezone (`Asia/Kolkata`).
  3. Enters Initial SchoolAdmin details: Name and Work Email (`admin@apex.example`).
  4. Clicks `Provision Tenant`. Backend executes transactional insert into `tenants`, `tenant_domains`, and creates initial admin membership.
  5. System displays temporary setup credentials or invite token.
* **Screens Involved:** Platform Dashboard (`/platform/dashboard`), Master School Directory (`/platform/schools`).
* **Permissions:** Strictly restricted to `platform_admins` (`SuperAdmin`).
* **Success State:** School appears in active school directory; SchoolAdmin account is generated.
* **Failure State:** Duplicate slug/domain returns inline `409 Conflict: Domain or slug already registered`.

---

### Journey 02: Academic Year & Term Setup (Release 1)
* **Actor:** School Admin
* **Goal:** Configure the upcoming academic session with start/end dates and non-overlapping terms.
* **Starting Point:** School Settings > Academic Structure (`/admin/academic-years`).
* **Step-by-Step Flow:**
  1. Clicks `+ Add Academic Year`.
  2. Form opens: enters Year Name (e.g. `2026–2027`), Start Date, End Date.
  3. Configures Terms (Term 1, Term 2) ensuring dates fall within year boundaries.
  4. Designates as active session for the current branch/tenant.
  5. Clicks `Save Academic Year`.
* **Screens Involved:** Academic Sessions & Terms (`/admin/academic-years`).
* **Permissions:** `SchoolAdmin`.
* **Validation Rules:**
  - End date must follow Start date.
  - Term dates must not overlap.
* **Success State:** New session appears in the Academic Year switcher with an `Active` badge.
* **Failure State:** Date collision surfaces inline error: *"Selected date range overlaps with an existing session"*.

---

### Journey 03: Classes, Sections & Seating Capacity (Release 1)
* **Actor:** School Admin / Principal
* **Goal:** Create grade levels, configure sections, and establish maximum seating capacities.
* **Starting Point:** Academics > Classes & Sections (`/academics/classes`).
* **Step-by-Step Flow:**
  1. Navigates to Classes & Sections.
  2. Adds or selects a Grade Level (e.g. `Grade 8`).
  3. Adds Section `A`, sets Room Number (`Room 204`), and Maximum Seating Capacity (`40`).
  4. Assigns primary Class Teacher from authorized faculty list.
  5. Clicks `Save Section`.
* **Screens Involved:** Classes & Sections Manager (`/academics/classes`).
* **Permissions:** `SchoolAdmin`, `Principal`.
* **Success State:** Section is registered with capacity counter (`0 / 40`).

---

### Journey 04: Multi-Step Student Admission & Photograph Upload (OD-05, Release 1)
* **Actor:** School Admin / Registrar
* **Goal:** Complete student admission with guardian linking and verified photograph file upload.
* **Starting Point:** Student Directory (`/students`) -> `+ New Admission`.
* **Step-by-Step Flow:**
  1. **Step 1: Student Demographics & Photo:** Enters Legal Full Name, Date of Birth, Gender, Blood Group. Optional National ID is clearly labeled **Voluntary** with alternative ID types available.
  2. **Photograph Upload (OD-05):** Uploads image file (JPEG/PNG, max 2MB). Client provides instant preview. Can replace or remove image before saving. File is validated client-side and server-side.
  3. **Step 2: Guardian Linking:** Searches existing guardians by phone/email or creates a new guardian profile with relationship and custody status.
  4. **Step 3: Academic Placement:** Selects Academic Year, Grade, Section (verifies section is not at maximum capacity).
  5. **Step 4: Review & Submit:** Reviews summary card. Clicks `Confirm Admission`.
* **Screens Involved:** Multi-Step Student Admission Wizard (`/students/admit`).
* **Permissions:** `SchoolAdmin`, `Principal`.
* **Validation Rules:**
  - Section enrollment blocked if capacity reached.
  - Plaintext national ID numbers are never displayed or stored unencrypted.
  - Photo format validated (JPEG/PNG only, max 2MB limit). No webcam hardware required.
* **Success State:** Student record created with unique sequential admission number; redirect to student dossier.

---

### Journey 05: Academic Calendar Event Management (Release 1)
* **Actor:** School Admin / Principal
* **Goal:** Publish school holidays, term breaks, and campus events on the academic calendar.
* **Starting Point:** Academic Calendar (`/admin/calendar`).
* **Step-by-Step Flow:**
  1. Opens Academic Calendar view (defaults to current month in active academic session).
  2. Clicks `+ Add Calendar Event`.
  3. Enters Event Title (e.g. *"Autumn Vacation"*), Category (`Holiday`, `Event`, `Term Date`), Start Date, and End Date.
  4. Selects Scope: `All Branches` or specific campus branch.
  5. Clicks `Publish Event`.
* **Screens Involved:** Academic Calendar Grid & Modal (`/admin/calendar`).
* **Permissions:** `SchoolAdmin`, `Principal` (Manage); `Teacher`, `Student`, `Parent` (Read-only view).
* **Success State:** Event renders on the calendar with category color pill and publishes to role dashboards.

---

### Journey 06: Student Bulk Import with Spreadsheet Validation (Release 1)
* **Actor:** School Admin
* **Goal:** Bulk import student cohort records via CSV or XLSX spreadsheet.
* **Starting Point:** Student Directory (`/students`) -> `Import Students`.
* **Step-by-Step Flow:**
  1. Downloads standard CSV template with required column headers.
  2. Populates student data and uploads file.
  3. System parses spreadsheet and performs row-level validation: checks required fields, date formats, valid grade/section codes, and in-flight duplicate admission numbers.
  4. Interactive validation table highlights valid rows (green) and invalid rows (red with specific error messages).
  5. Admin fixes errors or clicks `Import Valid Rows`.
* **Screens Involved:** Student Bulk Import Wizard (`/students/import`).
* **Permissions:** `SchoolAdmin`.
* **Validation Rules:**
  - Enforces strict tenant and branch scoping.
  - Reuses existing `sis.students`, `sis.guardians`, and `sis.student_enrollments` tables.
  - Duplicate admission numbers or invalid references rejected with clear error counts.
* **Success State:** Validated student records committed in an atomic database transaction; import summary displayed.

---

### Journey 07: Daily Homeroom Attendance with In-Memory Offline Alert (OD-02, Release 1)
* **Actor:** Class Teacher
* **Goal:** Mark morning attendance for the assigned class section with safety and offline awareness.
* **Starting Point:** Attendance Register (`/attendance/register`).
* **Step-by-Step Flow:**
  1. Opens today's section attendance register. Default view displays roster sorted by roll number.
  2. Teacher clicks `Pre-fill All Present`. Visual notice appears: *"40 students marked Present. Unsaved changes."*
  3. Teacher navigates to absent students (Roll 02 and Roll 04) using arrow keys. Toggles status to `Absent` and enters remarks.
  4. Summary counters reflect: **Total: 40 | Present: 38 | Absent: 2 | Late: 0**.
  5. **Offline Scenario (OD-02):** If network drops, unsubmitted attendance remains preserved in browser memory. A prominent persistent warning appears: *"Network connection lost. Your marked roster is kept in memory. Do not close or refresh this page. [Retry Submission]"*.
  6. If teacher attempts to leave or refresh page before saving, browser `beforeunload` warning alerts: *"You have unsaved attendance changes. If you leave, your changes will be lost."*
  7. When connectivity returns, teacher clicks `Review & Submit Attendance`.
  8. A confirmation modal displays the names of absent students to prevent accidental misreporting.
  9. Teacher confirms and clicks `Finalize Attendance`.
* **Screens Involved:** Homeroom Attendance Register (`/attendance/register`).
* **Permissions:** `Teacher` (assigned to section), `Principal`, `SchoolAdmin`.
* **Validation Rules:**
  - Date cannot be in the future.
  - Mandatory confirmation modal showing absent student names before commit.
  - Prevents accidental duplicate submission.
  - IndexedDB and background sync are deferred; in-memory preservation active while page is open.
* **Success State:** Attendance committed atomically; status badge updates to `Submitted (38 Present, 2 Absent)`.

---

### Journey 08: Academic Year Rollover Promotion Review Wizard (OD-01, Release 1)
* **Actor:** School Admin / Principal
* **Goal:** Execute a controlled, auditable cohort promotion from current academic year to the next session.
* **Starting Point:** Academic Sessions (`/admin/academic-years`) -> `Promotion & Rollover Wizard`.
* **Step-by-Step Flow:**
  1. Admin selects Source Academic Year (`2025–2026`) and Target Academic Year (`2026–2027`).
  2. Selects Grade Level (e.g. `Grade 8`) to review.
  3. Promotion Review Table loads showing all currently enrolled students, current section, proposed target class (`Grade 9`), and promotion status.
  4. System highlights students requiring review: students with academic holds, attendance review flags, or incomplete documentation.
  5. Admin reviews proposed assignments, adjusts target sections where necessary, and flags students held back for review.
  6. Admin clicks `Review Promotion Summary`. A modal displays: *"Promoting 38 students from Grade 8 to Grade 9. 2 students retained for review. Target sections have sufficient capacity."*
  7. Admin provides explicit confirmation.
  8. Backend executes atomic promotion transaction, creating new enrollment records in `sis.student_enrollments` while preserving historical records.
* **Screens Involved:** Academic Year Rollover Wizard (`/admin/academic-years/rollover`).
* **Permissions:** `SchoolAdmin`, `Principal`.
* **Validation Rules:**
  - No blanket automatic promotion; requires explicit administrative review and final confirmation.
  - Target sections must not exceed maximum seating capacity.
  - Generates immutable audit log with administrator ID, timestamp, and cohort counts.
  - Historical enrollment records remain intact for prior academic years.
* **Success State:** Cohorts promoted to new session; previous year records preserved in read-only state.

---

### Journey 09: Parent Reviewing Attendance with Persistent Child Selector (OD-03, Release 2)
* **Actor:** Parent / Guardian (Rajesh Sharma)
* **Goal:** Review attendance and circulars for linked children using a persistent child selector.
* **Starting Point:** Parent Portal (`/parent`).
* **Step-by-Step Flow:**
  1. Parent logs into the Parent Portal.
  2. **Child Selector (OD-03):** Header displays a persistent child indicator showing explicitly linked children: `[Aarav Sharma (Grade 8-A) ▾]`.
  3. Parent views Aarav's attendance summary and monthly calendar.
  4. Parent clicks the child selector pill and switches to `Bhavna Sharma (Grade 3-B)`.
  5. UI immediately updates: all child-specific views (attendance, notices, timetable, fees) re-query for Bhavna. Cached data from Aarav is discarded to prevent cross-child data leakage.
  6. Backend validates that the authenticated parent has an active link to Bhavna in `sis.student_guardians`; never trusts client-supplied parameters alone.
* **Screens Involved:** Family Overview (`/parent`), Child Attendance (`/parent/attendance`).
* **Permissions:** `Parent` role strictly scoped to explicitly linked children.
* **Success State:** Clear view of individual child records with zero data leakage between siblings.

---

### Journey 10: Student Viewing Timetable & Homework (Release 2)
* **Actor:** Student (Aarav Sharma)
* **Goal:** Check daily class timetable and homework tasks.
* **Starting Point:** Student Portal (`/student`).
* **Step-by-Step Flow:**
  1. Student logs in. Dashboard displays today's class schedule and pending homework.
  2. Student reviews assignment instructions and due date.
  3. Toggles personal completion checkbox upon finishing homework.
* **Screens Involved:** Student Dashboard (`/student`), Timetable (`/student/timetable`), Homework (`/student/homework`).
* **Permissions:** `Student` role strictly scoped to self.
* **Success State:** Schedule and tasks clearly visible without administrative or parent controls.

---

### Journey 11: Fee Recording with Controlled Concessions (OD-04, Release 2)
* **Actor:** Accountant (Cashier)
* **Goal:** Record a fee payment and apply an authorized fee concession at the counter desk.
* **Starting Point:** Cashier Counter Desk (`/finance/counter`).
* **Step-by-Step Flow:**
  1. Looks up student by admission number. Student fee installments load.
  2. Parent requests sibling concession.
  3. **Concession Workflow (OD-04):** Accountant selects from pre-approved concession categories: `Sibling Discount (10%)`.
  4. System validates that the concession does not exceed configured limits and applies reduction to applicable tuition fee head.
  5. If parent requests an exceptional manual waiver (e.g. late fee waiver), the cashier submits a waiver request. The waiver is marked `Pending Principal Approval` and cannot be settled until the Principal authorizes it.
  6. Accountant records payment method: `Cash`, `Cheque`, `Bank Transfer`, or `UPI Reference`.
  7. Payment total recalculates: $\text{Amount Due} = \text{Billed Fee} - \text{Approved Concession}$.
  8. Clicks `Record Payment & Generate Receipt`.
* **Screens Involved:** Cashier Counter Desk (`/finance/counter`), Fee Concessions Modal (`/finance/concessions`).
* **Permissions:** `Accountant` (apply approved categories), `Principal`/`SchoolAdmin` (approve exceptional waivers).
* **Validation Rules:**
  - Cashiers cannot apply unapproved ad-hoc discounts without administrative approval.
  - Concession record logs concession type, amount/%, student, fee head, requesting cashier, and approving administrator.
  - Historical cleared payment records cannot be altered.
* **Success State:** Payment recorded, receipt issued with concession noted, ledger updated.

---

### Journey 12: Basic Staff Leave Request & Approval (Release 2)
* **Actor:** Teacher / Staff Member & Principal
* **Goal:** Submit a leave request and have it reviewed by the campus academic head.
* **Starting Point:** Teacher Portal (`/teacher/leave`).
* **Step-by-Step Flow:**
  1. Teacher navigates to Leave Requests and clicks `+ New Leave Request`.
  2. Enters Start Date, End Date, Leave Type (`Sick Leave`, `Casual Leave`), and Reason text.
  3. Clicks `Submit Leave Request`. Status turns yellow `Pending`.
  4. Principal receives notification on Principal Dashboard and opens Staff Leave Approval (`/admin/staff/leave`).
  5. Principal reviews request details, verifies coverage, and clicks `Approve` (or `Reject` with reason note).
  6. Status updates to green `Approved`. Teacher's leave history reflects the decision and approver identity.
* **Screens Involved:** Staff Leave Request (`/teacher/leave`), Administrative Leave Approval (`/admin/staff/leave`).
* **Permissions:** Staff member (creates request), `Principal` / `SchoolAdmin` (reviews and decides).
* **Validation Rules:**
  - Start date must precede or equal End date.
  - Full audit logging of submission timestamp, approver, decision timestamp, and decision notes.
  - Excludes payroll salary calculations or automated substitute teacher reassignments.
* **Success State:** Leave request processed with clear audit trail.
