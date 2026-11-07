/**
 * Phase 1 Branches Management Endpoints (/api/v1/branches)
 * Campus Provisioning & RLS-Enforced Operations
 */

const express = require('express');
const { requireSchoolAuth } = require('../../../../common/auth');
const { withTenantContext } = require('../../../../common/db');
const { sendSuccess, sendError } = require('../../utils/response');

function createBranchesRouter(pool) {
  const router = express.Router();

  // POST / (Provision new branch)
  router.post('/', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return sendError(res, 'TENANT_REQUIRED', 'Tenant context required to create branch', 400, null, req);
    }

    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin'].includes(r));
    if (!isAuthorized) {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions: SchoolAdmin required', 403, null, req);
    }

    const { name, code, address } = req.body || {};
    if (!name || !code) {
      return sendError(res, 'VALIDATION_ERROR', 'Branch name and code are required', 400, null, req);
    }

    try {
      const branch = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `INSERT INTO branches (tenant_id, name, code, address, status)
           VALUES ($1, $2, $3, $4, 'active')
           RETURNING *`,
          [tenantId, name.trim(), String(code).trim().toUpperCase(), address ? JSON.stringify(address) : null]
        );
        return rows[0];
      });

      return sendSuccess(res, { branch }, 201, req);
    } catch (err) {
      if (err.code === '23505') {
        return sendError(res, 'CODE_CONFLICT', 'A branch with this code already exists in your school', 409, null, req);
      }
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // GET / (List branches for school)
  router.get('/', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return sendError(res, 'TENANT_REQUIRED', 'Tenant context required to list branches', 400, null, req);
    }

    try {
      const branches = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT id, tenant_id, name, code, address, status, created_at, updated_at
           FROM branches
           WHERE tenant_id = $1
           ORDER BY name ASC`,
          [tenantId]
        );
        return rows;
      });

      return sendSuccess(res, { branches }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // GET /:id (Get single branch)
  router.get('/:id', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) {
      return sendError(res, 'TENANT_REQUIRED', 'Tenant context required', 400, null, req);
    }

    try {
      const branch = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT id, tenant_id, name, code, address, status, created_at, updated_at
           FROM branches
           WHERE id = $1 AND tenant_id = $2`,
          [req.params.id, tenantId]
        );
        return rows[0];
      });

      if (!branch) return sendError(res, 'NOT_FOUND', 'Branch not found in current school', 404, null, req);

      return sendSuccess(res, { branch }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // PATCH /:id (Update branch)
  router.patch('/:id', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin', 'Principal'].includes(r));
    if (!isAuthorized) {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions to update branch', 403, null, req);
    }

    const { name, code, address } = req.body || {};

    try {
      const branch = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `UPDATE branches
           SET name = COALESCE($3, name),
               code = COALESCE($4, code),
               address = COALESCE($5, address),
               updated_at = now()
           WHERE id = $1 AND tenant_id = $2
           RETURNING *`,
          [
            req.params.id,
            tenantId,
            name ? name.trim() : null,
            code ? String(code).trim().toUpperCase() : null,
            address ? JSON.stringify(address) : null,
          ]
        );
        return rows[0];
      });

      if (!branch) return sendError(res, 'NOT_FOUND', 'Branch not found in current school', 404, null, req);

      return sendSuccess(res, { branch }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // POST /:id/deactivate (Deactivate branch)
  router.post('/:id/deactivate', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin'].includes(r));
    if (!isAuthorized) {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions to deactivate branch', 403, null, req);
    }

    try {
      const branch = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `UPDATE branches
           SET status = 'inactive', updated_at = now()
           WHERE id = $1 AND tenant_id = $2
           RETURNING id, status`,
          [req.params.id, tenantId]
        );
        return rows[0];
      });

      if (!branch) return sendError(res, 'NOT_FOUND', 'Branch not found in current school', 404, null, req);

      return sendSuccess(res, { message: 'Branch deactivated successfully', branch }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  return router;
}

module.exports = { createBranchesRouter };
