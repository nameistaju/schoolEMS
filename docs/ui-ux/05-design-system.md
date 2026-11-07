# Document 05: SchoolEMS Design System & Component Guidelines

**Document Status:** APPROVED DESIGN SYSTEM SPECIFICATION  
**Classification:** Enterprise Design System, Token Architecture & UI Guidelines  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  
**Accessibility Engineering Target:** W3C WCAG 2.2 Level AA  

---

## 1. Visual Direction & Aesthetic Philosophy

SchoolEMS adheres to a **Modern Light-First Enterprise SaaS** aesthetic:
- **Calm Surfaces:** Neutral canvas backgrounds (`#F8FAFC`, `#F1F5F9`) paired with pure white cards (`#FFFFFF`) to support long clerical sessions.
- **Authoritative Primary Cobalt:** A professional cobalt blue (`#2563EB`) anchors primary interactive actions.
- **Operational Visual Language:** Zero decorative gradients or distracting animations; colors indicate status, urgency, or action.
- **Structural Grouping:** 1px borders (`#E2E8F0`) and subtle functional elevation (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)`) provide visual hierarchy.

---

## 2. Complete Design Token Architecture

### 2.1 Color Palette & Contrast Targets

```css
:root {
  /* --- Slate Neutral Scale (Backgrounds, Surfaces, Text) --- */
  --color-slate-900: #0F172A; /* Primary Headings (Calculated contrast 16.1:1 on white) */
  --color-slate-800: #1E293B; /* Navigation rails & Primary card headers */
  --color-slate-700: #334155; /* Body text (Calculated contrast 9.8:1 on white) */
  --color-slate-600: #475569; /* Muted text & column labels (Calculated contrast 7.1:1 on white) */
  --color-slate-500: #64748B; /* Form placeholders (Calculated contrast 4.6:1 on white) */
  --color-slate-400: #94A3B8; /* Disabled text & inactive icons */
  --color-slate-300: #CBD5E1; /* Secondary dividers */
  --color-slate-200: #E2E8F0; /* Primary borders */
  --color-slate-100: #F1F5F9; /* Zebra row background & input fills */
  --color-slate-50:  #F8FAFC; /* Page canvas background */
  --color-white:     #FFFFFF; /* Pure card surface */

  /* --- Interactive Cobalt Scale --- */
  --color-brand-900: #1E3A8A; /* Active button press */
  --color-brand-800: #1E40AF; /* Primary Hover */
  --color-brand-700: #1D4ED8; /* Focus accent */
  --color-brand-600: #2563EB; /* Primary Button & Active Nav (Contrast 4.68:1 on white) */
  --color-brand-500: #3B82F6; /* Accessible Focus Ring */
  --color-brand-100: #DBEAFE; /* Selected row tint & Badge background */
  --color-brand-50:  #EFF6FF; /* Subtle row hover */

  /* --- Semantic Status Tokens (Targets WCAG 2.2 AA text contrast >= 4.5:1) --- */
  /* Success: Present Attendance, Paid Fees, Active Status */
  --color-success-text: #065F46; /* Calculated contrast 7.2:1 against bg */
  --color-success-bg:   #D1FAE5;
  --color-success-base: #059669;

  /* Warning / Pending: Partial Payment, Late Arrival, In Review */
  --color-warning-text: #92400E; /* Calculated contrast 5.8:1 against bg */
  --color-warning-bg:   #FEF3C7;
  --color-warning-base: #D97706;

  /* Danger / Critical: Absent, Overdue Fees, Allergy Alert, Withdrawn */
  --color-danger-text:  #991B1B; /* Calculated contrast 7.4:1 against bg */
  --color-danger-bg:    #FEE2E2;
  --color-danger-base:  #DC2626;

  /* Info: Transferred, Notice, Archive */
  --color-info-text:    #075985;
  --color-info-bg:      #E0F2FE;
  --color-info-base:    #0284C7;
}
```

### 2.2 Typography System & Tabular Numbers

SchoolEMS standardizes on a system sans-serif font stack with **tabular figures** (`font-variant-numeric: tabular-nums`) to ensure numbers align vertically in tables and financial ledgers:

```css
:root {
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  /* Font Scale & Line Heights */
  --text-xs:   0.75rem;   /* 12px / Line height: 16px (Badges, Micro Metadata) */
  --text-sm:   0.875rem;  /* 14px / Line height: 20px (Data Table Cells, Inputs) */
  --text-base: 1rem;      /* 16px / Line height: 24px (Body Text, Primary Buttons) */
  --text-lg:   1.125rem;  /* 18px / Line height: 28px (Section Headers, Card Titles) */
  --text-xl:   1.25rem;   /* 20px / Line height: 28px (Modal Headings) */
  --text-2xl:  1.5rem;    /* 24px / Line height: 32px (Primary View Title, KPI Stats) */
  --text-3xl:  1.875rem;  /* 30px / Line height: 36px (Top-Level Dashboard Hero) */

  /* Font Weights */
  --font-normal:   400;
  --font-medium:   500;
  --font-semibold: 600;
  --font-bold:     700;
}

/* Numeric precision formatting */
.tabular-nums, table, .currency-amount, .roll-number, .stat-counter {
  font-variant-numeric: tabular-nums;
}
```

### 2.3 Row Density Tokens for Data Tables

```css
:root {
  /* Density Mode Heights */
  --table-row-h-compact:     34px; /* Dense administrative scanning */
  --table-row-h-default:     44px; /* Standard balanced daily operations */
  --table-row-h-comfortable: 54px; /* Touch-friendly tablets / loose views */

  /* Cell Padding Scales */
  --table-cell-p-compact:     4px 8px;
  --table-cell-p-default:     8px 12px;
  --table-cell-p-comfortable: 14px 16px;
}
```

### 2.4 Focus Indicator & Border Radii

```css
:root {
  /* Focus indicator strictly adhering to WCAG 2.2 visible focus requirements */
  --focus-ring-color:  var(--color-brand-600);
  --focus-ring-offset: 2px;
  --focus-ring-width:  2px;

  /* Elevation Shadows */
  --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04);
  --shadow-lg: 0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.03);

  /* Border Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;
}

:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```
