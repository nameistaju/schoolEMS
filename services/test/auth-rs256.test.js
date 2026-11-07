const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const {
  signToken,
  verifyToken,
  signSchoolToken,
  verifySchoolToken,
  hashToken,
  generateRefreshToken,
  requireSchoolAuth,
  SCHOOL_ISSUER,
  SCHOOL_AUDIENCE,
} = require('../common/auth');

test('RS256 token: signs and verifies with valid UUID claims', () => {
  const sub = crypto.randomUUID();
  const tenantId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();

  const token = signSchoolToken({
    sub,
    tenant_id: tenantId,
    membership_id: membershipId,
    roles: ['SchoolAdmin'],
    email: 'admin@apex.example',
  });

  const claims = verifySchoolToken(token);
  assert.strictEqual(claims.sub, sub);
  assert.strictEqual(claims.tenant_id, tenantId);
  assert.strictEqual(claims.membership_id, membershipId);
  assert.deepStrictEqual(claims.roles, ['SchoolAdmin']);
  assert.strictEqual(claims.iss, SCHOOL_ISSUER);
  assert.strictEqual(claims.aud, SCHOOL_AUDIENCE);
});

test('Algorithm segregation: RS256 validator strictly rejects HS256 tokens', () => {
  const legacyToken = signToken({ id: 'u-123', email: 'legacy@example.com', name: 'Legacy' });

  assert.throws(
    () => verifySchoolToken(legacyToken),
    /Invalid token algorithm/i
  );
});

test('Algorithm segregation: Legacy HS256 validator rejects RS256 tokens', () => {
  const schoolToken = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: crypto.randomUUID(),
    membership_id: crypto.randomUUID(),
  });

  assert.throws(
    () => verifyToken(schoolToken)
  );
});

test('UUID Claim Validation: Rejects invalid UUID formats in sign and verify', () => {
  assert.throws(
    () => signSchoolToken({ sub: 'not-a-valid-uuid' }),
    /sub must be a valid UUID/i
  );

  assert.throws(
    () => signSchoolToken({ sub: crypto.randomUUID(), tenant_id: 'invalid-tenant' }),
    /tenant_id must be a valid UUID/i
  );
});

test('Broad UUID Validation: Accepts UUID v1, v4, v7 formats', () => {
  const v1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  const v4 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  const v7 = '018f3a3b-2f6c-7e9b-a3d8-5b1287c94b32';

  const token1 = signSchoolToken({ sub: v1, tenant_id: v4, membership_id: v7 });
  const claims1 = verifySchoolToken(token1);
  assert.strictEqual(claims1.sub, v1);
  assert.strictEqual(claims1.tenant_id, v4);
  assert.strictEqual(claims1.membership_id, v7);
});

test('Refresh token hashing and generation', () => {
  const raw1 = generateRefreshToken();
  const raw2 = generateRefreshToken();
  assert.notStrictEqual(raw1, raw2);
  assert.strictEqual(raw1.length, 80); // 40 bytes hex

  const hash1 = hashToken(raw1);
  const hash2 = hashToken(raw1);
  assert.strictEqual(hash1, hash2);
  assert.strictEqual(hash1.length, 64); // SHA-256 hex
});

test('requireSchoolAuth: rejects missing token and cross-tenant attempts', () => {
  let status;
  let responseData;
  const res = {
    status: (s) => {
      status = s;
      return { json: (d) => { responseData = d; } };
    },
  };

  // Missing Authorization header -> 401
  const mw = requireSchoolAuth();
  mw({ headers: {} }, res, () => assert.fail('next should not be called'));
  assert.strictEqual(status, 401);
  assert.strictEqual(responseData.success, false);

  // Cross-tenant attempt -> 403
  const token = signSchoolToken({
    sub: crypto.randomUUID(),
    tenant_id: '11111111-1111-1111-1111-111111111111',
    membership_id: crypto.randomUUID(),
    roles: ['Teacher'],
  });

  const reqCrossTenant = {
    headers: { authorization: `Bearer ${token}` },
    tenant: { id: '22222222-2222-2222-2222-222222222222' },
  };

  mw(reqCrossTenant, res, () => assert.fail('next should not be called on cross-tenant'));
  assert.strictEqual(status, 403);
  assert.match(responseData.error.message, /Tenant Cross-Talk Blocked/i);
});
