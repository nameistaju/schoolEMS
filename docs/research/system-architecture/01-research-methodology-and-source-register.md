# Document 01: Research Methodology and Technical Source Register

**Document Status:** TECHNICAL RESEARCH STUDY — APPROVED BASELINE  
**Classification:** Research Methodology, Source Evaluation & Evidence Register  
**Research Target:** Multi-Tenant School Management SaaS (SchoolEMS)  
**Execution Context:** 100% Local-First Workstation (Windows 11 / WSL2 Ubuntu, PostgreSQL 18.6, Node.js 20+)  
**Cloud Infrastructure:** Zero Cloud / AWS Dependencies  
**Date:** March 2026  
**Author:** Principal Systems Researcher & Lead Technology Evaluator  

---

## 1. Research Objectives & Core Questions

Before committing to a physical system architecture and relational database schema for SchoolEMS, this technical research study investigates primary engineering literature, official technical standards, and statutory data protection frameworks.

The research answers six fundamental architectural questions:

1. **Domain Modeling:** What relational entities, lifecycles, and association patterns are established by mature education data standards (such as Ed-Fi), and which subset is appropriate for a lean, high-integrity Stage 1 MVP supporting 1–2 pilot schools?
2. **System Architecture Topology:** What are the empirical trade-offs between a cohesive modular service versus fine-grained microservices, and between a single PostgreSQL database with schema partitioning versus separate physical databases?
3. **Multi-Tenancy & Data Isolation:** How does PostgreSQL Row-Level Security (RLS) under an unprivileged runtime role behave under connection pooling, transaction-local settings (`SET LOCAL`), and what mechanics guarantee fail-closed tenant isolation?
4. **Relational Integrity & Financial Exactness:** What database constraints, transaction isolation levels, row-locking strategies, and data types guarantee double-entry accounting integrity, sequential receipt generation, and atomic cohort promotion?
5. **Authorization & Relationship Scoping:** How can Role-Based Access Control (RBAC) be extended with Relationship-Based Access Control (ReBAC) to enforce parental child scoping and teacher section assignments without leaking cross-tenant records?
6. **Privacy & Children's Data Protection:** What technical controls are mandated by official children's data protection frameworks (specifically Section 9 of India's Digital Personal Data Protection Act, 2023), and how should student health, safeguarding, and portrait photographs be protected?

---

## 2. Source-Selection Criteria

To ensure high empirical rigor and eliminate speculative or marketing-driven assertions:

1. **Primary & Authoritative Preference:** Primary technical documentation from standards bodies (Ed-Fi Alliance), software maintainers (PostgreSQL Global Development Group, Node.js Foundation), international cybersecurity organizations (OWASP), and official statutory gazettes (Ministry of Law and Justice, Government of India).
2. **Exclusion of Low-Rigor Material:** Commercial vendor blogs, SEO marketing articles, unverified forum opinions, and unsourced architecture diagrams are strictly excluded as primary evidence.
3. **Local-First Alignment:** Research explicitly excludes cloud-proprietary managed services (AWS Cognito, DynamoDB, S3, RDS Aurora) because the project operates locally with zero AWS or cloud dependencies.
4. **Factual Attribution:** Every finding distinguishes:
   - *Source Facts:* Directly stated by the cited standard or official documentation.
   - *Engineering Recommendations:* Established industry best practices derived from documented mechanics.
   - *Project-Specific Inferences:* Tailored application to SchoolEMS Stage 1 constraints.

---

## 3. Authoritative Technical Source Register

The following authoritative primary sources were reviewed and analyzed during this study:

### Source 1: Ed-Fi Data Standard v4 (Ed-Fi Alliance)
- **Publisher:** Ed-Fi Alliance
- **URL:** [https://www.ed-fi.org](https://www.ed-fi.org) | Technical Docs: [https://techdocs.ed-fi.org](https://techdocs.ed-fi.org)
- **Publication Date:** 2023–2024 (Data Standard v4.x)
- **Date Accessed:** March 2026
- **Scope & Focus:** Educational entity modeling: `Student`, `StudentSchoolAssociation`, `StudentSectionAssociation`, `Course`, `Section`, `Staff`, `StudentSectionAttendanceEvent`, and `SectionAttendanceTakenEvent`.
- **Key Findings:** 
  - Standardizes the distinction between institutional enrollment (`StudentSchoolAssociation`) and classroom group placement (`StudentSectionAssociation`).
  - Separates aggregate school-level attendance from period-by-period classroom session attendance.
  - Formulates attendance tracking into two distinct entities: whether attendance was taken for a section on a given date (`SectionAttendanceTakenEvent`), and individual student presence/absence marks (`StudentSectionAttendanceEvent`).
- **Confidence Level:** High (Authoritative K-12 education data standard adopted across North American and international school districts).

---

### Source 2: PostgreSQL 18 Official Documentation (PostgreSQL Global Development Group)
- **Publisher:** PostgreSQL Global Development Group
- **URL:** [https://www.postgresql.org/docs/18/](https://www.postgresql.org/docs/18/)
  - Section 5.8: Row Security Policies ([https://www.postgresql.org/docs/18/ddl-rowsecurity.html](https://www.postgresql.org/docs/18/ddl-rowsecurity.html))
  - Section 9.27: System Administration Functions (`current_setting`, `set_config`) ([https://www.postgresql.org/docs/18/functions-admin.html](https://www.postgresql.org/docs/18/functions-admin.html))
  - Section 13.2: Transaction Isolation ([https://www.postgresql.org/docs/18/transaction-iso.html](https://www.postgresql.org/docs/18/transaction-iso.html))
- **Publication Date:** 2025–2026 (PostgreSQL 18.x Release)
- **Date Accessed:** March 2026
- **Scope & Focus:** Kernel-level Row-Level Security, policy clauses (`USING` vs `WITH CHECK`), runtime configuration parameters, connection pool safety, and transaction-local variable scoping.
- **Key Findings:**
  - `ALTER TABLE ... FORCE ROW LEVEL SECURITY` ensures even the table owner is subject to RLS policies.
  - `current_setting('app.current_tenant_id', true)` returns empty string or `NULL` if missing when the second parameter is `true`, enabling fail-closed logic.
  - `SELECT set_config('app.current_tenant_id', $1, true)` scopes session configuration strictly to the current transaction block (`is_local = true`), preventing variable leakage across pooled connections.
  - PostgreSQL evaluates `NULL = UUID` as `UNKNOWN`/`FALSE`, returning 0 rows if tenant context is missing.
- **Confidence Level:** Highest (Official database engine documentation).

---

### Source 3: OWASP Multi-Tenant Security Cheat Sheet
- **Publisher:** Open Web Application Security Project (OWASP) Cheat Sheet Series
- **URL:** [https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)
- **Publication Date:** 2024–2025
- **Date Accessed:** March 2026
- **Scope & Focus:** Multi-tenant architecture, tenant identification, cross-tenant data leakage prevention, shared database segregation, and authorization boundaries.
- **Key Findings:**
  - Client-supplied tenant identifiers (e.g. headers or request body parameters) must be treated as untrusted selectors and never as proof of authorization.
  - Tenant context must be resolved and cryptographically verified at the ingress gateway or trusted authentication layer before forwarding to downstream services.
  - Logical data isolation in shared databases must enforce defense-in-depth: combining application-level scoping with database-enforced row security.
- **Confidence Level:** Highest (Globally recognized application security standard).

---

### Source 4: OWASP Authorization Cheat Sheet
- **Publisher:** OWASP Cheat Sheet Series
- **URL:** [https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- **Publication Date:** 2024–2025
- **Date Accessed:** March 2026
- **Scope & Focus:** Broken Access Control (OWASP Top 10 #1), decentralized vs centralized authorization, record-level access control, and relationship-based access.
- **Key Findings:**
  - Role-Based Access Control (RBAC) alone is insufficient for multi-tenant and hierarchical domains; it must be combined with Attribute-Based or Relationship-Based Access Control (ReBAC) to verify object ownership (e.g. verifying Parent A is linked to Child B).
  - Authorization checks must fail closed: if a permission or relationship cannot be verified, access must be unconditionally denied.
- **Confidence Level:** Highest.

---

### Source 5: OWASP File Upload Cheat Sheet
- **Publisher:** OWASP Cheat Sheet Series
- **URL:** [https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- **Publication Date:** 2024–2025
- **Date Accessed:** March 2026
- **Scope & Focus:** Secure file upload handling, file extension whitelisting, MIME type validation, file size limits, and safe storage patterns.
- **Key Findings:**
  - File extensions and MIME types provided by the browser cannot be trusted; file headers (magic bytes) must be verified.
  - Uploaded files must never be stored directly inside web-accessible document roots or executed as scripts.
  - Storage paths should use random identifiers (UUIDs) to prevent path traversal (`../../`) and direct object access.
  - Maximum upload size caps must be enforced at both the gateway reverse proxy and the service layer.
- **Confidence Level:** Highest.

---

### Source 6: OWASP Logging Cheat Sheet
- **Publisher:** OWASP Cheat Sheet Series
- **URL:** [https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- **Publication Date:** 2024–2025
- **Date Accessed:** March 2026
- **Scope & Focus:** Security event logging, audit trails, log injection prevention, and sensitive data protection in logs.
- **Key Findings:**
  - Audit logs must be append-only with immutable storage permissions to prevent tampering by compromised application accounts.
  - Passwords, authentication tokens, payment details, and full personal identifiers must be systematically excluded from application logs.
- **Confidence Level:** Highest.

---

### Source 7: Digital Personal Data Protection Act, 2023 (DPDP Act, Act No. 22 of 2023)
- **Publisher:** Gazette of India, Ministry of Law and Justice, Government of India
- **URL:** Official Gazette Publication (Ministry of Electronics and Information Technology - MeitY)
- **Publication Date:** August 11, 2023
- **Date Accessed:** March 2026
- **Scope & Focus:** Section 9 (Processing of personal data of children), Section 4, Section 8 (Obligations of Data Fiduciary), definitions of "child" and "verifiable parental consent".
- **Key Findings:**
  - Section 9(1): Mandates that a Data Fiduciary must obtain **verifiable consent of the parent** or lawful guardian before processing any personal data of a child.
  - Definition: Under Section 2(f), a "child" is defined as any individual who has not completed eighteen years of age.
  - Section 9(2): Prohibits undertaking any processing of personal data that is likely to cause any detrimental effect on the well-being of a child.
  - Section 9(3): Strictly forbids tracking or behavioral monitoring of children, and targeted advertising directed at children.
- **Confidence Level:** Highest (Primary statutory law of India governing children's personal data processing).

---

## 4. Limitations and Confidence Assessment

1. **Local-First Boundary:** All research and architectural options are evaluated specifically under the operational constraint of local workstation execution (Windows 11 / WSL2 Ubuntu, Node.js 20, PostgreSQL 18.6). High-availability clustering, distributed replication, and cloud edge networks are excluded from the initial evaluation.
2. **Statutory Interpretation Boundary:** Legal statutory citations (e.g. DPDP Act 2023) document published legislative provisions. They provide engineering guidance for technical data protection controls (e.g. consent modeling, tracking prevention, access segregation) but do not constitute legal advice. Formal compliance requires qualified legal review prior to public commercial deployment.
