# Document 04: Authentication, Cryptographic JWT & Session Management

**Document Status:** PHASE 1 IMPLEMENTATION PLAN CORRECTED — READY FOR DEVELOPMENT IMPLEMENTATION  
**Classification:** Security Engineering Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Final Security Corrections Applied)  

---

## 1. Authentication Architecture & Protocol Flows

Phase 1 establishes an enterprise multi-tenant authentication engine supporting asymmetric tokens, cryptographic refresh rotation, and absolute algorithm isolation from legacy e-commerce tokens.

```
[ Browser / Client ]              [ Gateway ]                 [ Identity Service ]
        │                              │                              │
        │── 1. POST /api/v1/auth/login►│                              │
        │      { email, password }     │── 2. Forward with Host ─────►│
        │      Host: apex.schoolsaas...│                              │── 3. Resolve Tenant (Apex)
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

## 2. Cryptographic JWT Isolation & Validation Standards

### 2.1 Complete Segregation of Legacy vs. School Authentication
To prevent privilege escalation or confusion attacks, the platform enforces strict algorithm and issuer segregation:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            TOKEN ISOLATION BOUNDARY                              │
└──────────────────────────────────────────────────────────────────────────────────┘

[ LEGACY E-COMMERCE TOKEN (Untrusted on School APIs) ]
  ├── Algorithm: HS256 (Symmetric HMAC)
  ├── Issuer:    "telugu-pickles-auth"
  ├── Claims:    { sub: user_id, email, name }
  └── REJECTION: Gateway and Identity Service REJECT HS256 on all /api/v1/* routes.

[ SCHOOL PLATFORM TOKEN (Authoritative on School APIs) ]
  ├── Algorithm: RS256 (Asymmetric RSA 2048-bit Private Key)
  ├── Key ID:    kid = "school-auth-2026-v1"
  ├── Issuer:    "https://auth.schoolsaas.com"
  ├── Audience:  "schoolsaas-api"
  ├── Claims:    { sub, jti, tenant_id, membership_id, branch_id, roles, iat, exp }
  └── ACCEPTANCE: Accepted strictly on /api/v1/* after full cryptographic validation.
```

### 2.2 Verification Rules
Any request to `/api/v1/*` must pass these verification checks in order:
1. **Algorithm Check:** Header `alg` must be strictly `RS256`. Any token with `HS256`, `none`, or unexpected algorithms is immediately rejected with `401 Unauthorized`.
2. **Issuer & Audience Check:** `iss` must match `https://auth.schoolsaas.com` and `aud` must match `schoolsaas-api`.
3. **Key ID (`kid`):** Token `kid` is verified against the public key catalog.
4. **Tenant Match:** `token.claims.tenant_id` must match the tenant ID resolved from the request hostname. If there is a mismatch, the request is terminated with `403 Forbidden: Tenant Cross-Talk Blocked`.

---

## 3. Password Security & Hashing Standards

* **Algorithm:** `bcrypt` via [`bcryptjs`](file:///c:/Users/bantu/Desktop/JuneAWSAIOpsProj-main/projects/telugu-pickles/services/package.json).
* **Cost Factor:** Work factor $12$ (balancing defense against offline brute-force attacks with sub-250ms API login response time on modern CPU cores).
* **Policy Enforcement:**
  * Minimum length: 10 characters.
  * Complexity: At least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol (`[!@#$%^&*]`).
  * Account Enumeration Prevention: All failed login attempts return a uniform error message: `{"error": "Invalid email, password, or school domain"}` with constant-time response characteristics.

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
