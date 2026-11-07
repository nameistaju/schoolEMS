# Document 09: GitOps Delivery & CI/CD Pipeline Assessment

**Document Status:** Final  
**Classification:** DevOps & CI/CD Engineering Review  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Overview of Existing GitOps & CI/CD Architecture

The repository contains an enterprise-caliber Continuous Integration and Continuous Delivery (CI/CD) foundation powered by **GitHub Actions, Aqua Trivy, Gitleaks, Amazon ECR, Kustomize, Argo CD, and Argo Rollouts**.

```
  [ Developer Push to main ]
              │
              ▼
   [ GitHub Actions: ci.yml ]
   ├── Security Scan (Gitleaks + Trivy IaC Scan)
   ├── Backend Unit Tests + Frontend Build
   ├── Build 7 Docker Images in Parallel
   ├── Trivy Container Vulnerability Scan
   ├── Authenticate via AWS OIDC (No Static Keys)
   ├── Push Signed Images to Amazon ECR
   └── Automatically Bump gitops/kustomization.yml (New SHA tag)
              │
              ▼
    [ GitOps Repository Commit ]
              │
              ▼
    [ Argo CD in EKS Cluster ]
   ├── Detects Git commit within 3 minutes (or webhook)
   ├── Reconciles desired state vs live cluster state
   └── Triggers Argo Rollouts:
         * Blue-Green for Frontend (Instant cutover with preview)
         * Canary for Backend (25% -> 50% -> 100% with Prometheus 5xx Analysis)
```

---

## 2. GitHub Actions Workflow Audit

### 2.1 Workflow Inventory & Purpose

| Workflow File | Trigger Conditions | Core Operations | Assessment & Quality |
| :--- | :--- | :--- | :--- |
| **`security.yml`** | Called by `ci.yml`, schedule, or PR | Gitleaks secret scan; Trivy filesystem and IaC vulnerability scan. Uploads SARIF report. | **Excellent.** Zero-trust security gate blocking secrets before build. |
| **`ci.yml`** | Push/PR to `projects/telugu-pickles/**` | Runs tests, builds frontend, parallel Docker builds, Trivy image scan, pushes to ECR, updates `gitops/`. | **High Quality.** Uses GitHub OIDC for passwordless AWS auth. Clean concurrency controls. |
| **`infra.yml`** | Push/PR to `projects/Infrastructure/**` | Runs `terraform fmt`, `terraform validate`, `tflint`, and `terraform plan/apply`. | **Solid.** Safe PR planning; requires explicit approvals for apply. |
| **`release.yml`** | Tag creation (`v*.*.*`) | Generates release notes, compiles artifacts, publishes GitHub release. | **Standard.** Functional semantic versioning. |

---

## 3. GitOps & Progressive Delivery Audit (`gitops/`)

### 3.1 Argo Rollouts Analysis

The repository uses **Argo Rollouts** rather than standard Kubernetes Deployments for progressive delivery:

1. **Frontend Blue-Green Deployment (`gitops/k8s/apps/frontend.yml`)**:
   - Maintains an active Service and a preview Service.
   - New versions are deployed to the preview environment.
   - Automated health checks verify readiness before switching active ingress traffic.
   - Provides instant rollback with zero dropped connections.

2. **Canary Deployment with Automated Metric Analysis (`gitops/k8s/apps/catalog-service.yml` & `analysis.yml`)**:
   - Deploys canary pods alongside stable pods.
   - Shifts 25% of traffic to the canary.
   - **`AnalysisTemplate` (`analysis.yml`)** executes a PromQL query against Prometheus:
     ```promql
     sum(rate(http_requests_total{service="catalog-service",status=~"5.."}[2m]))
     /
     sum(rate(http_requests_total{service="catalog-service"}[2m]))
     ```
   - If the error rate exceeds 2% (`failureLimit: 1`), Argo Rollouts **aborts rollout immediately and reverts traffic to 100% stable pods**, preventing user-impacting outages.
   - If error rate remains below 2%, rollout advances to 50% and then 100%.

---

## 4. Identified Gaps & Recommendations

| Pipeline Area | Existing Code Implementation | Verified Status | Identified Limitation | Recommended Action | Priority |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **Integration Testing** | `ci.yml` runs only `npm test` inside `services/test/` (2 files, 7 assertions). | **Verified** | No automated tests verify inter-service contracts, API routes, or database transactions before building images. | Introduce Jest/Supertest integration test suite with ephemeral test containers. | **High** |
| **Multi-Environment Promotion** | Single `gitops/kustomization.yml` targeting the production namespace. | **Verified** | No separation between Dev, Staging, and Production environments. Code merges directly to production. | Restructure `gitops/` into Kustomize overlays: `overlays/dev`, `overlays/staging`, `overlays/prod`. | **High** |
| **Database Migration Gate** | Migrations run inside application process on boot (`db.js`). | **Verified** | If a pod restarts during a canary release, newer schema migrations could break stable pods sharing the DB. | Decouple migrations into Argo CD PreSync Kubernetes Jobs before rolling out workloads. | **Critical** |
| **Container Base Images** | `services/Dockerfile` uses `node:20-alpine`. | **Verified** | Minimal attack surface; non-root user execution (`USER node`) is properly implemented. | Retain `node:20-alpine` and pin exact SHA digests. | **Low** |
| **Horizontal Pod Autoscaling** | `gitops/k8s/apps/autoscaling.yml` configures HPA on CPU (70%) and Memory (80%). | **Verified** | Works well; backed by `metrics-server` installed via Helm. | Retain HPA; add custom Prometheus metric scaling for API request rate. | **Medium** |

---

## 5. Transition Plan for School Management System

1. **Step 1: Manifest Renaming & Rebranding**
   - Update `gitops/k8s/apps/` files:
     - `auth-service.yml` $\rightarrow$ `identity-service.yml`
     - `catalog-service.yml` $\rightarrow$ `academic-service.yml` (retain Canary AnalysisTemplate)
     - `order-service.yml` $\rightarrow$ `student-records-service.yml`
     - `payment-service.yml` $\rightarrow$ `finance-service.yml`
     - `frontend.yml` $\rightarrow$ `school-portal.yml` (retain Blue-Green Rollout)
2. **Step 2: Add NetworkPolicy Manifests**
   - Place `gitops/k8s/platform/networkpolicies.yml` with default-deny rules.
3. **Step 3: Update AnalysisTemplate**
   - Extend Canary analysis queries across all backend school services to detect attendance submission or fee processing errors during rollouts.
