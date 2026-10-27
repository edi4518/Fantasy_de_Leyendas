/**
 * @file squad-service.js
 * @description Servicio para guardar, validar y recuperar la plantilla y alineación del manager.
 * @exports { squadService }
 */

import { apiClient } from './api-client.js';

export const squadService = {
  async getMySquad() {
    return await apiClient.get('/squads/my-squad');
  },

  async saveSquad(squadPayload) {
    return await apiClient.post('/squads/save', squadPayload);
  }
};
