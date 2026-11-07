# Document 05: Role-Based Access Control (RBAC) & Scope Matrix

**Document Status:** DOCUMENTATION REVIEWED — AWAITING IMPLEMENTATION APPROVAL  
**Classification:** Authorization Architecture Specification  
**Phase:** 1 of 10 — Multi-Tenant Foundation & Identity Service  
**Date:** March 2026 (Reviewed & Corrected)  

---

## 1. Canonical Roles & Scope Definitions

Phase 1 defines seven standard canonical roles within the system. Role keys are immutable string identifiers:

```
[ Platform Scope ]
  └── SuperAdmin ──────── Platform operator (global SaaS administration & tenant governance)

[ School / Tenant Scope ]
  ├── SchoolAdmin ─────── School director / IT admin (manages school, branches, users)
  ├── Principal ───────── Campus executive (oversees campus branches and staff)
  ├── Teacher ─────────── Instructional staff (scoped to assigned campus branch)
  ├── Accountant ──────── Bursar / Finance officer (scoped to school/branch)
  ├── Student ─────────── Enrolled pupil (self-service profile & session access)
  └── Parent ──────────── Verified guardian (self-service profile & session access)
```

---

## 2. Granular Permissions: Phase 1 Scope vs. Future Phases

To maintain strict project boundaries, permissions are partitioned into **Phase 1 Implemented Permissions** and **Future Reserved Permissions**:

### 2.1 Phase 1 Implemented Permissions (Active in Phase 1)

These are the **only** permissions implemented and enforced during Phase 1:

| Permission Key | Module | Purpose / Action Authorized in Phase 1 |
| :--- | :--- | :--- |
| `tenant.read` | Tenancy | View school organization profile and settings |
| `tenant.update` | Tenancy | Update school contact details, timezone, and branding |
| `tenant.suspend` | Tenancy | Suspend a school organization (SuperAdmin only) |
| `branch.create` | Campuses | Provision a new campus branch |
| `branch.read` | Campuses | View authorized campus profiles and addresses |
| `branch.update` | Campuses | Modify campus metadata and configurations |
| `branch.delete` | Campuses | Deactivate or archive a campus branch |
| `user.create` | Identity | Register new platform identity accounts |
| `user.read` | Identity | View user profiles and login histories |
| `user.update` | Identity | Edit personal profile information |
| `user.disable` | Identity | Lock or deactivate platform accounts |
| `membership.invite` | Memberships | Issue email invitations to join a school |
| `membership.read` | Memberships | List active, pending, or revoked school members |
| `membership.update` | Memberships | Change membership status or branch associations |
| `membership.revoke` | Memberships | Eject a user from a school organization |
| `role.read` | RBAC | Inspect role definitions and permission mappings |
| `role.assign` | RBAC | Grant or revoke roles to school members |
| `session.read` | Security | Inspect active login sessions and devices |
| `session.revoke` | Security | Terminate specific sessions or execute logout-all |
| `audit.read` | Governance | Review immutable security and operational audit logs |

---

### 2.2 Permissions Reserved for Later Phases (Explicitly Excluded from Phase 1)

> **IMPORTANT SCOPE BOUNDARY:** The following permissions are **NOT** implemented in Phase 1. They belong strictly to future phases and will be introduced alongside their respective domain services:

* **Student & Guardian Module (Phase 2):** `student.create`, `student.read`, `student.update`, `student.archive`, `guardian.link`, `guardian.verify`.
* **Academic & Curriculum Module (Phase 3):** `class.create`, `section.manage`, `subject.assign`, `timetable.edit`, `curriculum.read`.
* **Attendance Module (Phase 4):** `attendance.mark`, `attendance.read`, `attendance.lock`, `attendance.report`.
* **Examination Module (Phase 5):** `exam.create`, `grade.submit`, `grade.publish`, `reportcard.generate`.
* **Finance & Fee Module (Phase 6):** `fee.structure.create`, `invoice.generate`, `fee.collect`, `payment.reconcile`, `refund.process`.
* **Operations & Transport Module (Phase 8):** `transport.route.manage`, `bus.track`, `notification.broadcast`.

---

## 3. Phase 1 Role-Permission Allocation Matrix

This matrix governs authorization strictly for Phase 1 APIs:

| Permission Key | SuperAdmin | SchoolAdmin | Principal | Teacher | Student | Parent | Accountant |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `tenant.read` |  |  |  |  |  |  |  |
| `tenant.update` |  |  |  |  |  |  |  |
| `tenant.suspend` |  |  |  |  |  |  |  |
| `branch.create` |  |  |  |  |  |  |  |
| `branch.read` |  |  |  | (Branch) | (Branch) | (Branch) | (Branch) |
| `branch.update` |  |  | (Branch) |  |  |  |  |
| `branch.delete` |  |  |  |  |  |  |  |
| `user.create` |  |  |  |  |  |  |  |
| `user.read` |  |  | (Branch) |  |  |  |  |
| `user.update` |  | (Self) | (Self) | (Self) | (Self) | (Self) | (Self) |
| `user.disable` |  |  |  |  |  |  |  |
| `membership.invite` |  |  |  |  |  |  |  |
| `membership.read` |  |  | (Branch) | (Branch) |  |  |  |
| `membership.update` |  |  |  |  |  |  |  |
| `membership.revoke` |  |  |  |  |  |  |  |
| `role.read` |  |  |  |  |  |  |  |
| `role.assign` |  |  |  |  |  |  |  |
| `session.read` | (Platform) | (Tenant) | (Branch) | (Self) | (Self) | (Self) | (Self) |
| `session.revoke` | (Platform) | (Tenant) | (Branch) | (Self) | (Self) | (Self) | (Self) |
| `audit.read` | (Platform) | (Tenant) | (Branch) |  |  |  |  |

### Clarifications on Non-Admin Roles in Phase 1:
* In Phase 1, users holding roles `Teacher`, `Student`, `Parent`, and `Accountant` have access **only** to self-service identity capabilities:
  * Viewing their assigned campus branch details (`branch.read`).
  * Updating their own personal profile data (`user.update` on self).
  * Inspecting and revoking their own active login sessions (`session.read`, `session.revoke` on self).
* They **cannot** access student gradebooks, attendance logs, invoices, or academic curricula, because those endpoints and databases do not exist in Phase 1.

---

## 4. Server-Side Authorization Middleware Architecture

Authorization is strictly evaluated on the server. Client-supplied role claims are never trusted blindly:

```javascript
// Middleware: requirePermission('branch.create')
function requirePermission(permissionKey) {
  return async (req, res, next) => {
    try {
      if (!req.user || !req.membership) {
        return res.status(401).json({ 
          success: false, 
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' } 
        });
      }

      // 1. SuperAdmin bypasses school permissions for platform management
      if (req.membership.isSuperAdmin) {
        return next();
      }

      // 2. Query verified permissions from database or signed context
      const hasPerm = req.membership.permissions.includes(permissionKey);
      if (!hasPerm) {
        req.log.warn('permission_denied', { 
          userId: req.user.id, 
          tenantId: req.tenantId, 
          permission: permissionKey 
        });
        return res.status(403).json({ 
          success: false, 
          error: { code: 'FORBIDDEN', message: `Missing required permission: ${permissionKey}` } 
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
```
