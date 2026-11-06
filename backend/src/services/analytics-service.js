/**
 * @file analytics-service.js
 * @description Servicio para obtener métricas agregadas del meta-juego (leyendas más elegidas, winrates).
 * @exports { analyticsService }
 */

import { apiClient } from './api-client.js';

export const analyticsService = {
  async getMetaStats() {
    return await apiClient.get('/analytics/meta-stats');
  }
};
