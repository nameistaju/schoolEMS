# Document 12: Comprehensive Risk Register & Mitigation Strategy

**Document Status:** Final  
**Classification:** Enterprise Risk Management  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Risk Matrix & Scoring Methodology

Risks are quantified using an industry-standard $5 \times 5$ Risk Severity Matrix:
* **Likelihood:** 1 (Rare) to 5 (Almost Certain)
* **Impact:** 1 (Insignificant) to 5 (Catastrophic)
* **Risk Score:** $\text{Likelihood} \times \text{Impact}$
  * **Critical Risk (16–25):** Immediate architectural remediation required before production release.
  * **High Risk (10–15):** Mandatory mitigation during early development iterations.
  * **Medium Risk (5–9):** Planned operational controls and ongoing monitoring.
  * **Low Risk (1–4):** Accepted risk subject to standard hygiene.

```
       IMPACT ──►
   L  ┌─────┬─────┬─────┬─────┬─────┐
   I  │  5  │ 10  │ 15  │ 20  │ 25  │
   K  ├─────┼─────┼─────┼─────┼─────┤
   E  │  4  │  8  │ 12  │ 16  │ 20  │
   L  ├─────┼─────┼─────┼─────┼─────┤
   I  │  3  │  6  │  9  │ 12  │ 15  │
   H  ├─────┼─────┼─────┼─────┼─────┤
   O  │  2  │  4  │  6  │  8  │ 10  │
   O  ├─────┼─────┼─────┼─────┼─────┤
   D  │  1  │  2  │  3  │  4  │  5  │
      └─────┴─────┴─────┴─────┴─────┘
```

---

## 2. Comprehensive Risk Register

| Risk ID | Category | Risk Description | Likelihood (1-5) | Impact (1-5) | Severity Score | Mitigation Strategy | Owner Role | Monitoring Mechanism |
| :---: | :--- | :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **RSK-01** | **Security / Compliance** | **Cross-Tenant Data Leakage:** A bug in application SQL queries allows School A to view or modify records belonging to School B. | 3 | 5 | **15 (High)** | Enforce PostgreSQL Row-Level Security (RLS) at the database kernel level; force RLS on table owners; automated multi-tenant unit test gates in CI. | Principal Database Architect | Daily automated automated cross-tenant security regression tests in CI/CD. |
| **RSK-02** | **Infrastructure / Sec** | **Public Subnet Worker Exposure:** EKS nodes launched with public IPs are probed or exploited via unpatched container runtime or SSH/node vulnerabilities. | 4 | 5 | **20 (Critical)** | Reconfigure VPC with private worker subnets and isolated database subnets. Deploy AWS NAT Gateways for outbound egress. | Senior DevOps Engineer | AWS Security Hub, Amazon GuardDuty alerts on unauthorized ingress. |
| **RSK-03** | **Availability / SPOF** | **In-Cluster Database Failure:** Disk corruption or node crash on the single-pod PostgreSQL StatefulSet destroys student academic and fee records. | 4 | 5 | **20 (Critical)** | Migrate to Amazon Aurora PostgreSQL Serverless v2 Multi-AZ with automated continuous backups and 35-day Point-in-Time Recovery (PITR). | AWS Solutions Architect | CloudWatch Aurora replica lag alarms; synthetic health checks every 60s. |
| **RSK-04** | **Compliance (DPDP)** | **Child Data Privacy Violation:** Processing student biometric or profile data without verifiable parental consent violating Indian DPDP Act Section 9. | 4 | 4 | **16 (Critical)** | Implement mandatory guardian OTP onboarding workflow before student record activation; disable all behavioral tracking scripts. | Compliance Officer & Lead Architect | Audit logging of guardian consent timestamps stored in immutable S3 storage. |
| **RSK-05** | **Security / Auth** | **Token Hijacking via XSS:** Storing JWT in browser `localStorage` allows a compromised third-party script to steal admin or teacher session tokens. | 3 | 4 | **12 (High)** | Store session tokens in `HttpOnly`, `SameSite=Strict`, `Secure` cookies. Implement Content Security Policy (CSP) headers in Nginx. | Lead Frontend Engineer | Automated dynamic application security testing (DAST) in CI pipeline. |
| **RSK-06** | **Operational** | **Morning Attendance Concurrency Throttling:** 10,000+ teachers submitting classroom attendance simultaneously between 8:00 AM and 8:30 AM exhausts DB connection pools. | 4 | 4 | **16 (Critical)** | Deploy RDS Proxy for connection pooling; partition `attendance_logs` table by date; configure Aurora ACU autoscaling up to 16 ACUs. | Database Architect & SRE Lead | Prometheus `http_request_duration_seconds` and Aurora connection count alarms. |
| **RSK-07** | **Security / Network** | **Lateral Movement in Cluster:** An attacker compromising the frontend container moves laterally across the flat pod network to internal payment and database ports. | 3 | 4 | **12 (High)** | Deploy default-deny Kubernetes `NetworkPolicy` resources across all namespaces, restricting inter-pod traffic to authorized paths. | Senior DevOps Engineer | Kubernetes audit logs; Falco runtime security monitoring. |
| **RSK-08** | **Financial** | **Double Payment / Inconsistent State:** Slower network connections during fee checkout result in duplicate student fee charges or missing invoices. | 3 | 4 | **12 (High)** | Implement strict idempotency keys (`Idempotency-Key` header) on all fee transaction APIs; utilize database transactions with row-level locks. | Backend Lead (Finance) | CloudWatch metrics tracking `payment_reconciliation_mismatches`. |
| **RSK-09** | **DevOps / CI/CD** | **Canary Deployment Schema Incompatibility:** Rolling out a Canary pod with new schema requirements breaks backward compatibility with active stable pods. | 3 | 3 | **9 (Medium)** | Enforce Expand/Contract (Parallel Run) database migration patterns; run migrations in Argo CD PreSync hooks before pod cutover. | DevOps Engineer | Argo Rollouts analysis template monitoring 5xx error rates during canary steps. |
| **RSK-10** | **Operational (AI)** | **AIOps Hallucination in SRE Triage:** Kira suggests incorrect remediation steps during a cluster outage leading to operational missteps. | 3 | 3 | **9 (Medium)** | Kira is strictly read-only; she never executes destructive mutations autonomously. All actions require human operator confirmation. | AI Solutions Architect | Operator feedback loop logging model response quality in Streamlit app. |

---

## 3. High-Priority Mitigation Action Plan

```
┌────────────────────────────────────────────────────────────────────────┐
│               TOP 3 MANDATORY PRE-PRODUCTION REMEDIATIONS              │
└────────────────────────────────────────────────────────────────────────┘

1. REMEDIATE VPC SUBNET EXPOSURE (RSK-02)
   Action: Update projects/Infrastructure/modules/vpc to deploy EKS nodes
   into private subnets behind NAT Gateways.
   Target Completion: Phase 10 / Infrastructure Hardening.

2. ELIMINATE IN-CLUSTER DATABASE SPOF (RSK-03)
   Action: Replace in-cluster StatefulSet with Amazon Aurora PostgreSQL
   Serverless v2 Multi-AZ with automated backups and PITR.
   Target Completion: Phase 1 (Foundation).

3. ENFORCE ROW-LEVEL SECURITY FOR MULTI-TENANCY (RSK-01)
   Action: Enable PostgreSQL RLS on all tables and inject verified tenant
   context in services/common/db.js on every transaction.
   Target Completion: Phase 1 (Foundation).
```
