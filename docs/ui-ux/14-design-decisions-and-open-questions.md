# SchoolEMS — Architecture Decision Records (ADRs) & Open Operational Questions

**Document Version:** 1.0.0 (Revised)  
**Status:** APPROVED ARCHITECTURAL DECISIONS & RESOLVED QUESTIONS  
**Governing Standard:** `docs/ENGINEERING_STANDARDS.md`  
**Target Platform:** React 18.3.1 / Modern JavaScript / Vanilla CSS Design Tokens (Local-First)  

---

## 1. Architectural Decision Records (ADRs)

### ADR-UI-01: Native CSS Custom Properties & BEM Classes vs Heavy CSS-in-JS Runtimes

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  SchoolEMS requires a fast, low-overhead design system that runs 100% locally on diverse hardware (from administrator desktops to budget school laptops and mobile browsers). External build tooling complexities and CSS-in-JS runtime style injection overhead add unnecessary bundle bloat and can degrade frame rates.
- **Decision:**  
  Standardize on native CSS Custom Properties (CSS variables) declared in centralized stylesheets (`tokens.css`), paired with semantic component classes. Zero CSS-in-JS runtime libraries.
- **Rationale:**  
  1. *Zero Runtime Overhead:* Native CSS variables resolve instantaneously in modern browser engines with zero JavaScript execution cost.
  2. *Instant Theme & Density Switching:* Modifying table density requires changing a single attribute on the root or table element (`data-density="compact"`), instantly updating all nested cells via CSS cascade.
  3. *Local-First Simplicity:* Complies with `ENGINEERING_STANDARDS.md` by eliminating external CDN dependencies.
- **Consequences:**  
  Components must strictly use declared CSS variables (`var(--color-brand-600)`) and avoid inline style hacks.

---

### ADR-UI-02: Native Semantic HTML Table Engine vs Heavy External Grid Libraries

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  School registers (Student Directory, Attendance Register, Staff List) require dense tabular displays with sticky headers and pinned identification columns. Introducing heavy commercial grid packages (AG Grid, MUI DataGrid) introduces bundle bloat, licensing restrictions, and styling conflicts with custom school workflows. Furthermore, `package.json` currently contains only `react`, `react-dom`, and `react-router-dom`.
- **Decision:**  
  Build the table engine using native semantic HTML elements (`<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`) styled with internal CSS design tokens and server-side pagination (25–50 rows/page). Headless table libraries (e.g. TanStack Table) will be evaluated on-demand only if dynamic multi-column resizing or complex drag-reordering is required; virtual scrolling is deferred unless unpaginated continuous lists (> 100 rows) cause measurable performance drops.
- **Rationale:**  
  1. *Zero Additional Dependencies:* Avoids adding unvetted third-party packages to the frontend repository.
  2. *Superior Native Accessibility:* Standard HTML tables natively provide predictable keyboard navigation, assistive technology semantics (`th[scope="col"]`), and standard browser rendering.
  3. *Lightweight Footprint:* Keeps the initial frontend bundle fast to load even on slower school internet connections.
- **Consequences:**  
  Pagination, sorting parameters, and column pinning must be managed through standard React state and URL query parameters.

---

### ADR-UI-03: Tri-Modal Density Architecture (34px, 44px, 54px)

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  School personnel possess widely differing ergonomic needs. Fast clerical operators handling hundreds of student records need high information density, while teachers on touch tablets and parents on phones require larger touch targets.
- **Decision:**  
  Implement a tri-modal density engine across data tables:
  - **Compact (34px row height):** Designed for high-volume clerical review and administrative registers.
  - **Default (44px row height):** Standard balance for daily administrative navigation and reporting.
  - **Comfortable (54px row height):** Optimized for touch tablets, novice users, and relaxed viewing.
- **Rationale:**  
  User density preference is stored in browser `localStorage`, ensuring persistence across sessions.
- **Consequences:**  
  All cell contents, badges, and action buttons must fit cleanly within a 34px height envelope without visual clipping.

---

