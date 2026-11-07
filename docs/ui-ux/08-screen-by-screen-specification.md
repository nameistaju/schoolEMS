# Document 08: Screen-by-Screen Detailed Specifications

**Document Status:** APPROVED SCREEN SPECIFICATION  
**Classification:** Enterprise UX Architecture & Engineering Contracts  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  
**Governing Standard:** `docs/ENGINEERING_STANDARDS.md` & Approved Operational Decisions (OD-01 to OD-05)  
**Accessibility Engineering Target:** W3C WCAG 2.2 Level AA  

---

## 1. Specification Framework

Every screen in this document is specified across **12 architectural dimensions**:
1. **Screen Purpose:** Clear statement of operational objective.
2. **Intended User Roles:** Canonical roles permitted to view and interact.
3. **Release Milestone:** Stage 1 Release 1 vs. Stage 1 Release 2.
4. **Layout Structure:** Wireframe layout grid, cards, and canvas distribution.
5. **Navigation:** Breadcrumbs, active rail item, and context anchors.
6. **Main Content & Registers:** Core visual, tabular, and textual components.
7. **Actions & Keyboard Ergonomics:** Primary, secondary, and shortcut triggers.
8. **Validation & Safety Rules:** Input constraints, unsaved-change guards, confirmation modals.
9. **Data Requirements & Permissions:** Underlying entities, API contracts, and RBAC keys.
10. **State Handling:** Loading skeletons, empty guides, offline alerts, and error states.
11. **Responsive Behavior:** Desktop vs. Tablet vs. Mobile adaptations.
12. **Acceptance Criteria:** Verifiable test assertions for review.

---

## 2. Core Operational Screen Blueprints

---

### SCREEN 01: Master Student Directory (`SCR-ADM-07`) — Release 1

#### 1. Screen Purpose
The central operational registry for school administrators, principals, and registrars to search, filter, inspect, and batch-operate on enrolled students.

#### 2. Intended Roles & Release
- `SchoolAdmin`, `Principal`.
- **Release Milestone:** Stage 1 Release 1.

#### 3. Layout Structure
- **Header Section:** Page Title (*"Student Directory"*), Branch pill (*"Main Campus"*), and Primary Action button (*"+ New Admission"*).
- **Filter Toolbar:** Class dropdown, Section dropdown, Status toggle (`Active`, `Withdrawn`), Density selector, and debounced search box.
- **Batch Action Bar:** Hidden by default; animates into view when $\ge 1$ checkbox is selected.
- **Main Canvas:** High-density data table with sticky header and pinned identification columns.
- **Footer:** Server-side pagination controls, record range indicator, and rows-per-page selector.

#### 4. Navigation
- Breadcrumb: `Operations > Students > Master Directory`
- Active Rail Item: `👥 Students`
- Context Anchor: Active School and Academic Session (`2026–2027`).

#### 5. Main Content & Register Columns
```
Columns:
1. [✓] Selection Checkbox (Pinned Left)
2. Roll Number (Pinned Left, Sortable, Tabular figures)
3. Student Identification: Photo Avatar + Full Legal Name + Adm# (Pinned Left, Sortable)
4. Class & Section (e.g. "8th - A")
5. Primary Guardian: Full Name + Relationship (e.g. "Rajesh Sharma (Father)")
6. Guardian Phone: Tabular figures
7. Fee Status: Semantic Badge (`[✓ Paid]` Green, `[Due ₹2,000]` Amber, `[Overdue]` Red) - [Release 2 data]
8. Attendance %: Rolling Term Attendance Percentage (`96.4%`)
9. Actions (Pinned Right): `[View]` button, `[⋮]` Context Menu
```

#### 6. Actions
- **Primary:** `+ New Admission` (opens `/students/admit`).
- **Secondary:** `Import Students` (opens `/students/import`), `Export Filtered to CSV`.
- **Row-Level Actions:** `View Dossier` (direct link), `Quick Edit` (opens right drawer), `More (⋮)`.
- **Batch Actions:** `Assign Section`, `Export Selected to CSV`.

#### 7. Validation & Safety Rules
- Destructive actions (*Withdraw*, *Deactivate*) require explicit confirmation text in a modal dialog.
- National ID numbers display only as masked tokens (`●●●● ●●●● 8192`).

