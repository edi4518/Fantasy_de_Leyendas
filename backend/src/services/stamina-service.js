/**
 * @file stamina-service.js
 * @description Módulo de gestión y cálculo del Sistema de Energía (Stamina) y fatiga para Leyendas XI.
 * Modelo de "Balance Neto":
 * Evalúa simultáneamente los minutos jugados (desgaste) y los minutos descansados en banco (recuperación).
 * Garantiza que suplentes que entran pocos minutos obtengan un saldo positivo de energía.
 */

/**
 * Modificadores posicionales de desgaste físico según el despliegue táctico.
 * POR (x0.3), DEF (x0.9), DEL (x1.1), MC (x1.3).
 */
export const MODIFICADORES_POSICION = Object.freeze({
  POR: 0.35, // Menor exigencia aeróbica
  DEF: 1.05, // Coberturas, repliegues y duelos de contención (6v6)
  DEL: 1.10, // Sprints y desmarques de definición
  MC: 1.20   // Mayor volumen de recorrido y desgaste box-to-box
});

/**
 * Parámetros base del balance matemático neto.
 */
export const STAMINA_CONFIG = Object.freeze({
  DESGASTE_BASE_90_MIN: 14,    // Desgaste base para 90 minutos de juego titular (~15-21% según posición y físico)
  RECUPERACION_BASE_90_MIN: 20,// Recuperación GRADUAL (+20% base por partido completo sin jugar; pasar de 0 a 100 toma 5 descansos)
  UMBRAL_OPTIMO: 80,           // >= 80%: Rendimiento óptimo (0% penalización)
  UMBRAL_FATIGA_MEDIA: 60,     // 60% a 79%: -5% Rating General temporal
  PENALIZACION_MEDIA: 0.05,    // 5% de descuento
  PENALIZACION_SEVERA: 0.15    // 15% de descuento (< 60% energía)
});

/**
 * 1. SISTEMA DE BALANCE NETO (Post-Partido)
 * Calcula simultáneamente la recuperación por minutos descansados y el desgaste por minutos jugados.
 *
 * A) Desgaste por jugar:
 *    Todo jugador que dispute minutos (titular completo, titular sustituido o suplente que ingresa)
 *    sufre desgaste físico proporcional a su tiempo en cancha, rol táctico y rating físico.
 *    Desgaste = (18 * Modificador_Posicion) * (100 / Rating_Fisico) * (minutosJugados / 90)
 *
 * B) Recuperación por descanso:
 *    Se aplica exclusivamente a futbolistas que descansaron en el banquillo sin disputar minutos (0 min),
 *    permitiendo que la rotación de plantilla recupere energía de forma progresiva (~35% por partido).
 *    Recuperacion = 35 * (Rating_Fisico / 75)
 *
 * C) Balance Final:
 *    CambioNeto = Recuperacion - Desgaste
 *    energiaFinal = Clamp(energiaActual + CambioNeto, 0, 100)
 *
 * @param {Object} jugador - Datos del jugador (posicion/role, Rating_Fisico/rating_fisico, energia, etc.).
 * @param {number} minutosJugados - Cantidad de minutos disputados (0 a 90).
 * @returns {{ cambioNeto: number, recuperacion: number, desgaste: number, energiaFinal: number }}
 */