### ADR-UI-04: Voluntary Alternative ID Collection & Masked Display Architecture

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  School admissions frequently encounter questions regarding student and guardian national identification numbers (such as Aadhaar). Storing plaintext national IDs in unencrypted database columns or displaying them openly on administrative screens introduces serious privacy risks. Furthermore, software design cannot provide legal compliance guarantees.
- **Decision:**  
  1. National ID (Aadhaar) collection is marked explicitly **Voluntary** on all admission forms with alternative valid ID options (Birth Certificate, Passport, School Transfer Certificate).
  2. Plaintext national identity numbers are never stored in unencrypted form or rendered openly in standard table registers.
  3. The frontend displays only a masked token (`●●●● ●●●● 8192`) in registers and dossier views.
  4. The documentation makes no claims of legal compliance; privacy-by-design principles are applied as an engineering measure.
- **Rationale:**  
  Protects minor student privacy, minimizes institutional risk, and adheres to strict data minimization principles.
- **Consequences:**  
  Administrators cannot search by the middle digits of national IDs; search is restricted to admission number, legal name, phone number, and last-4 ID digits.

---

### ADR-UI-05: Homeroom Attendance Register with Explicit Confirmation Review

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  Homeroom teachers need to mark class attendance quickly during morning registration. However, shortcuts that silently modify an entire class without confirmation risk accidental truant misreporting or erroneous absence notices.
- **Decision:**  
  Provide an ergonomic attendance register that pairs speed with safety:
  - `Pre-fill All Present`: Sets all students in the roster to Present, but displays an active unsaved changes notice.
  - Keyboard navigation: Arrow keys navigate between students; `A` toggles Absent and focuses remarks.
  - **Mandatory Review Modal:** Submitting attendance opens an explicit confirmation dialog displaying the summary counts (e.g. *"38 Present, 2 Absent"*) and listing the names of absent students before the atomic database commit.
  - **Reversibility:** Submitted attendance can be corrected by authorized staff with audit tracking.
- **Rationale:**  
  Protects against accidental false attendance reports while keeping the workflow efficient for teachers.
- **Consequences:**  
  Submitting attendance requires one additional confirmation click, but eliminates truant misreporting.

---

### ADR-UI-06: Rapid-Inspection Drawer vs Multi-Tab Browser Sprawl

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  School staff frequently open dozens of browser tabs when inspecting student profiles or guardian contact details, causing browser clutter and lost table filter states.
- **Decision:**  
  Utilize a right-hand Slide-Over Drawer for quick profile lookups and minor edits. The underlying master table remains mounted, preserving its scroll position, search query, and applied filters.
- **Rationale:**  
  Maintains user focus and context, reduces browser memory usage, and enables rapid inspection across records.
- **Consequences:**  
  URL query parameters (e.g. `?studentId=123&drawer=profile`) must be supported so drawer states can be bookmarked or shared.

---

### ADR-UI-07: Clean Browser Print Stylesheet for Fee Receipts (Release 2)

- **Status:** Proposed
- **Date:** March 2026
- **Context:**  
  School cashier desks require printed receipts upon payment recording. Complex thermal printer driver integrations (ESC/POS) introduce hardware coupling and cross-platform complexity for an MVP.
- **Decision:**  
  Standardize on clean, browser-native print stylesheets (`@media print`) for official A4 institutional receipt vouchers in Release 2. Specialized 80mm thermal receipt printing is deferred as an optional future enhancement.
- **Rationale:**  
  Works with standard browser print dialogs (`window.print()`) across all modern operating systems and desktop printers without proprietary hardware dependencies.
- **Consequences:**  
  Print stylesheets must be tested in Chrome, Firefox, and Edge to verify page break rules and margin cleanliness.

---

## 2. Formally Approved Operational Decisions (OD-01 to OD-05)

The following five operational decisions have been formally approved by stakeholders and incorporated into the SchoolEMS product architecture:

