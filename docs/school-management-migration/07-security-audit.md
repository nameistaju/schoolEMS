# Document 07: Comprehensive Security Audit & Regulatory Compliance

**Document Status:** Final  
**Classification:** Security Assessment & Compliance Specification  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Executive Summary of Security Posture

A comprehensive threat modeling and security audit was conducted against the baseline repository (`JuneAWSAIOpsProj-main`). Because a School Management System processes highly sensitive **minor children’s personal identifying information (PII), biometric/attendance records, parent financial data, and academic evaluations**, security standards must meet the highest enterprise and regulatory thresholds.

The baseline codebase features sound foundational cryptographic hygiene in specific areas (such as parameterized SQL queries and bcrypt password hashing). However, it exhibits **critical architectural security gaps**—most notably public subnet placement, lack of network microsegmentation, single-tenant data design, and lack of child data privacy compliance safeguards.

---

## 2. OWASP Top 10 (2021 / 2025) Comprehensive Vulnerability Assessment

### A01:2021 — Broken Access Control
* **Baseline Code Reference:** `projects/telugu-pickles/services/common/auth.js` & `order-service/src/index.js`
* **Finding Status:** **CRITICAL VULNERABILITY**
* **Analysis:** Current authentication extracts only `{ id, email, name }`. There is zero authorization checking or role-based access control (RBAC). Any authenticated user can query or modify endpoints across any service. In a school system, this would allow a student to modify their own grades, view other students' records, or access financial ledgers.
* **Remediation:** Implement fine-grained RBAC with attribute-based access control (ABAC). Enforce permission checks at both Gateway and service layers, backed by PostgreSQL Row-Level Security (RLS).

### A02:2021 — Cryptographic Failures
* **Baseline Code Reference:** `services/common/auth.js` (lines 5-18)
* **Finding Status:** **HIGH RISK**
* **Analysis:** JWTs use symmetric HMAC (HS256) with a shared secret (`JWT_SECRET`). Every microservice must hold the identical secret to verify tokens, meaning a compromise of any low-privilege service compromises the entire token signing authority. Furthermore, token lifetime is 12 hours without a revocation list or refresh token rotation.
* **Remediation:** Transition to asymmetric RS256/EdDSA key pairs. Only `identity-service` holds the private key; all other services verify tokens using a cached public key. Issue short-lived 15-minute access tokens and rotating refresh tokens stored in Redis.

### A03:2021 — Injection
* **Baseline Code Reference:** `services/common/db.js` & domain services
* **Finding Status:** **LOW RISK / VERIFIED SAFE**
* **Analysis:** All SQL queries across `auth-service`, `catalog-service`, and `order-service` utilize parameterized queries (`$1, $2, ...`) via the `pg` driver. No SQL injection vulnerabilities were detected in user-input query paths.
* **Remediation:** Maintain strict static analysis rules (ESLint `security/detect-object-injection`) to prevent regression.

### A04:2021 — Insecure Design
* **Baseline Code Reference:** `projects/Infrastructure/modules/vpc/main.tf` (lines 25-33)
* **Finding Status:** **CRITICAL VULNERABILITY**
* **Analysis:** The infrastructure deploys EKS worker nodes into public subnets with `map_public_ip_on_launch = true`. Ingress is not restricted at the pod network level (no Kubernetes NetworkPolicies).
* **Remediation:** Redesign VPC with strict 3-tier topology. Place compute and data stores in private and isolated subnets. Deploy AWS WAF on the Application Load Balancer.

### A05:2021 — Security Misconfiguration
* **Baseline Code Reference:** `gitops/k8s/database/postgres.yml` & `platform/main.tf`
* **Finding Status:** **HIGH RISK**
* **Analysis:** Single-replica PostgreSQL runs in-cluster with EBS storage without automated encryption keys. Application secrets (`PGPASSWORD`, `JWT_SECRET`) are generated via Terraform `random_password` and stored in plaintext inside `terraform.tfstate`.
* **Remediation:** Migrate secrets to AWS Secrets Manager. Deploy External Secrets Operator (ESO) to sync secrets to Kubernetes without state file leakage.

