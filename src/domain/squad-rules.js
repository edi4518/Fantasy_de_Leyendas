/**
 * @file squad-rules.js
 * @description Reglas de dominio puras para la conformación de plantillas en Fantasy de Leyendas.
 *
 * REGLA INMUTABLE:
 * - El presupuesto total de la plantilla no debe exceder los 100.0 Millones de Euros (€).
 * - La plantilla titular debe contar exactamente con 11 jugadores (1 POR y 10 de campo).
 *
 * @exports { MAX_BUDGET, REQUIRED_SQUAD_SIZE, calculateTotalCost, isBudgetValid, validateSquadEligibility }
 */

export const MAX_BUDGET = 100.0; // En millones de euros
export const REQUIRED_SQUAD_SIZE = 11;

/**
 * Calcula el coste total acumulado de una lista de jugadores.
 * @param {Array<{ price: number }>} players
 * @returns {number} Coste total en millones
 */
export function calculateTotalCost(players = []) {
  const sum = players.reduce((total, p) => total + (Number(p.price) || 0), 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Verifica si el coste acumulado está dentro del presupuesto máximo permitido (100M).
 * @param {number} totalCost
 * @returns {boolean}
 */
export function isBudgetValid(totalCost) {
  return totalCost <= MAX_BUDGET;
}

/**
 * Valida la elegibilidad completa de una plantilla para poder competir.
 * @param {Array<Object>} players
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateSquadEligibility(players = []) {
  const errors = [];
  const totalCost = calculateTotalCost(players);

  if (!isBudgetValid(totalCost)) {
    errors.push(`Presupuesto excedido: ${totalCost}M supera el límite de ${MAX_BUDGET}M.`);
  }

  if (players.length !== REQUIRED_SQUAD_SIZE) {
    errors.push(`Cantidad incorrecta de jugadores: se requieren ${REQUIRED_SQUAD_SIZE}, actuales: ${players.length}.`);
  }

  const goalkeepers = players.filter((p) => p.assignedPosition === 'POR' || p.naturalPosition === 'POR');
  if (goalkeepers.length !== 1) {
    errors.push(`Debe haber exactamente 1 arquero (POR) en la alineación titular.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    remainingBudget: Math.max(0, MAX_BUDGET - totalCost)
  };
}
