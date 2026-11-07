# Document 01: Repository Audit & Baseline Verification

**Document Status:** Final  
**Classification:** Proprietary / Commercial SaaS Architecture  
**Author:** Principal Software Architect & Lead Security Engineer  
**Scope:** `JuneAWSAIOpsProj-main` Baseline Codebase  
**Date:** March 2026  

---

## 1. Executive Summary of Audit

A full, non-destructive static code inspection and verification of the workspace was conducted against source files across application code, infrastructure definitions, Kubernetes manifests, CI/CD pipelines, and AI operational components.

The repository is a reference architecture combining a 6-tier e-commerce microservices demo application (*Telugu Pickles*), automated AWS infrastructure via Terraform, Kubernetes GitOps deployment via Argo CD and Argo Rollouts, comprehensive Prometheus/Grafana observability, and a generative AIOps incident triage engine (*Kira/Dude*) utilizing Amazon Bedrock Converse API and AWS Lambda.

The findings confirm that while the **DevOps, GitOps, Infrastructure, and Observability scaffolding is ~85% production-ready and highly reusable**, the **application layer is strictly single-tenant e-commerce code** that requires significant domain refactoring and multi-tenancy implementation to support an enterprise School Management System (SMS).

---

## 2. Repository Structure & Artifact Inventory

### 2.1 File Tree Analysis

```
JuneAWSAIOpsProj-main/
├── .github/
│   └── workflows/
│       ├── ci.yml               # Multi-job application CI: test, build, scan, push, gitops-bump
│       ├── infra.yml            # Terraform plan/apply/destroy workflow
│       ├── release.yml          # Release packaging automation
│       └── security.yml         # Reusable Gitleaks and Trivy vulnerability scanner
├── docs/                        # Reference documentation, runbooks, and diagrams
├── gitops/
│   ├── kustomization.yml        # Kustomize root referencing all application components
│   └── k8s/
│       ├── apps/                # Manifests for gateway, services, frontend, autoscaling, analysis
│       ├── database/            # In-cluster single-replica PostgreSQL StatefulSet
│       ├── monitoring/          # ServiceMonitor and Grafana dashboard ConfigMaps
│       └── platform/            # StorageClass (gp3) and environment ConfigMaps
├── projects/
│   ├── aiops-assistant/         # Multi-agent AIOps engine (Lambda + Streamlit UI)
│   ├── Infrastructure/          # Modular AWS Terraform configuration
│   └── telugu-pickles/          # Application tier (services, frontend, docker-compose)
├── scripts/                     # Operational shell scripts (helm-repos.sh, pre-destroy.sh)
├── .gitattributes
├── .gitignore
├── .gitleaks.toml               # Custom Gitleaks configuration rules
├── CLAUDE.md                    # Project guidance & safety instructions
├── README.md                    # Repository introduction and architectural overview
└── student-guide.html           # Interactive step-by-step educational runbook
```

---

## 3. Package & Dependency Inventory

### 3.1 Backend Services (`projects/telugu-pickles/services/package.json`)
* **Package Name:** `telugu-pickles-services` (v1.0.0, private)
* **Node Engine:** `>=20`
* **Core Dependencies:**
  * `bcryptjs` (`^2.4.3`): Password hashing algorithm.
  * `express` (`^4.21.2`): Minimalist web server framework.
  * `http-proxy-middleware` (`^3.0.3`): Reverse proxy routing inside the API Gateway.
  * `jsonwebtoken` (`^9.0.2`): Stateless token signing and verification.
  * `pg` (`^8.13.1`): Non-blocking PostgreSQL client and connection pooling.
  * `prom-client` (`^15.1.3`): Prometheus metrics instrumentation (counters, histograms).
* **Test Runner:** Built-in Node test runner (`node --test "test/**/*.test.js"`).

### 3.2 Frontend (`projects/telugu-pickles/frontend/package.json`)
* **Package Name:** `telugu-pickles-frontend` (v1.0.0, private)
* **Build System:** Vite `5.4.11` with `@vitejs/plugin-react` `4.3.4`
* **Dependencies:**
  * `react`: `18.3.1`
  * `react-dom`: `18.3.1`
  * `react-router-dom`: `^6.30.6`
* **Styling & Assets:** Vanilla CSS modern styling (`styles.css`), SVG icons.

### 3.3 AIOps Assistant (`projects/aiops-assistant/requirements.txt`)
* **Python Runtime:** Python `>=3.11`
* **Dependencies:**
  * `streamlit>=1.40.0`: Interactive operator chat interface.
  * `boto3>=1.35.0`: AWS SDK for Bedrock, CloudWatch, Lambda, SNS.
  * `botocore>=1.35.0`: Foundation client configurations.
  * `python-dotenv>=1.0.0`: Local environment variable injection.

