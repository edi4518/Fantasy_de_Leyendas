/**
 * @file player-service.js
 * @description Servicio para resolver fotos de leyendas desde el bucket de Supabase Storage.
 */

const SUPABASE_STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.storage.supabase.co/storage/v1/s3';
const DEFAULT_AVATAR = '/public/images/default-avatar.png';

const API_BASE_URL = 'http://localhost:8000/api';

export const playerService = {
  async getAllPlayers() {
    const response = await fetch(`${API_BASE_URL}/players`);
    if (!response.ok) {
      throw new Error('No se pudo conectar con el servidor de FastAPI');
    }
    return await response.json();
  },
  // ... demás métodos del servicio
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
    // Busca 'nombre' (como viene de MySQL/FastAPI) o 'name' por compatibilidad
    const rawName = player.nombre || player.name || '';
    filename = slugify(rawName);
  } else if (typeof player === 'string') {
    filename = slugify(player);
  } else {
    filename = String(player);
  }

  // Si no se obtuvo un nombre válido, mostrar avatar por defecto
  if (!filename || filename === 'undefined') {
    return DEFAULT_AVATAR;
  }

  // 2. Construir la ruta hacia Supabase con el slug en .webp
  return `${SUPABASE_STORAGE_URL}${filename}.webp`;
}