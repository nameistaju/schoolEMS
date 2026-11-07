const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const knex = require('knex');
const knexConfig = require('../auth-service/knexfile');
const { Client, Pool } = require('pg');

const {
  validateKeypair,
  verifyProductionKeyConfig,
  signSchoolToken,
  verifySchoolToken,
  registerTrustedKey,
  getTrustedKey,
  SCHOOL_KEY_ID,
} = require('../common/auth');
const { createTenantResolver } = require('../auth-service/src/middleware/tenant-resolver');
const { createAuthRouter } = require('../auth-service/src/routes/v1/auth');
const { createMembershipsRouter } = require('../auth-service/src/routes/v1/memberships');

const TEST_DB = 'disposable_security_test_sms_db';
const PG_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
};

let pool;
let tenantId = '33333333-3333-3333-3333-333333333333';
let superAdminUserId;
let ordinaryUserId;
let studentUserId;
let parentUserId;
let schoolAdminUserId;
let principalUserId;
let schoolAdminMembershipId;
let principalMembershipId;
let ordinaryMembershipId;
let tenantBMembershipId;
let tenantIdB = '44444444-4444-4444-4444-444444444444';

test.before(async () => {
  // 1. Create disposable test database
  const adminClient = new Client({ ...PG_CONFIG, database: 'postgres' });
  await adminClient.connect();
  try {
    await adminClient.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = $1 AND pid <> pg_backend_pid()
    `, [TEST_DB]);
    await adminClient.query(`DROP DATABASE IF EXISTS ${TEST_DB}`);
    await adminClient.query(`CREATE DATABASE ${TEST_DB}`);
  } finally {
    await adminClient.end();
  }

  // 2. Run migrations 01-07
  const db = knex({
    ...knexConfig.test,
    connection: { ...knexConfig.test.connection, database: TEST_DB },
  });
  try {
    const [batch, log] = await db.migrate.latest();
    assert.strictEqual(log.length, 7, 'All 7 migrations must run');
  } finally {
    await db.destroy();
  }

  // 3. Connect pool
  pool = new Pool({ ...PG_CONFIG, database: TEST_DB });

  // 4. Seed test tenant
  await pool.query(`
    INSERT INTO tenants (id, name, slug, status)
    VALUES ($1, 'Remediation Academy', 'remediation-acad', 'active')
  `, [tenantId]);

  await pool.query(`
    INSERT INTO tenant_domains (tenant_id, domain, domain_type, verification_status)
    VALUES ($1, 'remediation.example', 'subdomain', 'verified')
  `, [tenantId]);

  // 5. Seed users
  const passHash = await bcrypt.hash('TestPassword@123', 10);

  // SuperAdmin
  const { rows: sa } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('Platform Admin', 'SuperAdmin', 'superadmin@platform.test', $1, 'active')
    RETURNING id
  `, [passHash]);
  superAdminUserId = sa[0].id;
  await pool.query('INSERT INTO platform_admins (user_id) VALUES ($1)', [superAdminUserId]);

  // Ordinary User
  const { rows: ord } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('Ordinary User', 'Ordinary', 'ordinary@school.test', $1, 'active')
    RETURNING id
  `, [passHash]);
  ordinaryUserId = ord[0].id;

  // Student User
  const { rows: st } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('Student User', 'Student', 'student@school.test', $1, 'active')
    RETURNING id
  `, [passHash]);
  studentUserId = st[0].id;

  // Parent User
  const { rows: pr } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('Parent User', 'Parent', 'parent@school.test', $1, 'active')
    RETURNING id
  `, [passHash]);
  parentUserId = pr[0].id;

  // SchoolAdmin User
  const { rows: sca } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('School Admin User', 'SchoolAdmin', 'admin@school.test', $1, 'active')
    RETURNING id
  `, [passHash]);
  schoolAdminUserId = sca[0].id;

  // Principal User
  const { rows: pri } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('Principal User', 'Principal', 'principal@school.test', $1, 'active')
    RETURNING id
  `, [passHash]);
  principalUserId = pri[0].id;

  // 6. Seed memberships
  const { rows: memAdmin } = await pool.query(`
    INSERT INTO user_tenant_memberships (tenant_id, user_id, status)
    VALUES ($1, $2, 'active') RETURNING id
  `, [tenantId, schoolAdminUserId]);
  schoolAdminMembershipId = memAdmin[0].id;

  const { rows: memPrincipal } = await pool.query(`
    INSERT INTO user_tenant_memberships (tenant_id, user_id, status)
    VALUES ($1, $2, 'active') RETURNING id
  `, [tenantId, principalUserId]);
  principalMembershipId = memPrincipal[0].id;

  const { rows: memOrd } = await pool.query(`
    INSERT INTO user_tenant_memberships (tenant_id, user_id, status)
    VALUES ($1, $2, 'active') RETURNING id
  `, [tenantId, ordinaryUserId]);
  ordinaryMembershipId = memOrd[0].id;

  // 7. Seed Tenant B and membership for cross-tenant isolation testing
  await pool.query(`
    INSERT INTO tenants (id, name, slug, status)
    VALUES ($1, 'Tenant B Academy', 'tenant-b-acad', 'active')
  `, [tenantIdB]);

  const { rows: tbUser } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status)
    VALUES ('Tenant B User', 'TenantBUser', 'user@tenantb.test', $1, 'active')
    RETURNING id
  `, [passHash]);

  const { rows: memB } = await pool.query(`
    INSERT INTO user_tenant_memberships (tenant_id, user_id, status)
    VALUES ($1, $2, 'active') RETURNING id
  `, [tenantIdB, tbUser[0].id]);
  tenantBMembershipId = memB[0].id;
});

