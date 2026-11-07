# Document 01: Product Design Brief & Strategic Scope

**Document Status:** APPROVED PRODUCT DESIGN BRIEF  
**Classification:** Enterprise UX Architecture & Product Strategy  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  
**Target Environment:** 100% Local-First (Node.js 20+, PostgreSQL 18.6 RLS, React 18.3.1, Vite 5.4.11)  
**Infrastructure Dependency:** **NONE (Zero Cloud Dependencies, Cloud-Independent)**  

---

## 1. Product Vision & Mission

**SchoolEMS** is a multi-tenant Educational Operations and School Management SaaS platform designed for independent K–12 schools, multi-campus institutions, and educational trusts. The platform pairs strict tenant and branch data isolation with an ergonomic, responsive, and role-tailored user experience.

### 1.1 The Operational Problem in School Software
Existing school management software and educational ERPs typically present two extremes:
1. **Legacy Administrative Portals:** Characterized by cluttered forms, poor visual hierarchy, broken mobile experiences, inadequate contrast, and deep navigation trees requiring excessive clicks for routine clerical operations.
2. **Consumer-Grade Mobile Wrappers:** Modern in appearance but lacking support for high-density administrative data tables, rapid batch workflows, financial reconciliation ledgers, keyboard navigation, and auditable data controls required by school administrators, bursars, and principals.

### 1.2 The SchoolEMS Product Tenets
SchoolEMS addresses these requirements with an **"Anti-Clutter, High-Density Productivity"** design approach:
- **Purposeful Visual Language:** Visual elements communicate operational state, urgency, or action rather than decorative styling.
- **Efficient Daily Workflows:** Repetitive tasks (homeroom attendance, student lookup, fee collection) are designed for speed with keyboard navigation, clear confirmations, and reversible actions.
- **Defensive Multi-Tenant Isolation:** PostgreSQL Row-Level Security (RLS) and RS256 asymmetric JWT authentication ensure strict data segregation between schools at the database layer.
- **Role-Tailored Purviews:** Seven distinct personas (Platform SuperAdmin, SchoolAdmin, Principal, Teacher, Student, Parent, Accountant) each receive an interface focused on their daily responsibilities without unauthorized controls.
- **Low Operating Overhead & Local Execution:** Runs 100% locally on standard developer hardware (Windows 11 / WSL) with zero external cloud dependencies.

---

## 2. Business Objectives & Stage 1 Scope

### 2.1 Initial Onboarding Target (Illustrative Test Profiles)
The primary functional milestone is the demonstration and pilot onboarding of **1–2 educational institutions**. In development and testing, two illustrative test profiles are used as fixtures (derived from `seeds/dev/02_demo_schools.js`):
- **Test Organization A (Illustrative Profile):** Multi-campus K–12 institution profile (e.g. Main Campus & North Campus; domain: `apex.example`).
- **Test Organization B (Illustrative Profile):** Single-campus independent academy profile (domain: `horizon.example`).

*(Note: These are non-customer demonstration fixtures and illustrative test profiles, not validated commercial commitments or real customers).*

### 2.2 Scalability Without Artificial Limits
The data model and user interface are architected without artificial hardcoded limits on student registers, sections, or staff. However, system performance and scaling must be validated through empirical query profiling and test measurements rather than speculative claims.

### 2.3 Key Product Priorities
1. **Usability & Clarity:** Administrative staff, teachers, parents, and students must navigate their portals with minimal training.
2. **Professional Visual Quality:** A clean, modern enterprise palette (Slate & Cobalt) suited for daily operational use.
3. **Reliable Daily Operations:** Server-side pagination and filtering, structured attendance marking with confirmation, and printable fee receipts.
4. **Data Density:** Ability to review, sort, filter, and operate on records with configurable density modes without horizontal disorientation.
5. **Privacy by Design:** Avoid unnecessary national ID collection (e.g. Aadhaar), provide voluntary alternative ID fields, and prohibit plaintext national ID storage. Legal compliance must be evaluated separately by legal counsel rather than assumed by software design.
6. **100% Local-First Feasibility:** Zero AWS or third-party cloud infrastructure required for development, testing, or demonstrations.

---

## 3. The Seven Core Personas & Operational Boundaries

SchoolEMS establishes distinct operational boundaries for seven user personas:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                PERSONA OPERATIONAL PURVIEW & BOUNDARIES                                │
├────┬──────────────────────┬──────────────────────┬─────────────────────────────────────────────────────┤
│ #  │ Role                 │ Operational Purview  │ Primary Responsibilities & UI Focus                 │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 1  │ **Platform SuperAdmin│ SaaS Platform Root   │ Global tenant provisioning, domain verification,   │
│    │                      │ (No school data)     │ platform metrics, system health. Denied pupil data. │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 2  │ **School Admin**     │ Tenant-Wide          │ Full institution configuration, academic years,     │
│    │                      │ (All campuses)       │ admissions, staff rosters, fee policies, notices.   │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 3  │ **Principal**        │ Campus Branch-Scoped │ Academic oversight, class-section rosters, teacher  │
│    │                      │                      │ allocations, student welfare, attendance audits.    │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 4  │ **Teacher**          │ Section & Subject    │ Assigned homeroom attendance, subject marks,        │
│    │                      │ Scoped               │ homework assignments, emergency allergy flags.      │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 5  │ **Student**          │ Self Only            │ Personal timetable, daily attendance percentage,    │
│    │                      │                      │ homework assignments, school circulars.             │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 6  │ **Parent / Guardian**│ Linked Children Only │ Multi-child switcher, attendance overview, fee dues │
│    │                      │                      │ and receipts, homework notices.                     │
├────┼──────────────────────┼──────────────────────┼─────────────────────────────────────────────────────┤
│ 7  │ **Accountant**       │ Branch / Tenant      │ Fee installment structures, cashier counter desk,   │
│    │                      │ Financial            │ receipts, outstanding dues, payment recording.      │
└────┴──────────────────────┴──────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 4. Current Architecture Baseline & Technical Constraints

### 4.1 Frontend Architecture Baseline
- **Framework:** React 18.3.1 SPA with Vite 5.4.11 (installed in `package.json`).
- **Routing:** React Router DOM 6.30.6.
- **State & Context:** React Context (`AuthContext`, `ToastContext`).
- **HTTP Client:** Unified fetch wrapper (`frontend/src/api.js`) with Bearer token injection (`sms_access_token`) and standardized error unwrapping.
- **Styling Architecture:** Vanilla CSS design tokens declared in centralized stylesheets; no runtime CSS-in-JS dependencies.

### 4.2 Backend & Data Storage Baseline
- **API Gateway (`:8080`):** Ingress proxy enforcing Host-to-Tenant resolution, header sanitization (`X-Verified-*`), and rate limiting.
- **Identity Service (`:4001`):** Asymmetric RS256 JWT auth, session management, tenant/branch operations, membership invitations, and platform admin management.
- **PostgreSQL Database (`auth_db`):** 7 active migrations in `public` schema. Phase 2 SIS entities are planned in a dedicated `sis` schema with cross-schema foreign keys.
- **Multi-Tenant Enforcement:** Enforced at the database layer via PostgreSQL Row-Level Security (`FORCE ROW LEVEL SECURITY`) using runtime session variables (`app.current_tenant_id`).
