# Document 10: Accessibility (a11y) & Inclusive Design Guidelines

**Document Status:** APPROVED ACCESSIBILITY GUIDELINES  
**Classification:** Inclusive Design, WCAG 2.2 AA Conformance Target & Universal Access  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  
**Engineering Target:** W3C Web Content Accessibility Guidelines (WCAG) 2.2 Level AA  

---

## 1. Accessibility Policy & Universal Design Mission

School software serves a wide spectrum of users: educators with visual impairments, parents navigating software in varied ambient lighting, clerical staff using keyboard navigation for repetitive data entry, and students requiring predictable layouts.

SchoolEMS commits to **WCAG 2.2 Level AA** as an engineering design and quality target across all roles and interfaces.

### 1.1 Dual-Track Verification Standard
To ensure real-world usability, accessibility evaluation is divided into two distinct tracks:
1. **Automated Structural Audits:** Continuous integration linting (e.g. `axe-core`, ESLint a11y plugin) checking for missing `alt` attributes, unassociated labels, duplicate IDs, and basic contrast ratios. *(Covers approximately 30–40% of WCAG criteria).*
2. **Manual Functional Evaluation:** Mandatory human evaluation covering:
   - Full keyboard navigation without a mouse (`Tab`, `Shift+Tab`, `Space`, `Enter`, `Escape`, arrow keys).
   - Focus ring visibility and logical tab order.
   - Modal focus traps and dismissal restoration.
   - Screen-reader verification using NVDA on Windows and VoiceOver on macOS/iOS.

---

## 2. Core Accessibility Pillars & Conformance Rules

### 2.1 Color Contrast Targets (WCAG 1.4.3 & 1.4.11)
- **Normal Text (14px / 16px):** Contrast ratio must meet or exceed **4.5:1** against adjacent background.
  - Heading Slate (`#0F172A`) on White (`#FFFFFF`): 16.1:1 (Exceeds AA/AAA).
  - Body Slate (`#334155`) on White: 9.8:1 (Exceeds AA/AAA).
  - Muted Column Header (`#475569`) on Neutral Canvas (`#F8FAFC`): 6.9:1 (Exceeds AA).
- **Large Text (18px bold / 24px+):** Contrast ratio must meet or exceed **3.0:1**.
- **Interactive UI Components & Form Borders (1.4.11):** Form input borders and toggles must meet at least **3.0:1** contrast against adjacent surfaces.

### 2.2 Non-Color Dependent Communication (WCAG 1.4.1)
Color must never be the sole visual cue to convey state, error, or urgency.
- **Attendance Statuses:** Always pair color with explicit text or icon abbreviations:
  - Present: Green background + checkmark glyph + text label `Present` (`P`).
  - Absent: Red background + cross glyph + text label `Absent` (`A`).
  - Late: Amber background + clock glyph + text label `Late` (`L`).
- **Fee Overdue Status:** Amber/Red badge paired with exact balance text and warning icon (`⚠️ Due ₹4,500`).
- **Required Form Fields:** Red asterisk paired with an explicit `(required)` label or screen reader text `<span className="sr-only">required</span>`.

### 2.3 Keyboard Navigation & Visible Focus (WCAG 2.1.1, 2.4.7 & 2.4.11)
Every administrative, clerical, and educational task must be operable using a keyboard alone:
- **Unambiguous Focus Indicator:** All focusable elements must display a high-contrast focus indicator:
  ```css
  :focus-visible {
    outline: 2px solid var(--color-brand-600);
    outline-offset: 2px;
  }
  ```
- **Logical Tab Flow:** Focus proceeds predictably from header context anchors, through table rows, and into pagination controls.
- **Skip to Content Link:** Provided at the top of the application shell:
  ```html
  <a href="#main-content" class="skip-link">Skip to main content</a>
  ```
- **Modal Focus Trapping:** When a modal or drawer opens, focus is trapped inside the container until dismissed via `Esc` or button click. Upon closing, focus returns to the initiating trigger button.

### 2.4 Semantic HTML & Screen Reader Support (WCAG 1.3.1 & 4.1.2)
- **Table Data Structures:**
  - Standard semantic elements: `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`.
  - Column headers must define `<th scope="col">`.
  - Sortable headers announce sorting state via `aria-sort="ascending"|"descending"|"none"`.
- **Live Regions for Asynchronous Updates:**
  - Toast notifications and status changes announce via polite live regions:
    ```html
    <div role="status" aria-live="polite" class="sr-only">
      Attendance submitted for Class 8-A.
    </div>
    ```

### 2.5 Form Accessibility & Error Handling (WCAG 3.3.1 & 3.3.2)
- **Explicit Label Binding:** Every form input is bound to an accessible label via `id` and `htmlFor`.
- **Inline Error Association:** Failed inputs reference their specific error message via `aria-describedby` and set `aria-invalid="true"`.
