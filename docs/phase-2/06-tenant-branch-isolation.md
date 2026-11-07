# Document 06: Tenant & Branch Isolation Architecture

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Multi-Tenancy Architecture & Security Isolation  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal Security Architect & Lead Database Engineer  

---

## 1. Domain Isolation Hierarchy & Multi-Tier Boundaries

In SchoolEMS, data isolation operates on a strict multi-tiered hierarchy. The system distinguishes between **Tenant Boundaries** (hard, non-negotiable legal and security boundaries between distinct educational trusts or school boards) and **Branch Boundaries** (administrative organizational partitions within a single institution).

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PLATFORM SUPERADMIN SCOPE                             │
│                         (Global Platform Management)                            │
└────────────────────────────────────────┬────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               TENANT LEVEL SCOPE                                │
│                     (e.g., Apex Educational Society - Trust)                    │
│  - Academic Calendars (`sis.academic_years`)                                    │
│  - Master Guardian Profiles (`sis.guardians`)                                   │
│  - Identity & Role Bindings (`public.users`, `public.memberships`)              │
└──────────────────┬───────────────────────────────────────────┬──────────────────┘
                   │                                           │
                   ▼                                           ▼
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│          BRANCH A (MAIN)            │     │          BRANCH B (NORTH)           │
│   (Campus: Hyderabad Secondary)     │     │   (Campus: Secunderabad Primary)    │
│  - Classes & Physical Rooms         │     │  - Classes & Physical Rooms         │
│  - Demographic Student Profiles     │     │  - Demographic Student Profiles     │
│  - Active & Past Section Rosters    │     │  - Active & Past Section Rosters    │
│  - Local Teachers & Campus Heads    │     │  - Local Teachers & Campus Heads    │
│  - Segregated Medical Records       │     │  - Segregated Medical Records       │
│  - Segregated Safeguarding Records  │     │  - Segregated Safeguarding Records  │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
```

---

## 2. Entity Ownership Taxonomy

To eliminate data ambiguity, prevent orphaned cross-tenant linkages, and govern cross-branch operations, every entity in the SIS domain has explicitly defined ownership rules:

| Entity Name | Scope Level | Ownership Key | Cross-Branch Sharing Policy |
| :--- | :---: | :---: | :--- |
| `sis.academic_years` | **Tenant** | `tenant_id` | **Shared across all branches.** Synchronizes district or trust-wide academic calendars and examination terms. |
| `sis.classes` | **Branch** | `tenant_id, branch_id` | **Isolated to branch.** Different campuses offer different grade configurations (e.g. Primary campus offers K–5; Secondary offers 6–12). |
| `sis.sections` | **Branch** | `tenant_id, branch_id` | **Strictly isolated to branch.** Physical classrooms belong to specific campus buildings. |
| `sis.students` | **Branch** | `tenant_id, branch_id` | **Bound to current base branch.** Transferred between campuses via formal multi-stage transfer workflow. |
| `sis.student_health_records` | **Branch / Confidential** | `tenant_id` | **1:1 with Student.** Access restricted strictly to Campus Medical Staff and School Admin. |
| `sis.student_safeguarding_records`| **Branch / Restricted** | `tenant_id` | **1:1 with Student.** Highest isolation. Restricted to Principal and Designated Safeguarding Lead. |
| `sis.student_documents` | **Branch** | `tenant_id` | **Bound to Student.** Access governed by document sensitivity type. |
| `sis.guardians` | **Tenant** | `tenant_id` | **Shared across branches within the same tenant.** A parent with children in different branches has one profile. Strictly never shared across tenants. |
| `sis.student_guardians` | **Tenant** | `tenant_id` | **Relationship mapping.** Scoped to a specific student. Relationship to Child A grants zero access to Child B. |
| `sis.guardian_consents` | **Tenant** | `tenant_id` | **Legal consent log.** Records DPDP Act 2023 Section 9 minor processing consent per child-guardian pair. |
| `sis.admission_applications` | **Branch** | `tenant_id, branch_id` | **Target branch.** Prospective applicant applying for a seat at a specific campus. |
| `sis.application_documents` | **Branch** | `tenant_id` | **Bound to Application.** Verified documents promoted to student upon matriculation. |
| `sis.admission_number_sequences` | **Branch** | `tenant_id, branch_id` | **Branch-scoped counter.** Concurrency-safe sequence generation per campus and year. |
| `sis.student_enrollments` | **Branch** | `tenant_id, branch_id` | **Strictly isolated to branch.** Historical and active section placements at a specific campus. |
| `sis.student_transfers` | **Tenant** | `tenant_id` | **Cross-branch coordination.** Governs inter-branch release, clearance, and acceptance. |

---

## 3. Defense-in-Depth Cross-Tenant Isolation

Cross-tenant isolation relies on an unbroken chain of defense across the API gateway, microservice runtime, and PostgreSQL database engine:

```
[ Inbound HTTP Request ]
           │
           │ Host: apex.example (or X-Tenant-Id from verified session)
           ▼
