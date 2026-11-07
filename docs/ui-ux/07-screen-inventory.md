# Document 07: Master Screen Inventory & MVP Release Matrix

**Document Status:** APPROVED SCREEN INVENTORY SPECIFICATION  
**Classification:** Enterprise UX Architecture & Product Scope Catalog  
**System:** SchoolEMS (Multi-Tenant School Management SaaS)  
**Date:** March 2026  
**Author:** Product Design & Architecture Team  

---

## 1. Executive Summary & Inventory Classification

To maintain alignment with the approved **Stage 1 MVP Scope** and prevent scope creep, every screen in SchoolEMS is indexed with a unique Screen ID, route, permitted roles, release milestone, and implementation state.

### Implementation Status Key:
- **[Existing]**: Backend endpoint or basic frontend component exists and is reusable.
- **[Partial]**: Core backend or basic UI structure exists; requires wiring or styling.
- **[Missing]**: Planned for the designated release; specification complete, awaiting development.
- **[Future]**: Deferred beyond Stage 1 MVP; cataloged for architectural reference only.

---

## 2. Platform Administration Module (SuperAdmin)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 PLATFORM ADMINISTRATION SCREENS                                        │
├────────────┬─────────────────────────────┬──────────────────────────┬──────────────┬───────────────────┤
│ Screen ID  │ Screen Name                 │ Route                    │ Release      │ Status            │
├────────────┼─────────────────────────────┼──────────────────────────┼──────────────┼───────────────────┤
│ SCR-PLT-01 │ Platform Dashboard          │ `/platform/dashboard`    │ Stage 1 R1   │ [Partial]         │
│ SCR-PLT-02 │ Master School Directory     │ `/platform/schools`      │ Stage 1 R1   │ [Existing] (API)  │
│ SCR-PLT-03 │ Onboard New School Dialog   │ `/platform/schools/new`  │ Stage 1 R1   │ [Existing] (API)  │
│ SCR-PLT-04 │ School Tenant Detail View   │ `/platform/schools/:id`  │ Stage 1 R1   │ [Missing] (UI)    │
│ SCR-PLT-05 │ Platform Security Audit Log │ `/platform/audit-logs`   │ Stage 1 R1   │ [Existing] (API)  │
└────────────┴─────────────────────────────┴──────────────────────────┴──────────────┴───────────────────┘
```

---

## 3. School Administration & Operations Module (SchoolAdmin & Principal)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              SCHOOL ADMINISTRATION & OPERATIONS SCREENS                                │
├────────────┬─────────────────────────────┬──────────────────────────┬──────────────┬───────────────────┤
│ Screen ID  │ Screen Name                 │ Route                    │ Release      │ Status            │
├────────────┼─────────────────────────────┼──────────────────────────┼──────────────┼───────────────────┤
│ SCR-ADM-01 │ School Operations Dashboard │ `/admin/dashboard`       │ Stage 1 R1   │ [Partial]         │
│ SCR-ADM-02 │ Campus Branch Manager       │ `/admin/branches`        │ Stage 1 R1   │ [Existing] (API)  │
│ SCR-ADM-03 │ Academic Sessions & Terms   │ `/admin/academic-years`  │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-04 │ Classes & Sections Manager  │ `/academics/classes`     │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-05 │ Section Detail & Capacity   │ `/academics/classes/...` │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-06 │ Teacher Class Allocations   │ `/academics/assignments` │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-07 │ Master Student Directory    │ `/students`              │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-08 │ Multi-Step Student Admission│ `/students/admit`        │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-09 │ Cumulative Student Dossier  │ `/students/:id`          │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-10 │ Guardian Directory          │ `/guardians`             │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-11 │ Staff & Faculty Directory   │ `/staff`                 │ Stage 1 R1   │ [Existing] (API)  │
│ SCR-ADM-12 │ Invite Staff Member Dialog  │ `/staff/invite`          │ Stage 1 R1   │ [Existing] (API)  │
│ SCR-ADM-13 │ Campus Attendance Oversight │ `/attendance`            │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-14 │ Institutional Announcements │ `/notices`               │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-15 │ School Branding & Settings  │ `/admin/settings`        │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-16 │ Academic Calendar Grid      │ `/admin/calendar`        │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-17 │ Student Bulk Import Wizard  │ `/students/import`       │ Stage 1 R1   │ [Missing]         │
│ SCR-ADM-18 │ Academic Year Rollover (OD-01) `/admin/academic-years/rollover` Stage 1 R1 │ [Missing]         │
│ SCR-ADM-19 │ Staff Leave Approval Desk   │ `/admin/staff/leave`     │ Stage 1 R2   │ [Missing]         │
└────────────┴─────────────────────────────┴──────────────────────────┴──────────────┴───────────────────┘
```

---

