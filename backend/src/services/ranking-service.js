/**
 * @file ranking-service.js
 * @description Servicio centralizado para la clasificación de la liga en Fantasy de Leyendas.
 * Consulta directamente a los mánagers reales desde la base de datos MySQL / TiDB Cloud,
 * asegurando consistencia matemática exacta entre Dashboard y la vista de Ranking sin datos hardcodeados.
 * Todo usuario nuevo comienza con 1000 pts base y es rankeado con los demás sin importar que haya disputado o no un partido.
 * Un jugador no puede tener menos de 0 pts.
 * Al finalizar un partido: si sube en el ranking aparece ↑ verde, si baja ↓ roja, si se mantiene =. Si no ha jugado aparece -.
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
    const points = Math.max(0, Number(u.elo_rating ?? 1000));
    const hasPlayed = Boolean(u.has_played || matches > 0);

    return {
      name: u.manager_name || 'Mánager',
      manager_name: u.manager_name || 'Mánager',
      team_name: u.team_name || 'Sin club',
      points: points,
      elo_rating: points,
      trend: hasPlayed ? 'same' : 'neutral',
      trend_symbol: hasPlayed ? '=' : '-',
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
      photo_url: u.photo_url || null,
      avatar_url: u.photo_url || u.avatar_url || null,
      avatarUrl: u.photo_url || u.avatarUrl || null
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
      const points = Math.max(0, Number(savedUser.elo_rating ?? 1000));
      const hasPlayed = matches > 0;
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
        trend: hasPlayed ? 'same' : 'neutral',
        trend_symbol: hasPlayed ? '=' : '-',
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
        photo_url: savedUser.photo_url || savedUser.avatar_url || savedUser.avatarUrl || null,
        avatar_url: savedUser.avatar_url || savedUser.avatarUrl || savedUser.photo_url || null,
        avatarUrl: savedUser.avatarUrl || savedUser.avatar_url || savedUser.photo_url || null
      });
    }
  }

  // Ordenar a TODOS los usuarios por puntos ELO de mayor a menor (sin importar si jugaron o no)
  // Desempate por diferencia de gol y victorias
  combined.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if ((b.diferencia_gol || 0) !== (a.diferencia_gol || 0)) return (b.diferencia_gol || 0) - (a.diferencia_gol || 0);
    return (b.victorias || 0) - (a.victorias || 0);
  });

  // Asignar posición en el ranking a TODOS los participantes
  let rankCounter = 1;
  combined.forEach((entry) => {
    entry.rank = rankCounter++;
  });

  // Mapa histórico de posiciones guardadas para detectar subidas, bajadas o permanencias
  let previousRanksMap = {};
  try {
    const rawPrevMap = localStorage.getItem('fantasy_previous_ranks_map');
    if (rawPrevMap) previousRanksMap = JSON.parse(rawPrevMap);
  } catch (_) {
    previousRanksMap = {};
  }

  const currentUserId = savedUser?.id ? Number(savedUser.id) : null;
  const userRankMovement = localStorage.getItem('fantasy_rank_movement');
  const userPreviousRank = localStorage.getItem('fantasy_previous_rank');

  // Calcular flechas según movimiento de posición en el ranking
  combined.forEach((entry) => {
    if (!entry.has_played) {
      entry.trend = 'neutral';
      entry.trend_symbol = '-';
      return;
    }

    const isUser = Boolean(currentUserId && entry.userId && Number(entry.userId) === currentUserId);

    if (isUser && userRankMovement) {
      if (userRankMovement === 'up') {
        entry.trend = 'up';
        entry.trend_symbol = '↑';
        return;
      } else if (userRankMovement === 'down') {
        entry.trend = 'down';
        entry.trend_symbol = '↓';
        return;
      } else if (userRankMovement === 'same') {
        entry.trend = 'same';
        entry.trend_symbol = '=';
        return;
      }
    }

    const userKey = entry.userId ? `uid_${entry.userId}` : (entry.email || entry.manager_name);
    const prevRank = isUser && userPreviousRank ? Number(userPreviousRank) : previousRanksMap[userKey];

    if (prevRank !== undefined && prevRank !== null && Number.isInteger(Number(prevRank))) {
      const prevNum = Number(prevRank);
      if (entry.rank < prevNum) {
        // Mejor posición (ej. de 5 a 3) -> Subió en el ranking
        entry.trend = 'up';
        entry.trend_symbol = '↑';
      } else if (entry.rank > prevNum) {
        // Peor posición (ej. de 2 a 4) -> Bajó en el ranking
        entry.trend = 'down';
        entry.trend_symbol = '↓';
      } else {
        // Mismo puesto -> Se mantiene en el ranking
        entry.trend = 'same';
        entry.trend_symbol = '=';
      }
    } else {
      // Si finalizó un partido y no hay histórico previo, se mantiene
      entry.trend = 'same';
      entry.trend_symbol = '=';
    }
  });

  // Guardar snapshot de las posiciones actuales para futuras comparaciones
  try {
    const nextRanksMap = { ...previousRanksMap };
    combined.forEach((entry) => {
      if (entry.rank) {
        const userKey = entry.userId ? `uid_${entry.userId}` : (entry.email || entry.manager_name);
        if (nextRanksMap[userKey] === undefined) {
          nextRanksMap[userKey] = entry.rank;
        }
      }
    });
    localStorage.setItem('fantasy_previous_ranks_map', JSON.stringify(nextRanksMap));
  } catch (_) {}

  return combined;
}

/**
 * Resuelve la posición de clasificación del mánager conectado.
 * Todos los usuarios registrados tienen su posición numérica (#1, #2, etc.).
 */
export function getUserRankInfo(leaderboard, savedUser, teamName, hasPlayed) {
  const safePoints = Math.max(0, Number(savedUser?.elo_rating ?? 1000));

  if (!Array.isArray(leaderboard) || leaderboard.length === 0) {
    return {
      rank: 1,
      displayRank: '#1',
      points: safePoints,
      hasPlayed: Boolean(hasPlayed),
      trend: hasPlayed ? 'same' : 'neutral',
      trend_symbol: hasPlayed ? '=' : '-'
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
      points: Math.max(0, Number(found.points ?? safePoints)),
      hasPlayed: Boolean(found.has_played),
      trend: found.has_played ? (found.trend || 'same') : 'neutral',
      trend_symbol: found.has_played ? (found.trend_symbol || '=') : '-'
    };
  }

  const nextPos = leaderboard.length + 1;
  return {
    rank: nextPos,
    displayRank: `#${nextPos}`,
    points: safePoints,
    hasPlayed: Boolean(hasPlayed),
    trend: hasPlayed ? 'same' : 'neutral',
    trend_symbol: hasPlayed ? '=' : '-'
  };
}
