# Document 07: SIS Role-Based Access Control (RBAC) & Permissions Matrix

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** Authorization Engineering & Access Policy  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal Security Architect & Identity Lead  

---

## 1. Domain Authorization Principles

In an educational enterprise, granting blanket read or write access to administrative or academic staff violates data minimization mandates and creates catastrophic privacy risks for minors.

The Student Information System enforces five cardinal authorization principles:
1. **Separation of Operational Duties:** An Accountant requires student fee schedules and billing contacts to collect tuition, but has **no legitimate need or authorization** to view confidential psychological evaluations, child protection flags, or medical histories.
2. **Physical & Logical Classroom Scoping:** A Grade 4 Teacher needs full visibility into their assigned section's active attendance and grading roster, but must not browse student disciplinary records, safeguarding alerts, or transcripts of unrelated secondary school classes.
3. **Segregated Sensitive Records:** Physical health records and child safeguarding notes reside in separate tables (`sis.student_health_records` and `sis.student_safeguarding_records`) with distinct, high-privilege permission keys. General student read permission grants **zero access** to these tables.
4. **Branch Purview Boundaries:** Campus Principals and Registrars are strictly bound to their assigned branch (`branch_id`). They cannot view, admit, or modify student records belonging to sibling campuses. Trust-level administrators (`SchoolAdmin`) hold institutional purview across all branches.
5. **Child-Specific Guardian Scoping:** A parent or guardian is granted access strictly to their own linked children via active records in `sis.student_guardians`. Linking to Child A never confers access to Child B.

---

## 2. Granular Permission Key Taxonomy

Phase 2 organizes permissions into a structured, dot-delimited namespace adhering to the format `sis.<domain>.<action>[.<scope>]`:

| Permission Key | Description | Risk Tier | Authorized Roles |
| :--- | :--- | :---: | :--- |
| `sis.student.read.basic` | View basic student identity (name, roll no, active section, profile photo). | Low | SchoolAdmin, Principal, Registrar, Teacher, Accountant |
| `sis.student.read.full` | View complete demographic profile, prior schooling, and addresses. | Medium | SchoolAdmin, Principal, Registrar |
| `sis.student.create` | Manually register a student or convert an approved admission application. | High | SchoolAdmin, Principal, Registrar |
| `sis.student.update` | Edit student demographic details, contact info, and home addresses. | Medium | SchoolAdmin, Principal, Registrar |
| `sis.student.delete` | Soft-archive or permanently delete a student profile (audit locked). | **Critical** | SchoolAdmin (Override Only) |
| `sis.health.read` | View comprehensive student medical history, physician reports, and vaccinations. | **High** | SchoolAdmin, Medical Officer, Campus Nurse |
| `sis.health.update` | Log health checkups, prescription notes, and emergency medical directives. | **High** | SchoolAdmin, Medical Officer, Campus Nurse |
| `sis.health.view_allergies`| View high-level allergy alerts and emergency action protocols (no medical history).| Medium | Principal, Assigned Class Teacher |
| `sis.safeguarding.read` | View child protection alerts, social worker reports, and court orders. | **Critical** | SchoolAdmin, Principal, Designated Safeguarding Lead (DSL) |
| `sis.safeguarding.update`| Log child protection observations, legal decrees, and welfare flags. | **Critical** | SchoolAdmin, Principal, Designated Safeguarding Lead (DSL) |
| `sis.guardian.read` | View linked guardian names, authorized contact phones, and pickup status. | Medium | SchoolAdmin, Principal, Registrar, Teacher (Emergency Only) |
| `sis.guardian.link` | Associate or dissociate a guardian with a student; assign legal permissions. | High | SchoolAdmin, Principal, Registrar |
| `sis.consent.record` | Record DPDP Act Section 9 minor processing consent from parent. | High | SchoolAdmin, Registrar, Parent (Self-Serve) |
| `sis.consent.revoke` | Revoke digital processing consent or voluntary token processing. | High | SchoolAdmin, Parent (Self-Serve) |
| `sis.admission.apply` | Submit an admission application for a prospective candidate. | Low | Public, Registrar, Parent |
| `sis.admission.review` | Verify uploaded documents, record interview marks, flag duplicates. | Medium | SchoolAdmin, Principal, Registrar |
| `sis.admission.approve` | Formally grant admission offer and execute seat allotment. | **High** | SchoolAdmin, Principal |
| `sis.enrollment.assign` | Place student into an academic class and section. | High | SchoolAdmin, Principal, Registrar |
| `sis.enrollment.transfer`| Transfer student between sections or initiate inter-branch relocation. | High | SchoolAdmin, Principal (Branch Scope) |
| `sis.enrollment.promote` | Execute bulk year-end academic promotions and grade advancement. | **High** | SchoolAdmin, Principal |
| `sis.documents.upload` | Upload supporting student documents (birth certificates, marks cards). | Medium | SchoolAdmin, Principal, Registrar, Parent |
| `sis.documents.view` | View and download attached identity and legal documents. | High | SchoolAdmin, Principal, Registrar |
| `sis.documents.verify` | Validate authenticity of submitted verification documents. | High | SchoolAdmin, Principal, Registrar |

---

## 3. Comprehensive Role-Permission Matrix

