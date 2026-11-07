# Document 11: Phase 2 Phased Implementation Roadmap & Execution Plan

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Engineering Roadmap & Execution Plan  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal System Architect & Delivery Lead  

---

## 1. Roadmap Overview & Phased Execution Strategy

To eliminate regression risks and preserve the verified Phase 1 multi-tenant foundation (60/60 passing tests), Phase 2 follows a strict **zero-regression phased implementation model**.

Development is organized into 8 sequential engineering milestones. Each milestone defines strict prerequisites, deliverables, automated acceptance gates, and fail-safe rollback procedures.

```
[ Milestone 1: Schema `sis` & Migrations ] ──► [ Milestone 2: Storage Abstraction ]
                                                          │
                                                          ▼
[ Milestone 4: Admissions Engine ] ◄── [ Milestone 3: Service Core & Repositories ]
           │
           ▼
[ Milestone 5: Enrollment & Promotion ] ──► [ Milestone 6: Gateway Ingress ]
                                                   │
                                                   ▼
[ Milestone 8: Frontend SIS Views ] ◄── [ Milestone 7: Automated Test Suite ]
```

---

## 2. Milestone-by-Milestone Execution Plan

### Milestone 1: Dedicated Schema `sis` & Migrations Pipeline
- **Objective:** Deploy dedicated schema `sis` in `auth_db` with independent Knex migration tracking (`sis.knex_migrations_sis`), tables, constraints, indexes, and Row-Level Security policies.
- **Deliverables:**
  - `services/student-records-service/src/database/migrations/`:
    - `20260301000008_create_sis_schema_and_academic_structure.js` (`sis` schema, `academic_years`, `academic_terms`, `classes`, `sections`)
    - `20260301000009_create_students_and_sensitive_records.js` (`students`, `student_health_records`, `student_safeguarding_records`, `student_documents`)
    - `20260301000010_create_guardians_and_consents.js` (`guardians`, `student_guardians`, `guardian_consents`)
    - `20260301000011_create_admissions_and_sequences.js` (`admission_applications`, `application_documents`, `admission_number_sequences`)
    - `20260301000012_create_enrollments_and_transfers.js` (`student_enrollments`, `student_transfers`)
    - `20260301000013_enable_sis_rls_and_grants.js` (PostgreSQL RLS on all `sis.*` tables, runtime grants to `school_app_user`)
- **Acceptance Gate:**
  - `npm run migrate:sis` executes cleanly under `school_migration_user` (running `SET ROLE school_schema_owner`).
  - `npm run migrate:sis:rollback` rolls back schema `sis` cleanly without touching `public` schema or `public.knex_migrations`.
  - Phase 1 test suite (60/60 tests) continues passing at 100%.

---

### Milestone 2: File Storage Abstraction Layer (Local-First)
- **Objective:** Build local-first file storage abstraction for student documents and photographs without cloud dependencies.
- **Deliverables:**
  - `services/common/storage/index.js` (Interface definition)
  - `services/common/storage/local-provider.js` (Local disk storage under `uploads/sis/{tenant_id}/{student_id}/`)
  - File upload validator (MIME-type magic bytes whitelist: PDF, JPEG, PNG; max size: 5MB; SHA-256 checksum)
- **Acceptance Gate:**
  - Unit tests verify file write, read stream, checksum validation, and directory traversal prevention (`../../etc/passwd`).

---

### Milestone 3: Domain Service Core & Repositories
- **Objective:** Scaffold `student-records-service` on port `4002` reusing Phase 1 common utilities.
- **Deliverables:**
  - `services/student-records-service/src/index.js` (Express bootstrap on port 4002)
  - Integration with `common/service.js` (request ID, metrics, health check)
  - Integration with `common/auth.js` (`requireSchoolAuth`, RS256 token verification)
  - Integration with `common/db.js` (`withTenantContext` RLS wrapper)
- **Acceptance Gate:**
  - Service boots independently locally; `/health/live` and `/health/ready` return `200 OK`.

---

