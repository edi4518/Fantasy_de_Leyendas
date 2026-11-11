/**
 * @file ranking.js
 * @description Controlador de la pantalla de Ranking Global.
 * Mapea 100% los competidores y posiciones desde la base de datos real en TiDB Cloud,
 * renderizando podio dinámico, nombres de mánager con subtítulo de club en gris claro,
 * avatar del mánager y competidores sincronizados, y tendencias de flechas precisas:
 * ↑ (verde) si sube de ranking, ↓ (roja) si baja, = si se mantiene, - si no ha jugado.
 * Los usuarios nuevos inician con 1000 pts y nunca pueden tener menos de 0 pts.
 */

import { API_BASE_URL } from '../../services/api-client.js';
import { getUnifiedLeaderboard, getUserRankInfo } from '../../services/ranking-service.js';

const PODIUM_AVATAR_FALLBACK_SVG = `
  <svg class="avatar-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
      stroke-linejoin="round" stroke-width="2"></path>
  </svg>
`;

const SM_AVATAR_FALLBACK_SVG = `
  <svg class="avatar-icon-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" stroke-linecap="round"
      stroke-linejoin="round" stroke-width="2"></path>
  </svg>
`;

/**
 * Normaliza URLs relativas de avatares para que apunten al host del backend o se sirvan directamente
 */
function normalizeManagerAvatarOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/')) {
    const apiOrigin = (API_BASE_URL || '').replace(/\/api\/?$/, '');
    return `${apiOrigin}${trimmed}`;
  }
  return trimmed;
}

/**
 * Resuelve la URL del avatar del mánager conectado desde localStorage / perfil
 */
function resolveUserAvatarUrl() {
  let localAvatar = null;
  let localUser = null;
  try {
    localAvatar = localStorage.getItem('user_avatar') || null;
    const rawUser = localStorage.getItem('user') || localStorage.getItem('fantasy_logged_user') || localStorage.getItem('fantasy_user');
    if (rawUser) localUser = JSON.parse(rawUser);
  } catch (_) {}

  const localUserAvatar =
    localUser?.photo_url ||
    localUser?.avatar_url ||
    localUser?.avatarUrl ||
    localUser?.avatar ||
    localUser?.profile_picture ||
    null;

  if (localAvatar && localAvatar.startsWith('data:image/')) {
    return localAvatar;
  }

  return (
    normalizeManagerAvatarOrigin(localAvatar) ||
    normalizeManagerAvatarOrigin(localUserAvatar) ||
    null
  );
}

/**
 * Resuelve la URL de avatar para una entrada del ranking (podio o lista).
 * Si la entrada corresponde al usuario conectado, sincroniza con su avatar local en tiempo real.
 */
function resolveEntryAvatarUrl(entry, savedUser) {
  if (!entry) return null;

  const isCurrentUser = Boolean(
    (savedUser?.id && entry.userId && Number(entry.userId) === Number(savedUser.id)) ||
    (savedUser?.email && entry.email && entry.email.toLowerCase() === savedUser.email.toLowerCase()) ||
    (entry.is_current_user)
  );

  if (isCurrentUser) {
    const myAvatar = resolveUserAvatarUrl();
    if (myAvatar) return myAvatar;
  }

  const rawUrl = entry.photo_url || entry.avatar_url || entry.avatarUrl || entry.avatar || null;
  return normalizeManagerAvatarOrigin(rawUrl);
}

/**
 * Asigna la imagen o el SVG fallback a un contenedor de avatar en el podio
 */
function setPodiumAvatar(stepNum, entry, savedUser) {
  const avatarEl = document.getElementById(`podium-avatar-${stepNum}`);
  if (!avatarEl) return;

  const avatarUrl = resolveEntryAvatarUrl(entry, savedUser);
  if (avatarUrl) {
    avatarEl.innerHTML = `<img src="${avatarUrl}" alt="${entry?.manager_name || 'Mánager'}" class="podium-avatar-img" referrerpolicy="no-referrer" onerror="this.outerHTML=\`${PODIUM_AVATAR_FALLBACK_SVG.replace(/"/g, '&quot;')}\`">`;
  } else {
    avatarEl.innerHTML = PODIUM_AVATAR_FALLBACK_SVG;
  }
}

