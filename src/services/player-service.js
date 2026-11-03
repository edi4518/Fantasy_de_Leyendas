/**
 * @file player-service.js
 * @description Servicio para resolver jugadores y retratos de leyendas desde la API FastAPI y Supabase Storage.
 */

const SUPABASE_STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';
const DEFAULT_AVATAR = '/public/images/default-avatar.png';

const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000/api';
  }
  return 'http://127.0.0.1:8000/api';
};

export const playerService = {
  async getAllPlayers() {
    const primaryUrl = `${getApiBaseUrl()}/players`;
    try {
      const response = await fetch(primaryUrl);
      if (response.ok) {
        return await response.json();
      }
    } catch (e) {
      console.warn(`Error al conectar con ${primaryUrl}, intentando fallback...`, e);
    }

    // Fallback alternativo entre localhost y 127.0.0.1
    const altHost = primaryUrl.includes('127.0.0.1') ? 'localhost' : '127.0.0.1';
    const fallbackUrl = `http://${altHost}:8000/api/players`;
    const responseAlt = await fetch(fallbackUrl);
    if (!responseAlt.ok) {
      throw new Error('No se pudo conectar con el servidor de FastAPI en ningún puerto');
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

  // 1. Si el backend ya mandó una URL completa y válida, usarla directamente
  if (typeof player === 'object' && player.photo_url) {
    return player.photo_url;
  }

  let filename = '';

 if (typeof player === 'object') {
        if (player.image_filename) {
            return `${SUPABASE_STORAGE_URL}${player.image_filename}`;
        }
        // Busca 'nombre' (como viene de MySQL/FastAPI) o 'name' por compatibilidad
        const rawName = player.nombre || player.name || '';
        filename = slugify(rawName);
    } else if (typeof player === 'string') {
        filename = slugify(player);
    } else {
        filename = String(player);
    }
  // CAMBIO AQUÍ: Usamos .webp exactamente como están subidas en Supabase
  return `${SUPABASE_STORAGE_URL}${filename}.webp`;
}
