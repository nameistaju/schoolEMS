# School SaaS — Permanent Engineering & Code Quality Standards

**Document Status:** ACTIVE & MANDATORY REPOSITORY STANDARD  
**Applies To:** Every development task, AI session, feature, bug fix, refactor, and milestone  
**Classification:** Engineering Governance & Code Quality Charter  
**Date Established:** March 2026  

---

## 1. Core Principle

Build a production-quality, maintainable School Management SaaS platform.

The objective is not simply to make code work; the objective is to maintain a codebase that another experienced software engineer can open, comprehend, debug, extend, and maintain without confusion.

### Architectural Preferences:
- **Simplicity** over unnecessary complexity.
- **Consistency** over individual coding preferences.
- **Reusable logic** over duplicated logic.
- **Complete implementations** over partial implementations.
- **Clear architecture** over quick hacks.
- **Tested changes** over assumptions.

### Declared baseline (from package.json ranges; lockfile is truth)
All development in this repository must anchor directly to the declared baseline:
- package.json/lockfile is the source of truth; this table may be stale.
- **Frontend (`projects/school-management/frontend`):**
  - React: `18.3.1` (lockfile)
  - ReactDOM: `18.3.1` (lockfile)
  - Vite: `5.4.11` (lockfile)
  - `@vitejs/plugin-react`: `4.3.4` (lockfile)
  - React Router DOM: `6.30.6` (lockfile; package range `^6.30.6`)
  - Next.js: **Not installed** (Workspace uses Vite SPA architecture)
  - Tailwind CSS: **Not installed** (Workspace uses custom CSS design tokens in `src/styles.css`)
- **Backend Services (`projects/school-management/services`):**
  - Node.js: `v24.14.1` (package engine requirement: `>= 20.0.0 LTS`)
  - Express: `4.22.3` (lockfile; package range `^4.21.2`)
  - Knex.js: `3.3.0` (lockfile; package range `^3.3.0`)
  - pg: `8.23.1` (lockfile; package range `^8.13.1`)
  - jsonwebtoken: `9.0.3` (lockfile; package range `^9.0.2`)
  - http-proxy-middleware: `3.0.10` (lockfile; package range `^3.0.3`)
  - bcryptjs: `2.4.3` (lockfile; package range `^2.4.3`)
  - PostgreSQL: `18.6` (Running in WSL Ubuntu on port 5432)

---

## 2. Never Leave Unfinished Implementations

Under no circumstances should the following be left in the codebase:
- Half-implemented features or partial workflows.
- Empty functions or stubs.
- Fake API responses or hardcoded mock returns.
- Placeholder business logic.
- Interactive UI elements (buttons, inputs) without backing functionality.
- Routes that return dummy data.
- Components or files that are no longer used.
- Temporary workarounds without documented justification.
- Commented-out obsolete implementations.
- Unnecessary `TODO` and `FIXME` comments.
- Incomplete migrations.
- Unfinished integrations silently presented as complete.

### Incomplete Scope Handling:
If a feature cannot be completed within the current task:
1. Clearly identify and document what is incomplete.
2. Formally document the exact remaining work.
3. Keep incomplete functionality inaccessible or explicitly disabled.
4. Never report or claim that the feature is complete.

---

## 3. No Dead or Unnecessary Code

Before concluding any implementation task:
1. Inspect all changed files and their upstream/downstream dependencies.
2. Remove code that is genuinely obsolete or unused as a direct consequence of the change.
3. Check for:
   - Unused imports and variables.
   - Unused functions and dead branches.
   - Unused React components or styles.
   - Duplicate API endpoints and business logic.
   - Duplicate utility functions.
   - Obsolete routes and orphaned files.
   - Unused dependencies in `package.json`.
   - Redundant configuration files.
   - Unnecessary abstraction layers.
4. **Safety Rule:** Do not delete code merely because it looks unfamiliar. Before removing anything, verify whether it is used elsewhere, referenced dynamically, required by deployment scripts, or needed by existing integrations.
5. Avoid unrelated mass cleanups across the repository without explicit approval.

---

## 4. Strict Architectural Consistency

