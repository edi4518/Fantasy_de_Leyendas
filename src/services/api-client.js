/**
 * @file api-client.js
 * @description Cliente HTTP base construido sobre Fetch API nativo.
 * Gestiona URLs base hacia FastAPI (puerto 8000), cabeceras automáticas de JSON, inyección de Bearer JWT
 * y manejo centralizado de respuestas y errores HTTP con timeout y fallback.
 *
 * @exports { apiClient }
 */

const API_BASE_URL = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  ? 'http://127.0.0.1:8000/api'
  : '/api';

export const apiClient = {
  async request(endpoint, options = {}) {
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    const config = {
      ...options,
      headers
    };

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;
    if (controller && !config.signal) {
      config.signal = controller.signal;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Error HTTP: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn(`[API Client] Fallo en ${endpoint}:`, error.message);
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
