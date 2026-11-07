# Document 02: Existing Architecture Deep-Dive

**Document Status:** Final  
**Classification:** Technical Architecture Review  
**Subject:** `JuneAWSAIOpsProj-main` As-Is State Analysis  
**Date:** March 2026  

---

## 1. System Topology & Architecture Overview

The existing codebase implements a distributed e-commerce architecture structured around six microservices written in Node.js/Express, a single-page React frontend served by Nginx, an in-cluster PostgreSQL instance, and an external Python-based AIOps triage agent connected to Amazon Bedrock.

```
                                  [ INTERNET ]
                                        │
                                 [ AWS ALB Ingress ]
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 [ frontend (Nginx) ]         [ gateway (:8080) ]
                   React 18 SPA                        │
                         │ (API calls: /api/*)         │
                         └─────────────────────────────┤
                                                       │
         ┌──────────────────┬──────────────────┬───────┴──────────┬──────────────────┐
         ▼                  ▼                  ▼                  ▼                  ▼
  [ auth-service ]  [ catalog-service ] [ cart-service ]   [ order-service ]  [ payment-service ]
     (:4001)            (:4002)            (:4003)            (:4004)            (:4005)
        │                  │                  │                  │                  │
        ▼                  ▼                  ▼                  ▼                  │ (Stateless)
   [ auth_db ]       [ catalog_db ]      [ cart_db ]        [ orders_db ]           │
        │                  │                  │                  │                  │
        └──────────────────┴─────────┬────────┴──────────────────┴──────────────────┘
                                     ▼
                      [ PostgreSQL 16 StatefulSet ]
```

---

## 2. Microservice Layer Breakdown

### 2.1 The Shared Service Micro-Framework (`services/common/`)

All six services are built on top of a shared abstraction layer located in `projects/telugu-pickles/services/common/`:

1. **`service.js` (`createService`)**:
   - Express initialization with `app.disable('x-powered-by')` and `app.set('trust proxy', true)`.
   - **Correlation Tracing**: Intercepts or generates an `X-Request-Id` UUID per HTTP transaction, binds it to `req.id`, and echoes it in `res.setHeader('X-Request-Id')`.
   - **Structured Logging**: Records standardized JSON access logs with duration (`hrtime`), response status, method, URL, and authenticated user ID.
   - **Health Endpoints**:
     - `GET /health/live`: Basic liveness check indicating Node event loop readiness.
     - `GET /health/ready`: Dependency readiness check verifying database connectivity or upstream availability.
   - **Chaos Injection**: Controlled chaos testing capability controlled via environment variables `CHAOS_ERROR_RATE` and `CHAOS_LATENCY_MS` (used for triggering AIOps alarms).
   - **Signal Trapping**: Intercepts `SIGTERM` and `SIGINT` to cleanly close HTTP listeners with a 10-second timeout.

2. **`db.js` (`initDatabase` & `ensureDatabase`)**:
   - Manages connection pools via `pg.Pool`.
   - Connects to an administrative database (`PG_ADMIN_DB`, default `postgres`) and queries `SELECT 1 FROM pg_database WHERE datname = $1`.
   - Dynamically executes `CREATE DATABASE` if missing.
   - Executes an array of migration SQL strings sequentially inside a single transaction.

3. **`auth.js` (`signToken`, `verifyToken`, `requireAuth`)**:
   - Signs tokens with HS256 using `process.env.JWT_SECRET`.
   - Decodes tokens, verifies issuer (`telugu-pickles-auth`), and binds `{ id, email, name }` to `req.user`.

4. **`http.js` (`callService`)**:
   - Centralized inter-service REST client utilizing Node's native `fetch`.
   - Automatically forwards `X-Request-Id` and `Authorization` headers.
   - Tracks outbound dependency failures in Prometheus metrics counter `dependencyErrorsTotal`.

5. **`metrics.js`**:
   - Prometheus metrics definitions via `prom-client`:
     - `http_requests_total`
     - `http_request_duration_seconds` (histogram with standard latency buckets)
     - `dependency_errors_total`
     - Business metrics: `orders_placed_total`, `order_value_rupees_total`.

---

### 2.2 Individual Microservices Analysis

#### A. `gateway` (Port 8080)
* **File:** `projects/telugu-pickles/services/gateway/src/index.js`
* **Role:** Single reverse proxy entry point.
* **Routing Rules:**
  * `/api/auth/*` $\rightarrow$ `auth-service:4001`
  * `/api/products*`, `/api/categories`, `/api/regions` $\rightarrow$ `catalog-service:4002`
  * `/api/cart*` $\rightarrow$ `cart-service:4003`
  * `/api/orders*` $\rightarrow$ `order-service:4004`
* **Internal Protection:** Internal routes such as `/internal/stock/reserve` and `payment-service` endpoints are explicitly excluded from the Gateway route map.
* **Aggregated Health (`/api/health`):** Concurrently polls `/health/ready` of all upstreams via `Promise.all` with a 2-second timeout and returns composite status.

#### B. `auth-service` (Port 4001)
* **File:** `projects/telugu-pickles/services/auth-service/src/index.js`
* **Database:** `auth_db`
* **Endpoints:**
  * `POST /auth/register`: Validates email, hashes password with `bcrypt.hash(password, 10)`, stores user, returns JWT and user profile.
  * `POST /auth/login`: Queries user by email, verifies hash via `bcrypt.compare`, issues JWT.
  * `GET /auth/me`: Requires authentication; returns current user record.
  * `PUT /auth/me`: Allows updating user name and phone number.
* **Limitations:** No role definitions, no school/tenant context, no MFA.

