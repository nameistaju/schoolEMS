# Document 03: Reuse, Refactor, and Replace Matrix

**Document Status:** Final  
**Classification:** Migration Strategy & Gap Assessment  
**Project:** School Management System (SMS) Modernization  
**Date:** March 2026  

---

## 1. Architectural Strategy & Disposition Categories

To convert the e-commerce reference application into an enterprise multi-tenant School Management System without compromising speed to market, all existing artifacts are classified into four distinct disposition strategies:

1. **REUSE (Keep As-Is):** Component is production-ready, enterprise-grade, and domain-agnostic. Requires zero to minimal configuration adjustment.
2. **REFACTOR (Modify in Place):** Architecture and structural design are sound, but code must be enhanced to support multi-tenancy, school domain entities, or security hardening.
3. **REPLACE (Discard & Rewrite):** The current implementation is fundamentally mismatched with multi-tenant SaaS standards or school domain requirements.
4. **NEW (Build from Scratch):** Critical components required for the School Management System that do not currently exist in the repository.

---

## 2. Comprehensive Component Disposition Matrix

| Subsystem / Component | File / Path | Current Purpose | Strategy | Target School Domain / Purpose | Effort Est. |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Micro-framework** | `services/common/service.js` | Express service wrapper, metrics, logging, tracing | **REFACTOR** | Enhance with Tenant Context extraction and validation middleware. | Low |
| **Database Client** | `services/common/db.js` | Database initialization, pooling, dynamic creation | **REFACTOR** | Add PostgreSQL Row-Level Security (RLS) session variable setting. | Medium |
| **Auth Utilities** | `services/common/auth.js` | JWT signing, verification, `requireAuth` | **REFACTOR** | Add tenant claims, branch claims, roles, and asymmetric verification. | Medium |
| **HTTP Client** | `services/common/http.js` | REST client, header propagation, error tracking | **REFACTOR** | Propagate `X-Tenant-Id` and tenant context headers across services. | Low |
| **Logger** | `services/common/logger.js` | JSON structured logging to stdout | **REFACTOR** | Add mandatory `tenantId` and `branchId` to all structured log lines. | Low |
| **Metrics** | `services/common/metrics.js` | Prometheus counters and latency histograms | **REFACTOR** | Add school operational metrics (logins, attendance submissions, fee txns). | Low |
| **Pricing Engine** | `services/common/pricing.js` | E-commerce discounts and shipping calculator | **REPLACE** | Replace with School Fee Calculator & Fine Rules engine. | Medium |
| **API Gateway** | `services/gateway/src/` | Inbound proxy, rate limit, route dispatch | **REFACTOR** | Add Tenant Resolution (subdomain/header), Redis rate limiting, RBAC guard. | High |
| **Auth Service** | `services/auth-service/src/` | Customer registration, login, JWT issuance | **REFACTOR** | Transform into multi-tenant School IAM (Admin, Teacher, Student, Parent). | High |
| **Catalog Service** | `services/catalog-service/src/` | Pickles, categories, inventory reservation | **REPLACE** | Transform into `academic-service` (Courses, Classes, Subjects, Syllabi). | High |
| **Cart Service** | `services/cart-service/src/` | Shopping cart items, checkout preparation | **REPLACE** | Transform into `enrollment-service` (Class registration, elective selection). | High |
| **Order Service** | `services/order-service/src/` | Checkout saga orchestration, order history | **REPLACE** | Transform into `records-service` (Attendance records, Grades, Exam marks). | High |
| **Payment Service** | `services/payment-service/src/` | Mock payment gateway (cards, UPI) | **REFACTOR** | Transform into `finance-service` (Fee installments, Stripe/Razorpay, Invoices). | High |
| **Frontend Core** | `frontend/src/App.jsx` | React SPA routing, public shop layout | **REPLACE** | Rewrite as Multi-Role School Portal (SuperAdmin, Admin, Teacher, Student, Parent). | High |
| **Frontend API** | `frontend/src/api.js` | Fetch wrapper, localStorage token handling | **REFACTOR** | Migrate to `HttpOnly` secure cookies and automatic tenant header handling. | Medium |
| **VPC Module** | `projects/Infrastructure/modules/vpc` | Public subnets only across 3 AZs | **REFACTOR** | Add private subnets, database subnets, and AWS NAT Gateways. | Medium |
| **EKS Module** | `projects/Infrastructure/modules/eks` | Managed node group, OIDC, access entries | **REUSE** | Deploy worker nodes into private subnets; retain cluster configurations. | Low |
| **ECR Module** | `projects/Infrastructure/modules/ecr` | Container image repositories per service | **REFACTOR** | Update repository names to reflect school microservice names. | Low |
| **Platform Module** | `projects/Infrastructure/modules/platform` | Helm charts: Argo CD, Prometheus, Fluent Bit | **REFACTOR** | Retain observability and GitOps; add AWS Secrets Manager integration. | Medium |
| **RDS Aurora Module** | `projects/Infrastructure/modules/aurora` | None (Currently in-cluster StatefulSet) | **NEW** | Terraform module for Amazon Aurora PostgreSQL Multi-AZ with RLS. | High |
| **S3 Storage Module** | `projects/Infrastructure/modules/storage` | None (Only S3 bootstrap bucket exists) | **NEW** | S3 bucket for student documents, photos, report cards with KMS encryption. | Medium |
| **Kira AIOps** | `projects/aiops-assistant/` | SRE triage agent on Amazon Bedrock | **REFACTOR** | Retain SRE loop; add School SLA monitoring and Administrative Q&A agent. | Medium |
| **GitOps Manifests** | `gitops/k8s/` | Argo Rollouts, Canary analysis, Deployments | **REFACTOR** | Update workload manifests for new service names and add NetworkPolicies. | Medium |
| **CI/CD Pipelines** | `.github/workflows/` | Gitleaks, Trivy, Docker build, ECR push | **REUSE** | Keep pipeline structure intact; add integration test gate and multi-env targets. | Low |

