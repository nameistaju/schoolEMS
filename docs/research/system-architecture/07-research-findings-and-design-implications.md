# Document 07: Consolidated Research Findings and Architectural Design Implications

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Research Synthesis, Architectural Recommendations & Design Invariants  
**Target Milestone:** Transition from Research Phase to Formal System Architecture & Database Design  
**Date:** March 2026  
**Author:** Principal Software Architect & Lead Research Director  

---

## 1. Executive Summary & Synthesis of Research Findings

This technical research study independently investigated primary engineering literature, official technical standards (Ed-Fi v4, PostgreSQL 18, OWASP), and statutory data protection frameworks (DPDP Act, 2023) to establish an evidence-based foundation for SchoolEMS.

The findings demonstrate that:
1. **Domain Alignment:** School operations follow cyclical, cohort-based, and highly structured relational lifecycles. Modeling students, annual academic years, classroom sections, M:N guardian networks, and event-based attendance sessions mirrors proven international standards (Ed-Fi) and completely satisfies our approved Stage 1 MVP scope.
2. **Architecture Topology:** A cohesive modular service (`student-records-service`) operating alongside the existing `auth-service` and API Gateway provides optimal local workstation development, zero cloud cost, and atomic ACID transaction boundaries, whereas microservices introduce unjustifiable complexity for 1–2 pilot schools.
3. **Database Topology & Multi-Tenancy:** A single PostgreSQL 18.6 instance (`auth_db`) partitioning Phase 1 identity into schema `public` and Phase 2 SIS records into schema `sis` enables direct cross-schema foreign keys. Kernel-level Row-Level Security (RLS) under unprivileged runtime role `school_app_user` with `withTenantContext` guarantees fail-closed multi-tenant data isolation.
4. **Relational & Financial Exactness:** High-concurrency operations (cashier collections, student admissions, academic rollover) require explicit database constraints, row-level locks (`FOR UPDATE`), atomic receipt sequence counters, and mandatory `NUMERIC(12, 2)` monetary fields in Indian Rupees (`INR`).
5. **Children's Privacy:** Section 9 of India's DPDP Act, 2023 mandates verifiable parental consent, an absolute prohibition of behavioral tracking or targeted ads directed at children, and physical table segregation of sensitive medical and child safeguarding records.

---

## 2. Evidence-Backed Architectural Recommendations

The empirical evidence directly supports the following concrete architectural decisions:

| Area | Evidence-Backed Recommendation | Supporting Source Evidence |
| :--- | :--- | :--- |
| **Service Boundaries** | Single cohesive `student-records-service` on port `4002`. | Evaluated in Document 03: Eliminates distributed 2PC transactions; minimizes workstation memory. |
| **Database Topology** | Single database `auth_db`; schema `public` for identity; schema `sis` for SIS. | PostgreSQL 18 Docs: Enables direct cross-schema foreign keys; avoids connection pool duplication. |
| **Tenant Isolation** | Shared tables with PostgreSQL Row-Level Security (`ENABLE` & `FORCE RLS`). | OWASP Multi-Tenant Cheat Sheet & PostgreSQL 18 Docs: Kernel-enforced fail-closed isolation. |
| **Session Context** | `SET LOCAL app.current_tenant_id` within explicit transaction blocks. | PostgreSQL 18 Docs: Prevents connection-pool context leakage; automatically clears at commit/rollback. |
| **Family Modeling** | M:N Kinship junction table (`sis.student_guardians`) with granular legal flags. | Ed-Fi Data Standard v4 (`StudentParentAssociation`): Solves siblings and legal custody disputes. |
| **Attendance Engine** | Header-detail session model (`attendance_sessions` + `student_attendance`) with client cache (OD-02). | Ed-Fi Attendance Domain: Event-based affirmative logging; resilient to classroom network drops. |
| **Financial Integrity** | Double-entry allocation ledger + cashier payments + atomic receipt sequences + Principal waivers (OD-04). | Accounting Relational Standards: PostgreSQL `NUMERIC(12, 2)`, currency INR (₹), append-only payments. |
| **Student Photos** | Local filesystem storage (`uploads/sis/`) with DB metadata and 2MB cap (OD-05). | OWASP File Upload Cheat Sheet: Magic byte validation, UUID file naming, authenticated streaming. |
| **Sensitive Records** | Physical segregation of health and safeguarding tables with restricted role grants. | DPDP Act 2023 & OWASP Authorization: Prevents teacher and accountant over-privilege. |

