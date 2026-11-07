/**
 * Migration 01: Create tenants and branches
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

exports.up = async function (knex) {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await knex.raw(`
    CREATE TABLE IF NOT EXISTS tenants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('pending', 'active', 'suspended', 'archived')),
      timezone VARCHAR(80) NOT NULL DEFAULT 'Asia/Kolkata',
      contact_email VARCHAR(255),
      contact_phone VARCHAR(30),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
    CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);

    CREATE TABLE IF NOT EXISTS branches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
      name VARCHAR(200) NOT NULL,
      code VARCHAR(50) NOT NULL,
      address JSONB,
      status VARCHAR(30) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'archived')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_branch_code_per_tenant UNIQUE (tenant_id, code)
    );

    CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
  `);
};

exports.down = async function (knex) {
  await knex.raw(`
    DROP TABLE IF EXISTS branches CASCADE;
    DROP TABLE IF EXISTS tenants CASCADE;
  `);
};
