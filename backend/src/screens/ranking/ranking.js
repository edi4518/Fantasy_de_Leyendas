/**
 * @file ranking.js
 * @description Controlador de la pantalla de Ranking Global.
 * Mapea 100% los competidores y posiciones desde la base de datos real en TiDB Cloud,
 * renderizando podio dinámico, nombres de mánager con subtítulo de club en gris claro,
 * y tendencias de flechas precisas (↑ verde / ↓ roja) según resultados y ELO.
 */

import { getUnifiedLeaderboard, getUserRankInfo } from '../../services/ranking-service.js';

/**
 * Calcula el símbolo y clase CSS de la tendencia (↑ verde, ↓ roja, - neutra)
 * según el historial de partidos y los puntos ELO.
 */
function getTrendDetails(entry, lastMatchResult = null) {
  const points = Number(entry?.points ?? entry?.elo_rating ?? 1000);
  const matches = Number(entry?.partidos_jugados ?? entry?.matches ?? 0);
  const hasPlayed = Boolean(entry?.has_played || matches > 0);

  if (!hasPlayed) {
    return { symbol: '-', class: 'trend-neutral' };
  }

  if (lastMatchResult === 'V' || lastMatchResult === 'VICTORIA') {
    return { symbol: '↑', class: 'trend-up' };
  }
  if (lastMatchResult === 'D' || lastMatchResult === 'DERROTA') {
    return { symbol: '↓', class: 'trend-down' };
  }

  if (points > 1000) {
    return { symbol: '↑', class: 'trend-up' };
  } else if (points < 1000) {
    return { symbol: '↓', class: 'trend-down' };
  } else {
    const wins = Number(entry?.victorias || 0);
    const losses = Number(entry?.derrotas || 0);
    if (wins > losses) return { symbol: '↑', class: 'trend-up' };
    if (losses > wins) return { symbol: '↓', class: 'trend-down' };
    return { symbol: '-', class: 'trend-neutral' };
  }
}

/**
 * Función principal inicializadora de la pantalla
 */
export async function initRanking() {
  const container = document.querySelector('.ranking-screen');
  if (!container) return;

  // 1. Obtener la tabla real desde la base de datos
  const combinedEntries = await getUnifiedLeaderboard();

  // 2. Renderizar Podio Top 3 dinámico (1ro, 2do y 3ro)
  renderPodium(combinedEntries.slice(0, 3));

  // 3. Renderizar listado de clasificados (puestos 4 en adelante)
  renderRankingList(container, combinedEntries.slice(3));

  // 4. Renderizar tarjeta fija del mánager conectado
  renderCurrentUserCard(container, combinedEntries);
}

/**
 * Renderiza dinámicamente los 3 escalones del podio con los mánagers reales
 */
function renderPodium(top3) {
  // Puesto 1 (Oro - Centro)
  const first = top3[0] || null;
  const name1 = document.getElementById('podium-name-1');
  const team1 = document.getElementById('podium-team-1');
  const points1 = document.getElementById('podium-points-1');
  if (name1) name1.textContent = first ? first.manager_name : '-';
  if (team1) team1.textContent = first ? first.team_name : 'Sin club';
  if (points1) points1.textContent = first ? `${first.points.toLocaleString('es-AR')} pts` : '- pts';

  // Puesto 2 (Plata - Izquierda)
  const second = top3[1] || null;
  const name2 = document.getElementById('podium-name-2');
  const team2 = document.getElementById('podium-team-2');
  const points2 = document.getElementById('podium-points-2');
  if (name2) name2.textContent = second ? second.manager_name : '-';
  if (team2) team2.textContent = second ? second.team_name : 'Sin club';
  if (points2) points2.textContent = second ? `${second.points.toLocaleString('es-AR')} pts` : '- pts';

  // Puesto 3 (Bronce - Derecha)
  const third = top3[2] || null;
  const name3 = document.getElementById('podium-name-3');
  const team3 = document.getElementById('podium-team-3');
  const points3 = document.getElementById('podium-points-3');
  if (name3) name3.textContent = third ? third.manager_name : '-';
  if (team3) team3.textContent = third ? third.team_name : 'Sin club';
  if (points3) points3.textContent = third ? `${third.points.toLocaleString('es-AR')} pts` : '- pts';
}

/**
 * Renderiza los puestos del 4 en adelante en tarjetas compactas
 */
