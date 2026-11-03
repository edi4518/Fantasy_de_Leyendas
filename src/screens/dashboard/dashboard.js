import { getPlayerRating, getPlayerPrice, DEFAULT_HOME_SQUAD } from '../lineup/lineup.js';
import { getPlayerPhoto } from '../../services/player-service.js';
/**
 * @file dashboard.js
 * @description Módulo controlador para la vista principal (Dashboard / Inicio) de Fantasy de Leyendas.
 * Gestiona el renderizado dinámico de métricas, plantilla, MVP y la integración con el backend FastAPI.
 *
 * @exports { initDashboard, initHomeView, renderDashboard, renderHome, DEFAULT_HOME_DATA }
 */

/**
 * Datos por defecto alineados con el prototipo visual de la aplicación.
 * Sirven como estado inicial y fallback seguro en caso de desconexión o desarrollo offline.
 */
export const DEFAULT_HOME_DATA = {
  manager: {
    name: 'Nombre del Mánager',
    season: 'Temporada 24 / 25',
    ranking: 450,
    avatarUrl: null
  },
  budget: {
    spent: 86.5,
    available: 13.5,
    total: 100.0,
    percentage: 87
  },
  valGlobal: 94,
  formation: '1-2-2-1',
  startersCount: 6,
  reservesCount: 3,
  totalPlayers: 9,
  mvp: {
    name: 'Messi',
    tag: 'MVP',
    position: 'DEL',
    score: '-',
    matches: 0,
    goals: 0,
    maxScore: 10,
    avatarUrl: null
  },
  team: {
    count: 6,
    max: 6,
    players: [
      { id: 1, role: 'POR', name: 'Casillas', rating: 89, avatarUrl: null },
      { id: 2, role: 'DEF', name: 'Maldini', rating: 92, avatarUrl: null },
      { id: 3, role: 'DEF', name: 'Baresi', rating: 93, avatarUrl: null },
      { id: 4, role: 'MC', name: 'Zidane', rating: 96, avatarUrl: null },
      { id: 5, role: 'MC', name: 'Xavi', rating: 97, avatarUrl: null },
      { id: 6, role: 'DEL', name: 'Messi', rating: 99, avatarUrl: null }
    ]
  },
  streak: {
    lastMatch: {
      result: 'V',
      scoreText: 'V 2 - 1',
      opponent: 'vs MánagerX'
    },
    recentResults: ['V', 'V', 'D', 'E', 'V']
  }
};

/**
 * Puebla dinámicamente los elementos del DOM de la pantalla de inicio con los datos proporcionados.
 * @param {typeof DEFAULT_HOME_DATA} data - Objeto con los datos consolidados de la pantalla.
 */