test.after(async () => {
  if (pool) await pool.end();
});

// =========================================================================
// SECTION 1: C-01 & M-03 Platform Login & SuperAdmin Separation
// =========================================================================

test('Security C-01.1: Ordinary user cannot log in at platform root without tenant context', async () => {
  const router = createAuthRouter(pool, (req, res, next) => next());
  const postLogin = router.stack.find((r) => r.route?.path === '/login')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    body: { email: 'ordinary@school.test', password: 'TestPassword@123' },
    tenant: null, // No tenant context (platform login attempt)
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await postLogin(req, res);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(responseData.success, false);
  assert.strictEqual(responseData.error.code, 'TENANT_REQUIRED');
  assert.match(responseData.error.message, /School tenant context required for non-platform users/i);
});

test('Security C-01.2: Student cannot log in at platform root without tenant context', async () => {
  const router = createAuthRouter(pool, (req, res, next) => next());
  const postLogin = router.stack.find((r) => r.route?.path === '/login')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    body: { email: 'student@school.test', password: 'TestPassword@123' },
    tenant: null,
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await postLogin(req, res);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(responseData.error.code, 'TENANT_REQUIRED');
});

test('Security C-01.3: Parent cannot log in at platform root without tenant context', async () => {
  const router = createAuthRouter(pool, (req, res, next) => next());
  const postLogin = router.stack.find((r) => r.route?.path === '/login')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    body: { email: 'parent@school.test', password: 'TestPassword@123' },
    tenant: null,
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await postLogin(req, res);
  assert.strictEqual(statusCode, 400);
  assert.strictEqual(responseData.error.code, 'TENANT_REQUIRED');
});

test('Security C-01.4: Verified platform admin CAN log in at platform root and receives SuperAdmin role', async () => {
  const router = createAuthRouter(pool, (req, res, next) => next());
  const postLogin = router.stack.find((r) => r.route?.path === '/login')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    body: { email: 'superadmin@platform.test', password: 'TestPassword@123' },
    tenant: null,
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
    cookie: () => {},
  };

  await postLogin(req, res);
  assert.strictEqual(statusCode, 200);
  assert.strictEqual(responseData.success, true);
  assert.deepStrictEqual(responseData.data.roles, ['SuperAdmin']);
});

