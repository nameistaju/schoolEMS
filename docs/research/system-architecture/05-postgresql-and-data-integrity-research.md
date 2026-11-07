# Document 05: PostgreSQL Relational Modeling and Data Integrity Technical Research

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Database Engineering, Physical Relational Modeling & Transaction Integrity  
**Target Engine:** PostgreSQL 18.6 (x86_64-pc-linux-gnu / WSL2 Ubuntu)  
**Date:** March 2026  
**Author:** Lead Database Reliability Engineer & Principal Data Systems Architect  

---

## 1. Relational Modeling Principles & Standards

A robust enterprise database schema must rely on the relational engine's mathematical guarantees rather than assuming application code will always behave correctly. This research details the core relational principles adopted for SchoolEMS on PostgreSQL 18.6.

### 1.1 Primary Key Strategy: UUIDv4 vs. Sequential Integers
- **Evaluation:** Auto-incrementing sequential integers (`SERIAL`, `BIGINT`) leak business volume metrics (e.g. knowing that Student ID is 42 reveals the school has admitted 42 students), allow enumeration attacks (incrementing ID by 1), and create merge collisions if data is synchronized across campuses.
- **Decision:** All primary keys utilize **`UUID PRIMARY KEY DEFAULT gen_random_uuid()`**.
- **PostgreSQL 18 Performance:** Modern PostgreSQL evaluates UUID primary keys efficiently via standard B-Tree indexing. For initial pilot datasets (< 100,000 rows), random UUID insertion overhead is imperceptible (< 0.05ms per insert).

### 1.2 Referential Integrity & Cascading Policies
Foreign keys protect against dangling records and maintain data consistency:
- **`ON DELETE RESTRICT` (Default for Core Entities):** Deleting a parent entity is rejected if child records exist. For example, a `class` cannot be deleted if `sections` or `students` reference it; a `student` cannot be deleted if `fee_payments` exist.
- **`ON DELETE CASCADE` (Strictly for True Compositions):** Permitted only when a child entity cannot logically exist without its parent (e.g., deleting an `academic_rollover_log` cascades to its `academic_rollover_items`; deleting an `attendance_session` cascades to its individual `student_attendance` marks).
- **`ON DELETE SET NULL`:** Used for optional relationships where the child remains valid if the referenced parent is deleted (e.g., `class_teacher_id` on a section).

### 1.3 Composite Scoping & Relational Integrity
In a multi-tenant, multi-branch system, foreign keys must ensure entities do not cross institutional boundaries:
- A student enrolled in Section 10-A must belong to the exact same branch that owns Section 10-A.
- Where appropriate, composite unique keys (e.g. `(branch_id, id)`) and composite foreign keys ensure that campus relationships cannot be cross-linked.

---

## 2. Advanced Constraint Engineering & Partial Indexes

PostgreSQL offers rich constraint capabilities that enforce complex business rules directly at the kernel level:

### 2.1 Partial Unique Indexes
Partial unique indexes enforce uniqueness conditionally over a filtered subset of rows (`WHERE predicate`):

1. **Exactly One Current Academic Year per Tenant:**
   ```sql
   CREATE UNIQUE INDEX uq_sis_current_ay 
   ON sis.academic_years (tenant_id) 
   WHERE is_current = true;
   ```
   *Behavior:* Any attempt to set `is_current = true` on a second academic year for the same tenant immediately raises error `23505 (unique_violation)`.

2. **Single Active Section Enrollment per Student per Academic Year:**
   ```sql
   CREATE UNIQUE INDEX uq_sis_active_enrollment 
   ON sis.student_enrollments (student_id, academic_year_id) 
   WHERE status = 'active';
   ```
   *Behavior:* Prevents a student from being actively rostered in two different sections during the same academic year, while permitting historical records (`promoted`, `withdrawn`).

3. **Single Primary Guardian per Student:**
   ```sql
   CREATE UNIQUE INDEX uq_sis_single_primary_guardian 
   ON sis.student_guardians (student_id) 
   WHERE is_primary = true;
   ```
   *Behavior:* Guarantees clear emergency responsibility by preventing two guardians from being flagged as primary for the same child.

4. **Teacher Timetable Conflict Prevention:**
   ```sql
   CREATE UNIQUE INDEX uq_sis_teacher_no_conflict 
   ON sis.timetable_slots (academic_year_id, teacher_id, day_of_week, period_id);
   ```
   *Behavior:* Mathematically eliminates teacher double-booking across classrooms and sections.

---

## 3. Transaction Boundaries & Concurrency Control

In educational and financial workflows, multi-step operations must be executed inside explicit ACID transaction boundaries to prevent partial corruption.

### 3.1 Admission Conversion Transaction
Transitioning an applicant from `sis.admission_applications` to `sis.students` requires six coordinated steps executed inside a single transaction:

