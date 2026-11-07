/**
 * @file squad-service.js
 * @description Servicio para guardar, validar y recuperar la plantilla y alineación del manager.
 * @exports { squadService }
 */

import { apiClient } from './api-client.js';

export const squadService = {
  async getMySquad() {
    try {
      const res = await apiClient.get('/squads/my-squad');
      const squadObj = res?.squad || res || {};
      const players = Array.isArray(squadObj.players)
        ? squadObj.players
        : (Array.isArray(res?.players) ? res.players : []);

      return {
        ...squadObj,
        squad: squadObj,
        players,
        formation: squadObj.formation || res?.formation || '1-2-2-1',
        name: squadObj.name || res?.name || 'Tu Equipo',
        costo_total: Number(squadObj.costo_total ?? res?.costo_total ?? 0),
        presupuesto_disponible: Number(squadObj.presupuesto_disponible ?? res?.presupuesto_disponible ?? 150.0)
      };
    } catch (err) {
      console.debug('[SquadService] Error al obtener plantilla del backend:', err.message);
      return {
        squad: null,
        players: [],
        formation: '1-2-2-1',
        name: 'Tu Equipo',
        costo_total: 0,
        presupuesto_disponible: 150.0
      };
    }
  },

  async saveSquad(squadPayload) {
    return await apiClient.post('/squads/save', squadPayload);
  }
};
