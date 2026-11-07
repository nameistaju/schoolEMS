# Document 04: Database Test Strategy & Verification Protocol

**Document Status:** TECHNICAL SPECIFICATION — APPROVED BASELINE  
**Classification:** Quality Engineering, Verification & Test Integrity  
**Database Topology:** PostgreSQL 18.6 `auth_db` | RLS Role `school_app_user`  
**Date:** March 2026  
**Author:** Lead Database Quality Architect & Security Assurance Specialist  

---

## 1. Test Objectives & Scope

This strategy defines the complete verification suite required to validate physical database schema integrity, security boundaries, and relational consistency across all 33 modules in SchoolEMS.

In accordance with Core Rule 8 (Test Integrity) and Rule 3 (Evidence or Not Done):
- Every test scenario tests actual source code and real database constraints; mocks of database constraints or RLS kernels are strictly forbidden.
- Real PostgreSQL 18.6 in WSL is the execution runtime.
- Tests verify both positive business flows and negative defensive boundaries (e.g. fail-closed RLS, cross-tenant isolation).

---

## 2. Five-Tier Test Classification

```
┌────────────────────────────────────────────────────────────────────────┐
│                      FIVE-TIER VERIFICATION MODEL                     │
├────┬─────────────────────────┬─────────────────────────────────────────┤
│ Tier│ Test Category            │ Execution Environment & Scope           │
├────┼─────────────────────────┼─────────────────────────────────────────┤
│ T1 │ **Unit Tests**          │ Fast in-memory validation of domain     │
│    │                         │ helpers, hash routines, and schemas.    │
├────┼─────────────────────────┼─────────────────────────────────────────┤
│ T2 │ **Integration Tests**   │ Service repository tests against real   │
│    │                         │ PostgreSQL tables and Knex queries.     │
├────┼─────────────────────────┼─────────────────────────────────────────┤
│ T3 │ **PostgreSQL RLS Tests**│ Direct SQL queries executed under role  │
│    │                         │ `school_app_user` to prove isolation.   │
├────┼─────────────────────────┼─────────────────────────────────────────┤
│ T4 │ **API Auth Tests**      │ HTTP endpoint tests validating role and │
│    │                         │ branch claims across all 7 personas.    │
├────┼─────────────────────────┼─────────────────────────────────────────┤
│ T5 │ **E2E Workflow Tests**  │ Multi-step atomic state machine flows   │
│    │                         │ (Admissions, Rollover, Cashier fees).   │
└────┴─────────────────────────┴─────────────────────────────────────────┘
```

---

## 3. Detailed Test Matrix by Security & Integrity Domain

### 3.1 Domain A: Foreign-Key & Relational Integrity (T2)
| Test ID | Test Scenario | Expected Outcome | Failure Condition |
| :---: | :--- | :--- | :--- |
| **FK-01** | Insert `sis.classes` referencing non-existent `branch_id`. | `23503` (Foreign key violation). | Insert succeeds; dangling class. |
| **FK-02** | Delete `public.branches` with active `sis.students`. | `23503` (`ON DELETE RESTRICT` blocks deletion). | Branch deleted; students orphaned. |
| **FK-03** | Insert `sis.student_enrollments` referencing non-existent `student_id`.| `23503` (Foreign key violation). | Enrollment created without student. |
| **FK-04** | Delete `sis.students` with recorded `sis.fee_payments`. | `23503` (`RESTRICT` blocks deletion). | Financial audit records deleted. |

### 3.2 Domain B: Unique & Partial Constraints (T2)
| Test ID | Test Scenario | Expected Outcome | Failure Condition |
| :---: | :--- | :--- | :--- |
| **UQ-01** | Set `is_current = true` on two `sis.academic_years` under the same tenant. | `23505` (`uq_sis_current_ay` partial unique index trips). | Two academic years simultaneously active. |
| **UQ-02** | Insert two `status = 'active'` enrollments for same student in same AY. | `23505` (`uq_sis_active_enrollment` partial index trips). | Student active in multiple sections in one year. |
| **UQ-03** | Mark two guardians as `is_primary = true` for the same student. | `23505` (`uq_sis_single_primary_guardian` trips). | Ambiguous primary guardian contact. |
| **UQ-04** | Schedule teacher in two different sections at same day & period. | `23505` (`uq_sis_teacher_no_conflict` trips). | Teacher double-booked in timetable. |

### 3.3 Domain C: Multi-Tenant RLS & Fail-Closed Behavior (T3)
All T3 tests execute directly under unprivileged PostgreSQL role `school_app_user`.