```sql
BEGIN;
  -- 1. Lock and increment atomic admission sequence
  UPDATE sis.admission_number_sequences
  SET last_number = last_number + 1
  WHERE branch_id = $1 AND academic_year_id = $2
  RETURNING prefix, last_number;

  -- 2. Insert master student profile
  INSERT INTO sis.students (tenant_id, branch_id, admission_number, ...)
  VALUES ($tenant_id, $branch_id, $admission_num, ...)
  RETURNING id;

  -- 3. Upsert guardian and link in student_guardians
  INSERT INTO sis.guardians (...) VALUES (...) RETURNING id;
  INSERT INTO sis.student_guardians (student_id, guardian_id, is_primary, ...) VALUES (...);

  -- 4. Create active cohort enrollment
  INSERT INTO sis.student_enrollments (student_id, academic_year_id, class_id, section_id, status)
  VALUES ($student_id, $academic_year_id, $class_id, $section_id, 'active');

  -- 5. Allocate assessed tuition fee obligations
  INSERT INTO sis.student_fee_allocations (student_id, fee_structure_id, allocated_amount, ...)
  SELECT $student_id, fs.id, fs.amount, ... FROM sis.fee_structures fs WHERE fs.class_id = $class_id;

  -- 6. Update application status
  UPDATE sis.admission_applications SET status = 'enrolled' WHERE id = $application_id;
COMMIT;
```
*Failure Guarantee:* If any step fails (e.g. section capacity constraint exceeded or database disconnection), PostgreSQL rolls back all steps, ensuring no dangling student records or sequence desynchronizations occur.

### 3.2 Concurrency & Pessimistic Row Locking (`FOR UPDATE`)
Concurrent cashier operations (e.g. two accountants attempting to record payments for the same student fee allocation simultaneously) can cause race conditions where total payments exceed the assessed fee.

To prevent this, cashier collection transactions must acquire an exclusive row-level lock:
```sql
BEGIN;
  -- Acquire pessimistic lock on the specific fee allocation row
  SELECT allocated_amount, concession_amount, paid_amount
  FROM sis.student_fee_allocations
  WHERE id = $allocation_id
  FOR UPDATE;

  -- Application checks: (paid_amount + concession_amount + new_payment) <= allocated_amount

  -- Generate atomic receipt number
  UPDATE sis.fee_receipt_sequences
  SET last_receipt_number = last_receipt_number + 1
  WHERE branch_id = $branch_id AND academic_year_id = $academic_year_id
  RETURNING prefix, last_receipt_number;

  -- Record payment
  INSERT INTO sis.fee_payments (...);

  -- Update allocation balance
  UPDATE sis.student_fee_allocations
  SET paid_amount = paid_amount + $new_payment,
      status = CASE WHEN (paid_amount + $new_payment + concession_amount) >= allocated_amount THEN 'paid' ELSE 'partially_paid' END
  WHERE id = $allocation_id;
COMMIT;
```

---

## 4. Financial Exactness Standards

In accordance with strict accounting rules:
1. **PostgreSQL Data Type:** All financial balances, fee structure amounts, concession values, and payment amounts must strictly use **`NUMERIC(12, 2)`**.
   - Floating point data types (`FLOAT`, `DOUBLE PRECISION`, `REAL`) are strictly prohibited due to binary floating-point rounding errors (e.g. `0.1 + 0.2 = 0.30000000000000004`).
2. **Currency Standardization:** Currency is strictly **`INR`** (Indian Rupee, ₹). Multi-currency conversions are out of scope for Stage 1.
3. **Double-Entry Balance Constraint:**
   ```sql
   CONSTRAINT chk_sis_fee_amounts CHECK (
     concession_amount <= allocated_amount AND 
     (paid_amount + concession_amount) <= allocated_amount
   )
   ```
4. **Payment Immutability:** Once a payment is recorded in `sis.fee_payments`, it cannot be updated or deleted. Database-level permissions for runtime role `school_app_user` grant `INSERT, SELECT` only. Corrections must be handled via documented reversal credits.

---

## 5. Data Lifecycle: Soft Deletion vs. Historical Records

| Data Category | Tables | Deletion / Lifecycle Policy | Technical Rationale |
| :--- | :--- | :--- | :--- |
| **Configurable Master Data** | `classes`, `sections`, `subjects` | **Selective Soft Deletion** (`deleted_at TIMESTAMPTZ NULL`) | Allows administrators to retire older classes or subjects without breaking foreign key history. |
| **Student Profiles** | `students` | **Status State Machine + Soft Deletion** | Active students transition between states (`active`, `graduated`, `transferred`, `withdrawn`). Soft delete is reserved for administrative corrections. |
| **Academic History** | `student_enrollments`, `academic_years` | **Immutable Historical Records** | Enrollments are never deleted; status transitions to `promoted` or `retained` to preserve academic transcript history. |
| **Daily Attendance** | `attendance_sessions`, `student_attendance` | **Locked & Audited** | Roll-call registers lock after the daily window; corrections generate immutable records in `attendance_audit_logs`. |
| **Financial Records** | `fee_payments`, `fee_receipt_sequences` | **Strictly Append-Only** | Deletions and updates are permanently prohibited by schema-level grants. |
| **Security Audits** | `public.audit_logs` | **Append-Only** | Prevents compromised accounts from erasing forensic evidence. |
