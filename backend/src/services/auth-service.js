/**
 * @file auth-service.js
 * @description Servicio de autenticación frontend: login, registro, logout y persistencia de JWT.
 * @exports { authService }
 */

import { apiClient } from './api-client.js';

export const authService = {
  currentUser: null,

  initAuthState() {
    const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    return Boolean(token);
  },

  async login(email, password) {
    const data = await apiClient.post('/auth/login', { email, password });
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('auth_token', data.access_token);
    }
    return data;
  },

  async loginWithGoogle(credential, teamName = null, birthdate = null) {
    const data = await apiClient.post('/auth/google', {
      credential,
      team_name: teamName,
      birthdate: birthdate
    });
    if (data.access_token) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('auth_token', data.access_token);
    }
    return data;
  },

  async register(username, email, password) {
    return await apiClient.post('/auth/register', { username, email, password });
  },

  logout({ redirect = false } = {}) {
    this.currentUser = null;
    const sessionKeys = [
      'access_token',
      'auth_token',
      'user',
      'team_name',
      'user_avatar',
      'fantasy_active_squad',
      'fantasy_player_stats',
      'fantasy_match_history',
      'fantasy_processed_match_ids',
    ];
    sessionKeys.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('hasSeenOnboarding', 'true');

    try {
      if (window.google?.accounts?.id?.disableAutoSelect) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (_) {}

    if (redirect) {
      window.location.replace('/login');
    }
  }
};
