# Document 04: Parent & Guardian Network & Granular Access Control (Revised)

**Document Status:** REVISED DESIGN SPECIFICATION — READY FOR REVIEW  
**Classification:** Guardian Entity Modeling & Family Network Architecture  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026 (Revised)  
**Author:** Principal System Architect & Privacy Engineer  
**Database Schema:** `sis` (within database `auth_db`)  

---

## 1. Domain Principles & Non-Assumption Philosophy

Real-world family networks in educational institutions do not conform to simplistic biological assumptions. SchoolEMS models parent and guardian relationships as a **many-to-many operational graph** governed by four foundational rules:

1. **Child-Specific Authorization Scoping:** A guardian's relationship to Child A **never** automatically grants permissions over Child B. For example, in blended families, a stepfather may be an authorized emergency contact for Child A, while having zero legal or pickup rights over Child B. Permissions, custody, and pickup authorities are strictly configured **per student-guardian relationship link** in `sis.student_guardians`.
2. **Tenant Boundary Immutability:** A guardian profile may be linked to multiple sibling students across different campus branches *within the same school tenant* (e.g. Primary campus and High School campus). However, guardian records are **strictly isolated by `tenant_id`** and are **never shared across different school tenants**.
3. **Diverse & Complex Family Structures:** The architecture natively represents:
   - Single-parent households.
   - Divorced or legally separated parents with split physical custody schedules.
   - Court-ordered non-custodial parents subject to active restraining orders.
   - Court-appointed legal guardians and state foster carers.
   - Grandparents acting as primary educational caretakers.
   - Designated non-custodial representatives (carpool drivers, nannies) with authorized pickup credentials only.
4. **Independent Consent & Decision-Making Authorities:** Differentiates between:
   - *Informational Access:* Viewing attendance, grades, and homework.
   - *Financial Liability:* Receiving tuition invoices and signing payment agreements.
   - *Emergency Medical Authorization:* Authorizing urgent medical procedures during school trips.
   - *Legal Exit Authorization:* Signing formal school withdrawal and Transfer Certificate (TC) releases.

```
                               ┌─────────────────────────────────┐
                               │          sis.guardians          │
                               │  - Rajesh Sharma                │
                               │  - Phone: +91 98765 43210       │
                               │  - Optional User Account Link   │
                               └───────────────┬─────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               │                                                               │
               ▼                                                               ▼
┌──────────────────────────────┐                                ┌──────────────────────────────┐
│    sis.student_guardians     │                                │    sis.student_guardians     │
│  Student: Aarav Sharma       │                                │  Student: Ananya Sharma      │
│  - Relationship: Father      │                                │  - Relationship: Father      │
│  - Primary Contact: YES      │                                │  - Primary Contact: YES      │
│  - Can View Grades: YES      │                                │  - Can View Grades: YES      │
│  - Medical Consent: YES      │                                │  - Medical Consent: YES      │
│  - Authorized Pickup: YES    │                                │  - Authorized Pickup: YES    │
│  - Access Status: 'active'   │                                │  - Access Status: 'active'   │
└──────────────────────────────┘                                └──────────────────────────────┘
```

---

## 2. Core Entities & Data Dictionary (Schema: `sis`)

