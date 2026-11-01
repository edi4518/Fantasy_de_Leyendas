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
    spent: 83.4,
    available: 16.6,
    total: 100.0,
    percentage: 83
  },
  valGlobal: 88,
  mvp: {
    name: 'L. Messi',
    tag: 'MVP',
    position: 'DEL',
    score: 9.2,
    maxScore: 10,
    avatarUrl: null
  },
  team: {
    count: 6,
    max: 6,
    players: [
      { id: 1, role: 'POR', name: 'L. Yashin', rating: 91, avatarUrl: null },
      { id: 2, role: 'DEF', name: 'F. Baresi', rating: 92, avatarUrl: null },
      { id: 3, role: 'DEF', name: 'P. Maldini', rating: 94, avatarUrl: null },
      { id: 4, role: 'MC', name: 'Z. Zidane', rating: 93, avatarUrl: null },
      { id: 5, role: 'MC', name: 'Xavi Hernández', rating: 91, avatarUrl: null },
      { id: 6, role: 'DEL', name: 'L. Messi', rating: 96, avatarUrl: null }
    ]
  },
  streak: {
    lastMatch: {
      result: 'V',
      scoreText: 'V 2 - 1',
      opponent: 'vs MánagerX'
    },
    recentResults: ['V', 'V', 'D', 'E', 'V'] // V = Victoria, D = Derrota, E = Empate
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
    if (mvpScoreEl && data.mvp?.score !== undefined) {
      mvpScoreEl.textContent = Number(data.mvp.score).toFixed(1);
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
    if (teamSlotsContainer && Array.isArray(data.team?.players) && data.team.players.length > 0) {
      teamSlotsContainer.innerHTML = data.team.players
        .map((player) => {
          const role = (player.role || 'JUG').toUpperCase();
          const roleClass = role.toLowerCase();
          const name = player.name || `Jugador ${role}`;
          return `
            <div class="player-slot player-slot--${roleClass}" role="listitem" title="${name}">
              <div class="player-slot__avatar" data-position="${role}" aria-label="${name} - ${role}">
                ${
                  player.avatarUrl
                    ? `<img src="${player.avatarUrl}" alt="${name}">`
                    : `<svg class="player-slot__icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>`
                }
              </div>
              <span class="player-slot__role">${role}</span>
            </div>
          `;
        })
        .join('');
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

  // 4. Mapeo y fusión con el esquema canónico
  const consolidatedData = {
    ...DEFAULT_HOME_DATA,
    manager: {
      ...DEFAULT_HOME_DATA.manager,
      name: managerData?.username || managerData?.name || DEFAULT_HOME_DATA.manager.name,
      season: managerData?.season || DEFAULT_HOME_DATA.manager.season,
      ranking: localStats?.ranking ?? managerData?.ranking ?? DEFAULT_HOME_DATA.manager.ranking
    },
    budget: {
      ...DEFAULT_HOME_DATA.budget,
      spent: analyticsData?.budget_spent ?? DEFAULT_HOME_DATA.budget.spent,
      available: analyticsData?.budget_available ?? DEFAULT_HOME_DATA.budget.available,
      percentage: analyticsData?.budget_percentage ?? DEFAULT_HOME_DATA.budget.percentage
    },
    valGlobal: analyticsData?.global_rating ?? DEFAULT_HOME_DATA.valGlobal,
    mvp: {
      ...DEFAULT_HOME_DATA.mvp,
      ...(analyticsData?.mvp_player || {})
    },
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

      // Guardar bandera en sessionStorage para forzar inicio automático del partido
      sessionStorage.setItem('fantasy_match_autoplay', 'true');

      // Fase 2: Rival encontrado con feedback visual
      setTimeout(() => {
        btnBuscarRival.classList.remove('is-searching');
        btnBuscarRival.classList.add('is-found');
        btnBuscarRival.innerHTML = `
          <span>¡RIVAL ENCONTRADO!</span>
        `;

        // Fase 3: Redirección fluida al partido en directo
        setTimeout(() => {
          if (window.router && typeof window.router.navigate === 'function') {
            window.router.navigate('/match/live?autoplay=true');
          } else if (router && typeof router.navigate === 'function') {
            router.navigate('/match/live?autoplay=true');
          } else {
            window.location.href = '/match/live?autoplay=true';
          }
        }, 400);
      }, 1000);
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
