/**
 * Phase 1 Memberships & RBAC Management Endpoints (/api/v1/memberships)
 * School Member Onboarding, Status Management, and Role Assignments
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { requireSchoolAuth } = require('../../../../common/auth');
const { withTenantContext } = require('../../../../common/db');
const { sendSuccess, sendError } = require('../../utils/response');

function createMembershipsRouter(pool) {
  const router = express.Router();

  // POST /invite (Invite user to school)
  router.post('/invite', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) return sendError(res, 'TENANT_REQUIRED', 'Tenant context required', 400, null, req);

    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin', 'Principal'].includes(r));
    if (!isAuthorized) {
      return sendError(res, 'FORBIDDEN', 'Insufficient permissions: admin role required to invite members', 403, null, req);
    }

    const { email, fullName, roleKey = 'Teacher', branchId = null } = req.body || {};
    if (!email || !fullName) {
      return sendError(res, 'VALIDATION_ERROR', 'Email and fullName are required', 400, null, req);
    }

    const cleanEmail = String(email).trim().toLowerCase();

    try {
      const result = await withTenantContext(pool, tenantId, async (client) => {
        // 1. Find or create user
        let user;
        const { rows: existingUsers } = await client.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
        if (existingUsers.length > 0) {
          user = existingUsers[0];
        } else {
          // Generate temporary placeholder password
          const tempPassword = crypto.randomBytes(16).toString('hex');
          const hash = await bcrypt.hash(tempPassword, 10);
          const { rows: newUsers } = await client.query(
            `INSERT INTO users (full_name, name, email, password_hash, status)
             VALUES ($1, $1, $2, $3, 'invited')
             RETURNING id, full_name, email, status`,
            [fullName.trim(), cleanEmail, hash]
          );
          user = newUsers[0];
        }

        // 2. Create membership
        const { rows: membershipRows } = await client.query(
          `INSERT INTO user_tenant_memberships (tenant_id, user_id, status, joined_at)
           VALUES ($1, $2, 'invited', now())
           ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'invited'
           RETURNING *`,
          [tenantId, user.id]
        );
        const membership = membershipRows[0];

        // 3. Find Role
        const { rows: roleRows } = await client.query(
          `SELECT id, role_key FROM roles WHERE role_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL) LIMIT 1`,
          [roleKey, tenantId]
        );

        if (roleRows.length > 0) {
          const roleId = roleRows[0].id;
          await client.query(
            `INSERT INTO membership_roles (membership_id, role_id, branch_id, assigned_by)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (membership_id, role_id, branch_id) DO NOTHING`,
            [membership.id, roleId, branchId || null, req.user.sub]
          );
        }

        return { user, membership, roleKey };
      });

      return sendSuccess(res, result, 201, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // GET / (List school members)
  router.get('/', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) return sendError(res, 'TENANT_REQUIRED', 'Tenant context required', 400, null, req);

    try {
      const members = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT m.id, m.status, m.joined_at, m.created_at,
                  u.id as user_id, u.full_name, u.email, u.phone,
                  COALESCE(json_agg(json_build_object('roleKey', r.role_key, 'branchId', mr.branch_id))
                    FILTER (WHERE r.id IS NOT NULL), '[]') as roles
           FROM user_tenant_memberships m
           JOIN users u ON m.user_id = u.id
           LEFT JOIN membership_roles mr ON mr.membership_id = m.id
           LEFT JOIN roles r ON mr.role_id = r.id
           WHERE m.tenant_id = $1
           GROUP BY m.id, u.id
           ORDER BY m.created_at DESC`,
          [tenantId]
        );
        return rows;
      });

      return sendSuccess(res, { members }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // GET /:id (Get single member)
  router.get('/:id', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    if (!tenantId) return sendError(res, 'TENANT_REQUIRED', 'Tenant context required', 400, null, req);

    try {
      const member = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `SELECT m.id, m.status, m.joined_at, m.created_at,
                  u.id as user_id, u.full_name, u.email, u.phone,
                  COALESCE(json_agg(json_build_object('roleKey', r.role_key, 'roleId', r.id, 'branchId', mr.branch_id))
                    FILTER (WHERE r.id IS NOT NULL), '[]') as roles
           FROM user_tenant_memberships m
           JOIN users u ON m.user_id = u.id
           LEFT JOIN membership_roles mr ON mr.membership_id = m.id
           LEFT JOIN roles r ON mr.role_id = r.id
           WHERE m.id = $1 AND m.tenant_id = $2
           GROUP BY m.id, u.id`,
          [req.params.id, tenantId]
        );
        return rows[0];
      });

      if (!member) return sendError(res, 'NOT_FOUND', 'School member not found', 404, null, req);

      return sendSuccess(res, { member }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // PATCH /:id (Update membership status)
  router.patch('/:id', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin'].includes(r));
    if (!isAuthorized) return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403, null, req);

    const { status } = req.body || {};
    if (!['active', 'suspended', 'invited'].includes(status)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid membership status', 400, null, req);
    }

    try {
      const updated = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `UPDATE user_tenant_memberships
           SET status = $3, updated_at = now()
           WHERE id = $1 AND tenant_id = $2
           RETURNING *`,
          [req.params.id, tenantId, status]
        );
        return rows[0];
      });

      if (!updated) return sendError(res, 'NOT_FOUND', 'School member not found', 404, null, req);

      return sendSuccess(res, { membership: updated }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // POST /:id/revoke (Eject member from school)
  router.post('/:id/revoke', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin'].includes(r));
    if (!isAuthorized) return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403, null, req);

    try {
      const revoked = await withTenantContext(pool, tenantId, async (client) => {
        const { rows } = await client.query(
          `UPDATE user_tenant_memberships
           SET status = 'revoked', updated_at = now()
           WHERE id = $1 AND tenant_id = $2
           RETURNING id, status`,
          [req.params.id, tenantId]
        );
        return rows[0];
      });

      if (!revoked) return sendError(res, 'NOT_FOUND', 'School member not found', 404, null, req);

      return sendSuccess(res, { message: 'Member revoked from school organization', membership: revoked }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // POST /:id/roles (Assign role)
  router.post('/:id/roles', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin'].includes(r));
    if (!isAuthorized) return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403, null, req);

    const { roleKey, branchId = null } = req.body || {};
    if (!roleKey) return sendError(res, 'VALIDATION_ERROR', 'roleKey is required', 400, null, req);

    try {
      const result = await withTenantContext(pool, tenantId, async (client) => {
        // Assert member belongs to tenant
        const { rows: memRows } = await client.query(
          'SELECT id FROM user_tenant_memberships WHERE id = $1 AND tenant_id = $2',
          [req.params.id, tenantId]
        );
        if (!memRows[0]) throw new Error('Member not found in current school');

        // Look up role
        const { rows: roleRows } = await client.query(
          'SELECT id FROM roles WHERE role_key = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
          [roleKey, tenantId]
        );
        if (!roleRows[0]) throw new Error(`Role ${roleKey} does not exist`);

        const roleId = roleRows[0].id;

        const { rows: assigned } = await client.query(
          `INSERT INTO membership_roles (membership_id, role_id, branch_id, assigned_by)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (membership_id, role_id, branch_id) DO NOTHING
           RETURNING *`,
          [req.params.id, roleId, branchId || null, req.user.sub]
        );

        return assigned[0] || { message: 'Role already assigned' };
      });

      return sendSuccess(res, { assignment: result }, 201, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 400, null, req);
    }
  });

  // DELETE /:id/roles/:roleId (Remove role)
  router.delete('/:id/roles/:roleId', requireSchoolAuth(), async (req, res) => {
    const tenantId = req.user.tenant_id;
    const isAuthorized = req.user.roles?.some((r) => ['SuperAdmin', 'SchoolAdmin'].includes(r));
    if (!isAuthorized) return sendError(res, 'FORBIDDEN', 'Insufficient permissions', 403, null, req);

    try {
      await withTenantContext(pool, tenantId, async (client) => {
        await client.query(
          `DELETE FROM membership_roles
           WHERE membership_id = $1 AND role_id = $2`,
          [req.params.id, req.params.roleId]
        );
      });

      return sendSuccess(res, { message: 'Role removed from member' }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  return router;
}

module.exports = { createMembershipsRouter };
