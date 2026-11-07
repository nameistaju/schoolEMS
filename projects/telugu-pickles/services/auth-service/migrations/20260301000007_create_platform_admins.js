/**
 * Migration 07: Create platform_admins table for explicit SuperAdmin identity separation
 * Phase 1: Security Remediation (Findings C-01 & M-03)
 */

exports.up = async function (knex) {
  await knex.raw(`
    CREATE TABLE IF NOT EXISTS platform_admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON platform_admins(user_id);

    GRANT SELECT, INSERT, DELETE ON platform_admins TO school_app_user;
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS platform_admins CASCADE;
  `);
};