#### 8. Data & Permissions
- Endpoint: `GET /api/v1/students?page=1&limit=50&branch_id=...`
- Permissions: `SchoolAdmin`, `Principal`. Tenant/branch isolation enforced on backend.

#### 9. State Handling & Responsive Behavior
- **Loading:** 8-row table skeleton with pulsing placeholders.
- **Empty:** Clean guide with `[Reset Filters]` and `[+ New Admission]` CTA.
- **Responsive:** Tables render with pinned identification on desktop/tablet; transform to structured cards below 768px.

#### 10. Acceptance Criteria
- [ ] Table renders paginated rows without horizontal layout clipping.
- [ ] Searching input debounces network calls by 250ms.
- [ ] Sorting by Roll Number executes server-side and preserves active filter state.
- [ ] Pinned columns stay locked during horizontal scroll.

---

### SCREEN 02: Cumulative Student Dossier (`SCR-ADM-09`) — Release 1

#### 1. Screen Purpose
Consolidates a student's institutional record (demographics, photograph, family network, academic enrollments, attendance, and segregated health notes) into an integrated tabbed dossier.

#### 2. Intended Roles & Release
- `SchoolAdmin`, `Principal`, `Teacher` (limited to academic and emergency data), `Accountant` (limited to fee tab in Release 2).
- **Release Milestone:** Stage 1 Release 1.

#### 3. Layout Structure
- **Student Hero Banner (Pinned Top):** Photo avatar (uploaded via OD-05), Legal Full Name, Admission Number, Roll Number, Class/Section, Current Academic Status.
- **Emergency Alert Callout:** High-contrast non-color warning for severe allergies (`⚠️ Allergy Notice`).
- **Horizontal Tab Navigation:**
  1. *Demographics & Residential* (Release 1)
  2. *Academic Enrollment History* (Release 1)
  3. *Attendance Register* (Release 1)
  4. *Family Network & Guardians* (Release 1)
  5. *Health & Verified Documents* (Release 1 - RBAC Gated)
  6. *Fee Ledger & Invoices* (Release 2)

#### 4. Actions
- `Edit Student Information` (opens slide-over drawer).
- `Print Student Summary` (clean browser print layout).
- `Record Absence Note`.

#### 5. Permissions & Confidentiality
- General tabs: `SchoolAdmin`, `Principal`, `Teacher`.
- Health tab: Restricted strictly to `Principal` and designated campus medical officer. Unauthorized roles receive an explicit access restricted card; accessing confidential records generates an immutable audit log entry.
- National ID displays only as verified last-4 digits (`●●●● ●●●● 8192`).

#### 6. Acceptance Criteria
- [ ] Voluntary National ID displays only as masked format (`●●●● ●●●● 8192`).
- [ ] Accessing confidential health records creates an audit log entry.
- [ ] Tab switching retains browser URL query state (`?tab=attendance`).

---

### SCREEN 03: Daily Homeroom Attendance Register with In-Memory Offline Handling (`SCR-TCH-01`) — Release 1 (OD-02)

#### 1. Screen Purpose
Allows classroom teachers to mark daily attendance for their assigned section with speed, safety, and offline resilience.

#### 2. Intended Roles & Release
- `Teacher` (assigned class teacher), `Principal`, `SchoolAdmin`.
- **Release Milestone:** Stage 1 Release 1.

#### 3. Layout Structure
- **Header:** Class & Section Selector, Date Picker (defaults to today), Attendance Status Badge (`Unmarked`, `Unsaved Changes`, `Submitted`).
- **Summary Counters:** Total Enrolled (`40`), Marked Present (`38`), Marked Absent (`2`), Marked Late (`0`).
- **Fast Action Bar:** `[Pre-fill All Present]`.
- **Register Table:** Roster of students with accessible status toggle buttons (`Present` [P] / `Absent` [A] / `Late` [L]) and inline remarks.
- **Submission Footer:** `[Cancel]` and `[Review & Submit Attendance]`.

#### 4. Actions & Keyboard Ergonomics
- `Pre-fill All Present`: Sets all students in roster to Present, displays an unsaved-changes notice.
- Arrow keys (`ArrowUp` / `ArrowDown`): Move active focus between student rows.
- Status Toggles (`P`, `A`, `L`): Set status for currently focused student.
- Setting status to `Absent` automatically moves focus to the optional remarks field.
- `Review & Submit Attendance`: Opens mandatory pre-submission confirmation review modal.

