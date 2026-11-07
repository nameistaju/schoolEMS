# Document 07: Security Controls, Threat Modeling & DPDP Safeguards

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Security Architecture Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Threat Modeling & Defense-in-Depth

Phase 1 establishes the baseline security boundary for all future educational modules. Threat modeling evaluated five critical threat scenarios:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THREAT SCENARIO MITIGATION                      │
└────────────────────────────────────────────────────────────────────────┘

1. Cross-Tenant Spoofing:
   Attacker sends "X-Tenant-Domain: school-b" or "X-Tenant-Id: school-b" in headers
   or body to read School B's users.
   -> MITIGATION: In production, Gateway strips all X-Tenant-* and X-Verified-* headers.
      Tenant is resolved strictly from the verified Host domain.
      PostgreSQL RLS on Phase 1 tables (branches, user_tenant_memberships, membership_roles)
      blocks cross-tenant access at the database kernel.

2. Refresh Token Hijacking:
   Attacker intercepts refresh token and attempts to generate unauthorized access tokens.
   -> MITIGATION: Cryptographic Token Family Rotation. Attempted reuse of an already-rotated
      token immediately invalidates the entire token family and logs a security incident.

3. Brute Force Credential Guessing:
   Attacker launches credential stuffing against /api/v1/auth/login.
   -> MITIGATION: Sliding window rate limiting (5 attempts/min per IP/email) + progressive
      delay + account lockout after 10 consecutive failures.

4. XSS Session Extraction:
   Attacker injects malicious script into frontend to steal session credentials.
   -> MITIGATION: Refresh token stored in HttpOnly, SameSite=Strict cookie inaccessible to JS.
      Access token stored strictly in memory (never written to localStorage).

5. Malicious DB Query Injection:
   Developer bug or input flaw attempts to query without tenant context.
   -> MITIGATION: RLS policies in PostgreSQL fail closed (return 0 rows) when
      app.current_tenant_id is missing or invalid.
```

---

## 2. Hardened Production Ingress Controls

1. **Header Stripping:** At the API Gateway ingress, all `X-Tenant-*`, `X-Forwarded-Host` overrides, and `X-Verified-*` headers supplied by external clients are stripped immediately.
2. **Strict Hostname Verification:** Only verified domains in `tenant_domains` are routed. Any request to an unregistered hostname or IP address is terminated with `400 Bad Request`.
3. **No Header Bypasses in Production:** `X-Tenant-Domain` fallback is allowed **only** when `NODE_ENV === 'development'` AND `ALLOW_HEADER_TENANT_RESOLVER === 'true'`. In all other environments, it is rejected.

---

## 3. Mandatory Audit Logging Architecture

Every security-sensitive operation creates an append-only entry in `audit_logs`. Application users (`school_app_user`) have `INSERT` and `SELECT` privileges only; `UPDATE` and `DELETE` privileges are strictly revoked.

### 3.1 Audit Event Taxonomy

| Event Code | Trigger Condition | Logged Metadata |
| :--- | :--- | :--- |
| `AUTH_LOGIN_SUCCESS` | User successfully authenticated | `userId`, `tenantId`, `ip`, `userAgent` |
| `AUTH_LOGIN_FAILED` | Incorrect password or unverified tenant | `attemptedEmail`, `tenantId`, `ip`, `reason` |
| `AUTH_LOGOUT` | User logged out of active session | `userId`, `sessionId`, `ip` |
| `AUTH_TOKEN_REUSE` | Revoked refresh token presented | `userId`, `familyId`, `ip` (**CRITICAL ALERT**) |
| `TENANT_CREATED` | New school organization registered | `tenantId`, `slug`, `actorUserId` |
| `TENANT_SUSPENDED` | School suspended by SuperAdmin | `tenantId`, `actorUserId`, `reason` |
| `BRANCH_CREATED` | New campus created | `branchId`, `tenantId`, `code`, `actorUserId` |
| `USER_INVITED` | Invitation sent to new school member | `email`, `role`, `tenantId`, `actorUserId` |
| `MEMBERSHIP_REVOKED` | User ejected from school | `membershipId`, `tenantId`, `actorUserId` |
| `ROLE_ASSIGNED` | Role granted to member | `membershipId`, `roleKey`, `branchId` |
| `PERMISSION_DENIED` | Authorization check failed | `userId`, `tenantId`, `requiredPermission` |

*Security Invariant: Passwords, plaintext JWTs, refresh tokens, and credit card numbers are strictly filtered and never written to audit metadata.*

---

## 4. Child Data Protection & DPDP Compliance Baseline

While student admission, parent-child linking, and academic grades are implemented in later phases, Phase 1 establishes the statutory architecture required by India's Digital Personal Data Protection (DPDP) Act of 2023:

1. **Identity Data Minimization:** User records store only attributes strictly necessary for identity verification (`full_name`, `email`, `phone`, `password_hash`).
2. **Access Auditing:** Every query accessing user or membership records is attributed to a verified actor ID and timestamp.
3. **Parental Verification Groundwork:** Database schema defines `student_guardians` mapping ready to enforce verified parental OTP authorization before student records are activated in Phase 2.
4. **Zero Third-Party Trackers:** Student and school administrative portals are designed with zero third-party advertising or behavioral tracking scripts.
5. **No False Claims:** Phase 1 alone does **not** constitute full DPDP compliance; full legal compliance requires Phase 2 (parental consent verification) and operational privacy governance.
