# Document 12: Phase 2 Architecture Decision Records (ADRs) & Policy Catalog

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Architecture Decision Records (ADRs) & Governance  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal System Architect & Lead Engineer  

---

## 1. Formal Architecture Decision Records (ADRs)

### ADR-01: Single Cohesive Domain Service (`student-records-service`)
- **Status:** **APPROVED & ADOPTED**
- **Context:** The SIS domain encompasses student demographics, family structures, academic grade ladders, section rosters, and prospective admissions. We evaluated splitting these into 4 distinct microservices (`student-service`, `guardian-service`, `academic-service`, `admissions-service`) versus a single consolidated domain service.
- **Decision:** Deploy as a single cohesive domain microservice: **`student-records-service` (Port 4002)**.
- **Alternatives Considered:**
  - *Option A (Microservice Proliferation):* 4 separate microservices. Rejected because cross-service onboarding transactions require 2-Phase Commit (2PC) or asynchronous event-sagas, introducing failure states and operational complexity.
  - *Option B (Monolithic Merge into Identity Service):* Merging into `identity-service`. Rejected because identity/auth concerns must remain strictly decoupled from school business logic.
- **Consequences:**
  - *Positive:* Supports atomic PostgreSQL transactions across admission conversion; reduces local memory and CPU footprint on developer workstations; simplifies deployment.
  - *Negative:* Internal code must maintain clean modular boundaries (controllers, repositories) to prevent internal coupling.
- **Security Implications:** Service enforces strict ingress validation (`X-Gateway-Secret`) and authenticates calls using verified RS256 JWT claims.
- **Operational Implications:** Operates locally on Node.js 20+; single process to monitor, trace, and restart.

---

### ADR-02: Database Topology — Colocation in `auth_db` with Dedicated Schema `sis`
- **Status:** **APPROVED & ADOPTED**
- **Context:** Phase 1 uses local database `auth_db`. Initial Phase 2 drafts introduced ambiguity by referencing both `auth_db` and `school_db` with cross-database foreign keys.
- **Decision:** **Colocate Phase 2 tables within the existing local database `auth_db` under a dedicated PostgreSQL schema named `sis`.** Phase 1 tables remain in schema `public`. Cross-schema foreign keys link `sis` entities to `public.tenants`, `public.branches`, and `public.users`.
- **Alternatives Considered:**
  - *Option A (Separate Database `records_db`):* Physically independent database. Rejected because PostgreSQL cannot enforce cross-database foreign keys, requiring application-level eventual consistency and increasing orphan record risks.
  - *Option B (Shared `public` Schema):* Adding SIS tables to `public`. Rejected because it pollutes the namespace and entangles migration histories.
- **Consequences:**
  - *Positive:* Enables true relational integrity and cascading foreign keys; allows atomic ACID onboarding transactions; preserves Phase 1 migrations completely untouched; independent migration tracking in `sis.knex_migrations_sis`.
  - *Negative:* Database backups must back up both schemas; permissions must be granted per schema.
- **Security Implications:** Enforces Phase 1 three-tier database role security (`school_schema_owner`, `school_migration_user`, `school_app_user`) and Row-Level Security across all `sis` tables.
- **Operational Implications:** Zero additional database instances required. Operates seamlessly on local PostgreSQL 18.6 in WSL.

---

### ADR-03: Physical Segregation of Sensitive Health and Safeguarding Records
- **Status:** **APPROVED & ADOPTED**
- **Context:** Storing sensitive health and child protection data directly in the `students` table exposes confidential attributes to any query selecting student rows, creating severe privacy risks.
- **Decision:** **Physically segregate sensitive records into dedicated 1:1 tables: `sis.student_health_records` and `sis.student_safeguarding_records`.** Base `sis.students` table contains demographics only.
- **Alternatives Considered:**
  - *Option A (Column-Level Storage with ORM Projections):* Storing health/safeguarding notes as text columns in `students` and excluding them in ORM queries. Rejected because raw SQL, reporting tools, or accidental `SELECT *` expose confidential child data.
