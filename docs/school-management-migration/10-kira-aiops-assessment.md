# Document 10: Kira AIOps Engine Assessment & Intelligent School SRE

**Document Status:** Final  
**Classification:** Artificial Intelligence & AIOps Architecture Review  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Existing Kira AIOps Architecture Overview (`projects/aiops-assistant/`)

The repository contains a state-of-the-art autonomous Site Reliability Engineering (SRE) assistant named **Kira** (also referenced as *Dude*). Built on the **Amazon Bedrock Converse API** and deployed on AWS Lambda, Kira is triggered interactively via a Streamlit dashboard (`app.py`) or autonomously via Amazon CloudWatch metric alarms published to Amazon SNS.

```
                      [ CLOUDWATCH METRIC ALARM ]
                   "telugu-pickles-error-spike" (>5 err/5min)
                                  │
                                  ▼
                     [ SNS: telugu-pickles-alarms ]
                                  │
                                  ▼
            ┌────────────────────────────────────────────────────────┐
            │       AWS Lambda: telugu-pickles-kira (kira.py)        │
            │                                                        │
            │   SUPERVISOR AGENT (Amazon Nova Pro / Claude Sonnet)   │
            │   Tool-use loop evaluating incident context            │
            │          │                 │                 │         │
            │   (Asks Specialists in parallel via Bedrock Converse)  │
            │          │                 │                 │         │
            │          ▼                 ▼                 ▼         │
            │    [ Logs Agent ]   [ Metrics Agent ] [ Deploy Agent ] │
            │     (Nova Lite)       (Nova Lite)       (Nova Lite)    │
            │          │                 │                 │         │
            └──────────┼─────────────────┼─────────────────┼─────────┘
                       │                 │                 │
                       ▼                 ▼                 ▼
               [ CloudWatch Logs ] [ Prometheus Proxy ] [ EKS API ]
                       │                 │                 │
                       └─────────────────┼─────────────────┘
                                         ▼
                     [ GENERATE INCIDENT SRE REPORT ]
                      Summary, Impact, Root Cause, Evidence,
                      Recommended Fix, and Prevention Plan
                                         │
                                         ▼
                     [ SNS: telugu-pickles-aiops-reports ]
                                         │
                                         ▼
                                 [ Email to DevOps ]
```

---

## 2. Component-by-Component Technical Assessment

### 2.1 Supervisor & Specialist Agent Architecture (`lambda/kira.py`)
* **Loop Implementation:** Uses the standardized Bedrock Converse tool-use loop (`run_agent`).
* **Parallel Execution:** When the supervisor model invokes multiple specialists, they are executed concurrently using Python's `ThreadPoolExecutor(max_workers=4)`.
* **Token & Cost Management:** Result payloads are truncated at `MAX_TOOL_RESULT = 12,000` characters to prevent context window saturation and control API inference costs.
* **Model Configuration:**
  - **Supervisor:** `us.amazon.nova-pro-v1:0` (Default) or `us.anthropic.claude-sonnet-4-6` (High Reasoning).
  - **Specialists:** `us.amazon.nova-lite-v1:0` (Default) or `us.anthropic.claude-haiku-4-5` (Fast Execution).

### 2.2 The Specialist Agents & Tooling

1. **Logs Specialist (`lambda/logs_tools.py`)**:
   - `error_summary(time_range_minutes)`: Runs CloudWatch Logs Insights queries aggregating error counts by service, message, and HTTP path.
   - `search_logs(query, service, time_range_minutes)`: Executes regex and keyword searches across pod stdout streams.

2. **Metrics Specialist (`lambda/metrics_tools.py`)**:
   - `service_health()`: Evaluates HTTP request rates, p95/p99 latency, and error ratios per service via Prometheus.
   - `pod_errors()`: Scrapes error spikes and pod restarts.
   - `pod_resources()`: Analyzes CPU and memory consumption vs. resource limits.
   - `firing_alerts()`: Retrieves currently firing Prometheus Alertmanager rules.

3. **Deployment Specialist (`lambda/deploy_tools.py`)**:
   - `rollout_status()`: Inspects Argo Rollouts (Canary and Blue-Green status, active steps).
   - `analysis_runs()`: Evaluates Canary metric analysis outcomes.
   - `argocd_status()`: Queries Argo CD application health and sync status.
   - `pod_status()`, `recent_events()`: Analyzes Kubernetes pod lifecycle events (OOMKilled, CrashLoopBackOff, ImagePullBackOff).

