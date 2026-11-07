# Document 03: System Architecture Alternatives & Trade-Off Analysis

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Architectural Trade-Off Analysis, Topology & Decision Evaluation  
**Evaluation Target:** SchoolEMS System Architecture  
**Date:** March 2026  
**Author:** Principal Enterprise Systems Architect & Infrastructure Strategist  

---

## 1. Evaluation Methodology & Dimensions

To determine the optimal system architecture for SchoolEMS, this study compares technical alternatives across seven architectural dimensions. Each alternative is evaluated against nine rigorous engineering criteria:

1. **Security & Isolation:** Protection against cross-tenant data leakage and unauthorized access.
2. **Operational Complexity:** Deployment overhead, process management, and operational failure modes.
3. **Local Development Experience:** Ease of running, debugging, and developing on a local developer workstation (Windows 11 / WSL2).
4. **Cost:** Infrastructure hosting, resource consumption, and licensing expenses (mandating zero paid cloud services).
5. **Testing Difficulty:** Complexity of writing deterministic, fast-executing unit and integration tests.
6. **Data Consistency:** Support for atomic ACID transactions across business operations without eventual consistency lag.
7. **Maintenance Burden:** Cognitive load, code duplication, and schema evolution overhead for a small engineering team.
8. **Fit for 1–2 Pilot Schools:** Pragmatic alignment with the immediate operational goals of initial pilot onboarding.
9. **Evolutionary Path:** Capacity to scale and decouple in the future without requiring a premature architectural rewrite.

---

## 2. Comparative Analysis of Architectural Alternatives

### 2.1 Dimension 1: Service Boundary Topology
#### Alternatives:
- **Option A (Fine-Grained Microservices):** Decomposing the system into 6+ independent microservices (e.g. `identity-service`, `admissions-service`, `attendance-service`, `fees-service`, `timetable-service`, `leave-service`), each running on a distinct port with dedicated databases and message brokers.
- **Option B (Modular Cohesive SIS Service):** Preserving the Phase 1 `auth-service` (port `4001`) and establishing a single, highly cohesive `student-records-service` (port `4002`) behind the Gateway (port `8080`), organized internally into decoupled domain modules.

#### Evaluation:
- *Operational Complexity & Dev Experience:* Option A introduces extreme complexity on developer workstations: managing 7 Node.js processes, configuring inter-service networking, resolving port collisions, and handling distributed service boot sequences. Option B requires running exactly two backend services, offering instant local startup and single-process debugging.
- *Data Consistency:* In Option A, admitting a student requires distributed transactions across admissions, students, enrollments, and fees, necessitating complex Saga orchestrators or Two-Phase Commit (2PC) protocols. Option B executes cross-domain transactions inside native PostgreSQL ACID blocks (`BEGIN ... COMMIT`).
- *Fit & Evolution:* For 1–2 pilot schools (~500–2,000 students), Option A represents severe overengineering. Option B satisfies all Stage 1 operational needs cleanly and can cleanly decouple into microservices later because domain modules maintain strict internal folder boundaries.
- **Evidence-Backed Verdict:** **Option B (Modular Cohesive SIS Service)** is overwhelmingly superior.

---

### 2.2 Dimension 2: Physical Database Topology
#### Alternatives:
- **Option A (Multiple Physical Databases):** `auth_db` for identity and `school_db` for SIS educational records.
- **Option B (Single Physical Database with Logical Schemas):** Single database `auth_db` partitioning Phase 1 tables into schema `public` and Phase 2 SIS tables into schema `sis`.

#### Evaluation:
- *Relational Integrity:* Option A breaks database-level referential integrity. Foreign keys such as `sis.students.user_id REFERENCES public.users(id)` cannot exist across physical database boundaries in PostgreSQL. Orphaned records must be managed via fragile application-level checks. Option B allows direct, native cross-schema foreign keys enforced by the PostgreSQL kernel.
- *Resource Overhead:* Option A requires two independent database connection pools in Node.js, doubling connection consumption and memory pressure on local WSL workstations. Option B uses a single unified pool.
- *Migration Isolation:* Schema `sis` maintains an independent migration tracking table (`sis.knex_migrations_sis`), completely decoupling SIS schema evolution from Phase 1 migrations (`public.knex_migrations`).
- **Evidence-Backed Verdict:** **Option B (Single Database with Schema Partitioning)** guarantees relational integrity and minimal resource overhead.

