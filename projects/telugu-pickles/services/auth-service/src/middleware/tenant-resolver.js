/**
 * Hardened Tenant Resolution Middleware
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

const { sendError } = require('../utils/response');

function resolveDomainFromHost(hostHeader) {
  if (!hostHeader) return null;
  // Remove port if present (e.g. "apex.example:4001" -> "apex.example")
  return hostHeader.split(':')[0].toLowerCase().trim();
}

function createTenantResolver(pool, options = { required: true }) {
  return async (req, res, next) => {
    let domain = null;

    // Strict Inbound Header Rules:
    // Only permit X-Tenant-Domain if strictly in development AND explicitly configured
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.ALLOW_HEADER_TENANT_RESOLVER === 'true' &&
      req.headers['x-tenant-domain']
    ) {
      domain = String(req.headers['x-tenant-domain']).toLowerCase().trim();
    } else {
      // In production (and default dev), host header (or verified gateway forwarded host) is authoritative
      domain = resolveDomainFromHost(req.headers['x-forwarded-host'] || req.headers['host']);
    }

    if (!domain) {
      if (options.required) {
        return sendError(res, 'TENANT_REQUIRED', 'School tenant could not be resolved from host header', 400, null, req);
      }
      return next();
    }

    try {
      // 1. Direct domain lookup in tenant_domains
      const { rows: domainRows } = await pool.query(
        `SELECT t.id, t.name, t.slug, t.status, t.timezone
         FROM tenant_domains td
         JOIN tenants t ON td.tenant_id = t.id
         WHERE lower(td.domain) = lower($1) AND td.verification_status = 'verified'`,
        [domain]
      );

      let tenant = domainRows[0];

      // 2. Fallback: extract subdomain slug (e.g., "apex-academy.schoolsaas.com" or "apex.example" -> "apex-academy")
      if (!tenant) {
        const parts = domain.split('.');
        const candidateSlug = parts[0];
        const { rows: slugRows } = await pool.query(
          `SELECT id, name, slug, status, timezone
           FROM tenants
           WHERE lower(slug) = lower($1)`,
          [candidateSlug]
        );
        tenant = slugRows[0];
      }

      if (!tenant) {
        if (options.required) {
          return sendError(res, 'TENANT_NOT_FOUND', `Unknown or unverified school domain: ${domain}`, 404, null, req);
        }
        return next();
      }

      if (tenant.status === 'suspended') {
        return sendError(res, 'TENANT_SUSPENDED', 'This school organization is currently suspended', 403, null, req);
      }

      if (tenant.status !== 'active') {
        return sendError(res, 'TENANT_INACTIVE', 'This school organization is not active', 403, null, req);
      }

      req.tenant = tenant;
      return next();
    } catch (err) {
      return sendError(res, 'INTERNAL_ERROR', 'Tenant resolution error', 500, null, req);
    }
  };
}

module.exports = { createTenantResolver, resolveDomainFromHost };