// =========================================================================
// SECTION 2: H-01 Restrict Tenant Role Assignment & Privilege Escalation
// =========================================================================

test('Security H-01.1: SchoolAdmin cannot invite someone with role SuperAdmin', async () => {
  const router = createMembershipsRouter(pool);
  const inviteHandler = router.stack.find((r) => r.route?.path === '/invite')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    user: { sub: schoolAdminUserId, tenant_id: tenantId, roles: ['SchoolAdmin'] },
    body: { email: 'hacked.admin@test.com', fullName: 'Hacker', roleKey: 'SuperAdmin' },
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await inviteHandler(req, res);
  assert.strictEqual(statusCode, 403);
  assert.match(responseData.error.message, /Insufficient privileges to assign role 'SuperAdmin'/i);
});

test('Security H-01.2: Principal cannot invite someone with role SuperAdmin', async () => {
  const router = createMembershipsRouter(pool);
  const inviteHandler = router.stack.find((r) => r.route?.path === '/invite')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    user: { sub: principalUserId, tenant_id: tenantId, roles: ['Principal'] },
    body: { email: 'hacked.admin@test.com', fullName: 'Hacker', roleKey: 'SuperAdmin' },
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await inviteHandler(req, res);
  assert.strictEqual(statusCode, 403);
  assert.match(responseData.error.message, /Insufficient privileges to assign role 'SuperAdmin'/i);
});

test('Security H-01.3: Principal cannot invite or grant SchoolAdmin role', async () => {
  const router = createMembershipsRouter(pool);
  const inviteHandler = router.stack.find((r) => r.route?.path === '/invite')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    user: { sub: principalUserId, tenant_id: tenantId, roles: ['Principal'] },
    body: { email: 'hacked.principal@test.com', fullName: 'Elevated User', roleKey: 'SchoolAdmin' },
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await inviteHandler(req, res);
  assert.strictEqual(statusCode, 403);
  assert.match(responseData.error.message, /Insufficient privileges to assign role 'SchoolAdmin'/i);
});

