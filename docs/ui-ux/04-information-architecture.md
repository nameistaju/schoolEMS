# Document 04: Information Architecture, Sitemap & Navigation

**Document Status:** APPROVED ARCHITECTURE SPECIFICATION  
**Classification:** Enterprise UX Architecture & Navigation Systems  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  

---

## 1. Information Architecture Philosophy

School software often overwhelms users by presenting sprawling hierarchical menus where every sub-module is visible simultaneously. SchoolEMS organizes navigation through **Context-Aware Tiered Navigation**:

1. **Role-Scoped Purviews:** The primary navigation rail exposes only routes permitted for the authenticated user's canonical role.
2. **Persistent Context Anchors:** Users always know their operational location via three persistent header selectors:
   - **School Organization Context** (Tenant)
   - **Campus Branch Context** (for multi-campus schools)
   - **Active Academic Session** (e.g. `2026–2027`)
3. **Flat Depth (Maximum 3 Levels):** Administrative workflows avoid excessive nesting:
   - Level 1: Global Navigation Rail (Module Group)
   - Level 2: Primary Master List or Register (Data Table View)
   - Level 3: Focused Entity Dossier (Tabbed Detail View) or Action Drawer

---

## 2. Global Application Shell Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🏫 SchoolEMS]   [Demo School ▾] [Main Campus ▾] [Session: 2026–2027 ▾]     [🔍 Search (Ctrl+K)]         [👤 Staff Name ▾]│
├───────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📊 Dashboard      │ Breadcrumb: Academics > Classes & Sections > Class 8-A                                             │
│ 👥 Students       │                                                                                                    │
│ 📅 Attendance     │ Class 8th - Section A                                                      [+ Add Student to Section]│
│ 🏫 Academic Setup ├────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 📢 Announcements  │ [All Students ▾]  [Attendance: Morning ▾]                 [🔍 Search student by name or roll no...]│
│ ⚙️ Settings       │                                                                                                    │
│                   │ ┌────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ [◀ Collapse Rail] │ │ (Enterprise Data Table / Attendance Register / Dossier Work Area)                              │ │
│                   │ └────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Master Route Taxonomy by Release Phase

The route taxonomy strictly respects the approved **Stage 1 MVP Scope**:

### Phase 1 & Release 1: Core Institutional Foundation

```http
# --- Public & Authentication Routes ---
/login                                    # Multi-Tenant Sign In & Demo Selector
/register                                 # Tenant Registration (Initial Admin)

# --- Platform SuperAdmin Routes ---
/platform/dashboard                       # SaaS Health & Metrics Overview
/platform/schools                         # Master Tenant Directory
/platform/schools/:id                     # Tenant Inspection & Domain Management
/platform/audit-logs                      # Platform Security & Access Logs

# --- School Administration & Operations ---
/admin/dashboard                          # Institutional Operations Pulse
/admin/branches                           # Campus Branch Setup & Configuration
/admin/academic-years                     # Academic Sessions & Term Dates
/admin/academic-years/rollover            # Academic Year Rollover & Promotion Wizard (OD-01)
/admin/calendar                           # Academic Calendar & Campus Events Grid
/admin/settings                           # School Branding & Policies
/admin/audit-logs                         # Institutional Audit Trail

# --- Academic Structure ---
/academics/classes                        # Grade Levels & Section Capacities
/academics/classes/:classId/sections/:secId # Section Roster & Room Setup
/academics/subjects                       # Curriculum Subjects Catalog
/academics/assignments                    # Class Teacher & Subject Allocations

# --- Student Information System (SIS) ---
/students                                 # Master Student Directory (Data Grid)
/students/admit                           # Multi-Step Admission Wizard with Photo Upload (OD-05)
/students/import                          # Student Bulk Import Wizard (CSV/XLSX)
/students/:id                             # Cumulative Student Dossier
/students/:id?tab=demographics            # Tab 1: Personal & Residential Profile
/students/:id?tab=academics               # Tab 2: Enrollment History & Roll Numbers
/students/:id?tab=attendance              # Tab 3: Historical Attendance Register
/students/:id?tab=guardians               # Tab 4: Family Network & Guardians
/students/:id?tab=health-docs             # Tab 5: Segregated Health & Verified Documents (RBAC Gated)

# --- Attendance Management (Core Homeroom) ---
/attendance                               # Campus Attendance Overview
/attendance/register                      # Daily Homeroom Attendance Matrix with In-Memory Offline Alert (OD-02)

# --- Staff Management ---
/staff                                    # Faculty & Staff Master Directory
/staff/invite                             # Invite Staff Member Modal

# --- Announcements ---
/notices                                  # In-App Broadcast Announcements
```

---

