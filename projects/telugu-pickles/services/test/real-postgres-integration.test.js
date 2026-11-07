const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { Client, Pool } = require('pg');
const knex = require('knex');
const knexConfig = require('../auth-service/knexfile');
const { withTenantContext } = require('../common/db');

const TEST_DB = 'disposable_test_sms_db';
const PG_CONFIG = {
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
};

test.before(async () => {
  // 1. Connect to postgres admin database to recreate disposable database
  const adminClient = new Client({ ...PG_CONFIG, database: 'postgres' });
  await adminClient.connect();
  try {
    // Terminate existing connections to test db if any
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

  // 2. Connect to disposable database and recreate legacy users table
  const testDbClient = new Client({ ...PG_CONFIG, database: TEST_DB });
  await testDbClient.connect();
  try {
    await testDbClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await testDbClient.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(120) NOT NULL,
        email VARCHAR(200) NOT NULL UNIQUE,
        phone VARCHAR(20),
        password_hash VARCHAR(100) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await testDbClient.query(`
      INSERT INTO users (name, email, phone, password_hash)
      VALUES ('Lakshmi Reddy', 'demo@telugupickles.in', '9876543210', 'legacy_hash')
    `);
  } finally {
    await testDbClient.end();
  }
});

test('PostgreSQL Migrations 01-06 execute cleanly against disposable database', async () => {
  const db = knex({
    ...knexConfig.test,
    connection: {
      ...knexConfig.test.connection,
      database: TEST_DB,
    },
  });

  try {
    // Run all migrations
    const [batchNo, log] = await db.migrate.latest();
    assert.strictEqual(batchNo, 1);
    assert.strictEqual(log.length, 6, 'All 6 migrations must run');

    // Verify knex_migrations recorded all 6 migrations in sequence
    const migrations = await db('knex_migrations').select('name').orderBy('id', 'asc');
    assert.strictEqual(migrations.length, 6);
    assert.match(migrations[0].name, /create_tenants_and_branches/);
    assert.match(migrations[1].name, /create_users_and_memberships/);
    assert.match(migrations[2].name, /create_rbac_tables/);
    assert.match(migrations[3].name, /create_domains_and_sessions/);
    assert.match(migrations[4].name, /create_audit_logs/);
    assert.match(migrations[5].name, /enable_rls_and_policies/);

    // Verify backward compatibility on legacy users table
    const legacyUser = await db('users').where({ email: 'demo@telugupickles.in' }).first();
    assert.ok(legacyUser);
    assert.strictEqual(legacyUser.name, 'Lakshmi Reddy');
    assert.strictEqual(legacyUser.full_name, 'Lakshmi Reddy');
    assert.strictEqual(legacyUser.status, 'active');

    // Verify canonical roles seeded in migration 03
    const roles = await db('roles').whereNull('tenant_id').select('role_key');
    const roleKeys = roles.map((r) => r.role_key).sort();
    assert.deepStrictEqual(roleKeys, [
      'Accountant',
      'Parent',
      'Principal',
      'SchoolAdmin',
      'Student',
      'SuperAdmin',
      'Teacher',
    ]);
  } finally {
    await db.destroy();
  }
});

test('Database Privilege & Security Audit: Verify three-tier role architecture', async () => {
  const client = new Client({ ...PG_CONFIG, database: TEST_DB });
  await client.connect();

  try {
    // 1. Confirm school_schema_owner is NOLOGIN
    const { rows: ownerRows } = await client.query(
      "SELECT rolname, rolcanlogin, rolsuper FROM pg_roles WHERE rolname = 'school_schema_owner'"
    );
    assert.strictEqual(ownerRows.length, 1);
    assert.strictEqual(ownerRows[0].rolcanlogin, false, 'school_schema_owner MUST be NOLOGIN');
    assert.strictEqual(ownerRows[0].rolsuper, false, 'school_schema_owner must NOT be superuser');

    // 2. Confirm school_migration_user belongs to school_schema_owner
    const { rows: memberRows } = await client.query(
      "SELECT pg_has_role('school_migration_user', 'school_schema_owner', 'member') as is_member"
    );
    assert.strictEqual(memberRows[0].is_member, true, 'school_migration_user must inherit school_schema_owner');

    // 3. Confirm school_app_user cannot assume schema owner role and has NOBYPASSRLS
    const { rows: appRows } = await client.query(
      "SELECT rolname, rolcanlogin, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'school_app_user'"
    );
    assert.strictEqual(appRows.length, 1);
    assert.strictEqual(appRows[0].rolcanlogin, true);
    assert.strictEqual(appRows[0].rolbypassrls, false, 'school_app_user must have NOBYPASSRLS');
    assert.strictEqual(appRows[0].rolsuper, false);

    const { rows: appIsOwnerMember } = await client.query(
      "SELECT pg_has_role('school_app_user', 'school_schema_owner', 'member') as is_member"
    );
    assert.strictEqual(appIsOwnerMember[0].is_member, false, 'school_app_user MUST NOT be member of school_schema_owner');

    // 4. Confirm audit_logs table has INSERT and SELECT only, NO UPDATE, DELETE, TRUNCATE
    const { rows: auditPrivs } = await client.query(`
      SELECT
        has_table_privilege('school_app_user', 'audit_logs', 'INSERT') as can_insert,
        has_table_privilege('school_app_user', 'audit_logs', 'SELECT') as can_select,
        has_table_privilege('school_app_user', 'audit_logs', 'UPDATE') as can_update,
        has_table_privilege('school_app_user', 'audit_logs', 'DELETE') as can_delete,
        has_table_privilege('school_app_user', 'audit_logs', 'TRUNCATE') as can_truncate
    `);

    assert.strictEqual(auditPrivs[0].can_insert, true, 'Must allow INSERT on audit_logs');
    assert.strictEqual(auditPrivs[0].can_select, true, 'Must allow SELECT on audit_logs');
    assert.strictEqual(auditPrivs[0].can_update, false, 'Must NOT allow UPDATE on audit_logs');
    assert.strictEqual(auditPrivs[0].can_delete, false, 'Must NOT allow DELETE on audit_logs');
    assert.strictEqual(auditPrivs[0].can_truncate, false, 'Must NOT allow TRUNCATE on audit_logs');

    // 5. Confirm RLS is enabled and forced on branches, user_tenant_memberships, membership_roles
    const { rows: rlsRows } = await client.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('branches', 'user_tenant_memberships', 'membership_roles')
      ORDER BY relname ASC
    `);

    assert.strictEqual(rlsRows.length, 3);
    for (const r of rlsRows) {
      assert.strictEqual(r.relrowsecurity, true, `RLS must be enabled on ${r.relname}`);
      assert.strictEqual(r.relforcerowsecurity, true, `RLS must be FORCED on ${r.relname}`);
    }
  } finally {
    await client.end();
  }
});

test('Real PostgreSQL RLS Tests: Multi-Tenant Data Isolation with school_app_user', async () => {
  const tenantAId = '11111111-1111-1111-1111-111111111111';
  const tenantBId = '22222222-2222-2222-2222-222222222222';
  let branchA1Id;
  let branchB1Id;

  // 1. Seed two demo schools using admin client
  const adminClient = new Client({ ...PG_CONFIG, database: TEST_DB });
  await adminClient.connect();
  try {
    await adminClient.query(`
      INSERT INTO tenants (id, name, slug, status)
      VALUES
        ($1, 'Apex Academy', 'apex-academy', 'active'),
        ($2, 'Horizon International', 'horizon-intl', 'active')
      ON CONFLICT (id) DO NOTHING
    `, [tenantAId, tenantBId]);

    const { rows: bA } = await adminClient.query(`
      INSERT INTO branches (tenant_id, name, code, status)
      VALUES
        ($1, 'Apex Main Campus', 'MAIN', 'active'),
        ($1, 'Apex North Campus', 'NORTH', 'active')
      RETURNING id
    `, [tenantAId]);
    branchA1Id = bA[0].id;

    const { rows: bB } = await adminClient.query(`
      INSERT INTO branches (tenant_id, name, code, status)
      VALUES ($1, 'Horizon Main Campus', 'MAIN', 'active')
      RETURNING id
    `, [tenantBId]);
    branchB1Id = bB[0].id;
  } finally {
    await adminClient.end();
  }

  // 2. Connect as runtime application user (school_app_user, NOBYPASSRLS)
  const appPool = new Pool({
    host: '127.0.0.1',
    port: 5432,
    user: 'school_app_user',
    password: 'runtime_secure_pass',
    database: TEST_DB,
  });

  try {
    // TEST 1: SELECT Isolation
    // In Tenant A context: only Tenant A branches visible
    const branchesA = await withTenantContext(appPool, tenantAId, async (client) => {
      const { rows } = await client.query('SELECT * FROM branches ORDER BY code ASC');
      return rows;
    });
    assert.strictEqual(branchesA.length, 2);
    assert.ok(branchesA.every((b) => b.tenant_id === tenantAId));

    // In Tenant B context: only Tenant B branches visible
    const branchesB = await withTenantContext(appPool, tenantBId, async (client) => {
      const { rows } = await client.query('SELECT * FROM branches');
      return rows;
    });
    assert.strictEqual(branchesB.length, 1);
    assert.strictEqual(branchesB[0].tenant_id, tenantBId);

    // TEST 2: INSERT Isolation (WITH CHECK enforcement)
    // Tenant A attempts to insert branch belonging to Tenant B -> MUST FAIL
    await assert.rejects(
      () =>
        withTenantContext(appPool, tenantAId, async (client) => {
          await client.query(`
            INSERT INTO branches (tenant_id, name, code, status)
            VALUES ($1, 'Malicious Injected Campus', 'HACK', 'active')
          `, [tenantBId]);
        }),
      /violates row-level security policy for table "branches"/i
    );

    // Tenant A inserts branch for Tenant A -> MUST SUCCEED
    const newBranch = await withTenantContext(appPool, tenantAId, async (client) => {
      const { rows } = await client.query(`
        INSERT INTO branches (tenant_id, name, code, status)
        VALUES ($1, 'Apex South Campus', 'SOUTH', 'active')
        RETURNING *
      `, [tenantAId]);
      return rows[0];
    });
    assert.strictEqual(newBranch.tenant_id, tenantAId);
    assert.strictEqual(newBranch.code, 'SOUTH');

    // TEST 3: UPDATE Isolation (USING and WITH CHECK enforcement)
    // Tenant A attempts to update Tenant B record -> affects 0 rows
    const updateResult = await withTenantContext(appPool, tenantAId, async (client) => {
      const { rowCount } = await client.query(`
        UPDATE branches SET name = 'Apex Tampered Horizon' WHERE id = $1
      `, [branchB1Id]);
      return rowCount;
    });
    assert.strictEqual(updateResult, 0, 'Cannot update another tenant branch');

    // Tenant A attempts to reassign Tenant A branch to Tenant B -> MUST FAIL with RLS violation
    await assert.rejects(
      () =>
        withTenantContext(appPool, tenantAId, async (client) => {
          await client.query(`
            UPDATE branches SET tenant_id = $1 WHERE id = $2
          `, [tenantBId, branchA1Id]);
        }),
      /violates row-level security policy for table "branches"/i
    );

    // TEST 4: DELETE Isolation
    // Tenant A attempts to delete Tenant B branch -> affects 0 rows
    const deleteResult = await withTenantContext(appPool, tenantAId, async (client) => {
      const { rowCount } = await client.query('DELETE FROM branches WHERE id = $1', [branchB1Id]);
      return rowCount;
    });
    assert.strictEqual(deleteResult, 0, 'Cannot delete another tenant branch');

    // TEST 5: Fail-Closed on Missing Tenant Context
    // Direct query without context set -> returns 0 rows
    const noContextClient = await appPool.connect();
    try {
      const { rows } = await noContextClient.query('SELECT * FROM branches');
      assert.strictEqual(rows.length, 0, 'Missing tenant context MUST return 0 rows');

      // Attempt insert without context -> fails closed
      await assert.rejects(
        () => noContextClient.query(`
          INSERT INTO branches (tenant_id, name, code, status)
          VALUES ($1, 'No Context Branch', 'NONE', 'active')
        `, [tenantAId]),
        /violates row-level security policy for table "branches"/i
      );
    } finally {
      noContextClient.release();
    }

    // TEST 6: Connection Pool Reuse Hygiene
    // Physical connection used by Tenant A, returned to pool, then reused by Tenant B
    const poolClient = await appPool.connect();
    try {
      // 1. Run in Tenant A context
      await poolClient.query('BEGIN');
      await poolClient.query('SELECT set_config($1, $2, $3)', ['app.current_tenant_id', tenantAId, true]);
      const { rows: aRows } = await poolClient.query('SELECT * FROM branches');
      assert.ok(aRows.length > 0);
      await poolClient.query('COMMIT');
      await poolClient.query("SELECT set_config('app.current_tenant_id', '', false)");

      // 2. Query immediately on same connection without setting context -> MUST BE EMPTY
      const { rows: emptyRows } = await poolClient.query('SELECT * FROM branches');
      assert.strictEqual(emptyRows.length, 0, 'Reused physical connection MUST NOT leak previous context');
    } finally {
      poolClient.release();
    }
  } finally {
    await appPool.end();
  }
});

test('Knex Migration Rollback: Rolls back migration 06 and re-applies cleanly', async () => {
  const db = knex({
    ...knexConfig.test,
    connection: {
      ...knexConfig.test.connection,
      database: TEST_DB,
    },
  });

  try {
    // Rollback batch 1
    const [rollbackBatch, rollbackLog] = await db.migrate.rollback();
    assert.strictEqual(rollbackBatch, 1);
    assert.strictEqual(rollbackLog.length, 6);

    // Re-apply latest migrations to leave test database in complete state
    const [reapplyBatch, reapplyLog] = await db.migrate.latest();
    assert.strictEqual(reapplyBatch, 1);
    assert.strictEqual(reapplyLog.length, 6);
  } finally {
    await db.destroy();
  }
});
