# Document 10: Student Data Privacy, Statutory Compliance & Storage Security

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Privacy Engineering & Statutory Compliance Audit  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal Security Architect & Compliance Counsel  

---

## 1. Statutory Compliance Framework (India-First & Global Extensions)

Educational platforms process the personal data of children, who represent the most vulnerable demographic under data privacy jurisprudence. SchoolEMS is architected around an India-first statutory baseline, with modular extensibility for global regulatory environments:

### 1.1 India: Digital Personal Data Protection (DPDP) Act 2023 & Landmark Precedents
1. **Section 9 Obligations for Children's Data:**
   - **Verifiable Parental Consent (VPC):** Before processing any personal data of a minor (individual under 18 years), the Data Fiduciary (the school) must obtain verifiable consent from the parent or lawful guardian.
   - **Prohibition of Behavioral Monitoring:** The platform **strictly prohibits** tracking, profiling, or behavioral monitoring of children, as well as targeted advertising directed at minors.
   - **Harm Prevention Principle:** No processing may be undertaken that is likely to cause any detrimental effect on the physical or psychological well-being of a child.
2. **Supreme Court of India *K.S. Puttaswamy (Aadhaar)* (2018) Ruling:**
   - The Constitution Bench ruled that schools **cannot make Aadhaar mandatory** for admissions or examinations.
   - Consequently, SchoolEMS treats national identifiers as **strictly voluntary**. An admission application or student registration must proceed seamlessly without Aadhaar or national identity tokens.
3. **CERT-In Cyber Security Directives (April 2022):**
   - Mandatory maintenance of logs within the jurisdiction for 180 days.
   - Obligation to report security incidents and data breaches to CERT-In within 6 hours of notice.

### 1.2 International Frameworks (Conditional / Multi-Jurisdiction Extensions)
- **GDPR (Article 8) & UK-GDPR:** Parental consent requirements for children below the age of digital consent (13 to 16 years depending on member state), data minimization, and statutory right to erasure.
- **US: COPPA & FERPA:** Children's Online Privacy Protection Act (children under 13) and Family Educational Rights and Privacy Act (protection of educational records).

> [!IMPORTANT]
> **Legal Compliance Disclaimer:** Implementing technical controls (RLS, encryption, role separation) is necessary but **does not alone constitute legal compliance** with the DPDP Act 2023 or GDPR. Full institutional compliance requires operational policies, Data Protection Officer / Grievance Officer appointments, parental consent notification templates, and formal institutional legal review.

---

## 2. Classification of Sensitive Personal Data (SPD)

