# Document 02: API Endpoint and Database Mapping Matrix

**Document Status:** TECHNICAL SPECIFICATION — APPROVED BASELINE  
**Classification:** API Specification & Relational Persistence Traceability  
**Scope:** All 33 Modules across Release 1 (Core Operations) and Release 2 (Daily School Experience)  
**Date:** March 2026  
**Author:** Principal Enterprise Systems Architect & Lead API Engineer  

---

## 1. Overview & Standard Architectural Conventions

Every operational module in SchoolEMS maps directly to an explicit HTTP API endpoint and physical database tables. To ensure system reliability and fail-closed security, all endpoints follow unified architectural conventions:

1. **Ingress Route Namespace:**
   - Identity & Platform operations: `/api/v1/auth/*`, `/api/v1/tenants/*`, `/api/v1/branches/*`, `/api/v1/memberships/*`, `/api/v1/sessions/*` (routed by Gateway to `auth-service` on port `4001`).
   - Academic, Student, Attendance, Timetable, Fee & Leave operations: `/api/v1/sis/*` (routed by Gateway to `student-records-service` on port `4002`).
2. **Context Resolution:**
   - `tenant_id` is cryptographically extracted from the verified RS256 JWT `claims.tenant_id`.
   - `branch_id` is extracted from `claims.branch_id` or validated against `public.branches` where `tenant_id = claims.tenant_id`.
3. **Database Transaction Pattern:**
   - Multi-table writes execute inside `withTenantContext(pool, tenant_id, async (client) => { ... })` within an atomic `BEGIN ... COMMIT` block.
   - Financial allocations and attendance updates utilize `FOR UPDATE` row locks to prevent race conditions.
4. **Standard Response Envelope:**
   ```json
   {
     "success": true,
     "data": {},
     "meta": { "request_id": "req_...", "timestamp": "2026-03-01T08:00:00.000Z" }
   }
   ```
5. **Standard Error Envelope:**
   ```json
   {
     "success": false,
     "error": { "code": "VALIDATION_ERROR", "message": "Detailed description" },
     "meta": { "request_id": "req_...", "timestamp": "2026-03-01T08:00:00.000Z" }
   }
   ```

---

## 2. Release 1: Core Operations Mapping (Modules 1–21)

