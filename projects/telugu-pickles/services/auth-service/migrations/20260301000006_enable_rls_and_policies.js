/**
 * Migration 06: Provision database roles, table grants, and enable Row-Level Security (RLS)
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

exports.up = async function (knex) {
  await knex.raw(`
    -- 1. Create Schema Owner (NOLOGIN group role)
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_schema_owner') THEN
        CREATE ROLE school_schema_owner WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
      END IF;
    END $$;

    -- 2. Create Controlled Migration Identity
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_migration_user') THEN
        CREATE ROLE school_migration_user WITH LOGIN PASSWORD 'migration_secure_pass'
          NOSUPERUSER NOCREATEDB NOCREATEROLE IN ROLE school_schema_owner;
      END IF;
    END $$;

    -- 3. Create Runtime Application Role (NOBYPASSRLS)
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'school_app_user') THEN
        CREATE ROLE school_app_user WITH LOGIN PASSWORD 'runtime_secure_pass'
          NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
      END IF;
    END $$;

    -- 4. Schema Ownership & Default Privileges
    DO $$
    BEGIN
      ALTER SCHEMA public OWNER TO school_schema_owner;
    EXCEPTION
      WHEN insufficient_privilege THEN
        -- When running in restricted development setups where current user is not superuser
        NULL;
    END $$;

    DO $$
    BEGIN
      ALTER DEFAULT PRIVILEGES FOR ROLE school_schema_owner IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO school_app_user;
      ALTER DEFAULT PRIVILEGES FOR ROLE school_schema_owner IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO school_app_user;
    EXCEPTION
      WHEN insufficient_privilege THEN
        NULL;
    END $$;

    -- 5. Table-Specific Grants on Operational Tables
    GRANT USAGE ON SCHEMA public TO school_app_user;

    GRANT SELECT, INSERT, UPDATE, DELETE ON
      tenants, branches, users, user_tenant_memberships,
      roles, permissions, role_permissions, membership_roles,
      tenant_domains, refresh_tokens TO school_app_user;

    -- 6. Audit Logs: Append-Only (INSERT, SELECT ONLY)
    GRANT INSERT, SELECT ON audit_logs TO school_app_user;
    REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM school_app_user;

    -- 7. Enable and Force RLS on Phase 1 Tenant-Owned Tables
    ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
    ALTER TABLE branches FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_branches ON branches;
    CREATE POLICY tenant_isolation_branches ON branches
      FOR ALL
      TO school_app_user
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

    ALTER TABLE user_tenant_memberships ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_tenant_memberships FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_memberships ON user_tenant_memberships;
    CREATE POLICY tenant_isolation_memberships ON user_tenant_memberships
      FOR ALL
      TO school_app_user
      USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

    ALTER TABLE membership_roles ENABLE ROW LEVEL SECURITY;
    ALTER TABLE membership_roles FORCE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_membership_roles ON membership_roles;
    CREATE POLICY tenant_isolation_membership_roles ON membership_roles
      FOR ALL
      TO school_app_user
      USING (
        membership_id IN (
          SELECT id FROM user_tenant_memberships
          WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
      )
      WITH CHECK (
        membership_id IN (
          SELECT id FROM user_tenant_memberships
          WHERE tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
        )
      );
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP POLICY IF EXISTS tenant_isolation_membership_roles ON membership_roles;
    ALTER TABLE membership_roles NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE membership_roles DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_memberships ON user_tenant_memberships;
    ALTER TABLE user_tenant_memberships NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_tenant_memberships DISABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS tenant_isolation_branches ON branches;
    ALTER TABLE branches NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
  `);
};