### A07:2021 — Identification and Authentication Failures
* **Baseline Code Reference:** `projects/telugu-pickles/services/gateway/src/index.js` (lines 53-66)
* **Finding Status:** **HIGH RISK**
* **Analysis:** Rate limiting for login/register is held in an in-memory JavaScript `Map` inside the Gateway process. Attackers can bypass rate limits simply by hitting alternate Gateway pod replicas. No multi-factor authentication (MFA) exists.
* **Remediation:** Deploy Redis-based sliding window rate limiting. Mandate TOTP-based Multi-Factor Authentication (MFA) for SuperAdmins, School Admins, Principals, and Accountants.

---

## 3. Regulatory Compliance: Indian DPDP Act (2023) & Child Data Protection

The Digital Personal Data Protection (DPDP) Act of India imposes stringent obligations on organizations processing personal data, with specialized mandates regarding children under the age of 18:

```
┌────────────────────────────────────────────────────────────────────────┐
│               DPDP ACT (2023) COMPLIANCE OBLIGATION MAP                │
└────────────────────────────────────────────────────────────────────────┘

1. Verifiable Parental Consent (Section 9)
   - Mandatory before processing any personal data of a student (< 18 years).
   - Architectural Requirement: Admission workflow MUST link student to a verified
     Guardian entity with verified identity (Aadhaar / Passport OTP verification).

2. Absolute Prohibition on Behavioral Tracking (Section 9(3))
   - Explicitly forbids tracking, behavioral monitoring, or targeted advertising
     directed at children.
   - Architectural Requirement: Strip all third-party analytics (Google Analytics,
     Meta Pixel) from student portals. Audit logs must record operational events only.

3. Strict Purpose Limitation & Data Minimization
   - Educational institutions may only process student data strictly required for
     academic and administrative purposes.
   - Architectural Requirement: Automated data expiration and archival policies.

4. Right to Erasure and Correction
   - Parents have the statutory right to review and request erasure of student records.
   - Architectural Requirement: Implementation of automated "Data Subject Access Request"
     (DSAR) APIs within the identity-service.
```

---

## 4. Parent-Child Relationship Verification & Security Protocol

To prevent unauthorized access to student grades, disciplinary remarks, and attendance logs:

```
[ Parent Portal Registration ]
       │
       ▼
[ Guardian Enters Student Admission # + Date of Birth + Registered Mobile # ]
       │
       ▼
[ identity-service generates 6-digit OTP sent to registered Guardian phone via SMS ]
       │
       ▼
[ Upon successful OTP verification, student_guardians mapping table is committed ]
       │
       ▼
[ Parent JWT issued with claims: { "parent_id": "...", "children": ["std_01...", "std_02..."] } ]
```

*Every request made by a parent to view student data must verify that the requested `student_id` is cryptographically contained in the parent's verified `children` claim set.*

---

## 5. Security Recommendations & Priority Register

| Vulnerability / Requirement | Affected Asset | Existing Implementation | Recommended Mitigation | Priority |
| :--- | :--- | :--- | :--- | :---: |
| **Public Subnet Compute** | `projects/Infrastructure/modules/vpc` | `map_public_ip_on_launch = true` | Restructure to private subnets with NAT Gateways | **Critical** |
| **Missing RBAC Authorization** | `services/common/auth.js` | No role verification; flat user model | Implement role and permission evaluation middleware | **Critical** |
| **In-Cluster Database SPOF** | `gitops/k8s/database/postgres.yml` | Single pod StatefulSet on EBS | Replace with AWS Aurora Multi-AZ Serverless v2 | **Critical** |
| **Symmetric JWT Secret Sharing** | `services/common/auth.js` | Shared HS256 secret across all services | Migrate to RS256 asymmetric signing with JWKS | **High** |
| **Secrets Stored in TF State** | `projects/Infrastructure/modules/platform` | `random_password` in state file | Use AWS Secrets Manager + External Secrets Operator | **High** |
| **Flat Pod Network** | `gitops/k8s/` | No NetworkPolicies deployed | Enforce default-deny NetworkPolicies per namespace | **High** |
| **In-Memory Rate Limiting** | `services/gateway/src/index.js` | Local JavaScript `Map` | Replace with distributed Redis rate limiting | **Medium** |
| **Browser LocalStorage Token** | `frontend/src/api.js` | `localStorage.setItem('tp_token')` | Migrate to `HttpOnly`, `SameSite=Strict` cookies | **High** |
| **Child Data Compliance** | Application Architecture | No parental consent workflow | Implement DPDP-compliant parent OTP linking | **Critical** |
