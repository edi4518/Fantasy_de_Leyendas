/**
 * @file position-penalties.js
 * @description Motor de cálculo de penalización de rendimiento por desubicación táctica.
 *
 * REGLAS DE PENALIZACIÓN:
 * - Si un jugador juega en su posición natural: Penalización = 0% (Rendimiento 100%).
 * - Si juega en posición afín / secundaria (ej. MC como MCD o DFI como DFD): Penalización = 15%.
 * - Si juega en posición completamente dispar (ej. Delantero como Defensor): Penalización = 25%.
 *
 * @exports { calculatePositionPenalty, getAdjustedRating }
 */

export const PENALTY_RATES = {
  NONE: 0.0,
  MINOR: 0.15, // 15% de penalización
  MAJOR: 0.25  // 25% de penalización
};

// Categorización simplificada por líneas
const LINES = {
  POR: 'GOALKEEPER',
  DFD: 'DEFENSE', DFC: 'DEFENSE', DFI: 'DEFENSE', CAD: 'DEFENSE', CAI: 'DEFENSE',
  MCD: 'MIDFIELD', MC: 'MIDFIELD', MCO: 'MIDFIELD', MD: 'MIDFIELD', MI: 'MIDFIELD',
  ED: 'ATTACK', EI: 'ATTACK', DC: 'ATTACK', SD: 'ATTACK'
};

/**
 * Calcula la tasa de penalización aplicable.
 * @param {string} naturalPosition - Posición natural de la leyenda (ej. 'DC')
 * @param {string} assignedPosition - Posición táctica asignada en el campo (ej. 'DFC')
 * @returns {number} Tasa de penalización (0.0, 0.15 o 0.25)
 */
export function calculatePositionPenalty(naturalPosition, assignedPosition) {
  if (!naturalPosition || !assignedPosition) return PENALTY_RATES.NONE;
  if (naturalPosition === assignedPosition) return PENALTY_RATES.NONE;

  // Un arquero fuera del arco siempre sufre penalización mayor y viceversa
  if (naturalPosition === 'POR' || assignedPosition === 'POR') {
    return PENALTY_RATES.MAJOR;
  }

  const naturalLine = LINES[naturalPosition];
  const assignedLine = LINES[assignedPosition];

  // Misma línea táctica (ej. DFC asignado a DFD o MC asignado a MCD) -> Penalización Menor (15%)
  if (naturalLine === assignedLine) {
    return PENALTY_RATES.MINOR;
  }

  // Línea diferente (ej. DEL jugando de DEF o DEF jugando de DEL) -> Penalización Mayor (25%)
  return PENALTY_RATES.MAJOR;
}

/**
 * Retorna la valoración final ajustada tras aplicar la penalización.
 * @param {number} baseRating - Valoración base original (70-99)
 * @param {string} naturalPosition
 * @param {string} assignedPosition
 * @returns {{ adjustedRating: number, penaltyApplied: number, penaltyPercentage: number }}
 */
export function getAdjustedRating(baseRating, naturalPosition, assignedPosition) {
  const penaltyRate = calculatePositionPenalty(naturalPosition, assignedPosition);
  const adjusted = Math.round(baseRating * (1 - penaltyRate));

  return {
    adjustedRating: adjusted,
    penaltyApplied: penaltyRate,
    penaltyPercentage: Math.round(penaltyRate * 100)
  };
}
