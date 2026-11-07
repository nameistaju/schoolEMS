# SchoolEMS — Frontend Implementation Roadmap & Phased Delivery Plan

**Document Version:** 1.0.0 (Revised)  
**Status:** APPROVED IMPLEMENTATION ROADMAP  
**Governing Standard:** `docs/ENGINEERING_STANDARDS.md` & `CLAUDE.md`  
**Scope Alignment:** Stage 1 MVP Scope (`Release 1` & `Release 2`)  

---

## 1. Phased Delivery Strategy

The frontend implementation roadmap organizes development into demonstrable, dependency-ordered milestones. In accordance with `docs/ENGINEERING_STANDARDS.md`, implementation cannot begin until design approval is formally granted.

Effort estimates in this document are directional engineering milestones rather than fixed sprint commitments; detailed sprint capacity must be validated against actual codebase dependencies.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND IMPLEMENTATION PHASES                         │
├───────────────┬─────────────────┬──────────────────┬─────────────────────────────┤
│  MILESTONE 1  │   MILESTONE 2   │   MILESTONE 3    │     MILESTONES 4 & 5        │
│ (Foundations) │  (App Shell)    │ (Table Engine)   │    (Domain Modules)         │
│               │                 │                  │                             │
│ • Design CSS  │ • Nav Rail      │ • Reusable Data  │ • Rel 1: Admissions,        │
│   Tokens      │ • Context       │   Table          │   Attendance, Setup (M4)    │
│ • Typography  │   Switchers     │ • Filter Bar     │ • Rel 2: Parent/Student     │
│ • Basic Form  │ • Breadcrumbs   │ • Pinned Columns │   Portals & Fees (M5)       │
│   Primitives  │ • Responsive    │ • Modal/Drawer   │                             │
│ • Local Icons │   Layout        │   Containers     │                             │
└───────────────┴─────────────────┴──────────────────┴─────────────────────────────┘
```

---

## 2. Component Dependency Graph

Before implementing domain workflows, foundational layers must be built and verified:

```
Level 0: Design Tokens & Base Styles
└── styles/tokens.css, typography, local SVG icon set

Level 1: Primitive Form & Feedback Components
├── Button, Input, Select, Checkbox, Badge, Toast, Alert, Skeleton
└── depends on: Level 0

Level 2: Compound Layout & Overlay Components
├── FormField (Input + Label + Error)
├── Modal & Slide-Over Drawer (Trapped focus, Esc handler)
├── ContextSwitchers (Tenant, Branch, Session)
└── depends on: Level 1

Level 3: Core Register & Data-Table Engine
├── DataTable (Native semantic table, sticky header, pinned columns, server pagination)
├── TableFilterBar (Debounced search, active facet chips)
├── BatchActionBar (Contextual selection bar)
└── depends on: Level 2

Level 4: Release 1 Core Operations Screens
├── School & Branch Administration (`SCR-ADM-01..02`)
├── Academic Sessions & Classes/Sections (`SCR-ADM-03..06`)
├── Student Admission Wizard with Photo Upload (`SCR-ADM-08`, OD-05)
├── Master Student Directory & Dossiers (`SCR-ADM-07`, `SCR-ADM-09`)
├── Student Bulk Import Engine (`SCR-ADM-17`)
├── Academic Calendar Grid (`SCR-ADM-16`)
├── Daily Homeroom Attendance with Offline Alert (`SCR-TCH-01`, OD-02)
├── Academic Year Rollover Promotion Wizard (`SCR-ADM-18`, OD-01)
├── Staff Management & Announcements (`SCR-ADM-11..14`)
└── depends on: Level 3 (and prerequisite academic setup)

