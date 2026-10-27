/**
 * @file match-service.js
 * @description Servicio para solicitar simulaciones de partidos y obtener historial de resultados.
 * @exports { matchService }
 */

import { apiClient } from './api-client.js';

export const matchService = {
  async simulateMatch(opponentId) {
    return await apiClient.post('/matches/simulate', { opponent_id: opponentId });
  },

  async getMatchHistory() {
    return await apiClient.get('/matches/history');
  }
};
