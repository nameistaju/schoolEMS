# Document 08: AWS Infrastructure Assessment & Production Blueprint

**Document Status:** Final  
**Classification:** Cloud Infrastructure Architecture Specification  
**Project:** Enterprise Multi-Tenant School Management Platform  
**Date:** March 2026  

---

## 1. Assessment of Existing Infrastructure (`projects/Infrastructure/`)

The repository includes a functional, modular Terraform configuration under `projects/Infrastructure/` designed to stand up an AWS environment for the *Telugu Pickles* reference application.

### 1.1 Existing Terraform Module Inventory

```
projects/Infrastructure/
├── bootstrap/               # One-time setup: S3 state bucket + GitHub Actions OIDC IAM role
├── modules/
│   ├── vpc/                 # Single-tier public VPC (3 AZs, Internet Gateway, public IPs)
│   ├── eks/                 # Amazon EKS cluster + managed node group + API access entries
│   ├── ecr/                 # Amazon ECR container repositories per microservice
│   ├── platform/            # Helm add-ons: Argo CD, Prometheus/Grafana, Fluent Bit, ALB Controller
│   └── aiops/               # AWS Lambda for Kira Bedrock supervisor + SNS topics
├── main.tf                  # Root orchestration calling vpc, eks, ecr, platform, aiops
├── variables.tf             # Input variables
├── outputs.tf               # Infrastructure outputs (cluster name, OIDC, log groups)
├── provider.tf              # AWS, Kubernetes, Helm provider configurations
└── terraform.tfvars         # Deployment configuration parameters
```

---

## 2. Infrastructure Gap Analysis & Verification Matrix

| Component | Existing Implementation in Code | Verification Status | Architectural Gap / Risk | Target Architecture Upgrade | Priority |
| :--- | :--- | :---: | :--- | :--- | :---: |
| **VPC & Subnets** | `modules/vpc/main.tf`: 3 public subnets with `map_public_ip_on_launch = true`. No NAT gateways. | **Verified** | EKS worker nodes receive public IPs directly exposed to internet scanning. | 3-tier VPC: 3 Public subnets, 3 Private app subnets, 3 Isolated DB subnets. 2 NAT Gateways. | **Critical** |
| **Relational Database** | In-cluster PostgreSQL StatefulSet (`gitops/k8s/database/postgres.yml`). No RDS module in Terraform. | **Verified** | High risk of data loss; no multi-AZ failover; unmanaged backups. | Provision Amazon Aurora PostgreSQL Serverless v2 cluster with 35-day PITR. | **Critical** |
| **Document Storage** | Only S3 state bucket exists (`bootstrap/main.tf`). No application object storage. | **Verified** | No secure persistence for student birth certificates, photos, report cards, or fee receipts. | Provision an Amazon S3 bucket with SSE-KMS encryption, versioning, and bucket policies. | **High** |
| **Secrets Management** | `modules/platform/main.tf`: `random_password` creates secrets in plaintext in Terraform state file. | **Verified** | State files in S3 expose database passwords and JWT secrets to all state readers. | Provision AWS Secrets Manager and sync via External Secrets Operator (ESO). | **High** |
| **Edge Security (WAF)** | AWS Load Balancer Controller deploys public ALB without AWS WAF. | **Verified** | Vulnerable to DDoS, HTTP flood attacks, and automated brute-force login attempts. | Attach AWS WAFv2 WebACL to ALB with AWS Managed Common Rule Set and rate limiting. | **High** |
| **Compute Nodes (EKS)** | `modules/eks/main.tf`: Managed Node Group using `t3.medium` instances. | **Verified** | Cost-effective for dev, but `t3.medium` burstable instances suffer CPU throttling under heavy load. | Migrate to `m6i.large` or `c6i.large` general-purpose instances with autoscaling. | **Medium** |
| **IAM & IRSA** | IAM Roles for Service Accounts (IRSA) configured for ALB Controller and Fluent Bit. | **Verified** | Excellent, modern security practice. Minimal privilege scopes already enforced. | Retain IRSA pattern and extend to School Microservices for S3 and SQS access. | **Low** |

---

## 3. Target Enterprise AWS Production Architecture

```
                                       [ AWS ROUTE 53 ]
                                              │
                                 [ AWS WAFv2 + AWS SHIELD ]
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      │                 AWS VPC (10.0.0.0/16)         │
                      │                                               │
                      │   [ PUBLIC SUBNETS (10.0.1.0/24, 10.0.2.0/24) ]│
                      │   ├── Internet Gateway (IGW)                  │
                      │   ├── AWS Application Load Balancer (ALB)     │
                      │   └── NAT Gateways (Multi-AZ)                 │
                      │               │                               │
                      │               ▼                               │
                      │   [ PRIVATE APP SUBNETS (10.0.10.0/24, 10.0.20.0/24) ]
                      │   ├── Amazon EKS Managed Worker Nodes         │
                      │   │     ├── school-gateway                    │
                      │   │     ├── identity-service                  │
                      │   │     ├── academic-service                  │
                      │   │     ├── student-records-service           │
                      │   │     └── finance-service                   │
                      │   └── VPC Endpoints (S3, ECR, CloudWatch, SSM)│
                      │               │                               │
                      │               ▼                               │
                      │   [ ISOLATED DATABASE SUBNETS (10.0.100.0/24) ]│
                      │   ├── Amazon Aurora PostgreSQL Serverless v2  │
                      │   │     ├── Writer Instance (Primary AZ)      │
                      │   │     └── Reader Instance (Secondary AZ)    │
                      │   └── Amazon ElastiCache Redis (Session/Rate) │
                      │                                               │
                      └───────────────────────────────────────────────┘
                                      │                     │
                                      ▼                     ▼
                        [ Amazon S3 KMS-Encrypted ]   [ AWS Secrets Manager ]
                         (Documents & Fee Receipts)    (DB Passwords & Keys)
```

---

## 4. Terraform Refactoring Plan

To upgrade the infrastructure without breaking existing deployments:

1. **Step 1: Upgrade `modules/vpc`**
   - Add variables: `private_subnet_cidrs`, `database_subnet_cidrs`.
   - Create `aws_subnet.private` and `aws_subnet.database`.
   - Deploy `aws_nat_gateway` in public subnets with Elastic IPs.
   - Route `0.0.0.0/0` in private subnets to NAT Gateways.
   - Isolate database subnets (no route to 0.0.0.0/0).

2. **Step 2: Update `modules/eks`**
   - Move worker node group attachment from public subnets to `private_subnet_ids`.
   - Restrict cluster endpoint access to authorized IP CIDRs or private VPC endpoints.

3. **Step 3: Create `modules/aurora` (New Module)**
   - Provision `aws_rds_cluster` with `engine = "aurora-postgresql"`, `engine_mode = "provisioned"`.
   - Configure Serverless v2 scaling configuration: `min_capacity = 0.5`, `max_capacity = 16.0`.
   - Enable `storage_encrypted = true` with Customer Managed KMS Key.
   - Configure subnet group mapped to `database_subnet_ids`.

4. **Step 4: Create `modules/storage` (New Module)**
   - Provision `aws_s3_bucket.school_documents` with bucket versioning enabled.
   - Apply `aws_s3_bucket_server_side_encryption_configuration` with KMS.
   - Configure `aws_s3_bucket_public_access_block` (blocking all public access).
   - Configure lifecycle rules to transition old records to Glacier Flexible Retrieval after 3 years.