### OD-01: Academic Year Rollover & Controlled Promotion Review
- **Decision:** **APPROVED**
- **Approved Workflow:** Controlled academic-year promotion review workflow (no automatic blanket promotion).
- **Core Requirements:**
  - Displays eligible enrolled students with current grade and section.
  - Authorised administrators review and adjust proposed next-year class/section assignments.
  - Prominently highlights students requiring review (academic holds, attendance flags, administrative review).
  - Allows inline corrections before confirmation.
  - Requires explicit final confirmation modal before applying cohort promotions.
  - Records the promotion operation with immutable audit information (admin ID, timestamp, counts).
  - Prevents accidental duplicate or partial promotion through atomic transactions.
  - Preserves historical academic-year enrollment records.
  - Excludes complex external examination prerequisite systems.

### OD-02: Offline Attendance Handling (Release 1 In-Memory Resilience)
- **Decision:** **APPROVED**
- **Release 1 Scope:**
  - Unsubmitted attendance is temporarily kept in browser memory during network drops.
  - Persistent high-visibility offline / connection-lost alert banner appears.
  - Preserves the teacher's unsaved markings while the page remains open.
  - Provides a manual retry button when connectivity returns.
  - Clear visual states for `Saved`, `Unsaved Changes`, and `Submission Failed`.
  - Prevents accidental duplicate submissions while request is in flight.
  - Browser `beforeunload` warning alerts teacher if attempting to close or refresh page with unsaved changes.
- **Explicit Deferrals:** Complex IndexedDB persistence, background synchronization, and automatic conflict resolution are deferred beyond Release 1.

### OD-03: Parent Multi-Child Selector Architecture (Release 2)
- **Decision:** **APPROVED**
- **Approved Architecture:** Persistent child selector in the Parent Portal global header.
- **Core Requirements:**
  - Displays only children explicitly linked to the authenticated parent/guardian in `sis.student_guardians`.
  - Provides a clear persistent selected-child indicator pill in the header.
  - Maintains selected child context consistently across all parent pages (attendance, timetable, homework, fees).
  - Backend enforces child-specific permissions on every API request; client selector is an ergonomic control, never an authorization mechanism.
  - Switching children immediately purges child-specific cached data to ensure zero cross-child information leakage.
  - Respects Phase 2 child-specific permission model.

### OD-04: Controlled Fee Concessions Workflow (Release 2)
- **Decision:** **APPROVED — RELEASE 2**
- **Approved Workflow:** Controlled fee concession and waiver management.
- **Core Requirements:**
  - Supports predefined concession categories (e.g. Sibling Discount, Staff Child, Merit Concession).
  - Records concession category, type (fixed amount vs percentage), reason text, student ID, and applicable fee head.
  - Restricts ordinary cashier counter actions to selecting approved concession categories within configured limits.
  - Requires Principal or explicitly authorized administrator approval for exceptional manual fee waivers before payment settlement.
  - Records requesting cashier, approving administrator, decision timestamp, and rationale in immutable audit trail.
  - Concessions reflect dynamically in outstanding balances and fee receipts.
  - Strictly prohibits alteration or discounting of historical cleared payment records.
  - Excludes complex scholarship scoring, payroll deductions, and payment gateways.

### OD-05: Student Photograph Upload (Release 1)
- **Decision:** **APPROVED**
- **Release 1 Scope:**
  - Standard image file upload (`image/jpeg`, `image/png`, maximum 2MB limit).
  - Instant client-side aspect-ratio preview (3:4 passport photo ratio).
  - File type and size validation with inline error feedback.
  - Clear upload, replacement, and removal interactions.
  - Clear loading and error states.
  - Photograph access restricted strictly to authorized staff roles.
  - Stored locally with UUID hashing and binary magic-byte validation; avoids exposing private URLs.
  - Webcam hardware capture is explicitly deferred.

---

## 3. Open Questions Status

All five primary operational decisions (OD-01 through OD-05) are now resolved, approved, and integrated into the specification suite. No unresolved architecture questions remain blocking Stage 1 MVP implementation. Future release enhancements (e.g. online payment webhooks, external SMS gateways) will be evaluated during Phase 3 planning.
