const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// --- Legacy E-Commerce JWT Helpers (HS256) ---
const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const ISSUER = 'telugu-pickles-auth';
const TTL = process.env.JWT_TTL || '12h';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  // Fail fast rather than run production with a default secret.
  throw new Error('JWT_SECRET must be set in production');
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name }, SECRET, {
    issuer: ISSUER,
    expiresIn: TTL,
  });
}

function verifyToken(token) {
  return jwt.verify(token, SECRET, { issuer: ISSUER });
}

// Express middleware: requires "Authorization: Bearer <jwt>"
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Login required' });
  }
  try {
    const claims = verifyToken(token);
    req.user = { id: claims.sub, email: claims.email, name: claims.name };
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please login again' });
  }
}

// --- School Platform RS256 Keypair Management & Authentication ---
const SCHOOL_ISSUER = 'https://auth.schoolsaas.com';
const SCHOOL_AUDIENCE = 'schoolsaas-api';
const SCHOOL_KEY_ID = 'school-auth-2026-v1';
const SCHOOL_ACCESS_TOKEN_TTL = process.env.SCHOOL_ACCESS_TOKEN_TTL || '15m';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateKeypair(privKeyPem, pubKeyPem) {
  if (!privKeyPem || typeof privKeyPem !== 'string') {
    throw new Error('JWT_PRIVATE_KEY is missing or invalid');
  }
  if (!pubKeyPem || typeof pubKeyPem !== 'string') {
    throw new Error('JWT_PUBLIC_KEY is missing or invalid');
  }

  let privateKeyObj;
  try {
    privateKeyObj = crypto.createPrivateKey(privKeyPem);
  } catch (err) {
    throw new Error(`Invalid PEM format for JWT_PRIVATE_KEY: ${err.message}`);
  }

  let publicKeyObj;
  try {
    publicKeyObj = crypto.createPublicKey(pubKeyPem);
  } catch (err) {
    throw new Error(`Invalid PEM format for JWT_PUBLIC_KEY: ${err.message}`);
  }

  // Cryptographically verify matching keypair
  try {
    const testPayload = Buffer.from('schoolsaas-keypair-verify-' + Date.now());
    const sign = crypto.createSign('SHA256');
    sign.update(testPayload);
    sign.end();
    const signature = sign.sign(privateKeyObj);

    const verify = crypto.createVerify('SHA256');
    verify.update(testPayload);
    verify.end();
    if (!verify.verify(publicKeyObj, signature)) {
      throw new Error('Configured JWT_PRIVATE_KEY and JWT_PUBLIC_KEY do not form a matching keypair');
    }
  } catch (err) {
    throw new Error(`Keypair validation failed: ${err.message}`);
  }
}

let privateKey = process.env.JWT_PRIVATE_KEY;
let publicKey = process.env.JWT_PUBLIC_KEY;

if (process.env.NODE_ENV === 'production') {
  if (!privateKey || !publicKey) {
    throw new Error('Production security violation: JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be configured in production');
  }
  validateKeypair(privateKey, publicKey);
} else {
  if (privateKey && publicKey) {
    validateKeypair(privateKey, publicKey);
  } else if (!privateKey && !publicKey) {
    // Generate development/ephemeral RSA 2048 keypair
    const keyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
  } else {
    throw new Error('Both JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be provided together');
  }
}

const TRUSTED_KEYS = new Map([
  [SCHOOL_KEY_ID, publicKey],
]);

function registerTrustedKey(kid, publicKeyPem) {
  if (!kid || typeof kid !== 'string') throw new Error('kid must be a non-empty string');
  try {
    crypto.createPublicKey(publicKeyPem);
  } catch (err) {
    throw new Error(`Invalid PEM format for rotated public key: ${err.message}`);
  }
  TRUSTED_KEYS.set(kid, publicKeyPem);
}

function getTrustedKey(kid) {
  return TRUSTED_KEYS.get(kid) || null;
}