### 2.3 Minimal Kubernetes Client (`lambda/k8s.py`)
* The Lambda does not bundle bulky `kubectl` binaries or complex libraries.
* It signs an AWS STS `GetCallerIdentity` request using its IAM execution role to retrieve an EKS authentication token (`k8s-aws-v1.` header).
* Authenticates directly to the EKS API server.
* Proxies Prometheus queries directly through the EKS API (`/api/v1/namespaces/monitoring/services/kube-prometheus-stack-prometheus:9090/proxy/api/v1/query`), **completely eliminating the need to expose Prometheus to the public internet**.

### 2.4 Security & RBAC Isolation
* **IAM Least Privilege:** The Lambda IAM role is strictly read-only (`bedrock:InvokeModel`, `logs:StartQuery`, `logs:GetQueryResults`, `sns:Publish`).
* **Kubernetes RBAC:** Mapped to ClusterRole `aiops-reader` via an EKS Access Entry.
  - Granted `get` and `list` on pods, events, services, rollouts, and analysis runs.
  - **Explicitly denied access to Kubernetes Secrets, ConfigMaps, and pod execution (`exec`).**

---

## 3. Repurposing Kira for the School Management System

Kira provides enormous competitive differentiation for a commercial School SaaS platform. Her role is expanded into two specialized operational vectors:

```
                                  [ KIRA AIOPS ENGINE ]
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
          [ VECTOR 1: SRE & CLOUD OPS ]             [ VECTOR 2: SCHOOL ADMINISTRATIVE AI ]
          - Morning Attendance Spikes               - Attendance Anomaly Detection
          - Exam Result Release Traffic             - Fee Defaulter Trend Analysis
          - Fee Payment Gateway Timeouts            - Enrollment Velocity Forecaster
          - Multi-Tenant RLS Query Latency          - Automated Accreditation Reporting
```

### 3.1 Vector 1: School Cloud SRE (Immediate Adaptation)
* **High-Stakes Academic Scenarios:**
  - **Morning Attendance Surge (8:00 AM - 9:00 AM):** Thousands of teachers submitting attendance concurrently. Kira monitors database write connection pool exhaustion and auto-scales Aurora ACUs.
  - **Exam Result Publication:** Heavy read traffic from students and parents. Kira detects canary rollout regressions and automatically triggers rollbacks if 5xx errors spike.
  - **Fee Due Dates:** Surges in payment gateway webhooks. Kira tracks payment service timeout ratios and detects third-party gateway degradations.

### 3.2 Vector 2: School Administrative Intelligence Specialist (New Capability)
Add a 4th specialist agent: **`academic_intelligence_agent`**
* **Tools:**
  - `query_tenant_metrics(tenant_id, metric)`: Reports school attendance percentages, staff vacancy ratios, and fee collection fulfillment.
  - `detect_attendance_anomalies(branch_id)`: Flags classes with abnormal dropouts or chronic absenteeism.
  - `summarize_financial_health(tenant_id)`: Prepares monthly financial summaries for school trustees and principals.

---

## 4. Assessment Matrix & Findings

| Component | Code Reference | Verified | Finding / Opportunity | Target School Action | Priority |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **Agent Framework** | `projects/aiops-assistant/lambda/kira.py` | **Verified** | Robust, lightweight Converse API loop without heavy framework overhead. | Retain architecture; rename platform prompt context to School SaaS. | **Low** |
| **Prometheus Proxy** | `lambda/k8s.py` | **Verified** | Highly secure proxy via EKS API; no public ports required. | Retain as-is. | **Low** |
| **CloudWatch Log Filter** | `platform/main.tf` (lines 140-165) | **Verified** | Alarms on error count $>5$ in 5 minutes. | Update metric filter pattern to match School JSON log structure. | **Medium** |
| **Streamlit UI** | `projects/aiops-assistant/app.py` | **Verified** | Clean, responsive developer UI with timing, tokens, and trace breakdown. | Retain for DevOps; integrate summary insights into SuperAdmin web portal. | **Low** |
