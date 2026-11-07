/**
 * Production SuperAdmin Bootstrap Script
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function bootstrap() {
  const secret = process.env.BOOTSTRAP_SUPERADMIN_SECRET;
  if (!secret || secret.length < 32) {
    console.error('ERROR: BOOTSTRAP_SUPERADMIN_SECRET is required and must be at least 32 characters.');
    process.exit(1);
  }

  const superAdminEmail = (process.env.SUPERADMIN_EMAIL || 'superadmin@schoolsaas.internal').toLowerCase().trim();
  let superAdminPassword = process.env.SUPERADMIN_PASSWORD;
  let isDynamicPassword = false;

  if (!superAdminPassword) {
    // Generate secure dynamic 24-character password
    superAdminPassword = crypto.randomBytes(18).toString('base64url');
    isDynamicPassword = true;
  } else if (superAdminPassword.length < 12) {
    console.error('ERROR: SUPERADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.DB_NAME || 'auth_db',
  });

  try {
    const client = await pool.connect();
    try {
      // 1. Idempotency check: see if SuperAdmin already exists
      const { rows: existingUsers } = await client.query(
        'SELECT id, email FROM users WHERE email = $1',
        [superAdminEmail]
      );

      if (existingUsers.length > 0) {
        console.log(`[BOOTSTRAP] SuperAdmin account (${superAdminEmail}) already exists. Skipping creation.`);
        return;
      }

      // 2. Hash password with bcrypt cost 12
      const hash = await bcrypt.hash(superAdminPassword, 12);

      await client.query('BEGIN');

      // 3. Create SuperAdmin user
      const { rows: newUsers } = await client.query(
        `INSERT INTO users (full_name, name, email, password_hash, status, email_verified_at)
         VALUES ($1, $2, $3, $4, 'active', now())
         RETURNING id, email`,
        ['Platform Super Administrator', 'SuperAdmin', superAdminEmail, hash]
      );
      const superAdminUser = newUsers[0];

      // 4. Find platform SuperAdmin role
      const { rows: roles } = await client.query(
        `SELECT id FROM roles WHERE role_key = 'SuperAdmin' AND tenant_id IS NULL`
      );

      if (roles.length === 0) {
        throw new Error('SuperAdmin platform role not found in database. Run migrations first.');
      }

      await client.query('COMMIT');

      // 5. Secure credential output
      if (isDynamicPassword) {
        const credPath = path.resolve(process.cwd(), '.bootstrap-credentials.json');
        const credPayload = {
          role: 'SuperAdmin',
          email: superAdminEmail,
          password: superAdminPassword,
          userId: superAdminUser.id,
          createdAt: new Date().toISOString(),
          notice: 'Keep this file strictly confidential and delete immediately after initial onboarding.',
        };
        fs.writeFileSync(credPath, JSON.stringify(credPayload, null, 2), { mode: 0o600 });
        console.log(`[BOOTSTRAP] SuperAdmin created successfully. One-time credentials written securely to ${credPath}.`);
      } else {
        console.log(`[BOOTSTRAP] SuperAdmin created successfully for ${superAdminEmail} using environment credentials.`);
      }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  bootstrap()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[BOOTSTRAP ERROR]', err.message);
      process.exit(1);
    });
}

module.exports = { bootstrap };
