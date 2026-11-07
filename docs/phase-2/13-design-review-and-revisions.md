# Document 13: Phase 2 SIS Design Review, Revision Ledger & Final Architecture Report

**Document Status:** FORMAL REVIEW & REVISION REPORT  
**Classification:** System Architecture, Security Audit & Governance Review  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal System Architect, Security Reviewer & Lead Database Engineer  

---

## 1. Executive Summary & Review Objective

Following the successful completion, security remediation, and post-remediation verification of Phase 1 (60/60 passing tests against PostgreSQL 18.6 in WSL), an initial architectural design suite (Documents 01 through 12) was developed for Phase 2: **Student Information System (SIS)**.

A rigorous, independent architectural and security review of that initial draft suite identified several critical design gaps, ambiguity around database topology, potential race conditions in admission numbering, data over-collection risks under the India Digital Personal Data Protection (DPDP) Act 2023, and insufficient physical segregation of highly sensitive health and child protection records.

This document serves as the **comprehensive review report and change ledger**, detailing every issue identified, the architectural revisions applied across Documents 01 through 12, the finalized physical database topology, the revised Entity-Relationship (ER) model, the fine-grained RBAC model, and the roadmap forward.

### Strict Compliance Confirmation:
In accordance with non-negotiable project constraints:
- **Zero application source code** has been written or modified.
- **Zero database migrations** have been executed.
- **Zero database modifications, schema changes, or DDL commands** have been run against any database (`auth_db` or legacy e-commerce databases).
- **Zero packages or npm dependencies** have been installed.
- **Zero Git commits or remote pushes** have been performed.
- **Zero cloud or AWS services, SDKs, or credentials** have been introduced; all designs remain 100% local-first for Windows 11 / WSL / Node.js 20+ / PostgreSQL 18.6.

---

## 2. Comprehensive Audit of Identified Design Issues

The architectural review identified ten significant issues in the preliminary design suite:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SUMMARY OF REVIEW FINDINGS & REMEDIATION                        │
├────┬─────────────────────────────┬─────────────────────────────────────────────────────┤
│ #  │ Identified Design Gap       │ Architectural Remediation Applied                   │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 1  │ Database Topology Ambiguity │ Standardized on `auth_db` with dedicated schema     │
│    │ (`auth_db` vs `school_db`)  │ `sis` and cross-schema foreign keys to `public`.    │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 2  │ Sensitive Data Colocation   │ Physically segregated `sis.student_health_records`   │
│    │ in `students` table         │ and `sis.student_safeguarding_records` (1:1).       │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 3  │ Sibling/Guardian Permission │ Granular child-specific scopes in `student_guardians`│
│    │ Permissiveness              │ Access to Child A never grants access to Child B.   │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 4  │ Admission Numbering Races   │ Branch-scoped atomic sequence counter table using    │
│    │ (`COUNT(*)` / `MAX()`)      │ `UPDATE ... RETURNING` row-level locks.             │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 5  │ Prospective Application     │ Strict stage boundary: no student record created    │
│    │ Roster Pollution            │ until formal approval, seat allotment & commit.     │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 6  │ Misaligned Legal Focus      │ India DPDP Act 2023 baseline, Supreme Court Puttas- │
│    │ (US SSN instead of India)   │ wamy precedent (voluntary Aadhaar), CERT-In rules.  │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 7  │ Anonymization Ambiguity     │ Salted Aadhaar hash formally classified as pseudo-  │
│    │ on National ID Tokens       │ nymization, not mathematical anonymization.         │
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 8  │ Cross-Branch Leakage During │ Automatic teacher access revocation upon transfer;   │
│    │ Student Relocation          │ quarantined safeguarding files requiring DSL review.│
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 9  │ Migration Collisions        │ Independent Knex tracking in `sis.knex_migrations_  │
│    │ with Phase 1 Tracking       │ sis`; zero modification to `public.knex_migrations`.│
├────┼─────────────────────────────┼─────────────────────────────────────────────────────┤
│ 10 │ Conflating Tech Decisions   │ Separated resolved technical ADRs from open institu-│
│    │ with Business Policies      │ tional business policies requiring stakeholder sign-off.│
└────┴─────────────────────────────┴─────────────────────────────────────────────────────┘
```

---

## 3. Section-by-Section Document Revision Ledger

Every document in `docs/phase-2/` (01 through 12) was thoroughly audited and rewritten to align with the revised architectural baseline:

### 3.1 [`01-sis-domain-overview.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/01-sis-domain-overview.md)
- **Changes Made:**
  - Resolved database naming: Specified `auth_db` as the physical database and `sis` as the dedicated schema.
  - Articulated the boundary between Phase 1 (`public` schema) and Phase 2 (`sis` schema).
  - Explicitly defined the single cohesive domain microservice: `student-records-service` (Port 4002).
  - Added physical segregation rationale for student health and safeguarding records.
  - Updated domain taxonomy and entity relationship diagrams.