| Test ID | Test Scenario | Context Setting | Expected SQL Result |
| :---: | :--- | :--- | :--- |
| **RLS-01** | Query `sis.students` without setting `app.current_tenant_id`. | Context: Unset / empty string | **0 rows returned** (Fail-closed). |
| **RLS-02** | Query `sis.students` with invalid non-UUID tenant string. | Context: `'invalid-uuid'` | Database error thrown; 0 rows. |
| **RLS-03** | Connect as Tenant A, query `sis.students` created by Tenant B. | Context: `tenant_id = Tenant_A` | **0 rows returned** (Strict isolation). |
| **RLS-04** | Attempt `INSERT INTO sis.students` with `tenant_id = Tenant_B` while context is Tenant A. | Context: `tenant_id = Tenant_A` | `44000` (`WITH CHECK` violation). |
| **RLS-05** | Attempt `UPDATE sis.students` belonging to Tenant B while context is Tenant A. | Context: `tenant_id = Tenant_A` | 0 rows affected. |
| **RLS-06** | Connection pool context leakage test: Run Tenant A query, release connection, run query without setting context. | Borrowed from pool | **0 rows returned**; context cleared in `finally`. |

### 3.4 Domain D: Role & Relationship Scoping (T4)
| Test ID | Test Scenario | Request Identity | Expected Result |
| :---: | :--- | :--- | :--- |
| **SCOPE-01**| Parent A requests `/api/v1/sis/students/:id` for Child 1 (mapped in `student_guardians`). | Parent A JWT | `200 OK` with student details. |
| **SCOPE-02**| Parent A requests `/api/v1/sis/students/:id` for Child 2 (NOT mapped in `student_guardians`).| Parent A JWT | `404 Not Found` (Scoped query returns 0 rows). |
| **SCOPE-03**| Teacher requests `/api/v1/sis/attendance/sessions` for unassigned Section 10-B. | Teacher JWT | `403 Forbidden` (`TEACHER_NOT_ASSIGNED`). |
| **SCOPE-04**| Teacher requests `/api/v1/sis/students/:id/health` full medical file. | Teacher JWT | `403 Forbidden` (Allergy summary only). |
| **SCOPE-05**| Accountant requests `/api/v1/sis/students/:id/safeguarding` case notes. | Accountant JWT | `403 Forbidden` (`ACCESS_DENIED`). |
| **SCOPE-06**| SuperAdmin attempts to query student health or fee balances. | SuperAdmin JWT | `403 Forbidden` (Global role has no SIS domain access). |

### 3.5 Domain E: Concurrency & Race Conditions (T2)
| Test ID | Test Scenario | Concurrency Level | Expected Outcome |
| :---: | :--- | :---: | :--- |
| **CONC-01**| Two teachers mark attendance for the same section & date simultaneously. | 2 parallel requests | Exactly 1 session created; second receives `409 Conflict`. Zero duplicate rows. |
| **CONC-02**| Two cashiers record payment for same fee allocation with remaining balance ₹5,000 (payments: ₹3,000 and ₹3,000). | 2 parallel requests | First succeeds; second fails with `400 Amount exceeds remaining balance`. |
| **CONC-03**| Two concurrent admissions into section with exactly 1 remaining capacity slot. | 2 parallel requests | First succeeds (slot 35/35); second fails with `400 Section at maximum capacity`. |

### 3.6 Domain F: Atomic Workflows & State Transitions (T5)
| Test ID | Test Scenario | Simulated Failure Point | Expected System State |
| :---: | :--- | :--- | :--- |
| **ATOM-01**| Student admission transaction converts application to enrolled student. | Failure during fee allocation insertion | Application remains `submitted`; student record, sequence increment, and enrollment rolled back completely. |
| **ATOM-02**| Academic Rollover Wizard processes 40 students; student #38 causes section capacity error. | Section capacity constraint fails | Entire rollover transaction rolls back; source AY remains active; 0 new enrollments created. |
| **ATOM-03**| Principal approves fee concession (OD-04). | Success | Concession status = `approved`, allocation concession credit updated atomically. |
| **ATOM-04**| Cashier records cash payment. | Success | Allocation paid balance incremented, receipt sequence incremented, receipt payment row created. |

---

## 4. Test Execution Commands & Automation Plan

```bash
# 1. Run in-memory unit tests (T1)
npm test -- test/unit/

# 2. Run service integration tests (T2)
npm test -- test/integration/

# 3. Run PostgreSQL RLS kernel isolation suite (T3)
npm test -- test/security/rls-isolation.test.js

# 4. Run API persona authorization tests (T4)
npm test -- test/api/persona-authorization.test.js

# 5. Run end-to-end multi-step transaction tests (T5)
npm test -- test/e2e/admissions-attendance-rollover.test.js
```
