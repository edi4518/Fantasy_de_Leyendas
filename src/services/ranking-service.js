/**
 * @file ranking-service.js
 * @description Servicio para consultar tabla de clasificaciones y estadísticas del ranking.
 * @exports { rankingService }
 */

import { apiClient } from './api-client.js';

export const rankingService = {
  async getLeaderboard() {
    return await apiClient.get('/ranking/leaderboard');
  }
};
