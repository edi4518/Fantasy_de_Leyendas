import {
  calcularCambioEnergia,
  calcularDesgaste,
  calcularRecuperacion,
  actualizarEnergiaPlantel,
  aplicarPenalizacionFatiga,
  MODIFICADORES_POSICION,
  STAMINA_CONFIG
} from './stamina-service.js';
/**
 * @file match-service.js
 * @description Servicio modular para simulación de partidos, persistencia de resultados,
 * historial y estadísticas del mánager. Soporta modo híbrido (Backend FastAPI + Fallback Offline).
 * @exports { matchService }
 */

import { apiClient } from './api-client.js';
import { simulateMatchEngine } from '../domain/simulation-engine.js';
import { CPU_TEAMS, getRandomCpuTeam } from '../domain/cpu-teams.js';

const STORAGE_KEYS = {
  HISTORY: 'fantasy_match_history',
  STATS: 'fantasy_user_stats',
  PLAYER_STATS: 'fantasy_player_stats'
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

    // Generación inmediata del encuentro táctico con todos los snapshots interactivos.
    // El resultado oficial se persiste en MySQL al finalizar el encuentro mediante saveMatchResult() -> POST /api/matches/record.
    const match = simulateMatchEngine(homeSquad, rival);
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
  /**
   * Comprueba si un partido ya fue persistido previamente para evitar duplicaciones.
   */
  isMatchAlreadyProcessed(matchId) {
    if (!matchId) return false;
    try {
      const raw = localStorage.getItem('fantasy_processed_match_ids');
      const list = raw ? JSON.parse(raw) : [];
      return list.includes(String(matchId));
    } catch (e) {
      return false;
    }
  },

  markMatchAsProcessed(matchId) {
    if (!matchId) return;
    try {
      const raw = localStorage.getItem('fantasy_processed_match_ids');
      const list = raw ? JSON.parse(raw) : [];
      if (!list.includes(String(matchId))) {
        list.push(String(matchId));
        localStorage.setItem('fantasy_processed_match_ids', JSON.stringify(list.slice(-50)));
      }
    } catch (e) {}
  },

  getCachedMatchOutcome(matchId, matchData) {
    const homeScore = matchData.homeTeam?.score ?? 0;
    const awayScore = matchData.awayTeam?.score ?? 0;
    const isWin = homeScore > awayScore;
    const isDraw = homeScore === awayScore;
    return {
      resultType: isWin ? 'VICTORIA' : (isDraw ? 'EMPATE' : 'DERROTA'),
      pointsGained: isWin ? 25 : (isDraw ? 5 : -15),
      currentStats: this.getUserStats(),
      playerStats: this.getAllPlayerStats(),
      matchMvp: null
    };
  },

  saveMatchResult(matchData) {
    if (!matchData || !matchData.homeTeam || !matchData.awayTeam) return null;

    const matchId = String(matchData.id || matchData._simId || Date.now());
    matchData.id = matchId;

    // Idempotencia estricta: evitar procesar o sumar dos veces el mismo encuentro
    if (matchData._isProcessed || this.isMatchAlreadyProcessed(matchId)) {
      console.info(`[MatchService] Partido #${matchId} ya registrado previamente. Evitando duplicación.`);
      return matchData.saveOutcome || this.getCachedMatchOutcome(matchId, matchData);
    }

    matchData._isProcessed = true;
    this.markMatchAsProcessed(matchId);

    const homeScore = matchData.homeTeam.score ?? 0;
    const awayScore = matchData.awayTeam.score ?? 0;
    const isWin = homeScore > awayScore;
    const isDraw = homeScore === awayScore;

    const resultType = isWin ? 'VICTORIA' : (isDraw ? 'EMPATE' : 'DERROTA');
    const pointsGained = isWin ? 25 : (isDraw ? 5 : -15);
    const resultSymbol = isWin ? 'V' : (isDraw ? 'E' : 'D');

    // 1. Guardar en Historial de Partidos
    try {
      const rawHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const history = rawHistory ? JSON.parse(rawHistory) : [];
      history.unshift({
        id: matchId,
        rival: matchData.awayTeam.name,
        opponent: matchData.awayTeam.name,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        homeScore,
        awayScore,
        score: `${homeScore} - ${awayScore}`,
        resultado: resultType,
        points: pointsGained,
        events: matchData.events || [],
        stats: matchData.stats || {},
        lineups: matchData.lineups || {},
        fecha: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relativeDate: 'Hoy'
      });
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history.slice(0, 30)));
    } catch (err) {
      console.warn('[MatchService] Error guardando historial:', err);
    }

    // 2. Actualizar Estadísticas del Mánager y Racha
    let currentStats = {
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      ranking: 1,
      streak: []
    };

    try {
      const rawStats = localStorage.getItem(STORAGE_KEYS.STATS);
      if (rawStats) {
        currentStats = { ...currentStats, ...JSON.parse(rawStats) };
      }

      currentStats.matchesPlayed += 1;
      currentStats.points = Math.max(0, currentStats.points + pointsGained);
      if (isWin) currentStats.wins += 1;
      else if (isDraw) currentStats.draws += 1;
      else currentStats.losses += 1;

      // Actualizar racha (últimos 5 resultados)
      currentStats.streak = [resultSymbol, ...(currentStats.streak || [])].slice(0, 5);

      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(currentStats));
    } catch (err) {
      console.warn('[MatchService] Error actualizando estadísticas:', err);
    }

    // 3. Registrar estadísticas acumuladas reales de los jugadores
    const statsResult = this.recordPlayerMatchStats(matchData);

    // Invalidar caché del Dashboard para que el MVP y métricas reflejen este partido de inmediato
    try {
      if (typeof window !== 'undefined') {
        if (typeof window.invalidateDashboardCache === 'function') {
          window.invalidateDashboardCache();
        }
        sessionStorage.removeItem('fantasy_dashboard_cache');
        sessionStorage.removeItem('fantasy_dashboard_cache_time');
      }
    } catch (_) {}

    // 4. Persistir el resultado oficial, MVP, estadísticas cara a cara, eventos y stamina en MySQL
    let persistencePromise = null;
    try {
      let currentUserId = null;
      const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
      if (savedUser && savedUser.id) currentUserId = Number(savedUser.id);

      let activeSquadPlayers = [];
      try {
        const rawSq = localStorage.getItem('fantasy_active_squad');
        if (rawSq) {
          const parsedSq = JSON.parse(rawSq);
          if (Array.isArray(parsedSq?.players)) activeSquadPlayers = parsedSq.players;
        }
      } catch (_) {}

      persistencePromise = apiClient.post('/matches/record', {
        rival_name: matchData.awayTeam.name || 'Leyendas Rival',
        home_score: homeScore,
        away_score: awayScore,
        formation: matchData.homeTeam?.formation || '1-2-2-1',
        away_formation: matchData.awayTeam?.formation || '1-2-2-1',
        events: Array.isArray(matchData.events) ? matchData.events : [],
        stats: matchData.stats || {},
        mvp: matchData.officialMvp || statsResult.matchMvp || null,
        squad_players: activeSquadPlayers,
        player_stats: statsResult.stats || {},
        user_id: currentUserId,
        rival_user_id: matchData.awayTeam?.user_id || matchData.awayTeam?.userId || null
      }).then((res) => {
        if (res && typeof res.nuevo_elo === 'number') {
          try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            u.elo_rating = res.nuevo_elo;
            if (res.record?.partidos_jugados !== undefined) {
              u.partidos_jugados = res.record.partidos_jugados;
            }
            localStorage.setItem('user', JSON.stringify(u));
          } catch (_) {}
        }
        if (Number.isInteger(res?.current_rank) && res.current_rank > 0) {
          try {
            const rawStats = localStorage.getItem(STORAGE_KEYS.STATS);
            const updatedStats = rawStats ? JSON.parse(rawStats) : {};
            updatedStats.ranking = res.current_rank;
            localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(updatedStats));
            if (matchData.saveOutcome?.currentStats) {
              matchData.saveOutcome.currentStats.ranking = res.current_rank;
            }
          } catch (err) {
            console.warn('[MatchService] Error guardando la posición actual:', err);
          }
        }
        console.debug('[MatchService] Partido guardado en MySQL exitosamente:', res);
        return res;
      }).catch((err) => {
        console.debug('[MatchService] Guardado en MySQL omitido (modo local):', err.message);
        return null;
      });
    } catch (err) {
      console.error('[MatchService] No se pudo iniciar el guardado del partido:', err);
    }

    const outcome = {
      resultType,
      pointsGained,
      currentStats,
      playerStats: statsResult.stats,
      matchMvp: matchData.officialMvp || statsResult.matchMvp,
      persistencePromise
    };
    matchData.saveOutcome = outcome;
    return outcome;
  },

  /**
   * Compara de forma flexible dos nombres de jugadores (ej. "L. Messi" y "Messi")
   */
  isSamePlayer(a, b) {
    if (!a || !b) return false;
    const cleanA = a.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
    const cleanB = b.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
    return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
  },

  /**
   * Registra y acumula las estadísticas individuales de cada jugador (partidos, goles, notas)
   * tras disputarse un partido oficial calculando notas dinámicas reales sin hardcodear.
   */
  /**
   * Registra y acumula las estadísticas individuales de cada jugador (partidos, goles, notas)
   * tras disputarse un partido oficial calculando notas dinámicas reales sin hardcodear.
   * Procesa ÚNICAMENTE los futbolistas del equipo del usuario, ignorando cualquier repetición en el rival.
   */
  recordPlayerMatchStats(matchData) {
    if (!matchData) return { stats: {}, matchMvp: null };
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_STATS);
      const stats = raw ? JSON.parse(raw) : {};

      // 1. Obtener la plantilla oficial de MI equipo (6 titulares y 4 suplentes)
      let activeSquadObj = null;
      let squadSlots = [];
      try {
        const rawSquad = localStorage.getItem('fantasy_active_squad');
        if (rawSquad) {
          activeSquadObj = JSON.parse(rawSquad);
          if (Array.isArray(activeSquadObj?.players)) {
            squadSlots = activeSquadObj.players;
          }
        }
      } catch (e) {}

      // Fallback a los titulares/suplentes de lineups si no están en localStorage
      if (squadSlots.length === 0) {
        const hStarters = matchData.lineups?.home || matchData.lineups?.homeStarters || [];
        const hBench = matchData.lineups?.homeBench || [];
        squadSlots = [...hStarters, ...hBench];
      }

      // Asegurar array de 10 posiciones respetando el índice exacto
      while (squadSlots.length < 10) {
        squadSlots.push(null);
      }

      const events = Array.isArray(matchData.events) ? matchData.events : [];
      const homeScore = matchData.homeTeam?.score ?? 0;
      const awayScore = matchData.awayTeam?.score ?? 0;

      // Eventos LOCALES estrictos (ignora cualquier gol, falta o cambio del equipo rival)
      const homeGoalEvents = events.filter(e =>
        e.side === 'home' && (e.type === 'goal' || e.type === 'penalty-goal')
      );
      const homeSubInEvents = events.filter(e =>
        e.side === 'home' && e.type === 'substitution'
      );

      // Procesar sistema de Stamina / Energía para la plantilla del mánager
      try {
        const squadWithMinutes = squadSlots.map((player, idx) => {
          if (!player) return null;
          const isStarter = idx < 6;
          let minutos = 0;
          if (isStarter) {
            const wasSubbedOut = homeSubInEvents.find(e =>
              this.isSamePlayer(e.playerOut, player.name) ||
              (e.detail && e.detail.toLowerCase().includes((player.name || '').toLowerCase()))
            );
            minutos = wasSubbedOut ? Math.max(1, Number(wasSubbedOut.minute) || 54) : 90;
          } else {
            const wasSubbedIn = homeSubInEvents.find(e =>
              this.isSamePlayer(e.playerIn || e.player, player.name)
            );
            minutos = wasSubbedIn ? Math.max(1, 90 - (Number(wasSubbedIn.minute) || 54)) : 0;
          }
          return {
            ...player,
            minutosJugados: minutos
          };
        });

        const updatedSquadStamina = actualizarEnergiaPlantel(squadWithMinutes);

        // Persistir la plantilla de forma garantizada en fantasy_active_squad
        let squadToSave = activeSquadObj;
        if (!squadToSave || typeof squadToSave !== 'object') {
          squadToSave = {
            name: matchData.homeTeam?.name || 'Tu Equipo',
            formation: matchData.homeTeam?.formation || '1-2-2-1',
            players: []
          };
        }

        squadToSave.players = updatedSquadStamina;
        localStorage.setItem('fantasy_active_squad', JSON.stringify(squadToSave));
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(new CustomEvent('fantasy:squad-updated', { detail: squadToSave }));
        }
        console.info('[MatchService] Plantilla actualizada con nuevo estado de Stamina tras el partido.');
      } catch (staminaErr) {
        console.warn('[MatchService] Error actualizando stamina del plantel:', staminaErr);
      }

      let matchMvp = null;
      let highestRating = -1;

      // Iterar sobre los futbolistas válidos de MI equipo para registrar estadísticas
      squadSlots.forEach((p, idx) => {
        const pName = p.name || p;
        if (!pName) return;

        if (!stats[pName]) {
          stats[pName] = {
            name: pName,
            role: p.role || (idx === 0 ? 'POR' : (idx < 3 ? 'DEF' : (idx < 5 ? 'MC' : 'DEL'))),
            matchesPlayed: 0,
            goals: 0,
            cleanSheets: 0,
            mvpAwards: 0,
            totalRating: 0,
            avgRating: null,
            matchRatings: []
          };
        }

        const isStarter = idx < 6;
        // Los suplentes SOLO juegan si existió un evento explícito de sustitución en MI equipo
        const wasSubbedIn = !isStarter && homeSubInEvents.some(sub => this.isSamePlayer(sub.player, pName));

        // Si es suplente y no ingresó en la cancha en este partido, no acumula PJ ni nota
        if (!isStarter && !wasSubbedIn) {
          return;
        }

        // Sumar exactamente 1 partido jugado por el encuentro
        stats[pName].matchesPlayed = (stats[pName].matchesPlayed || 0) + 1;

        // Goles anotados por este jugador local en este partido
        const matchGoals = homeGoalEvents.filter(e => this.isSamePlayer(e.player, pName)).length;
        stats[pName].goals = (stats[pName].goals || 0) + matchGoals;

        // Atajadas, tarjetas y faltas estrictamente de MI equipo (side === 'home')
        const savesCount = events.filter(e =>
          e.side === 'home' && e.type === 'save' && this.isSamePlayer(e.player, pName)
        ).length;

        const hasYellow = events.some(e =>
          e.side === 'home' && e.type === 'yellow-card' && this.isSamePlayer(e.player, pName)
        );
        const hasRed = events.some(e =>
          e.side === 'home' && e.type === 'red-card' && this.isSamePlayer(e.player, pName)
        );

        // Cálculo dinámico de la nota del partido (sistema 4.0 - 10.0)
        let matchRating = isStarter ? 6.5 : 6.0;

        if (homeScore > awayScore) matchRating += 0.5;
        else if (homeScore < awayScore) matchRating -= 0.4;

        const role = (p.role || 'MC').toUpperCase();
        if (role === 'DEL') {
          matchRating += matchGoals * 1.3;
        } else if (role === 'MC') {
          matchRating += matchGoals * 1.5;
          const dangerActions = events.filter(e =>
            e.side === 'home' && (e.type === 'freekick' || e.type === 'corner') && this.isSamePlayer(e.player, pName)
          ).length;
          matchRating += Math.min(0.6, dangerActions * 0.3);
        } else if (role === 'DEF') {
          matchRating += matchGoals * 1.8;
          if (awayScore === 0) matchRating += 1.2;
          else if (awayScore >= 2) matchRating -= 0.3 * (awayScore - 1);
        } else if (role === 'POR') {
          matchRating += Math.min(1.8, savesCount * 0.5);
          if (awayScore === 0) {
            matchRating += 1.5;
            stats[pName].cleanSheets = (stats[pName].cleanSheets || 0) + 1;
          } else if (awayScore === 1) {
            matchRating -= 0.5;
          } else if (awayScore >= 2) {
            matchRating -= 0.5 + 0.4 * (awayScore - 1);
          }
        }

        if (hasYellow) matchRating -= 0.6;
        if (hasRed) matchRating -= 2.0;

        const baseRating = p.rating_general || 85;
        matchRating += Math.max(0, (baseRating - 75) * 0.02);
        matchRating = Math.min(10.0, Math.max(4.0, Math.round(matchRating * 10) / 10));

        // Acumular nota y calcular promedio real garantizando consistencia histórica
        const priorMatches = Math.max(0, (stats[pName].matchesPlayed || 1) - 1);
        let currentTotal = stats[pName].totalRating;
        if (!currentTotal || currentTotal < priorMatches * 3.5) {
          const priorAvg = (stats[pName].avgRating && stats[pName].avgRating >= 4.0 && stats[pName].avgRating <= 10.0)
            ? stats[pName].avgRating
            : Math.min(9.5, Math.max(5.5, 6.4 + ((stats[pName].goals || 0) / Math.max(1, priorMatches)) * 2.0));
          currentTotal = Math.round(priorAvg * priorMatches * 10) / 10;
        }

        stats[pName].totalRating = Math.round((currentTotal + matchRating) * 10) / 10;
        stats[pName].matchRatings = [...(stats[pName].matchRatings || []), matchRating];
        stats[pName].avgRating = Math.round((stats[pName].totalRating / stats[pName].matchesPlayed) * 10) / 10;
        stats[pName].lastMatchRating = matchRating;

        // Candidato local a MVP
        if (matchRating > highestRating) {
          highestRating = matchRating;
          matchMvp = {
            name: pName,
            role,
            matchRating,
            matchGoals,
            savesCount,
            cleanSheet: awayScore === 0,
            goalsConceded: awayScore,
            isRival: false,
            teamName: matchData.homeTeam?.name || 'Tu Equipo'
          };
        } else if (matchRating === highestRating && matchGoals > (matchMvp?.matchGoals || 0)) {
          highestRating = matchRating;
          matchMvp = {
            name: pName,
            role,
            matchRating,
            matchGoals,
            savesCount,
            cleanSheet: awayScore === 0,
            goalsConceded: awayScore,
            isRival: false,
            teamName: matchData.homeTeam?.name || 'Tu Equipo'
          };
        }
      });

      // Evaluación del Jugador Destacado Rival (Candidato rival a MVP)
      const awayGoalEvents = events.filter(e =>
        e.side === 'away' && (e.type === 'goal' || e.type === 'penalty-goal')
      );
      const awayStarters = matchData.lineups?.away || matchData.lineups?.awayStarters || [];
      const awayTeamName = matchData.awayTeam?.name || 'Equipo Rival';

      let rivalMvp = null;
      if (awayGoalEvents.length > 0) {
        // Contabilizar goles del rival por jugador
        const awayScorerCounts = {};
        awayGoalEvents.forEach(e => {
          const sName = e.player || 'Delantero Rival';
          awayScorerCounts[sName] = (awayScorerCounts[sName] || 0) + 1;
        });

        let topRivalScorer = null;
        let maxGoals = 0;
        Object.entries(awayScorerCounts).forEach(([name, count]) => {
          if (count > maxGoals) {
            maxGoals = count;
            topRivalScorer = name;
          }
        });

        const foundRival = awayStarters.find(p => this.isSamePlayer(p.name, topRivalScorer));
        const rivalRole = foundRival?.role || 'DEL';

        let rivalRating = 8.5;
        if (maxGoals >= 3) rivalRating = 9.9;
        else if (maxGoals === 2) rivalRating = 9.3;
        else if (maxGoals === 1) rivalRating = awayScore > homeScore ? 8.8 : 8.1;

        rivalMvp = {
          name: topRivalScorer,
          role: rivalRole,
          matchRating: rivalRating,
          matchGoals: maxGoals,
          savesCount: 0,
          cleanSheet: homeScore === 0,
          goalsConceded: homeScore,
          isRival: true,
          teamName: awayTeamName
        };
      } else {
        // El rival no anotó goles: arquero o líder de la zaga
        const awaySaves = events.filter(e => e.side === 'away' && e.type === 'save').length;
        const awayGk = awayStarters.find(p => p.role === 'POR') || { name: 'Arquero Rival', role: 'POR' };
        const rivalRating = homeScore === 0 ? (8.4 + Math.min(1.2, awaySaves * 0.4)) : 7.0;

        rivalMvp = {
          name: awayGk.name,
          role: 'POR',
          matchRating: Math.round(rivalRating * 10) / 10,
          matchGoals: 0,
          savesCount: awaySaves,
          cleanSheet: homeScore === 0,
          goalsConceded: homeScore,
          isRival: true,
          teamName: awayTeamName
        };
      }

      // Decisión del MVP del partido:
      // Si el usuario pierde el partido (homeScore < awayScore), la figura del rival es el MVP oficial
      if (homeScore < awayScore) {
        matchMvp = rivalMvp || matchMvp;
      } else if (homeScore === awayScore) {
        // En empate, compiten en valoración
        if ((rivalMvp?.matchRating || 0) > (matchMvp?.matchRating || 0)) {
          matchMvp = rivalMvp;
        }
      }
      // En victoria (homeScore > awayScore), matchMvp se mantiene con el mejor local

      // Otorgar galardón MVP al jugador destacado ÚNICAMENTE si pertenece al equipo del usuario
      if (matchMvp && !matchMvp.isRival && stats[matchMvp.name]) {
        stats[matchMvp.name].mvpAwards = (stats[matchMvp.name].mvpAwards || 0) + 1;
      }

      localStorage.setItem(STORAGE_KEYS.PLAYER_STATS, JSON.stringify(stats));
      window.dispatchEvent(new CustomEvent('fantasy:player-stats-updated', { detail: stats }));
      return { stats, matchMvp };
    } catch (err) {
      console.warn('[MatchService] Error al registrar estadísticas de jugadores:', err);
      return { stats: {}, matchMvp: null };
    }
  },

  getPlayerStats(playerName) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_STATS);
      const stats = raw ? JSON.parse(raw) : {};
      const foundKey = Object.keys(stats).find(k => this.isSamePlayer(k, playerName));
      return (foundKey ? stats[foundKey] : stats[playerName]) || {
        name: playerName,
        matchesPlayed: 0,
        goals: 0,
        cleanSheets: 0,
        mvpAwards: 0,
        avgRating: null,
        matchRatings: []
      };
    } catch (e) {
      return { matchesPlayed: 0, goals: 0, avgRating: null, matchRatings: [] };
    }
  },

  getAllPlayerStats() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PLAYER_STATS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
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
      points: 0,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      ranking: 1,
      streak: []
    };
  },

  /**
   * Resetea las estadísticas acumuladas de los jugadores y el registro de partidos procesados.
   */
  resetPlayerStats() {
    try {
      localStorage.removeItem(STORAGE_KEYS.PLAYER_STATS);
      localStorage.removeItem('fantasy_processed_match_ids');
      window.dispatchEvent(new CustomEvent('fantasy:player-stats-updated', { detail: {} }));
      console.info('[MatchService] Estadísticas de jugadores y registro de partidos procesados reseteados exitosamente.');
    } catch (e) {}
  }
};

if (typeof window !== 'undefined') {
  window.matchService = matchService;
}


export {
  calcularCambioEnergia,
  calcularDesgaste,
  calcularRecuperacion,
  actualizarEnergiaPlantel,
  aplicarPenalizacionFatiga,
  MODIFICADORES_POSICION,
  STAMINA_CONFIG
};