- **Consequences:**
  - *Positive:* Structural defense-in-depth; distinct RBAC permission keys (`sis.health.*`, `sis.safeguarding.*`); mandatory access justification headers (`X-Access-Reason`); targeted audit trails.
  - *Negative:* Requires explicit table joins or dedicated endpoints to retrieve medical or safeguarding profiles.
- **Security Implications:** Even an authenticated teacher with full roster view permissions cannot read health or safeguarding data.
- **Operational Implications:** Designated Safeguarding Lead (DSL) and Campus Medical Officers operate within their own dedicated API interfaces.

---

### ADR-04: Voluntary National ID (Aadhaar) Handling & Pseudonymization
- **Status:** **APPROVED & ADOPTED**
- **Context:** The Supreme Court of India ruled in *K.S. Puttaswamy (Aadhaar)* (2018) that schools cannot make Aadhaar mandatory for admissions. Furthermore, storing raw 12-digit Aadhaar violates privacy best practices.
- **Decision:** **National ID submission is strictly voluntary. Store zero plaintext national IDs. Store only a salted SHA-256 hash in `national_id_hash` for duplicate detection, and the last 4 digits in `national_id_last4` for visual document check.**
- **Alternatives Considered:**
  - *Option A (Mandatory Plaintext Storage):* Rejected as illegal under Indian Supreme Court precedents and DPDP Act 2023 principles.
  - *Option B (Reversible AES-256 Encryption):* Rejected because schools have no legitimate legal reason to reconstruct the full 12-digit number once admission verification completes.
- **Consequences:**
  - *Positive:* Eliminates mass-breach liability of national identifiers; preserves deduplication capability.
  - *Negative:* Clarified that salted hash provides pseudonymization, not full mathematical anonymization; tenant secret salt must be guarded.
- **Security Implications:** Plaintext ID is discarded from memory immediately after hashing.
- **Operational Implications:** Registrars verify physical physical cards manually; platform retains only the audit verification timestamp and 4-digit mask.

---

### ADR-05: Concurrency-Safe Branch-Scoped Admission Number Generation
- **Status:** **APPROVED & ADOPTED**
- **Context:** Admission numbers must be permanent, human-readable, and sequential. Concurrent admission approvals must not collide or produce race conditions.
- **Decision:** **Allocate admission numbers via atomic row locks on a dedicated counter table: `sis.admission_number_sequences`, scoped by `(tenant_id, branch_id, academic_year_id, prefix)`. Prohibit `COUNT(*)` or `MAX()` generation.**
- **Alternatives Considered:**
  - *Option A (`SELECT COUNT(*) + 1` or `SELECT MAX()`):* Rejected due to severe concurrency collisions, table scan bottlenecks, and gap distortions from prior student exits.
  - *Option B (PostgreSQL Global Sequence):* Rejected because global sequences cannot be dynamically partitioned by tenant, campus branch, and academic year code.
- **Consequences:**
  - *Positive:* Row-level locking on `UPDATE ... RETURNING` guarantees collision-free sequence numbers; rolls back cleanly if transaction aborts.
  - *Negative:* Concurrent admissions for the same branch queue briefly on the sequence row lock (sub-millisecond duration).
- **Security Implications:** Prevents student record tampering and duplicate institutional identifiers.
- **Operational Implications:** Sequence counters initialize automatically per academic year and campus branch.

---

### ADR-06: Separation of Prospective Applications from Matriculated Students
- **Status:** **APPROVED & ADOPTED**
- **Context:** Storing prospective candidates in the main `students` table causes roster pollution, premature admission numbering, and over-retention of non-matriculating children's personal data.
- **Decision:** **Keep prospective candidates strictly segregated in `sis.admission_applications`. A record in `sis.students` is instantiated only upon formal admission approval and acceptance.**
- **Alternatives Considered:**
  - *Option A (Single Student Table with Status: 'applied'):* Rejected due to roster pollution and privacy non-compliance under DPDP Act Section 6.