### 3.2 [`02-student-data-model.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/02-student-data-model.md)
- **Changes Made:**
  - Segregated `students` table: Demographic information remains in `sis.students`, while health attributes were moved to `sis.student_health_records` (1:1) and safeguarding/child protection attributes to `sis.student_safeguarding_records` (1:1).
  - Indian Data Protection Alignment: Eliminated references to Social Security Numbers (SSN). Formatted national identifier intake around voluntary Aadhaar tokens under the Supreme Court of India *K.S. Puttaswamy (Aadhaar)* (2018) precedent.
  - Pseudonymization: Specified salted SHA-256 hash storage (`national_id_hash`) and 4-digit display masking (`national_id_last4`). Stated clearly that salted hashing is pseudonymization, not anonymization.
  - Defined complete DDL with foreign keys to `public.tenants(id)` and `public.branches(id)`.

### 3.3 [`03-academic-structure.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/03-academic-structure.md)
- **Changes Made:**
  - Updated all entity DDLs to reside in schema `sis` (`sis.academic_years`, `sis.academic_terms`, `sis.classes`, `sis.sections`, `sis.student_enrollments`, `sis.student_transfers`).
  - Added four temporal integrity invariants:
    1. Single active enrollment per student per academic year (`uq_sis_active_enrollment`).
    2. Non-overlapping academic term date intervals.
    3. Unique roll numbers per classroom section per academic year.
    4. Hard section capacity enforcement (`max_capacity`) blocking over-enrollment (`409 Conflict`).
  - Defined inter-branch student transfer and promotion DDL workflows.

### 3.4 [`04-parent-guardian-model.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/04-parent-guardian-model.md)
- **Changes Made:**
  - Standardized on schema `sis.guardians`, `sis.student_guardians`, and `sis.guardian_consents`.
  - Implemented granular child-specific access scopes in `sis.student_guardians`: `can_access_records`, `can_consent_medical`, `can_consent_excursions`, `can_sign_withdrawal`, `is_authorized_pickup`.
  - Enforced that a guardian's relationship to Child A confers **zero implicit access** to Child B.
  - Added legal custody decree status (`access_status`: `active`, `suspended`, `revoked`, `court_restricted`).
  - Prohibited multi-tenant sharing of guardian profiles: Sibling reuse is permitted only within the same tenant.
  - Added dedicated table `sis.guardian_consents` for Section 9 minor processing consent under the DPDP Act 2023.

### 3.5 [`05-admission-workflow.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/05-admission-workflow.md)
- **Changes Made:**
  - Standardized on schema `sis.admission_applications`, `sis.application_documents`, and `sis.admission_number_sequences`.
  - Replaced ambiguous admission numbering with a branch-scoped atomic sequence model: `(tenant_id, branch_id, academic_year_id, prefix)`.
  - Explicitly prohibited `COUNT(*)` or `MAX()` generation; detailed PostgreSQL row-level locks on `UPDATE ... RETURNING`.
  - Explained transaction rollback consistency, deadlock avoidance, and transient retry policies.
  - Enforced strict prospective candidate boundary: Zero records created in active student rosters until formal offer acceptance.