Before implementing a new feature:
1. Inspect the existing folder structure and module conventions.
2. Locate similar existing features and patterns.
3. Understand existing naming conventions and exported interfaces.
4. Identify reusable components, repositories, and services.
5. Adhere to established authentication (`requireSchoolAuth`) and authorization patterns.
6. Adhere to existing database access patterns (`withTenantContext`).
7. Follow established project conventions consistently.

### Antipatterns to Avoid:
- Never create a second implementation of an existing capability.
- Never introduce new architectural patterns without demonstrating why existing patterns are insufficient.
- Giant files containing unrelated responsibilities.
- Duplicate service layers or unnecessary microservices.
- Circular dependencies or imports.
- Excessive abstraction layers for simple operations.
- Business logic or direct API calls embedded inside presentation UI components.
- Raw database queries scattered throughout unrelated controllers.
- Hardcoded tenant, branch, or user identifiers.
- Inconsistent API response envelopes.

---

## 5. Backend Engineering Rules

Backend services must adhere to clean separation of concerns:
- **Routes:** HTTP endpoint definitions, URL parameters, and middleware attachment.
- **Controllers:** Request parsing, response formatting, and HTTP status code dispatch.
- **Services:** Pure domain and business logic orchestration.
- **Repositories / Query Builders:** Encapsulated database interactions.
- **Middleware:** Authentication, RBAC authorization, tenant/branch context, rate limiting, and request sanitization.
- **Validators:** Strict payload and parameter validation before reaching domain logic.
- **Shared Utilities:** Reusable common logic across services.

### Mandatory Endpoint Standards:
Every API endpoint must provide:
- Comprehensive input validation (rejecting malformed or unexpected fields).
- Authoritative authentication (RS256 JWT verification via public keys).
- Explicit authorization checks matching role and purview.
- Tenant and branch scope enforcement (failing closed when context is absent).
- Consistent error handling using the standard error envelope.
- Appropriate HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `409`, `500`).
- Immutable audit logging for sensitive actions or data inspections.
- **Zero Information Leakage:** Never expose internal database errors, stack traces, credentials, or system paths to clients.

---

## 6. Database Engineering Rules

- **Version-Controlled Migrations:** All schema changes must occur through version-controlled Knex migrations.
- **Non-Destructive Evolution:** Never silently alter existing database structures; never execute unvetted `DROP` or `TRUNCATE` operations on persistent tables.
- **Relational Integrity:** Explicitly define primary keys (`UUID`), foreign keys with appropriate `ON DELETE` rules, and unique constraints.
- **Query Indexing:** Create targeted B-tree, partial, or compound indexes based on actual query patterns and lookups.
- **Multi-Tenant Ownership:** Every table must possess explicit tenant and/or branch ownership.
- **Row-Level Security (RLS):** All multi-tenant tables must have RLS enabled and forced (`FORCE ROW LEVEL SECURITY`).
- **Real Database Testing:** Always verify multi-tenant isolation against real PostgreSQL instances (never mock RLS).
- **Historical Immutability:** Historical enrollments, transcripts, and financial records must remain append-only or immutable.
- **Phase 1 Protection:** Never alter Phase 1 identity migrations (`01` through `07`) to accommodate Phase 2 requirements. Phase 2 migrations must be tracked independently in `sis.knex_migrations_sis`.

---

## 7. Frontend Engineering Rules

- **Reusable Components:** Maintain a consistent UI library of presentation components.
- **Decoupled Architecture:** Keep business logic, caching, and state management separate from UI presentation.
- **State Transparency:** Always implement explicit loading, empty, error, and success states for all asynchronous data flows.
- **Comprehensive Validation:** Provide immediate inline form feedback paired with server-side validation error handling.
- **Interaction Fidelity:** Every interactive element (button, menu, link) must perform an actual operation. Fake buttons or placeholder modals are strictly prohibited.
- **Responsive Layout:** Verify behavior across standard desktop, tablet, and mobile breakpoints.
- **Definition of UI Done:** A user interface is not complete simply because it renders. Backing API integrations, validation, role-based visibility, and error boundaries must function end-to-end.

---

## 8. Security is Not Optional

