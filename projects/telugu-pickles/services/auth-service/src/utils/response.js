/**
 * Standard Unified API Response Envelopes
 * Phase 1: Multi-Tenant Foundation & Identity Service
 */

function getRequestId(req) {
  return req?.id || req?.headers?.['x-request-id'] || null;
}

function sendSuccess(res, data = null, status = 200, req = null) {
  return res.status(status).json({
    success: true,
    data,
    meta: {
      request_id: getRequestId(req || res.req),
      timestamp: new Date().toISOString(),
    },
  });
}

function sendError(res, code, message, status = 400, details = null, req = null) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      request_id: getRequestId(req || res.req),
      timestamp: new Date().toISOString(),
    },
  });
}

module.exports = { sendSuccess, sendError, getRequestId };