export function calcularCambioEnergia(jugador, minutosJugados = 0) {
  // Clamping de minutos jugados entre 0 y 90
  const jugados = Math.max(0, Math.min(90, Number(minutosJugados) || 0));
  const descansados = 90 - jugados;

  // Normalización de Rating Físico (escala 1-99, previene división por 0)
  const rawFisico = jugador?.Rating_Fisico ?? jugador?.rating_fisico ?? 75;
  const ratingFisico = Math.max(1, Math.min(99, Number(rawFisico) || 75));

  // Normalización de Posición (POR, DEF, DEL, MC)
  const rawPos = (jugador?.assignedRole || jugador?.role || jugador?.posicion_base || jugador?.posicion || 'MC').toUpperCase();
  const modPosicion = MODIFICADORES_POSICION[rawPos] ?? 1.0;

  let recuperacion = 0;
  let desgaste = 0;

  if (jugados > 0) {
    // El jugador compitió en cancha: sufre desgaste físico proporcional
    const modFisico = 100 / ratingFisico;
    desgaste = (STAMINA_CONFIG.DESGASTE_BASE_90_MIN * modPosicion) * modFisico * (jugados / 90);
    recuperacion = 0;
  } else {
    // El jugador descansó el partido completo en el banquillo (0 minutos): recupera energía
    recuperacion = STAMINA_CONFIG.RECUPERACION_BASE_90_MIN * (ratingFisico / 75);
    desgaste = 0;
  }

  // C) Balance Neto
  const cambioNeto = Number((recuperacion - desgaste).toFixed(1));
  const rawEnergia = jugador?.energia ?? jugador?.stamina;
  const energiaActual = (rawEnergia !== undefined && rawEnergia !== null && !isNaN(Number(rawEnergia)))
    ? Math.max(0, Math.min(100, Number(rawEnergia)))
    : 100;
  const energiaFinal = Number(Math.max(0, Math.min(100, energiaActual + cambioNeto)).toFixed(1));

  return {
    cambioNeto,
    recuperacion: Number(recuperacion.toFixed(1)),
    desgaste: Number(desgaste.toFixed(1)),
    energiaFinal,
    minutosJugados: jugados,
    minutosDescansados: descansados
  };
}

// Aliases para retrocompatibilidad
export function calcularDesgaste(jugador, minutosJugados = 0) {
  return calcularCambioEnergia(jugador, minutosJugados).desgaste;
}

export function calcularRecuperacion(jugador) {
  return calcularCambioEnergia(jugador, 0).recuperacion;
}

/**
 * 2. PROCESAMIENTO GENERAL DEL PLANTEL (Post-Partido)
 * Recibe el array con los 9 futbolistas del equipo, aplica el cálculo de Balance Neto
 * según los minutos disputados por cada uno y actualiza su energía de forma acotada [0, 100].
 *
 * @param {Array<Object>} plantelCompleto - Array de los 9 futbolistas.
 * @returns {Array<Object>} Plantel actualizado con el nuevo valor de energía y desglose del balance.
 */
export function actualizarEnergiaPlantel(plantelCompleto = []) {
  if (!Array.isArray(plantelCompleto)) return [];

  return plantelCompleto.map((jugador) => {
    if (!jugador) return jugador;

    const j = { ...jugador };
    const minutos = Number(j.minutosJugados) || 0;

    const balance = calcularCambioEnergia(j, minutos);

    j.energia = balance.energiaFinal;
    j.cambioNetoStamina = balance.cambioNeto;
    j.recuperacionCalculada = balance.recuperacion;
    j.desgasteCalculado = balance.desgaste;
    j.minutosDescansados = balance.minutosDescansados;

    return j;
  });
}

/**
 * 3. PENALIZACIÓN DE FATIGA (Durante la Simulación)
 * Evalúa la energía del futbolista y penaliza temporalmente su Rating General para el partido.
 *
 * Criterios:
 * - Si energía >= 80%: Rendimiento óptimo, sin cambios en Rating_General (0% penalización).
 * - Si energía entre 60% y 79%: Resta 5% a su Rating_General temporal.
 * - Si energía < 60%: Resta 15% a su Rating_General temporal.
 *
 * @param {Object} jugador - Jugador con propiedades 'energia' y 'Rating_General' (o rating_general).
 * @returns {{ ratingEfectivo: number, ratingBase: number, penalizacionPct: number, factor: number, estado: string }}
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
    estado = 'Fatiga Leve (-5%)';
  } else {
    penalizacionPct = STAMINA_CONFIG.PENALIZACION_SEVERA; // 0.15
    estado = 'Fatiga Severa (-15%)';
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
  calcularCambioEnergia,
  calcularDesgaste,
  calcularRecuperacion,
  actualizarEnergiaPlantel,
  aplicarPenalizacionFatiga
};