### 3.4 Infrastructure as Code (`projects/Infrastructure/`)
* **Terraform Version Requirement:** `>= 1.6.0`
* **Providers Configured (`.terraform.lock.hcl`):**
  * `hashicorp/aws`: `~> 5.80`
  * `hashicorp/kubernetes`: `~> 2.34`
  * `hashicorp/helm`: `~> 2.16`
  * `hashicorp/random`: `~> 3.6`
  * `hashicorp/tls`: `~> 4.0`

---

## 4. Documentation vs. Reality Gap Analysis

| Architectural Dimension | Stated in Documentation / README | Verified Implementation in Code | Gap / Discrepancy |
| :--- | :--- | :--- | :--- |
| **Database Architecture** | "Production upgrade path: Amazon RDS for PostgreSQL" | In-cluster single-pod StatefulSet (`postgres:16-alpine`) backed by gp3 EBS volume (`gitops/k8s/database/postgres.yml`). | **Critical:** No RDS or Aurora instance exists in Terraform. Single point of failure (SPOF) with no Multi-AZ failover or automated PITR. |
| **VPC & Subnet Isolation** | Implies secure AWS deployment for EKS | VPC module (`projects/Infrastructure/modules/vpc/main.tf`) creates **public subnets only** with `map_public_ip_on_launch = true`. No private subnets or NAT gateways. | **Critical:** EKS worker nodes receive public IP addresses. Database and backend containers have direct routable IP potential. |
| **Microservice Isolation** | "database-per-service on one PostgreSQL server" | All services connect to the same PostgreSQL host using a shared superuser credential (`PGUSER=postgres`). | **High:** Any compromised service container can run SQL queries against other services' databases. |
| **Internal Service Security** | "payment-service and /internal/* routes not exposed" | Routes are blocked at Gateway (`gateway/src/index.js`), but Kubernetes pods lack `NetworkPolicy`. | **High:** Any compromised container within the pod network can send HTTP requests directly to `order-service:4004` or `payment-service:4005`. |
| **Automated Testing** | Stated CI test step in pipeline | Exactly two unit test files exist: `auth.test.js` and `pricing.test.js` (total 7 assertions). | **High:** Zero integration tests, zero end-to-end tests, zero database query tests, zero frontend tests. |
| **Rate Limiting** | "login rate limiting per client IP" | In-memory JavaScript `Map` inside Gateway process (`const hits = new Map()`). | **Medium:** Does not sync across multiple Gateway replicas; resets upon pod restart. |

---

## 5. Detailed Code Audit Findings

Every component was analyzed and cataloged using the required format:

### 5.1 Backend & Application Tier

#### Finding B-01: Stateless Single-Tenant User Model
* **File/Directory:** `projects/telugu-pickles/services/auth-service/src/index.js`
* **Existing Implementation:** Users table contains only `(id, name, email, phone, password_hash, created_at)`.
* **Verified:** Yes.
* **Problem/Opportunity:** Zero support for multi-tenancy (`tenant_id`, `school_id`, `branch_id`) and zero user role differentiation (`role`, `permissions`).
* **Recommended Action:** Refactor `auth-service` into an Enterprise Identity & Access Management (IAM) service supporting multi-tenant isolation, RBAC, and branch assignments.
* **Priority:** **Critical**

#### Finding B-02: Fixed In-Memory Rate Limiting
* **File/Directory:** `projects/telugu-pickles/services/gateway/src/index.js` (lines 53-66)
* **Existing Implementation:** Rate limits `/api/auth/login` and `/api/auth/register` using a local in-memory JavaScript `Map` cleared every 60 seconds.
* **Verified:** Yes.
* **Problem/Opportunity:** When the Gateway scales horizontally to 2 or more replicas under HPA, rate limits are fragmented and bypassed. Pod restarts clear the counters.
* **Recommended Action:** Replace in-memory `Map` with Redis-backed distributed rate limiting or enforce rate limiting at the AWS ALB / WAF layer.
* **Priority:** **Medium**

#### Finding B-03: Shared Database Superuser Credentials
* **File/Directory:** `projects/telugu-pickles/services/common/db.js` (lines 31-53)
* **Existing Implementation:** Each service boots up, connects to PostgreSQL using administrative credentials (`POSTGRES_USER=postgres`), checks `SELECT 1 FROM pg_database`, and executes `CREATE DATABASE`.
* **Verified:** Yes.
* **Problem/Opportunity:** Every microservice possesses full superuser privileges, violating the principle of least privilege. A vulnerability in one service gives full control over all databases.
* **Recommended Action:** Provision individual PostgreSQL database roles per microservice with restricted DDL/DML permissions scoped strictly to their respective schemas.
* **Priority:** **High**

#### Finding B-04: Token Lifetime and Revocation Mechanism
* **File/Directory:** `projects/telugu-pickles/services/common/auth.js` (lines 5-19)
* **Existing Implementation:** Signs JWT with a 12-hour lifetime (`TTL = '12h'`) and symmetric HMAC secret (`JWT_SECRET`). No refresh token mechanism or revocation list.
* **Verified:** Yes.
* **Problem/Opportunity:** If a student, staff, or admin account is compromised or permissions change, tokens cannot be invalidated until the 12-hour expiration window lapses.
* **Recommended Action:** Implement short-lived access tokens (15 minutes), secure refresh tokens with sliding expiration in Redis, and asymmetric RSA/ECDSA key pair signing.
* **Priority:** **High**