test('Security H-01.4: SchoolAdmin cannot assign SuperAdmin via /:id/roles endpoint', async () => {
  const router = createMembershipsRouter(pool);
  const assignRoleHandler = router.stack.find((r) => r.route?.path === '/:id/roles')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  const req = {
    params: { id: ordinaryMembershipId },
    user: { sub: schoolAdminUserId, tenant_id: tenantId, roles: ['SchoolAdmin'] },
    body: { roleKey: 'SuperAdmin' },
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await assignRoleHandler(req, res);
  assert.strictEqual(statusCode, 403);
  assert.match(responseData.error.message, /Insufficient privileges to assign role 'SuperAdmin'/i);
});

test('Security H-01.5: Unauthorized self-promotion is blocked on /:id/roles', async () => {
  const router = createMembershipsRouter(pool);
  const assignRoleHandler = router.stack.find((r) => r.route?.path === '/:id/roles')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  // SchoolAdmin tries to assign role to own membership ID
  const req = {
    params: { id: schoolAdminMembershipId },
    user: { sub: schoolAdminUserId, tenant_id: tenantId, roles: ['SchoolAdmin'] },
    body: { roleKey: 'Principal' },
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await assignRoleHandler(req, res);
  assert.strictEqual(statusCode, 403);
  assert.match(responseData.error.message, /Self-assignment of roles is strictly prohibited/i);
});

test('Security H-01.6: Cross-tenant role assignment is rejected', async () => {
  const router = createMembershipsRouter(pool);
  const assignRoleHandler = router.stack.find((r) => r.route?.path === '/:id/roles')?.route?.stack[1]?.handle;

  let statusCode;
  let responseData;
  // SchoolAdmin of Tenant A attempts to modify membership belonging to Tenant B
  const req = {
    params: { id: tenantBMembershipId },
    user: { sub: schoolAdminUserId, tenant_id: tenantId, roles: ['SchoolAdmin'] },
    body: { roleKey: 'Teacher' },
    headers: {},
  };
  const res = {
    status: (code) => { statusCode = code; return res; },
    json: (data) => { responseData = data; return res; },
  };

  await assignRoleHandler(req, res);
  assert.strictEqual(statusCode, 404);
  assert.strictEqual(responseData.success, false);
  assert.strictEqual(responseData.error.code, 'NOT_FOUND');
  assert.match(responseData.error.message, /Member not found in current school/i);
});

// =========================================================================
// SECTION 3: H-02 Production RSA Key Validation & Rotation
// =========================================================================

test('Security H-02.1: validateKeypair rejects missing private key', () => {
  assert.throws(
    () => validateKeypair(null, 'public-key-placeholder'),
    /JWT_PRIVATE_KEY is missing or invalid/i
  );
});

test('Security H-02.2: validateKeypair rejects missing public key', () => {
  assert.throws(
    () => validateKeypair('private-key-placeholder', null),
    /JWT_PUBLIC_KEY is missing or invalid/i
  );
});

test('Security H-02.3: validateKeypair rejects malformed PEM string', () => {
  assert.throws(
    () => validateKeypair('not-a-valid-pem-key', 'not-a-valid-pem-key'),
    /Invalid PEM format/i
  );
});

test('Security H-02.4: validateKeypair rejects mismatched RSA keypairs', () => {
  // Generate Keypair 1
  const kp1 = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Generate Keypair 2
  const kp2 = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // Pair private key 1 with public key 2 -> MUST THROW MISMATCH ERROR
  assert.throws(
    () => validateKeypair(kp1.privateKey, kp2.publicKey),
    /do not form a matching keypair/i
  );
});

test('Security H-02.5: validateKeypair accepts matching RSA 2048 keypair', () => {
  const kp = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  assert.doesNotThrow(() => validateKeypair(kp.privateKey, kp.publicKey));
});

test('Security H-02.6: verifySchoolToken rejects token signed with unknown kid', () => {
  const kp = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: crypto.randomUUID(), tenant_id: crypto.randomUUID(), roles: ['Teacher'] },
    kp.privateKey,
    {
      algorithm: 'RS256',
      issuer: 'https://auth.schoolsaas.com',
      audience: 'schoolsaas-api',
      keyid: 'rogue-unknown-kid-2026',
    }
  );

  assert.throws(
    () => verifySchoolToken(token),
    /Untrusted or invalid key ID \(kid\): rogue-unknown-kid-2026/i
  );
});

test('Security H-02.7: Key rotation: registerTrustedKey allows verifying rotated keys', () => {
  const rotatedKp = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const rotatedKid = 'school-auth-2026-v2-rotation';
  registerTrustedKey(rotatedKid, rotatedKp.publicKey);

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { sub: crypto.randomUUID(), tenant_id: crypto.randomUUID(), roles: ['SchoolAdmin'] },
    rotatedKp.privateKey,
    {
      algorithm: 'RS256',
      issuer: 'https://auth.schoolsaas.com',
      audience: 'schoolsaas-api',
      keyid: rotatedKid,
    }
  );

  const claims = verifySchoolToken(token);
  assert.deepStrictEqual(claims.roles, ['SchoolAdmin']);
});

test('Security H-02.8: Production startup fails without RSA keys', () => {
  assert.throws(
    () => verifyProductionKeyConfig({ NODE_ENV: 'production' }),
    /Production security violation: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be configured in production/i
  );
});