---

### 2.3 Dimension 3: Multi-Tenancy Data Isolation Strategy
#### Alternatives:
- **Option A (Database-per-Tenant):** Provisioning a completely separate PostgreSQL database instance or catalog for each school tenant.
- **Option B (Schema-per-Tenant):** Provisioning a dedicated PostgreSQL schema (e.g. `tenant_apex`, `tenant_horizon`) for each school tenant.
- **Option C (Shared-Table Multi-Tenancy with PostgreSQL Row-Level Security - RLS):** All tenants share unified tables with mandatory `tenant_id` columns, enforced at the database kernel level via fail-closed Row-Level Security policies under an unprivileged runtime user.

#### Evaluation:
- *Operational Complexity & Migrations:* Options A and B introduce severe migration scaling penalties. Running a new migration across 50 schemas or databases requires complex sequential loops; a failure midway leaves the database estate in a heterogeneous, partially upgraded state. Option C executes schema migrations exactly once across unified tables in milliseconds.
- *Connection Pooling:* In Options A and B, connection pooling tools (like PgBouncer or Knex pools) struggle because pools cannot be shared across multiple databases/schemas without large connection bloat. Option C pools connections efficiently across all tenants.
- *Security & Isolation:* Option C, when combined with PostgreSQL `FORCE ROW LEVEL SECURITY` and unprivileged role `school_app_user` (NOBYPASSRLS), provides mathematical kernel-level isolation. Queries without tenant context evaluate to `NULL` and fail closed (returning 0 rows).
- **Evidence-Backed Verdict:** **Option C (Shared-Table with Kernel RLS)** delivers enterprise security with minimal operational burden.

---

### 2.4 Dimension 4: Authorization Enforcement Architecture
#### Alternatives:
- **Option A (Duplicated Per-Route Authorization):** Every Express route handler manually parses roles and writes custom authorization checks.
- **Option B (Centralized Policy Middleware with Relationship-Based Scoping):** Shared authorization middleware (`requireSchoolAuth`) that validates RS256 token claims, combined with domain-specific relationship scoping (e.g. parent-to-child verification in `sis.student_guardians`).