The following matrix maps canonical platform and tenant roles to Phase 2 SIS permissions:

| Permission Key | SuperAdmin | SchoolAdmin | Principal | Registrar | Teacher | Medical Staff | Parent | Student |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Purview Scope** | *Global* | *Full Tenant* | *Branch* | *Branch* | *Section* | *Campus* | *Children* | *Self* |
| `sis.student.read.basic` | Audit Log | ✅ | ✅ | ✅ | ✅ (Roster) | ✅ | ✅ | ✅ |
| `sis.student.read.full` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `sis.student.create` | Break-Glass | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sis.student.update` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ (Contact)| ❌ |
| `sis.student.delete` | ❌ | ⚠️ (Special) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `sis.health.read` | ❌ | ✅ (Audit) | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `sis.health.update` | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `sis.health.view_allergies`| ❌ | ✅ | ✅ | ❌ | ✅ (Assigned)| ✅ | ✅ | ✅ |
| `sis.safeguarding.read` | ❌ | ✅ (Audit) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `sis.safeguarding.update`| ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `sis.guardian.read` | ❌ | ✅ | ✅ | ✅ | ⚠️ (Emerg.) | ✅ (Emerg.) | ✅ | ❌ |
| `sis.guardian.link` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sis.consent.record` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `sis.consent.revoke` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `sis.admission.apply` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (Portal) | ❌ |
| `sis.admission.review` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sis.admission.approve` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `sis.enrollment.assign` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `sis.enrollment.transfer`| ❌ | ✅ | ✅ | ⚠️ (Draft) | ❌ | ❌ | ❌ | ❌ |
| `sis.enrollment.promote` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `sis.documents.upload` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ (Intake) | ❌ |
| `sis.documents.view` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `sis.documents.verify` | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ **Allowed:** Permitted within actor's purview scope.
- ❌ **Denied:** Strictly prohibited; returns `403 FORBIDDEN`.
- ⚠️ **Conditional / Scoped:**
  - *Teacher (`guardian.read`):* Limited strictly to Primary Guardian Name and Emergency Phone Number for active roster students.
  - *Teacher (`health.view_allergies`):* Limited strictly to dietary and emergency medical alert flags (no general medical history).
  - *Parent (`student.update`):* Parents can submit address and phone correction requests; changes require administrative approval.
  - *Registrar (`enrollment.transfer`):* Can initiate and submit a transfer clearance request; only the Principal or SchoolAdmin can execute final approval.

---

## 4. Contextual Authorization Scope Guards

In addition to static RBAC role checks, SchoolEMS enforces three dynamic context guards in middleware:

### 4.1 Branch Scope Guard (`requireBranchScope`)
Guarantees that campus-level administrators (Principals, Registrars) cannot access records belonging to another branch:
```javascript
function requireBranchScope(targetBranchParam = 'branchId') {
  return (req, res, next) => {
    // SchoolAdmin holds tenant-wide purview across all branches
    if (req.user.roles.includes('SchoolAdmin')) {
      return next();
    }

    const actorBranchId = req.user.branch_id;
    const requestedBranchId = req.params[targetBranchParam] || req.body[targetBranchParam] || req.query[targetBranchParam];

    if (!actorBranchId || !requestedBranchId || actorBranchId !== requestedBranchId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'BRANCH_SCOPE_VIOLATION',
          message: 'Access denied: You are not authorized to access records outside your assigned campus branch',
        },
      });
    }

    return next();
  };
}
```

### 4.2 Classroom Teacher Roster Guard (`requireTeacherSectionScope`)
Validates that an authenticated teacher is actively assigned to the requested section:
1. Queries `sis.sections` where `id = :sectionId` and `academic_year_id = :activeYearId`.
2. Validates that `class_teacher_id = req.user.sub` or an active entry exists in `sis.section_subject_teachers`.
3. If unassigned, access is rejected with `403 FORBIDDEN` (`Teacher not assigned to requested section`).

### 4.3 Child-Specific Guardian Guard (`requireGuardianChildScope`)
Validates that a parent user has an active, unrevoked guardianship over the specific child:
1. Resolves `sis.guardians` record matching `user_id = req.user.sub`.
2. Queries `sis.student_guardians` where `student_id = :studentId AND guardian_id = :guardianId`.
3. Asserts `access_status = 'active'` and `can_access_records = true`.
4. If `access_status = 'court_restricted'` or no link exists, returns `403 FORBIDDEN`.

---

## 5. Security Audit Logging for Sensitive Record Access

Viewing sensitive health or child protection files requires mandatory audit logging. The application issues an asynchronous audit event upon successful access:

```sql
INSERT INTO sis.audit_logs (
  tenant_id,
  actor_user_id,
  actor_role,
  action,
  target_entity,
  target_entity_id,
  access_reason,
  ip_address,
  created_at
) VALUES (
  :tenant_id,
  :actor_user_id,
  :actor_role,
  'sis.safeguarding.accessed',
  'student_safeguarding_records',
  :record_id,
  :access_reason,
  :client_ip,
  now()
);
```

- Any attempt to view a safeguarding or medical record without supplying an `X-Access-Reason` header returns `400 BAD REQUEST` (`Mandatory access justification required for sensitive child records`).
