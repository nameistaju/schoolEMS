const path = require('path');

const config = {
  client: 'pg',
  connection: {
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PG_MIGRATION_USER || process.env.PGUSER || 'postgres',
    password: process.env.PG_MIGRATION_PASSWORD || process.env.PGPASSWORD || 'postgres',
    database: process.env.DB_NAME || 'auth_db',
  },
  pool: {
    min: 1,
    max: 5,
    afterCreate: (conn, done) => {
      if (process.env.SET_SCHEMA_OWNER === 'true') {
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
