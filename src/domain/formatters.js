/**
 * @file formatters.js
 * @description Utilidades de formateo para precios en millones, fechas y métricas.
 * @exports { formatPriceMillions, formatRating }
 */

export function formatPriceMillions(value) {
  const num = Number(value) || 0;
  return `${num.toFixed(1)}M €`;
}

export function formatRating(rating) {
  return Math.round(Number(rating) || 0);
}
