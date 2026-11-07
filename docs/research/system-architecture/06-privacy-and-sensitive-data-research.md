# Document 06: Privacy, Children's Data and Sensitive Records Technical Research

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Privacy Engineering, Regulatory Analysis & Sensitive Data Protection  
**Primary Legal & Technical Standards:** Digital Personal Data Protection Act, 2023 (DPDP Act, Act No. 22 of 2023), OWASP Top 10 Privacy Risks  
**Date:** March 2026  
**Author:** Lead Privacy Engineer & Principal Data Protection Specialist  

---

## 1. Data Classification Taxonomy

Educational institutions collect, process, and retain a wide variety of personal and operational data. To establish appropriate technical safeguards, SchoolEMS establishes a five-tier data classification taxonomy:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DATA CLASSIFICATION & PURVIEW TAXONOMY                          │
├─────────┬──────────────────────────────┬─────────────────────────┬─────────────────────┤
│ Tier    │ Data Classification          │ Example Entities        │ Access & Protection │
├─────────┼──────────────────────────────┼─────────────────────────┼─────────────────────┤
│ Tier 1  │ **Public / Operational**     │ Academic years, terms,  │ Broad institutional │
│         │                              │ classes, subject names. │ read access.        │
├─────────┼──────────────────────────────┼─────────────────────────┼─────────────────────┤
│ Tier 2  │ **Internal Academic**        │ Timetables, homework,   │ Role-scoped staff,  │
│         │                              │ teacher allocations.    │ students & parents. │
├─────────┼──────────────────────────────┼─────────────────────────┼─────────────────────┤
│ Tier 3  │ **Demographics & PII**       │ Student names, DOB,     │ Authorized staff    │
│         │                              │ addresses, parent phones│ & linked guardians. │
├─────────┼──────────────────────────────┼─────────────────────────┼─────────────────────┤
│ Tier 4  │ **Confidential Financial**   │ Fee debits, cashier     │ Accountant & Admin  │
│         │                              │ receipts, concessions.  │ only.               │
├─────────┼──────────────────────────────┼─────────────────────────┼─────────────────────┤
│ Tier 5  │ **Restricted / Sensitive**   │ Medical files, allergies│ Segregated tables;  │
│         │ **(Health & Safeguarding)**  │ child protection notes. │ DSL/Principal only. │
└─────────┴──────────────────────────────┴─────────────────────────┴─────────────────────┘
```

---

## 2. Indian Child Data Protection Mandates: DPDP Act, 2023 (Section 9)

In India, the processing of children's digital personal data is governed by the **Digital Personal Data Protection Act, 2023 (Act No. 22 of 2023)**.

### 2.1 Statutory Provisions & Technical Implications

#### 1. Statutory Definition of "Child" (Section 2(f))
- **Statute:** Under the Act, a "child" is defined as any individual who has not completed eighteen years of age.
- **Technical Implication:** The heightened protections apply across the entire K-12 spectrum (including 16- and 17-year-old senior secondary pupils). The platform must treat all enrolled pupils as children unless adulthood is proven.

#### 2. Mandatory Verifiable Parental Consent (Section 9(1))
- **Statute:** The Data Fiduciary (the school / platform) shall, before processing any personal data of a child, obtain verifiable consent of the parent of such child or lawful guardian in such manner as may be prescribed.
- **Technical Implication:**
  - Minor students cannot self-consent to data processing during enrollment.
  - The system must capture and record explicit digital consents from the primary guardian (`sis.guardian_consents`).
  - Recorded consent records must include: `student_guardian_id`, `consent_type`, `is_granted`, `granted_at`, and network audit metadata (`ip_address`).

#### 3. Absolute Prohibition of Tracking & Behavioral Monitoring (Section 9(3))
- **Statute:** A Data Fiduciary shall not undertake tracking or behavioral monitoring of children or targeted advertising directed at children.
- **Technical Implication:**
  - **Zero Commercial Analytics:** Third-party tracking scripts (Google Analytics, Meta Pixel, Hotjar) are strictly forbidden within the application portals.
  - **No Automated Behavioral Profiling:** The system must not run automated psychological profiling or behavioral categorization algorithms on students based on attendance or marks.
  - **Zero Advertising:** The platform contains zero advertising inventory.

#### 4. Duty Against Detrimental Processing (Section 9(2))
- **Statute:** A Data Fiduciary shall not undertake any processing of personal data that is likely to cause any detrimental effect on the well-being of a child.
- **Technical Implication:** Security boundaries must prevent peer-to-peer data exposure (e.g. students viewing other students' attendance records, marks, or disciplinary notes).

---

## 3. Data Minimization & Privacy-by-Design Controls

### 3.1 Voluntary National ID (Aadhaar) Hashing
- **The Risk:** Storing 12-digit Indian Aadhaar numbers in plaintext creates severe regulatory liabilities under the Aadhaar Act and DPDP Act.
- **The Privacy Control:**
  1. Plaintext Aadhaar is never written to disk or database tables.
  2. For duplicate detection during admissions, the system generates a salted SHA-256 hash using a per-tenant cryptographic salt:
     $$\text{hash} = \text{SHA-256}(\text{Aadhaar} + \text{Salt}_{\text{tenant}})$$
     Stored in `sis.students.national_id_hash VARCHAR(64)`.
  3. For human administrative verification, the system extracts strictly the last 4 digits into a masked display token:
     `sis.students.national_id_masked = '●●●● ●●●● ' + Aadhaar.slice(-4)`.

### 3.2 Physical Table Segregation for Health & Safeguarding Records
To enforce strict defense-in-depth, sensitive records are physically segregated into dedicated tables rather than stored as columns on `sis.students`:

```
┌────────────────────────────────────────────────────────┐
│                   sis.students                         │
│  - Demographics, Admission Number, Emergency Phone     │
│  - Accessible to: SchoolAdmin, Principal, Teacher      │
└──────────────────────────┬─────────────────────────────┘
                           │ 1:1
        ┌──────────────────┴──────────────────┐
        │                                     │
        ▼                                     ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐
│  sis.student_health_records  │ │sis.student_safeguarding_recs │
│  - Allergies Summary (Public)│ │  - Protection Tier           │
│  - Medical Conditions (Conf) │ │  - Court Orders & Flags      │
│  - Physician Contacts        │ │  - Case Worker Notes         │
│  Access: Nurse, Admin, Princ │ │  Access: DSL & Principal ONLY│
└──────────────────────────────┘ └──────────────────────────────┘
```

#### Granular Access Control Rules:
1. **Classroom Teachers:**
   - Need to know if a child in their care has a life-threatening nut allergy or asthma.
   - *Technical Enforcement:* Teachers have access strictly to `allergies_summary` via daily roster queries. They are explicitly blocked from querying full medical conditions (`medical_conditions`, `medications_prescribed`) or safeguarding files.
2. **Designated Safeguarding Lead (DSL) & Principal:**
   - Full access to `sis.student_safeguarding_records` to manage child protection and court custody disputes.
3. **Platform SuperAdmin & Accountant:**
   - Completely blocked from accessing health and safeguarding tables via API route gates and database query restrictions.

---

## 4. Local File Upload Security & Access Protocol (OD-05)

In accordance with the **OWASP File Upload Cheat Sheet**, student portrait photographs (OD-05) and admission documents are secured through rigorous controls:

1. **Storage Location:** Files reside strictly outside the web server document root in `projects/school-management/services/student-records-service/uploads/sis/<tenant_id>/`.
2. **MIME & Magic Byte Validation:**
   - Permitted Photo Mappings: `image/jpeg` (`FF D8 FF`), `image/png` (`89 50 4E 47`).
   - Extensions provided by client browsers are ignored; true file type is validated via file header magic bytes.
3. **File Size Enforcement:**
   - Student Photos (OD-05): Maximum 2.0 MB (2,097,152 bytes) with client-side canvas downsampling and preview.
   - Admission Documents: Maximum 5.0 MB (5,242,880 bytes).
4. **Anti-Traversal Protection:** File paths on disk are named using randomly generated UUIDs, neutralizing path traversal attacks (`../../`).
5. **Authenticated Streaming Delivery:** Files are never exposed via static URL paths. Files are streamed exclusively through authenticated API endpoints (`GET /api/v1/sis/students/:id/photo`) that verify JWT authentication, tenant matching, and role authorization before piping binary bytes to the response stream.

---

## 5. Questions Requiring Qualified Legal Review

While the engineering controls implemented in SchoolEMS incorporate the technical principles of the DPDP Act 2023, the following institutional compliance questions require formal review by qualified legal counsel prior to commercial launch:

1. **Parental Verification Mechanisms:** The exact technological framework for verifying that an consenting adult is indeed the lawful parent (e.g. DigiLocker integration, SMS OTP, or signed declaration forms) depends on pending MeitY notification rules under Section 9.
2. **Data Retention & Erasure Periods:** Defining the mandatory statutory retention period for academic records (e.g. CBSE/state board requirements) versus parents' "Right to Erasure" under Section 12 of the DPDP Act.
3. **Third-Party School Liability:** Determining the legal allocation of Data Fiduciary responsibilities between the SaaS platform provider and the individual client school institution.