function renderRankingList(container, listEntries) {
  let listEl = document.getElementById('ranking-list');
  if (!listEl) {
    listEl = document.createElement('ul');
    listEl.className = 'ranking-list';
    listEl.id = 'ranking-list';
    const podiumEl = container.querySelector('.podium-container');
    if (podiumEl && podiumEl.nextSibling) {
      container.insertBefore(listEl, podiumEl.nextSibling);
    } else {
      container.appendChild(listEl);
    }
  }

  if (!listEntries || listEntries.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = listEntries.map(item => {
    const trend = getTrendDetails(item);
    const rankDisplay = item.has_played && item.rank ? item.rank : '-';

    return `
      <li class="ranking-item">
        <span class="item-rank">${rankDisplay}</span>
        <div class="item-avatar">
          <svg class="avatar-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
              stroke-linejoin="round" stroke-width="2"></path>
          </svg>
        </div>
        <div class="item-info">
          <span class="item-manager-name">${item.manager_name}</span>
          <span class="item-team-name">${item.team_name || 'Sin club'}</span>
        </div>
        <div class="item-stats">
          <span class="item-points">${item.points.toLocaleString('es-AR')} pts</span>
          <span class="item-trend ${trend.class}">${trend.symbol}</span>
        </div>
      </li>
    `;
  }).join('');
}

/**
 * Renderiza la tarjeta fija del mánager conectado con su posición real sincronizada y flecha dinámica
 */
function renderCurrentUserCard(container, combinedEntries) {
  const savedUser = JSON.parse(localStorage.getItem('user') || '{}');
  const teamName = localStorage.getItem('team_name') || savedUser.team_name || 'Tu Equipo';
  const managerDisplayName = savedUser.name || (savedUser.first_name ? `${savedUser.first_name} ${savedUser.last_name || ''}`.trim() : null) || savedUser.username || 'Mi Equipo';

  let rawStats = null;
  let lastMatchLetter = null;
  try {
    const raw = localStorage.getItem('fantasy_user_stats');
    if (raw) rawStats = JSON.parse(raw);
    const rawH = localStorage.getItem('fantasy_match_history');
    if (rawH) {
      const historyArr = JSON.parse(rawH);
      if (Array.isArray(historyArr) && historyArr.length > 0) {
        const res = historyArr[0].resultado;
        lastMatchLetter = res === 'VICTORIA' ? 'V' : (res === 'DERROTA' ? 'D' : 'E');
      }
    }
  } catch (_) {}

  const myEntry = combinedEntries.find(e =>
    (savedUser?.id && e.userId && Number(e.userId) === Number(savedUser.id)) ||
    (savedUser?.email && e.email && e.email.toLowerCase() === savedUser.email.toLowerCase()) ||
    (teamName && e.team_name && e.team_name.toLowerCase() === teamName.toLowerCase())
  );

  const hasPlayed = Boolean(
    (myEntry && myEntry.has_played) ||
    (rawStats && rawStats.matchesPlayed > 0) ||
    (savedUser && savedUser.partidos_jugados > 0)
  );

  const rankInfo = getUserRankInfo(combinedEntries, savedUser, teamName, hasPlayed);
  const userRankText = rankInfo.displayRank;
  const userPoints = Number(rankInfo.points ?? savedUser.elo_rating ?? 1000);

  const userTrend = getTrendDetails(myEntry || { points: userPoints, has_played: hasPlayed }, lastMatchLetter);

  let userDock = container.querySelector('.ranking-current-user-dock');
  let userCard = container.querySelector('.ranking-current-user');
  if (!userCard) {
    userCard = document.createElement('div');
    userCard.className = 'ranking-current-user';
    userCard.id = 'ranking-current-user';
    if (userDock) {
      userDock.appendChild(userCard);
    } else {
      container.appendChild(userCard);
    }
  }

  userCard.innerHTML = `
    <div class="user-position-box">
      <span class="user-position-label">POSICIÓN</span>
      <span class="user-rank" id="user-rank-val">${userRankText}</span>
    </div>
    <div class="user-avatar-badge">
      <svg class="avatar-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
          stroke-linejoin="round" stroke-width="2"></path>
      </svg>
    </div>
    <div class="user-team-info">
      <span class="user-team-title" id="user-display-name">${managerDisplayName}</span>
      <span class="user-team" id="user-team-name">${teamName}</span>
    </div>
    <div class="user-points-badge">
      <span class="user-points" id="user-points-val">${userPoints.toLocaleString('es-AR')} pts</span>
      <span class="user-points-trend ${userTrend.class}">${userTrend.symbol}</span>
    </div>
  `;
}