| Mod # | Module Name | HTTP Method & Path | Required Role | Service | Tables Read | Tables Written | Tx Req | Failure Modes & Error Codes |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **01** | School Onboarding & Setup | `POST /api/v1/tenants` | SuperAdmin | `auth-service` | `tenants`, `tenant_domains` | `tenants`, `tenant_domains`, `branches` | ACID | `400` Slug conflict (`SLUG_TAKEN`), `400` Domain in use (`DOMAIN_EXISTS`). |
| **02** | Branch / Campus Management | `POST /api/v1/branches` | SchoolAdmin | `auth-service` | `branches` | `branches`, `audit_logs` | ACID | `400` Duplicate code (`BRANCH_CODE_EXISTS`), `403` Cross-tenant attempt. |
| **03** | Authentication & Sessions | `POST /api/v1/auth/login` | Public | `auth-service` | `users`, `user_tenant_memberships`, `membership_roles`, `roles` | `refresh_tokens`, `audit_logs` | ACID | `401` Bad credentials (`INVALID_CREDENTIALS`), `429` Rate limit (`RATE_LIMIT_EXCEEDED`). |
| **04** | Role-Based Delegation (RBAC) | `POST /api/v1/memberships/:id/roles` | SchoolAdmin | `auth-service` | `roles`, `user_tenant_memberships` | `membership_roles`, `audit_logs` | ACID | `404` Membership missing, `403` Cannot escalate above own role. |
| **05** | User Invitation & Management | `POST /api/v1/memberships/invite` | SchoolAdmin | `auth-service` | `users`, `user_tenant_memberships` | `users`, `user_tenant_memberships`, `membership_roles` | ACID | `400` Email already member, `400` Invalid email format. |
| **06** | Frontend Auth & Role Context | `GET /api/v1/auth/me` | Authenticated | `auth-service` | `users`, `user_tenant_memberships`, `roles`, `branches` | None (Read-only) | None | `401` Token expired / revoked (`SESSION_EXPIRED`). |
| **07** | Academic Year & Term Setup | `POST /api/v1/sis/academic-years` | SchoolAdmin | `student-records` | `sis.academic_years` | `sis.academic_years`, `sis.academic_terms` | ACID | `400` Date collision, `400` Duplicate year code (`CODE_EXISTS`). |
| **08** | Classes & Sections Mgmt | `POST /api/v1/sis/classes` | Principal | `student-records` | `sis.classes`, `branches` | `sis.classes`, `sis.sections` | ACID | `400` Duplicate class name, `403` Branch mismatch. |
| **09** | Student Admission & Demographics | `POST /api/v1/sis/admissions/enroll` | Principal | `student-records` | `sis.admission_applications`, `sis.classes`, `sis.sections` | `sis.students`, `sis.student_enrollments`, `sis.admission_number_sequences` | ACID | `400` Section at capacity (`SECTION_FULL`), `409` Duplicate Aadhaar hash (`STUDENT_EXISTS`). |
| **10** | Student Photographs (OD-05) | `POST /api/v1/sis/students/:id/photo` | Principal, Admin | `student-records` | `sis.students` | `sis.student_photos`, Filesystem | ACID | `400` File > 2MB (`FILE_TOO_LARGE`), `400` Non-image MIME (`INVALID_FILE_TYPE`). |
| **11** | Segregated Health Records | `PUT /api/v1/sis/students/:id/health` | Principal, Admin | `student-records` | `sis.students` | `sis.student_health_records` | Single | `403` Forbidden to Teachers & Accountants (`ACCESS_DENIED`). |
| **12** | Segregated Safeguarding Notes | `POST /api/v1/sis/students/:id/safeguarding`| DSL / Principal | `student-records` | `sis.students` | `sis.student_safeguarding_records`, `audit_logs` | ACID | `403` Forbidden to non-DSL staff (`CONFIDENTIAL_RESTRICTED`). |
| **13** | Guardian Network & Scoping | `POST /api/v1/sis/students/:id/guardians`| Admin, Principal | `student-records` | `sis.guardians`, `sis.students` | `sis.guardians`, `sis.student_guardians`, `sis.guardian_consents` | ACID | `400` Multiple primary guardians (`PRIMARY_GUARDIAN_EXISTS`). |
| **14** | Student Cohort Enrollment | `POST /api/v1/sis/sections/:id/enroll` | Principal | `student-records` | `sis.students`, `sis.sections` | `sis.student_enrollments` | ACID | `400` Section capacity exceeded, `409` Already enrolled in AY. |
| **15** | Subjects & Teacher Assignment | `POST /api/v1/sis/sections/:id/teachers` | Principal | `student-records` | `sis.sections`, `sis.subjects`, `public.users` | `sis.section_subject_teachers` | Single | `400` Duplicate subject assignment, `404` Teacher not in branch. |
| **16** | Daily Attendance Engine (OD-02)| `POST /api/v1/sis/attendance/sessions` | Teacher, Principal | `student-records` | `sis.sections`, `sis.student_enrollments` | `sis.attendance_sessions`, `sis.student_attendance` | ACID | `403` Teacher not assigned to section, `400` Session date locked. |
| **17** | In-App Announcements | `POST /api/v1/sis/announcements` | SchoolAdmin, Princ | `student-records` | `public.branches` | `sis.announcements`, `sis.announcement_audiences` | ACID | `400` Missing audience role, `400` Expiry date in past. |
| **18** | Role-Specific Dashboards | `GET /api/v1/sis/dashboards/:role` | Authenticated | `student-records` | `sis.students`, `sis.attendance_sessions`, `sis.fee_allocations` | None (Aggregations) | Read | `403` Role mismatch (`UNAUTHORIZED_ROLE_VIEW`). |
| **19** | Academic Calendar | `POST /api/v1/sis/calendar/events` | SchoolAdmin, Princ | `student-records` | `sis.academic_years` | `sis.academic_calendar_events` | Single | `400` Date outside academic year (`DATE_OUT_OF_BOUNDS`). |
| **20** | Student Bulk Import | `POST /api/v1/sis/imports/students` | SchoolAdmin | `student-records` | `sis.classes`, `sis.sections` | `sis.student_import_jobs`, `sis.student_import_rows` | ACID | `400` Malformed CSV headers, `422` Validation threshold failure. |
| **21** | Academic Year Rollover (OD-01) | `POST /api/v1/sis/rollover/execute` | Principal, Admin | `student-records` | `sis.student_enrollments`, `sis.sections` | `sis.student_enrollments`, `sis.academic_rollover_logs`, `sis.academic_rollover_items`, `sis.academic_years` | Top ACID | `400` Target AY not active, `400` Capacity overflow (`SECTION_OVERFLOW`). |

---

## 3. Release 2: Daily School Experience Mapping (Modules 22–33)

