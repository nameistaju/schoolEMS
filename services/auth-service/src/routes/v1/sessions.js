/**
 * Phase 1 Sessions Management Endpoints (/api/v1/sessions)
 * Active Device Inspection & Session Revocation
 */

const express = require('express');
const { requireSchoolAuth } = require('../../../../common/auth');
const { sendSuccess, sendError } = require('../../utils/response');

function createSessionsRouter(pool) {
  const router = express.Router();

  // GET / (List active sessions)
  router.get('/', requireSchoolAuth(), async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, family_id, created_at, expires_at
         FROM refresh_tokens
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now()
         ORDER BY created_at DESC`,
        [req.user.sub]
      );

      return sendSuccess(res, { sessions: rows }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // DELETE /:id (Revoke specific session)
  router.delete('/:id', requireSchoolAuth(), async (req, res) => {
    try {
      const isSuperAdmin = req.user.roles?.includes('SuperAdmin');
      const query = isSuperAdmin
        ? 'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL RETURNING id'
        : 'UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id';
      const params = isSuperAdmin ? [req.params.id] : [req.params.id, req.user.sub];

      const { rows } = await pool.query(query, params);
      if (!rows[0]) {
        return sendError(res, 'NOT_FOUND', 'Active session not found or already revoked', 404, null, req);
      }

      return sendSuccess(res, { message: 'Session revoked successfully' }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  // DELETE / (Revoke all sessions for current user)
  router.delete('/', requireSchoolAuth(), async (req, res) => {
    try {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [req.user.sub]
      );

      res.clearCookie('tp_refresh', { path: '/api/v1/auth' });
      return sendSuccess(res, { message: 'All active sessions revoked' }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message, 500, null, req);
    }
  });

  return router;
}

module.exports = { createSessionsRouter };
