/**
 * @file match-detail.js
 * @description Controlador modular para la vista de Detalles de Partido (Partido en Directo) de Fantasy de Leyendas.
 * Gestiona el consumo del endpoint GET /api/matches/{id}, simulación rápida (POST /api/matches/simulate),
 * actualización del timeline de eventos y alternancia de pestañas (Cronología / Estadísticas / Alineaciones).
 */

import { openMatchResultModal } from '../components/modal.js';

/**
 * Datos por defecto alineados al prototipo visual de la aplicación.
 * Aseguran estabilidad y renderizado inmediato en modo offline o desarrollo frontend.
 */
export const DEFAULT_MATCH_DATA = {
  id: 1,
  status: 'FINAL',
  homeTeam: {
    id: 101,
    name: 'Tu Equipo',
    score: 2,
    formation: '1-2-2-1',
    crest: null
  },
  awayTeam: {
    id: 102,
    name: 'Equipo Rival',
    score: 1,
    formation: '1-2-2-1',
    crest: null
  },
  liveAction: {
    team: 'Tu Equipo',
    status: 'ATAQUE PELIGROSO'
  },
  events: [
    { minute: 72, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
    { minute: 64, side: 'away', type: 'red-card', player: 'P. Maldini', detail: '(Tarjeta Roja)' },
    { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
    { minute: 28, side: 'away', type: 'goal', player: 'Pelé', detail: '(Gol)' },
    { minute: 15, side: 'home', type: 'goal', player: 'Z. Zidane', detail: '(Gol)' }
  ],
  stats: {
    possession: { home: 58, away: 42, label: 'Posesión', unit: '%' },
    shots: { home: 14, homeOnTarget: 8, away: 9, awayOnTarget: 4, label: 'Tiros (a puerta)' },
    fouls: { home: 7, away: 12, label: 'Faltas' },
    rating: { home: 8.4, away: 7.6, label: 'Valoración Media' },
    corners: { home: 6, away: 3, label: 'Córners' }
  },
  lineups: {
    home: [
      { role: 'POR', name: 'L. Yashin', rating: 9.1 },
      { role: 'DEF', name: 'F. Baresi', rating: 8.8 },
      { role: 'DEF', name: 'P. Maldini', rating: 8.9 },
      { role: 'MC', name: 'Z. Zidane', rating: 9.3 },
      { role: 'MC', name: 'Xavi', rating: 8.9 },
      { role: 'DEL', name: 'L. Messi', rating: 9.8 }
    ],
    away: [
      { role: 'POR', name: 'G. Buffon', rating: 8.7 },
      { role: 'DEF', name: 'Beckenbauer', rating: 9.4 },
      { role: 'DEF', name: 'R. Carlos', rating: 8.5 },
      { role: 'MC', name: 'Maradona', rating: 9.6 },
      { role: 'MC', name: 'A. Pirlo', rating: 8.8 },
      { role: 'DEL', name: 'Pelé', rating: 9.5 }
    ]
  }
};

/**
 * Consulta la información del partido desde la API de backend FastAPI.
 * @param {string|number} matchId - Identificador del encuentro.
 * @returns {Promise<typeof DEFAULT_MATCH_DATA>} Datos consolidados del partido.
 */
export async function fetchMatchDetail(matchId = 1) {
  const token = localStorage.getItem('access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  try {
    const response = await fetch(`/api/matches/${matchId}`, { headers });
    if (response.ok) {
      const data = await response.json();
      return mergeWithDefaultMatchData(data);
    }
    console.warn(`[MatchDetail] /api/matches/${matchId} respondió status ${response.status}. Usando datos de respaldo.`);
  } catch (error) {
    console.info('[MatchDetail] Backend no disponible o modo offline. Usando plantilla visual por defecto:', error.message);
  }

  return DEFAULT_MATCH_DATA;
}

/**
 * Fusiona la respuesta parcial del backend con la estructura canónica.
 * @param {Object} apiData
 */
function mergeWithDefaultMatchData(apiData) {
  if (!apiData) return DEFAULT_MATCH_DATA;

  return {
    ...DEFAULT_MATCH_DATA,
    id: apiData.id || DEFAULT_MATCH_DATA.id,
    status: apiData.status || DEFAULT_MATCH_DATA.status,
    homeTeam: {
      ...DEFAULT_MATCH_DATA.homeTeam,
      name: apiData.home_team_name || apiData.homeTeam?.name || DEFAULT_MATCH_DATA.homeTeam.name,
      score: apiData.home_score ?? apiData.homeTeam?.score ?? DEFAULT_MATCH_DATA.homeTeam.score,
      formation: apiData.home_formation || DEFAULT_MATCH_DATA.homeTeam.formation
    },
    awayTeam: {
      ...DEFAULT_MATCH_DATA.awayTeam,
      name: apiData.away_team_name || apiData.awayTeam?.name || DEFAULT_MATCH_DATA.awayTeam.name,
      score: apiData.away_score ?? apiData.awayTeam?.score ?? DEFAULT_MATCH_DATA.awayTeam.score,
      formation: apiData.away_formation || DEFAULT_MATCH_DATA.awayTeam.formation
    },
    events: Array.isArray(apiData.events) && apiData.events.length > 0 ? apiData.events : DEFAULT_MATCH_DATA.events,
    stats: apiData.stats || DEFAULT_MATCH_DATA.stats,
    lineups: apiData.lineups || DEFAULT_MATCH_DATA.lineups
  };
}

/**
 * Renderiza todos los componentes de la vista con los datos del partido.
 * @param {typeof DEFAULT_MATCH_DATA} match
 */
export function renderMatchDetail(match = DEFAULT_MATCH_DATA) {
  // 1. Marcador y Equipos
  const homeNameEl = document.getElementById('home-team-name');
  if (homeNameEl) homeNameEl.textContent = match.homeTeam.name;

  const awayNameEl = document.getElementById('away-team-name');
  if (awayNameEl) awayNameEl.textContent = match.awayTeam.name;

  const homeScoreEl = document.getElementById('home-score');
  if (homeScoreEl) homeScoreEl.textContent = match.homeTeam.score.toString();

  const awayScoreEl = document.getElementById('away-score');
  if (awayScoreEl) awayScoreEl.textContent = match.awayTeam.score.toString();

  const statusTextEl = document.getElementById('match-status-text');
  if (statusTextEl) statusTextEl.textContent = match.status;

  // 2. Banner de Acción en Directo de la Cancha
  const actionTeamEl = document.getElementById('pitch-action-team');
  if (actionTeamEl && match.liveAction?.team) {
    actionTeamEl.textContent = match.liveAction.team;
  }

  const actionStatusEl = document.getElementById('pitch-action-status');
  if (actionStatusEl && match.liveAction?.status) {
    actionStatusEl.textContent = match.liveAction.status;
  }

  // 3. Renderizado de la Cronología (Timeline)
  renderTimeline(match.events);

  // 4. Renderizado de Estadísticas Comparativas
  renderStats(match.stats);

  // 5. Renderizado de Alineaciones
  renderLineups(match.lineups, match.homeTeam, match.awayTeam);
}

/**
 * Genera el listado visual del timeline minuto a minuto.
 * @param {Array} events
 */
export function renderTimeline(events = []) {
  const container = document.getElementById('timeline-events-list');
  if (!container || !Array.isArray(events)) return;

  container.innerHTML = events
    .map((event) => {
      // Hito central (Descanso o fin de prórroga)
      if (event.isPeriodBreak) {
        return `
          <div class="timeline-period-break" data-minute="${event.minute}">
            <div class="period-pill">${event.label || 'DESCANSO'}</div>
            <span class="period-minute">${event.minute}'</span>
          </div>
        `;
      }

      const isHome = event.side === 'home';
      const sideClass = isHome ? 'timeline-entry--home' : 'timeline-entry--away';

      // Determinación de ícono según tipo de incidencia
      let iconClass = 'event-icon--goal';
      if (event.type === 'red-card') {
        iconClass = 'event-icon--red-card';
      } else if (event.type === 'yellow-card') {
        iconClass = 'event-icon--yellow-card';
      } else if (event.type === 'goal' && !isHome) {
        iconClass = 'event-icon--goal-away';
      }

      if (isHome) {
        return `
          <div class="timeline-entry ${sideClass}" data-minute="${event.minute}">
            <div class="timeline-entry__content">
              <span class="event-icon ${iconClass}" aria-hidden="true"></span>
              <span class="event-player"><strong>${event.player}</strong> <span class="event-detail">${event.detail || ''}</span></span>
            </div>
            <div class="timeline-entry__minute">${event.minute}'</div>
          </div>
        `;
      } else {
        return `
          <div class="timeline-entry ${sideClass}" data-minute="${event.minute}">
            <div class="timeline-entry__minute">${event.minute}'</div>
            <div class="timeline-entry__content">
              <span class="event-icon ${iconClass}" aria-hidden="true"></span>
              <span class="event-player"><strong>${event.player}</strong> <span class="event-detail">${event.detail || ''}</span></span>
            </div>
          </div>
        `;
      }
    })
    .join('');
}

/**
 * Renderiza las barras comparativas de estadísticas deportivas.
 * @param {Object} stats
 */
export function renderStats(stats = {}) {
  const container = document.getElementById('match-stats-list');
  if (!container || !stats) return;

  const entries = [
    {
      key: 'possession',
      label: 'Posesión',
      homeText: `${stats.possession?.home || 50}%`,
      awayText: `${stats.possession?.away || 50}%`,
      homePercent: stats.possession?.home || 50,
      awayPercent: stats.possession?.away || 50
    },
    {
      key: 'shots',
      label: 'Tiros (a puerta)',
      homeText: `${stats.shots?.homeOnTarget ?? 8} (${stats.shots?.home ?? 14})`,
      awayText: `${stats.shots?.awayOnTarget ?? 4} (${stats.shots?.away ?? 9})`,
      homePercent: calculatePercentage(stats.shots?.home || 14, stats.shots?.away || 9),
      awayPercent: calculatePercentage(stats.shots?.away || 9, stats.shots?.home || 14)
    },
    {
      key: 'fouls',
      label: 'Faltas',
      homeText: `${stats.fouls?.home ?? 7}`,
      awayText: `${stats.fouls?.away ?? 12}`,
      homePercent: calculatePercentage(stats.fouls?.home || 7, stats.fouls?.away || 12),
      awayPercent: calculatePercentage(stats.fouls?.away || 12, stats.fouls?.home || 7)
    },
    {
      key: 'rating',
      label: 'Valoración Media',
      homeText: `${Number(stats.rating?.home ?? 8.4).toFixed(1)}`,
      awayText: `${Number(stats.rating?.away ?? 7.6).toFixed(1)}`,
      homePercent: calculatePercentage(stats.rating?.home || 8.4, stats.rating?.away || 7.6),
      awayPercent: calculatePercentage(stats.rating?.away || 7.6, stats.rating?.home || 8.4)
    },
    {
      key: 'corners',
      label: 'Córners',
      homeText: `${stats.corners?.home ?? 6}`,
      awayText: `${stats.corners?.away ?? 3}`,
      homePercent: calculatePercentage(stats.corners?.home || 6, stats.corners?.away || 3),
      awayPercent: calculatePercentage(stats.corners?.away || 3, stats.corners?.home || 6)
    }
  ];

  container.innerHTML = entries
    .map(
      (item) => `
      <div class="stat-row">
        <div class="stat-row__header">
          <span class="stat-value stat-value--home">${item.homeText}</span>
          <span class="stat-label">${item.label}</span>
          <span class="stat-value stat-value--away">${item.awayText}</span>
        </div>
        <div class="comparative-bar-track">
          <div class="comparative-bar-fill comparative-bar-fill--home" style="width: ${item.homePercent}%;"></div>
          <div class="comparative-bar-fill comparative-bar-fill--away" style="width: ${item.awayPercent}%;"></div>
        </div>
      </div>
    `
    )
    .join('');
}

/**
 * Utilidad para normalizar proporciones para barras comparativas.
 */
function calculatePercentage(valA, valB) {
  const sum = Number(valA) + Number(valB);
  if (sum === 0) return 50;
  return Math.round((Number(valA) / sum) * 100);
}

/**
 * Renderiza las alineaciones y formaciones de los dos equipos.
 */
export function renderLineups(lineups = {}, homeTeam = {}, awayTeam = {}) {
  const homeTitleEl = document.getElementById('lineup-home-title');
  if (homeTitleEl) {
    homeTitleEl.textContent = `${homeTeam.name || 'Tu Equipo'} (${homeTeam.formation || '1-2-2-1'})`;
  }

  const awayTitleEl = document.getElementById('lineup-away-title');
  if (awayTitleEl) {
    awayTitleEl.textContent = `${awayTeam.name || 'Equipo Rival'} (${awayTeam.formation || '1-2-2-1'})`;
  }

  const homeListEl = document.getElementById('lineup-home-players');
  if (homeListEl && Array.isArray(lineups.home)) {
    homeListEl.innerHTML = renderPlayerListItems(lineups.home);
  }

  const awayListEl = document.getElementById('lineup-away-players');
  if (awayListEl && Array.isArray(lineups.away)) {
    awayListEl.innerHTML = renderPlayerListItems(lineups.away);
  }
}

function renderPlayerListItems(players = []) {
  return players
    .map((p) => {
      let badgeClass = 'badge--pos-def';
      if (p.role === 'POR') badgeClass = 'badge--pos-por';
      else if (p.role === 'MC' || p.role === 'MED') badgeClass = 'badge--pos-med';
      else if (p.role === 'DEL') badgeClass = 'badge--pos-del';

      return `
        <li class="lineup-player-item">
          <span><span class="badge ${badgeClass}">${p.role}</span> ${p.name}</span>
          <strong class="player-rating">${Number(p.rating).toFixed(1)}</strong>
        </li>
      `;
    })
    .join('');
}

/**
 * Configuración de las pestañas internas de la pantalla (Resumen / Cronología / Estadísticas / Alineaciones).
 */
export function setupMatchTabs() {
  const tabs = document.querySelectorAll('.match-tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');

      // 1. Alternar estilos activos de pestañas
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      // 2. Alternar visibilidad de paneles
      panels.forEach((panel) => {
        if (panel.id === targetId) {
          panel.classList.add('is-active');
          panel.removeAttribute('hidden');
        } else {
          panel.classList.remove('is-active');
          panel.setAttribute('hidden', 'true');
        }
      });
    });
  });
}