### 3.6 [`06-tenant-branch-isolation.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/06-tenant-branch-isolation.md)
- **Changes Made:**
  - Mapped entity ownership across all SIS entities in schema `sis`.
  - Implemented composite foreign keys `(tenant_id, id)` on relationship tables to prevent cross-tenant dangling references.
  - Provided complete PostgreSQL Row-Level Security DDL across all 15 SIS tables, ensuring missing tenant context fails closed.
  - Detailed cross-branch student transfer isolation: Source branch teachers lose access immediately upon transfer; sensitive child safeguarding records do not transfer automatically without Designated Safeguarding Lead (DSL) / Child Protection Officer (CPO) manual review.

### 3.7 [`07-sis-rbac-permissions.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/07-sis-rbac-permissions.md)
- **Changes Made:**
  - Updated permission taxonomy with segregated sensitive record permissions (`sis.health.read`, `sis.health.update`, `sis.safeguarding.read`, `sis.safeguarding.update`).
  - Structured classroom teacher permissions: Teachers receive active roster view (`sis.student.read.basic`) and emergency allergy flags (`sis.health.view_allergies`), but are **strictly denied** access to full medical histories or safeguarding files.
  - Added branch-level restrictions for Campus Principals and Registrars.
  - Mandated access reason logging (`X-Access-Reason`) for sensitive medical and safeguarding queries.

### 3.8 [`08-database-architecture.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/08-database-architecture.md)
- **Changes Made:**
  - Formally resolved database topology: Local database `auth_db`, Phase 1 in `public`, Phase 2 in `sis`.
  - Defined schema ownership and privilege scripts for the three-tier database roles (`school_schema_owner`, `school_migration_user`, `school_app_user`).
  - Configured independent Knex migration pipeline for SIS tracking in `sis.knex_migrations_sis`.
  - Detailed physical indexing strategy: Composite tenant keys, partial unique indexes, and lowercase name lookups.

### 3.9 [`09-api-specification.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/09-api-specification.md)
- **Changes Made:**
  - Added segregated endpoints:
    - `GET/PUT /api/v1/sis/students/:id/health`
    - `GET/POST /api/v1/sis/students/:id/safeguarding`
  - Ensured `GET /api/v1/sis/students/:id` returns only base demographics.
  - Updated admission approval endpoint (`POST /api/v1/sis/admissions/applications/:id/approve`) with atomic matriculation transaction and branch-scoped numbering.
  - Added DPDP Section 9 consent endpoint (`POST /api/v1/sis/students/:id/consents`).
  - Enforced consistent JSON envelope (`success`, `data`, `error`, `meta`) across all contracts.

### 3.10 [`10-privacy-security-audit.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/10-privacy-security-audit.md)
- **Changes Made:**
  - Refocused primary statutory compliance around India DPDP Act 2023 (Section 9 minor consent, Section 6 notice) and the Supreme Court *K.S. Puttaswamy (Aadhaar)* precedent.
  - Removed SSN focus; replaced with Indian educational documentation standards.
  - Emphasized that technical architecture alone does not constitute full DPDP/GDPR compliance; listed institutional items needing legal review.
  - Reaffirmed `LocalStorageProvider` as the active file storage provider with zero AWS dependencies.

### 3.11 [`11-phase-2-implementation-roadmap.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/11-phase-2-implementation-roadmap.md)
- **Changes Made:**
  - Restructured into 8 sequential engineering milestones.
  - Milestone 1 reflects 6 planned Knex migrations in `services/student-records-service/src/database/migrations` tracking in `sis.knex_migrations_sis`.
  - Milestone 7 expands automated testing: PostgreSQL RLS under `school_app_user`, segregated table isolation, admission numbering concurrency, and DPDP consent validation.
  - Documented clean rollback procedures leaving Phase 1 completely untouched.