/**
 * Calcula el símbolo y clase CSS de la tendencia según la posición en el ranking:
 * - Si no ha jugado: '-' neutro
 * - Si subió en el ranking: '↑' verde
 * - Si bajó en el ranking: '↓' roja
 * - Si se mantiene en el mismo puesto (gana, empata o pierde): '='
 */
function getTrendDetails(entry) {
  const matches = Number(entry?.partidos_jugados ?? entry?.matches ?? 0);
  const hasPlayed = Boolean(entry?.has_played || matches > 0);

  if (!hasPlayed || entry?.rank === null || entry?.rank === undefined) {
    return { symbol: '-', class: 'trend-neutral' };
  }

  const trend = entry?.trend || 'same';

  if (trend === 'up') {
    return { symbol: '↑', class: 'trend-up' };
  }
  if (trend === 'down') {
    return { symbol: '↓', class: 'trend-down' };
  }
  return { symbol: '=', class: 'trend-same' };
}

/**
 * Función principal inicializadora de la pantalla
 */
export async function initRanking() {
  const container = document.querySelector('.ranking-screen');
  if (!container) return;

  // Obtener usuario guardado en localStorage
  let savedUser = null;
  try {
    const rawUser = localStorage.getItem('user') || localStorage.getItem('fantasy_logged_user') || localStorage.getItem('fantasy_user') || '{}';
    savedUser = JSON.parse(rawUser || '{}');
  } catch (_) {
    savedUser = {};
  }

  // 1. Obtener la tabla real desde la base de datos con posiciones y tendencias exactas
  const combinedEntries = await getUnifiedLeaderboard();

  // 2. Renderizar Podio Top 3 dinámico (1ro, 2do y 3ro) con avatares
  renderPodium(combinedEntries.slice(0, 3), savedUser);

  // 3. Renderizar listado de clasificados (puestos 4 en adelante) con avatares y tendencias
  renderRankingList(container, combinedEntries.slice(3), savedUser);

  // 4. Renderizar tarjeta fija del mánager conectado con su avatar y posición real
  renderCurrentUserCard(container, combinedEntries);
}

/**
 * Renderiza dinámicamente los 3 escalones del podio con los mánagers reales y sus avatares
 */
function renderPodium(top3, savedUser = {}) {
  // Puesto 1 (Oro - Centro)
  const first = top3[0] || null;
  const name1 = document.getElementById('podium-name-1');
  const team1 = document.getElementById('podium-team-1');
  const points1 = document.getElementById('podium-points-1');
  if (name1) name1.textContent = first ? first.manager_name : '-';
  if (team1) team1.textContent = first ? first.team_name : 'Sin club';
  if (points1) {
    const pts = Math.max(0, Number(first?.points ?? 0));
    points1.textContent = first ? `${pts.toLocaleString('es-AR')} pts` : '- pts';
  }
  setPodiumAvatar(1, first, savedUser);

  // Puesto 2 (Plata - Izquierda)
  const second = top3[1] || null;
  const name2 = document.getElementById('podium-name-2');
  const team2 = document.getElementById('podium-team-2');
  const points2 = document.getElementById('podium-points-2');
  if (name2) name2.textContent = second ? second.manager_name : '-';
  if (team2) team2.textContent = second ? second.team_name : 'Sin club';
  if (points2) {
    const pts = Math.max(0, Number(second?.points ?? 0));
    points2.textContent = second ? `${pts.toLocaleString('es-AR')} pts` : '- pts';
  }
  setPodiumAvatar(2, second, savedUser);

  // Puesto 3 (Bronce - Derecha)
  const third = top3[2] || null;
  const name3 = document.getElementById('podium-name-3');
  const team3 = document.getElementById('podium-team-3');
  const points3 = document.getElementById('podium-points-3');
  if (name3) name3.textContent = third ? third.manager_name : '-';
  if (team3) team3.textContent = third ? third.team_name : 'Sin club';
  if (points3) {
    const pts = Math.max(0, Number(third?.points ?? 0));
    points3.textContent = third ? `${pts.toLocaleString('es-AR')} pts` : '- pts';
  }
  setPodiumAvatar(3, third, savedUser);
}

