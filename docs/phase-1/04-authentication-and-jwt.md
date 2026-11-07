# Document 04: Authentication, Cryptographic JWT & Session Management

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Security Engineering Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Authentication Architecture & Protocol Flows

Phase 1 upgrades the platform from a symmetric, monolithic customer login to an enterprise multi-tenant authentication engine supporting asymmetric tokens, refresh rotation, and session family invalidation.

```
[ Browser / Client ]              [ Gateway ]                 [ Identity Service ]
        │                              │                              │
        │── 1. POST /api/v1/auth/login►│                              │
        │      { email, password }     │── 2. Forward with Host ─────►│
        │      Host: dps.schoolsaas.com│                              │── 3. Resolve Tenant (DPS)
        │                              │                              │── 4. Verify Password (bcrypt)
        │                              │                              │── 5. Assert Active Membership
        │                              │                              │── 6. Create Session Family
        │                              │                              │── 7. Sign RS256 Access Token
        │                              │                              │── 8. Store Hashed Refresh Token
        │                              │◄── 9. Return Tokens ─────────│
        │◄── 10. Set HttpOnly Cookie ──│
        │        & JSON Access Token   │
```

---

## 2. Password Security & Hashing Standards

* **Algorithm:** `bcrypt` via [`bcryptjs`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/package.json).
* **Cost Factor:** Work factor $12$ (balancing defense against offline brute-force attacks with sub-250ms API login response time on modern CPU cores).
* **Policy Enforcement:**
  * Minimum length: 10 characters.
  * Complexity: At least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol (`[!@#$%^&*]`).
  * Account Enumeration Prevention: All failed login attempts return a uniform error message: `{"error": "Invalid email, password, or school domain"}` with constant-time response characteristics.

---

## 3. Cryptographic Token Architecture (RS256)

### 3.1 Asymmetric Key Pair Management
* Tokens are signed using **RSA 2048-bit Private Key** (`private_key.pem`) held strictly by `school-identity-service`.
* Verification is performed across the Gateway and downstream microservices using the corresponding **Public Key** (`public_key.pem`) or via a local JSON Web Key Set endpoint (`GET /.well-known/jwks.json`).
* In development, keys are generated via `crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })` or injected via environment variables. In production, keys are stored in AWS Secrets Manager.

### 3.2 Access Token Claims Specification
```json
{
  "iss": "https://auth.schoolsaas.com",
  "aud": "schoolsaas-api",
  "sub": "7a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
  "jti": "9f8e7d6c-5b4a-3f2e-1d0c-9b8a7f6e5d4c",
  "tenant_id": "11111111-2222-3333-4444-555555555555",
  "membership_id": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "branch_id": "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  "roles": ["SchoolAdmin"],
  "iat": 1772866800,
  "exp": 1772867700
}
```
* **Lifespan:** Exactly **15 minutes** (900 seconds).

---

## 4. Refresh Token Lifecycle & Family Rotation

To provide seamless user sessions without exposing long-lived access tokens, refresh tokens utilize **Cryptographic Family Rotation**:

```
[ Client Request with Refresh Token R1 ]
       │
       ▼
[ Identity Service hashes R1 -> checks refresh_tokens table ]
       │
       ├─── CASE A: R1 is VALID and UNEXPIRED:
       │      1. Invalidate R1 (set replaced_by = R2_hash, revoked_at = now())
       │      2. Issue new Refresh Token R2 belonging to same family_id
       │      3. Issue new 15-minute Access Token
       │      4. Return R2 in secure cookie
       │
       └─── CASE B: R1 was ALREADY REVOKED (Token Reuse Detected!):
              1. ALERT: Potential token theft in progress!
              2. Immediate Revocation: Mark ALL tokens sharing family_id as REVOKED!
              3. Write high-priority event to audit_logs
              4. Terminate session with 401 Unauthorized
```

### Hash Storage Rule
The database stores strictly the **SHA-256 hash** of the refresh token:
$$\text{token\_hash} = \text{SHA256}(\text{raw\_random\_refresh\_token})$$
If the database is read or dumped, raw refresh tokens cannot be used to forge sessions.

---

## 5. Browser Session & Cookie Security

For browser single-page applications (SPAs):
1. **Refresh Token Storage:** Stored strictly in an `HttpOnly`, `Secure`, `SameSite=Strict` cookie (`path=/api/v1/auth/refresh`). JavaScript execution contexts cannot access the cookie, preventing XSS-based session extraction.
2. **Access Token Handling:** Held exclusively in JavaScript **in-memory variables** (never written to `localStorage` or `sessionStorage`).
3. **Cross-Site Request Forgery (CSRF):** Since refresh cookies use `SameSite=Strict` and CORS restricts origins, automated cross-origin state-changing submissions are blocked by modern browsers. State-changing POST endpoints require standard JSON headers.