export function renderHome(data = DEFAULT_HOME_DATA) {
  try {
    // 1. Datos del Mánager y Clasificación
    const managerNameEl = document.getElementById('manager-name');
    if (managerNameEl && data.manager?.name) {
      managerNameEl.textContent = data.manager.name;
    }

    const managerSeasonEl = document.getElementById('manager-season');
    if (managerSeasonEl && data.manager?.season) {
      managerSeasonEl.textContent = data.manager.season;
    }

    const rankingValueEl = document.getElementById('ranking-value');
    if (rankingValueEl && data.manager?.ranking !== undefined) {
      rankingValueEl.textContent = `#${data.manager.ranking}`;
    }

    const managerAvatarEl = document.getElementById('manager-avatar');
    if (managerAvatarEl && data.manager?.avatarUrl) {
      managerAvatarEl.innerHTML = `<img src="${data.manager.avatarUrl}" alt="${data.manager.name}" class="avatar-img">`;
    }

    // 2. Presupuesto y Barra de Progreso
    const budgetSpentEl = document.getElementById('budget-spent');
    if (budgetSpentEl && data.budget?.spent !== undefined) {
      budgetSpentEl.textContent = `${Number(data.budget.spent).toFixed(1)}M`;
    }

    const budgetAvailableEl = document.getElementById('budget-available');
    if (budgetAvailableEl && data.budget?.available !== undefined) {
      budgetAvailableEl.textContent = `${Number(data.budget.available).toFixed(1)}M`;
    }

    const budgetPercentEl = document.getElementById('budget-percentage');
    const budgetBarEl = document.getElementById('budget-progress-bar');
    const budgetContainerEl = document.getElementById('budget-progress-container');

    const percentage = data.budget?.percentage ?? Math.round((data.budget?.spent / (data.budget?.total || 100)) * 100);

    if (budgetPercentEl) {
      budgetPercentEl.textContent = `${percentage}%`;
    }
    if (budgetBarEl) {
      budgetBarEl.style.width = `${Math.min(Math.max(percentage, 0), 100)}%`;
    }
    if (budgetContainerEl) {
      budgetContainerEl.setAttribute('aria-valuenow', percentage.toString());
    }

    // Formación e Información de Alineación en Budget Card
    const formationBadgeEl = document.getElementById('budget-formation-badge');
    if (formationBadgeEl && data.formation) {
      formationBadgeEl.textContent = data.formation;
    }

    const lineupStatusEl = document.getElementById('budget-lineup-status');
    if (lineupStatusEl) {
      const starters = data.startersCount ?? 6;
      const reserves = data.reservesCount ?? 3;
      if (starters < 6 || reserves < 3) {
        lineupStatusEl.textContent = `Alineación: ${starters}/6 Titulares • ${reserves}/3 Suplentes`;
        lineupStatusEl.classList.add('is-incomplete');
      } else {
        lineupStatusEl.textContent = `Alineación: ${starters} Titulares • ${reserves} Suplentes`;
        lineupStatusEl.classList.remove('is-incomplete');
      }
    }

    // 3. Valoración Global
    const valGlobalEl = document.getElementById('val-global-value');
    if (valGlobalEl && data.valGlobal !== undefined) {
      valGlobalEl.textContent = data.valGlobal.toString();
    }

    // 4. Sección MVP
    const mvpNameEl = document.getElementById('mvp-name');
    if (mvpNameEl && data.mvp?.name) {
      mvpNameEl.textContent = data.mvp.name;
    }

    const mvpTagEl = document.getElementById('mvp-tag');
    if (mvpTagEl && data.mvp?.tag) {
      mvpTagEl.textContent = data.mvp.tag;
    }

    const mvpPosEl = document.getElementById('mvp-pos');
    if (mvpPosEl && data.mvp?.position) {
      mvpPosEl.textContent = data.mvp.position;
    }

    const mvpScoreEl = document.getElementById('mvp-score');
    if (mvpScoreEl) {
      if (data.mvp?.score !== undefined && data.mvp?.score !== null && data.mvp?.score !== '-') {
        const num = Number(data.mvp.score);
        mvpScoreEl.textContent = !isNaN(num) && num > 0 ? num.toFixed(1) : '-';
      } else {
        mvpScoreEl.textContent = '-';
      }
    }

    const mvpMatchesEl = document.getElementById('mvp-matches');
    if (mvpMatchesEl) {
      mvpMatchesEl.textContent = (data.mvp?.matches ?? 0).toString();
    }

    const mvpGoalsEl = document.getElementById('mvp-goals');
    if (mvpGoalsEl) {
      mvpGoalsEl.textContent = (data.mvp?.goals ?? 0).toString();
    }

    const mvpAvatarEl = document.getElementById('mvp-avatar');
    if (mvpAvatarEl && data.mvp?.avatarUrl) {
      mvpAvatarEl.innerHTML = `<img src="${data.mvp.avatarUrl}" alt="${data.mvp.name}">`;
    }

    // 5. Mi Equipo (Grid / Flex de Jugadores)
    const teamCountEl = document.getElementById('team-players-count');
    if (teamCountEl && data.team) {
      teamCountEl.textContent = `${data.team.count ?? data.team.players?.length ?? 6} / ${data.team.max ?? 6} jugadores`;
    }

    const teamSlotsContainer = document.getElementById('team-slots-container');
    if (teamSlotsContainer && Array.isArray(data.team?.players)) {
      const slots = teamSlotsContainer.querySelectorAll('.player-slot');
      slots.forEach((slot, index) => {
        const player = data.team.players[index] || null;
        const avatar = slot.querySelector('.player-slot__avatar');
        const roleLabel = slot.querySelector('.player-slot__role');
        if (!avatar || !roleLabel) return;

        const role = roleLabel.textContent.trim();
        const name = player?.name || '';
        const label = name ? `${name} - ${role}` : `Puesto ${role} sin asignar`;
        const icon = avatar.querySelector('.player-slot__icon');
        const currentImage = avatar.querySelector('img');
        currentImage?.remove();

        slot.classList.toggle('is-empty', !player);
        slot.title = label;
        avatar.setAttribute('aria-label', label);

        if (player?.avatarUrl) {
          const image = document.createElement('img');
          image.src = player.avatarUrl;
          image.alt = name || role;
          avatar.appendChild(image);
          image.addEventListener('error', () => {
            image.remove();
            if (icon) icon.hidden = false;
          }, { once: true });
          if (icon) icon.hidden = true;
        } else if (icon) {
          icon.hidden = false;
        }
      });
    }

    // 6. Racha Reciente (Totalmente dinámica y reactiva)
    const streakResultBadge = document.getElementById('streak-result-badge');
    const streakResultScore = document.getElementById('streak-result-score');
    const streakOpponentEl = document.getElementById('streak-opponent-text');

    if (data.streak?.lastMatch) {
      const res = (data.streak.lastMatch.result || 'V').toUpperCase();
      let colorClass = 'text-win';
      if (res === 'D') colorClass = 'text-loss';
      else if (res === 'E') colorClass = 'text-draw';

      if (streakResultBadge) {
        streakResultBadge.textContent = res;
        streakResultBadge.className = colorClass;
      }

      if (streakResultScore) {
        const rawScore = data.streak.lastMatch.score || '2 – 1';
        streakResultScore.textContent = rawScore.replace('-', '–');
      }

      if (streakOpponentEl) {
        let opp = data.streak.lastMatch.opponent || 'MánagerX';
        if (!opp.startsWith('vs ')) opp = `vs ${opp}`;
        streakOpponentEl.textContent = opp;
      }
    }

    const streakCirclesContainer = document.getElementById('streak-circles-container');
    if (streakCirclesContainer && Array.isArray(data.streak?.recentResults)) {
      streakCirclesContainer.innerHTML = data.streak.recentResults
        .slice(0, 5)
        .map((result) => {
          const normalized = (result || 'V').toUpperCase();
          let modifier = 'streak-circle--win';
          let title = 'Victoria';

          if (normalized === 'D') {
            modifier = 'streak-circle--loss';
            title = 'Derrota';
          } else if (normalized === 'E') {
            modifier = 'streak-circle--draw';
            title = 'Empate';
          }

          return `<span class="streak-circle ${modifier}" title="${title} (${normalized})">${normalized}</span>`;
        })
        .join('');
    }
  } catch (error) {
    console.error('[Dashboard] Error al renderizar la vista Home:', error);
  }
}