### 2.1 `sis.guardians` (The Human Guardian Identity)
Represents the individual adult possessing responsibility for one or more students within a tenant.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Permanent guardian identifier. |
| `tenant_id` | `UUID` | Foreign Key `public.tenants(id)`, `NOT NULL` | RLS isolation boundary. Never cross-tenant. |
| `user_id` | `UUID` | Foreign Key `public.users(id)`, Nullable | Optional link to identity user for portal login. |
| `first_name` | `VARCHAR(100)` | `NOT NULL` | Legal first name. |
| `last_name` | `VARCHAR(100)` | `NOT NULL` | Legal family name / surname. |
| `email` | `VARCHAR(200)` | Nullable | Primary email for correspondence and digital reports. |
| `phone` | `VARCHAR(20)` | `NOT NULL` | Primary mobile number for emergency notifications. |
| `alternate_phone` | `VARCHAR(20)` | Nullable | Secondary contact number. |
| `occupation` | `VARCHAR(100)` | Nullable | Professional designation / employer. |
| `annual_income` | `NUMERIC(14,2)`| Nullable | Optional; collected strictly for concession audits. |
| `national_id_masked` | `VARCHAR(20)`| Nullable | Voluntary display mask (e.g. `XXXX-XXXX-8921`) for campus desk verification. |
| `residential_address` | `JSONB` | Nullable | Physical home address. |
| `work_address` | `JSONB` | Nullable | Workplace address for emergency dispatch. |
| `status` | `VARCHAR(20)` | Default: `'active'` | `'active'`, `'inactive'`, `'deceased'`. |
| `created_at` | `TIMESTAMPTZ` | Default: `now()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | Default: `now()` | Timestamp of last modification. |

*Tenant-Scoped Phone Uniqueness:*
```sql
CREATE UNIQUE INDEX uq_tenant_guardian_phone ON sis.guardians(tenant_id, phone);
```

---

### 2.2 `sis.student_guardians` (Child-Specific Authorization Ledger)
Defines the exact, granular legal and operational authority a guardian holds over a specific child.

| Column Name | Data Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | Primary Key, `gen_random_uuid()` | Relationship mapping identifier. |
| `tenant_id` | `UUID` | Foreign Key `public.tenants(id)`, `NOT NULL` | RLS isolation boundary. |
| `student_id` | `UUID` | Foreign Key `sis.students(id)`, `NOT NULL` | Linked student reference. |
| `guardian_id` | `UUID` | Foreign Key `sis.guardians(id)`, `NOT NULL` | Linked guardian reference. |
| `relationship` | `VARCHAR(30)` | `NOT NULL` | Relationship classification (see taxonomy below). |
| `is_primary` | `BOOLEAN` | Default: `false` | Main recipient for official institutional notices. |
| `is_emergency_contact` | `BOOLEAN` | Default: `true` | Eligible for urgent medical / security calls. |
| `emergency_priority` | `INTEGER` | Default: `1` | Call sequence rank (1 = first to dial, 2 = second, etc.). |
| `is_authorized_pickup` | `BOOLEAN` | Default: `true` | Authorized to physically collect student from campus. |
| `has_legal_custody` | `BOOLEAN` | Default: `true` | Holds legal custody rights. |
| `can_access_records` | `BOOLEAN` | Default: `true` | Authorized to view grades, attendance, and transcripts. |
| `can_consent_medical`| `BOOLEAN` | Default: `true` | Authorized to sign emergency medical treatment waivers. |
| `can_consent_excursions`| `BOOLEAN`| Default: `true` | Authorized to sign field trip and sports travel consent. |
| `can_sign_withdrawal`| `BOOLEAN` | Default: `true` | Authorized to initiate student withdrawal and sign TC. |
| `is_fee_payer` | `BOOLEAN` | Default: `false` | Financially responsible for fee invoice settlement. |
| `access_status` | `VARCHAR(30)` | Default: `'active'` | `'active'`, `'revoked'`, `'suspended'`, `'court_restricted'`. |
| `effective_date` | `DATE` | Default: `CURRENT_DATE` | Date authorization becomes valid. |
| `revoked_at` | `TIMESTAMPTZ` | Nullable | Timestamp if authority was formally revoked. |
| `revocation_reason` | `TEXT` | Nullable | Documented justification for revocation (e.g. court order). |
| `custody_order_on_file` | `BOOLEAN`| Default: `false` | Indicates formal court decree exists on record. |
| `pickup_restriction_notes`| `TEXT` | Nullable | Critical campus desk alert (e.g. "Restrained from campus"). |

*Integrity Invariants:*
1. **Single Association per Student-Guardian Pair:**
   ```sql
   CONSTRAINT uq_student_guardian_pair UNIQUE (student_id, guardian_id)
   ```
2. **Exactly One Active Primary Guardian per Student:**
   ```sql
   CREATE UNIQUE INDEX uq_student_single_primary 
     ON sis.student_guardians (student_id) 
     WHERE is_primary = true AND access_status = 'active';
   ```

---

## 3. Special Family Scenarios & Lifecycle Handling

### 3.1 Divorced & Separated Parents (Split Custody)
- Both parents maintain separate `sis.guardians` records.
- Both link to the student in `sis.student_guardians` with `has_legal_custody = true` and `can_access_records = true`.
- One parent is designated `is_primary = true` for primary postal correspondence, while both receive duplicate digital SMS/Email notifications.
- Days of authorized pickup can be documented in `pickup_restriction_notes` (e.g., "Father authorized Monday/Wednesday; Mother Tuesday/Thursday/Friday").

### 3.2 Court-Restricted Non-Custodial Guardians
When a court decree bars an estranged parent or individual from campus access:
1. `access_status` is updated to `'court_restricted'`.
2. `has_legal_custody = false`, `is_authorized_pickup = false`, `can_access_records = false`.
3. `custody_order_on_file = true`, and the case reference is logged.
4. When reception staff search the student at dismissal, a **Red Security Banner** displays:  
   `"RESTRICTED CONTACT ALERT: [Named Person] is strictly prohibited from campus under Court Order Ref [Case#]. Contact Campus Security immediately if present."`

### 3.3 Deceased Guardians
- `sis.guardians.status` is updated to `'deceased'`.
- All linked `sis.student_guardians` records transition to `access_status = 'revoked'`, `revocation_reason = 'Guardian deceased'`.
- If the deceased guardian was `is_primary = true`, the system triggers an administrative alert mandating the registrar reassign the primary contact designation to a surviving guardian.

---

## 4. Verifiable Parental Consent & Audit History

To comply with Section 9 of India's Digital Personal Data Protection (DPDP) Act 2023, verifiable consent events are immutably logged:

### `sis.guardian_consents` (Consent Audit Trail):
```sql
CREATE TABLE IF NOT EXISTS sis.guardian_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES sis.guardians(id) ON DELETE RESTRICT,
  consent_category VARCHAR(50) NOT NULL,
  consent_version VARCHAR(20) NOT NULL,
  is_granted BOOLEAN NOT NULL,
  verification_method VARCHAR(30) NOT NULL,
  verified_phone VARCHAR(20),
  ip_address VARCHAR(45),
  user_agent TEXT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,

  CONSTRAINT chk_consent_category CHECK (consent_category IN (
    'educational_processing', 'health_records', 'bus_gps_tracking',
    'extracurricular_travel', 'media_photo_release'
  )),
  CONSTRAINT chk_verification_method CHECK (verification_method IN (
    'otp_sms', 'signed_physical_form', 'portal_authenticated'
  ))
);