/**
 * Renderiza los puestos del 4 en adelante en tarjetas compactas con sus avatares y tendencias
 */
function renderRankingList(container, listEntries, savedUser = {}) {
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
    const rankDisplay = item.rank ? item.rank : '-';
    const safePoints = Math.max(0, Number(item.points ?? 0));
    const itemAvatarUrl = resolveEntryAvatarUrl(item, savedUser);
    const itemAvatarHtml = itemAvatarUrl
      ? `<img src="${itemAvatarUrl}" alt="${item.manager_name || 'Mánager'}" class="item-avatar-img" referrerpolicy="no-referrer" onerror="this.outerHTML=\`${SM_AVATAR_FALLBACK_SVG.replace(/"/g, '&quot;')}\`">`
      : SM_AVATAR_FALLBACK_SVG;

    return `
      <li class="ranking-item">
        <span class="item-rank">${rankDisplay}</span>
        <div class="item-avatar">
          ${itemAvatarHtml}
        </div>
        <div class="item-info">
          <span class="item-manager-name">${item.manager_name}</span>
          <span class="item-team-name">${item.team_name || 'Sin club'}</span>
        </div>
        <div class="item-stats">
          <span class="item-points">${safePoints.toLocaleString('es-AR')} pts</span>
          <span class="item-trend ${trend.class}">${trend.symbol}</span>
        </div>
      </li>
    `;
  }).join('');
}

/**
 * Renderiza la tarjeta fija del mánager conectado con su posición real sincronizada, avatar y tendencia
 */
function renderCurrentUserCard(container, combinedEntries) {
  const rawUser = localStorage.getItem('user') || localStorage.getItem('fantasy_logged_user') || localStorage.getItem('fantasy_user') || '{}';
  let savedUser = {};
  try {
    savedUser = JSON.parse(rawUser || '{}');
  } catch (_) {
    savedUser = {};
  }

  let squadName = null;
  try {
    const rawSq = localStorage.getItem('fantasy_active_squad');
    if (rawSq) squadName = JSON.parse(rawSq)?.name;
  } catch (_) {}
  const teamName = localStorage.getItem('team_name') || savedUser.team_name || squadName || 'Tu Equipo';
  const managerDisplayName = savedUser.name || (savedUser.first_name ? `${savedUser.first_name} ${savedUser.last_name || ''}`.trim() : null) || savedUser.username || 'Mi Equipo';

  let rawStats = null;
  try {
    const raw = localStorage.getItem('fantasy_user_stats');
    if (raw) rawStats = JSON.parse(raw);
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
  const userPoints = Math.max(0, Number(rankInfo.points ?? savedUser.elo_rating ?? 1000));

  const userTrend = getTrendDetails(myEntry || { has_played: hasPlayed, rank: rankInfo.rank, trend: rankInfo.trend });

  const userAvatarUrl = resolveUserAvatarUrl();
  const userAvatarHtml = userAvatarUrl
    ? `<img src="${userAvatarUrl}" alt="${managerDisplayName}" class="user-avatar-badge-img" referrerpolicy="no-referrer" onerror="this.outerHTML=\`${SM_AVATAR_FALLBACK_SVG.replace(/"/g, '&quot;')}\`">`
    : SM_AVATAR_FALLBACK_SVG;

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
    <div class="user-avatar-badge" id="user-avatar-badge">
      ${userAvatarHtml}
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

// Escuchar cambios de perfil / avatar y partidos jugados en tiempo real
if (typeof window !== 'undefined' && !window._fantasyRankingListenersAttached) {
  window._fantasyRankingListenersAttached = true;
  window.addEventListener('storage', (e) => {
    if (
      e.key === 'user_avatar' ||
      e.key === 'user' ||
      e.key === 'team_name' ||
      e.key === 'fantasy_user_stats' ||
      e.key === 'fantasy_rank_movement' ||
      e.key === 'fantasy_current_rank'
    ) {
      initRanking();
    }
  });
  window.addEventListener('fantasy:profile-updated', () => {
    initRanking();
  });
  window.addEventListener('fantasy:match-finished', () => {
    initRanking();
  });
}
