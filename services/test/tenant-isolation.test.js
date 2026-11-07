const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { withTenantContext, UUID_REGEX } = require('../common/db');

test('UUID_REGEX accepts valid RFC UUIDs and rejects invalid strings', () => {
  const validUUIDs = [
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8', // v1
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', // v4
    '018f3a3b-2f6c-7e9b-a3d8-5b1287c94b32', // v7
    '00000000-0000-0000-0000-000000000000', // nil
  ];

  for (const uuid of validUUIDs) {
    assert.strictEqual(UUID_REGEX.test(uuid), true, `Failed on ${uuid}`);
  }

  const invalidStrings = [
    'not-a-uuid',
    '6ba7b810-9dad-11d1-80b4',
    "'; DROP TABLE users; --",
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8-extra',
    '',
    null,
    12345,
  ];

  for (const str of invalidStrings) {
    assert.strictEqual(UUID_REGEX.test(str), false, `Should have failed on ${str}`);
  }
});

test('withTenantContext rejects invalid UUID format before acquiring connection', async () => {
  const dummyPool = {
    connect: () => assert.fail('pool.connect should not be called on invalid UUID'),
  };

  await assert.rejects(
    () => withTenantContext(dummyPool, 'not-a-uuid', async () => {}),
    /Tenant context error: valid UUID format is required/i
  );

  await assert.rejects(
    () => withTenantContext(dummyPool, null, async () => {}),
    /Tenant context error: valid UUID format is required/i
  );
});

test('withTenantContext executes parameterized transaction lifecycle', async () => {
  const tenantId = crypto.randomUUID();
  const executedQueries = [];
  let released = false;

  const mockClient = {
    query: async (sql, params) => {
      executedQueries.push({ sql, params });
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };

  const mockPool = {
    connect: async () => mockClient,
  };

  const result = await withTenantContext(mockPool, tenantId, async (client) => {
    await client.query('SELECT * FROM branches');
    return 'success-result';
  });

  assert.strictEqual(result, 'success-result');
  assert.strictEqual(released, true);

  // Check statement execution sequence
  assert.strictEqual(executedQueries[0].sql, 'BEGIN');
  assert.strictEqual(executedQueries[1].sql, 'SELECT set_config($1, $2, $3)');
  assert.deepStrictEqual(executedQueries[1].params, ['app.current_tenant_id', tenantId, true]);
  assert.strictEqual(executedQueries[2].sql, 'SELECT * FROM branches');
  assert.strictEqual(executedQueries[3].sql, 'COMMIT');
  assert.strictEqual(executedQueries[4].sql, "SELECT set_config('app.current_tenant_id', '', false)");
});

test('withTenantContext executes ROLLBACK and cleans context on error', async () => {
  const tenantId = crypto.randomUUID();
  const executedQueries = [];
  let released = false;

  const mockClient = {
    query: async (sql, params) => {
      executedQueries.push({ sql, params });
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  };

  const mockPool = {
    connect: async () => mockClient,
  };

  await assert.rejects(
    () =>
      withTenantContext(mockPool, tenantId, async (client) => {
        await client.query('INSERT INTO branches ...');
        throw new Error('Database constraint violation');
      }),
    /Database constraint violation/
  );

  assert.strictEqual(released, true);
  assert.strictEqual(executedQueries[0].sql, 'BEGIN');
  assert.strictEqual(executedQueries[1].sql, 'SELECT set_config($1, $2, $3)');
  assert.strictEqual(executedQueries[2].sql, 'INSERT INTO branches ...');
  assert.strictEqual(executedQueries[3].sql, 'ROLLBACK');
  assert.strictEqual(executedQueries[4].sql, "SELECT set_config('app.current_tenant_id', '', false)");
});