#### 5. In-Memory Offline Handling (OD-02)
- **Release 1 In-Memory Scope:** If network drops during marking, unsubmitted attendance remains preserved in browser memory.
- **Persistent Offline Banner:** Displays a prominent, high-visibility alert: *"Network connection lost. Your marked roster is kept in memory. Do not close or refresh this page. [Retry Submission]"*.
- **Unsaved Changes Exit Guard:** If the teacher attempts to close or refresh the tab with unsubmitted changes, browser `beforeunload` warning alerts: *"You have unsaved attendance changes. If you leave, your changes will be lost."*
- **State Indicators:** Clear visual states for `Saved`, `Unsaved Changes`, and `Submission Failed`.
- **Manual Retry:** Provides an explicit `[Retry Submission]` button when connectivity returns.
- **Duplicate Prevention:** Disables submit trigger while request is in flight to prevent duplicate submissions.
- **Explicit Deferrals:** Complex IndexedDB persistence, background service-worker synchronization, and automatic conflict resolution are deferred beyond Release 1.

#### 6. Confirmation Review Modal & Validation Rules
- Date cannot be in the future.
- **Mandatory Confirmation Modal:** Displays: *"You are submitting attendance for Class 8-A: 38 Present, 2 Absent. Please confirm absent students: Ananya Rao (Roll 02), Devansh Gupta (Roll 04)"*. Teacher must confirm before atomic PostgreSQL commit.
- Reversibility: Authorized teachers or principals can correct marked records with audit logging.

#### 7. Acceptance Criteria
- [ ] Pre-fill action marks roster as Present and displays unsaved changes warning.
- [ ] Confirmation modal appears prior to final database commit displaying absent names.
- [ ] Dropping connection preserves marked state in memory and displays offline alert with manual retry button.
- [ ] Closing or refreshing tab with unsaved changes triggers browser warning guard.
- [ ] Future date selection is disabled and rejected by client validation.

---

### SCREEN 04: Academic Year Rollover & Promotion Review Wizard (`SCR-ADM-18`) — Release 1 (OD-01)

#### 1. Screen Purpose
Provides a controlled, auditable administrative workflow for reviewing student eligibility and executing cohort promotions across academic years.

#### 2. Intended Roles & Release
- `SchoolAdmin`, `Principal`.
- **Release Milestone:** Stage 1 Release 1.

#### 3. Layout Structure
- **Header:** Source Academic Year Selector (`2025–2026`), Target Academic Year Selector (`2026–2027`), Grade Level Selector (e.g. `Grade 8`).
- **Summary Banner:** Total Enrolled (`120`), Eligible for Promotion (`116`), Flagged for Review (`4`), Target Capacity Available (`140`).
- **Promotion Review Table:**
  ```
  Columns:
  1. [✓] Select Checkbox
  2. Student ID & Legal Full Name
  3. Current Grade & Section (e.g. "Grade 8 - Section A")
  4. Proposed Target Grade & Section (e.g. "Grade 9 - Section A") [Dropdown override]
  5. Status / Hold Flag:
     - `Eligible` [✓ Green]
     - `Academic Hold` [⚠ Amber]
     - `Attendance Hold` [⚠ Amber]
     - `Administrative Review` [ℹ Blue]
  6. Review Notes / Action
  ```
- **Footer:** `[Cancel]`, `[Export Cohort List]`, `[Review & Confirm Promotion]`.

#### 4. Controlled Promotion Workflow (OD-01)
1. Displays eligible students and their current class/section.
2. Allows authorized administrators to review and adjust proposed next-year section assignments.
3. Prominently highlights students requiring review or having holds.
4. Allows inline corrections and section overrides before confirmation.
5. **Mandatory Final Confirmation Modal:** Displays summary: *"Promoting 116 students from Grade 8 to Grade 9. 4 students held for review. Target sections have sufficient capacity. Confirm cohort rollover?"*.
6. Executes atomic database transaction creating new enrollment records in `sis.student_enrollments`.
7. Preserves historical enrollment records across prior academic years.
8. Generates immutable audit log recording executing administrator, timestamp, and affected cohort counts.
9. Prevents accidental duplicate or partial promotion through uniqueness constraints on `(tenant_id, student_id, academic_year_id)`.
10. Explicitly excludes automatic blanket promotion or complex prerequisite scoring systems.

