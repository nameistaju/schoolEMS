const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const express = require('express');
const knex = require('knex');
const knexConfig = require('../auth-service/knexfile');
const { Client, Pool } = require('pg');
const bcrypt = require('bcryptjs');

const { createTenantResolver } = require('../auth-service/src/middleware/tenant-resolver');
const { createAuthRouter } = require('../auth-service/src/routes/v1/auth');
const { createTenantsRouter } = require('../auth-service/src/routes/v1/tenants');
const { createBranchesRouter } = require('../auth-service/src/routes/v1/branches');
const { createMembershipsRouter } = require('../auth-service/src/routes/v1/memberships');
const { createSessionsRouter } = require('../auth-service/src/routes/v1/sessions');
const { signSchoolToken, hashToken, generateRefreshToken } = require('../common/auth');

const TEST_DB = 'disposable_api_test_sms_db';
const PG_PORT = 5432;
const AUTH_PORT = 4101;

let server;
let pool;
let superAdminToken;
let tenantA;
let tenantB;

function httpRequest({ port = AUTH_PORT, path, method = 'GET', headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = { ...headers };
    if (payload) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let data;
          try { data = JSON.parse(raw); } catch { data = raw; }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json: async () => data,
            data,
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test.before(async () => {
  // 1. Ensure disposable API test database exists and is migrated
  const adminClient = new Client({
    host: '127.0.0.1',
    port: PG_PORT,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
  });
  await adminClient.connect();
  try {
    const { rowCount } = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [TEST_DB]);
    if (rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${TEST_DB}`);
    }
  } finally {
    await adminClient.end();
  }

  // 2. Migrate test database
  const db = knex({
    ...knexConfig.test,
    connection: {
      ...knexConfig.test.connection,
      database: TEST_DB,
    },
  });
  try {
    await db.migrate.latest();
  } finally {
    await db.destroy();
  }

  // 3. Connect as runtime user
  pool = new Pool({
    host: '127.0.0.1',
    port: PG_PORT,
    user: 'school_app_user',
    password: 'runtime_secure_pass',
    database: TEST_DB,
  });

  const app = express();
  app.use(express.json());

  // Set up tenant resolver globally
  const tenantResolver = createTenantResolver(pool, { required: false });
  app.use(tenantResolver);

  // Mount v1 routers
  app.use('/api/v1/auth', createAuthRouter(pool, tenantResolver));
  app.use('/api/v1/tenants', createTenantsRouter(pool));
  app.use('/api/v1/branches', createBranchesRouter(pool));
  app.use('/api/v1/memberships', createMembershipsRouter(pool));
  app.use('/api/v1/sessions', createSessionsRouter(pool));

  await new Promise((resolve) => {
    server = app.listen(AUTH_PORT, resolve);
  });

  // Seed SuperAdmin user
  const passwordHash = await bcrypt.hash('SuperAdminPassword@123', 10);
  const { rows: saUsers } = await pool.query(`
    INSERT INTO users (full_name, name, email, password_hash, status, email_verified_at)
    VALUES ('Global Super Admin', 'SuperAdmin', 'superadmin@schoolsaas.test', $1, 'active', now())
    ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
    RETURNING id, email
  `, [passwordHash]);

  const superAdminId = saUsers[0].id;

  superAdminToken = signSchoolToken({
    sub: superAdminId,
    roles: ['SuperAdmin'],
    email: 'superadmin@schoolsaas.test',
  });

  // Seed Apex SchoolAdmin user
  const adminAId = 'a1111111-1111-1111-1111-111111111111';
  await pool.query(`
    INSERT INTO users (id, full_name, name, email, password_hash, status, email_verified_at)
    VALUES ($1, 'Apex Admin', 'ApexAdmin', 'admin@apex.test', $2, 'active', now())
    ON CONFLICT (id) DO NOTHING
  `, [adminAId, passwordHash]);
});

test.after(async () => {
  if (server) await new Promise((r) => server.close(r));
  if (pool) await pool.end();
});

test('API: SuperAdmin onboards Tenant A (Apex Academy) and Tenant B (Horizon)', async () => {
  const nonce = Date.now();
  const domainA = `apex-${nonce}.test`;
  const domainB = `horizon-${nonce}.test`;

  // 1. Create Tenant A
  const resA = await httpRequest({
    method: 'POST',
    path: '/api/v1/tenants',
    headers: { authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Apex Academy',
      slug: `apex-academy-${nonce}`,
      timezone: 'Asia/Kolkata',
      contact_email: `admin@${domainA}`,
      domain: domainA,
    },
  });

  assert.strictEqual(resA.status, 201);
  assert.strictEqual(resA.data.success, true);
  tenantA = resA.data.data.tenant;
  tenantA.domain = domainA;
  assert.strictEqual(tenantA.name, 'Apex Academy');

  // 2. Create Tenant B
  const resB = await httpRequest({
    method: 'POST',
    path: '/api/v1/tenants',
    headers: { authorization: `Bearer ${superAdminToken}` },
    body: {
      name: 'Horizon International',
      slug: `horizon-intl-${nonce}`,
      timezone: 'Asia/Kolkata',
      contact_email: `admin@${domainB}`,
      domain: domainB,
    },
  });

  assert.strictEqual(resB.status, 201);
  assert.strictEqual(resB.data.success, true);
  tenantB = resB.data.data.tenant;
  tenantB.domain = domainB;
  assert.strictEqual(tenantB.name, 'Horizon International');
});

test('API: Branch creation and listing under Tenant A context', async () => {
  const adminAId = 'a1111111-1111-1111-1111-111111111111';
  const adminAToken = signSchoolToken({
    sub: adminAId,
    tenant_id: tenantA.id,
    roles: ['SchoolAdmin'],
    email: `admin@${tenantA.domain}`,
  });

  // POST /api/v1/branches with Host: tenantA.domain
  const createRes = await httpRequest({
    method: 'POST',
    path: '/api/v1/branches',
    headers: {
      host: tenantA.domain,
      authorization: `Bearer ${adminAToken}`,
    },
    body: {
      name: 'Apex West Campus',
      code: 'WEST',
      address: { city: 'Hyderabad' },
    },
  });

  assert.strictEqual(createRes.status, 201);
  assert.strictEqual(createRes.data.success, true);
  assert.strictEqual(createRes.data.data.branch.code, 'WEST');
  assert.strictEqual(createRes.data.data.branch.tenant_id, tenantA.id);

  // GET /api/v1/branches with Host: tenantA.domain
  const listRes = await httpRequest({
    method: 'GET',
    path: '/api/v1/branches',
    headers: {
      host: tenantA.domain,
      authorization: `Bearer ${adminAToken}`,
    },
  });

  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.data.success, true);
  assert.ok(listRes.data.data.branches.length >= 2);
  assert.ok(listRes.data.data.branches.every((b) => b.tenant_id === tenantA.id));
});

test('API: Cross-Tenant Protection: Tenant A token rejected on Tenant B Host', async () => {
  const adminAId = 'a1111111-1111-1111-1111-111111111111';
  const adminAToken = signSchoolToken({
    sub: adminAId,
    tenant_id: tenantA.id,
    roles: ['SchoolAdmin'],
    email: `admin@${tenantA.domain}`,
  });

  // Attempt to access with Tenant B host header
  const crossRes = await httpRequest({
    method: 'GET',
    path: '/api/v1/branches',
    headers: {
      host: tenantB.domain, // Tenant B domain!
      authorization: `Bearer ${adminAToken}`, // Tenant A token!
    },
  });

  assert.strictEqual(crossRes.status, 403);
  assert.strictEqual(crossRes.data.success, false);
  assert.match(crossRes.data.error.message, /Tenant Cross-Talk Blocked/i);
});

test('API: Membership invitation, role assignment, and profile retrieval', async () => {
  const adminAId = 'a1111111-1111-1111-1111-111111111111';
  const adminAToken = signSchoolToken({
    sub: adminAId,
    tenant_id: tenantA.id,
    roles: ['SchoolAdmin'],
  });

  // Invite teacher to Apex
  const inviteRes = await httpRequest({
    method: 'POST',
    path: '/api/v1/memberships/invite',
    headers: {
      host: tenantA.domain,
      authorization: `Bearer ${adminAToken}`,
    },
    body: {
      email: `teacher.${Date.now()}@apex.test`,
      fullName: 'Srinivasa Rao',
      roleKey: 'Teacher',
    },
  });

  assert.strictEqual(inviteRes.status, 201);
  assert.strictEqual(inviteRes.data.success, true);
  assert.match(inviteRes.data.data.user.email, /teacher\./);

  // List members of Apex
  const listRes = await httpRequest({
    method: 'GET',
    path: '/api/v1/memberships',
    headers: {
      host: tenantA.domain,
      authorization: `Bearer ${adminAToken}`,
    },
  });

  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.data.success, true);
  assert.ok(listRes.data.data.members.some((m) => m.full_name === 'Srinivasa Rao'));
});

test('API: Session refresh rotation and family compromise detection', async () => {
  const testUserId = crypto.randomUUID();

  await pool.query(`
    INSERT INTO users (id, full_name, name, email, password_hash, status)
    VALUES ($1, 'Session Test User', 'Test', $2, 'hash', 'active')
    ON CONFLICT (id) DO NOTHING
  `, [testUserId, `session_${testUserId}@test.example`]);

  const rawToken1 = generateRefreshToken();
  const tokenHash1 = hashToken(rawToken1);
  const familyId = crypto.randomUUID();

  await pool.query(`
    INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
    VALUES ($1, $2, $3, now() + interval '7 days')
  `, [testUserId, tokenHash1, familyId]);

  // Legitimate refresh with rawToken1
  const refreshRes1 = await httpRequest({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    body: { refreshToken: rawToken1 },
  });

  assert.strictEqual(refreshRes1.status, 200);
  assert.strictEqual(refreshRes1.data.success, true);
  assert.ok(refreshRes1.data.data.accessToken);

  // Extract rotated cookie
  const cookieHeader = refreshRes1.headers['set-cookie'];
  assert.ok(cookieHeader);
  const cookieStr = Array.isArray(cookieHeader) ? cookieHeader.join(';') : String(cookieHeader);
  assert.match(cookieStr, /tp_refresh=/);
  assert.match(cookieStr, /HttpOnly/i);
  assert.match(cookieStr, /SameSite=Strict/i);

  // Reuse rawToken1 (Compromise simulation!)
  const reuseRes = await httpRequest({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    body: { refreshToken: rawToken1 },
  });

  assert.strictEqual(reuseRes.status, 401);
  assert.strictEqual(reuseRes.data.success, false);
  assert.match(reuseRes.data.error.message, /refresh token reuse detected/i);

  // Verify all tokens in family revoked
  const { rows: familyTokens } = await pool.query(
    'SELECT revoked_at FROM refresh_tokens WHERE family_id = $1',
    [familyId]
  );
  assert.ok(familyTokens.every((t) => t.revoked_at !== null), 'All tokens in family must be revoked on reuse');
});