export const renderDashboard = renderHome;

/**
 * Consulta los endpoints de backend FastAPI para obtener los datos consolidados.
 * Endpoints configurados:
 * - GET /api/me: Perfil y club del mánager autenticado.
 * - GET /api/analytics/summary: Métricas de rendimiento, valoración y racha de partidos.
 *
 * @returns {Promise<typeof DEFAULT_HOME_DATA>} Datos consolidados para renderizar.
 */
export async function fetchHomeData() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let managerData = null;
  let analyticsData = null;

  // 1. Fetch Perfil del Mánager (/api/me)
  try {
    const resMe = await fetch('/api/me', { headers });
    if (resMe.ok) {
      managerData = await resMe.json();
    } else {
      console.warn('[Dashboard] /api/me retornó código:', resMe.status);
    }
  } catch (err) {
    console.info('[Dashboard] Modo offline o backend no disponible para /api/me:', err.message);
  }

  // 2. Fetch Resumen Analítico (/api/analytics/summary o /api/analytics/meta-stats)
  try {
    const resAnalytics = await fetch('/api/analytics/summary', { headers });
    if (resAnalytics.ok) {
      analyticsData = await resAnalytics.json();
    } else {
      const resMeta = await fetch('/api/analytics/meta-stats', { headers }).catch(() => null);
      if (resMeta && resMeta.ok) {
        analyticsData = await resMeta.json();
      }
    }
  } catch (err) {
    console.info('[Dashboard] Modo offline o backend no disponible para analíticas:', err.message);
  }

  // 3. Fusión con persistencia de partidos locales
  let localStats = null;
  let localLastMatch = null;
  try {
    const rawStats = localStorage.getItem('fantasy_user_stats');
    if (rawStats) localStats = JSON.parse(rawStats);
    const rawHistory = localStorage.getItem('fantasy_match_history');
    if (rawHistory) {
      const historyArr = JSON.parse(rawHistory);
      if (Array.isArray(historyArr) && historyArr.length > 0) {
        localLastMatch = historyArr[0];
      }
    }
  } catch (e) {
    console.debug('[Dashboard] Error leyendo datos locales de partidos:', e);
  }

  // 4. Lectura y cálculo reactivo de la Alineación y Plantilla Activa
  let activeSquad = null;
  try {
    const rawSquad = localStorage.getItem('fantasy_active_squad');
    if (rawSquad) {
      activeSquad = JSON.parse(rawSquad);
    }
  } catch (e) {
    console.debug('[Dashboard] Error leyendo plantilla activa:', e);
  }

  if (!activeSquad || !Array.isArray(activeSquad.players) || activeSquad.players.length === 0) {
    activeSquad = DEFAULT_HOME_SQUAD;
  }

  // Leer estadísticas acumuladas reales de los jugadores
  let playerStats = {};
  try {
    const rawStats = localStorage.getItem('fantasy_player_stats');
    if (rawStats) playerStats = JSON.parse(rawStats);
  } catch (e) {
    console.debug('[Dashboard] Error leyendo fantasy_player_stats:', e);
  }

  const starterSlots = activeSquad.players.slice(0, 6);
  const starters = starterSlots.filter(Boolean);
  const reserves = activeSquad.players.slice(6, 9).filter(Boolean);
  const allSquadPlayers = activeSquad.players.filter(Boolean);

  // Cálculo del presupuesto gastado y disponible
  const totalSpent = allSquadPlayers.reduce((acc, p) => acc + getPlayerPrice(p), 0);
  const spentRounded = Math.round(totalSpent * 10) / 10;
  const availableRounded = Math.max(0, Math.round((100.0 - spentRounded) * 10) / 10);
  const budgetPercentage = Math.min(100, Math.round((spentRounded / 100.0) * 100));

  // Cálculo de Valoración Global (media real de los 6 puestos titulares)
  const startersTotalRating = starters.reduce((acc, p) => acc + getPlayerRating(p), 0);
  const calculatedValGlobal = starters.length > 0 ? Math.round(startersTotalRating / 6) : 0;

  // Helper flexible para comparar nombres de jugadores (ej. "L. Messi" y "Messi")
  function isSameName(a, b) {
    if (!a || !b) return false;
    const cleanA = a.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
    const cleanB = b.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
    return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
  }

  function getPlayerStatRecord(playerName) {
    if (!playerName) return null;
    return playerStats[playerName] || Object.values(playerStats).find(v => isSameName(v.name, playerName)) || null;
  }

  // Jugador destacado / MVP: prioriza a futbolistas con partidos disputados, goles y premios MVP oficiales
  const playersWithMatches = allSquadPlayers.filter(p => {
    const s = getPlayerStatRecord(p.name);
    return (s?.matchesPlayed || 0) > 0;
  });

  let topPlayer;
  let topStats;

  if (playersWithMatches.length > 0) {
    topPlayer = [...playersWithMatches].sort((a, b) => {
      const sA = getPlayerStatRecord(a.name) || {};
      const sB = getPlayerStatRecord(b.name) || {};
      const scoreA = (sA.mvpAwards || 0) * 15 + (sA.goals || 0) * 5 + (Number(sA.avgRating) || 0) * 2;
      const scoreB = (sB.mvpAwards || 0) * 15 + (sB.goals || 0) * 5 + (Number(sB.avgRating) || 0) * 2;
      return scoreB - scoreA;
    })[0];
    topStats = getPlayerStatRecord(topPlayer.name);
  } else {
    topPlayer = allSquadPlayers.find(p => p.role === 'DEL') || starters[0] || allSquadPlayers[0];
    topStats = { matchesPlayed: 0, goals: 0, avgRating: null };
  }

  // 5. Mapeo y fusión con el esquema canónico
  const consolidatedData = {
    ...DEFAULT_HOME_DATA,
    manager: {
      ...DEFAULT_HOME_DATA.manager,
      name: managerData?.username || managerData?.name || DEFAULT_HOME_DATA.manager.name,
      season: managerData?.season || DEFAULT_HOME_DATA.manager.season,
      ranking: localStats?.ranking ?? managerData?.ranking ?? DEFAULT_HOME_DATA.manager.ranking
    },
    budget: {
      total: 100.0,
      spent: spentRounded,
      available: availableRounded,
      percentage: budgetPercentage
    },
    valGlobal: calculatedValGlobal,
    formation: activeSquad.formation || '1-2-2-1',
    startersCount: starters.length,
    reservesCount: reserves.length,
    totalPlayers: allSquadPlayers.length,
    team: {
      count: starters.length,
      max: 6,
      players: starterSlots.map((p) => p ? ({
        id: p.id,
        name: p.name || p.nombre,
        role: p.role || p.posicion_base,
        rating: getPlayerRating(p),
        avatarUrl: p.photo_url || p.avatarUrl || getPlayerPhoto(p)
      }) : null)
    },
    mvp: topPlayer ? {
      name: topPlayer.name,
      tag: 'MVP',
      position: (topPlayer.role || 'DEL').toUpperCase(),
      matches: topStats?.matchesPlayed || 0,
      goals: topStats?.goals || 0,
      score: (topStats?.matchesPlayed > 0 && topStats?.avgRating != null)
        ? Number(topStats.avgRating).toFixed(1)
        : '-',
      maxScore: 10,
      avatarUrl: topPlayer.photo_url || topPlayer.avatarUrl || null
    } : DEFAULT_HOME_DATA.mvp,
    streak: {
      ...DEFAULT_HOME_DATA.streak,
      ...(analyticsData?.streak || {}),
      recentResults: (localStats?.streak && Array.isArray(localStats.streak) && localStats.streak.length > 0)
        ? localStats.streak.slice(0, 5)
        : (analyticsData?.streak?.recentResults || DEFAULT_HOME_DATA.streak.recentResults),
      lastMatch: localLastMatch ? {
        result: localLastMatch.resultado === 'VICTORIA' ? 'V' : (localLastMatch.resultado === 'EMPATE' ? 'E' : 'D'),
        score: localLastMatch.score || '2 – 1',
        scoreText: `${localLastMatch.resultado === 'VICTORIA' ? 'V' : (localLastMatch.resultado === 'EMPATE' ? 'E' : 'D')} ${localLastMatch.score || '2 – 1'}`,
        opponent: localLastMatch.rival ? (localLastMatch.rival.startsWith('vs ') ? localLastMatch.rival : `vs ${localLastMatch.rival}`) : 'vs MánagerX'
      } : (analyticsData?.streak?.lastMatch || DEFAULT_HOME_DATA.streak.lastMatch)
    }
  };

  return consolidatedData;
}

