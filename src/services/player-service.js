/**
 * @file player-service.js
 * @description Servicio para resolver jugadores y retratos de leyendas desde la API FastAPI y Supabase Storage.
 */

import { apiClient, API_BASE_URL } from './api-client.js?v=50';

const SUPABASE_STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';
const DEFAULT_AVATAR = '/public/images/default-avatar.png';

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

/**
 * Normaliza nombres a slug limpio (sin acentos ni espacios).
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');
}

/**
 * Retorna la URL de la imagen en Supabase apuntando a .webp
 */
export function getPlayerPhoto(player) {
  if (!player) return DEFAULT_AVATAR;

  let filename = '';
  if (typeof player === 'object') {
    if (player.image_filename) {
      return `${SUPABASE_STORAGE_URL}${player.image_filename}`;
    }
    filename = slugify(player.name || player.nombre);
  } else if (typeof player === 'string') {
    filename = slugify(player);
  } else {
    filename = String(player);
  }

  return `${SUPABASE_STORAGE_URL}${filename}.webp`;
}
