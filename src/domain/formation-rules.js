/**
 * @file formation-rules.js
 * @description Definición de las 6 formaciones tácticas oficiales de Leyendas XI (formato 6v6).
 * Incluye slots espaciales, roles asignados, ventajas matemáticas y counters tácticos.
 *
 * @exports { FORMATIONS_6V6, getPositionsForFormation, isValidFormation, getTacticalCounter }
 */

export const FORMATIONS_6V6 = {
  '1-2-2-1': {
    key: '1-2-2-1',
    name: '1-2-2-1 (Equilibrio puro)',
    shortName: 'Equilibrio puro',
    description: 'Estructura clásica que permite control tanto en el fondo como en el centro del campo, ideal para transiciones seguras.',
    slots: ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL'],
    multipliers: { attack: 1.00, defense: 1.02, creation: 1.02, technique: 1.00 },
    // Counter: castiga el desbalance kamikaze de 1-1-1-3 con transiciones ordenadas
    counters: ['1-1-1-3']
  },
  '1-2-1-2': {
    key: '1-2-1-2',
    name: '1-2-1-2 (Rombo)',
    shortName: 'Rombo',
    description: 'Disposición en rombo en el medio campo que conecta la zaga con dos puntas móviles, perfecta para el juego combinativo y vertical por el centro.',
    slots: ['POR', 'DEF', 'DEF', 'MC', 'DEL', 'DEL'],
    multipliers: { attack: 1.12, defense: 0.96, creation: 0.95, technique: 1.08 },
    // Counter: los dos puntas móviles desbordan la línea de 3 defensores estáticos
    counters: ['1-3-1-1']
  },
  '1-1-2-2': {
    key: '1-1-2-2',
    name: '1-1-2-2 (Ataque Frontal)',
    shortName: 'Ataque Frontal',
    description: 'Sacrifica ancho defensivo para acumular poder de fuego arriba. Ideal si se ficha a creadores y finalizadores letales.',
    slots: ['POR', 'DEF', 'MC', 'MC', 'DEL', 'DEL'],
    multipliers: { attack: 1.18, defense: 0.85, creation: 1.05, technique: 1.05 },
    // Counter: sobrecarga ofensiva que satura a las defensas tradicionales de 2 defensores
    counters: ['1-2-2-1']
  },
  '1-3-1-1': {
    key: '1-3-1-1',
    name: '1-3-1-1 (Alta Presión y Creación)',
    shortName: 'Alta Presión y Creación',
    description: 'Enfoque en ahogar al rival en su campo y surtir de balones constantes al único delantero centro.',
    slots: ['POR', 'DEF', 'DEF', 'DEF', 'MC', 'DEL'],
    multipliers: { attack: 0.90, defense: 1.16, creation: 0.90, technique: 0.95 },
    // Counter: cerrojo de 3 defensas con presión que anula los circuitos de pase de 1-1-3-1
    counters: ['1-1-3-1']
  },
  '1-1-3-1': {
    key: '1-1-3-1',
    name: '1-1-3-1 (Dominio del Medio)',
    shortName: 'Dominio del Medio',
    description: 'Enfoque en ahogar al rival en su campo y surtir de balones constantes al único delantero centro, priorizando el control de la pelota.',
    slots: ['POR', 'DEF', 'MC', 'MC', 'MC', 'DEL'],
    multipliers: { attack: 0.92, defense: 0.88, creation: 1.22, technique: 1.20 },
    // Counter: superioridad de 3 mediocampistas secuestra la posesión a esquemas de ataque directo
    counters: ['1-1-2-2']
  },
  '1-1-1-3': {
    key: '1-1-1-3',
    name: '1-1-1-3 (Ultra Ofensivo / All-In)',
    shortName: 'Ultra Ofensivo / All-In',
    description: 'Formación kamikaze. Todo el poderío se vuelca en dinamitar el arco rival con tres delanteros letales.',
    slots: ['POR', 'DEF', 'MC', 'DEL', 'DEL', 'DEL'],
    multipliers: { attack: 1.25, defense: 0.78, creation: 0.80, technique: 1.05 },
    // Counter: 3 delanteros de élite rompen cualquier muro defensivo estático por saturación
    counters: ['1-3-1-1']
  }
};

export function getPositionsForFormation(formationKey) {
  return FORMATIONS_6V6[formationKey]?.slots || FORMATIONS_6V6['1-2-2-1'].slots;
}

export function isValidFormation(formationKey) {
  return Boolean(FORMATIONS_6V6[formationKey]);
}

/**
 * Determina si formationA es counter táctico de formationB.
 * @param {string} formA
 * @param {string} formB
 * @returns {boolean}
 */
export function isTacticalCounter(formA, formB) {
  const cfg = FORMATIONS_6V6[formA];
  return Boolean(cfg?.counters?.includes(formB));
}
