const test = require('node:test');
const assert = require('node:assert');
const { createTenantResolver, resolveDomainFromHost } = require('../auth-service/src/middleware/tenant-resolver');

test('resolveDomainFromHost parses port correctly', () => {
  assert.strictEqual(resolveDomainFromHost('apex.example:4001'), 'apex.example');
  assert.strictEqual(resolveDomainFromHost('horizon.example'), 'horizon.example');
  assert.strictEqual(resolveDomainFromHost('Sub.SchoolSaaS.com:8080'), 'sub.schoolsaas.com');
  assert.strictEqual(resolveDomainFromHost(null), null);
});

test('tenantResolver resolves verified domain from Host header', async () => {
  const mockPool = {
    query: async (sql, params) => {
      if (sql.includes('tenant_domains')) {
        if (params[0] === 'apex.example') {
          return {
            rows: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Apex Academy', slug: 'apex-academy', status: 'active', timezone: 'Asia/Kolkata' }],
          };
        }
      }
      return { rows: [] };
    },
  };

  const resolver = createTenantResolver(mockPool, { required: true });
  const req = { headers: { host: 'apex.example:4001' } };
  let nextCalled = false;

  await resolver(req, {}, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(req.tenant.id, '11111111-1111-1111-1111-111111111111');
  assert.strictEqual(req.tenant.slug, 'apex-academy');
});

test('tenantResolver blocks suspended tenant with 403', async () => {
  const mockPool = {
    query: async () => ({
      rows: [{ id: '33333333-3333-3333-3333-333333333333', name: 'Suspended School', slug: 'suspended-school', status: 'suspended' }],
    }),
  };

  const resolver = createTenantResolver(mockPool, { required: true });
  let status;
  let responseData;
  const res = {
    status: (s) => {
      status = s;
      return { json: (d) => { responseData = d; } };
    },
  };

  await resolver({ headers: { host: 'suspended.example' } }, res, () => assert.fail('next should not be called'));

  assert.strictEqual(status, 403);
  assert.strictEqual(responseData.error.code, 'TENANT_SUSPENDED');
});

test('tenantResolver returns 404 for unknown tenant', async () => {
  const mockPool = {
    query: async () => ({ rows: [] }),
  };

  const resolver = createTenantResolver(mockPool, { required: true });
  let status;
  let responseData;
  const res = {
    status: (s) => {
      status = s;
      return { json: (d) => { responseData = d; } };
    },
  };

  await resolver({ headers: { host: 'unknown.example' } }, res, () => assert.fail('next should not be called'));

  assert.strictEqual(status, 404);
  assert.strictEqual(responseData.error.code, 'TENANT_NOT_FOUND');
});

test('tenantResolver header override: only active in dev when explicitly enabled', async () => {
  const mockPool = {
    query: async (sql, params) => {
      if (params[0] === 'apex.example') {
        return { rows: [{ id: '11111111-1111-1111-1111-111111111111', name: 'Apex', status: 'active' }] };
      }
      return { rows: [] };
    },
  };

  // Case 1: In production, X-Tenant-Domain is ignored
  const oldEnv = process.env.NODE_ENV;
  const oldAllow = process.env.ALLOW_HEADER_TENANT_RESOLVER;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_HEADER_TENANT_RESOLVER;

    const resolver = createTenantResolver(mockPool, { required: true });
    let status;
    const res = {
      status: (s) => {
        status = s;
        return { json: () => {} };
      },
    };

    // Host is unknown, but X-Tenant-Domain is provided -> should be ignored in production
    await resolver({ headers: { host: 'unknown.com', 'x-tenant-domain': 'apex.example' } }, res, () => assert.fail('should fail'));
    assert.strictEqual(status, 404);

    // Case 2: In development with ALLOW_HEADER_TENANT_RESOLVER=true
    process.env.NODE_ENV = 'development';
    process.env.ALLOW_HEADER_TENANT_RESOLVER = 'true';

    let nextCalled = false;
    const reqDev = { headers: { host: 'localhost:8080', 'x-tenant-domain': 'apex.example' } };
    await resolver(reqDev, res, () => { nextCalled = true; });
    assert.strictEqual(nextCalled, true);
    assert.strictEqual(reqDev.tenant.id, '11111111-1111-1111-1111-111111111111');
  } finally {
    process.env.NODE_ENV = oldEnv;
    process.env.ALLOW_HEADER_TENANT_RESOLVER = oldAllow;
  }
});
