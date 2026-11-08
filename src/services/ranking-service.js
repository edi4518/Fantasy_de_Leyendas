/**
 * @file ranking-service.js
 * @description Servicio centralizado para la clasificación de la liga en Fantasy de Leyendas.
 * Consulta directamente a los mánagers reales desde la base de datos MySQL / TiDB Cloud,
 * asegurando consistencia matemática exacta entre Dashboard y la vista de Ranking sin datos hardcodeados.
 */

import { apiClient } from './api-client.js';

/**
 * Obtiene la tabla unificada de clasificación de la liga basada 100% en los mánagers reales
 * registrados en la base de datos (con cálculo dinámico de tendencia y posición).
 */
export async function getUnifiedLeaderboard() {
  let dbLeaderboard = [];
  try {
    const res = await apiClient.get('/ranking/leaderboard').catch(() => null);
    if (res && Array.isArray(res.leaderboard)) {
      dbLeaderboard = res.leaderboard;
    }
  } catch (e) {
    console.debug('[RankingService] Error al obtener leaderboard remoto:', e);
  }

  const savedUser = JSON.parse(
    localStorage.getItem('user') ||
    localStorage.getItem('fantasy_logged_user') ||
    localStorage.getItem('fantasy_user') ||
    'null'
  );

  const combined = dbLeaderboard.map(u => {
    const matches = Number(u.partidos_jugados || 0);
    const points = Number(u.elo_rating ?? 1000);
    const hasPlayed = Boolean(u.has_played || matches > 0);

    let trend = 'neutral';
    if (hasPlayed) {
      if (points > 1000) trend = 'up';
      else if (points < 1000) trend = 'down';
      else if ((u.victorias || 0) > (u.derrotas || 0)) trend = 'up';
      else if ((u.derrotas || 0) > (u.victorias || 0)) trend = 'down';
    }

    return {
      name: u.manager_name || 'Mánager',
      manager_name: u.manager_name || 'Mánager',
      team_name: u.team_name || 'Sin club',
      points: points,
      elo_rating: points,
      trend: trend,
      isDbUser: true,
      userId: u.user_id,
      email: u.email,
      partidos_jugados: matches,
      has_played: hasPlayed,
      goles_favor: u.goles_favor || 0,
      goles_contra: u.goles_contra || 0,
      diferencia_gol: u.diferencia_gol || 0,
      victorias: u.victorias || 0,
      derrotas: u.derrotas || 0,
      empates: u.empates || 0,
      photo_url: u.photo_url || null
    };
  });

  // Si el usuario autenticado aún no figura en dbLeaderboard, incluirlo dinámicamente
  if (savedUser && savedUser.id) {
    const alreadyIncluded = combined.some(u => 
      Number(u.userId) === Number(savedUser.id) ||
      (savedUser.email && u.email && u.email.toLowerCase() === savedUser.email.toLowerCase())
    );
    if (!alreadyIncluded) {
      let rawStats = null;
      try {
        const raw = localStorage.getItem('fantasy_user_stats');
        if (raw) rawStats = JSON.parse(raw);
      } catch (_) {}
      const matches = Number(rawStats?.matchesPlayed || savedUser.partidos_jugados || 0);
      const points = Number(savedUser.elo_rating ?? 1000);
      const hasPlayed = matches > 0;
      let trend = 'neutral';
      if (hasPlayed) {
        if (points > 1000) trend = 'up';
        else if (points < 1000) trend = 'down';
      }
      let squadName = null;
      try {
        const sq = localStorage.getItem('fantasy_active_squad');
        if (sq) squadName = JSON.parse(sq)?.name;
      } catch (_) {}
      const effectiveTeamName = localStorage.getItem('team_name') || savedUser.team_name || squadName || 'Tu Equipo';

      combined.push({
        name: savedUser.name || (savedUser.first_name ? `${savedUser.first_name} ${savedUser.last_name || ''}`.trim() : null) || savedUser.username || 'Mi Equipo',
        manager_name: savedUser.name || (savedUser.first_name ? `${savedUser.first_name} ${savedUser.last_name || ''}`.trim() : null) || savedUser.username || 'Mi Equipo',
        team_name: effectiveTeamName,
        points: points,
        elo_rating: points,
        trend: trend,
        isDbUser: true,
        userId: savedUser.id,
        email: savedUser.email,
        partidos_jugados: matches,
        has_played: hasPlayed,
        goles_favor: 0,
        goles_contra: 0,
        diferencia_gol: 0,
        victorias: 0,
        derrotas: 0,
        empates: 0,
        photo_url: savedUser.photo_url || null
      });
    }
  }

  // Ordenar:
  // 1. Mánagers con partidos disputados (has_played === true) ordenados por puntos ELO desc
  // 2. Desempate por diferencia de gol y victorias
  // 3. Mánagers sin partidos disputados (has_played === false) al final
  combined.sort((a, b) => {
    if (a.has_played && !b.has_played) return -1;
    if (!a.has_played && b.has_played) return 1;
    if (b.points !== a.points) return b.points - a.points;
    if ((b.diferencia_gol || 0) !== (a.diferencia_gol || 0)) return (b.diferencia_gol || 0) - (a.diferencia_gol || 0);
    return (b.victorias || 0) - (a.victorias || 0);
  });

  // Asignar posición de clasificación a competidores que han jugado
  let rankCounter = 1;
  combined.forEach((entry) => {
    if (entry.has_played) {
      entry.rank = rankCounter++;
    } else {
      entry.rank = null;
    }
  });

  return combined;
}

/**
 * Resuelve la posición de clasificación del mánager conectado.
 * Si el mánager NO ha jugado partidos (hasPlayed === false),
 * retorna '-' para evitar asignarle una posición numérica ilógica antes de debutar.
 */
export function getUserRankInfo(leaderboard, savedUser, teamName, hasPlayed) {
  if (!hasPlayed) {
    return {
      rank: null,
      displayRank: '-',
      points: Number(savedUser?.elo_rating ?? 1000),
      hasPlayed: false
    };
  }

  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    return {
      rank: null,
      displayRank: '-',
      points: Number(savedUser?.elo_rating ?? 1000),
      hasPlayed: false
    };
  }

  const found = leaderboard.find(e =>
    (savedUser?.id && e.userId && Number(e.userId) === Number(savedUser.id)) ||
    (savedUser?.email && e.email && e.email.toLowerCase() === savedUser.email.toLowerCase()) ||
    (teamName && e.team_name && e.team_name.toLowerCase() === teamName.toLowerCase())
  );

  if (found && found.rank) {
    return {
      rank: found.rank,
      displayRank: `#${found.rank}`,
      points: found.points,
      hasPlayed: Boolean(found.has_played)
    };
  }

  const playedCount = leaderboard.filter(e => e.has_played).length;
  const computedRank = playedCount > 0 ? playedCount : 1;
  return {
    rank: computedRank,
    displayRank: `#${computedRank}`,
    points: Number(savedUser?.elo_rating ?? 1000),
    hasPlayed: true
  };
}
