/**
 * Phase 1 Tenants Management Endpoints (/api/v1/tenants)
 * SuperAdmin Governance & School Profile Management
 */

const express = require('express');
const { requireSchoolAuth } = require('../../../../common/auth');
const { sendSuccess, sendError } = require('../../utils/response');

function createTenantsRouter(pool) {
  const router = express.Router();

  // POST / (Onboard new school - SuperAdmin only)
  router.post('/', requireSchoolAuth({ role: 'SuperAdmin' }), async (req, res) => {
    const { name, slug, timezone = 'Asia/Kolkata', contact_email, contact_phone, domain } = req.body || {};

    if (!name || !slug) {
      return sendError(res, 'VALIDATION_ERROR', 'School name and slug are required', 400, null, req);
    }

    const cleanSlug = String(slug).toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create Tenant
      const { rows: tenantRows } = await client.query(
        `INSERT INTO tenants (name, slug, timezone, contact_email, contact_phone, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING *`,
        [name.trim(), cleanSlug, timezone, contact_email || null, contact_phone || null]
      );
      const tenant = tenantRows[0];

      // 2. Create Default Primary Domain
      const defaultDomain = domain || `${cleanSlug}.schoolsaas.com`;
      await client.query(
        `INSERT INTO tenant_domains (tenant_id, domain, domain_type, verification_status, is_primary)
         VALUES ($1, $2, 'subdomain', 'verified', true)`,
        [tenant.id, defaultDomain.toLowerCase()]
      );

      // 3. Create Default Branch ("Main Campus", code: "MAIN")
      const { rows: branchRows } = await client.query(
        `INSERT INTO branches (tenant_id, name, code, status)
         VALUES ($1, 'Main Campus', 'MAIN', 'active')
         RETURNING *`,
        [tenant.id]
      );

      // 4. Audit Log
      await client.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id)
         VALUES ($1, $2, 'tenant.onboard', 'tenant', $1)`,
        [tenant.id, req.user.sub]
      );

      await client.query('COMMIT');

      return sendSuccess(res, {
        tenant,
        primaryBranch: branchRows[0],
        primaryDomain: defaultDomain,
      }, 201, req);
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      if (err.code === '23505') {
        return sendError(res, 'SLUG_CONFLICT', 'A school with this slug or domain already exists', 409, null, req);
      }
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Tenant creation error', 500, null, req);
    } finally {
      client.release();
    }
  });

  // GET /current (Current school profile)
  router.get('/current', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return sendError(res, 'TENANT_REQUIRED', 'No active tenant context in session', 400, null, req);
    }

    try {
      const { rows } = await pool.query(
        `SELECT id, name, slug, timezone, contact_email, contact_phone, status, created_at
         FROM tenants WHERE id = $1`,
        [tenantId]
      );
      if (!rows[0]) return sendError(res, 'NOT_FOUND', 'School tenant not found', 404, null, req);

      return sendSuccess(res, { tenant: rows[0] }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // GET /:id (SuperAdmin inspect specific school)
  router.get('/:id', requireSchoolAuth({ role: 'SuperAdmin' }), async (req, res) => {
    try {
      const { rows } = await pool.query('SELECT * FROM tenants WHERE id = $1', [req.params.id]);
      if (!rows[0]) return sendError(res, 'NOT_FOUND', 'School tenant not found', 404, null, req);

      const { rows: domains } = await pool.query(
        'SELECT domain, domain_type, verification_status, is_primary FROM tenant_domains WHERE tenant_id = $1',
        [req.params.id]
      );

      return sendSuccess(res, { tenant: rows[0], domains }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // PATCH /:id (Update school details)
  router.patch('/:id', requireSchoolAuth(), async (req, res) => {
    const targetId = req.params.id;
    const isSuperAdmin = req.user.roles?.includes('SuperAdmin');
    const isSchoolAdmin = req.user.roles?.includes('SchoolAdmin') && req.user.tenant_id === targetId;

    if (!isSuperAdmin && !isSchoolAdmin) {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions to update school settings', 403, null, req);
    }

    const { name, timezone, contact_email, contact_phone } = req.body || {};

    try {
      const { rows } = await pool.query(
        `UPDATE tenants
         SET name = COALESCE($2, name),
             timezone = COALESCE($3, timezone),
             contact_email = COALESCE($4, contact_email),
             contact_phone = COALESCE($5, contact_phone),
             updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [targetId, name || null, timezone || null, contact_email || null, contact_phone || null]
      );

      if (!rows[0]) return sendError(res, 'NOT_FOUND', 'School tenant not found', 404, null, req);

      return sendSuccess(res, { tenant: rows[0] }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // POST /:id/suspend (SuperAdmin only)
  router.post('/:id/suspend', requireSchoolAuth({ role: 'SuperAdmin' }), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE tenants SET status = 'suspended', updated_at = now() WHERE id = $1 RETURNING id, status`,
        [req.params.id]
      );
      if (!rows[0]) return sendError(res, 'NOT_FOUND', 'School tenant not found', 404, null, req);

      return sendSuccess(res, { message: 'School suspended successfully', tenant: rows[0] }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // POST /:id/activate (SuperAdmin only)
  router.post('/:id/activate', requireSchoolAuth({ role: 'SuperAdmin' }), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE tenants SET status = 'active', updated_at = now() WHERE id = $1 RETURNING id, status`,
        [req.params.id]
      );
      if (!rows[0]) return sendError(res, 'NOT_FOUND', 'School tenant not found', 404, null, req);

      return sendSuccess(res, { message: 'School activated successfully', tenant: rows[0] }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  return router;
}

module.exports = { createTenantsRouter };
