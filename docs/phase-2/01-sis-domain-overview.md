# Document 01: Phase 2 Student Information System (SIS) Domain Overview (Revised)

**Document Status:** REVISED DESIGN SPECIFICATION — READY FOR REVIEW  
**Classification:** System Architecture & Domain Modeling  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026 (Revised)  
**Author:** Principal System Architect & Lead Domain Engineer  
**Target Environment:** Local-First Development (Node.js 20+, PostgreSQL 18.6, React 18)  
**Cloud Dependency:** **NONE (100% Local-First / Zero AWS Infrastructure Required)**

---

## 1. Executive Summary & Vision

The **Student Information System (SIS)** constitutes the institutional operations backbone of SchoolEMS. Following the successful verification and hardening of the Phase 1 identity foundation, Phase 2 defines the complete domain architecture for tracking institutions, physical campuses, students, guardians, academic structures, admissions, and enrollment lifecycles.

This revised specification incorporates crucial architectural refinements from the Phase 2 design review:
1. **Resolved Database Topology:** Replaces naming ambiguity by standardizing on the existing local PostgreSQL database **`auth_db`**. Phase 1 identity tables remain intact in the `public` schema, while Phase 2 SIS entities are quarantined in a dedicated PostgreSQL schema named **`sis`**, interconnected via cross-schema foreign keys.
2. **Strict Sensitive Data Segregation:** Removes medical, psychological, and child-safeguarding attributes from the main `students` profile. Sensitive data is isolated into dedicated, independently authorized tables: `sis.student_health_records` and `sis.student_safeguarding_records`.
3. **Advanced Guardian Governance:** Refines the many-to-many family network to support legal custody restrictions, explicit decision-making permissions, emergency priorities, and individual child-scoping without biological assumptions.
4. **India-First Data Protection Framing:** Re-aligns compliance language around India's Digital Personal Data Protection (DPDP) Act 2023, landmark Supreme Court rulings (e.g. *Puttaswamy* regarding voluntary Aadhaar usage), and state educational record retention mandates, while treating GDPR and COPPA as conditional frameworks.
5. **Multi-Branch Isolation & Mobility:** Defines strict branch-scoping rules and an auditable branch transfer workflow ensuring student records are never duplicated.

---

## 2. Core Functional Sub-Domains

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        PHASE 2 SIS DOMAIN FUNCTIONAL TAXONOMY                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
          │
          ├── [1] Student Identity & Core Profiles (Schema: `sis`)
          │     ├── Permanent demographic profiles & unique student IDs
          │     ├── Concurrency-safe, branch-scoped admission number sequences
          │     ├── Contact details, residential addresses, and emergency data
          │     └── Verified physical document attachments repository (`sis.student_documents`)
          │
          ├── [2] Segregated Sensitive & Health Records (Schema: `sis`)
          │     ├── Health profiles, chronic conditions & allergies (`sis.student_health_records`)
          │     ├── Safeguarding, custody court orders & restricted pickups (`sis.student_safeguarding_records`)
          │     └── Isolated RBAC access control & mandatory read audit trail
          │
          ├── [3] Academic Structure & Class Taxonomy (Schema: `sis`)
          │     ├── Academic years & terms / semesters
          │     ├── Grade levels / classes (Stage-based: Pre-Primary, Primary, Middle, Secondary)
          │     ├── Class sections & maximum capacity thresholds
          │     └── Class teacher assignments & room scheduling
          │
          ├── [4] Academic Enrollment & Student Progression (Schema: `sis`)
          │     ├── Academic-year cohort enrollments (`sis.student_enrollments`)
          │     ├── Temporal non-overlapping enrollment ledger with unique roll numbers
          │     ├── Section transfers & intra-school campus relocations
          │     ├── Annual batch promotions & grade retentions
          │     └── Formal withdrawal, Transfer Certificate (TC) generation & archiving
          │
          ├── [5] Parent & Guardian Network (Schema: `sis`)
          │     ├── Many-to-many guardian-student relationship modeling (`sis.guardians`)
          │     ├── Explicit operational privileges per child (`sis.student_guardians`)
          │     ├── Biological vs. legal guardian status & verifiable parental consent
          │     └── Emergency contact priority ordering (Priority 1, 2, 3)
          │
          └── [6] Admissions Pipeline & Onboarding (Schema: `sis`)
                ├── Pre-enrollment application intake (`sis.admission_applications`)
                ├── Document review & entrance assessment workflows
                ├── Deterministic duplicate applicant detection
                └── Atomic onboarding transaction converting application to active student
