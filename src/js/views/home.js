/**
 * @file home.js
 * @description Módulo controlador para la vista principal (Home / Inicio) de Fantasy de Leyendas.
 * Gestiona el renderizado dinámico de métricas, plantilla, MVP y la integración con el backend FastAPI.
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
          const role = player.role || 'JUG';
          const name = player.name || `Jugador ${role}`;
          return `
            <div class="player-slot" role="listitem" title="${name}">
              <div class="player-slot__avatar" data-position="${role}" aria-label="${name} - ${role}">
                ${
                  player.avatarUrl
                    ? `<img src="${player.avatarUrl}" alt="${name}">`
                    : `<svg class="player-slot__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>`
                }
              </div>
              <span class="player-slot__role">${role}</span>
            </div>
          `;
        })
        .join('');
    }

    // 6. Racha Reciente
    const streakResultEl = document.getElementById('streak-result-text');
    if (streakResultEl && data.streak?.lastMatch?.scoreText) {
      streakResultEl.textContent = data.streak.lastMatch.scoreText;
    }

    const streakOpponentEl = document.getElementById('streak-opponent-text');
    if (streakOpponentEl && data.streak?.lastMatch?.opponent) {
      streakOpponentEl.textContent = data.streak.lastMatch.opponent;
    }

    const streakCirclesContainer = document.getElementById('streak-circles-container');
    if (streakCirclesContainer && Array.isArray(data.streak?.recentResults)) {
      streakCirclesContainer.innerHTML = data.streak.recentResults
        .map((result) => {
          const normalized = (result || '').toUpperCase();
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
    console.error('[HomeView] Error al renderizar la vista Home:', error);
  }
}

/**
 * Consulta los endpoints de backend FastAPI para obtener los datos consolidados.
 * Endpoints configurados:
 * - GET /api/me: Perfil y club del mánager autenticado.
 * - GET /api/analytics/summary: Métricas de rendimiento, valoración y racha de partidos.
 *
 * @returns {Promise<typeof DEFAULT_HOME_DATA>} Datos consolidados para renderizar.
 */
export async function fetchHomeData() {
  const token = localStorage.getItem('access_token');
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
      console.warn('[HomeView] /api/me retornó código:', resMe.status);
    }
  } catch (err) {
    console.info('[HomeView] Modo offline o backend no disponible para /api/me:', err.message);
  }

  // 2. Fetch Resumen Analítico (/api/analytics/summary o /api/analytics/meta-stats)
  try {
    const resAnalytics = await fetch('/api/analytics/summary', { headers });
    if (resAnalytics.ok) {
      analyticsData = await resAnalytics.json();
    } else {
      // Fallback alternativo a meta-stats si el endpoint específico aún no está migrado
      const resMeta = await fetch('/api/analytics/meta-stats', { headers }).catch(() => null);
      if (resMeta && resMeta.ok) {
        analyticsData = await resMeta.json();
      }
    }
  } catch (err) {
    console.info('[HomeView] Modo offline o backend no disponible para analíticas:', err.message);
  }

  // 3. Fusión con persistencia de partidos locales (Fase 4)
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
    console.debug('[HomeView] Error leyendo datos locales de partidos:', e);
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
      recentResults: localStats?.streak || analyticsData?.streak?.recentResults || DEFAULT_HOME_DATA.streak.recentResults,
      lastMatch: localLastMatch ? {
        result: localLastMatch.resultado === 'VICTORIA' ? 'V' : (localLastMatch.resultado === 'EMPATE' ? 'E' : 'D'),
        scoreText: `${localLastMatch.resultado === 'VICTORIA' ? 'V' : (localLastMatch.resultado === 'EMPATE' ? 'E' : 'D')} ${localLastMatch.score}`,
        opponent: s 
      } : (analyticsData?.streak?.lastMatch || DEFAULT_HOME_DATA.streak.lastMatch)
    }
  };

  return consolidatedData;
}

/**
 * Inicializa los eventos de interacción de la pantalla Home.
 */
export function setupHomeEventListeners() {
  // 1. Botón "BUSCAR RIVAL" con animación de Matchmaking
  const btnBuscarRival = document.getElementById('btn-buscar-rival');
  if (btnBuscarRival) {
    btnBuscarRival.addEventListener('click', (e) => {
      e.preventDefault();
      console.info('[HomeView] Iniciando emparejamiento para buscar rival...');

      // Fase 1: Animación de búsqueda activa con radar/spinner
      btnBuscarRival.disabled = true;
      btnBuscarRival.classList.add('is-searching');
      btnBuscarRival.innerHTML = `
        <span class="spinner-radar" aria-hidden="true"></span>
        <span>BUSCANDO RIVAL...</span>
      `;

      // Fase 2: Rival encontrado con feedback visual
      setTimeout(() => {
        btnBuscarRival.classList.remove('is-searching');
        btnBuscarRival.classList.add('is-found');
        btnBuscarRival.innerHTML = `
          <span>Rival encontrado</span>
        `;

        // Fase 3: Redirección fluida al partido en directo
        setTimeout(() => {
          const isPagesDir = window.location.pathname.includes('/pages/');
          const targetUrl = isPagesDir ? 'match-detail.html?autoplay=true' : '/src/pages/match-detail.html?autoplay=true';
          window.location.href = targetUrl;
        }, 500);
      }, 1200);
    });
  }

  // 2. Control de navegación inferior (Bottom Navigation Bar)
  const navItems = document.querySelectorAll('.bottom-nav__item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      navItems.forEach((nav) => {
        nav.classList.remove('is-active', 'bottom-nav__item--active');
        nav.removeAttribute('aria-current');
      });
      item.classList.add('is-active', 'bottom-nav__item--active');
      item.setAttribute('aria-current', 'page');
    });
  });

  // 3. Enlace al último partido
  const streakLink = document.getElementById('streak-last-match-link');
  if (streakLink) {
    streakLink.addEventListener('click', (e) => {
      console.info('[HomeView] Navegando a detalle de historial de partidos');
    });
  }
}

/**
 * Función de arranque del módulo Home.
 */
export async function initHomeView() {
  console.info('[HomeView] Inicializando vista Home...');

  // 1. Render inicial inmediato con fallback para evitar saltos de interfaz (FOUC)
  renderHome(DEFAULT_HOME_DATA);

  // 2. Configuración de escuchadores de eventos
  setupHomeEventListeners();

  // 3. Carga asíncrona de datos desde el backend FastAPI
  try {
    const liveData = await fetchHomeData();
    renderHome(liveData);
  } catch (error) {
    console.warn('[HomeView] Fallo al cargar datos remotos, conservando estado inicial:', error);
  }
}

// Auto-arranque al cargar en entorno standalone
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomeView);
} else {
  initHomeView();
}