Level 5: Release 2 Portals & Financial Workflows
├── Parent Portal with Persistent Child Selector (`SCR-PAR-01..05`, OD-03)
├── Student Portal (`SCR-STU-01..05`)
├── Teacher Daily Dashboard & Homework (`SCR-TCH-02..05`)
├── Basic Staff Leave Management (`SCR-TCH-06`, `SCR-ADM-19`)
├── Cashier Fee Counter with Controlled Concessions (`SCR-ACC-02`, `SCR-ACC-07`, OD-04)
├── Fee Structures & Receipts (`SCR-ACC-01`, `SCR-ACC-03..06`)
└── depends on: Level 4 (and prerequisite fee structures / guardian relationships)
```

---

## 3. Demonstrable Milestone Breakdown

### Milestone 0: Design Approval & Architecture Baseline (Pre-requisite)
- **Scope:** Technical and design quality sign-off of all documents in `docs/ui-ux/`.
- **Pre-requisite:** Zero unapproved source code modifications, zero migrations.
- **Status:** In Review.

---

### Milestone 1: Design Tokens, Typography & Shared Primitives
- **Scope:**
  - Build `styles/tokens.css` with colors, typography scales, elevation, and density heights.
  - Implement reusable primitives: `Button`, `Input`, `Select`, `Checkbox`, `Badge`, `Skeleton`, `ImageUpload` (OD-05).
  - Package local SVG icons with uniform stroke and accessible naming.
- **Verification Gate:** 100% WCAG 2.2 AA contrast compliance; all inputs keyboard accessible; zero external CDN dependencies.
- **Status:** Unestimated (pending Milestone 0 approval).

---

### Milestone 2: Multi-Tenant Application Shell & Navigation
- **Scope:**
  - Implement responsive application shell with collapsible navigation rail.
  - Build persistent context switchers (Tenant, Branch, Academic Session) wired to `AuthContext`.
  - Provide breadcrumb trail and command palette (`Ctrl+K`) foundation.
- **Verification Gate:** Responsive collapse at 1024px and 768px; zero horizontal layout overflow.
- **Status:** Unestimated.

---

### Milestone 3: High-Density DataTable Engine & Dialogs
- **Scope:**
  - Build reusable `DataTable` using native semantic HTML elements (`<table>`, `<thead>`, `<tbody>`).
  - Wire density switcher (Compact 34px, Default 44px, Comfortable 54px).
  - Implement sticky header, pinned identification columns, debounced search (250ms), and server pagination.
  - Build accessible `Modal` and slide-over `Drawer` with focus trapping.
  - Build `OfflineBanner` for in-memory connection loss alerting (OD-02).
- **Verification Gate:** Smooth rendering of 50-row paginated datasets; proper `aria-sort` and keyboard focus restoration.
- **Status:** Unestimated.

---

### Milestone 4: Release 1 — Core School Operations Modules
- **Scope:**
  - School and campus branch management interfaces.
  - Academic year and class/section setup with capacity indicators.
  - Student admission wizard with voluntary alternative ID fields, masked display, and photograph file upload (OD-05).
  - Master student directory with search, filter chips, and CSV export.
  - Student bulk import wizard with spreadsheet validation grid and duplicate detection.
  - Academic calendar grid for publishing holidays, term dates, and campus events.
  - Daily homeroom attendance register with mandatory absent confirmation modal, unsaved changes exit guards, and in-memory offline preservation (OD-02).
  - Controlled academic year rollover promotion review wizard (OD-01, strictly dependent on academic year and student enrollment models).
  - Staff directory, invitations, and institutional in-app announcements.
- **Verification Gate:** End-to-end execution of Journeys 01 through 08 against backend APIs; passage of all Release 1 criteria in `12-design-acceptance-criteria.md`.
- **Status:** Unestimated.

---

### Milestone 5: Release 2 — Daily School Experience & Fee Management
- **Scope:**
  - Parent portal with persistent child selector, attendance heatmap, circulars, and fee dues (OD-03, dependent on guardian relationships).
  - Student personal portal with class timetable and homework tracker.
  - Teacher daily portal, assigned section roster, and homework assignment desk.
  - Basic staff leave management (request submission, administrative approval queue, audit history).
  - Cashier fee counter desk with installment checklist, transaction reference recording, printable receipt vouchers, and controlled fee concession workflows (OD-04, dependent on fee structures).
  - Monthly attendance and enrollment administrative reports.
- **Verification Gate:** End-to-end execution of Journeys 09 through 12; dual print stylesheet verification for fee receipts.
- **Status:** Unestimated.

---

## 4. Deferred Future Work (Out of Scope for Stage 1)

The following modules are explicitly excluded from Stage 1 implementation:
- Online payment gateway checkouts (Razorpay, Stripe).
- External SMS and WhatsApp Business API integrations.
- Examinations, gradebooks, marks entry, and report card generation.
- Transport fleet tracking and library management.
- Staff payroll and salary management.
- AI-driven analytics or predictive features.

---

## 5. Technical Risk Management

| Risk ID | Identified Risk | Impact | Likelihood | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **RSK-01** | **Scope Creep into Release 2 During R1** | High | Medium | Strictly gate Release 2 screens (`SCR-PAR-*`, `SCR-ACC-*`) until Release 1 core operations pass acceptance testing. |
| **RSK-02** | **Accidental Table Dependency Bloat** | Medium | Medium | Use native semantic HTML tables for standard paginated views. Avoid introducing heavy third-party grid packages unless strictly necessary. |
| **RSK-03** | **Unconfirmed Attendance Errors** | High | Low | Enforce explicit confirmation review modal showing absent student names before finalizing attendance commits. |
| **RSK-04** | **Unsaved Form Data Loss** | Medium | Medium | Implement dirty form state listeners and exit guards on multi-step admission forms. |