┌────────────────────────────────────────┐
│            school-gateway              │
│ - Strips all client `X-Verified-*`     │
│ - Strips client `X-Gateway-Secret`     │
│ - Authoritatively maps Host to tenant  │
│ - Injects internal HMAC secret         │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│        student-records-service         │
│ - Validates X-Gateway-Secret & Origin  │
│ - Verifies RS256 token signature & kid │
│ - Asserts `req.user.tenant_id`         │
│ - Authorizes RBAC permissions          │
│ - NEVER trusts client-supplied tenant  │
└───────────────────┬────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│       PostgreSQL Database Pool         │
│ - Connection Role: `school_app_user`   │
│   (Configured with `NOBYPASSRLS`)      │
│ - `withTenantContext` executes:        │
│   SET LOCAL app.current_tenant_id = $1 │
│   SET LOCAL app.current_branch_id = $2 │
│ - Engine-enforced RLS on `sis.*`       │
│ - Missing context fails closed         │
└────────────────────────────────────────┘
```

### 3.1 Composite Foreign Keys for Multi-Tenant Integrity
To mathematically guarantee that a record in table B cannot reference a parent record in table A belonging to a different tenant, SchoolEMS enforces **composite foreign keys** on all relationship tables:

```sql
-- In sis.student_enrollments:
CONSTRAINT fk_enrollment_student_tenant 
  FOREIGN KEY (tenant_id, student_id) 
  REFERENCES sis.students (tenant_id, id) 
  ON DELETE RESTRICT;

-- In sis.student_guardians:
CONSTRAINT fk_sg_student_tenant 
  FOREIGN KEY (tenant_id, student_id) 
  REFERENCES sis.students (tenant_id, id) 
  ON DELETE CASCADE;

CONSTRAINT fk_sg_guardian_tenant 
  FOREIGN KEY (tenant_id, guardian_id) 
  REFERENCES sis.guardians (tenant_id, id) 
  ON DELETE RESTRICT;
```
*Guaranteed Result:* Even if a rogue SQL statement attempted to link Student from Tenant 1 with Guardian from Tenant 2, the composite foreign key constraint rejects the insert at the database engine level.

---

## 4. Branch Scoping & Cross-Branch Access Governance

While multi-tenancy is enforced unconditionally by the PostgreSQL RLS engine, branch scoping is governed by **Session Context & Authorization Middleware**:

### 4.1 Token Branch Purview
When a school administrator or teacher authenticates, their RS256 token contains their active branch context:
- **Tenant-Wide Purview (`branch_id: null`):** Assigned to Trust Trustees, Managing Directors, Central Registrars, and Platform SuperAdmins (break-glass). They can query and manage records across all physical campuses.
- **Campus-Scoped Purview (`branch_id: 'UUID'`):** Assigned to Campus Principals, Branch Vice-Principals, Front-Desk Registrars, and Teachers. Their token binds them strictly to their assigned campus.

### 4.2 Cross-Branch Access Matrix

| Role | Purview Scope | View Base Student Profile | View Health Records | View Safeguarding Records | Initiate Branch Transfer |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **SuperAdmin** | Global Platform | Break-Glass Only (Audited) | Denied | Denied | No |
| **SchoolAdmin** | Entire Tenant | All Campuses | Audited Access | Audited Access | Yes |
| **Principal** | Branch-Scoped | Own Campus Only | Designated Staff Only | Own Campus Only | Yes (Initiates/Accepts) |
| **Registrar** | Branch-Scoped | Own Campus Only | Denied | Denied | Submits Transfer Request |
| **Teacher** | Section-Scoped| Assigned Sections Only | Denied | Denied | No |
| **Medical Officer**| Campus-Scoped| Campus Enrolled Students | Own Campus Only | Denied | No |
| **CPO / DSL** | Campus-Scoped| Campus Enrolled Students | Denied | Own Campus Only | Reviews Safeguarding File |
| **Parent / Guardian**| Child-Scoped | Linked Children Only | Own Child Only | Denied | Requests Transfer |

---

## 5. Intra-School Branch Transfer Protocol

When a student transfers from Campus A (e.g. Hyderabad Main) to Campus B (e.g. Secunderabad North) within the same tenant:

```
[ Source Campus: Branch A ]                         [ Target Campus: Branch B ]
             │                                                   │
             │ 1. Initiates Transfer Request                     │
             ▼                                                   │
   [ Clearance & NOC Check ]                                     │
   (Fee dues settled, library assets returned)                   │
             │                                                   │
             │ 2. Releases Transfer Ticket & Clearance           │
             └──────────────────────────────────────────────────►│
                                                                 │ 3. Reviews Target Grade Capacity
                                                                 ▼
                                                        [ Accepts Transfer ]
                                                                 │
                                                                 │ 4. Executes Relocation Transaction
                                                                 ▼
                                            ┌────────────────────────────────────────┐
                                            │ Update `sis.students.branch_id`        │
                                            │ Close old enrollment in Branch A       │
                                            │ (Status: 'transferred')                │
                                            │ Create new enrollment in Branch B      │
                                            │ (Status: 'active')                     │
                                            │ Flag Safeguarding File for Review      │
                                            │ Audit Log: 'branch.transfer.executed'  │
                                            └────────────────────────────────────────┘
