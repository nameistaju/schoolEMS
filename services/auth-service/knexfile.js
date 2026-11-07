const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function getPgHost() {
  const host = process.env.PGHOST || '127.0.0.1';
  if (process.platform === 'win32' && (host === '127.0.0.1' || host === 'localhost')) {
    try {
      const { execSync } = require('child_process');
      const wslIp = execSync('wsl -d Ubuntu -- bash -c "hostname -I"', { encoding: 'utf8', timeout: 2000 }).trim().split(' ')[0];
      if (wslIp && wslIp.startsWith('172.')) return wslIp;
    } catch {
      // fallback
    }
  }
  return host;
}

const config = {
  client: 'pg',
  connection: {
    host: getPgHost(),
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PG_MIGRATION_USER || process.env.PGUSER || 'postgres',
    password: process.env.PG_MIGRATION_PASSWORD || process.env.PGPASSWORD || 'postgres',
    database: process.env.DB_NAME || 'auth_db',
  },
  pool: {
    min: 1,
    max: 5,
    afterCreate: (conn, done) => {
      const user = process.env.PG_MIGRATION_USER || process.env.PGUSER;
      if (user === 'school_migration_user' || process.env.SET_SCHEMA_OWNER === 'true') {
        conn.query('SET ROLE school_schema_owner;', (err) => done(err, conn));
      } else {
        done(null, conn);
      }
    },
  },
  migrations: {
    directory: path.join(__dirname, 'migrations'),
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: path.join(__dirname, 'seeds'),
  },
};

module.exports = {
  development: config,
  test: config,
  production: config,
};
