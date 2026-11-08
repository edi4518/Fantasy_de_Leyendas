/**
 * @file player-service.js
 * @description Servicio para resolver jugadores y retratos de leyendas desde la API FastAPI y Supabase Storage.
 */

import { apiClient, API_BASE_URL } from './api-client.js';


export const playerService = {
  async getAllPlayers() {
    try {
      return await apiClient.get('/players');
    } catch (e) {
      console.warn(`Error al conectar con ${API_BASE_URL}/players, intentando fallback...`, e);
    }

    // Fallback relativo /api/players (útil en Render/Vercel si el cliente está en el mismo origen)
    try {
      const responseRel = await fetch('/api/players');
      if (responseRel.ok) {
        return await responseRel.json();
      }
    } catch (_) {
      // Ignorar e intentar fallback final
    }

    // Fallback final a Render en la nube o localhost alternativo en local
    const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const fallbackUrl = isLocal
      ? `http://${window.location.hostname === '127.0.0.1' ? 'localhost' : '127.0.0.1'}:8000/api/players`
      : 'https://fantasy-de-leyendas-api.onrender.com/api/players';

    const responseAlt = await fetch(fallbackUrl);
    if (!responseAlt.ok) {
      throw new Error('No se pudo conectar con el servidor de FastAPI.');
    }
    return await responseAlt.json();
  },
};
