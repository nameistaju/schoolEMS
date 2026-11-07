# Document 11: Phased Implementation Roadmap & Execution Plan

**Document Status:** Final  
**Classification:** Engineering Roadmap & Project Plan  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Roadmap Overview & Execution Strategy

This roadmap details the sequential transformation of the existing e-commerce reference repository into a commercially viable, multi-tenant School Management System (SMS).

Development follows a strict **zero-regression phased model**: every phase defines clear prerequisites, architectural milestones, automated testing criteria, rigorous acceptance gates, and fail-safe rollback procedures.

```
[Phase 0: Audit] ──► [Phase 1: Multi-Tenant Foundation & IAM]
                                   │
                                   ▼
                   [Phase 2: Schools, Students & Staff]
                                   │
                                   ▼
                   [Phase 3: Academics & Enrollment]
                                   │
                                   ▼
                   [Phase 4: Attendance Management]
                                   │
                                   ▼
                   [Phase 5: Examinations & Report Cards]
                                   │
                                   ▼
                   [Phase 6: Fees & Financial Management]
                                   │
                                   ▼
                   [Phase 7: Parent & Student Portals]
                                   │
                                   ▼
                   [Phase 8: Notifications & Operations]
                                   │
                                   ▼
                   [Phase 9: Kira AIOps Enhancement]
                                   │
                                   ▼
                   [Phase 10: AWS Production Hardening]
```

---

## 2. Phase-by-Phase Execution Specifications

### Phase 0: Repository Audit & Architecture Validation (Current Phase)
* **Goal:** Completely understand existing assets, identify architectural/security gaps, catalog dependencies, and formulate the modernization plan without modifying code.
* **Prerequisites:** Workspace access to `JuneAWSAIOpsProj-main`.
* **Milestones:**
  - Complete file-by-file audit and verification.
  - Deliver the 12 comprehensive architectural and migration specifications.
* **Testing:** Static analysis, linting verification, and dependency vulnerability scans.
* **Acceptance Criteria:** Master prompt requirements satisfied; all 12 documents written to `docs/school-management-migration/`; client approval received.
* **Rollback:** Non-destructive audit; no rollback required.

---

### Phase 1: Multi-Tenant Foundation & Identity Service
* **Goal:** Establish multi-tenant database isolation (PostgreSQL RLS), refactor `common/` utilities, and modernize `auth-service` into `identity-service`.
* **Prerequisites:** Phase 0 approval.
* **Milestones:**
  - Refactor `services/common/service.js` to extract and propagate `tenantId` and `branchId`.
  - Refactor `services/common/db.js` with `withTenantContext` executing `SET LOCAL app.current_tenant_id = $1`.
  - Refactor `services/common/auth.js` to implement asymmetric RS256 signing and verify multi-tenant claims.
  - Implement `identity-service` schemas (`tenants`, `branches`, `academic_years`, `users`, `user_tenant_memberships`).
  - Implement RBAC authorization middleware (SuperAdmin, SchoolAdmin, Principal, Teacher, Student, Parent, Accountant).
* **Testing:** Unit tests for tenant isolation; integration tests verifying cross-tenant token rejection; JWT signature round-trip verification.
* **Acceptance Criteria:** A user authenticated in Tenant A receives a 403 or empty set when querying Tenant B data; RLS strictly blocks cross-tenant reads even when direct SQL is injected.
* **Rollback:** Git branch revert; rollback migration script restoring single-tenant auth tables.

---

### Phase 2: School, Student & Staff Management
* **Goal:** Build core institutional and personal profile management for students, parents, and teachers.
* **Prerequisites:** Phase 1 (Tenant & Identity foundation active).
* **Milestones:**
  - Create `students`, `guardians`, `student_guardians`, and `staff` tables with RLS policies in `records_db`.
  - Build CRUD endpoints in `student-records-service` for admissions and staff onboarding.
  - Implement DPDP-compliant verifiable parental consent OTP verification workflow.
  - Implement secure S3 document upload endpoints via Pre-Signed URLs.
* **Testing:** Schema constraint tests; Guardian-to-student authorization verification; S3 presigned URL expiration tests.
* **Acceptance Criteria:** Student profiles successfully created with linked guardians; unauthorized parents cannot view arbitrary student records.
* **Rollback:** Revert migration; drop `students` and `staff` tables.

---

### Phase 3: Academic Structure & Enrollment Management
* **Goal:** Implement the academic backbone (Classes, Sections, Subjects, Syllabi, and Timetables).
* **Prerequisites:** Phase 2 (Student and Staff profiles exist).
* **Milestones:**
  - Build `academic-service` (replacing `catalog-service` and `cart-service`).
  - Deploy schemas: `classes`, `sections`, `subjects`, `class_schedules`, `student_enrollments`.
  - Build endpoints for assigning teachers to subjects, scheduling class periods, and enrolling students into sections.
* **Testing:** Class capacity limit validation; timetable scheduling collision detection tests.
* **Acceptance Criteria:** A grade section cannot exceed `max_capacity`; teacher scheduling collisions return 409 Conflict.
* **Rollback:** Revert `academic-service` deployment; restore previous catalog deployment.

---

### Phase 4: Attendance Management Service
* **Goal:** High-concurrency daily attendance recording and tracking for classrooms and staff.
* **Prerequisites:** Phase 3 (Classes, Sections, and Enrollments active).
* **Milestones:**
  - Deploy partitioned `attendance_logs` table (partitioned by quarter/date).
  - Implement bulk attendance submission API with optimistic concurrency control.
  - Implement daily attendance summary aggregations (present percentage per section/branch).
