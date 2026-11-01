/**
 * @file match.js
 * @description Controlador del módulo de partido (screens/match).
 * Expone la simulación en directo y la simulación rápida.
 */

import {
  renderMatchDetails,
  startLiveMatchPlayback,
  executeQuickSimulation,
  DEFAULT_MATCH_DATA
} from '../../js/views/match-detail.js';

export function startMatchSimulation(matchData = DEFAULT_MATCH_DATA) {
  console.debug('[Screen:Match] Iniciando simulación de encuentro.', matchData);
  renderMatchDetails(matchData);
}

export { startLiveMatchPlayback, executeQuickSimulation };