CREATE INDEX IF NOT EXISTS idx_sis_consents_student ON sis.guardian_consents(tenant_id, student_id);
```

---

## 5. PostgreSQL DDL Blueprint (Schema: `sis`)

```sql
-- 1. Guardians Master Table
CREATE TABLE IF NOT EXISTS sis.guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(200),
  phone VARCHAR(20) NOT NULL,
  alternate_phone VARCHAR(20),
  occupation VARCHAR(100),
  annual_income NUMERIC(14,2),
  national_id_masked VARCHAR(20),
  residential_address JSONB,
  work_address JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_guardian_status CHECK (status IN ('active', 'inactive', 'deceased')),
  CONSTRAINT uq_guardian_tenant_composite UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_guardian_phone 
  ON sis.guardians (tenant_id, phone);

CREATE INDEX IF NOT EXISTS idx_sis_guardians_tenant_email 
  ON sis.guardians (tenant_id, lower(email)) WHERE email IS NOT NULL;

-- 2. Student-Guardian Association Ledger
CREATE TABLE IF NOT EXISTS sis.student_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES sis.students(id) ON DELETE CASCADE,
  guardian_id UUID NOT NULL REFERENCES sis.guardians(id) ON DELETE RESTRICT,
  relationship VARCHAR(30) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_emergency_contact BOOLEAN NOT NULL DEFAULT true,
  emergency_priority INTEGER NOT NULL DEFAULT 1,
  is_authorized_pickup BOOLEAN NOT NULL DEFAULT true,
  has_legal_custody BOOLEAN NOT NULL DEFAULT true,
  can_access_records BOOLEAN NOT NULL DEFAULT true,
  can_consent_medical BOOLEAN NOT NULL DEFAULT true,
  can_consent_excursions BOOLEAN NOT NULL DEFAULT true,
  can_sign_withdrawal BOOLEAN NOT NULL DEFAULT true,
  is_fee_payer BOOLEAN NOT NULL DEFAULT false,
  access_status VARCHAR(30) NOT NULL DEFAULT 'active',
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  custody_order_on_file BOOLEAN NOT NULL DEFAULT false,
  pickup_restriction_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_student_guardian_pair UNIQUE (student_id, guardian_id),
  CONSTRAINT chk_emergency_priority CHECK (emergency_priority >= 1),
  CONSTRAINT chk_guardian_access_status CHECK (access_status IN ('active', 'revoked', 'suspended', 'court_restricted')),
  CONSTRAINT chk_guardian_relationship CHECK (relationship IN (
    'father', 'mother', 'stepfather', 'stepmother', 'legal_guardian',
    'grandparent', 'foster_parent', 'sibling_adult', 'authorized_representative', 'other'
  ))
);

-- Invariant: Exactly one active primary guardian per student
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_single_primary 
  ON sis.student_guardians (student_id) 
  WHERE is_primary = true AND access_status = 'active';

CREATE INDEX IF NOT EXISTS idx_sis_student_guardians_guardian 
  ON sis.student_guardians (guardian_id);
```