- **Consequences:**
  - *Positive:* Enforces data minimization; inactive inquiries never pollute active school databases.
  - *Negative:* Requires formal conversion transaction to copy verified documents and guardian relationships to permanent tables.
- **Security Implications:** Unenrolled applications can be purged 12 months after admission cycle without impacting student archives.
- **Operational Implications:** Front-desk registrars operate within an isolated admissions pipeline.

---

### ADR-07: Local-First File Storage Abstraction with Zero Cloud Dependencies
- **Status:** **APPROVED & ADOPTED**
- **Context:** The project has NO AWS account and must operate completely locally on Windows 11 / WSL / PostgreSQL 18.6, but needs to store student documents and photographs.
- **Decision:** **Implement an abstract `StorageService` interface with `LocalStorageProvider` as the active provider, saving files to local disk under `uploads/sis/`. Cloud providers remain optional future interfaces.**
- **Alternatives Considered:**
  - *Option A (Mandatory AWS S3 / LocalStack):* Rejected because it violates the strict project constraint of zero AWS dependencies.
  - *Option B (Database BLOBs / Bytea):* Rejected because storing multi-megabyte PDFs in PostgreSQL degrades database cache performance and bloats backups.
- **Consequences:**
  - *Positive:* Runs 100% locally offline; zero AWS cost; fast developer iteration.
  - *Negative:* Files are served through an authenticated streaming controller rather than static links.
- **Security Implications:** Prohibits static directory serving (`express.static`); validates MIME magic bytes; eliminates path traversal.
- **Operational Implications:** Local disk paths configured via `STORAGE_LOCAL_ROOT` in `.env`.

---

## 2. Catalog of Unresolved Business & Policy Decisions

While all core technical architecture decisions are resolved and adopted above, the following institutional business policy questions require stakeholder / school administrator confirmation:

| Decision ID | Open Business Policy Question | Policy Options Under Consideration | Recommended Architectural Default | Stakeholder Action |
| :---: | :--- | :--- | :--- | :--- |
| **BP-01** | **Admission Number Gap Policy on Abort** | A) Strictly gapless: Sequence increments inside transaction; rollbacks restore counter (standard ACID behavior).<br>B) Audit-logged gaps permitted: Sequence increments via out-of-band counter to prevent lock contention. | **Option A (Strictly gapless inside transaction)**: Preferred by Indian state education boards for sequential registry inspection. | School Registrar Sign-off |
| **BP-02** | **Class Section Roll Number Ordering** | A) Alphabetical by student legal surname.<br>B) Chronological by date of admission.<br>C) Manual assignment by class teacher. | **Option A (Alphabetical auto-generation)** with manual override capability for administrative flexibility. | Academic Committee Decision |
| **BP-03** | **Student Photo Submission Policy** | A) Captured in-person by school front-desk camera.<br>B) Uploaded by parent during online application intake. | **Option B (Parent upload)** with mandatory registrar verification step before profile activation. | School Principal Approval |
| **BP-04** | **Sibling Concession Validation Protocol** | A) Automatic fee concession deduction upon matching guardian phone and address.<br>B) Automatic duplicate detection alert with mandatory manual registrar confirmation. | **Option B (Alert with explicit confirmation)**: Prevents accidental fee concessions for unrelated families sharing contact numbers. | Finance & Billing Department |
| **BP-05** | **Statutory Physical Document Retention** | Retention schedule for physical birth certificates and transfer certificates after digital upload: A) 7 years post-graduation.<br>B) Permanent archive in physical repository. | **Option B (Permanent archive)**: Standard compliance policy for state educational boards. | Legal Counsel Confirmation |