/**
 * Inicializa los eventos de interacción de la pantalla Dashboard.
 * @param {Object} [router] - Instancia de navegación SPA.
 */
export function setupHomeEventListeners(router) {
  // 1. Botón "BUSCAR RIVAL" con animación de Matchmaking
  const btnBuscarRival = document.getElementById('btn-buscar-rival');
  if (btnBuscarRival) {
    btnBuscarRival.addEventListener('click', (e) => {
      e.preventDefault();
      console.info('[Dashboard] Iniciando emparejamiento para buscar rival...');

      // Fase 1: Animación de búsqueda activa con radar/spinner
      btnBuscarRival.disabled = true;
      btnBuscarRival.classList.add('is-searching');
      btnBuscarRival.innerHTML = `
        <span class="spinner-radar" aria-hidden="true"></span>
        <span>BUSCANDO RIVAL...</span>
      `;

      // Redireccion fluida a la pantalla intermedia de Matchmaking y Comparativa Tactica
      setTimeout(() => {
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate('/matchmaking');
        } else if (router && typeof router.navigate === 'function') {
          router.navigate('/matchmaking');
        } else {
          window.location.hash = '/matchmaking';
        }
      }, 350);
    });
  }

  // 2. Enlace "ÚLTIMO PARTIDO >" hacia Historial
  const streakLastMatchLink = document.getElementById('streak-last-match-link');
  if (streakLastMatchLink) {
    streakLastMatchLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/history');
      } else if (router && typeof router.navigate === 'function') {
        router.navigate('/history');
      } else {
        window.location.href = '/history';
      }
    });
  }

  // 3. Enlace directo a Pizarra Táctica / Alineación
  const lineupLink = document.getElementById('budget-lineup-link');
  if (lineupLink) {
    lineupLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/lineup');
      } else if (router && typeof router.navigate === 'function') {
        router.navigate('/lineup');
      } else {
        window.location.hash = '#/lineup';
      }
    });
  }

  // 4. Escucha de sincronización reactiva cuando la alineación cambia
  const squadUpdateHandler = async () => {
    try {
      const liveData = await fetchHomeData();
      renderHome(liveData);
      if (statsModal && !statsModal.hasAttribute('hidden')) {
        renderStatsModalContent();
      }
    } catch (e) {
      console.debug('[Dashboard] Error al refrescar datos de alineación:', e);
    }
  };
  window.addEventListener('fantasy:squad-updated', squadUpdateHandler);
  window.addEventListener('fantasy:player-stats-updated', squadUpdateHandler);
  window.addEventListener('storage', (e) => {
    if (e.key === 'fantasy_active_squad' || e.key === 'fantasy_player_stats') {
      squadUpdateHandler();
    }
  });

  // 5. Modal de Estadísticas Completas de los 9 Jugadores
  const statsModal = document.getElementById('stats-modal-sheet');
  const statsBackdrop = document.getElementById('stats-modal-backdrop');
  const btnStats = document.getElementById('btn-team-stats');
  const mvpClickable = document.getElementById('mvp-stats-clickable');
  const btnCloseStats = document.getElementById('btn-close-stats-modal');
  const statsListContainer = document.getElementById('stats-modal-list');

  function openStatsModal() {
    if (!statsModal || !statsBackdrop) return;
    renderStatsModalContent();
    statsBackdrop.removeAttribute('hidden');
    statsModal.removeAttribute('hidden');
  }

  function closeStatsModal() {
    if (!statsModal || !statsBackdrop) return;
    statsModal.setAttribute('hidden', '');
    statsBackdrop.setAttribute('hidden', '');
  }

  function renderStatsModalContent() {
    if (!statsListContainer) return;

    let squad = DEFAULT_HOME_SQUAD;
    try {
      const raw = localStorage.getItem('fantasy_active_squad');
      if (raw) squad = JSON.parse(raw);
    } catch (e) {}

    let stats = {};
    try {
      const raw = localStorage.getItem('fantasy_player_stats');
      if (raw) stats = JSON.parse(raw);
    } catch (e) {}

    const rawList = Array.isArray(squad?.players) ? squad.players : DEFAULT_HOME_SQUAD.players;
    const players = [];
    for (let i = 0; i < 9; i++) {
      players.push(rawList[i] || DEFAULT_HOME_SQUAD.players[i] || null);
    }

    statsListContainer.innerHTML = players.map((p, idx) => {
      if (!p) {
        return `
          <div class="player-stat-card">
            <div class="player-stat-card__left">
              <div class="player-stat-card__token player-stat-card__token--mc">+</div>
              <div class="player-stat-card__info">
                <span class="player-stat-card__name">Puesto Vacío</span>
                <span class="player-stat-card__tag">${idx < 6 ? 'Titular sin asignar' : 'Banquillo libre'}</span>
              </div>
            </div>
            <div class="player-stat-card__right">
              <span class="stat-chip"><span class="stat-chip__label">PJ</span><strong class="stat-chip__val">-</strong></span>
              <span class="stat-chip"><span class="stat-chip__label">Goles</span><strong class="stat-chip__val">-</strong></span>
            </div>
          </div>
        `;
      }

      function isSameNameModal(a, b) {
        if (!a || !b) return false;
        const cleanA = a.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
        const cleanB = b.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
        return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
      }

      const role = (p.role || p.posicion_base || 'MC').toUpperCase();
      const pStats = stats[p.name] ||
        Object.values(stats).find(v => isSameNameModal(v.name, p.name)) ||
        Object.entries(stats).find(([k]) => isSameNameModal(k, p.name))?.[1] ||
        {};
      const hasPlayed = (pStats.matchesPlayed || 0) > 0;
      const matches = pStats.matchesPlayed || 0;
      const goals = pStats.goals || 0;
      const rating = (hasPlayed && pStats.avgRating != null)
        ? Number(pStats.avgRating).toFixed(1)
        : '-';
      const isStarter = idx < 6;
      const tokenClass = `player-stat-card__token--${role.toLowerCase()}`;

      return `
        <div class="player-stat-card">
          <div class="player-stat-card__left">
            <div class="player-stat-card__token ${tokenClass}">
              ${role}
            </div>
            <div class="player-stat-card__info">
              <span class="player-stat-card__name">${p.name}</span>
              <span class="player-stat-card__tag">${isStarter ? 'Titular' : 'Suplente'} • Rating Base ${getPlayerRating(p)}</span>
            </div>
          </div>
          <div class="player-stat-card__right">
            <span class="stat-chip" title="Partidos Jugados">
              <span class="stat-chip__label">PJ</span>
              <strong class="stat-chip__val">${matches}</strong>
            </span>
            <span class="stat-chip" title="Goles anotados">
              <span class="stat-chip__label">Goles</span>
              <strong class="stat-chip__val">${goals}</strong>
            </span>
            <span class="stat-chip stat-chip--rating" title="Nota Media">
              <span class="stat-chip__label">Nota</span>
              <strong class="stat-chip__val">${rating}</strong>
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  if (btnStats) btnStats.addEventListener('click', openStatsModal);
  if (mvpClickable) mvpClickable.addEventListener('click', openStatsModal);
  if (btnCloseStats) btnCloseStats.addEventListener('click', closeStatsModal);
  if (statsBackdrop) statsBackdrop.addEventListener('click', closeStatsModal);
}

/**
 * Garantiza la integridad del DOM del Dashboard verificando que tanto la
 * tarjeta de Racha Reciente como el botón ¡BUSCAR RIVAL! existan físicamente en el DOM.
 */
export function ensureDashboardIntegrity() {
  const main = document.querySelector('.home-main');
  if (!main) return;

  // 1. Asegurar tarjeta de Racha Reciente
  let streakCard = document.getElementById('recent-streak');
  if (!streakCard) {
    console.info('[Dashboard] Inyectando tarjeta de Racha Reciente en el DOM...');
    streakCard = document.createElement('article');
    streakCard.className = 'card home-card streak-card';
    streakCard.id = 'recent-streak';
    streakCard.setAttribute('aria-labelledby', 'streak-title');
    streakCard.innerHTML = `
      <div class="streak-card__header">
        <h3 class="streak-card__title" id="streak-title">Racha Reciente</h3>
        <a href="/history" data-link class="streak-card__link" id="streak-last-match-link" aria-label="Ver detalles del último partido">
          ÚLTIMO PARTIDO &gt;
        </a>
      </div>
      <div class="streak-card__content">
        <div class="streak-match-info" id="streak-match-info">
          <strong class="streak-result-highlight" id="streak-result-container">
            <span class="text-win" id="streak-result-badge">V</span>
            <span id="streak-result-score">2 – 1</span>
          </strong>
          <span class="streak-opponent" id="streak-opponent-text">vs MánagerX</span>
        </div>
        <div class="streak-circles-wrapper" id="streak-circles-container" aria-label="Historial de los últimos 5 partidos">
          <span class="streak-circle streak-circle--win" title="Victoria (V)">V</span>
          <span class="streak-circle streak-circle--win" title="Victoria (V)">V</span>
          <span class="streak-circle streak-circle--loss" title="Derrota (D)">D</span>
          <span class="streak-circle streak-circle--draw" title="Empate (E)">E</span>
          <span class="streak-circle streak-circle--win" title="Victoria (V)">V</span>
        </div>
      </div>
    `;
    main.appendChild(streakCard);
  }

  // 2. Asegurar contenedor Dock para el botón Buscar Rival arriba de la barra de navegación
  const homeView = document.getElementById('home-view') || document.querySelector('.home-app-container');
  let ctaDock = document.getElementById('home-cta-dock');
  if (!ctaDock && homeView) {
    ctaDock = document.createElement('footer');
    ctaDock.className = 'home-cta-dock';
    ctaDock.id = 'home-cta-dock';
    homeView.appendChild(ctaDock);
  }

  // 3. Asegurar botón de Buscar Rival dentro del dock inferior
  let btnRival = document.getElementById('btn-buscar-rival');
  if (!btnRival) {
    console.info('[Dashboard] Inyectando botón ¡BUSCAR RIVAL! en dock inferior...');
    btnRival = document.createElement('button');
    btnRival.className = 'btn btn--primary btn-buscar-rival';
    btnRival.id = 'btn-buscar-rival';
    btnRival.type = 'button';
    btnRival.setAttribute('aria-label', 'Buscar rival para jugar partido');
    btnRival.innerHTML = `
      <svg class="btn-buscar-rival__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <span>¡BUSCAR RIVAL!</span>
    `;
    if (ctaDock) {
      ctaDock.appendChild(btnRival);
    } else {
      main.appendChild(btnRival);
    }
  } else if (ctaDock && btnRival.parentElement !== ctaDock) {
    // Si estaba dentro de main, moverlo al dock fijo arriba de la barra de navegación
    ctaDock.appendChild(btnRival);
  }
}

/**
 * Función de arranque del módulo Dashboard para el Router SPA.
 * @param {Object} [router]
 */
export async function initDashboard(router) {
  console.info('[Dashboard] Inicializando vista Dashboard...');
  ensureDashboardIntegrity();
  renderHome(DEFAULT_HOME_DATA);
  setupHomeEventListeners(router);

  try {
    const liveData = await fetchHomeData();
    renderHome(liveData);
  } catch (error) {
    console.warn('[Dashboard] Fallo al cargar datos remotos, conservando estado inicial:', error);
  }
}

export const initHomeView = initDashboard;