---

### 5.2 Infrastructure & Cloud Tier

#### Finding I-01: Public-Only Subnet Topology
* **File/Directory:** `projects/Infrastructure/modules/vpc/main.tf` (lines 19-33)
* **Existing Implementation:** VPC defines subnets with `map_public_ip_on_launch = true` and routes all traffic directly through an Internet Gateway.
* **Verified:** Yes.
* **Problem/Opportunity:** Worker nodes and in-cluster database run inside public subnets. This is unacceptable for educational SaaS hosting sensitive minor and parent records.
* **Recommended Action:** Restructure VPC to follow 3-tier enterprise topology: Public Subnets (ALB / NAT Gateways), Private Application Subnets (EKS Managed Nodes), and Isolated Database Subnets (Amazon Aurora / RDS).
* **Priority:** **Critical**

#### Finding I-02: Absence of Managed Relational Database (RDS/Aurora)
* **File/Directory:** `projects/Infrastructure/main.tf` & `gitops/k8s/database/postgres.yml`
* **Existing Implementation:** PostgreSQL runs as a single-pod Kubernetes StatefulSet on an EBS volume without snapshots or automated backups.
* **Verified:** Yes.
* **Problem/Opportunity:** High risk of data loss or prolonged outage during node rescheduling or disk failure. Does not meet commercial SaaS RPO/RTO SLAs.
* **Recommended Action:** Add a Terraform module for Amazon Aurora PostgreSQL Serverless v2 with automated daily backups, 35-day PITR, and Multi-AZ replication.
* **Priority:** **Critical**

#### Finding I-03: Secret Generation in Terraform State
* **File/Directory:** `projects/Infrastructure/modules/platform/main.tf` (lines 38-58)
* **Existing Implementation:** `random_password` generates PostgreSQL passwords and JWT secrets, which are written as plaintext into `terraform.tfstate` and created as a raw `kubernetes_secret_v1`.
* **Verified:** Yes.
* **Problem/Opportunity:** Terraform state files stored in S3 contain unencrypted secrets accessible to anyone with state bucket read permissions.
* **Recommended Action:** Store secrets in AWS Secrets Manager or HashiCorp Vault, and sync to EKS via External Secrets Operator (ESO).
* **Priority:** **High**

---

### 5.3 Kubernetes, GitOps & Security

#### Finding K-01: Lack of Kubernetes NetworkPolicies
* **File/Directory:** `gitops/k8s/`
* **Existing Implementation:** No `NetworkPolicy` resources exist across any namespaces (`telugu-pickles`, `argocd`, `monitoring`).
* **Verified:** Yes.
* **Problem/Opportunity:** Pod network is flat. The frontend container can communicate directly with payment, order, and database pods on port 5432.
* **Recommended Action:** Apply default-deny egress/ingress NetworkPolicies in the application namespace, allowing traffic only along designated paths (Ingress $\rightarrow$ Gateway $\rightarrow$ Domain Services $\rightarrow$ Database).
* **Priority:** **High**

#### Finding K-02: Frontend Token Storage in LocalStorage
* **File/Directory:** `projects/telugu-pickles/frontend/src/api.js` (lines 5-12)
* **Existing Implementation:** JWT token is retrieved and stored directly in browser `localStorage` (`tp_token`).
* **Verified:** Yes.
* **Problem/Opportunity:** Vulnerable to Cross-Site Scripting (XSS) attacks. An attacker executing malicious JavaScript can steal admin/parent session tokens.
* **Recommended Action:** Migrate session management to secure, `HttpOnly`, `SameSite=Strict`, `Secure` cookies with CSRF double-submit protection.
* **Priority:** **High**

---

## 6. Audit Summary Scorecard

| Category | Reusability Rating | Production Readiness | Primary Refactoring Focus |
| :--- | :---: | :---: | :--- |
| **Terraform & VPC** | 70% | Medium | Add private/database subnets, NAT Gateways, Aurora RDS module. |
| **Kubernetes & GitOps** | 85% | High | Add NetworkPolicies, update names/labels, External Secrets. |
| **Observability (Prom/Graf)** | 90% | High | Update dashboards with school metrics (attendance, fees, auth). |
| **CI/CD Workflows** | 85% | High | Add integration test gates, container scanning thresholds. |
| **Kira AIOps Engine** | 80% | High | Add domain operational specialist tools and incident reporting. |
| **Backend Microservices** | 20% | Low | Refactor from e-commerce to multi-tenant educational services. |
| **Frontend Application** | 15% | Low | Complete redesign for role-based portal (Admin, Teacher, Student, Parent). |
| **Overall Platform** | **65%** | **Medium** | **DevOps core is solid; application domain needs transformation.** |