#### Evaluation:
- *Security:* Option A suffers from high human error: a developer forgetting an `if (!req.user.roles.includes('Principal'))` check creates an immediate broken access control vulnerability (OWASP Top 10 #1). Option B centralizes permission validation into declarative, reusable middleware.
- *Auditing & Maintenance:* Option B provides a single audit point for access control logic and guarantees consistent error responses (`401 UNAUTHORIZED`, `403 FORBIDDEN`).
- **Evidence-Backed Verdict:** **Option B (Centralized Policy Middleware with ReBAC Scoping)** is standard best practice.

---

### 2.5 Dimension 5: Data Access & Persistence Layer
#### Alternatives:
- **Option A (Heavy Object-Relational Mapper - ORM like Prisma or TypeORM):** Abstracting database interaction behind high-level ORM models and runtime schema generation.
- **Option B (Query Builder / SQL-Centric Client - Knex.js & pg):** Utilizing Knex.js for structured SQL query construction and raw parameterized queries via `pg`, with explicit transaction management and tenant context setting.

#### Evaluation:
- *PostgreSQL RLS Compatibility:* Heavy ORMs often abstract connection acquisition so heavily that executing `SELECT set_config('app.current_tenant_id', ...)` on the exact transaction connection before query execution is difficult or unreliable. Knex.js and `pg` provide direct, explicit connection control via `withTenantContext`.
- *Performance & Transparency:* Knex provides transparent SQL generation without hidden N+1 query surprises or heavy runtime overhead.
- **Evidence-Backed Verdict:** **Option B (Knex.js + pg)** aligns perfectly with the existing Phase 1 foundation and RLS mechanics.

---

### 2.6 Dimension 6: File Storage Strategy
#### Alternatives:
- **Option A (Cloud Object Storage - AWS S3 / Google Cloud Storage):** Uploading student photos and documents directly to cloud buckets.
- **Option B (Local Filesystem with Database Metadata):** Storing files in local workstation directories (`uploads/sis/`) with strict DB metadata tracking (file size, MIME type, SHA-256 checksum) and serving files exclusively through authenticated streaming endpoints.

#### Evaluation:
- *Local-First Constraint:* Option A violates the core product mandate of zero AWS/cloud dependencies and requires internet connectivity and cloud credentials. Option B runs 100% locally on standard developer workstations.
- *Security & Anti-Traversal:* Option B uses UUID-keyed storage paths outside public web roots, preventing path traversal attacks. In the future, the storage adapter can be swapped for S3 without modifying business logic.
- **Evidence-Backed Verdict:** **Option B (Local Filesystem with DB Metadata)** is the only option satisfying project constraints.

---

### 2.7 Dimension 7: Workload Execution: Synchronous vs. Background Jobs
#### Alternatives:
- **Option A (Distributed Background Job Queue - Redis + BullMQ):** Introducing Redis and worker processes to handle student imports and report generation asynchronously.
- **Option B (Synchronous Ingestion with Staged Tables & Chunked Processing):** Handling operations within standard HTTP request lifecycles using database staging tables (`sis.student_import_jobs`, `sis.student_import_rows`) and batch chunking.

#### Evaluation:
- *Infrastructure Footprint:* Option A requires provisioning and maintaining a Redis server, introducing an additional point of failure and memory overhead. For 1–2 pilot schools, student import batches rarely exceed 500–1,000 rows (which PostgreSQL processes in < 2 seconds).
- *Operational Simplicity:* Option B handles staging and validation inside native PostgreSQL transactions without external message brokers.
- **Evidence-Backed Verdict:** **Option B (Synchronous Staged Ingestion)** eliminates infrastructure sprawl.

---

## 3. Comprehensive Architectural Trade-Off Matrix

| Architectural Dimension | Evaluated Option | Security / Isolation | Operational Complexity | Local Dev Experience | Cost | Consistency | Overall Recommendation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Service Boundaries** | Microservices (6+) | Medium | High | Poor | High | Poor (2PC) | **REJECTED** |
| | **Modular Cohesive SIS** | High | Low | **Excellent** | Zero | **ACID** | **RECOMMENDED** |
| **2. Database Topology** | Multiple DBs (`auth_db` + `school_db`) | High | Medium | Fair | Low | Poor (No FKs)| **REJECTED** |
| | **Single DB / Schemas (`public` + `sis`)** | High | Low | **Excellent** | Zero | **ACID (FKs)** | **RECOMMENDED** |
| **3. Multi-Tenancy** | Database-per-Tenant | Highest | High | Poor | High | Good | **REJECTED** |
| | Schema-per-Tenant | High | High | Fair | Medium | Good | **REJECTED** |
| | **Shared Table + Kernel RLS** | **Highest** | Low | **Excellent** | Zero | **ACID** | **RECOMMENDED** |
| **4. Authorization** | Duplicated Per-Route | Low (Bug-prone)| Medium | Fair | Zero | N/A | **REJECTED** |
| | **Centralized Policy + ReBAC** | **Highest** | Low | **Excellent** | Zero | N/A | **RECOMMENDED** |
| **5. Data Access** | Heavy ORM (Prisma/TypeORM) | Medium | Medium | Fair | Zero | Good | **REJECTED** |
| | **Knex.js + pg Driver** | **Highest** | Low | **Excellent** | Zero | **ACID** | **RECOMMENDED** |
| **6. File Storage** | Cloud S3 / GCS | High | High | Poor (Needs Cloud)| Paid | N/A | **REJECTED** |
| | **Local Filesystem + DB Meta** | **High** | Low | **Excellent** | Zero | **ACID Meta** | **RECOMMENDED** |
| **7. Workloads** | Redis + BullMQ Queue | High | High | Poor (Needs Redis)| Low | Eventual | **REJECTED** |
| | **Synchronous Staged Tables** | **High** | Low | **Excellent** | Zero | **ACID** | **RECOMMENDED** |

---

## 4. Unresolved Decisions & Open Technical Questions

1. **Section Transfer Accounting:** When a student transfers between sections mid-term, should historical attendance retain the previous section's ID or link to the student's new enrollment? *(Recommendation: Retain original section ID on historical sessions to preserve accurate classroom attendance registers).*
2. **Fee Allocation Pro-Rating:** If a student is admitted mid-year (e.g. Month 6 of a 10-month academic year), should tuition fee structures automatically pro-rate or require manual cashier adjustment? *(Recommendation: Default to full annual fee with manual concession entry approved by Principal, keeping automated calculation logic simple for Stage 1).*
