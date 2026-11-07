# Document 09: SIS RESTful API Specification & Contracts

**Document Status:** DESIGN SPECIFICATION — REVISED  
**Classification:** API Architecture & Service Contracts  
**Database Topology:** Database `auth_db` | Schema `sis` (Cross-schema FKs to `public`)  
**Phase:** 2 of 10 — Student Information System (SIS)  
**Date:** March 2026  
**Author:** Principal API Architect & Integration Engineer  
**Gateway Ingress Prefix:** `/api/v1/sis/*` $\rightarrow$ Forwarded to `student-records-service` (`http://127.0.0.1:4002`)  

---

## 1. Global API Standards & Envelope Conventions

All Phase 2 SIS endpoints adhere strictly to the JSON response envelope established in Phase 1:

### Standard Success Envelope (`2xx`):
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "request_id": "8f2a1b9c-4d3e-4f5a-8b1c-9d0e1f2a3b4c",
    "timestamp": "2026-03-15T10:30:00.000Z"
  }
}
```

### Standard Error Envelope (`4xx` / `5xx`):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid date of birth: student must be at least 3 years of age on admission date",
    "details": [
      { "field": "date_of_birth", "issue": "Minimum age threshold violated" }
    ]
  },
  "meta": {
    "request_id": "8f2a1b9c-4d3e-4f5a-8b1c-9d0e1f2a3b4c",
    "timestamp": "2026-03-15T10:30:00.000Z"
  }
}
```

---

## 2. Ingress & Authentication Pipeline

```
[ Inbound Client Request ]
           │
           ▼
[ API Gateway (:8080) ]
- URL: /api/v1/sis/students
- Case-insensitively strips client `X-Verified-*` and `X-Gateway-Secret`
- Resolves tenant from Host header (e.g., apex.example)
- Injects internal HMAC `X-Gateway-Secret`
           │
           ▼
[ student-records-service (:4002) ]
- Verifies internal `X-Gateway-Secret`
- Validates RS256 JWT `Authorization: Bearer <token>`
- Extracts claims: sub (User UUID), tenant_id, branch_id, roles
- Initializes PostgreSQL RLS session:
    SET LOCAL app.current_tenant_id = $1;
    SET LOCAL app.current_branch_id = $2;
```

---

## 3. Student Demographic Endpoints (`/api/v1/sis/students`)

### 3.1 `POST /api/v1/sis/students` — Create Base Student Profile
- **Permissions Required:** `sis.student.create` (`SchoolAdmin`, `Principal`)
- **Request Headers:**
  - `Authorization: Bearer <JWT>`
- **Request Body:**
```json
{
  "branchId": "11111111-1111-1111-1111-111111111111",
  "firstName": "Aarav",
  "middleName": "Kumar",
  "lastName": "Patel",
  "preferredName": "Aarav",
  "dateOfBirth": "2018-05-14",
  "gender": "male",
  "nationality": "Indian",
  "motherTongue": "Telugu",
  "residentialAddress": {
    "line1": "Plot 42, Jubilee Hills",
    "city": "Hyderabad",
    "state": "Telangana",
    "postalCode": "500033",
    "country": "India"
  },
  "admissionDate": "2026-06-01",
  "previousSchoolName": "Little Stars Pre-School",
  "voluntaryNationalId": "987654321098"
}
```
*Note on National ID:* Voluntary under Puttaswamy judgment. The backend computes salted SHA-256 hash and stores only the last 4 digits (`1098`). Plaintext is immediately discarded from memory.

- **Response (`201 Created`):**
```json
{
  "success": true,
  "data": {
    "student": {
      "id": "77777777-7777-7777-7777-777777777777",
      "tenantId": "33333333-3333-3333-3333-333333333333",
      "branchId": "11111111-1111-1111-1111-111111111111",
      "admissionNumber": "APX-BR1-2026-0042",
      "firstName": "Aarav",
      "lastName": "Patel",
      "status": "admitted",
      "hasNationalId": true,
      "nationalIdLast4": "1098",
      "admissionDate": "2026-06-01",
      "createdAt": "2026-03-15T10:30:00.000Z"
    }
  }
}
```

---