Student and family attributes are cataloged into four distinct security tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                      DATA CLASSIFICATION MATRIX                        │
├─────────┬──────────────────────────┬───────────────────┬───────────────┤
│ Tier    │ Categories               │ Examples          │ Controls      │
├─────────┼──────────────────────────┼───────────────────┼───────────────┤
│ Tier 1  │ Public / Directory Data  │ First/Last Name,  │ Tenant RLS;   │
│         │                          │ Grade, Section,   │ Branch Scoping│
│         │                          │ Roll Number       │               │
├─────────┼──────────────────────────┼───────────────────┼───────────────┤
│ Tier 2  │ Personal Data (PD)       │ Date of Birth,    │ Authenticated │
│         │                          │ Residential Addr, │ Staff RBAC;   │
│         │                          │ Guardian Mobile   │ Audit Trail   │
├─────────┼──────────────────────────┼───────────────────┼───────────────┤
│ Tier 3  │ Sensitive Health Data    │ Medical history,  │ Segregated    │
│         │                          │ Allergies, Blood, │ table; Medical│
│         │                          │ Prescription logs │ role; Audited │
├─────────┼──────────────────────────┼───────────────────┼───────────────┤
│ Tier 4  │ High-Risk Safeguarding / │ Child protection, │ Isolated table│
│         │ Court Restraints / ID    │ Court orders,     │ Principal/CPO │
│         │ Pseudonymized Tokens     │ Salted ID hash    │ only; Audited │
└─────────┴──────────────────────────┴───────────────────┴───────────────┘
```

---

## 3. Cryptographic Tokenization & Pseudonymization

### 3.1 Voluntary Aadhaar Handling
1. **Zero Plaintext Storage:** Plaintext 12-digit Aadhaar numbers are **never written** to PostgreSQL tables, caches, or persistent disk logs.
2. **Pseudonymization via Salted SHA-256:**
   - To support duplicate detection (preventing multiple registrations within a tenant), the backend computes:
     $$\text{Token} = \text{HMAC-SHA256}(\text{NationalID}, \text{TENANT\_SECRET\_SALT})$$
   - *Crucial Clarification:* A salted hash provides **pseudonymization**, NOT full anonymization. If the national ID is known, an attacker with the tenant salt could confirm its presence via dictionary attack. Thus, the tenant salt is stored securely in environment secrets and never exposed to the client.
3. **Display Masking:** Only the last four digits are stored in `national_id_last4` (e.g., `XXXX-XXXX-4321`) for visual verification against physical government cards at the registrar desk.

### 3.2 Physical Segregation of Sensitive Records
- In legacy systems, storing health and safeguarding notes in `students` exposed them to any developer or query running `SELECT * FROM students`.
- SchoolEMS strictly segregates these into `sis.student_health_records` and `sis.student_safeguarding_records`.
- `sis.student_health_records`: Accessible only to campus medical staff and administrators.
- `sis.student_safeguarding_records`: Accessible strictly to the Principal and Designated Safeguarding Lead (DSL) / Child Protection Officer (CPO).

---

## 4. Document Storage Security & Provider Abstraction

Student verification documents (scanned birth certificates, transfer certificates, court decrees) contain critical personal data.

### 4.1 Storage Provider Abstraction Interface
To honor the strict local-first constraint while preserving future cloud portability, storage operations are encapsulated behind an abstract interface:

```javascript
class StorageService {
  async putObject({ key, buffer, mimeType, metadata }) { throw new Error('Not implemented'); }
  async getObjectStream({ key }) { throw new Error('Not implemented'); }
  async deleteObject({ key }) { throw new Error('Not implemented'); }
  async getSignedDownloadUrl({ key, expiresInSeconds }) { throw new Error('Not implemented'); }
}
```

#### 4.2 Storage Implementations:
1. **`LocalStorageProvider` (Local Development — Active):**
   - Files are stored on local persistent disk under `uploads/sis/{tenant_id}/{student_id}/`.
   - Served strictly through an authenticated, authorization-guarded streaming endpoint in `student-records-service`.
   - **Zero AWS dependencies:** Operates entirely offline on Windows 11 / WSL workstations.
2. **`S3StorageProvider` (Future Cloud — Optional Roadmapped):**
   - Encrypted cloud bucket storage (`aws:kms`) generating short-lived pre-signed download URLs.

### 4.3 Storage Security Hardening
- **Prohibited Static Mounting:** Directory paths are **never** served via `express.static()`. Direct unauthenticated URL access is structurally impossible.
- **Path Traversal Defense:** Uploaded files are renamed using `crypto.randomUUID()` and stripped of original file paths, eliminating directory traversal vectors (`../../etc/passwd`).
- **MIME Sniffing Prevention:** Ingress upload handlers validate magic byte headers (e.g., `application/pdf`, `image/png`, `image/jpeg`) rather than trusting client-supplied file extensions.

---

## 5. Data Retention, Statutory Exemptions & Right to Erasure

Under the DPDP Act 2023 and GDPR, data principals possess the right to erasure ("Right to be Forgotten"). However, educational fiduciaries are subject to conflicting legal duties:

### 5.1 Reconciling Conflicting Legal Mandates:
1. **Statutory Permanent Records (Exempt from Erasure):**
   - State Education Acts and secondary school boards (CBSE, ICSE, State Boards) mandate that schools permanently preserve permanent pupil rolls, final academic marksheets, and official Transfer Certificates (TCs) for transcript verification.
   - These records are formally classified as regulatory exemptions under DPDP Act Section 17 (exemptions for legal claims and statutory duties).
2. **Discretionary PII Purging (Eligible for Erasure):**
   - After student graduation or withdrawal, upon expiry of the institutional retention schedule (standard 7 years):
     - Biometric photos, parental income records, utility address proofs, and medical checkup notes are permanently erased.
     - The student record status is transitioned to `'archived'`, and non-essential PII fields are set to `NULL`.
3. **Prospective Candidate Data Minimization:**
   - Rejected or withdrawn admission applications are automatically purged 12 months after the close of the admission cycle.

---

## 6. Checklist of Items Requiring Institutional Legal Review

Before production deployment, the educational institution must complete the following legal reviews:
1. **DPDP Section 9 Parental Consent Rules:** Review the exact Verifiable Parental Consent (VPC) mechanisms once notified by the Data Protection Board of India.
2. **State Board Retention Schedules:** Validate specific state education board rules regarding student file retention periods.
3. **Data Protection Officer / Grievance Redressal Officer:** Formally designate and publish contact details of the Grievance Officer in tenant privacy notices.
4. **Third-Party Vendor Agreements:** Execute data processing agreements (DPAs) with any future SMS, email, or cloud infrastructure providers.
