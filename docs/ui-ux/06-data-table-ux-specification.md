# Document 06: Enterprise Data-Table UX Specification & Operational Registers

**Document Status:** APPROVED DATA TABLE SPECIFICATION  
**Classification:** Enterprise Data-Table Ergonomics, Large Datasets & Performance Engineering  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  

---

## 1. Executive Summary & Table Philosophy

In a School Management SaaS, data tables are the primary clerical and administrative workhorse. Registrars, bursars, teachers, and principals spend hours scanning student registers, reconciling fees, and recording attendance.

### Core Architectural Mandates:
1. **Never Load Unbounded Datasets:** Data tables operate strictly over server-side pagination, sorting, and filtering. The client never pulls thousands of records into browser memory merely to paginate in the DOM.
2. **Native Semantic HTML First:** Standard registers render natively using accessible HTML elements (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`). This guarantees out-of-the-box keyboard accessibility, screen-reader compatibility, and zero external bundle overhead.
3. **Virtualization Policy:** Complex virtual scrolling libraries (e.g. TanStack Virtual) are **not** mandated for standard paginated registers (25–50 rows/page). Virtualization should only be evaluated as an optional enhancement if a specific view requires continuous unpaginated scrolling > 100 rows and demonstrates measurable browser frame drops.
4. **Persistent Identification:** Primary identifiers (Checkbox + Student Name + Roll Number / Admission Number) remain pinned (`position: sticky; left: 0`) during horizontal scrolling across wide records.
5. **Configurable Row Density:** Provide 3 row density modes (Compact, Default, Comfortable) so users can tailor the display to their monitor and workflow.

---

## 2. Reusable Enterprise Data-Table Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Filter by Class ▾] [Section ▾] [Status: Active ▾]  [Density: Compact ▾] [Columns ▾]       [🔍 Search name, roll, ID] │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [✓] 42 students selected on this page   |   [Mark Attendance] [Assign Section] [Export CSV]     [Deselect All (Esc)]   │
├────┬──────┬────────────────────────┬──────────┬──────────────┬──────────────┬────────────┬───────────┬────────────────┤
│[✓] │Roll#▲│Student (Pinned Left)   │Class-Sec │Primary Parent│Contact Phone │Fee Status  │Attendance │Actions (Pinned)│
├────┼──────┼────────────────────────┼──────────┼──────────────┼──────────────┼────────────┼───────────┼────────────────┤
│[✓] │01    │👤 Aarav Sharma         │8th - A   │Rajesh Sharma │+91 9876543210│[Paid]      │96.4%      │[View] [Edit][⋮]│
│[✓] │02    │👤 Ananya Rao           │8th - A   │Sunita Rao    │+91 9845011223│[Due ₹2,000]│91.2%      │[View] [Edit][⋮]│
│[ ] │03    │👤 Bhavya Reddy         │8th - A   │K. V. Reddy   │+91 9701234567│[Paid]      │98.0%      │[View] [Edit][⋮]│
│[ ] │04    │👤 Devansh Gupta        │8th - A   │Pooja Gupta   │+91 9988776655│[Overdue]   │78.5% ⚠️   │[View] [Edit][⋮]│
├────┴──────┴────────────────────────┴──────────┴──────────────┴──────────────┴────────────┴───────────┴────────────────┤
│ Showing 1 to 50 of 420 students        |   Rows per page: [ 50 ▾ ]        |   [⏮ First] [◀ Prev] Page 1 of 9 [Next ▶]   │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Core Functional Capabilities

### 3.1 Density Modes
Users can adjust vertical padding via CSS variable switching:
- **Compact (34px row height):** Designed for high-speed administrative scanning, large rosters, and audit reviews.
- **Default (44px row height):** Standard mode for daily management, balancing readability with density.
- **Comfortable (54px row height):** Optimized for touch tablets, student views, and parent self-service.

### 3.2 Sticky Architecture & Pinned Columns
- **Sticky Table Header:** The `<thead>` row remains pinned at `top: 0` with a crisp bottom border during vertical scrolling.
- **Pinned Identification Column (Left):** Checkbox + Roll Number + Student Name/ID stay pinned at `left: 0` (`z-index: 2`) while secondary attributes scroll horizontally.
- **Pinned Actions Column (Right):** Action buttons stay pinned at `right: 0` (`z-index: 2`) so operators can trigger actions without scrolling back.

### 3.3 Server-Side Pagination & Slicing
- **Default Page Size:** 50 records.
- **Selector Options:** `25`, `50`, `100` records per page.
- **Query Parameter Contract:**
  ```http
  GET /api/v1/students?page=2&limit=50&sort_by=roll_number&sort_order=asc&status=active
  ```

### 3.4 Multi-Facet Server-Side Filtering & Debounced Search
- **Search Scope:** Matches indexed fields (Student Legal Name, Admission Number, Roll Number, Guardian Phone Number) within the user's authorized tenant/branch purview.
- **Debounce:** 250ms debounce window prevents redundant API roundtrips during typing.
- **Loading State:** Subtle inline spinner signals query activity without freezing existing rows.

### 3.5 Column Visibility
- Users can toggle optional columns via a **"Columns"** dropdown (e.g. show/hide *Blood Group*, *Emergency Phone*, *Bus Route*).
- Settings are saved locally in browser `localStorage`.
- Primary identification columns (*Student Name*, *Roll No*) cannot be toggled off.

### 3.6 Batch Selection & Contextual Action Bar
When one or more rows are selected:
1. The filter bar is replaced by a high-visibility **Batch Action Bar**.
2. Displays selected count: *"42 students selected on this page"*.
3. **Batch Actions (Stage 1 Scope):**
   - `Mark Attendance (Batch)` (Release 1)
   - `Assign to Section` (Release 1)
   - `Export Filtered to CSV` (Release 1)
4. **Safety Rule:** Destructive actions (*Withdraw*, *Deactivate*) require explicit confirmation text in a modal dialog.

---

## 4. Practical Specifications for Major School Registers

### 4.1 Master Student Directory (`/students`) — Release 1
- **Primary Persona:** SchoolAdmin, Principal, Registrar.
- **Key Columns:** Select Checkbox, Roll No, Student Name + Admission No (Pinned), Class/Section, Primary Guardian + Contact, Status Badge, Actions.
- **Key Actions:** `+ New Admission`, `Export CSV`, `View Dossier`, `Edit Details`.

### 4.2 Daily Homeroom Attendance Register (`/attendance/register`) — Release 1
- **Primary Persona:** Class Teacher.
- **Key Columns:** Roll No, Student Photo + Name (Pinned), Status Toggles (`Present`, `Absent`, `Late`), Inline Reason / Remarks.
- **Interaction Model:**
  - `Pre-fill All Present` button updates roster with clear visual unsaved changes banner.
  - Arrow keys navigate between student rows.
  - Absence reason input auto-focuses when `Absent` is selected.
  - **Explicit Confirmation:** Review summary modal appears before final submission (showing total present and absent counts).
  - **In-Memory Offline Handling (OD-02):** Unsubmitted attendance is temporarily kept in browser memory during network drops. Displays a clear persistent offline alert with a manual retry button. Clear saved, unsaved, and failed states. Explicit `beforeunload` warning alerts teacher if navigating or closing page with unsaved changes. Prevents duplicate submission. Complex IndexedDB and background sync are explicitly deferred.

### 4.3 Staff & Faculty Directory (`/staff`) — Release 1
- **Primary Persona:** SchoolAdmin, Principal.
- **Key Columns:** Staff ID, Employee Name (Pinned), Role Badge (`Teacher`, `Accountant`, `Principal`), Assigned Classes/Subjects, Contact Phone, Status, Actions (`Edit`, `Invite`).

### 4.4 Classes & Sections Roster (`/academics/classes`) — Release 1
- **Primary Persona:** SchoolAdmin, Principal.
- **Key Columns:** Grade Name, Section Code, Assigned Class Teacher, Seating Capacity Progress Bar (`Enrolled / Max`), Room Number, Actions (`Manage Section`, `Student Roster`).

### 4.5 Academic Year Promotion Review Table (`/admin/academic-years/rollover`) — Release 1 (OD-01)
- **Primary Persona:** SchoolAdmin, Principal.
- **Key Columns:** Select Checkbox, Student ID, Legal Full Name, Current Grade/Section, Proposed Target Grade/Section, Status Flag (`Eligible`, `Review Hold`, `Promoted`), Actions (Inline Target Section Override).
- **Capabilities:**
  - Controlled administrative promotion review workflow.
  - Highlights students requiring review (academic holds, attendance flags, administrative holds).
  - Allows inline corrections before confirmation.
  - Mandatory confirmation modal showing cohort counts before atomic database commit.
  - Immutable audit trail recording administrator ID, timestamp, and promoted counts.
  - Preserves historical academic-year records.

### 4.6 Student Bulk Import Validation Table (`/students/import`) — Release 1
- **Primary Persona:** SchoolAdmin.
- **Key Columns:** Row #, Admission No, Full Name, Grade, Section, Guardian Phone, Validation Status (`Valid` [✓ Green], `Error` [⚠ Red]), Error Details.
- **Capabilities:**
  - Client-side and server-side row-level spreadsheet validation.
  - Duplicate detection against active tenant student records.
  - Inline error highlights showing exact invalid fields.
  - Action buttons: `Import Valid Rows`, `Download Error Report`, `Cancel`.

### 4.7 Cashier Fee Counter Desk (`/finance/counter`) — Release 2
- **Primary Persona:** Accountant.
- **Layout:** Two-pane interface (Student Search & Installment Checklist on left; Payment Details & Receipt Generator on right).
- **Key Columns:** Fee Category, Installment Due Date, Amount Due, Concession, Net Payable, Selection Checkbox.
- **Controlled Concessions (OD-04):**
  - Cashier selects from pre-approved concession categories (Sibling, Staff Child, Merit) within configured limits.
  - Exceptional manual fee waivers require Principal or SchoolAdmin authorization before payment settlement.
  - Full audit logging of requester, approver, and rationale.
- **Output:** Immediate printable institutional receipt voucher (standard A4 print stylesheet).

### 4.8 Basic Staff Leave Requests Table (`/admin/staff/leave`) — Release 2
- **Primary Persona:** Principal, SchoolAdmin.
- **Key Columns:** Staff Name, Department/Role, Leave Type (`Sick`, `Casual`), Start Date, End Date, Total Days, Reason Text, Request Status (`Pending`, `Approved`, `Rejected`), Approver, Actions (`Approve`, `Reject`).
- **Capabilities:**
  - Administrative review and authorization queue for staff leave requests.
  - Approval modal allows entering review notes.
  - Full historical audit trail; excludes payroll deductions or automated substitute scheduling.
