/**
 * @file player-service.js
 * @description Servicio de acceso a datos para consultar el catálogo de leyendas del fútbol.
 * @exports { playerService }
 */

import { apiClient } from './api-client.js';

export const playerService = {
  async getAllPlayers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return await apiClient.get(`/players${query ? `?${query}` : ''}`);
  },

  async getPlayerById(id) {
    return await apiClient.get(`/players/${id}`);
  }
};
