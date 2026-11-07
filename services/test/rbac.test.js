const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { requireSchoolAuth, signSchoolToken } = require('../common/auth');

test('requireSchoolAuth permits user with required role', () => {
  const token = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    roles: ['SchoolAdmin'],
  });

  const mw = requireSchoolAuth({ role: 'SchoolAdmin' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;

  mw(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.user.roles[0], 'SchoolAdmin');
});

test('requireSchoolAuth permits SuperAdmin to bypass tenant role restriction', () => {
  const token = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    roles: ['SuperAdmin'],
  });

  const mw = requireSchoolAuth({ role: 'SchoolAdmin' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  let nextCalled = false;

  mw(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
});

test('requireSchoolAuth blocks unauthorized role with 403', () => {
  const token = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    roles: ['Teacher'],
  });

  const mw = requireSchoolAuth({ role: 'SchoolAdmin' });
  let status;
  let responseData;
  const res = {
    status: (s) => {
      status = s;
      return { json: (d) => { responseData = d; } };
    },
  };

  mw({ headers: { authorization: `Bearer ${token}` } }, res, () => assert.fail('should not call next'));
  assert.strictEqual(status, 403);
  assert.match(responseData.error.message, /Insufficient permissions: SchoolAdmin role required/i);
});

test('Phase 1 Scope Isolation: Non-admin roles (Student, Parent) blocked from administrative roles', () => {
  const studentToken = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    roles: ['Student'],
  });

  const mwAdmin = requireSchoolAuth({ role: 'SchoolAdmin' });
  let status;
  const res = {
    status: (s) => {
      status = s;
      return { json: () => {} };
    },
  };

  mwAdmin({ headers: { authorization: `Bearer ${studentToken}` } }, res, () => assert.fail('student should not access admin'));
  assert.strictEqual(status, 403);
});

test('Branch Scoping: Distinguishes school-wide vs branch-scoped tokens', () => {
  const schoolWideToken = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    branch_id: null,
    roles: ['SchoolAdmin'],
  });

  const branchScopedToken = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    branch_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    roles: ['Teacher'],
  });

  const { branch_id: bw } = require('../common/auth').verifySchoolToken(schoolWideToken);
  const { branch_id: bb } = require('../common/auth').verifySchoolToken(branchScopedToken);

  assert.strictEqual(bw, null);
  assert.strictEqual(bb, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
});