#### 5. Acceptance Criteria
- [ ] Eligible students and current class/sections render accurately from database.
- [ ] Students with holds are prominently highlighted with actionable review flags.
- [ ] Admin can override proposed section assignments inline.
- [ ] Confirmation modal appears with exact cohort breakdown before final commit.
- [ ] Historical enrollment records remain intact for prior academic years.
- [ ] Duplicate promotion attempts are rejected with clear error alert.

---

### SCREEN 05: Student Admission with Photograph Upload (`SCR-ADM-08`) — Release 1 (OD-05)

#### 1. Screen Purpose
Guides registrars through student intake with demographic entry, guardian linking, section placement, and verified photograph upload.

#### 2. Intended Roles & Release
- `SchoolAdmin`, `Principal`.
- **Release Milestone:** Stage 1 Release 1.

#### 3. Step-by-Step Wizard Layout
- **Step 1: Student Demographics & Photo Upload (OD-05):**
  - Demographics: Legal Full Name, Date of Birth, Gender, Blood Group, Voluntary Alternative National ID.
  - **Photograph Upload Interaction (OD-05):**
    - Drag-and-drop / file selector box supporting standard image files (`image/jpeg`, `image/png`).
    - Enforces maximum file size limit (max 2MB) with immediate validation feedback.
    - Displays instantaneous aspect-ratio preview (3:4 passport ratio).
    - Clear action controls: `Upload Photo`, `Replace Photo`, `Remove Photo`.
    - Loading shimmer during file reading; error state for invalid mime types or oversize files.
    - Photograph access restricted strictly to authorized school staff; images stored locally under `uploads/sis/` with UUID hashing and binary magic byte validation.
    - Explicitly defers webcam hardware capture.
- **Step 2: Guardian Linking:**
  - Guardian lookup by phone/email or creation of new guardian profile with relationship and custody status.
- **Step 3: Academic Placement:**
  - Academic year selection, grade level, and section picker (with real-time seating capacity progress bar).
- **Step 4: Review & Matriculation:**
  - Complete admission summary card with sequential admission number preview.

#### 4. Acceptance Criteria
- [ ] Image upload validates file type (JPEG/PNG only) and rejects files > 2MB with clear error.
- [ ] Uploaded image renders instant preview with clear replace and remove buttons.
- [ ] Voluntary national ID fields do not require Aadhaar and accept alternative ID types.
- [ ] Form exit guards alert user before discarding unsaved intake data.

---

### SCREEN 06: Academic Calendar & Events Grid (`SCR-ADM-16`) — Release 1

#### 1. Screen Purpose
Provides a central institutional calendar displaying term dates, school holidays, vacations, and campus events.

#### 2. Intended Roles & Release
- Manage: `SchoolAdmin`, `Principal`.
- Read-Only View: `Teacher`, `Student`, `Parent`.
- **Release Milestone:** Stage 1 Release 1.

#### 3. Layout Structure
- **Header:** Academic Session Selector (`2026–2027`), Branch Filter, Month/Term Navigation (`⏮ Previous`, `Next ⏭`, `Today`).
- **View Switcher:** `Month Grid View` vs. `Chronological Agenda View`.
- **Calendar Canvas:** 7-column month grid (Monday–Sunday) with event chips:
  - `Holidays` [Green pill] (e.g. *"Independence Day"*)
  - `Vacations` [Amber pill] (e.g. *"Term 1 Break"*)
  - `Academic Dates` [Blue pill] (e.g. *"Session Start"*)
  - `Campus Events` [Purple pill] (e.g. *"Sports Meet"*)
- **Management Drawer:** `+ Add Calendar Event` opens right slide-over to specify Title, Category, Start Date, End Date, Branch Scope, and Description.

#### 4. Rules & Explicit Exclusions
- Events must fall within the active academic year boundary.
- Read-only viewing on Teacher, Student, and Parent dashboards.
- Explicitly excludes complex examination scheduling or third-party Google/Outlook calendar integrations.

#### 5. Acceptance Criteria
- [ ] Calendar renders correct day matrix for selected month and academic session.
- [ ] Holidays and campus events display with distinct semantic color pills.
- [ ] Unauthorized roles (students, parents) cannot access event creation or edit controls.

---

### SCREEN 07: Student Bulk Import Wizard (`SCR-ADM-17`) — Release 1