function getPublicKeyPem() {
  return publicKey;
}

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function signSchoolToken({ sub, tenant_id = null, membership_id = null, branch_id = null, roles = [], email = '' }, options = {}) {
  if (sub && !UUID_REGEX.test(sub)) {
    throw new Error('sub must be a valid UUID');
  }
  if (tenant_id && !UUID_REGEX.test(tenant_id)) {
    throw new Error('tenant_id must be a valid UUID');
  }
  if (membership_id && !UUID_REGEX.test(membership_id)) {
    throw new Error('membership_id must be a valid UUID');
  }
  if (branch_id && !UUID_REGEX.test(branch_id)) {
    throw new Error('branch_id must be a valid UUID');
  }

  const payload = {
    sub,
    jti: crypto.randomUUID(),
    tenant_id,
    membership_id,
    branch_id,
    roles,
    email,
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    issuer: SCHOOL_ISSUER,
    audience: SCHOOL_AUDIENCE,
    keyid: SCHOOL_KEY_ID,
    expiresIn: options.expiresIn || SCHOOL_ACCESS_TOKEN_TTL,
  });
}

function verifySchoolToken(token) {
  const decodedHeader = jwt.decode(token, { complete: true });
  if (!decodedHeader || decodedHeader.header.alg !== 'RS256') {
    throw new Error('Invalid token algorithm: strictly RS256 required');
  }

  const tokenKid = decodedHeader.header.kid;
  const signingPublicKey = getTrustedKey(tokenKid);
  if (!signingPublicKey) {
    throw new Error(`Untrusted or invalid key ID (kid): ${tokenKid}`);
  }

  const claims = jwt.verify(token, signingPublicKey, {
    algorithms: ['RS256'],
    issuer: SCHOOL_ISSUER,
    audience: SCHOOL_AUDIENCE,
  });

  if (claims.sub && !UUID_REGEX.test(claims.sub)) {
    throw new Error('Claim sub is not a valid UUID');
  }
  if (claims.tenant_id && !UUID_REGEX.test(claims.tenant_id)) {
    throw new Error('Claim tenant_id is not a valid UUID');
  }
  if (claims.membership_id && !UUID_REGEX.test(claims.membership_id)) {
    throw new Error('Claim membership_id is not a valid UUID');
  }
  if (claims.branch_id && !UUID_REGEX.test(claims.branch_id)) {
    throw new Error('Claim branch_id is not a valid UUID');
  }

  return claims;
}

function requireSchoolAuth(options = {}) {
  const requiredRole = typeof options === 'string' ? options : options.role;

  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        meta: { request_id: req.id || req.headers['x-request-id'] || null, timestamp: new Date().toISOString() },
      });
    }

    try {
      const claims = verifySchoolToken(token);

      if (req.tenant && req.tenant.id && claims.tenant_id && req.tenant.id !== claims.tenant_id) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Tenant Cross-Talk Blocked' },
          meta: { request_id: req.id || req.headers['x-request-id'] || null, timestamp: new Date().toISOString() },
        });
      }

      if (requiredRole) {
        const roles = Array.isArray(claims.roles) ? claims.roles : [];
        if (!roles.includes(requiredRole) && !roles.includes('SuperAdmin')) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: `Insufficient permissions: ${requiredRole} role required` },
            meta: { request_id: req.id || req.headers['x-request-id'] || null, timestamp: new Date().toISOString() },
          });
        }
      }

      req.user = claims;
      return next();
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: err.message || 'Invalid or expired session' },
        meta: { request_id: req.id || req.headers['x-request-id'] || null, timestamp: new Date().toISOString() },
      });
    }
  };
}

module.exports = {
  signToken,
  verifyToken,
  requireAuth,
  signSchoolToken,
  verifySchoolToken,
  requireSchoolAuth,
  hashToken,
  generateRefreshToken,
  getPublicKeyPem,
  validateKeypair,
  registerTrustedKey,
  getTrustedKey,
  SCHOOL_ISSUER,
  SCHOOL_AUDIENCE,
  SCHOOL_KEY_ID,
};
