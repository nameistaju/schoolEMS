// gateway — the ONLY backend entry point for browsers.
//
//   /api/auth/*        -> auth-service     (4001)
//   /api/products*     -> catalog-service  (4002)
//   /api/categories    -> catalog-service
//   /api/regions       -> catalog-service
//   /api/cart*         -> cart-service     (4003)
//   /api/orders*       -> order-service    (4004)
//   payment-service and every /internal/* route are NOT exposed.
//
// Adds: request-id, security headers, login rate limiting, aggregated health,
// per-upstream metrics, friendly 502/503 when an upstream is down.
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createService, ah } = require('../../common/service');
const { dependencyErrorsTotal } = require('../../common/metrics');

const { app, log, start } = createService({ name: 'gateway', jsonBody: false });
const PORT = Number(process.env.PORT || 8080);

const UPSTREAMS = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:4002',
  cart: process.env.CART_SERVICE_URL || 'http://localhost:4003',
  order: process.env.ORDER_SERVICE_URL || 'http://localhost:4004',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:4005', // health only
};

const ROUTES = [
  { prefix: '/api/v1/auth', upstream: 'auth' },
  { prefix: '/api/v1/tenants', upstream: 'auth' },
  { prefix: '/api/v1/branches', upstream: 'auth' },
  { prefix: '/api/v1/memberships', upstream: 'auth' },
  { prefix: '/api/v1/sessions', upstream: 'auth' },
  { prefix: '/api/auth', upstream: 'auth' },
  { prefix: '/api/products', upstream: 'catalog' },
  { prefix: '/api/categories', upstream: 'catalog' },
  { prefix: '/api/regions', upstream: 'catalog' },
  { prefix: '/api/cart', upstream: 'cart' },
  { prefix: '/api/orders', upstream: 'order' },
];

const GATEWAY_INTERNAL_SECRET = process.env.GATEWAY_INTERNAL_SECRET || 'internal-gateway-secret-dev-2026';

// --- security headers & tenant header hardening ---
app.use((req, res, next) => {
  // Enforce tenant resolution boundary: Strip spoofable external tenant headers
  delete req.headers['x-forwarded-host'];
  delete req.headers['x-gateway-secret'];
  delete req.headers['x-internal-gateway'];

  // Case-insensitive stripping of all x-verified-* headers (Finding L-02)
  for (const headerName of Object.keys(req.headers)) {
    if (headerName.toLowerCase().startsWith('x-verified-')) {
      delete req.headers[headerName];
    }
  }

  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_HEADER_TENANT_RESOLVER !== 'true') {
    delete req.headers['x-tenant-domain'];
    delete req.headers['x-tenant-id'];
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const origin = process.env.CORS_ORIGIN;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Request-Id, X-Tenant-Domain');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

// --- simple fixed-window rate limit for credential endpoints (per client IP) ---
const WINDOW_MS = 60_000;
const LIMIT = Number(process.env.AUTH_RATE_LIMIT_PER_MIN || 20);
const hits = new Map();
setInterval(() => hits.clear(), WINDOW_MS).unref();
app.use(['/api/auth/login', '/api/auth/register', '/api/v1/auth/login'], (req, res, next) => {
  const key = req.ip;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (n > LIMIT) {
    log.warn('rate limit exceeded', { requestId: req.id, ip: key, path: req.path });
    return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
  }
  next();
});

// --- aggregated health (used by the UI footer, smoke tests and the AIOps agent) ---
app.get(
  '/api/health',
  ah(async (_req, res) => {
    const checks = await Promise.all(
      Object.entries(UPSTREAMS).map(async ([name, url]) => {
        const t = Date.now();
        try {
          const r = await fetch(`${url}/health/ready`, { signal: AbortSignal.timeout(2000) });
          return { name, status: r.ok ? 'up' : 'degraded', httpStatus: r.status, latencyMs: Date.now() - t };
        } catch (err) {
          return { name, status: 'down', error: err.message, latencyMs: Date.now() - t };
        }
      })
    );
    const allUp = checks.every((c) => c.status === 'up');
    res.status(allUp ? 200 : 503).json({ status: allUp ? 'ok' : 'degraded', services: checks });
  })
);

// --- proxies ---
for (const { prefix, upstream } of ROUTES) {
  const proxy = createProxyMiddleware({
    target: UPSTREAMS[upstream],
    changeOrigin: true,
    pathFilter: (path) => path === prefix || path.startsWith(prefix + '/') || path.startsWith(prefix + '?'),
    pathRewrite: { '^/api': '' }, // /api/products/x -> /products/x
    proxyTimeout: 15000,
    on: {
      proxyReq: (proxyReq, req) => {
        proxyReq.setHeader('X-Request-Id', req.id);
        proxyReq.setHeader('X-Forwarded-Prefix', '/api');
        proxyReq.setHeader('X-Gateway-Secret', GATEWAY_INTERNAL_SECRET);
        if (req.headers.host) {
          proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
        }
      },
      error: (err, req, res) => {
        dependencyErrorsTotal.inc({ dependency: upstream });
        log.error('upstream unavailable', { requestId: req.id, upstream, path: req.originalUrl, error: err.message });
        if (!res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
        }
        res.end(JSON.stringify({ error: `The ${upstream} service is temporarily unavailable. Please try again.` }));
      },
    },
  });
  app.use((req, res, next) => {
    if (req.path === prefix || req.path.startsWith(prefix + '/')) res.locals.routeLabel = prefix;
    next();
  }, proxy);
}

start({ port: PORT, init: async () => log.info('routes', { routes: ROUTES, upstreams: UPSTREAMS }) });
