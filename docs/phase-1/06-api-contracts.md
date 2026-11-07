# Document 06: RESTful API Specifications & Contracts (`/api/v1`)

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** API Interface Control Document  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Global Standard Request & Response Envelopes

All Phase 1 endpoints are versioned under `/api/v1`. All JSON responses strictly adhere to the unified standard envelope containing the tracing `request_id`.

### 1.1 Success Response Schema (HTTP 200 / 201)
```json
{
  "success": true,
  "data": {
    "tenant": {
      "id": "11111111-2222-3333-4444-555555555555",
      "name": "Delhi Public School",
      "slug": "dps-delhi"
    }
  },
  "meta": {
    "request_id": "c1f8a9e2-4b5d-6e7f-8a9b-0c1d2e3f4a5b",
    "timestamp": "2026-03-01T10:00:00Z"
  }
}
```

### 1.2 Error Response Schema (HTTP 4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not authorized to perform this action.",
    "details": null
  },
  "meta": {
    "request_id": "c1f8a9e2-4b5d-6e7f-8a9b-0c1d2e3f4a5b",
    "timestamp": "2026-03-01T10:00:00Z"
  }
}
```
*Security Invariant: Internal SQL statements, database stack traces, and system configuration secrets are never returned in error details.*

---

## 2. Hardened Inbound Request Headers

All inbound requests passing through the API Gateway are subject to strict resolution rules:

* **Production Mode:**
  * Inbound `Host` header (e.g., `Host: dps-delhi.schoolsaas.com` or custom domain `Host: portal.dpsdelhi.in`) is the **sole** authoritative source for tenant resolution.
  * Inbound `X-Tenant-Domain`, `X-Tenant-Id`, and any `X-Verified-*` headers are **unconditionally stripped** at the Gateway.
* **Local Development Mode:**
  * If `NODE_ENV === 'development'` and `ALLOW_HEADER_TENANT_RESOLVER === 'true'`, the Gateway permits `X-Tenant-Domain: {slug}.schoolsaas.com` to assist local CLI / Postman / automated test runners when subdomains are difficult to route locally.

---

## 3. Authentication API Endpoints

### `POST /api/v1/auth/login`
* **Request Payload:**
  ```json
  {
    "email": "principal@dpsdelhi.in",
    "password": "SecurePassword@123"
  }
  ```
* **Process:**
  1. Resolves tenant from hostname.
  2. Verifies user password hash via `bcrypt.compare`.
  3. Verifies active membership in the resolved tenant.
  4. Issues RS256-signed Access Token (15 min lifespan).
  5. Sets rotated Refresh Token in secure `HttpOnly` cookie.
* **Response (HTTP 200):**
  * Cookie: `tp_refresh={raw_token}; Path=/api/v1/auth; SameSite=Strict; HttpOnly; Secure`
  * Body:
    ```json
    {
      "success": true,
      "data": {
        "accessToken": "eyJhbGciOiJSUzI1NiIsIn...",
        "expiresIn": 900,
        "user": {
          "id": "7a3b4c5d-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
          "email": "principal@dpsdelhi.in",
          "fullName": "Dr. R. K. Sharma"
        },
        "tenant": {
          "id": "11111111-2222-3333-4444-555555555555",
          "name": "Delhi Public School",
          "slug": "dps-delhi"
        },
        "roles": ["Principal"]
      }
    }
    ```

### `POST /api/v1/auth/refresh`
* Extracts and hashes `tp_refresh` cookie.
* Enforces family rotation; issues new access token and rotated refresh token cookie.

### `POST /api/v1/auth/logout`
* Marks current refresh token `revoked_at = now()`; clears `tp_refresh` cookie.

### `POST /api/v1/auth/logout-all`
* Marks all refresh tokens for the authenticated user as revoked; clears cookie.

---

## 4. Tenant & Branch Administration APIs

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/tenants` | `SuperAdmin` | Onboard a new school organization (generates default branch & admin invite). |
| **GET** | `/api/v1/tenants/current` | `tenant.read` | Fetch current school profile, branding, and timezone configuration. |
| **GET** | `/api/v1/tenants/:id` | `SuperAdmin` | View detailed subscription and administrative metadata. |
| **PATCH** | `/api/v1/tenants/:id` | `tenant.update` | Update school contact details, address, and operational settings. |
| **POST** | `/api/v1/tenants/:id/suspend` | `tenant.suspend` | Suspend school; immediately blocks all tenant logins and API traffic. |
| **POST** | `/api/v1/tenants/:id/activate` | `tenant.suspend` | Restore suspended school organization. |
| **POST** | `/api/v1/branches` | `branch.create` | Provision a new physical campus (e.g., North Campus). |
| **GET** | `/api/v1/branches` | `branch.read` | List all campuses belonging to the authenticated tenant. |
| **GET** | `/api/v1/branches/:id` | `branch.read` | View specific campus details (enforces tenant match). |
| **PATCH** | `/api/v1/branches/:id` | `branch.update` | Update branch code, address, or contact details. |
| **POST** | `/api/v1/branches/:id/deactivate`| `branch.delete` | Mark campus inactive. |

---

## 5. User Membership & RBAC Role Assignment APIs

| Method | Endpoint | Required Permission | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/api/v1/memberships/invite` | `membership.invite` | Send school invitation to an email address with assigned role. |
| **GET** | `/api/v1/memberships` | `membership.read` | List active, pending, or revoked members of the school. |
| **GET** | `/api/v1/memberships/:id` | `membership.read` | View member profile and assigned roles/branches. |
| **PATCH** | `/api/v1/memberships/:id` | `membership.update` | Update member status (e.g., suspend member). |
| **POST** | `/api/v1/memberships/:id/revoke` | `membership.revoke` | Eject user from the school organization. |
| **POST** | `/api/v1/memberships/:id/roles` | `role.assign` | Assign role (optionally constrained to `branch_id`). |
| **DELETE**| `/api/v1/memberships/:id/roles/:roleId` | `role.assign` | Remove assigned role from member. |

---

## 6. Active Session Management APIs

| Method | Endpoint | Access Rule | Description |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/sessions` | Authenticated | List all active sessions (IP, User Agent, Last Active) for current user. |
| **DELETE**| `/api/v1/sessions/:id` | `session.revoke` | Revoke a specific session ID (cannot revoke other users' sessions). |
| **DELETE**| `/api/v1/sessions` | Authenticated | Revoke all sessions across all devices except current. |