---

## 3. Detailed Component-by-Component Assessment

### 3.1 Backend & Middleware

#### Finding RRR-01: Shared Service Layer (`services/common/service.js`)
* **Existing Implementation:** Configures Express server, request ID propagation, health endpoints (`/health/live`, `/health/ready`), and Prometheus `/metrics`.
* **Verified:** Yes.
* **Problem/Opportunity:** Highly reusable standard microservice template. Needs tenant context middleware to bind `req.tenantId` to all subsequent async operations.
* **Recommended Action:** **REFACTOR**. Add `extractTenantContext` middleware that parses tenant identifiers from verified JWT claims or subdomains.
* **Priority:** **High**

#### Finding RRR-02: Database Connection Layer (`services/common/db.js`)
* **Existing Implementation:** Direct `pg.Pool` connection with dynamic `ensureDatabase` using admin connection.
* **Verified:** Yes.
* **Problem/Opportunity:** High risk of cross-tenant data leakage if connection pooling is not tenant-aware when utilizing Row-Level Security.
* **Recommended Action:** **REFACTOR**. Augment the pool checkout mechanism to execute `SET LOCAL app.current_tenant_id = $1` on every acquired database client before returning it to the application logic.
* **Priority:** **Critical**

#### Finding RRR-03: Security & Token Utilities (`services/common/auth.js`)
* **Existing Implementation:** Symmetric HMAC (HS256) JWT signing with payload `{ sub: user.id, email: user.email, name: user.name }`.
* **Verified:** Yes.
* **Problem/Opportunity:** Lacks multi-tenant claims (`tenant_id`, `branch_id`, `roles`, `permissions`). Symmetric signing requires all microservices to share the same HMAC secret key.
* **Recommended Action:** **REFACTOR**. Migrate to asymmetric RS256/EdDSA signing where `identity-service` signs with a private key, and all downstream services verify using a cached public key. Include tenant and RBAC metadata.
* **Priority:** **Critical**

---

### 3.2 Domain Microservices

#### Finding RRR-04: API Gateway (`services/gateway/`)
* **Existing Implementation:** `http-proxy-middleware` forwarding to `auth`, `catalog`, `cart`, `order`, and `payment`.
* **Verified:** Yes.
* **Problem/Opportunity:** Gateway must be tenant-aware. It should resolve the tenant from the Host header (e.g., `oakridge.schoolsaas.com`), validate tenant active status, enforce rate limits via Redis, and block unauthorized cross-tenant requests.
* **Recommended Action:** **REFACTOR**. Update route mappings for school services, add tenant resolution middleware, and replace in-memory rate limiting with Redis or AWS WAF.
* **Priority:** **High**