### Release 2: Daily School Experience & Finance

```http
# --- Teacher Portal ---
/teacher                                  # Teacher Daily Operational Dashboard
/teacher/classes/:id                      # Assigned Section Roster & Quick Actions
/teacher/timetable                        # Teacher Personal Timetable
/teacher/homework                         # Homework & Assignment Publisher
/teacher/leave                            # Staff Leave Request Form

# --- School Admin / Principal Staff Leave Review ---
/admin/staff/leave                        # Administrative Staff Leave Approval Desk

# --- Student Portal ---
/student                                  # Student Personal Dashboard
/student/timetable                        # My Weekly Class Timetable
/student/attendance                       # My Attendance Summary & Calendar
/student/homework                         # My Assigned Homework Checklist

# --- Parent / Guardian Portal (with Persistent Child Selector OD-03) ---
/parent                                   # Multi-Child Family Overview Dashboard
/parent/attendance                        # Child Attendance Heatmap & Absence Records
/parent/fees                              # Child Fee Dues & Downloadable Receipts
/parent/homework                          # Child Assigned Homework Feed
/parent/timetable                         # Child Weekly Timetable

# --- Financial Accounting & Cashier Desk ---
/finance/dashboard                        # Revenue Pulse & Dues Overview
/finance/counter                          # Cashier Counter Desk (Payment Recording)
/finance/structures                       # Fee Installments & Fee Categories
/finance/concessions                      # Fee Concessions & Waivers Approval Desk (OD-04)
/finance/dues                             # Outstanding Defaulters Registry
/finance/transactions                     # Payment Ledger & Transaction Log
/finance/receipts/:id                     # Printable Institutional Receipt Voucher
/parent/timetable                         # Child Weekly Timetable

# --- Financial Accounting & Cashier Desk ---
/finance/dashboard                        # Revenue Pulse & Dues Overview
/finance/counter                          # Cashier Counter Desk (Payment Recording)
/finance/structures                       # Fee Installments & Fee Categories
/finance/dues                             # Outstanding Defaulters Registry
/finance/transactions                     # Payment Ledger & Transaction Log
/finance/receipts/:id                     # Printable Institutional Receipt Voucher

# --- Academic Timetable & Reports ---
/academics/timetable                      # Master Campus Timetable Grid
/attendance/reports                       # Monthly Attendance Register Reports
```

---

### Future Releases (Deferred Beyond Stage 1)

```http
# Deferred Modules (Do NOT implement in Stage 1):
/examinations/*                           # Exam Schedules, Hall Tickets
/marks/*                                  # Gradebook, Marks Entry, Grading Scales
/report-cards/*                           # Report Card Generation & Digital Signatures
/parent/fees/pay                          # Online Payment Gateway Checkout
/transport/*                              # Bus Routes, Fleet Tracking, Stops
/library/*                                # Book Catalog, Circulation, Fines
/payroll/*                                # Staff Salary Structures, Payslips
/notifications/sms                        # External SMS Gateway Integration
/notifications/whatsapp                   # WhatsApp Business API Integration
```

---

## 4. Context Switcher Architecture

To maintain multi-tenant and branch boundaries, three persistent context switchers reside in the global header:

1. **School / Tenant Context:** Linked to `user.tenant_id`. Displays active institution name. Multi-tenant SuperAdmins can switch tenants; single-school users see a static institutional label.
2. **Branch Context:** Linked to `branch_id`. For multi-campus schools, switches data scope between campus locations (e.g. `Main Campus`, `North Campus`).
3. **Academic Session Context:** Controls the active academic year (e.g. `2026–2027`). Historical sessions can be selected in read-only mode to review past records.
4. **Parent Child Switcher (OD-03, Release 2):** Resides persistently in the Parent Portal header to switch between enrolled siblings.
   - Displays only children explicitly linked to the authenticated guardian in `sis.student_guardians`.
   - Maintains selected child context consistently across all parent pages (attendance, timetable, homework, fees).
   - Backend enforces child-specific permissions on every API request; frontend selector is an ergonomic control, never an authorization mechanism.
   - Switching children immediately discards child-specific cached data to prevent cross-child information leakage.

---

## 5. Global Search / Quick Navigation Palette (`Ctrl+K`)

- **Design Target:** Provide a keyboard-accessible shortcut (`Ctrl+K` on Windows/Linux, `Cmd+K` on macOS) to quickly jump to:
  - Enrolled students by name or admission number.
  - Grade sections (e.g. "Class 8-A").
  - Administrative settings routes.
- **Search Scope:** Operates strictly within the user's authorized tenant and branch purview.
- **Input Handling:** Debounced query handler querying indexed backend endpoints with clear loading and empty states.