#### C. `catalog-service` (Port 4002)
* **File:** `projects/telugu-pickles/services/catalog-service/src/index.js`
* **Database:** `catalog_db`
* **Endpoints:**
  * `GET /products`, `GET /products/:slug`, `GET /categories`, `GET /regions`.
  * `POST /internal/stock/reserve`: Row-locked stock decrement (`SELECT ... FOR UPDATE` followed by `UPDATE products SET stock = stock - $1`).
  * `POST /internal/stock/release`: Compensating transaction to restore stock on payment failure.

#### D. `cart-service` (Port 4003)
* **File:** `projects/telugu-pickles/services/cart-service/src/index.js`
* **Database:** `cart_db`
* **Endpoints:**
  * `GET /cart`, `POST /cart/items`, `PUT /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart`.
  * Resolves pricing in real time by calling `catalog-service` to prevent client-side price tampering.

#### E. `order-service` (Port 4004)
* **File:** `projects/telugu-pickles/services/order-service/src/index.js`
* **Database:** `orders_db`
* **Architecture:** Implements a distributed Saga pattern for checkout:
  1. Calls `cart-service` to retrieve items and validate pricing.
  2. Calls `catalog-service` `/internal/stock/reserve` to hold inventory.
  3. Inserts order record with status `PENDING_PAYMENT`.
  4. Calls `payment-service` `/internal/payments`.
  5. If payment succeeds: marks order `CONFIRMED` and clears the cart.
  6. If payment fails: marks order `PAYMENT_FAILED` and invokes compensating endpoint `/internal/stock/release`.

#### F. `payment-service` (Port 4005)
* **File:** `projects/telugu-pickles/services/payment-service/src/index.js`
* **Database:** Stateless (No dedicated database).
* **Endpoints:**
  * `POST /internal/payments`: Mock payment processor supporting simulated card and UPI methods. Introduces artificial random failure rates when chaos flags are set.

---

## 3. Database & Persistence Architecture

### 3.1 Logical vs. Physical Isolation
The current design employs a **Database-Per-Service pattern on a single physical PostgreSQL instance**.
* A single database server hosts four separate relational databases: `auth_db`, `catalog_db`, `cart_db`, and `orders_db`.
* While logical schemas are separated, there is **zero compute or memory isolation** between databases. A noisy neighbor or resource-heavy query in `orders_db` directly impacts `auth_db`.

### 3.2 Migration Strategy Evaluation
Migrations are defined as static SQL strings in arrays (`const MIGRATIONS = [...]`) in each service's `index.js`.
* **Strengths:** Simple, zero external tooling required, idempotent `CREATE TABLE IF NOT EXISTS` syntax.
* **Deficiencies:**
  * No version tracking table (like `schema_migrations`).
  * Inability to run rollbacks or down-migrations.
  * Schema alterations (e.g., `ALTER TABLE ADD COLUMN`) cannot easily be executed idempotently without complex PL/pgSQL blocks.
  * No CI/CD migration validation step.

---

## 4. Frontend Architecture

* **Build & Dev:** Vite 5 + React 18 SPA.
* **Routing:** `react-router-dom` with 7 primary routes: `/`, `/shop`, `/product/:slug`, `/cart`, `/checkout`, `/orders`, `/auth`.
* **State Management:**
  * React Context API is used exclusively (`AuthContext`, `CartContext`, `ToastContext`).
  * No Redux, Zustand, or TanStack Query.
* **API Integration:**
  * Centralized wrapper `api.js` prepends `/api` to all requests.
  * In development, Vite reverse-proxies `/api` to `localhost:8080`.
  * In production, Nginx serves static HTML/JS and reverse-proxies `/api/` to `gateway:8080`.
* **Vulnerability:** JWT token is held in `localStorage` under key `tp_token`.

---

## 5. Observability & SRE Baseline

### 5.1 Prometheus & Grafana
* All services expose standard Prometheus metrics at `/metrics` scraped by Prometheus Operator every 15 seconds.
* ServiceMonitor resource configured in `gitops/k8s/monitoring/servicemonitor.yml`.
* Custom Grafana dashboard (`telugu-pickles-dashboard.json`) tracks:
  * Inbound HTTP request rates (RPS) per service.
  * 95th and 99th percentile request latency.
  * 4xx and 5xx HTTP error ratios.
  * Internal dependency failure counters.
  * Business KPIs (orders placed, revenue generated).

### 5.2 Centralized Logging
* Fluent Bit DaemonSet deployed via Helm collects all container stdout/stderr logs matching `/var/log/containers/*_telugu-pickles_*.log`.
* Logs are pushed to AWS CloudWatch Log Group `/eks/telugu-pickles/pods`.
* A CloudWatch Metric Filter (`telugu-pickles-error-logs`) monitors for `{ $.data.level = "ERROR" }` and triggers an SNS alarm (`telugu-pickles-alarms`) when errors exceed 5 in a 5-minute window.

---

## 6. Architectural Evaluation Matrix

| Architectural Dimension | Existing Score (1-10) | Evaluation & Commentary |
| :--- | :---: | :--- |
| **Separation of Concerns** | 8/10 | Clean microservice boundaries; distinct domain responsibilities. |
| **Scalability** | 7/10 | Services are stateless and scale horizontally via HPA; DB is a single-pod bottleneck. |
| **Fault Tolerance** | 6/10 | Graceful shutdowns and Saga pattern compensation exist, but single DB and public EKS nodes degrade resilience. |
| **Multi-Tenancy** | 0/10 | Completely absent; no tenant ID, no RLS, no schema partition. |
| **Security Hardening** | 4/10 | Good password hashing and parameterized SQL; crippled by public subnets, localStorage tokens, and missing NetworkPolicies. |
| **Observability** | 9/10 | Excellent integration of Prometheus, Grafana, CloudWatch, and AIOps alerting. |