* **Testing:** Load testing simulating 1,000 teachers submitting 40-student attendance rosters simultaneously within a 15-minute window; latency must remain $<100$ms.
* **Acceptance Criteria:** Zero deadlocks under concurrent submission; attendance records accurately partitioned; daily summaries correctly calculated.
* **Rollback:** Roll back attendance schema; redeploy previous service version.

---

### Phase 5: Examinations & Report Cards
* **Goal:** Manage examination schedules, grade recording, grading scales, and report card generation.
* **Prerequisites:** Phase 4 (Attendance active).
* **Milestones:**
  - Deploy `exams` and `student_grades` tables in `records_db`.
  - Build teacher grading portal endpoints with marks validation against `max_marks`.
  - Build automated PDF report card generation engine storing outputs to S3.
* **Testing:** GPA and grading scale calculation verification tests; PDF rendering benchmark tests.
* **Acceptance Criteria:** Teachers can submit grades; report cards are generated with correct weighted GPA calculations and secure S3 download links.
* **Rollback:** Revert examination endpoints; restore prior records service.

---

### Phase 6: Fees & Financial Management
* **Goal:** Tuition fee configuration, invoice generation, online payments, and financial ledgers.
* **Prerequisites:** Phase 5 (Academic and Student records active).
* **Milestones:**
  - Refactor `payment-service` into `finance-service`.
  - Deploy `fee_structures`, `fee_invoices`, and `fee_payments` tables in `finance_db`.
  - Integrate Razorpay and Stripe payment gateway webhooks with idempotent transaction handling.
  - Automated PDF invoice and payment receipt generation.
* **Testing:** Financial transaction idempotency tests; webhook replay attack simulation tests; sibling discount calculation verification.
* **Acceptance Criteria:** Duplicate payment webhooks are rejected idempotently; fee status transitions seamlessly from `ISSUED` to `PAID`.
* **Rollback:** Revert finance service deployment; restore mock payment service.

---

### Phase 7: Parent & Student Portals (Frontend Modernization)
* **Goal:** Transform the React 18 SPA into a modern, responsive multi-role school portal.
* **Prerequisites:** Phases 1 through 6 APIs deployed.
* **Milestones:**
  - Redesign layout with role-based navigation guards (Admin, Teacher, Student, Parent).
  - Build responsive dashboards:
    - **Teacher:** Attendance entry, Gradebook submission, Timetable view.
    - **Student/Parent:** Attendance calendar, Report card viewer, Online fee payment checkout.
    - **Admin:** School metrics, Staff management, Tenant settings.
  - Migrate token storage from `localStorage` to `HttpOnly` secure cookies.
* **Testing:** Cross-browser compatibility; mobile responsiveness; accessibility (WCAG 2.1 AA) compliance; XSS security scans.
* **Acceptance Criteria:** Users only see UI features corresponding to their verified RBAC role; mobile layouts render cleanly.
* **Rollback:** Revert Git commit; Argo Rollouts blue-green reverts to previous frontend image instantly.

---

### Phase 8: Notifications & Operational Communications
* **Goal:** Asynchronous alerts for attendance absences, fee due dates, and emergency announcements.
* **Prerequisites:** Phase 7 deployed.
* **Milestones:**
  - Deploy `operations-service` with AWS SQS/SNS consumers.
  - Integrate SMS (AWS SNS / Twilio) and WhatsApp Business API.
  - Implement automated triggers: "Student marked absent $\rightarrow$ instant parent WhatsApp notification".
* **Testing:** Queue consumer retry policies; dead-letter queue (DLQ) processing tests; rate-limit throttling tests.
* **Acceptance Criteria:** Absences trigger parent notifications within 30 seconds; unroutable messages safely land in DLQ.
* **Rollback:** Disable event publishers; scale consumer workers to zero.

---

### Phase 9: Kira AIOps Integration & Academic Intelligence
* **Goal:** Extend Kira SRE capabilities with school operational intelligence and anomaly detection.
* **Prerequisites:** Phase 8 deployed.
* **Milestones:**
  - Update Kira's Bedrock system prompts to understand school operational topology.
  - Add Prometheus alerts for morning attendance spikes and fee payment gateway latency.
  - Introduce `academic_intelligence_agent` for principal anomaly summaries.
* **Testing:** Chaos engineering injection (`CHAOS_ERROR_RATE=0.3`); verify Kira diagnoses root cause and generates SRE incident report via SNS email within 3 minutes.
* **Acceptance Criteria:** Kira successfully isolates simulated outages in `student-records-service` and provides actionable remediation commands.
* **Rollback:** Revert Lambda deployment in `projects/aiops-assistant/lambda/`.

---

### Phase 10: AWS Production Hardening & Security Validation
* **Goal:** Stand up enterprise-grade AWS infrastructure and execute penetration testing.
* **Prerequisites:** Phases 1 through 9 code complete.
* **Milestones:**
  - Update Terraform: deploy 3-tier VPC (Public/Private/Database subnets) with NAT Gateways.
  - Deploy Amazon Aurora PostgreSQL Serverless v2 Multi-AZ cluster.
  - Deploy AWS WAFv2 on the Application Load Balancer.
  - Deploy Kubernetes NetworkPolicies (default-deny).
  - External penetration test and OWASP compliance certification.
* **Testing:** Full vulnerability scan (Trivy, Gitleaks, Checkov); DDoS stress testing; disaster recovery failover drill.
* **Acceptance Criteria:** Zero critical/high vulnerabilities; multi-AZ failover executed with zero data loss; SOC2/DPDP audit readiness verified.
* **Rollback:** Terraform state rollback; restore previous infrastructure state.
