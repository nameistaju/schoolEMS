# Document 04: Target School Management SaaS Architecture

**Document Status:** Final  
**Classification:** System Architecture Specification  
**Project:** Multi-Tenant Enterprise School Management Platform  
**Date:** March 2026  

---

## 1. Architectural Philosophy & Design Principles

The target School Management System (SMS) is designed as a **modular, multi-tenant cloud-native SaaS platform** delivering high availability, strict tenant data isolation, sub-100ms API latency, and compliance with data privacy regulations (such as India's DPDP Act, GDPR, and COPPA).

### Core Principles
1. **Pragmatic Service Granularity:** Avoid microservice proliferation. Consolidate tightly coupled domains into cohesive deployable services initially.
2. **Strict Multi-Tenant Isolation:** Enforce isolation at every layer (Network, API, Compute, Database, Storage) using verified tenant contexts and PostgreSQL Row-Level Security (RLS).
3. **Stateless Compute:** All microservice containers remain strictly stateless to leverage Kubernetes Horizontal Pod Autoscaling (HPA) and Argo Rollouts.
4. **Asynchronous Decoupling:** Long-running, batch, and notification workloads use asynchronous queues (Amazon SQS / EventBridge) rather than blocking HTTP cycles.
5. **Least-Privilege Security:** End-to-end Zero Trust security model across inter-service calls, database queries, and object storage access.

---

## 2. Logical Domain Mapping to Deployable Microservices

The 12 required logical domains are mapped into **five cohesive, deployable domain microservices** plus the API Gateway, maximizing team velocity while maintaining independent scalability:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             LOGICAL DOMAIN TAXONOMY                              │
└──────────────────────────────────────────────────────────────────────────────────┘
  [1] Identity & Access Mgmt ──┐
                               ├────────► [ Service 1: identity-service ]
  [2] Tenant & School Mgmt  ───┘

  [3] Student Management    ───┐
  [4] Staff Management      ───┼────────► [ Service 2: student-records-service ]
  [7] Attendance Management ───┤
  [8] Examination & Results ───┘

  [5] Academic Management   ───┐
  [6] Enrollment Management ───┴────────► [ Service 3: academic-service ]

  [9] Fee & Finance Mgmt    ────────────► [ Service 4: finance-service ]

 [10] Communication & Notifs ──┐
 [11] Transport Management  ───┼────────► [ Service 5: operations-service ]
 [12] Reporting & Analytics ───┘
```

---

## 3. High-Level Target Architecture Blueprint

```
                                      [ INTERNET TRAFFIC ]
                                                │
                                    [ AWS Route 53 (DNS) ]
                                                │
                                      [ AWS WAF + Shield ]
                                                │
                                  [ AWS Application Load Balancer ]
                                     (TLS Termination / ACM)
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
          [ school-frontend (React 18) ]                    [ school-gateway (:8080) ]
           Role-based Portals (Nginx)                         Tenant Resolution, JWT Verify,
                       │ (API /api/v1/*)                      Rate Limiting, Routing
                       └─────────────────────────────────────────────────┤
                                                                         │
       ┌─────────────────────┬─────────────────────┬─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼                     ▼                     ▼
[ identity-service ]  [ academic-service ] [ student-records ]   [ finance-service ]   [ operations-service ]
     (:4001)               (:4002)               (:4003)               (:4004)               (:4005)
       │                     │                     │                     │                     │
       ▼                     ▼                     ▼                     ▼                     ▼
 [ identity_db ]       [ academic_db ]       [ records_db ]        [ finance_db ]        [ operations_db ]
       │                     │                     │                     │                     │
       └─────────────────────┴─────────────────────┼─────────────────────┴─────────────────────┘
                                                   ▼
                                  [ Amazon Aurora PostgreSQL Serverless ]
                                       (Multi-AZ, Shared Cluster,
                                       Row-Level Security Enabled)
                                                   │
                                                   ▼
                                     [ AWS S3 Encrypted Storage ]
                                      (Student Records, Fee Receipts)
```

---

## 4. Deployable Service Specifications

### 4.1 Service 0: `school-gateway` (Port 8080)
* **Replaces:** `telugu-pickles-gateway`
* **Responsibilities:**
  - **Tenant Resolution:** Identifies tenant from incoming host (e.g., `oakridge.schoolsaas.com`) or header `X-Tenant-Domain`.
  - **Authentication Token Extraction:** Reads JWT from secure `HttpOnly` cookie or `Authorization: Bearer` header.
  - **Rate Limiting:** Enforces per-IP and per-tenant rate limits via AWS WAF and Redis.
  - **Reverse Proxy Routing:**
    - `/api/v1/identity/*` $\rightarrow$ `identity-service:4001`
    - `/api/v1/academics/*` $\rightarrow$ `academic-service:4002`
    - `/api/v1/records/*` $\rightarrow$ `student-records-service:4003`
    - `/api/v1/finance/*` $\rightarrow$ `finance-service:4004`
    - `/api/v1/operations/*` $\rightarrow$ `operations-service:4005`
  - **Cross-Cutting Concerns:** Generates/propagates `X-Request-Id`, applies strict CORS policies, and exposes aggregated health `/api/v1/health`.

---

### 4.2 Service 1: `identity-service` (Port 4001)
* **Replaces:** `auth-service`
* **Logical Domains Covered:**
  - **Domain 1: Identity and Access Management (IAM)**
    - Multi-factor authentication (MFA) via TOTP / SMS.
    - Asymmetric JWT signing (RS256) with cached JWKS public keys for other services.
    - Role-Based Access Control (RBAC): SuperAdmin, SchoolAdmin, Principal, Teacher, Student, Parent, Accountant.
  - **Domain 2: Tenant and School Management**
    - School organization onboarding (Tenant provisioning, branding, subscription tier).
    - Branch management (Campuses, facilities, academic year configuration).
    - User-to-Tenant-to-Branch membership mappings.

---

### 4.3 Service 2: `academic-service` (Port 4002)
* **Replaces:** `catalog-service` & `cart-service` (in part)
* **Logical Domains Covered:**
  - **Domain 5: Academic Management**
    - Class and Section definitions (e.g., Grade 10 - Section A).
    - Subject catalog, syllabus definitions, credit requirements.
    - Class timetables, period allocations, teacher-subject assignments.
  - **Domain 6: Enrollment Management**
    - Student admission workflow and applicant registration.
    - Term enrollment, subject selections, and elective allocations.
    - Promotion and graduation rules engines.

---

### 4.4 Service 3: `student-records-service` (Port 4003)
* **Replaces:** `order-service`
* **Logical Domains Covered:**
  - **Domain 3: Student Management**
    - Student profile biodata, demographic data, emergency contacts, medical records.
  - **Domain 4: Staff Management**
    - Teacher profiles, qualifications, department assignments, workload balancing.
  - **Domain 7: Attendance Management**
    - Daily classroom attendance logging (Present, Absent, Late, Excused).
    - Bulk attendance submission with concurrency control.
    - Biometric and RFID integration endpoints.
  - **Domain 8: Examination and Results**
    - Examination scheduling (Midterms, Finals, Unit Tests).
    - Grading rubrics, marks entry by teachers, moderation workflows.
    - Report card compilation, GPA computation, ranking calculations.

---

### 4.5 Service 4: `finance-service` (Port 4004)
* **Replaces:** `payment-service` & `cart-service` (pricing engine)
* **Logical Domains Covered:**
  - **Domain 9: Fee and Finance Management**
    - Dynamic Fee Structure configuration (Tuition, Transport, Lab, Library, Admission fees).
    - Sibling discounts, scholarship adjustments, installment schedules.
    - Automated invoice generation per term/academic cycle.
    - Payment Gateway integration (Stripe, Razorpay, UPI) with asynchronous webhook processing.
    - Automated receipt generation (PDF export to S3).

---

### 4.6 Service 5: `operations-service` (Port 4005)
* **New Service**
* **Logical Domains Covered:**
  - **Domain 10: Communication and Notifications**
    - Automated SMS, Email, and WhatsApp notifications (Attendance alerts, fee reminders, exam schedules).
    - In-app notification feeds for students and parents.
  - **Domain 11: Transport Management**
    - School bus route mapping, stops, vehicle tracking, driver assignments.
  - **Domain 12: Reporting and Analytics**
    - Aggregate institutional analytics (Attendance trends, fee collection status, academic performance metrics).

---

## 5. Inter-Service Communication Patterns

```
┌────────────────────────────────────────────────────────────────────────┐
│                      INTER-SERVICE INTERACTION PATTERNS                │
└────────────────────────────────────────────────────────────────────────┘

1. SYNCHRONOUS (REST / HTTP)
   - Used for immediate request-reply operations.
   - All requests carry `X-Request-Id`, `X-Tenant-Id`, `Authorization: Bearer`.
   - Examples:
     * gateway -> identity-service: Verify user credentials on login.
     * finance-service -> student-records: Fetch student details during invoicing.

2. ASYNCHRONOUS (Event-Driven via Amazon SNS/SQS / EventBridge)
   - Used for decoupled, high-volume, or slow external integrations.
   - Examples:
     * student-records -> Event: "attendance.marked_absent"
       ==> operations-service consumes and dispatches WhatsApp alert to parents.
     * finance-service -> Event: "fee.payment_received"
       ==> operations-service consumes, sends receipt email, updates accounting ledger.
```

---

## 6. Service Evolution Roadmap

To ensure a smooth transition from the e-commerce codebase, development follows this sequence:

1. **Iteration 1:** Deploy `school-gateway` and `identity-service` with multi-tenancy and RBAC.
2. **Iteration 2:** Deploy `academic-service` (Classes, Subjects, Enrollment).
3. **Iteration 3:** Deploy `student-records-service` (Student biodata, Attendance, Exams).
4. **Iteration 4:** Deploy `finance-service` (Fees, Invoices, Razorpay integration).
5. **Iteration 5:** Deploy `operations-service` (Notifications, Transport, Analytics).
