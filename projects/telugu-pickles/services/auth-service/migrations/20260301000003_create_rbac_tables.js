/**
 * Migration 03: Create RBAC tables and seed Phase 1 roles & permissions
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

const PERMISSIONS = [
  { permission_key: 'tenant.read', module: 'Tenancy', description: 'View school organization profile and settings' },
  { permission_key: 'tenant.update', module: 'Tenancy', description: 'Update school contact details, timezone, and branding' },
  { permission_key: 'tenant.suspend', module: 'Tenancy', description: 'Suspend a school organization (SuperAdmin only)' },
  { permission_key: 'branch.create', module: 'Campuses', description: 'Provision a new campus branch' },
  { permission_key: 'branch.read', module: 'Campuses', description: 'View authorized campus profiles and addresses' },
  { permission_key: 'branch.update', module: 'Campuses', description: 'Modify campus metadata and configurations' },
  { permission_key: 'branch.delete', module: 'Campuses', description: 'Deactivate or archive a campus branch' },
  { permission_key: 'user.create', module: 'Identity', description: 'Register new platform identity accounts' },
  { permission_key: 'user.read', module: 'Identity', description: 'View user profiles and login histories' },
  { permission_key: 'user.update', module: 'Identity', description: 'Edit personal profile information' },
  { permission_key: 'user.disable', module: 'Identity', description: 'Lock or deactivate platform accounts' },
  { permission_key: 'membership.invite', module: 'Memberships', description: 'Issue email invitations to join a school' },
  { permission_key: 'membership.read', module: 'Memberships', description: 'List active, pending, or revoked school members' },
  { permission_key: 'membership.update', module: 'Memberships', description: 'Change membership status or branch associations' },
  { permission_key: 'membership.revoke', module: 'Memberships', description: 'Eject a user from a school organization' },
  { permission_key: 'role.read', module: 'RBAC', description: 'Inspect role definitions and permission mappings' },
  { permission_key: 'role.assign', module: 'RBAC', description: 'Grant or revoke roles to school members' },
  { permission_key: 'session.read', module: 'Security', description: 'Inspect active login sessions and devices' },
  { permission_key: 'session.revoke', module: 'Security', description: 'Terminate specific sessions or execute logout-all' },
  { permission_key: 'audit.read', module: 'Governance', description: 'Review immutable security and operational audit logs' },
];

const SYSTEM_ROLES = [
  { role_key: 'SuperAdmin', display_name: 'Platform Super Administrator', is_system_role: true, tenant_id: null, description: 'Global SaaS administrator' },
  { role_key: 'SchoolAdmin', display_name: 'School Administrator', is_system_role: true, tenant_id: null, description: 'School administrative director' },
  { role_key: 'Principal', display_name: 'Principal / Headmaster', is_system_role: true, tenant_id: null, description: 'Campus executive leader' },
  { role_key: 'Teacher', display_name: 'Teacher / Instructor', is_system_role: true, tenant_id: null, description: 'Instructional campus staff' },
  { role_key: 'Accountant', display_name: 'Accountant / Bursar', is_system_role: true, tenant_id: null, description: 'Financial officer' },
  { role_key: 'Student', display_name: 'Student', is_system_role: true, tenant_id: null, description: 'Enrolled pupil' },
  { role_key: 'Parent', display_name: 'Parent / Guardian', is_system_role: true, tenant_id: null, description: 'Verified legal guardian' },
];

const ROLE_PERMISSIONS_MAP = {
  SuperAdmin: [
    'tenant.read', 'tenant.update', 'tenant.suspend',
    'branch.create', 'branch.read', 'branch.update', 'branch.delete',
    'user.create', 'user.read', 'user.update', 'user.disable',
    'membership.invite', 'membership.read', 'membership.update', 'membership.revoke',
    'role.read', 'role.assign', 'session.read', 'session.revoke', 'audit.read',
  ],
  SchoolAdmin: [
    'tenant.read', 'tenant.update',
    'branch.create', 'branch.read', 'branch.update', 'branch.delete',
    'user.create', 'user.read', 'user.update', 'user.disable',
    'membership.invite', 'membership.read', 'membership.update', 'membership.revoke',
    'role.read', 'role.assign', 'session.read', 'session.revoke', 'audit.read',
  ],
  Principal: [
    'tenant.read',
    'branch.read', 'branch.update',
    'user.read', 'user.update',
    'membership.invite', 'membership.read',
    'role.read', 'session.read', 'session.revoke', 'audit.read',
  ],
  Teacher: [
    'branch.read', 'user.update', 'membership.read', 'session.read', 'session.revoke',
  ],
  Accountant: [
    'branch.read', 'user.update', 'membership.read', 'session.read', 'session.revoke',
  ],
  Student: [
    'branch.read', 'user.update', 'session.read', 'session.revoke',
  ],
  Parent: [
    'branch.read', 'user.update', 'session.read', 'session.revoke',
  ],
};

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
      role_key VARCHAR(50) NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system_role BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_role_key_per_tenant UNIQUE (tenant_id, role_key)
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_uq_platform_system_roles ON roles(role_key) WHERE tenant_id IS NULL;

    CREATE TABLE IF NOT EXISTS permissions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      permission_key VARCHAR(100) NOT NULL UNIQUE,
      module VARCHAR(50) NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (role_id, permission_id)
    );

    CREATE TABLE IF NOT EXISTS membership_roles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      membership_id UUID NOT NULL REFERENCES user_tenant_memberships(id) ON DELETE CASCADE,
      role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      branch_id UUID REFERENCES branches(id) ON DELETE CASCADE,
      assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_membership_role_branch UNIQUE (membership_id, role_id, branch_id)
    );

    CREATE INDEX IF NOT EXISTS idx_membership_roles_member ON membership_roles(membership_id);
    CREATE INDEX IF NOT EXISTS idx_membership_roles_branch ON membership_roles(branch_id);
  `);

  // Seed permissions
  for (const perm of PERMISSIONS) {
    await knex.raw(
      `INSERT INTO permissions (permission_key, module, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (permission_key) DO UPDATE SET module = EXCLUDED.module, description = EXCLUDED.description`,
      [perm.permission_key, perm.module, perm.description]
    );
  }

  // Seed system roles
  for (const role of SYSTEM_ROLES) {
    await knex.raw(
      `INSERT INTO roles (role_key, display_name, description, is_system_role, tenant_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (role_key) WHERE tenant_id IS NULL DO UPDATE SET
         display_name = EXCLUDED.display_name,
         description = EXCLUDED.description`,
      [role.role_key, role.display_name, role.description, role.is_system_role, role.tenant_id]
    );
  }

  // Map permissions to system roles
  for (const [roleKey, permKeys] of Object.entries(ROLE_PERMISSIONS_MAP)) {
    for (const permKey of permKeys) {
      await knex.raw(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT r.id, p.id FROM roles r, permissions p
         WHERE r.role_key = $1 AND r.tenant_id IS NULL AND p.permission_key = $2
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleKey, permKey]
      );
    }
  }
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS membership_roles CASCADE;
    DROP TABLE IF EXISTS role_permissions CASCADE;
    DROP TABLE IF EXISTS permissions CASCADE;
    DROP TABLE IF EXISTS roles CASCADE;
  `);
};