| Mod # | Module Name | HTTP Method & Path | Required Role | Service | Tables Read | Tables Written | Tx Req | Failure Modes & Error Codes |
| :---: | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **22** | Teacher Portal | `GET /api/v1/sis/teacher/roster` | Teacher | `student-records` | `sis.section_subject_teachers`, `sis.sections`, `sis.student_enrollments` | None (Read-only) | Read | `403` Access denied to non-teacher accounts. |
| **23** | Student Portal | `GET /api/v1/sis/student/overview` | Student | `student-records` | `sis.students`, `sis.student_enrollments`, `sis.student_attendance`, `sis.timetable_slots` | None (Read-only) | Read | `403` User ID not linked to student profile (`NO_STUDENT_PROFILE`). |
| **24** | Parent Portal / Switcher(OD-03)| `GET /api/v1/sis/parent/children` | Parent | `student-records` | `sis.guardians`, `sis.student_guardians`, `sis.students`, `sis.student_enrollments` | None (Read-only) | Read | `403` User not mapped to guardian network (`NO_GUARDIAN_RECORD`). |
| **25** | Class & Teacher Timetable | `POST /api/v1/sis/timetable/slots` | Principal | `student-records` | `sis.timetable_periods`, `sis.sections`, `sis.subjects` | `sis.timetable_slots` | ACID | `409` Teacher double-booked (`TEACHER_SCHEDULE_CONFLICT`), `409` Room clash. |
| **26** | Homework & Assignments | `POST /api/v1/sis/assignments` | Teacher | `student-records` | `sis.section_subject_teachers` | `sis.assignments`, `sis.assignment_completions` | ACID | `403` Teacher does not instruct subject for section, `400` Due date past. |
| **27** | Fee Structure Allocator | `POST /api/v1/sis/fees/structures` | SchoolAdmin, Acc | `student-records` | `sis.fee_categories`, `sis.classes` | `sis.fee_structures` | Single | `409` Structure already configured for class/category. |
| **28** | Fee Collection & Receipts | `POST /api/v1/sis/fees/payments` | Accountant | `student-records` | `sis.student_fee_allocations` (Lock) | `sis.fee_payments`, `sis.student_fee_allocations`, `sis.fee_receipt_sequences` | ACID | `400` Overpayment attempt (`AMOUNT_EXCEEDS_DUE`), `400` Invalid method. |
| **29** | Fee Concessions / Waivers(OD-04)| `POST /api/v1/sis/fees/concessions/:id/approve` | Principal | `student-records` | `sis.fee_concessions`, `sis.student_fee_allocations` (Lock) | `sis.fee_concessions`, `sis.student_fee_allocations` | ACID | `400` Concession > unpaid balance (`CONCESSION_EXCEEDS_BALANCE`). |
| **30** | Outstanding Balance Tracker | `GET /api/v1/sis/fees/outstanding` | Accountant, Admin | `student-records` | `sis.student_fee_allocations`, `sis.students`, `sis.classes` | None (Aggregate) | Read | `403` Unauthorized access (`FINANCIAL_ACCESS_RESTRICTED`). |
| **31** | Attendance & Enrolment Reports | `GET /api/v1/sis/reports/attendance` | Principal, Admin | `student-records` | `sis.student_attendance`, `sis.attendance_sessions`, `sis.student_enrollments` | None (Aggregate) | Read | `400` Invalid date range (`START_DATE_AFTER_END_DATE`). |
| **32** | Financial Fee Summaries | `GET /api/v1/sis/reports/fees/summary` | SchoolAdmin, Acc | `student-records` | `sis.student_fee_allocations`, `sis.fee_payments` | None (Aggregate) | Read | `403` Non-financial role query attempt. |
| **33** | Basic Staff Leave Management | `POST /api/v1/sis/staff-leave` | Teacher, Staff | `student-records` | `public.users` | `sis.staff_leave_requests`, `sis.staff_leave_audits` | ACID | `400` Overlapping leave request dates (`LEAVE_DATES_OVERLAP`). |

---

## 4. Cross-Cutting Failure Handling & HTTP Error Protocol

All services enforce unified HTTP status codes and deterministic error structures:

| HTTP Status | Error Scenario | Internal Application Code | System Behavior |
| :---: | :--- | :--- | :--- |
| **`400`** | Schema validation failure, invalid dates, capacity overflow | `VALIDATION_ERROR`, `SECTION_FULL` | Request rejected; zero database mutation. |
| **`401`** | Missing Bearer token, expired RS256 token, invalid signature | `UNAUTHORIZED`, `TOKEN_EXPIRED` | Gateway/Service rejects request; triggers client token refresh. |
| **`403`** | Missing role claim, cross-tenant attempt, teacher access violation | `FORBIDDEN`, `ACCESS_DENIED` | Logged to security audit; returns generic access denied message. |
| **`404`** | Student, section, or fee allocation record not found | `RESOURCE_NOT_FOUND` | Returned after RLS filtering ensures resource does not exist in tenant. |
| **`409`** | Duplicate admission number, double-booked teacher, unique index trip | `CONFLICT`, `SCHEDULE_CONFLICT` | Returns conflict field to client for inline form error highlighting. |
| **`429`** | Login rate limit exceeded (20 requests / min per IP) | `RATE_LIMIT_EXCEEDED` | Request blocked at Gateway; returns retry window seconds. |
| **`503`** | Upstream SIS service down, PostgreSQL pool connection timeout | `SERVICE_UNAVAILABLE` | Gateway returns friendly JSON indicating temporary service unavailability. |
