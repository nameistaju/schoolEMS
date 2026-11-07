# SchoolEMS — Design Acceptance Criteria & Quality Gates

**Document Version:** 1.0.0 (Revised)  
**Status:** APPROVED ACCEPTANCE CRITERIA SPECIFICATION  
**Governing Standard:** `docs/ENGINEERING_STANDARDS.md` (14-Point Definition of Done)  
**Accessibility Engineering Target:** WCAG 2.2 Level AA  
**Target Platform:** React 18.3.1 / Modern Browser Standards (Desktop, Tablet, Mobile)  

---

## 1. Purpose & Verification Philosophy

This document defines the objective, measurable acceptance criteria that every user interface screen, component, and interaction within SchoolEMS must satisfy prior to staging sign-off and production release.

In accordance with Section 1 of `docs/ENGINEERING_STANDARDS.md`, incomplete implementations, placeholder UI states, unverified designs, and unstyled mock elements are strictly prohibited. Every design deliverable must be verified against real data and realistic conditions during implementation.

---

## 2. Verification Checklist Across 6 Quality Dimensions

### Dimension 1: Design System & Visual Token Fidelity

| ID | Criterion | Verification Method | Acceptance Threshold | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **DS-01** | **Strict Token Usage** | Code review & CSS linting | 100% of colors, margins, paddings, border radii, and z-indexes use `var(--token)`. Zero hardcoded hex codes (`#xxxxxx`) in component files. | [ ] |
| **DS-02** | **Typography Scale** | DOM inspection | Font sizes adhere strictly to the declared system scale. Heading levels (`h1`-`h6`) follow semantic hierarchy. | [ ] |
| **DS-03** | **Tabular Numeral Alignment** | Visual & layout inspection | Monetary amounts, dates, roll numbers, percentages, and phone numbers render with `font-variant-numeric: tabular-nums`. | [ ] |
| **DS-04** | **Consistent Iconography** | Visual inspection | Icons utilize local SVG assets with uniform stroke widths and explicit `aria-hidden="true"` or accessible titles. | [ ] |
| **DS-05** | **Zero Layout Shift (CLS)** | Web Vitals inspection | Cumulative Layout Shift (CLS) $\le 0.05$ across standard page loads. Containers reserve fixed dimensions. | [ ] |

---

### Dimension 2: Enterprise Data-Table & Register Performance

| ID | Criterion | Verification Method | Acceptance Threshold | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **DT-01** | **Tri-Density Modes** | Interactive testing | User can toggle between Compact (34px), Default (44px), and Comfortable (54px) rows without re-fetching data or resetting scroll position. | [ ] |
| **DT-02** | **Rendering Smoothness** | Browser devtools profiling | Standard paginated views (50 rows) render cleanly without visible frame drops or layout stutter on developer hardware. | [ ] |
| **DT-03** | **Pinned Header & Columns** | Horizontal scroll test | Table header remains fixed during vertical scroll. Checkbox and Student Name/ID columns remain pinned to the left edge during horizontal scroll. | [ ] |
| **DT-04** | **Search Debouncing** | Network / state trace | Real-time table search input is debounced by 250ms. Filter queries do not trigger redundant re-renders on whitespace. | [ ] |
| **DT-05** | **Multi-Row Batch Actions** | Interactive testing | Selecting $\ge 1$ rows reveals the contextual Batch Action Bar. Total count of selected records is announced to assistive technology. | [ ] |
| **DT-06** | **Stateful Empty & Loading Views** | Network simulation | Skeleton loaders render in-place without shifting columns. Zero-data search results display a clear message with a "Clear Filters" CTA. | [ ] |

---

### Dimension 3: Operational Ergonomics & School Workflows

| ID | Criterion | Verification Method | Acceptance Threshold | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **OP-01** | **Attendance Register & Offline Resilience (OD-02)** | Functional & network drop test | Roster supports pre-fill present, single-row absent marks, and mandatory absent confirmation modal before commit. If offline, state is kept in memory with persistent alert and manual retry; beforeunload warns on tab close. | [ ] |
| **OP-02** | **Student Admission & Photo Upload (OD-05)** | Wizard testing & file validation | Multi-step form validates JPEG/PNG upload (max 2MB) with instant preview and replace/remove controls; exit guards prevent data loss. | [ ] |
| **OP-03** | **Academic Year Rollover Review (OD-01)** | Promotion simulation test | Admin reviews eligible students, current section, and proposed section; students with holds are highlighted; inline overrides allowed; requires confirmation modal; audit log generated. | [ ] |
| **OP-04** | **Student Bulk Import Workflow** | CSV/XLSX validation test | Uploads template, parses rows, highlights validation errors inline, detects duplicates, and executes atomic commit into SIS tables. | [ ] |
| **OP-05** | **Academic Calendar Event Management** | Calendar matrix audit | Events render by month/term with category pills; admins can create/edit events; students/parents receive read-only view. | [ ] |
| **OP-06** | **Parent Multi-Child Selector (OD-03)** | Multi-child context audit (Rel 2)| Persistent header selector displays only explicitly linked children; switching child updates view and clears old cache; backend validates every request. | [ ] |
| **OP-07** | **Fee Counter & Controlled Concessions (OD-04)**| Counter simulation (Release 2) | Cashier applies pre-approved concession categories within limits; exceptional waivers require Principal approval; audit log created; cleared payments protected. | [ ] |
| **OP-08** | **Basic Staff Leave Management** | Leave workflow test (Release 2) | Staff submits leave dates and reason; Principal reviews and approves/rejects with notes; request status and history update accurately. | [ ] |
| **OP-09** | **Sensitive Identity Masking** | Security inspection | National identification numbers (e.g. Aadhaar) display only as masked tokens (`●●●● ●●●● 8192`). Plaintext numbers are never rendered in standard UI views. | [ ] |

