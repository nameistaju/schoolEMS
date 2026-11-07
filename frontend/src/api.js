// Unified fetch wrapper. All calls are same-origin (/api/...) and route
// through Vite proxy (dev) or Gateway ingress to backend microservices.
const TOKEN_KEY = 'sms_access_token';

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      // ignore storage access errors
    }
  },
};

export class ApiError extends Error {
  constructor(status, message, code = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

export async function api(path, { method = 'GET', body, headers: customHeaders = {} } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const token = tokenStore.get();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    throw new ApiError(0, 'Cannot reach School Management API servers. Please check your connection.');
  }

  const payload = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && token) {
      onUnauthorized();
    }

    let errorMsg = `Request failed (${res.status})`;
    let errorCode = null;

    if (payload.error) {
      if (typeof payload.error === 'object') {
        errorMsg = payload.error.message || errorMsg;
        errorCode = payload.error.code || null;
      } else if (typeof payload.error === 'string') {
        errorMsg = payload.error;
      }
    } else if (payload.message) {
      errorMsg = payload.message;
    }

    throw new ApiError(res.status, errorMsg, errorCode);
  }

  // If response is enveloped in standard { success: true, data: ... }, unpack data
  if (payload && payload.success === true && payload.data !== undefined) {
    return payload.data;
  }

  return payload;
}
