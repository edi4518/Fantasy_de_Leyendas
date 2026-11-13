/**
 * @file api-client.js
 * @description Cliente HTTP base construido sobre Fetch API nativo con arquitectura de Alta Disponibilidad (Failover).
 * Conecta primordialmente con Vercel Serverless (/api) y conmuta automáticamente a Render (onrender.com/api)
 * como respaldo si el servidor principal no responde o alcanza su límite de cuota.
 *
 * @exports { apiClient, API_BASE_URL, getPrimaryApiUrl, getBackupApiUrl, getCurrentApiUrl, fetchWithFailover }
 */

const IS_LOCAL = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export function getPrimaryApiUrl() {
  if (typeof window !== 'undefined' && window.ENV_API_BASE_URL) {
    return window.ENV_API_BASE_URL;
  }
  return IS_LOCAL
    ? 'http://127.0.0.1:8000/api'
    : (typeof window !== 'undefined' && window.location.origin ? `${window.location.origin}/api` : '/api');
}

export function getBackupApiUrl() {
  return 'https://fantasy-de-leyendas-api.onrender.com/api';
}

let failoverActiveUntil = 0;

export function getCurrentApiUrl() {
  if (!IS_LOCAL && Date.now() < failoverActiveUntil) {
    return getBackupApiUrl();
  }
  return getPrimaryApiUrl();
}

export const API_BASE_URL = getPrimaryApiUrl();

/**
 * Realiza una llamada fetch con timeout configurable y fallback automático a backend de respaldo
 */
export async function fetchWithFailover(endpoint, options = {}) {
  const primaryUrl = getPrimaryApiUrl();
  const backupUrl = getBackupApiUrl();

  const isFailover = !IS_LOCAL && Date.now() < failoverActiveUntil;
  const firstUrl = isFailover ? backupUrl : primaryUrl;
  const secondUrl = isFailover ? primaryUrl : backupUrl;

  try {
    const res = await _doFetch(firstUrl, endpoint, options);
    if (!res.ok && [502, 503, 504, 429].includes(res.status) && !IS_LOCAL) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res;
  } catch (err) {
    if (IS_LOCAL || firstUrl === secondUrl) {
      throw err;
    }

    console.warn(`[Failover] Backend (${firstUrl}${endpoint}) no disponible (${err.message}). Reintentando en backend de respaldo (${secondUrl})...`);
    try {
      const backupRes = await _doFetch(secondUrl, endpoint, options);
      if (secondUrl === backupUrl) {
        failoverActiveUntil = Date.now() + 60000; // Mantener respaldo activo durante 60 segundos
      }
      return backupRes;
    } catch (secondErr) {
      console.error(`[Failover] Ambos backends fallaron:`, secondErr.message);
      throw secondErr;
    }
  }
}

async function _doFetch(baseUrl, endpoint, options = {}) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutMs = IS_LOCAL ? 6000 : (options.timeout || 12000);
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  const config = {
    ...options,
    signal: options.signal || (controller ? controller.signal : undefined)
  };

  try {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const response = await fetch(`${cleanBase}${cleanEndpoint}`, config);
    if (timeoutId) clearTimeout(timeoutId);
    return response;
  } catch (e) {
    if (timeoutId) clearTimeout(timeoutId);
    throw e;
  }
}

export const apiClient = {
  async request(endpoint, options = {}) {
    const token = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('access_token') || localStorage.getItem('auth_token'))
      : null;

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetchWithFailover(endpoint, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error HTTP: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn(`[API Client] Fallo definitivo en ${endpoint}:`, error.message);
      throw error;
    }
  },

  get(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint, body, options) {
    return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) });
  },

  put(endpoint, body, options) {
    return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) });
  },

  delete(endpoint, options) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
};
