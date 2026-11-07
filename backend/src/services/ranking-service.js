/**
 * @file ranking-service.js
 * @description Servicio centralizado para la clasificación de la liga en Fantasy de Leyendas.
 * Unifica los benchmarks oficiales de la liga con los mánagers registrados en MySQL,
 * asegurando consistencia matemática exacta entre Dashboard y la vista de Ranking.
 */

import { apiClient } from './api-client.js';

export const LEAGUE_BENCHMARK_MANAGERS = [
  { name: 'David Villa', points: 1520, trend: 'equal', isDbUser: false, matches: 15, has_played: true },
  { name: 'Alex Mercer', points: 1480, trend: 'equal', isDbUser: false, matches: 14, has_played: true },
  { name: 'Carlos Sainz', points: 1395, trend: 'equal', isDbUser: false, matches: 15, has_played: true },
  { name: 'Lucas Moreno', points: 1250, trend: 'up', isDbUser: false, matches: 12, has_played: true },
  { name: 'Martín Silva', points: 1180, trend: 'down', isDbUser: false, matches: 13, has_played: true },
  { name: 'Alonso Ramos', points: 1105, trend: 'neutral', isDbUser: false, matches: 11, has_played: true },
  { name: 'Daniel Craig', points: 1040, trend: 'up', isDbUser: false, matches: 10, has_played: true },
];

/**
 * Obtiene la tabla unificada de clasificación de la liga combinando
 * los mánagers benchmark oficiales con los mánagers reales de MySQL.
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

  const combined = [
    ...LEAGUE_BENCHMARK_MANAGERS.map(m => ({
      name: m.name,
      manager_name: m.name,
      team_name: 'Leyendas Liga',
      points: m.points,
      elo_rating: m.points,
      trend: m.trend,
      isDbUser: false,
      partidos_jugados: m.matches,
      has_played: true,
      diferencia_gol: 0,
      victorias: 0
    })),
    ...dbLeaderboard.map(u => {
      const matches = Number(u.partidos_jugados || 0);
      return {
        name: `${u.manager_name} (${u.team_name})`,
        manager_name: u.manager_name,
        team_name: u.team_name,
        points: Number(u.elo_rating ?? 1000),
        elo_rating: Number(u.elo_rating ?? 1000),
        trend: 'up',
        isDbUser: true,
        userId: u.user_id,
        email: u.email,
        partidos_jugados: matches,
        has_played: matches > 0,
        goles_favor: u.goles_favor || 0,
        goles_contra: u.goles_contra || 0,
        diferencia_gol: u.diferencia_gol || 0,
        victorias: u.victorias || 0
      };
    })
  ];

  // Ordenar:
  // 1. Mánagers con partidos disputados (has_played === true) ordenados por puntos ELO desc
  // 2. Mánagers sin partidos disputados (has_played === false) al final
  combined.sort((a, b) => {
    if (a.has_played && !b.has_played) return -1;
    if (!a.has_played && b.has_played) return 1;
    if (b.points !== a.points) return b.points - a.points;
    if ((b.diferencia_gol || 0) !== (a.diferencia_gol || 0)) return (b.diferencia_gol || 0) - (a.diferencia_gol || 0);
    return (b.victorias || 0) - (a.victorias || 0);
  });

  // Asignar posición de clasificación a cada competidor
  combined.forEach((entry, idx) => {
    entry.rank = idx + 1;
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

  if (found) {
    return {
      rank: found.rank,
      displayRank: `#${found.rank}`,
      points: found.points,
      hasPlayed: Boolean(found.has_played)
    };
  }

  return {
    rank: leaderboard.length + 1,
    displayRank: `#${leaderboard.length + 1}`,
    points: Number(savedUser?.elo_rating ?? 1000),
    hasPlayed: true
  };
}
