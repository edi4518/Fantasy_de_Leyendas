/**
 * @file stamina-service.js
 * @description Módulo de gestión y cálculo del Sistema de Energía (Stamina) y fatiga para Leyendas XI.
 * Incluye desgaste proporcional post-partido, recuperación de suplentes y penalización de rendimiento temporal.
 */

/**
 * Modificadores posicionales de desgaste físico según el despliegue táctico.
 * El Mediocampista (MC) recorre más distancia e intensidad box-to-box; el Portero (POR) tiene el menor desgaste.
 */
export const MODIFICADORES_POSICION = Object.freeze({
  POR: 0.3,
  DEF: 0.9,
  DEL: 1.1,
  MC: 1.3
});

/**
 * Parámetros base del motor de stamina.
 */
export const STAMINA_CONFIG = Object.freeze({
  DESGASTE_BASE_90_MIN: 18,    // 18% base por 90 minutos de juego
  RECUPERACION_BASE_BANCO: 25, // 25% base para jugadores sin minutos
  UMBRAL_OPTIMO: 80,           // >= 80%: Sin penalización
  UMBRAL_FATIGA_MEDIA: 60,     // 60% a 79%: -5% Rating General
  PENALIZACION_MEDIA: 0.05,    // 5% de descuento
  PENALIZACION_SEVERA: 0.15    // 15% de descuento (< 60% energía)
});

/**
 * 1. DESGASTE PROPORCIONAL (Post-Partido)
 * Calcula los puntos porcentuales de energía gastados por un jugador que disputó minutos.
 *
 * Fórmula:
 * Desgaste = (Base * Modif_Posicion) * (100 / Rating_Fisico) * (minutosJugados / 90)
 *
 * @param {Object} jugador - Datos del jugador (posicion/role, Rating_Fisico/rating_fisico, etc.).
 * @param {number} minutosJugados - Cantidad de minutos disputados (0 a 90).
 * @returns {number} Valor numérico de energía desgastada (redondeado a 1 decimal).
 */
export function calcularDesgaste(jugador, minutosJugados = 0) {
  const minutos = Number(minutosJugados) || 0;
  if (minutos <= 0) return 0;

  // Normalización de posición (soporta 'posicion' y 'role')
  const rawPos = (jugador?.posicion || jugador?.role || 'MC').toUpperCase();
  const modPosicion = MODIFICADORES_POSICION[rawPos] ?? 1.0;

  // Normalización de Rating Físico (escala 1-99, previene división por cero)
  const rawFisico = jugador?.Rating_Fisico ?? jugador?.rating_fisico ?? 75;
  const ratingFisico = Math.max(1, Math.min(99, Number(rawFisico) || 75));
  const modFisico = 100 / ratingFisico;

  // Proporción de minutos sobre el total reglamentario (90 minutos)
  const minutosClamped = Math.min(90, Math.max(0, minutos));
  const proporcionMinutos = minutosClamped / 90;

  // Cálculo de desgaste
  const desgaste = (STAMINA_CONFIG.DESGASTE_BASE_90_MIN * modPosicion) * modFisico * proporcionMinutos;

  return Number(desgaste.toFixed(1));
}

/**
 * 2. RECUPERACIÓN (Post-Partido)
 * Calcula la recuperación de energía ESTRICTAMENTE para jugadores que se quedaron en el banco sin entrar.
 *
 * Fórmula:
 * Recuperacion = Base * (Rating_Fisico / 50)
 *
 * @param {Object} jugador - Datos del jugador suplente.
 * @returns {number} Puntos porcentuales a sumar en energía (redondeado a 1 decimal).
 */
export function calcularRecuperacion(jugador) {
  // Normalización de Rating Físico (escala 1-99)
  const rawFisico = jugador?.Rating_Fisico ?? jugador?.rating_fisico ?? 75;
  const ratingFisico = Math.max(1, Math.min(99, Number(rawFisico) || 75));

  // Fórmula de recuperación
  const recuperacion = STAMINA_CONFIG.RECUPERACION_BASE_BANCO * (ratingFisico / 50);

  return Number(recuperacion.toFixed(1));
}

