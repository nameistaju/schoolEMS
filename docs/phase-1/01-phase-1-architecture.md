# Document 01: Phase 1 Target Architecture & Foundation Specification

**Document Status:** PHASE 1 IMPLEMENTATION PLAN CORRECTED — READY FOR DEVELOPMENT IMPLEMENTATION  
**Classification:** Enterprise Architecture Blueprint  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Final Security Corrections Applied)  

---

## 1. Phase 1 Objectives & Architectural Mandate

The primary objective of Phase 1 is to establish a secure, multi-tenant cloud-native identity, authentication, and database isolation foundation for the School Management System (SMS). This layer guarantees that multiple independent schools (and their multiple branch campuses) share a unified identity infrastructure while maintaining mathematically verified, zero-trust data isolation.

### Core Security Principle
> **Invariant:** A user from School A must never be able to access School B's information by changing a URL, query parameter, HTTP header, JWT claim, browser storage value, or API payload. Data isolation is enforced by the database engine (PostgreSQL RLS) on Phase 1 tenant tables and backend authorization middleware, never by frontend routing or UI visibility alone.

---

## 2. Preservation of Existing E-Commerce Architecture & Databases

In accordance with strict preservation rules, **all existing e-commerce services, databases, schemas, and functionality remain active and untouched**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DATABASE STRATEGY OVERVIEW                               │
└────────────────────────────────────────────────────────────────────────────────────────┘

[ 1. EXISTING E-COMMERCE STACK (100% PRESERVED & UNTOUCHED) ]
  ├── catalog_db  <── catalog-service (:4002)  [Pickles, weights, spice levels, stock]
  ├── cart_db     <── cart-service (:4003)     [Shopping cart items per user]
  ├── orders_db   <── order-service (:4004)    [Checkout saga, orders, line items]
  └── payments_db <── payment-service (:4005)  [Simulated UPI/Card transactions]

[ 2. PHASE 1 MULTI-TENANT IDENTITY UPGRADE ]
  └── auth_db     <── auth-service / identity-service (:4001)
                      * Extends existing users table non-destructively
                      * Adds Phase 1 multi-tenant tables (tenants, branches, RBAC, RLS)

[ 3. FUTURE SCHOOL DOMAIN DATABASES (TO BE PROVISIONED IN PHASES 2–6) ]
  ├── school_academic_db   <── academic-service (Phase 3: Classes, Subjects, Syllabi)
  ├── school_records_db    <── student-records-service (Phases 2, 4, 5: Students, Attendance, Exams)
  ├── school_finance_db    <── finance-service (Phase 6: Fee structures, Invoices, Razorpay)
  └── school_operations_db <── operations-service (Phase 8: Notifications, Bus tracking)
```

* **No Silent Repurposing:** `catalog_db`, `orders_db`, and `payments_db` are **NOT** repurposed for school records. They remain dedicated to e-commerce. Future school services will connect to their own dedicated databases (`school_academic_db`, etc.) when those phases are formally authorized.
* **Controlled Transition:** `auth-service`, `gateway`, and common utilities are preserved for reuse. Their source directories remain intact while migration dependencies are systematically resolved.

---

## 3. Logical Architecture Diagram

```
                                  [ INBOUND TRAFFIC ]
                                  (HTTPS / Port 443)
                                           │
                                  [ Route 53 + ALB ]
                                           │
                             [ school-gateway (:8080) ]
                             ├── 1. Host Extraction (e.g. apex.schoolsaas.com)
                             ├── 2. Tenant Domain Resolver (Domain Cache)
                             │      * Strict Host resolution in Production
                             │      * X-Tenant-Domain allowed ONLY in Local Dev
                             ├── 3. Inbound Header Sanitization (Strip X-Verified-*)
                             ├── 4. Asymmetric JWT Validation (RS256 Public Key)
                             │      * Strict Alg Check: Rejects HS256 legacy tokens
                             └── 5. Rate Limiting (IP Sliding Window)
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
           [ public / auth traffic ]             [ authenticated school traffic ]
                        │                                     │
                        ▼                                     ▼
          [ school-identity-service ]             [ downstream services ]
                   (:4001)                                 (:4002 - :4005)
                        │                                     │
                        ├──────────────────┬──────────────────┘
                        │                  │
                        ▼                  ▼
          [ Internal Context Validator (X-Verified-Tenant-Id) ]
                        │
                        ▼
          [ Authorization Middleware (Phase 1 RBAC Scope) ]
                        │
                        ▼
          [ Database Pool Checkout with Transaction Context ]
             BEGIN;
             SELECT set_config('app.current_tenant_id', $1, true);
                        │
                        ▼
          [ PostgreSQL Kernel: Row-Level Security (RLS) ]
          (Enforced strictly on Phase 1 tenant tables in auth_db)
                        │
                        ▼
          [ Isolated School Data in auth_db ]
```

---

## 4. Key Architectural Decisions (ADR Summary)

| ADR ID | Architectural Question | Approved Decision | Rationale |
| :---: | :--- | :--- | :--- |
| **ADR-01** | Database Assignment | Retain `auth_db` as the initial identity store. | Preserves Docker Compose and Kubernetes configurations; introduces multi-tenancy without schema conflicts. |
| **ADR-02** | E-Commerce DB Preservation | Keep `catalog_db`, `orders_db`, and `payments_db` 100% separate and untouched. | Prevents data corruption; school domain services will receive dedicated databases (`school_*_db`) in later phases. |
| **ADR-03** | Schema Migration Framework | Adopt **Knex.js** (`knex`). | SQL-first, lightweight, transactional `.up()` / `.down()`, zero native C++ compilation bindings, tracks `knex_migrations`. |
| **ADR-04** | SuperAdmin Provisioning | Dedicated CLI bootstrap seed script with explicit secret. | Never prints passwords to CI logs. Writes credentials to a permission-restricted file or environment. Idempotent without overwriting existing accounts. |
| **ADR-05** | Hardened Tenant Resolution | Hostname-only in production; strict rejection of header fallback in production. | `X-Tenant-Domain` allowed ONLY if `NODE_ENV === 'development'` and `ALLOW_HEADER_TENANT_RESOLVER === 'true'`. |
| **ADR-06** | JWT Algorithm Isolation | Strict cryptographic segregation (RS256 for School, HS256 for legacy). | Enforces `alg: 'RS256'`, `iss: 'https://auth.schoolsaas.com'`, `aud: 'schoolsaas-api'`. Legacy HS256 tokens rejected by school endpoints. |
| **ADR-07** | Branch Access Control | Hierarchical `branch_id` in `membership_roles`. | `branch_id IS NULL` grants school-wide scope; non-null `branch_id` restricts access to a specific campus. |
| **ADR-08** | Session Invalidation | Refresh token family rotation + token hash storage. | Instant revocation of refresh credentials; short 15-minute access token lifespan limits exposure. |
| **ADR-09** | Demo Data Hardening | Fictional school names and reserved RFC 2606 test domains (`@example.edu`). | Never uses real school names. Strictly prohibited in production environments. |
| **ADR-10** | Database Privileges & RLS | Three-tier database role model (`postgres`, `school_schema_owner` [NOLOGIN], `school_app_user` [NOBYPASSRLS]). | Least-privilege grants; `audit_logs` has INSERT/SELECT only (no UPDATE/DELETE). Parameterized `set_config` with transaction scope. |