```

---

## 3. Database Topology & Service Boundaries

```
[ Clients / Web UI ] ──► [ school-gateway (:8080) ]
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 [ identity-service (:4001) ]          [ student-records-service (:4002) ]
 (IAM, Memberships, Domains)           (SIS, Academics, Admissions, Health)
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
        ┌───────────────────────────────────────────────┐
        │            PostgreSQL 18.6 DB: auth_db        │
        ├───────────────────────┬───────────────────────┤
        │ Schema: `public`      │ Schema: `sis`         │
        │ (Phase 1 Foundation)  │ (Phase 2 Domain)      │
        │ - tenants             │ - academic_years      │
        │ - branches            │ - classes, sections   │
        │ - users               │ - students            │
        │ - roles, permissions  │ - student_health      │
        │ - memberships         │ - safeguarding        │
        │ - audit_logs          │ - guardians           │
        │ - platform_admins     │ - enrollments         │
        │                       │ - admissions          │
        └───────────────────────┴───────────────────────┘
```

### Architectural Key Points:
- **Database Name:** The local database is explicitly standardized as `auth_db`. Existing databases (`catalog_db`, `cart_db`, etc.) remain completely untouched.
- **Dedicated PostgreSQL Schema (`sis`):** Phase 2 tables are created within a dedicated schema named `sis`. This avoids namespace collision with Phase 1 identity tables in `public`.
- **Cross-Schema Foreign Keys:** Within `auth_db`, Phase 2 tables in schema `sis` reference Phase 1 tables via cross-schema foreign keys (e.g., `REFERENCES public.tenants(id)`, `REFERENCES public.branches(id)`, `REFERENCES public.users(id)`).
- **Service Deployment:** The SIS domain is deployed as a single, cohesive microservice: **`student-records-service`** (Service 2, Port 4002). This prevents premature microservice fragmentation and guarantees atomic multi-table transactions during student admissions and promotions.

---

## 4. Phase 1 Foundations vs. Phase 2 Capabilities

| Architecture Layer | Phase 1 (Implemented & Verified) | Phase 2 (Proposed SIS Design) |
| :--- | :--- | :--- |
| **Database & Schemas** | Database `auth_db`, Schema `public` | Database `auth_db`, Dedicated Schema `sis` with cross-schema foreign keys to `public`. |
| **Identity & Users** | `public.users`, `public.user_tenant_memberships`, `public.roles` | `sis.guardians` optionally links to `public.users(id)` for portal authentication. |
| **Authentication** | Asymmetric RS256 JWT keypair validation & rotation on `:4001` | Downstream verification of RS256 JWT claims using public key on `:4002`. |
| **Data Isolation** | PostgreSQL RLS on `branches`, `memberships`, `membership_roles` | PostgreSQL RLS on all `sis.*` tables; composite `(tenant_id, id)` validation. |
| **Sensitive Data** | Basic credentials & salted password hashes in `public.users` | Complete physical isolation of health and safeguarding records into dedicated tables. |
| **Gateway Ingress** | Proxies `/api/v1/auth/*`, `/api/v1/tenants/*`, `/api/v1/memberships/*` | Gateway adds route proxying for `/api/v1/sis/*` pointing to `student-records-service` (`:4002`). |
| **Audit Compliance** | Append-only `public.audit_logs` for identity operations | Comprehensive audit trail for admission decisions, section transfers, and sensitive health views. |

---

## 5. Canonical Terminology

- **Tenant:** An independent educational entity, trust, or school board (e.g. Apex Educational Society).
- **Branch (Campus):** A distinct physical campus operated by a tenant (e.g. Apex Main Campus, Apex North Campus).
- **Student Profile:** The core demographic identity of a human learner, persisting unchanged across grades and branches (`sis.students`).
- **Student Health Record:** Segregated physical health and dietary emergency data (`sis.student_health_records`).
- **Student Safeguarding Record:** Segregated child protection, legal custody court order, and welfare flags (`sis.student_safeguarding_records`).
- **Academic Year:** A defined institutional calendar period (e.g. "2026–2027") (`sis.academic_years`).
- **Academic Enrollment:** A temporal snapshot linking a student to a grade, section, and academic year (`sis.student_enrollments`).
- **Guardian:** An adult with custodial, biological, or legal responsibility for a student (`sis.guardians`).
- **Admission Application:** A prospective candidate's submission prior to formal acceptance (`sis.admission_applications`).