### 3.12 [`12-architecture-decisions.md`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/docs/phase-2/12-architecture-decisions.md)
- **Changes Made:**
  - Expanded all ADRs (ADR-01 through ADR-07) with complete formal structure: Status, Context, Decision, Alternatives Considered, Consequences, Security Implications, Operational Implications, Stakeholder Approval.
  - ADR-02 formally documents the `auth_db` + schema `sis` topology decision.
  - Separated technical architecture decisions (adopted) from open institutional business policies (BP-01 through BP-05) requiring stakeholder sign-off.

---

## 4. Finalized Physical Database Topology & Schema Architecture

The finalized database architecture resolves all naming conflicts, prevents migration collisions, and guarantees strict relational integrity:

```
PostgreSQL 18.6 Instance (WSL Ubuntu - 127.0.0.1:5432)
└── Database: auth_db
    ├── Schema: public (Phase 1 Identity & Authentication)
    │   ├── Table: tenants
    │   ├── Table: branches
    │   ├── Table: users
    │   ├── Table: roles
    │   ├── Table: user_roles
    │   ├── Table: memberships
    │   ├── Table: platform_admins
    │   ├── Table: audit_logs
    │   └── Table: knex_migrations (Tracking Phase 1 Migrations 01–07)
    │
    └── Schema: sis (Phase 2 Student Information System)
        ├── Table: academic_years
        ├── Table: academic_terms
        ├── Table: classes
        ├── Table: sections
        ├── Table: students
        ├── Table: student_health_records (1:1 with students)
        ├── Table: student_safeguarding_records (1:1 with students)
        ├── Table: student_documents
        ├── Table: guardians
        ├── Table: student_guardians
        ├── Table: guardian_consents
        ├── Table: admission_applications
        ├── Table: application_documents
        ├── Table: admission_number_sequences
        ├── Table: student_enrollments
        ├── Table: student_transfers
        └── Table: knex_migrations_sis (Tracking Phase 2 Migrations 08–13)
```

### Relational Cross-Schema Linkages:
- `sis.*.tenant_id REFERENCES public.tenants(id) ON DELETE RESTRICT`
- `sis.*.branch_id REFERENCES public.branches(id) ON DELETE RESTRICT`
- `sis.guardians.user_id REFERENCES public.users(id) ON DELETE SET NULL`
- `sis.admission_applications.reviewed_by REFERENCES public.users(id) ON DELETE SET NULL`
- `sis.sections.class_teacher_id REFERENCES public.users(id) ON DELETE SET NULL`

---

## 5. Domain Service Architecture & Boundaries

To preserve local developer velocity while maintaining clean modular code, Phase 2 consolidates student operations into a single cohesive domain microservice:

```
[ Inbound HTTP Request ]
           │
           │ Host: apex.example
           ▼
┌──────────────────────────────────────────────┐
│           school-gateway (:8080)             │
│ - Case-insensitive strip of X-Verified-*     │
│ - Injects internal X-Gateway-Secret          │
│ - Ingress routing by URL prefix:             │
│     * /api/v1/auth/* ──► :4001               │
│     * /api/v1/sis/*  ──► :4002               │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│      student-records-service (:4002)         │
│ - Verifies internal X-Gateway-Secret         │
│ - Validates RS256 JWT Authorization token    │
│ - Contextual RBAC Scope Guards:              │
│     * requireBranchScope                     │
│     * requireTeacherSectionScope             │
│     * requireGuardianChildScope              │
│ - Database Connection Pool (school_app_user) │
│ - withTenantContext sets RLS session         │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│        auth_db (PostgreSQL 18.6)             │
│ - Enforces RLS across schema `sis`           │
│ - Missing tenant context fails closed        │
└──────────────────────────────────────────────┘
```

---

## 6. Revised Entity-Relationship Model & Sensitive Data Segregation

The core of the Phase 2 revision is the structural segregation of sensitive data:

```
                           ┌────────────────────────┐
                           │      sis.students      │
                           │   (Base Demographics)  │
                           └───────────┬────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │ 1:1                      │ 1:1                      │ 1:N
            ▼                          ▼                          ▼
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│sis.student_health_recs │ │sis.student_safeguarding│ │  sis.student_guardians │
│ - blood_group          │ │ - protection_tier      │ │ - guardian_id (FK)     │
│ - allergies, illnesses │ │ - court_order_summary  │ │ - can_access_records   │
│ - emergency_directives │ │ - legal_restraint_flag │ │ - can_consent_medical  │
│ [Medical Staff Only]   │ │ [Principal / CPO Only] │ │ - access_status        │
└────────────────────────┘ └────────────────────────┘ └───────────┬────────────┘
                                                                  │ N:1
                                                                  ▼
                                                      ┌────────────────────────┐
                                                      │     sis.guardians      │
                                                      │ - name, phone, email   │
                                                      │ - user_id (optional)   │
                                                      └────────────────────────┘
```

---

## 7. Granular RBAC & Contextual Scoping Matrix

Phase 2 replaces broad role permissions with granular keys and contextual scope guards:

| Role | Base Student Profile | Health Records (`sis.health.*`) | Safeguarding (`sis.safeguarding.*`) | Class Roster & Grades | Admission Approval | Inter-Branch Transfer |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **SuperAdmin** | Break-Glass (Audited) | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **SchoolAdmin** | Full Tenant | ✅ Audited | ✅ Audited | Full Tenant | Full Tenant | Full Tenant |
| **Principal** | Branch Only | ⚠️ Allergies Only | ✅ Own Campus | Own Campus | Own Campus | Initiates / Accepts |
| **Registrar** | Branch Only | ❌ Denied | ❌ Denied | Own Campus | ⚠️ Review Only | Submits Request |
| **Teacher** | Assigned Section | ⚠️ Allergies Only | ❌ Denied | Assigned Section | ❌ Denied | ❌ Denied |
| **Medical Officer**| Campus Enrolled | ✅ Full Access | ❌ Denied | ❌ Denied | ❌ Denied | ❌ Denied |
| **CPO / DSL** | Campus Enrolled | ❌ Denied | ✅ Full Access | ❌ Denied | ❌ Denied | Reviews Handoff |
| **Parent** | Linked Child | Own Child Only | ❌ Denied | Own Child Only | Portal Apply | Requests Transfer |

---

## 8. Tenant & Branch Isolation with PostgreSQL RLS

Row-Level Security is enabled and forced across all tables in schema `sis`. The application connects as PostgreSQL role `school_app_user`, which is configured with `NOBYPASSRLS`.

### Fail-Closed Tenant Context:
```sql
CREATE POLICY rls_sis_students ON sis.students
  FOR ALL TO school_app_user
  USING (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    AND (
      current_setting('app.current_branch_id', true) IS NULL 
      OR current_setting('app.current_branch_id', true) = ''
      OR branch_id = NULLIF(current_setting('app.current_branch_id', true), '')::UUID
    )
  )
  WITH CHECK (
    tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID
    AND (
      current_setting('app.current_branch_id', true) IS NULL 
      OR current_setting('app.current_branch_id', true) = ''
      OR branch_id = NULLIF(current_setting('app.current_branch_id', true), '')::UUID
    )
  );
```
- If `app.current_tenant_id` is unset or empty, the cast evaluates to `NULL`, returning 0 rows (fails closed).
- Composite foreign keys `(tenant_id, id)` prevent cross-tenant record linking at the engine level.

---

## 9. India-First Privacy Engineering Architecture

1. **DPDP Act 2023 Section 9:**
   - Dedicated table `sis.guardian_consents` logs Verifiable Parental Consent (VPC) for minor processing.
   - Platform contains zero tracking, behavioral profiling, or targeted advertising mechanisms.