### Milestone 4: Admissions Pipeline & Sequential Number Generator
- **Objective:** Implement admission application intake, document upload, registrar review, and concurrency-safe admission number generation.
- **Deliverables:**
  - `routes/v1/admissions.js`
  - Atomic counter implementation on `sis.admission_number_sequences`
  - Duplicate student detection algorithm (exact demographic + guardian phone + voluntary Aadhaar hash match)
  - Atomic conversion transaction: Application $\rightarrow$ Permanent Student Profile + Guardians + Enrollment
- **Acceptance Gate:**
  - Integration test proves concurrent admissions generate gapless, collision-free numbers without deadlocks.

---

### Milestone 5: Academic Enrollment, Health/Safeguarding & Promotion Engine
- **Objective:** Implement academic year enrollment, segregated health/safeguarding endpoints, and cohort batch promotion.
- **Deliverables:**
  - `routes/v1/academic.js` (`classes`, `sections`, `academic_years`)
  - `routes/v1/enrollments.js` (Section enrollment, intra-grade transfer)
  - `routes/v1/health.js` & `routes/v1/safeguarding.js` (Segregated endpoints with mandatory `X-Access-Reason` header)
  - `services/student-records-service/src/services/promotion-engine.js` (Atomic cohort promotion)
  - Student exit & TC clearance workflow
- **Acceptance Gate:**
  - Section capacity limit (`max_capacity`) strictly blocks over-enrollment (`409 Conflict`).
  - Teachers are structurally blocked from accessing `sis.student_health_records` and `sis.student_safeguarding_records`.

---

### Milestone 6: Gateway Ingress & Route Mapping
- **Objective:** Expose Phase 2 endpoints through `school-gateway` (`:8080`).
- **Deliverables:**
  - Update `gateway/src/index.js` routes:
    - Route prefix `/api/v1/sis/*` proxying to `http://127.0.0.1:4002`
  - Gateway health check incorporates `student-records-service` liveness
- **Acceptance Gate:**
  - End-to-end request through `http://localhost:8080/api/v1/sis/students` successfully resolves tenant from `apex.example` Host header and enforces gateway secret.

---

### Milestone 7: Automated Test Suite & Real PostgreSQL RLS Verification
- **Objective:** Build comprehensive automated test suite verifying all Phase 2 functionality against PostgreSQL 18.6 in WSL.
- **Deliverables:**
  - `test/sis-api-integration.test.js` (Admissions, enrollments, student CRUD)
  - `test/sis-rls-isolation.test.js` (Real PostgreSQL RLS data isolation under `school_app_user`)
  - `test/sis-sensitive-records-isolation.test.js` (Verifies health and safeguarding isolation from unauthorized roles)
  - `test/sis-admission-concurrency.test.js` (High-concurrency sequence allocation tests)
  - `test/sis-dpdp-compliance.test.js` (Minor consent recording and voluntary Aadhaar salted token tests)
- **Acceptance Gate:**
  - 100% of tests pass against real PostgreSQL 18.6 in WSL.
  - Zero cross-tenant data leakage confirmed under `school_app_user`.

---

### Milestone 8: Frontend SIS UI Integration
- **Objective:** Connect the React 18 / Vite frontend to Phase 2 SIS APIs.
- **Deliverables:**
  - Student Directory view (paginated roster with search, class, and branch filters)
  - Student Profile view (demographics, linked guardians, active enrollment history)
  - Admission Application Review queue (checklist review, offer approval modal)
  - Class & Section Management console
- **Acceptance Gate:**
  - Frontend production build (`npm run build`) completes with zero errors.
  - UI seamlessly navigates through admission approval and roster lookup.

---

## 3. Rollback & Contingency Plan

If any critical defect or security vulnerability is uncovered during Phase 2 execution:
1. **Database Rollback:** Execute `npm run migrate:sis:rollback` to revert migrations 13 down to 08 cleanly. Because migrations reside in dedicated tracking table `sis.knex_migrations_sis`, Phase 1 database tables and tracking (`public.knex_migrations`) remain 100% unaffected.
2. **Gateway Decoupling:** Remove the `/api/v1/sis/*` proxy route from `gateway/src/index.js` to isolate traffic.
3. **Branch Revert:** The Git branch `feature/phase-2-sis` can be reverted without disrupting Phase 1 codebase.