---

## 3. Evaluated Options Formally Rejected

| Architectural Option | Documented Rejection Rationale |
| :--- | :--- |
| **Distributed Microservices (6+ services)** | Rejected due to extreme local workstation overhead, port collisions, network latency, and the requirement for complex distributed Saga orchestrators for admissions and rollover. |
| **Separate Physical Databases (`auth_db` + `school_db`)** | Rejected because PostgreSQL cannot enforce cross-database foreign keys, risking orphaned student records and desynchronized user accounts. |
| **Database-per-Tenant / Schema-per-Tenant** | Rejected due to severe migration management penalties (running migrations across N schemas) and connection pool exhaustion. |
| **Cloud Object Storage (AWS S3)** | Rejected because the project operates under a strict local-first mandate with zero AWS account, zero cloud dependencies, and zero paid APIs. |
| **External Payment Gateway Integration** | Rejected for Stage 1: Pilot schools require direct cashier collections (Cash, Cheque, Bank Transfer, POS/DD) with official sequential physical receipts. |
| **Plaintext National ID (Aadhaar) Storage** | Rejected due to severe legal and regulatory liability under Indian law; replaced with per-tenant salted SHA-256 hashes and masked display tokens. |
| **Automated Batch Rollover** | Rejected in accordance with OD-01: Real school promotions require human administrative discretion for retentions and transfers via the Promotion Review Wizard. |

---

## 4. Technical Risks & Engineering Trade-Offs

1. **PostgreSQL RLS Performance on Complex Joins:**
   - *Risk:* In complex queries joining 5+ tables (e.g. Student -> Section -> Class -> Attendance -> Guardians), evaluating RLS policies on each table adds slight query planning overhead.
   - *Trade-Off & Mitigation:* For pilot school workloads (< 5,000 students), this overhead is negligible (< 1ms). Proper B-Tree indexing on all foreign keys and compound lookup columns ensures sub-50ms API response times.
2. **Local Storage Backup & Disaster Recovery:**
   - *Risk:* Files stored on local workstation disks (`uploads/sis/`) are decoupled from PostgreSQL database dumps.
   - *Trade-Off & Mitigation:* Backup procedures must execute coordinated snapshots of both the PostgreSQL database dump (`pg_dump`) and the local filesystem folder (`uploads/sis/`).
3. **Pessimistic Locking Overhead during Peak Cashier Hours:**
   - *Risk:* `SELECT ... FOR UPDATE` on student fee allocations serializes cashier transactions for the same student.
   - *Trade-Off & Mitigation:* The lock duration is extremely short (< 15ms inside a transaction). It prevents catastrophic double-payment race conditions while causing zero perceptible delay to cashiers.

---

## 5. Decisions Requiring Explicit User Approval Prior to Implementation

1. **Mid-Year Admission Pro-Rating:** Confirm whether mid-year student admissions should assess full annual tuition fees by default (leaving fee reductions to the Principal concession workflow) or implement automated pro-rating based on remaining months. *(Recommended: Full annual fee with manual concession).*
2. **Attendance Lock Window:** Confirm the exact lock threshold after which class teachers can no longer modify marked attendance without administrative audit approval. *(Recommended: Locked at 23:59 on the session date).*
3. **Student Photograph Format Cap:** Confirm that the 2MB JPEG/PNG upload standard with client-side canvas preview (OD-05) satisfies institutional identification requirements. *(Recommended: Approved baseline).*

---

## 6. Exact Requirements Passed to Architecture & Database Design

With this research phase complete, the subsequent architecture and database design phase must strictly enforce the following non-negotiable invariants:
1. Maintain existing Phase 1 identity in `auth_db` schema `public` without altering migrations 01–07.
2. Construct all Phase 2 educational tables in schema `sis` tracked by `sis.knex_migrations_sis`.
3. Enforce kernel-level RLS on all operational tables for unprivileged role `school_app_user`.
4. Wrap all database transactions using `withTenantContext(pool, tenant_id, callback)`.
5. Enforce financial exactness using `NUMERIC(12, 2)` and currency `INR`.
6. Enforce operational decisions OD-01 through OD-05 across all design models.