#### 1. Screen Purpose
Enables school administrators to import student cohort data in bulk via standard CSV or XLSX spreadsheets with client-side validation.

#### 2. Intended Roles & Release
- `SchoolAdmin`.
- **Release Milestone:** Stage 1 Release 1.

#### 3. Workflow Steps
1. **Download Template:** Button to download standardized CSV template with validated column headers (`full_name`, `dob`, `gender`, `grade`, `section`, `guardian_name`, `guardian_phone`, `guardian_relationship`).
2. **File Upload:** Drag-and-drop zone with instant spreadsheet parsing.
3. **Interactive Validation Grid:** Displays parsed rows:
   - Green rows: Valid records ready for import.
   - Red rows: Invalid records with highlighted error cells (e.g. *"Invalid date format; use YYYY-MM-DD"*, *"Section 8-C does not exist"*).
   - In-flight duplicate detection against existing admission numbers.
4. **Action Controls:** `Import Valid Rows`, `Download Error Report (CSV)`, `Cancel`.
5. **Execution:** Atomic transaction inserting into `sis.students`, `sis.guardians`, and `sis.student_enrollments`.

#### 4. Safety & Multi-Tenant Boundaries
- Reuses existing student, guardian, and enrollment models without creating duplicate database schemas.
- Enforces strict tenant and branch scoping.
- Provides clear import summary report (Total Rows, Imported, Skipped).

#### 5. Acceptance Criteria
- [ ] Template download provides valid CSV structure matching system fields.
- [ ] Validation grid correctly flags invalid dates, missing phones, and duplicate entries.
- [ ] Successful import commits records atomically and updates school headcount.

---

### SCREEN 08: Cashier Fee Collection Counter Desk with Fee Concessions (`SCR-ACC-02`) — Release 2 (OD-04)

#### 1. Screen Purpose
Enables school accountants to look up a student, verify outstanding fee schedules, record payments, apply approved concessions, and issue printable institutional receipt vouchers.

#### 2. Intended Roles & Release
- `Accountant`, `SchoolAdmin`.
- **Release Milestone:** Stage 1 Release 2.

#### 3. Layout Structure
- **Two-Column Split Workspace:**
  - **Left Workspace (60%):** Quick Student Lookup, Student Summary Banner, and Installment Checklist.
  - **Right Workspace (40%):** Payment Summary Card, Concession Selector, Payment Method Selector, Reference Input, and Receipt Action.

#### 4. Controlled Fee Concessions Workflow (OD-04)
- **Predefined Concession Categories:** Cashier selects from pre-configured categories: `Sibling Discount (10%)`, `Staff Child (50%)`, `Merit Scholarship (Fixed ₹5,000)`.
- **Limit Enforcement:** Cashiers can only apply active, system-configured concession categories within pre-set limits.
- **Exceptional Manual Waivers:** If an ad-hoc fee waiver or late fee reduction is requested, the cashier submits an authorization request. The request is marked `Pending Principal Approval` and cannot be finalized until approved by the Principal or SchoolAdmin.
- **Audit Logging:** System logs concession type, amount or percentage, reason text, student ID, applicable fee head, requesting cashier, and approving administrator.
- **Balance Impact:** Concessions adjust the net payable balance in real-time:
  $$\text{Net Payable} = \text{Billed Fee} - \text{Approved Concession}$$
- **Historical Payment Protection:** Concessions strictly apply to outstanding dues; altering or discounting historical cleared payments is prohibited.
- **Explicit Exclusions:** Complex scholarship eligibility scoring, payroll deductions, and online payment gateways are deferred.

#### 5. Payment Recording & Receipt Generation
- Payment Methods: `Cash`, `Cheque`, `Bank Transfer`, `UPI Reference`.
- Enter transaction reference number (Bank UTR / Cheque number).
- Click `Record Payment & Generate Receipt`.
- Output: Standard browser printable A4 institutional receipt voucher with school seal and dual signatures.

#### 6. Acceptance Criteria
- [ ] Concession categories apply according to configured limits and recalculate balance.
- [ ] Ad-hoc manual waivers require Principal authorization before receipt issuance.
- [ ] Payment recording generates sequential immutable receipt number.
- [ ] Receipt voucher renders cleanly on standard A4 print stylesheets.

---

### SCREEN 09: Fee Concessions & Waivers Approval Desk (`SCR-ACC-07`) — Release 2 (OD-04)

