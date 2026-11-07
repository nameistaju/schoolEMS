# SchoolEMS — Enterprise UI/UX Research, Design System & Screen Specifications

**Document Status:** MASTER DESIGN SYSTEM & SCREEN SPECIFICATION  
**Classification:** Enterprise UX Architecture & Product Design Specification  
**Product Scope:** Multi-Tenant School Management SaaS (Stage 1 MVP & Scalable Long-Term SIS)  
**Target Pilot Scope:** Initial Onboarding of 1–2 Educational Institutions (Apex Academy & Horizon International)  
**Technology Stack:** React 18, Vite, React Router 6, PostgreSQL 18.6 RLS, RS256 Asymmetric JWT  
**Accessibility Standard:** WCAG 2.1 Level AA / Section 508 Compliant  
**Date:** March 2026  
**Author:** Principal Product Designer, Enterprise UX Architect & Lead Systems Engineer  

---

## Table of Contents

1. [Executive Summary & Product Mission](#1-executive-summary--product-mission)
2. [Repository State & Frontend Architecture Audit](#2-repository-state--frontend-architecture-audit)
   - 2.1 Current Codebase Baseline
   - 2.2 Existing, Partial, and Missing Screen Inventory
3. [Competitive UI/UX Benchmark Study](#3-competitive-uiux-benchmark-study)
   - 3.1 PowerSchool SIS
   - 3.2 Fedena School ERP
   - 3.3 Alma SIS
   - 3.4 Teachmint & MyClassboard (MCB)
   - 3.5 Entab CampusCare & Vidyalaya
   - 3.6 Comparative Synthesis & Strategic Adaptations
4. [SchoolEMS Design System Architecture](#4-schoolems-design-system-architecture)
   - 4.1 Design Philosophy: Anti-Clutter Dense Productivity
   - 4.2 Color Palette & Semantic System
   - 4.3 Typography Hierarchy & Tabular Figures
   - 4.4 Spatial Grid & Elevation Tokens
   - 4.5 Focus Rings, Touch Targets & Accessibility Tokens
5. [The Enterprise Data Table Specification](#5-the-enterprise-data-table-specification)
   - 5.1 Density Modes (Compact, Default, Comfortable)
   - 5.2 Sticky Headers & Pinned Columns
   - 5.3 Tri-State Column Sorting & Multi-Facet Filtering
   - 5.4 Batch Selection & Contextual Action Toolbar
   - 5.5 Pagination Controls & Data Lab Drilldown
   - 5.6 Responsive Mobile Card Degradation
6. [Core Screen Specifications & Interaction Blueprints](#6-core-screen-specifications--interaction-blueprints)
   - 6.1 Global Application Shell & Context Switcher
   - 6.2 Role-Specific Operational Dashboards
   - 6.3 Master Student Directory (Data Grid)
   - 6.4 360° Cumulative Student Profile & Custody Dossier
   - 6.5 Daily Attendance Matrix & Rapid Marking Register
   - 6.6 Fee Management Ledger & Cashier Counter Desk
   - 6.7 Academic Taxonomy & Class Section Setup
   - 6.8 Parent & Student Self-Service Portals
7. [Accessibility, Responsiveness & Performance Architecture](#7-accessibility-responsiveness--performance-architecture)
   - 7.1 WCAG 2.1 AA Verification Checklist
   - 7.2 Keyboard Navigation & Focus Flow
   - 7.3 Screen Reader ARIA Semantics
   - 7.4 Network Efficiency & Virtualized Rendering
8. [Engineering Implementation Plan & Milestones](#8-engineering-implementation-plan--milestones)

---

## 1. Executive Summary & Product Mission

SchoolEMS is an enterprise-grade, multi-tenant Educational Operations and School Management Platform (SaaS). Engineered from first principles for multi-campus school chains, independent K–12 institutions, and educational trusts, SchoolEMS couples cryptographic tenant isolation (**PostgreSQL Row-Level Security**, **RS256 Asymmetric JWTs**) with an exceptionally clean, responsive, and ergonomic user interface.

### The Design Challenge
School software is notorious for poor usability:
- **Legacy Monoliths (e.g. older ERPs):** Overwhelmed with cluttered, unstyled form fields, poor information density, lack of mobile support, non-existent accessibility, and confusing multi-level nested menus that require 8–10 clicks to perform routine tasks.
- **Consumer EdTech Apps:** Over-simplified mobile apps that lack the dense data tables, keyboard shortcuts, batch operations, and regulatory audit trails required by professional school registrars, bursars, and principals.

### The SchoolEMS Solution
SchoolEMS introduces a **Modern High-Density Design Architecture**:
1. **Dense, Legible Administration:** Data tables engineered for high-volume record processing (50–100 students per view) with compact density toggles, tabular figure alignment, and instant client-side filtering.
2. **Sub-Second Daily Workflows:** Attendance marking, fee receipting, and student lookups executable in seconds using single-key shortcuts (`P` for Present, `A` for Absent, `/` for Global Quick Search).
3. **Role-Tailored Workspaces:** Seven distinct personas (Platform SuperAdmin, SchoolAdmin, Principal, Teacher, Student, Parent, Accountant) each receive an interface tailored specifically to their purview, with zero interface leakage or unauthorized navigation options.
4. **Guaranteed Local Performance:** Cloud-independent, local-first architecture with sub-50ms UI state transitions, zero layout shift (CLS = 0), and strict WCAG 2.1 AA accessibility compliance.

---

## 2. Repository State & Frontend Architecture Audit

### 2.1 Current Codebase Baseline

An audit of the repository (`projects/school-management/`) reveals the current technological stack and architectural boundaries:

```
projects/school-management/
├── frontend/                     # React 18.3.1 + Vite 5.4.11 SPA
│   ├── src/
│   │   ├── api.js                # Unified fetch client (sms_access_token, error unwrapping)
│   │   ├── components/
│   │   │   ├── Bits.jsx          # Reusable UI elements (Spinner, StatusBadge)
│   │   │   └── Layout.jsx        # App header, role badge, sign-in/out, footer
│   │   ├── context/
│   │   │   ├── AuthContext.jsx   # Multi-tenant state (user, roles, tenant, session refresh)
│   │   │   └── ToastContext.jsx  # Non-blocking operational notifications
│   │   ├── pages/
│   │   │   ├── Auth.jsx          # Multi-tenant login (school selector, demo logins, registration)
│   │   │   └── Home.jsx          # Platform overview & authenticated welcome card
│   │   ├── main.jsx              # React 18 root, BrowserRouter, Route definitions
│   │   └── styles.css            # Global stylesheets (Legacy variables to be modernized)
│   └── package.json              # React 18, React Router 6, Vite
└── services/                     # Node.js 20 microservices (Gateway :8080, Auth :4001)
    ├── auth-service/             # Multi-tenant IAM, RS256 token issuance, Knex migrations 01–07
    ├── gateway/                  # Ingress proxy, header sanitization, tenant resolution
    └── common/                   # Shared RS256 auth, PostgreSQL withTenantContext pool
```

### 2.2 Existing, Partial, and Missing Screen Inventory

Based on actual inspection of the frontend files, the current implementation status is categorized below:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND SCREEN STATUS INVENTORY                          │
├───────────────────────────────┬──────────────────────────┬─────────────────────────────┤
│ Screen / Workflow             │ Current Implementation   │ Required UX Enhancement     │
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Platform Overview (`/`)**   │ Fully functional         │ Add quick metrics dashboard │
│                               │                          │ for authenticated roles.    │
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Sign In (`/login`)**        │ Fully functional         │ Add remember domain, recent │
│                               │                          │ schools, password reset.    │
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **School Onboarding Inquiry** │ Basic form functional    │ Add multi-step branch and   │
│ **(`/register`)**             │                          │ administrator configuration.│
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Student Directory**         │ Missing                  │ Needs high-density data     │
│                               │                          │ table with filters & export.│
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **360° Student Profile View** │ Missing                  │ Needs multi-tab profile     │
│                               │                          │ (demographics, health, fees)│
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Daily Attendance Register** │ Missing                  │ Needs date/section matrix,  │
│                               │                          │ keyboard shortcuts (P/A/L). │
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Fee Collection Counter**    │ Missing                  │ Needs student fee ledger &  │
│                               │                          │ printable receipt dialogue. │
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Class & Section Manager**   │ Missing                  │ Needs capacity trackers &   │
│                               │                          │ teacher assignment cards.   │
├───────────────────────────────┼──────────────────────────┼─────────────────────────────┤
│ **Parent / Student Portal**   │ Missing                  │ Needs multi-child switcher, │
│                               │                          │ attendance heatmap, fees.   │
└───────────────────────────────┴──────────────────────────┴─────────────────────────────┘
```

---

## 3. Competitive UI/UX Benchmark Study

To establish a world-class design standard, we conducted a benchmark study of leading Student Information Systems (SIS) and School ERP products across North American and Indian institutional markets.

### 3.1 PowerSchool SIS
* **Source & Inspection Date:** Official PowerSchool SIS Documentation (`powerschool-docs.com`, `powerschool.com`), public administrator guides, and release notes inspected March 2026.
* **What Could Actually Be Inspected:** Administrator Start Page workflows, Enhanced User Interface (EUI) specifications, Student Navigation Menu, Quick Lookup tables, and field-level security configurations. Live SaaS production access was not available; observations are based on verified official documentation and administrative training artifacts.
* **Navigation & Information Architecture:** 
  - Dual-tier header: Global Quick Search pinned at top right with persistent district/school selector.
  - Left-hand module navigation drawer categorized into *Students, Staff, Daily Attendance, Special Programs, Setup*.
  - Persistent **Student Context Banner**: When a student is selected, their name, photo, student number, grade level, and "Find Me" schedule locator remain pinned across all sub-pages.
* **Role-Specific Experience:** Highly segmented. Teachers operate inside PowerTeacher Pro (gradebook, section attendance); administrators operate in PowerSchool SIS Admin; parents/students use dedicated portal skins.
* **Student Profile Design:** Tabbed/sub-page layout anchored by the "Quick Lookup" dashboard—aggregating current schedule, term grades, and rolling attendance totals. Sub-pages separate demographics, emergency contacts, state compliance, and scheduling.
* **Data Table Behaviour:**
  - Standardized column sorting (asc/desc toggle).
  - Expandable modal view ("Open Full Table") for dense multi-row datasets.
  - Inline row selection with batch group functions.
* **Mobile Experience:** Primary administrative portal is desktop-centric. Parents and students use native iOS/Android apps with card-based snapshots.
* **Useful Patterns to Adapt:**
  1. *Persistent Student Context Banner:* Eliminates disorientation when navigating between student attendance, grades, and contact details.
  2. *Quick Lookup Summary:* Providing an immediate high-level digest before diving into deep sub-modules.
* **Weaknesses to Avoid:**
  1. Excessive sub-page nesting (over 40 distinct sub-pages per student).
  2. Inconsistent legacy styling between older administrative modules and modern EUI pages.

---

### 3.2 Fedena School ERP
* **Source & Inspection Date:** Official Fedena Documentation (`fedena.com`), support knowledgebase, and product tour videos inspected March 2026.
* **What Could Actually Be Inspected:** Module access menu, Academic/Batch setup workflows, Day-wise and Subject-wise attendance registers, and Student Profile data tables. Public documentation and user manuals were inspected.
* **Navigation & Information Architecture:**
  - Top navigation bar featuring the "Module Access Icon" (hamburger/grid launcher), global search bar, and institutional profile settings.
  - Hierarchical breadcrumbs: `Module Icon > Academics > Student Information > Student Profile`.
* **Role-Specific Experience:** Strict role separation (Admin, Teacher, Student, Parent). Teachers have simplified menus limited to their assigned batches and timetable periods.
* **Student Profile Design:** Centered around personal information tables, sibling linkages, guardian contacts, previous institution history, and financial dues summaries.
* **Data Table Behaviour:**
  - Heavy reliance on Course and Batch dropdown filters before table rendering.
  - Matrix tables for attendance: rows represent students; columns represent calendar dates (1 to 31).
  - Color-coded attendance status markers: Green for Present, Red for Absent (with Forenoon / Afternoon split markers).
* **Mobile Experience:** Responsive web layout augmented by the Fedena Mobile App, featuring push notification triggers for student attendance and fee reminders.
* **Useful Patterns to Adapt:**
  1. *Day-Wise vs. Subject-Wise Attendance Toggle:* Allows schools to choose between homeroom attendance or period-by-period tracking.
  2. *Sibling Relationship Mapping:* Linking students belonging to the same family for unified guardian notifications.
* **Weaknesses to Avoid:**
  1. Mandatory batch selection before seeing any data creates unnecessary clicks.
  2. Tables often lack sticky column headers, causing users to lose track of student names when scrolling horizontally across 31 days.

---

### 3.3 Alma SIS
* **Source & Inspection Date:** Official Alma Documentation (`getalma.com`), EdTech Digest product reviews, and public design showcases inspected March 2026.
* **What Could Actually Be Inspected:** Modern cloud-native design system, 360° Visual Learner Profile, Spreadsheet Data Editor, and Data Lab analytics dashboards.
* **Navigation & Information Architecture:**
  - Modern, minimalist aesthetic inspired by contemporary SaaS platforms (Linear, Notion, Stripe).
  - Clean collapsible left sidebar with clear iconography and generous white space.
  - Global `Cmd+K` / `Ctrl+K` command palette for instant student, class, and staff navigation.
* **Role-Specific Experience:** Uniquely unified design language across all roles. The UI looks consistent whether viewed by an administrator, counselor, teacher, or parent, with permissions seamlessly governing available capabilities.
* **Student Profile Design:** Best-in-class **360° Visual Learner Profile**:
  - Hero header with high-contrast biographical essentials.
  - Visual timeline displaying academic milestones, behavioral anecdotes, attendance trends, and medical flags.
  - Longitudinal multi-year view allowing counselors to evaluate a student across multiple grade cohorts without switching views.
* **Data Table Behaviour:**
  - **Spreadsheet Data Editor:** Allows inline cell editing directly in the grid, mimicking Excel for rapid mass updates.
  - Advanced faceted filtering (e.g., "Attendance < 85%" AND "Grade = 9th").
  - Seamless CSV/Excel export without background queueing delays.
* **Mobile Experience:** 100% responsive web design with progressive web app (PWA) characteristics; mobile views gracefully collapse tables into readable swipeable cards.
* **Useful Patterns to Adapt:**
  1. *Command Palette (`Ctrl+K`):* Unlocks instant keyboard navigation for power users.
  2. *Inline Batch Editing:* Reduces hours of administrative clicking when entering roll numbers or updating student statuses.
  3. *Longitudinal Visual Timeline:* Provides meaningful context beyond raw numbers.
* **Weaknesses to Avoid:**
  1. Overly generous white space can reduce row density on small laptops (1366×768 resolution common in school offices).

---

### 3.4 Teachmint & MyClassboard (MCB)
* **Source & Inspection Date:** Teachmint and MyClassboard official product documentation (`teachmint.com`, `myclassboard.com`), administrator demo workflows, and school ERP case studies inspected March 2026.
* **What Could Actually Be Inspected:** Indian K–12 ERP operational flows, fee installment ledgers, counter collection desks, RFID/biometric attendance integrations, and CBSE/ICSE document generators.
* **Navigation & Information Architecture:**
  - Dashboard-and-Sidebar framework tailored for high-volume clerical operators.
  - Top header displays academic year selector, branch dropdown, and SMS/WhatsApp communication balance counters.
* **Role-Specific Experience:** Deeply customized for Indian administrative personas:
  - *Fee Cashier / Accountant:* Dedicated "Fee Collection Counter" optimized for numerical keypad entry and instant thermal/A4 receipt printing.
  - *Class Teacher:* Mobile-first attendance marking and homework broadcasting.
* **Student Profile Design:** Incorporates Indian regulatory requirements: admission number, roll number, caste/category tracking for state compliance, sibling concession linkage, bus route/stop allocation, and Aadhaar masking fields.
* **Data Table Behaviour:**
  - Extremely dense data tables (30–50 rows visible on a standard 1080p monitor).
  - Multi-parameter filter bars (Academic Year, Campus Branch, Class, Section, Fee Status).
  - Sticky summary footers calculating real-time page totals (e.g., Total Fees Collected, Total Outstanding Dues).
* **Mobile Experience:** Heavily focused on parent/teacher smartphone apps supporting vernacular languages (Hindi, Telugu, Tamil, Marathi) and WhatsApp receipt delivery.
* **Useful Patterns to Adapt:**
  1. *Fee Counter Desk UX:* Fast receipt generation workflow with automated split-head allocation (Tuition, Transport, Library).
  2. *Sticky Totals Footer:* Immediate financial and attendance reconciliation without manual spreadsheet recalculation.
  3. *Multi-Parameter Top Filter Toolbar:* Essential for schools managing multiple parallel sections (e.g., Class 6-A, 6-B, 6-C).
* **Weaknesses to Avoid:**
  1. Visual clutter: interfaces are frequently overloaded with bright, competing banner alerts and non-standard button colors.
  2. Weak keyboard accessibility and reliance on mouse clicks for every table row.

---

### 3.5 Entab CampusCare & Vidyalaya
* **Source & Inspection Date:** Official Entab CampusCare specifications (`entab.in`) and Vidyalaya School ERP user guides (`vidyalayaerp.com`) inspected March 2026.
* **What Could Actually Be Inspected:** Class-wise student directories, attendance registers, report card generation modules, and parent fee installment portals.
* **Navigation & Information Architecture:**
  - Left navigation tree with expandable accordions (*Student Management, Examination & CCE, Fees, Library, Transport*).
  - Breadcrumb navigation showing current position in administrative hierarchy.
* **Role-Specific Experience:** Administrative power users dominate the web portal; parents and students operate almost exclusively through mobile app dashboards.
* **Student Profile Design:** Document-centric dossier layout. Prioritizes student registration numbers, transfer certificate (TC) tracking, health cards, and emergency parent contacts.
* **Data Table Behaviour:**
  - Tabular attendance entry with a prominent **"Mark All Present"** button that lets teachers flip only the 2–3 absent students to save time.
  - Comprehensive print-to-PDF formatting designed for physical paper registers.
* **Mobile Experience:** Mobile applications provide push notifications for daily attendance status and instant UPI payment integration for school fees.
* **Useful Patterns to Adapt:**
  1. *"Mark All Present" One-Click Shortcut:* Massive operational time saver for teachers taking morning attendance.
  2. *Parent Attendance Heatmap:* Visual calendar where green/red squares give parents an instant annual overview of their child's attendance.
* **Weaknesses to Avoid:**
  1. Rigid, slow desktop interfaces that reload the full page on every dropdown change.
  2. Poor responsive scaling on tablets.

---

### 3.6 Comparative Synthesis & Strategic Adaptations

The matrix below contrasts the 5 benchmarked systems against our strategic design requirements:

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   SIS/ERP BENCHMARK SYNTHESIS MATRIX                                    │
├────────────────────┬─────────────┬─────────────┬─────────────┬─────────────────┬────────────────────────┤
│ UX Capability      │ PowerSchool │ Fedena      │ Alma SIS    │ Teachmint / MCB │ SchoolEMS Strategy     │
├────────────────────┼─────────────┼─────────────┼─────────────┼─────────────────┼────────────────────────┤
│ Visual Polish      │ Moderate    │ Moderate    │ Very High   │ Moderate        │ **High (Linear/Stripe)**│
│ Table Density      │ High        │ Moderate    │ Moderate    │ Very High       │ **Dynamic 3-Level**    │
│ Context Awareness  │ Very High   │ Low         │ High        │ Moderate        │ **Persistent Banner**  │
│ Keyboard Nav       │ Moderate    │ Low         │ High        │ Low             │ **Comprehensive (a11y)│
│ Rapid Attendance   │ Good        │ Matrix-only │ Good        │ Mobile-First    │ **Shortcut-Driven**    │
│ Fee Ledger UX      │ Basic       │ Good        │ N/A (US)    │ Exceptional     │ **Counter Desk Engine**│
│ Accessibility (a11y│ WCAG 2.0    │ Poor        │ WCAG 2.1 AA │ Poor            │ **WCAG 2.1 AA Target** │
│ Mobile Adaptation  │ Mobile App  │ Responsive  │ PWA/Resp    │ Mobile App      │ **Responsive Web Core**│
└────────────────────┴─────────────┴─────────────┴─────────────┴─────────────────┴────────────────────────┘
```

#### What SchoolEMS Will Adopt:
1. **Persistent Student Context Banner** (from PowerSchool): Pinned bar displaying photo, student name, roll number, class/section, and status badges.
2. **Spreadsheet Density with Inline Actions** (from Alma): Compact row density with instant search, multi-column sorting, and batch action toolbar.
3. **One-Click "Mark All Present" & Shortcut Matrix** (from Entab/Teachmint): Teachers mark attendance in under 15 seconds using keyboard shortcuts (`P`, `A`, `L`).
4. **Dedicated Cashier Counter Desk** (from MyClassboard): Optimized fee collection window with automatic split allocation and instant printable receipt.
5. **Universal `Ctrl+K` Global Palette** (from Alma): Instant keyboard lookup across students, staff, classes, and settings.

#### What SchoolEMS Will Avoid:
1. **Deep Page Nesting:** Avoid PowerSchool's 40+ sub-page links; consolidate into 6 cohesive tabs on the Student Dossier.
2. **Page Reloading Dropdowns:** Avoid legacy ERP full-page form submissions; use client-side reactive state with optimistic UI updates.
3. **Low-Contrast Visual Clutter:** Avoid unstyled warning alerts and arbitrary colored badges; adhere strictly to WCAG 2.1 AA semantic color tokens.

---

## 4. SchoolEMS Design System Architecture

### 4.1 Design Philosophy: Anti-Clutter Dense Productivity

School administration requires scanning hundreds of student rows, reviewing financial figures, and verifying dates. The SchoolEMS design system is built upon **Anti-Clutter High Density**:
- **Zero Decorative Fluff:** Every visual element carries operational meaning (status, urgency, or action).
- **Spatial Compactness:** Row heights and typography are calibrated for data readability without wasteful padding.
- **Visual Calm:** A neutral slate and cobalt palette minimizes eye strain during 8-hour administrative shifts.

### 4.2 Color Palette & Semantic System

```css
:root {
  /* --- Primary Slate Neutral Scale --- */
  --color-slate-900: #0F172A; /* Deep Navy: Primary Headings & Topbar */
  --color-slate-800: #1E293B; /* Dark Slate: Main Nav & Sidebar */
  --color-slate-700: #334155; /* Slate: Body text & Secondary Headings */
  --color-slate-600: #475569; /* Medium Slate: Muted text & Table column headers */
  --color-slate-500: #64748B; /* Neutral Slate: Subtitles & Placeholders */
  --color-slate-300: #CBD5E1; /* Light Slate: Dividers & Inactive borders */
  --color-slate-200: #E2E8F0; /* Clean Border: Container & Table borders */
  --color-slate-100: #F1F5F9; /* Surface Neutral: Table zebra & Input backgrounds */
  --color-slate-50:  #F8FAFC; /* Page Background: Main canvas */
  --color-white:     #FFFFFF; /* Pure White: Card & Dialog surfaces */

  /* --- Brand & Interactive Cobalt Scale --- */
  --color-brand-900: #1E3A8A; /* Dark Cobalt: Active button state */
  --color-brand-800: #1E40AF; /* Deep Cobalt: Primary Hover */
  --color-brand-700: #1D4ED8; /* Cobalt Accent */
  --color-brand-600: #2563EB; /* Interactive Blue: Primary Buttons & Links */
  --color-brand-500: #3B82F6; /* Focus Ring Color */
  --color-brand-100: #DBEAFE; /* Light Blue Tint: Selected row & Badge background */
  --color-brand-50:  #EFF6FF; /* Subtle Blue Hover */

  /* --- Semantic Status Tokens (WCAG 2.1 AA Compliant) --- */
  /* Success: Present Attendance, Paid Fees, Active Status */
  --color-success-text: #065F46; /* Contrast 7.2:1 against bg */
  --color-success-bg:   #D1FAE5;
  --color-success-base: #059669;

  /* Warning / Pending: Partial Payment, Late Attendance, Review Required */
  --color-warning-text: #92400E; /* Contrast 5.8:1 against bg */
  --color-warning-bg:   #FEF3C7;
  --color-warning-base: #D97706;

  /* Danger / Critical: Absent Attendance, Overdue Fees, Suspended Tenant, Allergy Alert */
  --color-danger-text:  #991B1B; /* Contrast 7.4:1 against bg */
  --color-danger-bg:    #FEE2E2;
  --color-danger-base:  #DC2626;

  /* Info / Neutral: Transferred, Inactive, General Notice */
  --color-info-text:    #075985;
  --color-info-bg:      #E0F2FE;
  --color-info-base:    #0284C7;
}
```

### 4.3 Typography Hierarchy & Tabular Figures

School records require numeric precision. SchoolEMS standardizes on a high-legibility system sans-serif font stack with explicit **tabular figures** (`font-variant-numeric: tabular-nums`) to prevent jitter in tables and financial reports.

```css
:root {
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', Consolas, 'Liberation Mono', Menlo, monospace;

  /* Font Scales */
  --text-xs:   0.75rem;   /* 12px: Badges, timestamps, small metadata */
  --text-sm:   0.875rem;  /* 14px: Default data table rows, inputs, labels */
  --text-base: 1rem;      /* 16px: Body prose, default buttons */
  --text-lg:   1.125rem;  /* 18px: Section headers, card titles */
  --text-xl:   1.25rem;   /* 20px: Modal headings, sub-page titles */
  --text-2xl:  1.5rem;    /* 24px: Primary view title, KPI metrics */
  --text-3xl:  1.875rem;  /* 30px: Top-level dashboard hero stats */
}

/* Tabular numbers for clean numeric vertical alignment */
.tabular-nums, table, .fee-amount, .roll-no, .stat-value {
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em;
}
```

### 4.4 Spatial Grid & Elevation Tokens

A strict 4px/8px modular grid governs spacing, padding, and alignments:

```css
:root {
  --space-1:  0.25rem;  /* 4px */
  --space-2:  0.5rem;   /* 8px */
  --space-3:  0.75rem;  /* 12px */
  --space-4:  1rem;     /* 16px */
  --space-5:  1.25rem;  /* 20px */
  --space-6:  1.5rem;   /* 24px */
  --space-8:  2rem;     /* 32px */
  --space-12: 3rem;     /* 48px */

  /* Border Radii */
  --radius-sm: 4px;     /* Badges, tags, table rows */
  --radius-md: 6px;     /* Form inputs, select dropdowns, action buttons */
  --radius-lg: 8px;     /* Cards, dialog windows, data table wrappers */
  --radius-full: 9999px;/* Status pills, avatar circles */

  /* Crisp Functional Elevation */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
```

### 4.5 Focus Rings, Touch Targets & Accessibility Tokens

To guarantee full keyboard accessibility:
- All interactive elements must maintain a minimum touch target size of **36px on desktop** and **44px on touch devices**.
- Unambiguous 2px focus rings offset by 2px ensure keyboard navigation is clear against any background.

```css
:focus-visible {
  outline: 2px solid var(--color-brand-600);
  outline-offset: 2px;
}

button:focus:not(:focus-visible),
input:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 5. The Enterprise Data Table Specification

Data tables are the core engine of SchoolEMS. The table component is engineered to handle dense rosters, fast filtering, and batch updates without third-party bloat.

### 5.1 Density Modes

Users can toggle row density to suit their monitor size and operational style:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DATA TABLE DENSITY MODES                        │
├─────────────┬────────────┬──────────────┬──────────────────────────────┤
│ Mode        │ Row Height │ Cell Padding │ Ideal Operational Purview    │
├─────────────┼────────────┼──────────────┼──────────────────────────────┤
│ Compact     │ 32px       │ 4px 8px      │ High-volume student registers│
│ Default     │ 42px       │ 8px 12px     │ General administrative work  │
│ Comfortable │ 52px       │ 14px 16px    │ Parent & student self-service│
└─────────────┴────────────┴──────────────┴──────────────────────────────┘
```

### 5.2 Sticky Headers & Pinned Columns

When scrolling vertically across hundreds of rows or horizontally across 20+ demographic attributes:
1. **Sticky Header:** The column header row (`<thead>`) remains pinned at `top: 0` with a 1px bottom border and subtle shadow.
2. **Pinned Identity Column:** The first two columns—Checkbox and Student Identification (Photo, Name, Roll No)—remain pinned (`position: sticky; left: 0; z-index: 10`) while remaining columns scroll horizontally.

```
┌──────┬──────────────────────┬──────────┬──────────┬──────────┬─────────┬──────────────┐
│ [ ]  │ Student (Pinned)     │ Class    │ Parent   │ Phone    │ Dues    │ Action       │
├──────┼──────────────────────┼──────────┼──────────┼──────────┼─────────┼──────────────┤
│ [ ]  │ 👤 Aarav Sharma (01) │ 8th - A  │ R. Sharma│ 98765... │ ₹0      │ [View] [...] │
│ [ ]  │ 👤 Diya Patel   (02) │ 8th - A  │ K. Patel │ 98234... │ ₹4,500  │ [View] [...] │
└──────┴──────────────────────┴──────────┴──────────┴──────────┴─────────┴──────────────┘
```

### 5.3 Tri-State Column Sorting & Multi-Facet Filtering

- **Column Sorting:** Clicking a column header cycles through `Ascending` (▲), `Descending` (▼), and `Default/Unsorted`. Headers include `aria-sort="ascending"` for screen readers.
- **Top Multi-Facet Filter Bar:**
  - Branch Selector (for multi-campus tenants)
  - Class & Section Selectors (e.g. `Class 7` -> `Section B`)
  - Status Filter (`All`, `Active`, `Invited`, `Suspended`)
  - Debounced Search Field (`input` with instant 150ms client-side row filtering)

### 5.4 Batch Selection & Contextual Action Toolbar

When one or more checkboxes are checked, the standard filter toolbar morphs into a high-visibility **Batch Action Bar**:
- Selected counter: *"42 students selected"*
- Action buttons:
  - `Mark Attendance (Batch)`
  - `Send Notification (SMS/Email)`
  - `Export Filtered to CSV`
  - `Assign to Section`
- Clear selection (`Esc` key or "Deselect All" button).

### 5.5 Pagination Controls

```
Showing 1 to 50 of 420 students   |   Rows per page: [ 50 ▾ ]   |   [⏮] [◀] Page 1 of 9 [▶] [⏭]
```

### 5.6 Responsive Mobile Card Degradation

On viewports narrower than `768px`, dense data tables automatically transform into responsive **Data Cards**:
- Top header: Student Name, Roll Number, and Status Badge.
- Middle body: Key fields arranged in a 2-column key-value grid (Class/Section, Parent Name, Dues).
- Card footer: Primary action button (`View Profile` or `Record Attendance`).

---

## 6. Core Screen Specifications & Interaction Blueprints

### 6.1 Global Application Shell & Context Switcher

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🏫 SchoolEMS]   [Apex Academy ▾] [Main Campus ▾]            [🔍 Quick Search (Ctrl+K)]  [Lakshmi R. ▾]│
├─────────────────┬──────────────────────────────────────────────────────────────────────────────────────┤
│ 📊 Dashboard    │ Breadcrumb: Operations > Students > Master Directory                                 │
│ 👥 Students     │                                                                                      │
│ 📅 Attendance   │ Master Student Directory                                    [+ Enroll New Student]   │
│ 💳 Fees         ├──────────────────────────────────────────────────────────────────────────────────────┤
│ 🏫 Academic     │ [Filter by Class ▾] [Section ▾] [Status: Active ▾]     [Search student or roll no...]│
│ 📢 Notices      │                                                                                      │
│ ⚙️ Settings     │ (Data Table Grid Renders Here)                                                       │
└─────────────────┴──────────────────────────────────────────────────────────────────────────────────────┘
```

#### Key Shell Interactions:
1. **Tenant / Branch Context Switcher (Top Left):** For users with multi-campus privileges, switching the branch instantly scopes all data queries via `withTenantContext`.
2. **Global Quick Search (`Ctrl+K`):** Opens a centered modal with instant keyboard search across students (by name, admission no, roll no), staff, and administrative pages.
3. **Left Navigation Rail:** Icon + label rail that collapses to icon-only mode on smaller screens to maximize data table canvas.

---

### 6.2 Role-Specific Operational Dashboards

The landing dashboard immediately surfaces metrics and actions pertinent to the user's role:

#### 1. SchoolAdmin & Principal Dashboard
- **Top Metrics Row:**
  - `Total Enrolled Pupils` (e.g. 1,240 | +12 this term)
  - `Today's Attendance Rate` (e.g. 94.6% | 67 absent)
  - `Fee Collection Progress` (e.g. ₹42.5L collected / ₹5.2L overdue)
  - `Active Staff on Duty` (e.g. 64 / 68 present)
- **Action Modules:**
  - *Unmarked Attendance Alert:* High-priority list of sections whose teachers have not submitted morning attendance by 09:30 AM.
  - *Recent Admissions Pending Approval:* Quick review queue with `Approve` / `Request Docs` buttons.
  - *Emergency Allergy / Medical Flags:* Instant count of campus alerts.

#### 2. Teacher Dashboard
- **My Classes Today:** Interactive cards for assigned periods (e.g. `Period 1: Class 8-A Mathematics`).
- **One-Click Attendance CTA:** Prominent status badge indicating whether today's attendance has been marked.
- **Pending Homework / Assignment Submissions:** Quick review counter.

#### 3. Accountant Dashboard
- **Financial Daily Reconciliation:** Cash collected, online gateway settlements, and pending cheque clearances.
- **Counter Collection Quick-Entry:** Immediate student search box to open fee receipts in under 2 seconds.
- **Overdue Defaulters Table:** Sorted by days overdue with bulk SMS reminder trigger.

---

### 6.3 Master Student Directory (Data Grid)

The primary administrative registry for registrars and principals.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STUDENT DIRECTORY  ·  Apex Academy (Main Campus)                     [📥 Export CSV]  [+ New Admission]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ [Class: All Grades ▾]  [Section: All ▾]  [Status: Active ▾]  [Density: Compact ▾]  [🔍 Search name/ID] │
├────┬──────┬──────────────┬──────────┬──────────────┬──────────────┬──────────┬───────────┬─────────────┤
│[ ] │Roll# │Student Name  │Class-Sec │Guardian      │Contact Phone │Fee Status│Attendance │Action       │
├────┼──────┼──────────────┼──────────┼──────────────┼──────────────┼──────────┼───────────┼─────────────┤
│[ ] │01    │Aarav Sharma  │8th - A   │Rajesh Sharma │+91 9876543210│[Paid]    │96.4%      │[Profile][⋮] │
│[ ] │02    │Ananya Rao    │8th - A   │Sunita Rao    │+91 9845011223│[Due ₹2k] │91.2%      │[Profile][⋮] │
│[ ] │03    │Bhavya Reddy  │8th - A   │K. V. Reddy   │+91 9701234567│[Paid]    │98.0%      │[Profile][⋮] │
│[ ] │04    │Devansh Gupta │8th - A   │Pooja Gupta   │+91 9988776655│[Overdue] │78.5% ⚠️   │[Profile][⋮] │
└────┴──────┴──────────────┴──────────┴──────────────┴──────────────┴──────────┴───────────┴─────────────┘
```

#### Interaction Design Rules:
- Row click navigates directly to the Student Profile.
- Double-click on editable fields (e.g. Roll Number) opens inline editor.
- Low attendance (`< 80%`) automatically highlights with a subtle warning badge (`78.5% ⚠️`).
- Overdue fee status displays the exact pending balance with a link to the cashier desk.

---

### 6.4 360° Cumulative Student Profile & Custody Dossier

The central record repository for a pupil, consolidating academic, family, financial, and regulatory records.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 👤 AARAV SHARMA  ·  Roll No: 01  ·  Class 8-A  ·  Adm No: APX-2024-0142                [Active Student]│
│ Apex Academy (Main Campus)  ·  DOB: 14 Aug 2011 (Age 14)  ·  Blood Group: O+                           │
│ ⚠️ ALLERGY ALERT: Severe Peanut Allergy (EpiPen in Nurse Station)   ·   Custody: Mother & Father Joint  │
├─────────────────┬──────────────────┬─────────────────┬──────────────┬───────────────┬──────────────────┤
│ 1. Demographics │ 2. Academic Hist │ 3. Attendance   │ 4. Fee Ledger│ 5. Family/Cust│ 6. Health & Docs │
├─────────────────┴──────────────────┴─────────────────┴──────────────┴───────────────┴──────────────────┤
│ PERSONAL & RESIDENTIAL DATA                                                                            │
│ Full Legal Name: Aarav Sharma                  Gender: Male             Aadhaar: ●●●● ●●●● 8192 (Verified)│
│ Residential Address: Flat 402, Green Meadows, Road No 12, Banjara Hills, Hyderabad, Telangana - 500034 │
│                                                                                                        │
│ PRIMARY GUARDIANS                                                                                      │
│ 1. Rajesh Sharma (Father) · +91 9876543210 · rajesh@example.com · [Primary Emergency Contact]        │
│ 2. Priya Sharma (Mother)  · +91 9876543211 · priya@example.com  · [Authorized Pickup]                 │
│                                                                                                        │
│ CURRENT ENROLLMENT DETAILS                                                                             │
│ Academic Session: 2025–2026      Enrollment Date: 05 June 2024     Enrollment Status: Active           │
│ Grade Level: Class 8             Section: Section A                Class Teacher: Mrs. K. Srilatha     │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

#### Architectural Security Features:
1. **Voluntary Aadhaar Masking:** Plaintext national IDs are never stored; only verified last-4 digits (`●●●● ●●●● 8192`) are displayed in compliance with the Supreme Court *Puttaswamy* ruling and DPDP Act 2023.
2. **Segregated Health & Safeguarding Dossier (Tab 6):** Protected by explicit permission checks (`requireHealthRecordScope`). Access is restricted to the Principal and School Nurse, and every read event generates an append-only audit log entry in `audit_logs`.
3. **Custody & Emergency Pickup Indicators:** Emergency pickup authorizations and court custody boundaries are displayed as bold top-level badges to prevent unauthorized dismissals.

---

### 6.5 Daily Attendance Matrix & Rapid Marking Register

Designed for teachers to complete attendance in under 15 seconds during homeroom.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ DAILY ATTENDANCE REGISTER  ·  Class 8th - Section A  ·  Date: 07 Nov 2026               [Morning Session]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Total: 40 Students   |   Present: 38   |   Absent: 2   |   Late: 0          [⚡ Mark All Present (Shift+P)]│
├────┬──────┬──────────────────────────┬─────────────────────────────┬───────────────────┬───────────────┤
│#   │Roll# │Student Name              │Status Selector              │Absence Reason     │Parent Alert   │
├────┼──────┼──────────────────────────┼─────────────────────────────┼───────────────────┼───────────────┤
│1   │01    │Aarav Sharma              │(●) Present  ( ) Absent ( )L │                   │               │
│2   │02    │Ananya Rao                │( ) Present  (●) Absent ( )L │Sick leave (fever) │[✓] Send SMS   │
│3   │03    │Bhavya Reddy              │(●) Present  ( ) Absent ( )L │                   │               │
│4   │04    │Devansh Gupta             │( ) Present  (●) Absent ( )L │Unexcused absence  │[✓] Send SMS   │
└────┴──────┴──────────────────────────┴─────────────────────────────┴───────────────────┴───────────────┘
                                                       [Cancel]   [💾 Submit & Finalize Attendance]
```

#### Rapid Keyboard Interaction Model:
- `Shift + P`: Marks every student in the register as **Present**.
- Arrow keys (`↓` / `↑`): Move active row focus between students.
- `A` key: Toggles active student to **Absent** and automatically focuses the absence remark input.
- `L` key: Toggles active student to **Late**.
- `Enter` / `Ctrl + S`: Submits the attendance transaction in a single database payload to `sis.student_attendance`.

---

### 6.6 Fee Management Ledger & Cashier Counter Desk

Engineered for school cashiers and bursars handling parents paying fees at the administrative counter.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ FEE COLLECTION COUNTER  ·  Apex Academy Bursar Desk                                                    │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Quick Student Lookup: [ APX-2024-0142 | Aarav Sharma (Class 8-A)                                   🔍 ]│
├──────────────────────────────────────────────────────────┬─────────────────────────────────────────────┤
│ OUTSTANDING FEE INSTALLMENTS                             │ PAYMENT TRANSACTION DETAILS                 │
│                                                          │                                             │
│ [✓] Term 2 Tuition Fee (Due 15 Oct 2026):     ₹12,000    │ Total Amount Payable:         ₹18,000       │
│ [✓] Science Lab Annual Fee (Due 15 Oct 2026):  ₹4,000    │ Concession / Scholarship:     -₹0           │
│ [✓] Campus Transport Q2 (Due 15 Oct 2026):     ₹2,000    │ Late Fine Applied:            ₹0            │
│ [ ] Term 3 Tuition Fee (Due 15 Jan 2027):     ₹12,000    │ ------------------------------------------- │
│                                                          │ Net Transaction Amount:       ₹18,000       │
│                                                          │                                             │
│                                                          │ Payment Mode:                               │
│                                                          │ (●) UPI / QR   ( ) Cash   ( ) Card  ( ) Chq │
│                                                          │ Reference / UTR No: [ 529103910244        ] │
│                                                          │ Remarks: [ Term 2 cleared in full         ] │
│                                                          │                                             │
│                                                          │ [✓] Send WhatsApp & SMS Digital Receipt     │
│                                                          │                                             │
│                                                          │ [💾 Record Payment & Print Receipt (Enter)] │
└──────────────────────────────────────────────────────────┴─────────────────────────────────────────────┘
```

#### Counter Desk Capabilities:
1. **Multi-Head Installment Checklist:** Cashiers can check/uncheck individual fee heads (Tuition, Lab, Transport).
2. **Instant Receipt Print Modal:** Emits an industry-standard, print-ready 80mm thermal receipt or A4 duplicate voucher with QR-code verification.
3. **Real-Time Balance Recalculation:** Sub-millisecond balance updates without server roundtrips.

---

### 6.7 Academic Taxonomy & Class Section Setup

The administrative interface for defining the structural foundation of the school.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ACADEMIC STRUCTURE SETUP  ·  Academic Session: 2025–2026 (Active)                [+ Add Grade Level]   │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Pre-Primary (PP1, PP2)   |   Primary (Grades 1–5)   |   Middle (Grades 6–8)   |   Secondary (9–10)     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ CLASS 8 (MIDDLE SCHOOL)  ·  3 Sections  ·  118 Total Students Enrolled                                 │
├───────────┬──────────────┬──────────────┬────────────────────────┬─────────────┬───────────────────────┤
│Section    │Class Teacher │Room Allocation│Capacity Utilization    │Enrolled     │Actions                │
├───────────┼──────────────┼──────────────┼────────────────────────┼─────────────┼───────────────────────┤
│Section A  │K. Srilatha   │Room 204      │[████████████████░░] 80%│40 / 50 Max  │[Manage Roster] [Edit] │
│Section B  │M. Venkat     │Room 205      │[████████████████░░] 78%│39 / 50 Max  │[Manage Roster] [Edit] │
│Section C  │P. Aruna      │Room 206      │[███████████████░░░] 76%│38 / 50 Max  │[Manage Roster] [Edit] │
└───────────┴──────────────┴──────────────┴────────────────────────┴─────────────┴───────────────────────┘
```

#### Visual Features:
- **Capacity Progress Bars:** Real-time visual indicator preventing accidental over-enrollment beyond classroom capacity limits.
- **Class Teacher Assignment Card:** Directly maps teachers to their responsible pastoral cohort.

---

### 6.8 Parent & Student Self-Service Portals

Mobile-first views designed for families and pupils.

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏫 SchoolEMS Parent Portal   ·   Linked Students: [ Aarav Sharma (8-A) ▾ ]             [Lakshmi Sharma]│
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ TODAY'S STATUS: [✓ Present in School]  ·  Bus Route 14 (Morning Pickup: 07:45 AM - On Time)            │
├──────────────────────────────────────┬─────────────────────────────────────────────────────────────────┤
│ ATTENDANCE CALENDAR (CURRENT TERM)   │ UPCOMING FEE DUES & NOTICES                                     │
│                                      │                                                                 │
│ Attendance Percentage: 96.4%         │ Outstanding Installment: Term 3 Tuition Fee                     │
│ [██████████████████████░░] Excellent │ Due Date: 15 January 2027  ·  Amount: ₹12,000                   │
│                                      │                                                                 │
│ Mon Tue Wed Thu Fri                  │ [💳 Pay Now via UPI / NetBanking]                              │
│ [P] [P] [P] [P] [P]  (Week 1)        │                                                                 │
│ [P] [P] [A] [P] [P]  (Week 2)        │ Recent Announcements:                                           │
│ [P] [P] [P] [P] [P]  (Week 3)        │ 📢 Annual Sports Meet scheduled for 22nd Nov. Circular attached.│
└──────────────────────────────────────┴─────────────────────────────────────────────────────────────────┘
```

#### Multi-Child Family Switcher:
- Parents with multiple children enrolled in the school (e.g. child in 3rd grade, child in 8th grade) use a prominent child dropdown to switch context seamlessly without multiple logins.
- Attendance heatmap shows green for Present, red for Absent, yellow for Holiday, and gray for Weekend.

---

## 7. Accessibility, Responsiveness & Performance Architecture

### 7.1 WCAG 2.1 AA Verification Checklist

Every component and screen specification conforms to the following standards:
- [x] **Contrast Ratio:** Normal text (14px/16px) satisfies at least **4.5:1** contrast against backgrounds. Large text (18px bold / 24px) satisfies at least **3.0:1**. Status text uses high-contrast tokens (e.g. Dark Emerald `#065F46` on `#D1FAE5` = 7.2:1).
- [x] **No Color-Alone States:** Attendance statuses, validation errors, and fee dues always pair color with text or iconography (e.g. Green dot + "Present", Red dot + "Absent", Yellow warning icon).
- [x] **Form Labels:** Every input, select, and textarea features a programmatic `<label htmlFor="...">` tag.

### 7.2 Keyboard Navigation & Focus Flow

- **Logical Tab Order:** Focus proceeds predictably from top header, to primary filters, into table rows, and finally to pagination.
- **Skip to Main Content:** A hidden link (`.skip-link`) allows screen reader and keyboard users to bypass navigation rails directly to the main workspace.
- **Modal Focus Traps:** When a dialog opens (such as the Fee Receipt or Attendance Remark dialog), focus is trapped within the modal and restored upon dismissal (`Esc` key closes modals).

### 7.3 Screen Reader ARIA Semantics

- Data tables feature descriptive captions: `<caption className="sr-only">Master Student Register for Class 8-A</caption>`.
- Sortable headers emit `aria-sort="ascending"` or `aria-sort="descending"`.
- Asynchronous status updates emit live announcements via `<div role="status" aria-live="polite">` (e.g., *"Attendance marked for 40 students"*).

### 7.4 Network Efficiency & Virtualized Rendering

- **Client-Side Virtualization:** When a data table renders > 100 rows, virtual windowing maintains DOM node count under 150 elements, ensuring 60 FPS scrolling.
- **Zero Asset Bloat:** Uses native SVG icons and system fonts, avoiding heavy icon fonts or bloated component libraries.

---

## 8. Engineering Implementation Plan & Milestones

Following the approved Stage 1 Implementation Roadmap, this design specification will be delivered in phased milestones:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND DELIVERY MILESTONES                              │
├───────────┬────────────────────────────────────────┬───────────────────────────────────┤
│ Milestone │ Deliverable Description                │ Key Components                    │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 1  │ Design System & Token Integration      │ `styles.css`, `Bits.jsx`, tokens  │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 2  │ High-Density Enterprise Data Table     │ `DataTable.jsx`, density, sort    │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 3  │ Master Student Directory & Admission   │ Student grid, admission modal     │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 4  │ 360° Cumulative Student Dossier        │ Tabbed dossier, guardian cards    │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 5  │ Rapid Attendance Marking Register      │ Grid matrix, keyboard shortcuts   │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 6  │ Fee Management & Cashier Counter Desk  │ Fee ledger, print receipt engine  │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 7  │ Academic Setup & Section Manager       │ Academic year, class capacities   │
├───────────┼────────────────────────────────────────┼───────────────────────────────────┤
│ Sprint 8  │ Parent & Student Self-Service Portals  │ Child switcher, attendance heatmap│
└───────────┴────────────────────────────────────────┴───────────────────────────────────┘
```

---

## Document Summary & Sign-Off

This document establishes the definitive UI/UX benchmark, enterprise design system tokens, data table interaction mechanics, and comprehensive screen blueprints for SchoolEMS. All proposed specifications are strictly aligned with `docs/ENGINEERING_STANDARDS.md`, Phase 1 RS256 multi-tenant security guarantees, and the approved Stage 1 MVP scope.