2. **Supreme Court Puttaswamy Precedent:**
   - National identification is **strictly voluntary**.
   - Zero plaintext Aadhaar storage.
   - Deterministic salted SHA-256 hash (`national_id_hash`) stored for duplicate detection; last 4 digits stored for physical document verification.
   - Tenant secret salt is isolated in environment variables.
3. **Statutory Retention Alignment:**
   - Academic transcripts and Transfer Certificates are permanently retained under State Board regulatory exemptions.
   - Unenrolled prospective candidate applications are automatically purged after 12 months.

---

## 10. Phased Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              8-MILESTONE EXECUTION ROADMAP                             │
├─────────────┬──────────────────────────────────────────┬───────────────────────────────┤
│ Milestone   │ Focus Area                               │ Automated Acceptance Gate     │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 1 │ Schema `sis` & Migrations 08–13          │ `npm run migrate:sis` passes; │
│             │ in `auth_db`                             │ Phase 1 tests (60/60) pass.   │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 2 │ Local-First File Storage Abstraction     │ Unit tests verify disk write, │
│             │ (`LocalStorageProvider`)                 │ traversal protection & MIME.  │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 3 │ `student-records-service` Core Scaffolding│ Service boots on port 4002;   │
│             │ & Repositories                           │ Health endpoints return 200.  │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 4 │ Admissions Pipeline & Atomic Counter     │ Concurrency tests prove zero  │
│             │ (`admission_number_sequences`)           │ duplicate sequence numbers.   │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 5 │ Academic Structure, Health/Safeguarding  │ Section capacity checks; RBAC │
│             │ Segregated Endpoints & Promotion Engine  │ blocks teacher medical access.│
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 6 │ Gateway Ingress Route Mapping            │ Gateway proxies `/api/v1/sis/*`│
│             │ through `school-gateway` (:8080)         │ with header sanitization.     │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 7 │ Automated Integration & RLS Test Suite   │ 100% of integration & RLS     │
│             │ against PostgreSQL 18.6 in WSL           │ isolation tests pass.         │
├─────────────┼──────────────────────────────────────────┼───────────────────────────────┤
│ Milestone 8 │ Frontend SIS Console Integration         │ React 18 / Vite build passes; │
│             │ (Student Directory & Admissions Queue)   │ End-to-end UI workflow tests. │
└─────────────┴──────────────────────────────────────────┴───────────────────────────────┘
```

---

## 11. Open Business Policy Questions for Stakeholder Sign-Off

While technical architecture decisions are fully resolved in ADR-01 through ADR-07, the following institutional business policies require school administrator confirmation:

1. **BP-01 (Admission Number Continuity on Abort):** Confirmation of strictly gapless numbering (inside transaction) versus audit-logged gaps.
2. **BP-02 (Class Section Roll Number Algorithm):** Alphabetical by surname with manual teacher override versus chronological by admission date.
3. **BP-03 (Student Photograph Upload Protocol):** Online parental upload during application intake with registrar verification versus mandatory in-person webcam capture.
4. **BP-04 (Sibling Concession Verification):** Automated duplicate detection alert with mandatory manual registrar confirmation before applying tuition fee discounts.
5. **BP-05 (Physical Verification Document Archival):** Physical paper retention schedule (7 years post-graduation vs permanent institutional archive).

---

## 12. Strict Non-Modification Compliance Statement

The undersigned engineering team formally certifies that during the execution of this design revision task:
1. **Zero application code** in `services/`, `gateway/`, `frontend/`, or `common/` was modified.
2. **Zero database migrations** were created or executed.
3. **Zero SQL queries, DDL statements, or DML operations** were run against `auth_db` or legacy databases (`catalog_db`, `cart_db`, `orders_db`, `payments_db`).
4. **Zero environment variables** were altered.
5. **Zero packages or dependencies** were installed.
6. **Zero Git commits or remote pushes** were created.
7. **Phase 1 identity implementation and tests** remain 100% intact and unaffected.

---

## 13. Final Decision Verdict

**DESIGN REVISED — AWAITING FINAL REVIEW AND IMPLEMENTATION APPROVAL.**