#### 1. Screen Purpose
Provides school administrators and principals with a dedicated authorization desk to review, approve, or reject exceptional fee concessions and waivers.

#### 2. Intended Roles & Release
- `Principal`, `SchoolAdmin`.
- **Release Milestone:** Stage 1 Release 2.

#### 3. Register Columns
```
Columns:
1. Request ID & Submission Timestamp
2. Student Legal Name & Admission Number
3. Grade & Section
4. Applicable Fee Head (e.g. "Term 1 Tuition Fee")
5. Concession Category / Waiver Type (e.g. "Late Fee Waiver")
6. Requested Amount / Percentage (e.g. "₹500 Late Fee Waiver")
7. Requesting Cashier / Staff Member
8. Justification / Reason Text
9. Status: `Pending Approval` [Amber], `Approved` [Green], `Rejected` [Red]
10. Actions: `[Approve]` [Button], `[Reject]` [Button]
```

#### 4. Acceptance Criteria
- [ ] Principal can review pending waiver requests with justification notes.
- [ ] Approving a waiver immediately unlocks payment recording for the cashier.
- [ ] Rejecting a waiver logs decision note and notifies cashier desk.
- [ ] Full historical audit trail preserved.

---

### SCREEN 10: Parent Portal Family Overview with Persistent Child Selector (`SCR-PAR-01`) — Release 2 (OD-03)

#### 1. Screen Purpose
Self-service portal for parents and guardians to monitor linked children's daily attendance, view circulars, and check outstanding fee dues.

#### 2. Intended Roles & Release
- `Parent` / `Guardian`.
- **Release Milestone:** Stage 1 Release 2.

#### 3. Persistent Multi-Child Selector (OD-03)
- **Header Placement:** Persistent child indicator pill in the global header: `[👤 Aarav Sharma (Grade 8-A) ▾]`.
- **Strict Authorization:** Dropdown lists only children explicitly linked to the authenticated guardian in `sis.student_guardians`.
- **Context Continuity:** Selecting a child updates the active context across all parent-facing views (attendance, timetable, homework, fees).
- **Backend Enforced:** Every API request validates parent-to-child relationship; client selector is an ergonomic tool, never an authorization mechanism.
- **Cache Isolation:** Switching children immediately purges child-specific cached data to ensure zero cross-child information leakage.

#### 4. Main Content
- Attendance health summary card (attendance percentage and monthly heatmap).
- Today's homework checklist for the selected child.
- Fee dues summary card with link to view receipts.
- Institutional broadcast announcements feed.

#### 5. Acceptance Criteria
- [ ] Persistent child selector reflects all explicitly linked siblings.
- [ ] Switching child immediately re-queries data for selected child and clears old cache.
- [ ] Attempting to access an unlinked student ID returns `403 Forbidden`.

---

### SCREEN 11: Basic Staff Leave Request & Approval Desk (`SCR-TCH-06` / `SCR-ADM-19`) — Release 2

#### 1. Screen Purpose
Provides a transparent workflow for staff members to submit leave requests and for administrators to review and approve them.

#### 2. Intended Roles & Release
- Request: `Teacher`, `Accountant`, `Staff Member`.
- Approval: `Principal`, `SchoolAdmin`.
- **Release Milestone:** Stage 1 Release 2.

#### 3. Layout Structure
- **Teacher View (`/teacher/leave`):**
  - Personal leave history table: Leave Type, Start Date, End Date, Total Days, Status (`Pending`, `Approved`, `Rejected`), Approver Notes.
  - `+ New Leave Request` modal: Date pickers, Leave Type selector (`Sick`, `Casual`, `Personal`), Reason textarea.
- **Admin View (`/admin/staff/leave`):**
  - Staff leave review queue displaying all pending requests with staff name, role, dates, and reason.
  - Action buttons: `Approve` and `Reject` (with mandatory rejection reason input).

#### 4. Rules & Explicit Exclusions
- Start date must precede or equal End date.
- Maintains comprehensive audit history (requester, submission timestamp, approver, decision timestamp).
- Explicitly excludes payroll salary deductions, complex leave accrual algorithms, or automated substitute attendance reassignments.

#### 5. Acceptance Criteria
- [ ] Staff member can submit leave request with valid date range and reason.
- [ ] Request renders immediately in administrative approval queue.
- [ ] Approving or rejecting updates status badge and logs approver identity.