#### Finding RRR-05: Customer Auth to School IAM (`services/auth-service/`)
* **Existing Implementation:** Simple customer table with bcrypt hash and email uniqueness.
* **Verified:** Yes.
* **Problem/Opportunity:** Cannot support Multi-School Hierarchy (Platform Admin, School Principal, Teachers, Students, Parents, Accountants) with complex permission sets.
* **Recommended Action:** **REFACTOR**. Expand schema to include `tenants`, `branches`, `users`, `roles`, `permissions`, and `user_tenant_memberships`. Implement multi-factor authentication (MFA) for administrative roles.
* **Priority:** **Critical**

#### Finding RRR-06: E-Commerce Services to School Academic & Records Services
* **Existing Implementation:** `catalog-service` manages food inventory; `cart-service` handles items; `order-service` implements e-commerce checkout saga.
* **Verified:** Yes.
* **Problem/Opportunity:** E-commerce domain logic (pickles, weights, spice levels, shipping calculations) has no relevance to academic administration.
* **Recommended Action:** **REPLACE**. Repurpose the scaffolding (Express, routes, DB migrations, Dockerfiles) into:
  - `academic-service`: Classes, Sections, Subjects, Curricula, Timetables.
  - `enrollment-service`: Academic term registration, subject enrollment, elective allocations.
  - `student-records-service`: Student biodata, Attendance, Examination marks, GPA computation, and Report Cards.
* **Priority:** **High**

#### Finding RRR-07: Payment Service to School Finance & Fees (`services/payment-service/`)
* **Existing Implementation:** Stateless mock payment gateway for credit cards and UPI.
* **Verified:** Yes.
* **Problem/Opportunity:** School finance requires invoicing, partial fee installments, sibling discounts, scholarship waivers, receipt generation, and real gateway integration (Stripe, Razorpay, BillDesk).
* **Recommended Action:** **REFACTOR**. Add database persistence for fee schedules and invoices, integrate webhooks for asynchronous payment confirmations, and automate PDF receipt generation.
* **Priority:** **High**

---

### 3.3 Infrastructure & Cloud Platform

#### Finding RRR-08: In-Cluster PostgreSQL StatefulSet (`gitops/k8s/database/postgres.yml`)
* **Existing Implementation:** Single container PostgreSQL 16 on gp3 EBS volume.
* **Verified:** Yes.
* **Problem/Opportunity:** Single point of failure, no automated failover, unmanaged disk snapshots. Unacceptable for commercial multi-tenant SaaS.
* **Recommended Action:** **REPLACE**. Provision an AWS Aurora PostgreSQL Serverless v2 cluster across 3 Availability Zones with automated backups, point-in-time recovery, and encryption with AWS KMS.
* **Priority:** **Critical**

#### Finding RRR-09: Single-Tier Public VPC (`projects/Infrastructure/modules/vpc/`)
* **Existing Implementation:** Single route table associated with an Internet Gateway; nodes have public IPs.
* **Verified:** Yes.
* **Problem/Opportunity:** Critical security violation for enterprise software. Worker nodes and databases must never have public IP addresses.
* **Recommended Action:** **REFACTOR**. Redesign VPC module with Public Subnets (ALB, NAT Gateways), Private Subnets (EKS Managed Node Groups), and Database Subnets (RDS/Aurora).
* **Priority:** **Critical**

---

### 3.4 GitOps, CI/CD, and AIOps

#### Finding RRR-10: Argo CD & Argo Rollouts (`gitops/`)
* **Existing Implementation:** Argo CD synchronizes `gitops/kustomization.yml`. Blue-Green strategy on frontend; Canary release strategy (25% $\rightarrow$ 50% $\rightarrow$ 100%) on catalog-service with Prometheus 5xx metric analysis.
* **Verified:** Yes.
* **Problem/Opportunity:** World-class DevOps foundation. Can be directly reused for zero-downtime deployments of the School Management System.
* **Recommended Action:** **REUSE**. Update application names, image references, and Prometheus analysis thresholds to point to the new school services.
* **Priority:** **Low**

#### Finding RRR-11: Kira Bedrock Multi-Agent Assistant (`projects/aiops-assistant/`)
* **Existing Implementation:** Bedrock Converse API with supervisor agent and three specialist agents (Logs, Metrics, Deployments).
* **Verified:** Yes.
* **Problem/Opportunity:** Outstanding operational tool. Can be immediately reused for cluster operations, with future opportunity to expand into a School Administrative Agent.
* **Recommended Action:** **REFACTOR**. Keep existing SRE capabilities; add specialized queries for school business metrics (fee collection drops, attendance submission spikes).
* **Priority:** **Medium**
