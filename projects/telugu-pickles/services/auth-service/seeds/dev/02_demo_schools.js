/**
 * Development Demo School Seeding Script
 * Strictly for local development & automated testing.
 * Uses reserved RFC 2606 / RFC 6761 domains (.example).
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function seedDemoSchools() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY VIOLATION: Demo school seeding is strictly prohibited in production!');
  }

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.DB_NAME || 'auth_db',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Roles lookup
    const { rows: roles } = await client.query("SELECT id, role_key FROM roles WHERE tenant_id IS NULL");
    const roleMap = Object.fromEntries(roles.map((r) => [r.role_key, r.id]));

    const defaultPassword = 'DemoPassword@2026';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // 2. Demo Schools Definition
    const schools = [
      {
        name: 'Apex Academy',
        slug: 'apex-academy',
        domain: 'apex.example',
        timezone: 'Asia/Kolkata',
        admin: {
          email: 'admin@apex.example',
          name: 'Apex Administrator',
        },
        branches: [
          { name: 'Main Campus', code: 'MAIN', address: { city: 'Hyderabad', state: 'Telangana' } },
          { name: 'North Campus', code: 'NORTH', address: { city: 'Secunderabad', state: 'Telangana' } },
        ],
      },
      {
        name: 'Horizon International',
        slug: 'horizon-intl',
        domain: 'horizon.example',
        timezone: 'Asia/Kolkata',
        admin: {
          email: 'admin@horizon.example',
          name: 'Horizon Administrator',
        },
        branches: [
          { name: 'Main Campus', code: 'MAIN', address: { city: 'Bengaluru', state: 'Karnataka' } },
        ],
      },
    ];

    for (const school of schools) {
      // Upsert Tenant
      const { rows: tenantRows } = await client.query(
        `INSERT INTO tenants (name, slug, timezone, status, contact_email)
         VALUES ($1, $2, $3, 'active', $4)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [school.name, school.slug, school.timezone, school.admin.email]
      );
      const tenantId = tenantRows[0].id;

      // Upsert Domain
      await client.query(
        `INSERT INTO tenant_domains (tenant_id, domain, domain_type, verification_status, is_primary)
         VALUES ($1, $2, 'subdomain', 'verified', true)
         ON CONFLICT (domain) DO UPDATE SET verification_status = 'verified'`,
        [tenantId, school.domain]
      );

      // Upsert Admin User
      const { rows: userRows } = await client.query(
        `INSERT INTO users (full_name, name, email, password_hash, status, email_verified_at)
         VALUES ($1, $2, lower($3), $4, 'active', now())
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [school.admin.name, school.admin.name, school.admin.email, passwordHash]
      );
      const userId = userRows[0].id;

      // Upsert Membership
      const { rows: memberRows } = await client.query(
        `INSERT INTO user_tenant_memberships (tenant_id, user_id, status, joined_at)
         VALUES ($1, $2, 'active', now())
         ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'active'
         RETURNING id`,
        [tenantId, userId]
      );
      const membershipId = memberRows[0].id;

      // Upsert Branches
      const branchIds = [];
      for (const b of school.branches) {
        const { rows: branchRows } = await client.query(
          `INSERT INTO branches (tenant_id, name, code, address, status)
           VALUES ($1, $2, $3, $4, 'active')
           ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [tenantId, b.name, b.code, JSON.stringify(b.address)]
        );
        branchIds.push(branchRows[0].id);
      }

      // Assign SchoolAdmin Role to Admin User (Tenant-wide: branch_id = NULL)
      if (roleMap.SchoolAdmin) {
        await client.query(
          `INSERT INTO membership_roles (membership_id, role_id, branch_id)
           VALUES ($1, $2, NULL)
           ON CONFLICT (membership_id, role_id, branch_id) DO NOTHING`,
          [membershipId, roleMap.SchoolAdmin]
        );
      }
    }

    await client.query('COMMIT');
    console.log('[SEED] Demo schools seeded successfully.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDemoSchools()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[SEED ERROR]', err.message);
      process.exit(1);
    });
}

module.exports = { seedDemoSchools };