## 4. Teacher Portal Module

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     TEACHER PORTAL SCREENS                                             │
├────────────┬─────────────────────────────┬──────────────────────────┬──────────────┬───────────────────┤
│ Screen ID  │ Screen Name                 │ Route                    │ Release      │ Status            │
├────────────┼─────────────────────────────┼──────────────────────────┼──────────────┼───────────────────┤
│ SCR-TCH-01 │ Homeroom Attendance Register│ `/attendance/register`   │ Stage 1 R1   │ [Missing]         │
│ SCR-TCH-02 │ Teacher Daily Dashboard     │ `/teacher`               │ Stage 1 R2   │ [Missing]         │
│ SCR-TCH-03 │ Assigned Section Roster     │ `/teacher/classes/:id`   │ Stage 1 R2   │ [Missing]         │
│ SCR-TCH-04 │ Homework & Assignment Desk  │ `/teacher/homework`      │ Stage 1 R2   │ [Missing]         │
│ SCR-TCH-05 │ Teacher Timetable View      │ `/teacher/timetable`     │ Stage 1 R2   │ [Missing]         │
│ SCR-TCH-06 │ Staff Leave Request Form    │ `/teacher/leave`         │ Stage 1 R2   │ [Missing]         │
└────────────┴─────────────────────────────┴──────────────────────────┴──────────────┴───────────────────┘
```

---

## 5. Parent / Guardian Portal Module

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     PARENT PORTAL SCREENS                                              │
├────────────┬─────────────────────────────┬──────────────────────────┬──────────────┬───────────────────┤
│ Screen ID  │ Screen Name                 │ Route                    │ Release      │ Status            │
├────────────┼─────────────────────────────┼──────────────────────────┼──────────────┼───────────────────┤
│ SCR-PAR-01 │ Family Overview Dashboard   │ `/parent`                │ Stage 1 R2   │ [Missing]         │
│ SCR-PAR-02 │ Child Attendance Heatmap    │ `/parent/attendance`     │ Stage 1 R2   │ [Missing]         │
│ SCR-PAR-03 │ Child Fee Dues & Receipts   │ `/parent/fees`           │ Stage 1 R2   │ [Missing]         │
│ SCR-PAR-04 │ Homework & Circulars Feed   │ `/parent/homework`       │ Stage 1 R2   │ [Missing]         │
│ SCR-PAR-05 │ Child Class Timetable       │ `/parent/timetable`      │ Stage 1 R2   │ [Missing]         │
│ SCR-PAR-06 │ Online Payment Checkout     │ `/parent/fees/pay`       │ Future (P3)  │ [Future]          │
└────────────┴─────────────────────────────┴──────────────────────────┴──────────────┴───────────────────┘
```

---

## 6. Student Portal Module

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     STUDENT PORTAL SCREENS                                             │
├────────────┬─────────────────────────────┬──────────────────────────┬──────────────┬───────────────────┤
│ Screen ID  │ Screen Name                 │ Route                    │ Release      │ Status            │
├────────────┼─────────────────────────────┼──────────────────────────┼──────────────┼───────────────────┤
│ SCR-STU-01 │ Student Personal Dashboard  │ `/student`               │ Stage 1 R2   │ [Missing]         │
│ SCR-STU-02 │ My Weekly Timetable         │ `/student/timetable`     │ Stage 1 R2   │ [Missing]         │
│ SCR-STU-03 │ My Attendance Record        │ `/student/attendance`    │ Stage 1 R2   │ [Missing]         │
│ SCR-STU-04 │ My Homework Tasks           │ `/student/homework`      │ Stage 1 R2   │ [Missing]         │
│ SCR-STU-05 │ School Announcements        │ `/notices`               │ Stage 1 R2   │ [Missing]         │
└────────────┴─────────────────────────────┴──────────────────────────┴──────────────┴───────────────────┘
```

---

## 7. Financial Accounting Module (Accountant & Bursar)

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     FINANCE & ACCOUNTING SCREENS                                       │
├────────────┬─────────────────────────────┬──────────────────────────┬──────────────┬───────────────────┤
│ Screen ID  │ Screen Name                 │ Route                    │ Release      │ Status            │
├────────────┼─────────────────────────────┼──────────────────────────┼──────────────┼───────────────────┤
│ SCR-ACC-01 │ Financial Operations Pulse  │ `/finance/dashboard`     │ Stage 1 R2   │ [Missing]         │
│ SCR-ACC-02 │ Cashier Counter Desk        │ `/finance/counter`       │ Stage 1 R2   │ [Missing]         │
│ SCR-ACC-03 │ Fee Structures & Schedules  │ `/finance/structures`    │ Stage 1 R2   │ [Missing]         │
│ SCR-ACC-04 │ Outstanding Dues Defaulters │ `/finance/dues`          │ Stage 1 R2   │ [Missing]         │
│ SCR-ACC-05 │ Fee Transaction Ledger      │ `/finance/transactions`  │ Stage 1 R2   │ [Missing]         │
│ SCR-ACC-06 │ Printable Receipt Voucher   │ `/finance/receipts/:id`  │ Stage 1 R2   │ [Missing]         │
│ SCR-ACC-07 │ Fee Concessions & Waivers (OD-04) `/finance/concessions` Stage 1 R2   │ [Missing]         │
└────────────┴─────────────────────────────┴──────────────────────────┴──────────────┴───────────────────┘
```

---

## 8. Release Milestone Summary

- **Release 1 (Core Operations):** School setup, campus branches, academic years, user authentication, role delegation, student admissions, student profiles, classes/sections, teacher subject assignments, student bulk import, academic calendar, in-app announcements, and daily homeroom attendance marking (`SCR-ADM-*`, `SCR-TCH-01`).
- **Release 2 (Daily School Experience & Finance):** Parent portal (with multi-child switcher), student portal, teacher daily portal, timetable, homework, fee structures, cashier payment recording, receipts, and attendance/enrollment reports.
- **Future Releases:** Online payment gateways, SMS/WhatsApp integrations, examinations, report cards, transport, library, and payroll.