### 3.2 `GET /api/v1/sis/students/:id` — Get Student Profile
- **Permissions Required:** `sis.student.read.basic` / `sis.student.read.full`
- **Security Guarantee:** Returns **strictly demographic information**. Health history, clinical notes, and safeguarding records are omitted unconditionally.
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "student": {
      "id": "77777777-7777-7777-7777-777777777777",
      "admissionNumber": "APX-BR1-2026-0042",
      "firstName": "Aarav",
      "lastName": "Patel",
      "dateOfBirth": "2018-05-14",
      "gender": "male",
      "status": "active",
      "hasEmergencyAllergyAlert": true,
      "guardians": [
        {
          "id": "88888888-8888-8888-8888-888888888888",
          "name": "Rajesh Patel",
          "relationship": "father",
          "phone": "+91 98765 43210",
          "isPrimary": true,
          "canAccessRecords": true
        }
      ],
      "activeEnrollment": {
        "academicYear": "2026–2027",
        "className": "Grade 3",
        "sectionName": "A",
        "rollNumber": 14
      }
    }
  }
}
```

---

## 4. Segregated Sensitive Health & Safeguarding Endpoints

### 4.1 `GET /api/v1/sis/students/:id/health` — Retrieve Medical Profile
- **Permissions Required:** `sis.health.read` (`SchoolAdmin`, `MedicalStaff`, `CampusNurse`)
- **Mandatory Header:** `X-Access-Reason: <justification>` (logged to audit trail)
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "healthRecord": {
      "studentId": "77777777-7777-7777-7777-777777777777",
      "bloodGroup": "B+",
      "primaryDoctorName": "Dr. S. Rao",
      "primaryDoctorPhone": "+91 98480 12345",
      "allergies": [
        { "allergen": "Peanuts", "severity": "severe", "reaction": "Anaphylaxis" }
      ],
      "chronicConditions": ["Asthma"],
      "emergencyActionPlan": "Administer Epipen stored in campus dispensary cabinet 3B",
      "lastUpdated": "2026-01-10T08:00:00.000Z"
    }
  }
}
```

---

### 4.2 `GET /api/v1/sis/students/:id/safeguarding` — Child Protection File
- **Permissions Required:** `sis.safeguarding.read` (`SchoolAdmin`, `Principal`, `DesignatedSafeguardingLead`)
- **Mandatory Header:** `X-Access-Reason: <justification>`
- **Response (`200 OK`):**
```json
{
  "success": true,
  "data": {
    "safeguardingRecord": {
      "studentId": "77777777-7777-7777-7777-777777777777",
      "protectionTier": "tier_2_monitored",
      "hasLegalRestraints": true,
      "courtOrderSummary": "Family Court Order FC/2025/104: Father prohibited from pickup without written maternal clearance.",
      "leadOfficerName": "Ms. Sunita Sharma (CPO)",
      "confidentialNotesCount": 3
    }
  }
}
```

---

## 5. Guardian Management & DPDP Consent Endpoints

### 5.1 `POST /api/v1/sis/students/:id/guardians` — Link Guardian with Granular Scopes
- **Permissions Required:** `sis.guardian.link` (`SchoolAdmin`, `Principal`)
- **Request Body:**
```json
{
  "guardianId": "88888888-8888-8888-8888-888888888888",
  "relationship": "father",
  "isPrimary": true,
  "emergencyPriority": 1,
  "canAccessRecords": true,
  "canConsentMedical": true,
  "canConsentExcursions": true,
  "canSignWithdrawal": true,
  "accessStatus": "active"
}
```
- **Response (`201 Created`):** Returns linked relationship record.

---

### 5.2 `POST /api/v1/sis/students/:id/consents` — Record DPDP Section 9 Consent
- **Permissions Required:** `sis.consent.record` (`SchoolAdmin`, `Registrar`, `Parent`)
- **Request Body:**
```json
{
  "guardianId": "88888888-8888-8888-8888-888888888888",
  "consentType": "minor_data_processing",
  "purposes": ["academic_records", "attendance_tracking", "examination_grading"],
  "consentMechanism": "digital_portal_checkbox",
  "ipAddress": "192.168.1.105"
}
```
- **Response (`201 Created`):** Returns consent transaction record.

---

## 6. Admissions Pipeline & Concurrency-Safe Approval

### 6.1 `POST /api/v1/sis/admissions/applications` — Submit Candidate Application
- **Permissions Required:** Public / Front Desk (`sis.admission.apply`)
- **Request Body:** Candidate demographics, target grade, guardian details.
- **Response (`201 Created`):** Returns application object with generated reference `APP-2026-9A4B`.

---

### 6.2 `POST /api/v1/sis/admissions/applications/:id/approve` — Atomic Matriculation
- **Permissions Required:** `sis.admission.approve` (`SchoolAdmin`, `Principal`)
- **Request Body:**
```json
{
  "targetSectionId": "44444444-4444-4444-4444-444444444444",
  "assignedRollNumber": 31,
  "admissionDate": "2026-06-01",
  "notes": "Entrance assessment cleared; verification documents verified."
}
```
- **Execution:** Atomic PostgreSQL transaction:
  1. Row lock on `sis.admission_number_sequences`.
  2. Generates next sequential admission number (`APX-BR1-2026-0043`).
  3. Inserts into `sis.students`.
  4. Links guardian in `sis.guardians` / `sis.student_guardians`.
  5. Inserts active section enrollment into `sis.student_enrollments`.
  6. Updates application status to `'enrolled'`.
  7. Commits transaction and writes audit log.
- **Response (`201 Created`):** Returns matriculated `studentId`, `admissionNumber`, and `enrollmentId`.
