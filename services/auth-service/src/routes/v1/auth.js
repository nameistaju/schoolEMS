/**
 * Phase 1 Authentication Endpoints (/api/v1/auth)
 * Multi-Tenant Identity, Cryptographic RS256 Tokens & Session Rotation
 */

const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { signSchoolToken, requireSchoolAuth, hashToken, generateRefreshToken } = require('../../../../common/auth');
const { sendSuccess, sendError } = require('../../utils/response');

function createAuthRouter(pool, tenantResolver) {
  const router = express.Router();

  // Helper to extract refresh token from cookies or body
  function extractRefreshToken(req) {
    if (req.cookies && req.cookies.tp_refresh) {
      return req.cookies.tp_refresh;
    }
    // Also parse cookie header directly if cookie-parser is not active
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
      const match = cookieHeader.match(/tp_refresh=([^;]+)/);
      if (match) return match[1];
    }
    return req.body?.refreshToken || null;
  }

  // 1. POST /login
  router.post('/login', tenantResolver, async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return sendError(res, 'VALIDATION_ERROR', 'Email and password are required', 400, null, req);
    }

    try {
      const { rows: userRows } = await pool.query(
        'SELECT * FROM users WHERE lower(email) = lower($1)',
        [String(email).trim()]
      );
      const user = userRows[0];

      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401, null, req);
      }

      if (user.status === 'locked' || user.status === 'disabled') {
        return sendError(res, 'ACCOUNT_LOCKED', 'Your account has been locked or disabled', 403, null, req);
      }

      let membership = null;
      let roles = [];
      const tenant = req.tenant;

      // Check if user is a verified platform administrator
      const { rows: platformAdminRows } = await pool.query(
        'SELECT id FROM platform_admins WHERE user_id = $1',
        [user.id]
      );
      const isSuperAdmin = platformAdminRows.length > 0;

      if (tenant) {
        // Assert active membership in resolved tenant
        const { rows: memberRows } = await pool.query(
          `SELECT m.id, m.status, m.joined_at
           FROM user_tenant_memberships m
           WHERE m.tenant_id = $1 AND m.user_id = $2`,
          [tenant.id, user.id]
        );

        membership = memberRows[0];

        if (!membership && !isSuperAdmin) {
          return sendError(res, 'MEMBERSHIP_REQUIRED', 'You do not have access to this school organization', 403, null, req);
        }

        if (membership && membership.status !== 'active' && !isSuperAdmin) {
          return sendError(res, 'MEMBERSHIP_INACTIVE', `Your school membership is ${membership.status}`, 403, null, req);
        }

        // Fetch user roles in this tenant
        if (membership) {
          const { rows: roleRows } = await pool.query(
            `SELECT r.role_key, mr.branch_id
             FROM membership_roles mr
             JOIN roles r ON mr.role_id = r.id
             WHERE mr.membership_id = $1`,
            [membership.id]
          );
          roles = roleRows.map((r) => r.role_key);
        }

        if (isSuperAdmin && !roles.includes('SuperAdmin')) {
          roles.push('SuperAdmin');
        }
      } else {
        // Platform level login (SuperAdmin only)
        if (!isSuperAdmin) {
          return sendError(res, 'TENANT_REQUIRED', 'School tenant context required for non-platform users', 400, null, req);
        }
        roles = ['SuperAdmin'];
      }

      // 4. Generate RS256 Access Token
      const accessToken = signSchoolToken({
        sub: user.id,
        tenant_id: tenant?.id || null,
        membership_id: membership?.id || null,
        branch_id: null,
        roles,
        email: user.email,
      });

      // 5. Generate and store Refresh Token
      const rawRefreshToken = generateRefreshToken();
      const tokenHashed = hashToken(rawRefreshToken);
      const familyId = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await pool.query(
        `INSERT INTO refresh_tokens (user_id, membership_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.id, membership?.id || null, tokenHashed, familyId, expiresAt]
      );

      // 6. Update user's last_login_at
      await pool.query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

      // 7. Audit Log
      await pool.query(
        `INSERT INTO audit_logs (tenant_id, actor_user_id, action, resource_type, resource_id, user_agent)
         VALUES ($1, $2, 'auth.login.success', 'user', $3, $4)`,
        [tenant?.id || null, user.id, String(user.id), req.headers['user-agent'] || null]
      );

      // Set cookie: tp_refresh
      res.cookie('tp_refresh', rawRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        expires: expiresAt,
      });

      return sendSuccess(res, {
        accessToken,
        expiresIn: 900,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name || user.name,
        },
        tenant: tenant ? { id: tenant.id, name: tenant.name, slug: tenant.slug } : null,
        roles,
      }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Login error', 500, null, req);
    }
  });

  // 2. POST /refresh
  router.post('/refresh', async (req, res) => {
    const rawToken = extractRefreshToken(req);
    if (!rawToken) {
      return sendError(res, 'REFRESH_TOKEN_REQUIRED', 'Refresh token missing', 401, null, req);
    }

    const tokenHashed = hashToken(rawToken);

    try {
      const { rows } = await pool.query(
        'SELECT * FROM refresh_tokens WHERE token_hash = $1',
        [tokenHashed]
      );
      const session = rows[0];

      if (!session) {
        return sendError(res, 'INVALID_SESSION', 'Session invalid or expired', 401, null, req);
      }

      // Reuse detection: If token was already revoked, someone is reusing an old token!
      if (session.revoked_at) {
        // Revoke all tokens in family
        await pool.query(
          'UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL',
          [session.family_id]
        );
        return sendError(res, 'SESSION_COMPROMISED', 'Security violation: refresh token reuse detected', 401, null, req);
      }

      if (new Date(session.expires_at) < new Date()) {
        return sendError(res, 'SESSION_EXPIRED', 'Refresh token expired, please log in again', 401, null, req);
      }

      // Generate replacement refresh token (Rotation)
      const newRawToken = generateRefreshToken();
      const newTokenHashed = hashToken(newRawToken);
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query('BEGIN');

      // Revoke old token
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE id = $2',
        [newTokenHashed, session.id]
      );

      // Insert new token
      await pool.query(
        `INSERT INTO refresh_tokens (user_id, membership_id, token_hash, family_id, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [session.user_id, session.membership_id, newTokenHashed, session.family_id, newExpiresAt]
      );

      // Fetch user & roles for new access token
      const { rows: userRows } = await pool.query('SELECT * FROM users WHERE id = $1', [session.user_id]);
      const user = userRows[0];

      let tenantId = null;
      let roles = [];
      if (session.membership_id) {
        const { rows: memberRows } = await pool.query(
          `SELECT m.tenant_id, r.role_key
           FROM user_tenant_memberships m
           LEFT JOIN membership_roles mr ON mr.membership_id = m.id
           LEFT JOIN roles r ON mr.role_id = r.id
           WHERE m.id = $1`,
          [session.membership_id]
        );
        if (memberRows.length > 0) {
          tenantId = memberRows[0].tenant_id;
          roles = memberRows.map((r) => r.role_key).filter(Boolean);
        }
      }

      // Assert platform admin status
      const { rows: paRows } = await pool.query('SELECT 1 FROM platform_admins WHERE user_id = $1', [session.user_id]);
      if (paRows.length > 0 && !roles.includes('SuperAdmin')) {
        roles.push('SuperAdmin');
      }

      await pool.query('COMMIT');

      const accessToken = signSchoolToken({
        sub: user.id,
        tenant_id: tenantId,
        membership_id: session.membership_id,
        roles,
        email: user.email,
      });

      res.cookie('tp_refresh', newRawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/v1/auth',
        expires: newExpiresAt,
      });

      return sendSuccess(res, {
        accessToken,
        expiresIn: 900,
      }, 200, req);
    } catch (err) {
      await pool.query('ROLLBACK').catch(() => {});
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Refresh error', 500, null, req);
    }
  });

  // 3. POST /logout
  router.post('/logout', async (req, res) => {
    const rawToken = extractRefreshToken(req);
    if (rawToken) {
      const tokenHashed = hashToken(rawToken);
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
        [tokenHashed]
      );
    }

    res.clearCookie('tp_refresh', { path: '/api/v1/auth' });
    return sendSuccess(res, { message: 'Logged out successfully' }, 200, req);
  });

  // 4. POST /logout-all
  router.post('/logout-all', requireSchoolAuth(), async (req, res) => {
    try {
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
        [req.user.sub]
      );

      res.clearCookie('tp_refresh', { path: '/api/v1/auth' });
      return sendSuccess(res, { message: 'All active sessions revoked' }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Logout-all error', 500, null, req);
    }
  });

  // 5. GET /me
  router.get('/me', requireSchoolAuth(), async (req, res) => {
    try {
      const { rows: users } = await pool.query(
        `SELECT id, full_name, name, email, phone, status, created_at, last_login_at
         FROM users WHERE id = $1`,
        [req.user.sub]
      );
      if (!users[0]) return sendError(res, 'NOT_FOUND', 'User not found', 404, null, req);

      const { rows: memberships } = await pool.query(
        `SELECT m.id, m.status, m.joined_at, t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug
         FROM user_tenant_memberships m
         JOIN tenants t ON m.tenant_id = t.id
         WHERE m.user_id = $1`,
        [req.user.sub]
      );

      return sendSuccess(res, {
        user: users[0],
        tenant_id: req.user.tenant_id,
        roles: req.user.roles || [],
        memberships,
      }, 200, req);
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', err.message || 'Error fetching user profile', 500, null, req);
    }
  });

  return router;
}

module.exports = { createAuthRouter };