/**
 * 3. PROCESAMIENTO GENERAL DEL PLANTEL (Post-Partido)
 * Recibe el array con los 9 futbolistas del plantel (6 titulares + 3 suplentes),
 * evalúa sus minutos jugados y aplica el desgaste o la recuperación correspondiente,
 * respetando el límite estricto de [0, 100] de energía.
 *
 * @param {Array<Object>} plantelCompleto - Array de 9 jugadores con minutosJugados y energia actual.
 * @returns {Array<Object>} Plantel actualizado con su nuevo nivel de energía y metadatos de stamina.
 */
export function actualizarEnergiaPlantel(plantelCompleto = []) {
  if (!Array.isArray(plantelCompleto)) return [];

  return plantelCompleto.map((jugador) => {
    if (!jugador) return jugador;

    // Clonar o referenciar objeto asegurando inmutabilidad si se desea
    const j = { ...jugador };
    const minutos = Number(j.minutosJugados) || 0;
    const energiaActual = typeof j.energia === 'number' ? j.energia : 100;

    if (minutos > 0) {
      // Caso 1: Jugó minutos -> Aplica desgaste
      const desgaste = calcularDesgaste(j, minutos);
      const energiaFinal = Math.max(0, energiaActual - desgaste);

      j.energia = Number(energiaFinal.toFixed(1));
      j.ultimoDesgaste = desgaste;
      j.ultimaRecuperacion = 0;
    } else {
      // Caso 2: Se quedó en el banco sin entrar -> Aplica recuperación
      const recuperacion = calcularRecuperacion(j);
      const energiaFinal = Math.min(100, energiaActual + recuperacion);

      j.energia = Number(energiaFinal.toFixed(1));
      j.ultimoDesgaste = 0;
      j.ultimaRecuperacion = recuperacion;
    }

    return j;
  });
}

/**
 * 4. PENALIZACIÓN DE FATIGA (Durante la Simulación)
 * Evalúa el nivel de energía de un futbolista y ajusta temporalmente su Rating General para el partido.
 *
 * Reglas:
 * - Energia >= 80%: Rendimiento óptimo, sin penalización (Rating General intacto).
 * - Energia entre 60% y 79%: Resta 5% al Rating General temporal.
 * - Energia < 60%: Resta 15% al Rating General temporal.
 *
 * @param {Object} jugador - Jugador a evaluar (debe incluir energia y Rating_General/rating_general).
 * @returns {{ ratingEfectivo: number, ratingBase: number, penalizacionPct: number, estado: string }}
 */
export function aplicarPenalizacionFatiga(jugador) {
  const energia = typeof jugador?.energia === 'number' ? jugador.energia : 100;
  const ratingBase = Number(jugador?.Rating_General ?? jugador?.rating_general ?? 80);

  let penalizacionPct = 0;
  let estado = 'Óptimo';

  if (energia >= STAMINA_CONFIG.UMBRAL_OPTIMO) {
    penalizacionPct = 0;
    estado = 'Óptimo';
  } else if (energia >= STAMINA_CONFIG.UMBRAL_FATIGA_MEDIA) {
    penalizacionPct = STAMINA_CONFIG.PENALIZACION_MEDIA; // 0.05
    estado = 'Fatiga Leve';
  } else {
    penalizacionPct = STAMINA_CONFIG.PENALIZACION_SEVERA; // 0.15
    estado = 'Fatiga Severa';
  }

  const factor = 1 - penalizacionPct;
  const ratingEfectivo = Math.round(ratingBase * factor);

  return {
    ratingEfectivo,
    ratingBase,
    penalizacionPct: Math.round(penalizacionPct * 100),
    factor,
    estado
  };
}

export default {
  MODIFICADORES_POSICION,
  STAMINA_CONFIG,
  calcularDesgaste,
  calcularRecuperacion,
  actualizarEnergiaPlantel,
  aplicarPenalizacionFatiga
};

