/**
 * @file match-service.js
 * @description Servicio modular para simulación de partidos, persistencia de resultados,
 * historial y estadísticas del mánager. Soporta modo híbrido (Backend FastAPI + Fallback Offline).
 * @exports { matchService }
 */

import { apiClient } from './api-client.js';
import { simulateMatchEngine } from '../domain/simulation-engine.js';
import { CPU_TEAMS, getRandomCpuTeam } from '../data/cpu-teams.js';

const STORAGE_KEYS = {
  HISTORY: 'fantasy_match_history',
  STATS: 'fantasy_user_stats'
};

export const matchService = {
  /**
   * Ejecuta la simulación de partido llamando al backend FastAPI, con fallback al motor JS cliente.
   * @param {Object} homeSquad
   * @param {Object} awaySquad
   * @returns {Promise<Object>} Resultado completo del partido
   */
  async simulateMatch(homeSquad, awaySquad) {
    const rival = awaySquad || getRandomCpuTeam();

    // 1. Generación inmediata del encuentro táctico con todos los snapshots interactivos
    const match = simulateMatchEngine(homeSquad, rival);

    // 2. Sincronización asíncrona con el backend FastAPI (si está online)
    apiClient.post('/matches/simulate', {
      home_squad: homeSquad,
      away_squad: rival
    }).then(res => {
      console.debug('[MatchService] Partido sincronizado exitosamente con el backend:', res?.match_id);
    }).catch(err => {
      console.debug('[MatchService] Backend offline o deshabilitado, funcionando en modo local:', err.message);
    });

    return match;
  },

  /**
   * Obtiene los equipos rivales de la CPU (desde backend o catálogo local).
   */
  async getCpuOpponents() {
    try {
      const data = await apiClient.get('/matches/cpu-opponents');
      if (data && Array.isArray(data.teams) && data.teams.length > 0) {
        return data.teams;
      }
    } catch (err) {
      console.debug('[MatchService] Obteniendo equipos CPU desde catálogo local.');
    }
    return CPU_TEAMS;
  },

  /**
   * Obtiene el historial reciente de partidos.
   */
  async getMatchHistory(limit = 10) {
    try {
      const data = await apiClient.get(`/matches/history?limit=${limit}`);
      if (data && Array.isArray(data.history) && data.history.length > 0) {
        return data.history;
      }
    } catch (err) {
      console.debug('[MatchService] Leyendo historial desde almacenamiento local.');
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
      }
    } catch (e) {
      console.error('[MatchService] Error leyendo historial local:', e);
    }
    return [];
  },

  /**
   * Guarda el resultado de un partido finalizado en almacenamiento local y memoria.
   * Calcula puntos ganados (+15 victoria, +5 empate, +0 derrota) y actualiza la racha.
   * @param {Object} matchData
   */
  saveMatchResult(matchData) {
    if (!matchData || !matchData.homeTeam || !matchData.awayTeam) return null;

    const homeScore = matchData.homeTeam.score ?? 0;
    const awayScore = matchData.awayTeam.score ?? 0;
    const isWin = homeScore > awayScore;
    const isDraw = homeScore === awayScore;

    const resultType = isWin ? 'VICTORIA' : (isDraw ? 'EMPATE' : 'DERROTA');
    const pointsGained = isWin ? 15 : (isDraw ? 5 : 0);
    const resultSymbol = isWin ? 'V' : (isDraw ? 'E' : 'D');

    // 1. Guardar en Historial de Partidos
    try {
      const rawHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      history.unshift({
        id: matchData.id || Date.now(),
        rival: matchData.awayTeam.name,
        score: `${homeScore} - ${awayScore}`,
        resultado: resultType,
        points: pointsGained,
        fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 30)));
    } catch (err) {
      console.warn('[MatchService] Error guardando historial:', err);
    }

    // 2. Actualizar Estadísticas del Mánager y Racha
    let currentStats = {
      points: 120,
      matchesPlayed: 8,
      wins: 5,
      draws: 2,
      losses: 1,
      ranking: 450,
      streak: ['V', 'V', 'E', 'D']
    };

    try {
      const rawStats = localStorage.getItem(STORAGE_KEYS.STATS);
      if (rawStats) {
        currentStats = { ...currentStats, ...JSON.parse(rawStats) };
      }

      currentStats.matchesPlayed += 1;
      currentStats.points += pointsGained;
      if (isWin) currentStats.wins += 1;
      else if (isDraw) currentStats.draws += 1;
      else currentStats.losses += 1;

      // Ranking sube con victorias y baja levemente con derrotas
      if (isWin) currentStats.ranking = Math.max(1, currentStats.ranking - Math.floor(Math.random() * 8 + 4));
      else if (!isDraw) currentStats.ranking += Math.floor(Math.random() * 3 + 1);

      // Actualizar racha (últimos 5 resultados)
      currentStats.streak = [resultSymbol, ...(currentStats.streak || [])].slice(0, 5);

      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(currentStats));
    } catch (err) {
      console.warn('[MatchService] Error actualizando estadísticas:', err);
    }

    return {
      resultType,
      pointsGained,
      currentStats
    };
  },

  /**
   * Obtiene las estadísticas acumuladas del usuario actual.
   */
  getUserStats() {
    try {
      const rawStats = localStorage.getItem(STORAGE_KEYS.STATS);
      if (rawStats) return JSON.parse(rawStats);
    } catch (e) {
      console.warn('[MatchService] Error leyendo stats:', e);
    }
    return {
      points: 120,
      matchesPlayed: 8,
      wins: 5,
      draws: 2,
      losses: 1,
      ranking: 450,
      streak: ['V', 'V', 'E', 'D']
    };
  }
};