---

### Dimension 4: Accessibility (WCAG 2.2 Level AA Engineering Targets)

| ID | Criterion | Verification Method | Acceptance Threshold | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **A11Y-01**| **Color Contrast Ratios** | Automated Axe / Color Picker | Body text $\ge 4.5:1$; Large text $\ge 3.0:1$; UI boundaries, form borders, and icon controls $\ge 3.0:1$ against adjacent backgrounds. | [ ] |
| **A11Y-02**| **Non-Color Status Coding** | Visual inspection | 100% of status badges pair color with a distinct typographic label AND a unique SVG icon glyph. Zero color-only communication. | [ ] |
| **A11Y-03**| **Visible Focus Indicators** | Keyboard Tab traversal | Every interactive element displays a high-contrast focus indicator (`2px solid var(--color-brand-600)`, offset 2px). | [ ] |
| **A11Y-04**| **Logical Tab Sequence** | Keyboard traversal | Focus flows sequentially from top-to-bottom, left-to-right. Skip-to-content link appears on first tab stroke on all views. | [ ] |
| **A11Y-05**| **Modal Focus Traps** | Keyboard testing | When a modal opens, focus is trapped within the container. Pressing `Escape` closes the dialog. Upon closing, focus returns to the initiating trigger. | [ ] |
| **A11Y-06**| **Screen Reader Announcement**| Screen reader testing (NVDA/VoiceOver) | Status updates, error alerts, and toast notifications announce via `aria-live="polite|assertive"` without disrupting active user input. | [ ] |

---

### Dimension 5: Responsive & Touch Ergonomics

| ID | Criterion | Verification Method | Acceptance Threshold | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **RESP-01**| **Minimum Touch Targets** | Mobile touch inspection | On viewport $< 768\text{px}$, tappable controls, table actions, and navigation links measure at least $44 \times 44\text{px}$ in touch bounding area. | [ ] |
| **RESP-02**| **Mobile Table Transformation**| Viewport resize testing | On mobile screens ($< 768\text{px}$), dense administrative tables transition to stacked data cards or pinned-column horizontal scroll. | [ ] |
| **RESP-03**| **Zero Unintended Horizontal Overflow**| Viewport audit (360px–1920px)| Page body never displays an unintended horizontal scrollbar at any breakpoint between 360px and 2560px width. | [ ] |
| **RESP-04**| **Collapsible Navigation Shell**| Mobile menu testing | Desktop sidebar collapses into a slide-over drawer on viewports $< 1024\text{px}$, with backdrop dismiss. | [ ] |

---

### Dimension 6: Cross-Browser & Environment Reliability

| ID | Criterion | Verification Method | Acceptance Threshold | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| **XBR-01** | **Browser Matrix Coverage** | Cross-browser testing | Verified consistent visual rendering and interaction behavior on Google Chrome, Mozilla Firefox, Apple Safari, and Microsoft Edge. | [ ] |
| **XBR-02** | **Offline Network Alerting** | Network disconnect test | Dropping network connection displays a persistent, non-intrusive offline indicator. Form submissions alert user before data loss. | [ ] |
| **XBR-03** | **Local-First Zero External Leakage**| Network inspection | Zero outbound requests to external CDNs, fonts, or tracking scripts. All assets load from localhost or the configured application server. | [ ] |

---

## 3. Engineering Standards Definition of Done (DoD) Gate

Before any UI task is marked complete during implementation, it must be verified against the 14 mandatory criteria of `docs/ENGINEERING_STANDARDS.md`:

1. [ ] **Complete Implementation:** No placeholder functions, no mock data in production code paths, no stubbed buttons.
2. [ ] **Architecture Alignment:** Fully adheres to multi-tenant school/branch hierarchy and `04-information-architecture.md`.
3. [ ] **Multi-Tenant Boundary:** UI components always pass and display the active `school_id` and `branch_id` contexts.
4. [ ] **Database & Schema Hygiene:** All data bindings reflect the validated PostgreSQL `sis` schema entities.
5. [ ] **Security & Access Control:** Role-based visibility gates restrict unauthorized buttons, links, and forms.
6. [ ] **No Hardcoded Secrets or Values:** Config, tenant IDs, and credentials use environment variables.
7. [ ] **Data Integrity & Validation:** Frontend validation mirrors server-side constraints (lengths, formats, required fields).
8. [ ] **Error Handling & Resilience:** Robust error states render clear user-facing messages rather than crashing the UI.
9. [ ] **Auditing & Logging:** Critical administrative actions trigger audit events via API calls.
10. [ ] **Testing:** Automated test coverage for component states, rendering, and critical workflows.
11. [ ] **Performance & Resource Hygiene:** Paginated queries for large datasets; zero uncollected timers or event listeners.
12. [ ] **Code Quality & Maintainability:** Clean, documented React code following component directory structure.
13. [ ] **Documentation & Traceability:** Code changes cross-reference design documents and feature IDs.
14. [ ] **Clean Repository & Git Hygiene:** Zero extraneous temporary files, debug code, or commented-out blocks.
