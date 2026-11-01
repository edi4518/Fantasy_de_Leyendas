/**
 * @file player-service.js
 * @description Servicio para resolver fotos de leyendas desde el bucket de Supabase Storage.
 */

const SUPABASE_STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.storage.supabase.co/storage/v1/s3';
const DEFAULT_AVATAR = '/public/images/default-avatar.png';

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
    filename = slugify(player.name);
  } else if (typeof player === 'string') {
    filename = slugify(player);
  } else {
    filename = String(player);
  }

  // CAMBIO AQUÍ: Usamos .webp exactamente como están subidas en Supabase
  return `${SUPABASE_STORAGE_URL}${filename}.webp`;
}