```

### 5.1 Historical Confidentiality & Safeguarding Isolation During Transfer
1. **Source Campus Teacher Access Revocation:** Immediately upon transfer execution, teachers at Campus A lose read access to the student profile, because teacher access is dynamically checked against active section rosters (`sis.student_enrollments.status = 'active'`).
2. **Safeguarding File Quarantine:** Child protection notes from Campus A are **not automatically visible** to general staff at Campus B. A secure notification is dispatched strictly to Campus B's Designated Safeguarding Lead (DSL) / Child Protection Officer (CPO) to review and formally acknowledge receipt of the confidential file.
3. **Permanent Record Integrity:** The student's historical enrollments in Campus A remain immutable in `sis.student_enrollments`, preserving academic transcripts and attendance history for official state board reporting.

---

## 6. Sibling & Guardian Cross-Branch Relationship Management

In multi-branch institutions, parents frequently have children enrolled across different campuses (e.g. older child in Secondary High School, younger child in Primary Campus):

1. **Unified Guardian Profile:** The guardian record exists at the tenant level in `sis.guardians`. The parent uses a single set of credentials and sees both children in the parent portal.
2. **Child-Specific Relationship Granularity:** Each child-guardian relationship is an independent record in `sis.student_guardians`:
   - Relationship to Child A (Branch 1) grants access **only** to Child A.
   - It conveys **zero** implicit access to Child B (Branch 2) unless an explicit row exists linking the guardian to Child B.
3. **Cross-Tenant Prohibition:** Multi-tenant sharing of guardian profiles is strictly prohibited. If a parent has a child in School Trust X and another child in School Trust Y, they are modeled as two completely distinct records with distinct `tenant_id`s to prevent data leakage.

---

## 7. PostgreSQL Row-Level Security DDL (Schema: `sis`)

All Phase 2 tables reside in database `auth_db` under schema `sis`. Every table enforces RLS via PostgreSQL role `school_app_user`.

```sql
-- Ensure search path
SET search_path = sis, public;

-- 1. Enable & Force RLS on all Phase 2 SIS Tables
ALTER TABLE sis.academic_years FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.classes FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.sections FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.students FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.student_health_records FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.student_safeguarding_records FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.student_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.guardians FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.student_guardians FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.guardian_consents FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.admission_applications FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.application_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.admission_number_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.student_enrollments FORCE ROW LEVEL SECURITY;
ALTER TABLE sis.student_transfers FORCE ROW LEVEL SECURITY;

-- 2. Define Tenant Isolation Policies (Fail Closed when app.current_tenant_id is NULL)

-- Academic Years Policy
CREATE POLICY rls_sis_academic_years ON sis.academic_years
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Classes Policy
CREATE POLICY rls_sis_classes ON sis.classes
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Sections Policy
CREATE POLICY rls_sis_sections ON sis.sections
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Students Policy (Tenant Isolation + Branch Filter)
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

-- Health Records Policy (Tenant Isolation)
CREATE POLICY rls_sis_health_records ON sis.student_health_records
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Safeguarding Records Policy (Tenant Isolation)
CREATE POLICY rls_sis_safeguarding_records ON sis.student_safeguarding_records
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Student Documents Policy
CREATE POLICY rls_sis_student_docs ON sis.student_documents
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Guardians Policy
CREATE POLICY rls_sis_guardians ON sis.guardians
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Student Guardians Mapping Policy
CREATE POLICY rls_sis_student_guardians ON sis.student_guardians
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Guardian Consents Policy
CREATE POLICY rls_sis_guardian_consents ON sis.guardian_consents
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);

-- Enrollments Policy
CREATE POLICY rls_sis_student_enrollments ON sis.student_enrollments
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

-- Student Transfers Policy
CREATE POLICY rls_sis_student_transfers ON sis.student_transfers
  FOR ALL TO school_app_user
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::UUID);
```
