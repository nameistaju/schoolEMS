# Document 10: Deployment, Operational Runbook & Rollback Procedures

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** DevOps & Site Reliability Engineering (SRE)  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Local Development Deployment (`docker-compose.yml`)

Phase 1 runs seamlessly inside the existing local development environment using Docker Compose without requiring cloud provisioning.

### 1.1 Local Stack Execution
```bash
# 1. Start the stack (PostgreSQL, Gateway, Services, Prometheus, Grafana)
cd projects/telugu-pickles
docker compose up -d postgres

# 2. Execute Knex migrations strictly on auth_db
npm --prefix services run migrate

# 3. Seed initial SuperAdmin and Demo Schools (School A & School B)
npm --prefix services run seed:superadmin
npm --prefix services run seed:demo-schools

# 4. Start all services
docker compose up -d --build
```

### 1.2 Local Service Endpoints
* **API Gateway:** `http://localhost:8080`
* **Health Check:** `http://localhost:8080/api/health`
* **Identity Service (Internal):** `http://localhost:4001`
* **E-Commerce Catalog (Preserved):** `http://localhost:4002`
* **E-Commerce Cart (Preserved):** `http://localhost:4003`
* **E-Commerce Orders (Preserved):** `http://localhost:4004`
* **E-Commerce Payment (Preserved):** `http://localhost:4005`
* **Prometheus:** `http://localhost:9090`
* **Grafana Dashboards:** `http://localhost:3001` (`admin` / `admin`)

---

## 2. Environment Variables Specification

All sensitive credentials and asymmetric keys are injected via environment variables:

| Variable Name | Environment | Sample / Default Value | Purpose |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | All | `development` / `production` | Enables production security checks and disables debug endpoints. |
| `ALLOW_HEADER_TENANT_RESOLVER` | Dev Only | `true` in dev, **`false` in prod** | When `true` in local dev, allows `X-Tenant-Domain` fallback testing. |
| `PORT` | All | `4001` (Identity), `8080` (Gateway) | Service listening port. |
| `PGHOST` | All | `postgres` (Docker) / `localhost` | PostgreSQL host endpoint. |
| `PGPORT` | All | `5432` | PostgreSQL port. |
| `PGUSER` | All | `school_app_user` | Non-privileged application database user (enforcing RLS). |
| `PGPASSWORD` | All | *(Secure generated string)* | Application database user password. |
| `PG_ADMIN_DB` | Dev/CI | `postgres` | Administrative database used only for migration execution. |
| `JWT_PRIVATE_KEY` | Identity | `-----BEGIN RSA PRIVATE KEY-----...` | 2048-bit RSA Private Key for signing JWTs. |
| `JWT_PUBLIC_KEY` | Gateway/All | `-----BEGIN PUBLIC KEY-----...` | 2048-bit RSA Public Key for verifying JWT claims. |
| `COOKIE_SECRET` | Gateway | *(48-character random string)* | Used for signing secure session cookies. |
| `CORS_ORIGIN` | All | `http://localhost:3000` | Allowed web origins. |

---

## 3. Zero-Downtime Migration & Rollback Procedure

### 3.1 Migration Execution Flow
In containerized and Kubernetes environments, schema migrations on `auth_db` are executed via a **PreSync Kubernetes Hook Job** before new application pods are launched:

```
[ Argo CD GitOps Sync Triggered ]
               │
               ▼
   [ 1. PreSync Kubernetes Job ]
   - Runs: npm run migrate (strictly on auth_db)
   - Executes new versioned Knex migrations in PostgreSQL transaction
   - If migration fails -> Sync ABORTS immediately; pods are untouched
               │
               ▼ (On Success)
   [ 2. Argo Rollout Starts ]
   - Deploys new application containers
   - Verifies readiness probes (/health/ready)
   - Performs progressive traffic cutover
```

### 3.2 Rollback Procedure
If unexpected errors or latency spikes occur following a release:
```bash
# 1. Roll back the application container rollout via Argo Rollouts
kubectl argo rollouts undo deployment/auth-service -n telugu-pickles

# 2. Revert the database schema batch safely on auth_db
npm run migrate:rollback
```

---

## 4. Production Boundaries & Safety Confirmation

> **NON-NEGOTIABLE COMPLIANCE CONFIRMATION:**
> No AWS production deployment, Terraform apply, or cloud infrastructure modification is authorized during Phase 1. All development, testing, and migration verification are strictly confined to local environments and GitHub Actions CI containers. Cloud deployment will be executed as a dedicated, explicitly authorized activity in Phase 10.
