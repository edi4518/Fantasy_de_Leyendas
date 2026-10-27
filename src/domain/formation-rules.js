/**
 * @file formation-rules.js
 * @description Definición de formaciones tácticas soportadas y distribución espacial de slots.
 *
 * @exports { FORMATIONS, getPositionsForFormation, isValidFormation }
 */

export const FORMATIONS = {
  '4-3-3': {
    name: '4-3-3 Clásico',
    slots: ['POR', 'DFD', 'DFC', 'DFC', 'DFI', 'MC', 'MC', 'MC', 'ED', 'DC', 'EI']
  },
  '4-4-2': {
    name: '4-4-2 Equilibrado',
    slots: ['POR', 'DFD', 'DFC', 'DFC', 'DFI', 'MD', 'MC', 'MC', 'MI', 'DC', 'DC']
  },
  '3-5-2': {
    name: '3-5-2 Ofensivo',
    slots: ['POR', 'DFC', 'DFC', 'DFC', 'CAD', 'MC', 'MCD', 'MC', 'CAI', 'DC', 'DC']
  }
};

export function getPositionsForFormation(formationKey) {
  return FORMATIONS[formationKey]?.slots || [];
}

export function isValidFormation(formationKey) {
  return Boolean(FORMATIONS[formationKey]);
}