/**
 * Configura la acción del botón de simulación rápida.
 */
export function setupQuickSimulation() {
  const btn = document.getElementById('btn-quick-sim');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    console.info('[MatchDetail] Ejecutando simulación rápida...');
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = `<span>SIMULANDO...</span>`;

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch('/api/matches/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ match_id: 1, fast_mode: true })
      }).catch(() => null);

      if (response && response.ok) {
        const result = await response.json();
        console.info('[MatchDetail] Simulación completada por backend:', result);
      }
    } catch (err) {
      console.warn('[MatchDetail] Error en petición de simulación rápida:', err);
    } finally {
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = originalText;
        // Notificar al usuario o actualizar estado
        const statusBadge = document.getElementById('match-status-text');
        if (statusBadge) statusBadge.textContent = 'FINAL';

        // Desplegar PopUp / Modal de Resultado del Partido
        openMatchResultModal();
      }, 500);
    }
  });
}

/**
 * Inicialización completa de la vista de Detalles de Partido.
 */
export async function initMatchDetailView() {
  console.info('[MatchDetail] Inicializando vista de Detalles de Partido...');

  // 1. Render inicial inmediato con mock data para evitar saltos
  renderMatchDetail(DEFAULT_MATCH_DATA);

  // 2. Event listeners de tabs y botones
  setupMatchTabs();
  setupQuickSimulation();

  // 3. Obtener ID del partido desde URL (query param ?id= o hash)
  const urlParams = new URLSearchParams(window.location.search);
  const matchId = urlParams.get('id') || 1;

  // 4. Carga asíncrona de datos desde FastAPI
  const liveMatchData = await fetchMatchDetail(matchId);
  renderMatchDetail(liveMatchData);
}

// Auto-arranque al cargar el DOM en entorno de navegación directa
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMatchDetailView);
} else {
  initMatchDetailView();
}