Every feature, refactor, and API design must address:
- **Authentication:** Asymmetric cryptographic validation (RS256); key rotation support.
- **Authorization:** Least-privilege role matrix; dynamic context guards (`requireBranchScope`, `requireGuardianChildScope`).
- **Tenant & Branch Isolation:** Authoritative resolution from verified JWT/Host; client-supplied IDs are never trusted.
- **Injection Defenses:** Parameterized SQL queries; input sanitization against XSS.
- **Sensitive Data Protections:** Physical table segregation (`sis.student_health_records`, `sis.student_safeguarding_records`); zero plaintext national IDs (voluntary salted SHA-256 tokens + last-4 display mask).
- **Audit Trails:** Non-repudiation logging with mandatory access justification for sensitive files.
- **Upload Hardening:** Binary magic byte MIME verification; cryptographically random UUID filenames; traversal defense.
- **Zero AWS Dependencies:** Local-first development on Windows 11 / WSL without cloud dependencies.

---

## 9. Testing & Regression Requirements

Before marking any implementation task complete:
1. Execute the entire relevant existing test suite.
2. Author comprehensive unit tests for all new business logic.
3. Author negative authorization tests (asserting `401 Unauthorized` and `403 Forbidden`).
4. Execute real multi-tenant RLS isolation tests against PostgreSQL in WSL.
5. Verify edge cases, boundary thresholds, and constraint violations (`409 Conflict`).
6. Run the project's actual build and test scripts (`package.json`).
7. **Never weaken or delete existing tests** to force a passing build. If a test fails, diagnose the root cause, remediate the code, and re-verify.

---

## 10. Change Management & Verification

- Work in small, coherent, reviewable milestones.
- Inspect the complete Git diff before finalizing any task.
- Check for unintended modifications, duplicate utilities, or stale comments.
- Do not make Git commits or push to remote branches without explicit user authorization.

---

## 11. Documentation Consistency

When changing application behavior, immediately synchronize:
- Architecture Decision Records (ADRs).
- API contracts and endpoint documentation.
- Database entity schemas and migration inventories.
- Environment variable configuration templates (`.env.example`).
- Local developer runbooks and testing instructions.

Never document a feature as implemented if it only exists in design or roadmap documents.

---

## 12. Definition of Done (DoD) Checklist

A feature may only be reported as **COMPLETE** when all 14 criteria are fulfilled:

- [ ] End-to-end functionality is fully implemented.
- [ ] No unfinished placeholder implementation, empty functions, or fake data remain.
- [ ] No unnecessary dead code or duplicate logic was introduced.
- [ ] Naming and architectural boundaries adhere to project standards.
- [ ] Input validation is implemented on all endpoints and forms.
- [ ] Authentication and role-based authorization are verified.
- [ ] Tenant and branch isolation are validated against real PostgreSQL.
- [ ] Database constraints, foreign keys, and indexes are verified.
- [ ] Relevant automated tests pass at 100%.
- [ ] Existing regression tests continue passing at 100%.
- [ ] Production build succeeds without errors where applicable.
- [ ] Documentation is updated and synchronized.
- [ ] The complete Git diff has been inspected and audited.
- [ ] Any remaining operational limitations are explicitly documented.

*If any criterion cannot be satisfied, the task must be reported as **PARTIALLY COMPLETE** or **BLOCKED**.*

---

## 13. Required Final Task Report Format

Every completed implementation task must conclude with the following 13-point structured report:

1. **What was implemented:** Concise description of the delivered feature or refactor.
2. **Files created:** Full list of newly created files with file paths.
3. **Files modified:** Full list of modified existing files with summary of changes.
4. **Files deleted and why:** Any removed dead code or obsolete files with rationale.
5. **Database changes:** Migrations added, tables created/altered, constraints, and RLS policies.
6. **APIs added or modified:** HTTP endpoints, route paths, methods, and status codes.
7. **Tests executed and exact results:** Full test command output, number of tests executed, passed, failed, and run duration.
8. **Build / lint / type-check results:** Exact command output and exit codes.
9. **Security and authorization checks:** Validation of tenant scoping, RBAC checks, and RLS policies.
10. **Dead-code and duplicate-code review:** Summary of dead-code inspection performed.
11. **Known limitations:** Any operational boundaries or unsupported edge cases.
12. **Remaining TODO items:** Next scheduled steps or backlog items.
13. **Working tree status:** Confirmation that `git status` is clean and no unintended files were changed.

---

## Final Rule

**The repository must remain understandable and maintainable after every single milestone.**  
Never sacrifice long-term code quality, security guarantees, or architectural consistency merely to finish a task faster.
