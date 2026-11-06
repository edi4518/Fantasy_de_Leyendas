/**
 * @file auth-service.js
 * @description Servicio de autenticación frontend: login, registro, logout y persistencia de JWT.
 * @exports { authService }
 */

import { apiClient } from './api-client.js';

export const authService = {
  currentUser: null,

  initAuthState() {
    const token = localStorage.getItem('access_token');
    return Boolean(token);
  },

  async login(email, password) {
    const data = await apiClient.post('/auth/login', { email, password });
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
    }
    return data;
  },

  async register(username, email, password) {
    return await apiClient.post('/auth/register', { username, email, password });
  },

  logout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  }
};