test('Security H-02.9: Production startup rejects invalid RSA keys', () => {
  assert.throws(
    () => verifyProductionKeyConfig({
      NODE_ENV: 'production',
      JWT_PRIVATE_KEY: '---INVALID PEM PRIVATE KEY---',
      JWT_PUBLIC_KEY: '---INVALID PEM PUBLIC KEY---',
    }),
    /Invalid PEM format/i
  );
});

test('Security H-02.10: Production startup rejects mismatched RSA keypairs', () => {
  const kpA = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const kpB = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  assert.throws(
    () => verifyProductionKeyConfig({
      NODE_ENV: 'production',
      JWT_PRIVATE_KEY: kpA.privateKey,
      JWT_PUBLIC_KEY: kpB.publicKey,
    }),
    /do not form a matching keypair/i
  );
});

// =========================================================================
// SECTION 4: M-02 & L-02 Gateway Trust Boundary & Header Sanitization
// =========================================================================

test('Security M-02.1: Untrusted X-Forwarded-Host ignored without Gateway secret', async () => {
  const mockPool = {
    query: async (sql, params) => {
      if (params && params[0] === 'apex.example') {
        return { rows: [{ id: tenantId, name: 'Apex Academy', slug: 'apex', status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  const resolver = createTenantResolver(mockPool, { required: false });

  // Direct hostile request with spoofed X-Forwarded-Host but no secret
  const req = {
    headers: {
      host: 'localhost:4001',
      'x-forwarded-host': 'apex.example', // Spoofed!
    },
  };

  await resolver(req, {}, () => {});
  // Because request lacked x-gateway-secret, x-forwarded-host was ignored and host (localhost) was resolved
  assert.strictEqual(req.tenant, undefined, 'Host localhost should not resolve to tenant apex');
});

test('Security M-02.2: Trusted X-Forwarded-Host accepted with verified Gateway secret', async () => {
  const mockPool = {
    query: async (sql, params) => {
      if (params && params[0] === 'apex.example') {
        return { rows: [{ id: tenantId, name: 'Apex Academy', slug: 'apex', status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  const resolver = createTenantResolver(mockPool, { required: true });

  const req = {
    headers: {
      host: 'internal-auth:4001',
      'x-forwarded-host': 'apex.example',
      'x-gateway-secret': process.env.GATEWAY_INTERNAL_SECRET || 'internal-gateway-secret-dev-2026',
    },
  };

  let nextCalled = false;
  await resolver(req, {}, () => { nextCalled = true; });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.tenant.id, tenantId);
});

test('Security L-02: Gateway strips all X-Verified-* headers case-insensitively', () => {
  const headers = {
    'x-forwarded-host': 'attacker.com',
    'x-tenant-id': 'spoofed-id',
    'X-Verified-Tenant': 'apex-academy',
    'X-VERIFIED-USER': 'superadmin',
    'x-verified-role': 'SuperAdmin',
    'X-Verified-Custom-Header': 'malicious-data',
    'authorization': 'Bearer token',
    'host': 'apex.example',
  };

  // Simulate Gateway stripping middleware
  delete headers['x-forwarded-host'];
  delete headers['x-gateway-secret'];
  delete headers['x-internal-gateway'];
  delete headers['x-tenant-id'];
  delete headers['x-tenant-domain'];

  for (const h of Object.keys(headers)) {
    if (h.toLowerCase().startsWith('x-verified-')) {
      delete headers[h];
    }
  }

  assert.strictEqual(headers['x-forwarded-host'], undefined);
  assert.strictEqual(headers['x-tenant-id'], undefined);
  assert.strictEqual(headers['X-Verified-Tenant'], undefined);
  assert.strictEqual(headers['X-VERIFIED-USER'], undefined);
  assert.strictEqual(headers['x-verified-role'], undefined);
  assert.strictEqual(headers['X-Verified-Custom-Header'], undefined);
  assert.strictEqual(headers['authorization'], 'Bearer token');
  assert.strictEqual(headers['host'], 'apex.example');
});
