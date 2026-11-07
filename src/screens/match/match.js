
/**
 * @file match-detail.js
 * @description Controlador modular y data-driven para la pantalla de Detalles de Partido (Partido en Directo).
 * Sincronizado con formaciones reales de usuario, modal de resultados y flujo con "Buscar Rival" (autoplay).
 */

import { openMatchResultModal, getInitials } from '../../components/modal/modal.js';
import { simulateMatchEngine, FORMATIONS_6V6 } from '../../domain/simulation-engine.js';
import { getRandomCpuTeam } from '../../domain/cpu-teams.js';
import { matchService } from '../../services/match-service.js';


export const DEFAULT_AWAY_SQUAD = {
  name: 'Equipo Rival',
  formation: '1-1-3-1',
  players: [
    { name: 'Buffon', role: 'POR', rating_general: 90, rating_fisico: 84, rating_palmares: 89, rating_defensa: 30, rating_creacion: 20, rating_tecnica: 40, rating_ataque: 10 },
    { name: 'Beckenbauer', role: 'DEF', rating_defensa: 94, rating_fisico: 86, rating_palmares: 96, rating_creacion: 85, rating_tecnica: 88, rating_ataque: 60 },
    { name: 'Maradona', role: 'MC', rating_creacion: 98, rating_tecnica: 99, rating_fisico: 78, rating_palmares: 97, rating_ataque: 95, rating_defensa: 45 },
    { name: 'Cruyff', role: 'MC', rating_creacion: 96, rating_tecnica: 97, rating_fisico: 82, rating_palmares: 95, rating_ataque: 92, rating_defensa: 50 },
    { name: 'Pirlo', role: 'MC', rating_creacion: 95, rating_tecnica: 94, rating_fisico: 75, rating_palmares: 90, rating_ataque: 75, rating_defensa: 60 },
    { name: 'Pelé', role: 'DEL', rating_ataque: 98, rating_tecnica: 96, rating_creacion: 90, rating_fisico: 88, rating_palmares: 99, rating_defensa: 40 },
    // 4 Suplentes reglamentarios
    { name: 'Henry', role: 'DEL', rating_ataque: 94, rating_tecnica: 92, rating_fisico: 87, rating_palmares: 88, rating_defensa: 35, rating_creacion: 78 },
    { name: 'Rivaldo', role: 'DEL', rating_ataque: 93, rating_tecnica: 93, rating_fisico: 80, rating_palmares: 90, rating_defensa: 30, rating_creacion: 85 },
    { name: 'Roberto Carlos', role: 'DEF', rating_defensa: 86, rating_fisico: 92, rating_palmares: 88, rating_ataque: 80, rating_creacion: 75, rating_tecnica: 82 },
    { name: 'Kahn', role: 'POR', rating_general: 89, rating_fisico: 85, rating_palmares: 90, rating_defensa: 88, rating_creacion: 20, rating_tecnica: 40, rating_ataque: 10 }
  ]
};

export const DEFAULT_HOME_SQUAD = {
  name: 'Tu Equipo',
  formation: '1-2-2-1',
  players: [
    { name: 'Casillas', role: 'POR', rating_general: 90, rating_fisico: 85, rating_palmares: 92, rating_defensa: 88, rating_creacion: 20, rating_tecnica: 40, rating_ataque: 10 },
    { name: 'Maldini', role: 'DEF', rating_defensa: 96, rating_fisico: 88, rating_palmares: 95, rating_creacion: 75, rating_tecnica: 80, rating_ataque: 50 },
    { name: 'Zidane', role: 'MC', rating_creacion: 96, rating_tecnica: 98, rating_fisico: 82, rating_palmares: 96, rating_ataque: 90, rating_defensa: 60 },
    { name: 'Xavi', role: 'MC', rating_creacion: 97, rating_tecnica: 96, rating_fisico: 76, rating_palmares: 97, rating_ataque: 80, rating_defensa: 65 },
    { name: 'Messi', role: 'DEL', rating_ataque: 99, rating_tecnica: 99, rating_fisico: 86, rating_palmares: 99, rating_creacion: 95, rating_defensa: 35 },
    { name: 'Ronaldo Nazário', role: 'DEL', rating_ataque: 98, rating_tecnica: 95, rating_fisico: 90, rating_palmares: 94, rating_creacion: 80, rating_defensa: 30 },
    // 4 Suplentes reglamentarios
    { name: 'Ronaldinho', role: 'MC', rating_creacion: 95, rating_tecnica: 98, rating_fisico: 80, rating_palmares: 93, rating_ataque: 92, rating_defensa: 40 },
    { name: 'Iniesta', role: 'MC', rating_creacion: 96, rating_tecnica: 97, rating_fisico: 78, rating_palmares: 97, rating_ataque: 84, rating_defensa: 60 },
    { name: 'Puyol', role: 'DEF', rating_defensa: 94, rating_fisico: 90, rating_palmares: 94, rating_creacion: 65, rating_tecnica: 70, rating_ataque: 40 },
    { name: 'Van der Sar', role: 'POR', rating_general: 89, rating_fisico: 82, rating_palmares: 88, rating_defensa: 86, rating_creacion: 25, rating_tecnica: 45, rating_ataque: 10 }
  ]
};

export const DEFAULT_MATCH_DATA = {
  id: 1,
  status: 'PREVIA',
  homeTeam: { id: 101, name: 'Tu Equipo', score: 0, formation: '1-2-2-1' },
  awayTeam: { id: 102, name: 'Equipo Rival', score: 0, formation: '1-2-2-1' },
  liveAction: { team: 'Preparando partido', status: 'CALENTAMIENTO' },
  events: [],
  stats: {
    possession: { home: 50, away: 50, label: 'Posesión' },
    shots: { home: 0, away: 0, label: 'Tiros a Puerta' },
    fouls: { home: 0, away: 0, label: 'Faltas' }
  },
  lineups: {
    home: DEFAULT_HOME_SQUAD.players.slice(0, 6),
    away: DEFAULT_AWAY_SQUAD.players.slice(0, 6),
    homeStarters: DEFAULT_HOME_SQUAD.players.slice(0, 6),
    homeBench: DEFAULT_HOME_SQUAD.players.slice(6),
    awayStarters: DEFAULT_AWAY_SQUAD.players.slice(0, 6),
    awayBench: DEFAULT_AWAY_SQUAD.players.slice(6)
  }
};

let liveSimulationInterval = null;
let halftimeTimeout = null;
let currentFullMatch = null;
let isMatchLive = false;
let currentSimulatedMinute = 0;

/**
 * Obtiene la plantilla real del usuario (desde localStorage o backend).
 */
export function getUserSquad() {
  try {
    const saved = localStorage.getItem('fantasy_active_squad');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && Array.isArray(parsed.players) && parsed.players.length > 0) {
        return {
          name: parsed.name || parsed.team_name || 'Tu Equipo',
          formation: parsed.formation || '1-2-2-1',
          players: [...parsed.players]
        };
      }
    }
  } catch (err) {
    console.debug('[Match] Error leyendo plantilla del usuario:', err.message);
  }
  return DEFAULT_HOME_SQUAD;
}

/**
 * Renderizado reactivo en el DOM.
 */
/**
 * Actualiza el botón de acción de la cabecera:
 * - Durante el partido: "SIMULACIÓN RÁPIDA"
 * - Al finalizar: "BUSCAR OTRO RIVAL" (redirige a /matchmaking)
 */
export function updateHeaderActionButton(isFinished = false) {
  const quickSimBtn = document.getElementById('btn-quick-sim');
  if (!quickSimBtn) return;

  if (isFinished) {
    quickSimBtn.setAttribute('data-mode', 'search-rival');
    quickSimBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: -1px;">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      BUSCAR OTRO RIVAL
    `;
    quickSimBtn.classList.add('btn-search-rival-header');
    quickSimBtn.title = 'Buscar un nuevo rival en Matchmaking';
  } else {
    quickSimBtn.setAttribute('data-mode', 'quick-sim');
    quickSimBtn.textContent = 'SIMULACIÓN RÁPIDA';
    quickSimBtn.classList.remove('btn-search-rival-header');
    quickSimBtn.title = 'Resolver el partido al instante';
  }
}

export function renderMatchDetails(match = DEFAULT_MATCH_DATA) {
  const homeNameEl = document.getElementById('home-team-name');
  if (homeNameEl) homeNameEl.textContent = match.homeTeam?.name || 'Tu Equipo';

  const awayNameEl = document.getElementById('away-team-name');
  if (awayNameEl) awayNameEl.textContent = match.awayTeam?.name || 'Equipo Rival';

  const homeScoreEl = document.getElementById('home-score');
  if (homeScoreEl) homeScoreEl.textContent = match.homeTeam?.score ?? 0;

  const awayScoreEl = document.getElementById('away-score');
  if (awayScoreEl) awayScoreEl.textContent = match.awayTeam?.score ?? 0;

  const statusTextEl = document.getElementById('match-status-text');
  if (statusTextEl) statusTextEl.textContent = match.status || 'FINAL';

  const statusDot = document.getElementById('status-dot');
  if (statusDot) {
    if (match.isLive || (match.status && match.status.includes('EN VIVO'))) {
      statusDot.classList.add('is-live');
    } else {
      statusDot.classList.remove('is-live');
    }
  }

  const actionTeamTextEl = document.getElementById('pitch-action-team-text');
  if (actionTeamTextEl) {
    actionTeamTextEl.textContent = match.liveAction?.team || match.homeTeam?.name || 'Tu Equipo';
  }

  const actionStatusEl = document.getElementById('pitch-action-status');
  const actionOverlayEl = document.getElementById('pitch-action-overlay');
  if (actionStatusEl && match.liveAction?.status) {
    actionStatusEl.textContent = match.liveAction.status;

    if (match.liveAction.status.includes('GOOOOL')) {
      actionStatusEl.classList.add('is-goal');
      if (actionOverlayEl) actionOverlayEl.classList.add('is-goal-alert');
    } else {
      actionStatusEl.classList.remove('is-goal');
      if (actionOverlayEl) actionOverlayEl.classList.remove('is-goal-alert');
    }
  }

  renderTimeline(match.events);
  renderStats(match.stats, match);

  const statusStr = String(match.status || '');
  const isPrevia = statusStr.includes('PREVIA') || statusStr.includes('CALENTAMIENTO');
  const isFinished = !isPrevia && (statusStr === 'FINAL' || (!match.isLive && !statusStr.includes('EN VIVO') && !statusStr.includes('DESCANSO')));
  updateHeaderActionButton(isFinished);
  renderLineups(match.lineups, match.homeTeam, match.awayTeam);
}

export function getEventSvgIcon(type, isHome = true) {
  switch (type) {
    case 'goal': {
      const strokeColor = isHome ? '#10B981' : '#64748B';
      const patchColor = isHome ? '#065F46' : '#334155';
      const bgCircle = isHome ? '#ECFDF5' : '#F1F5F9';
      return `
        <span class="event-icon event-icon--goal ${isHome ? 'event-icon--home' : 'event-icon--away'}" title="Gol" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="8.5" fill="${bgCircle}" stroke="${strokeColor}" stroke-width="1.3"/>
            <polygon points="10,6.2 12.8,8.3 11.7,11.6 8.3,11.6 7.2,8.3" fill="${patchColor}"/>
            <path d="M10 6.2V1.8M12.8 8.3L17.2 6.8M11.7 11.6L15.3 16.5M8.3 11.6L4.7 16.5M7.2 8.3L2.8 6.8" stroke="${patchColor}" stroke-width="1.1" stroke-linecap="round"/>
            <path d="M8 2.2C8.6 2 9.3 1.8 10 1.8c.7 0 1.4.2 2 .4L10 4.2z" fill="${patchColor}"/>
            <path d="M17.6 7.8c.3.7.4 1.4.4 2.2 0 .7-.1 1.4-.4 2.1l-2.4-1.2z" fill="${patchColor}"/>
            <path d="M13.8 17.5c-.6.4-1.3.6-2 .8-.7.2-1.5.2-2.2 0l1.1-2.6z" fill="${patchColor}"/>
            <path d="M2.4 10c0-.8.1-1.5.4-2.2l2.4 1.2-2.2 2.3c-.4-.4-.6-.8-.6-1.3z" fill="${patchColor}"/>
          </svg>
        </span>
      `;
    }

    case 'penalty-goal': {
      const postColor = isHome ? '#047857' : '#475569';
      const netColor = isHome ? '#10B981' : '#94A3B8';
      return `
        <span class="event-icon event-icon--penalty ${isHome ? 'event-icon--home' : 'event-icon--away'}" title="Gol de Penal" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 16.5V4h15v12.5" stroke="${postColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2.5 8h15M2.5 12h15M6.5 4v12.5M10.5 4v12.5M14.5 4v12.5" stroke="${netColor}" stroke-width="0.75" stroke-dasharray="1.2 1.2" opacity="0.7"/>
            <circle cx="12.5" cy="12" r="3.8" fill="#FFFFFF" stroke="${postColor}" stroke-width="1.2"/>
            <polygon points="12.5,10.2 13.9,11.2 13.4,12.8 11.6,12.8 11.1,11.2" fill="${postColor}"/>
            <path d="M6 15l3.5-2M4.5 12l4-.5" stroke="#F59E0B" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
        </span>
      `;
    }

    case 'yellow-card': {
      return `
        <span class="event-icon event-icon--yellow-card" title="Tarjeta Amarilla" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5.5" y="2.5" width="9.5" height="14.5" rx="1.8" transform="rotate(7 10 10)" fill="#F59E0B" stroke="#B45309" stroke-width="1"/>
            <path d="M7 4.5l6.5 1" stroke="#FEF08A" stroke-width="0.9" opacity="0.9" stroke-linecap="round"/>
          </svg>
        </span>
      `;
    }

    case 'red-card': {
      return `
        <span class="event-icon event-icon--red-card" title="Tarjeta Roja" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="5.5" y="2.5" width="9.5" height="14.5" rx="1.8" transform="rotate(7 10 10)" fill="#EF4444" stroke="#991B1B" stroke-width="1"/>
            <path d="M7 4.5l6.5 1" stroke="#FCA5A5" stroke-width="0.9" opacity="0.9" stroke-linecap="round"/>
          </svg>
        </span>
      `;
    }

    case 'substitution': {
      return `
        <span class="event-icon event-icon--sub" title="Sustitución" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 11.5a6 6 0 0 1 9.8-5" stroke="#10B981" stroke-width="2" stroke-linecap="round"/>
            <polygon points="15.5,3.8 15.5,7.8 11.8,7.8" fill="#10B981"/>
            <path d="M15.5 8.5a6 6 0 0 1-9.8 5" stroke="#EF4444" stroke-width="2" stroke-linecap="round"/>
            <polygon points="4.5,16.2 4.5,12.2 8.2,12.2" fill="#EF4444"/>
          </svg>
        </span>
      `;
    }

    case 'corner': {
      return `
        <span class="event-icon event-icon--corner" title="Tiro de Esquina" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 17.5V6.5M2.5 17.5h11" stroke="#94A3B8" stroke-width="1.3" stroke-linecap="round"/>
            <path d="M2.5 11.5a6 6 0 0 1 6 6" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="2 1.5"/>
            <line x1="4" y1="17.5" x2="4" y2="2.5" stroke="#334155" stroke-width="1.6" stroke-linecap="round"/>
            <circle cx="4" cy="2.2" r="1.1" fill="#D97706"/>
            <path d="M4.8 3.2l9 3.3-9 3.8V3.2z" fill="#F59E0B" stroke="#D97706" stroke-width="0.8" stroke-linejoin="round"/>
          </svg>
        </span>
      `;
    }

    case 'save': {
      return `
        <span class="event-icon event-icon--save" title="Atajada Clave" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 10.5V5.5a1.2 1.2 0 0 1 2.4 0v2.8M8.4 7.8V3.5a1.2 1.2 0 0 1 2.4 0v4.3M10.8 7.8V4.5a1.2 1.2 0 0 1 2.4 0v4.2M13.2 8.7V6a1.1 1.1 0 0 1 2.2 0v5.2c0 3.2-1.8 5.3-4.2 5.3H9c-2.4 0-4-1.8-4-4.2v-2a1.2 1.2 0 0 1 2.4 0v.5" fill="#E0F2FE" stroke="#0284C7" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M7.5 12c0-1.5 1.5-2.5 3-2.5s3 1 3 2.5c0 1.8-1.2 2.8-3 2.8s-3-1-3-2.8z" fill="#0284C7" opacity="0.35"/>
            <rect x="5.5" y="16.5" width="8" height="2" rx="0.75" fill="#0369A1"/>
          </svg>
        </span>
      `;
    }

    case 'freekick': {
      return `
        <span class="event-icon event-icon--freekick" title="Tiro Libre" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 16C5.5 8.5 11 4.5 16.5 5.5" stroke="#F59E0B" stroke-width="1.6" stroke-dasharray="2.2 1.8" stroke-linecap="round"/>
            <circle cx="16.5" cy="5.5" r="2.4" fill="#EF4444"/>
            <circle cx="16.5" cy="5.5" r="1" fill="#FFFFFF"/>
            <circle cx="4" cy="16" r="3.2" fill="#FFFFFF" stroke="#047857" stroke-width="1.1"/>
            <polygon points="4,14.5 5,15.3 4.6,16.5 3.4,16.5 3,15.3" fill="#047857"/>
          </svg>
        </span>
      `;
    }

    default:
      return `
        <span class="event-icon event-icon--default" title="Evento" aria-hidden="true">
          <svg class="timeline-svg" viewBox="0 0 20 20" width="18" height="18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="10" cy="10" r="7" fill="#64748B"/>
          </svg>
        </span>
      `;
  }
}

export function renderTimeline(events = []) {
  const container = document.getElementById('timeline-events-list');
  if (!container) return;

  if (!Array.isArray(events) || events.length === 0) {
    container.innerHTML = '<div class="timeline-empty-notice">Esperando el pitido inicial...</div>';
    return;
  }

  container.innerHTML = events
    .map((event) => {
      if (event.isPeriodBreak) {
        const minuteLabel = event.minute > 0 ? `<span class="period-minute">${event.minute}'</span>` : '';
        return `
          <div class="timeline-period-break" data-minute="${event.minute}">
            <div class="period-pill">${event.label || 'DESCANSO'}</div>
            ${minuteLabel}
          </div>
        `;
      }

      const isHome = event.side === 'home';
      const sideClass = isHome ? 'timeline-entry--home' : 'timeline-entry--away';
      const iconHtml = getEventSvgIcon(event.type, isHome);

      if (isHome) {
        return `
          <div class="timeline-entry ${sideClass}" data-minute="${event.minute}">
            <div class="timeline-entry__content">
              <span class="event-player"><strong>${event.player}</strong> <span class="event-detail">${event.detail || ''}</span></span>
              ${iconHtml}
            </div>
            <div class="timeline-entry__minute">${event.minute}'</div>
          </div>
        `;
      } else {
        return `
          <div class="timeline-entry ${sideClass}" data-minute="${event.minute}">
            <div class="timeline-entry__minute">${event.minute}'</div>
            <div class="timeline-entry__content">
              ${iconHtml}
              <span class="event-player"><strong>${event.player}</strong> <span class="event-detail">${event.detail || ''}</span></span>
            </div>
          </div>
        `;
      }
    })
    .join('');
}

let activeStatFilter = 'general';

function setupStatsCategoryFilters() {
  const filterBar = document.getElementById('stats-filter-pills');
  if (!filterBar || filterBar.hasAttribute('data-bound')) return;

  filterBar.setAttribute('data-bound', 'true');
  filterBar.addEventListener('click', (e) => {
    const pill = e.target.closest('.stats-filter-pill');
    if (!pill) return;

    const filter = pill.getAttribute('data-stat-filter') || 'general';
    activeStatFilter = filter;

    filterBar.querySelectorAll('.stats-filter-pill').forEach((btn) => {
      btn.classList.toggle('is-active', btn === pill);
    });

    applyStatsCategoryFilter(filter);
  });
}

function applyStatsCategoryFilter(filter = activeStatFilter) {
  const groups = document.querySelectorAll('#match-stats-list .stats-section-group');
  groups.forEach((group) => {
    const cat = group.getAttribute('data-stat-group');
    if (filter === 'general' || cat === filter) {
      group.removeAttribute('hidden');
    } else {
      group.setAttribute('hidden', '');
    }
  });
}

function setElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(text);
}

function setElementHtml(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

function setBarWidth(id, percent) {
  const el = document.getElementById(id);
  if (el) {
    const clamped = Math.max(0, Math.min(100, Number(percent) || 50));
    el.style.width = `${clamped}%`;
  }
}

export function renderStats(stats = {}, match = DEFAULT_MATCH_DATA) {
  const container = document.getElementById('match-stats-list');
  if (!container || !stats) return;

  setupStatsCategoryFilters();
  applyStatsCategoryFilter(activeStatFilter);

  const events = Array.isArray(match?.events) ? match.events : [];
  const homeScore = Number(match?.homeTeam?.score ?? 0);
  const awayScore = Number(match?.awayTeam?.score ?? 0);
  const homeTeamName = match?.homeTeam?.name || 'Tu Equipo';
  const awayTeamName = match?.awayTeam?.name || 'Rival';

  // Determinar minuto efectivo del partido (1..90) para escalar métricas acumulativas
  let elapsedMinute = 90;
  const statusStr = String(match?.status || 'FINAL');
  const isPrevia = statusStr.includes('PREVIA') || statusStr.includes('CALENTAMIENTO') || (!match?.isLive && events.length === 0 && (homeScore + awayScore) === 0 && !statusStr.includes('FINAL'));

  if (isPrevia) {
    elapsedMinute = 0;
  } else if (statusStr === 'DESCANSO') {
    elapsedMinute = 45;
  } else if (match?.isLive || statusStr.includes('EN VIVO')) {
    const parsedMin = parseInt(statusStr.replace(/[^\d]/g, ''), 10);
    const maxEventMin = events.reduce((max, ev) => Math.max(max, Number(ev.minute) || 0), 0);
    elapsedMinute = Math.max(1, parsedMin || currentSimulatedMinute || maxEventMin || 1);
  }
  const progress = isPrevia ? 0 : Math.max(0, Math.min(1, elapsedMinute <= 1 && match?.isLive ? 0.02 : elapsedMinute / 90));

  // Contabilizar eventos reales de la cronología
  let homeYellows = 0;
  let awayYellows = 0;
  let homeReds = 0;
  let awayReds = 0;
  let homeCornerEvents = 0;
  let awayCornerEvents = 0;
  let homeSaveEvents = 0;
  let awaySaveEvents = 0;
  let homeFreekicks = 0;
  let awayFreekicks = 0;

  events.forEach((ev) => {
    if (!ev || ev.isPeriodBreak) return;
    const isHome = ev.side === 'home';
    if (ev.type === 'yellow-card') {
      if (isHome) homeYellows++; else awayYellows++;
    } else if (ev.type === 'red-card') {
      if (isHome) homeReds++; else awayReds++;
    } else if (ev.type === 'corner') {
      if (isHome) homeCornerEvents++; else awayCornerEvents++;
    } else if (ev.type === 'save') {
      if (isHome) homeSaveEvents++; else awaySaveEvents++;
    } else if (ev.type === 'freekick') {
      if (isHome) homeFreekicks++; else awayFreekicks++;
    }
  });

  // 1. Posesión
  const possHome = isPrevia ? 50 : Number(stats.possession?.home ?? 50);
  const possAway = isPrevia ? 50 : Number(stats.possession?.away ?? (100 - possHome));

  // 2. Tiros a puerta y desglose de tiros totales
  const rawShotsHome = isPrevia ? 0 : Number(stats.shots?.home ?? 0);
  const rawShotsAway = isPrevia ? 0 : Number(stats.shots?.away ?? 0);
  const shotsTargetHome = isPrevia ? 0 : Math.max(homeScore, rawShotsHome);
  const shotsTargetAway = isPrevia ? 0 : Math.max(awayScore, rawShotsAway);

  const shotsOffHome = (isPrevia || (elapsedMinute <= 1 && match?.isLive && shotsTargetHome === 0))
    ? 0
    : Math.max(0, Math.round(shotsTargetHome * 0.65 + homeCornerEvents * 0.5 + progress * 1.5));
  const shotsOffAway = (isPrevia || (elapsedMinute <= 1 && match?.isLive && shotsTargetAway === 0))
    ? 0
    : Math.max(0, Math.round(shotsTargetAway * 0.65 + awayCornerEvents * 0.5 + progress * 1.2));

  const shotsBlockedHome = (isPrevia || (elapsedMinute <= 1 && match?.isLive && shotsTargetHome === 0))
    ? 0
    : Math.max(0, Math.round(shotsTargetHome * 0.28 + homeFreekicks * 0.5));
  const shotsBlockedAway = (isPrevia || (elapsedMinute <= 1 && match?.isLive && shotsTargetAway === 0))
    ? 0
    : Math.max(0, Math.round(shotsTargetAway * 0.28 + awayFreekicks * 0.5));

  const totalShotsHome = isPrevia ? 0 : (shotsTargetHome + shotsOffHome + shotsBlockedHome);
  const totalShotsAway = isPrevia ? 0 : (shotsTargetAway + shotsOffAway + shotsBlockedAway);

  // 3. Goles Esperados (xG) y Ocasiones Claras
  const xgHomeVal = (isPrevia || (elapsedMinute <= 1 && match?.isLive && totalShotsHome === 0))
    ? 0
    : (homeScore * 0.44 + shotsTargetHome * 0.15 + shotsOffHome * 0.05 + shotsBlockedHome * 0.03);
  const xgAwayVal = (isPrevia || (elapsedMinute <= 1 && match?.isLive && totalShotsAway === 0))
    ? 0
    : (awayScore * 0.44 + shotsTargetAway * 0.15 + shotsOffAway * 0.05 + shotsBlockedAway * 0.03);

  const bigChancesHome = isPrevia ? 0 : Math.max(homeScore, Math.round(homeScore + (shotsTargetHome - homeScore) * 0.4));
  const bigChancesAway = isPrevia ? 0 : Math.max(awayScore, Math.round(awayScore + (shotsTargetAway - awayScore) * 0.4));

  // 4. Córners
  const cornersHome = isPrevia ? 0 : Math.max(homeCornerEvents, Math.round(homeCornerEvents + shotsOffHome * 0.5 + shotsBlockedHome * 0.5));
  const cornersAway = isPrevia ? 0 : Math.max(awayCornerEvents, Math.round(awayCornerEvents + shotsOffAway * 0.5 + shotsBlockedAway * 0.5));

  // 5. Pases y Precisión
  const baseTotalPasses = isPrevia ? 0 : Math.round(840 * progress);
  const passesHome = isPrevia ? 0 : Math.max(0, Math.round(baseTotalPasses * (possHome / 100)));
  const passesAway = isPrevia ? 0 : Math.max(0, Math.round(baseTotalPasses * (possAway / 100)));

  const passAccPctHome = isPrevia ? 0 : Math.min(93, Math.max(76, Math.round(80 + (possHome - 50) * 0.35 + (homeScore > awayScore ? 2 : 0))));
  const passAccPctAway = isPrevia ? 0 : Math.min(92, Math.max(74, Math.round(80 + (possAway - 50) * 0.35 + (awayScore > homeScore ? 2 : 0))));
  const completedPassesHome = isPrevia ? 0 : Math.round(passesHome * (passAccPctHome / 100));
  const completedPassesAway = isPrevia ? 0 : Math.round(passesAway * (passAccPctAway / 100));

  const finalThirdPctHome = isPrevia ? 0 : Math.min(78, Math.max(42, Math.round(52 + (possHome - 50) * 0.45 + shotsTargetHome * 1.4)));
  const finalThirdPctAway = isPrevia ? 0 : Math.min(76, Math.max(38, Math.round(50 + (possAway - 50) * 0.45 + shotsTargetAway * 1.4)));

  // 6. Defensa e Intensidad
  const duelsHomePct = isPrevia ? 50 : Math.min(68, Math.max(35, Math.round(50 + (possHome - 50) * 0.3 + (homeScore - awayScore) * 3)));
  const duelsAwayPct = 100 - duelsHomePct;

  const recoveriesHome = isPrevia ? 0 : Math.max(0, Math.round((42 + (possHome >= 50 ? 4 : -2)) * progress));
  const recoveriesAway = isPrevia ? 0 : Math.max(0, Math.round((39 + (possAway > 50 ? 4 : -2)) * progress));

  const savesHome = isPrevia ? 0 : Math.max(homeSaveEvents, Math.max(0, shotsTargetAway - awayScore));
  const savesAway = isPrevia ? 0 : Math.max(awaySaveEvents, Math.max(0, shotsTargetHome - homeScore));

  // 7. Disciplina
  const foulsHome = isPrevia ? 0 : Number(stats.fouls?.home ?? 0);
  const foulsAway = isPrevia ? 0 : Number(stats.fouls?.away ?? 0);
  const offsidesHome = isPrevia ? 0 : Math.max(0, Math.round((1 + shotsTargetHome * 0.22) * progress));
  const offsidesAway = isPrevia ? 0 : Math.max(0, Math.round((1 + shotsTargetAway * 0.25) * progress));

  // 8. Actualizar Jugador del Partido (MVP en Vivo)
  updateLiveStatsMvpCard(match, events, homeScore, awayScore, savesHome, savesAway, elapsedMinute);

  // 9. Actualizar DOM de todas las métricas y barras
  setElementText('stats-header-home-name', homeTeamName);
  setElementText('stats-header-away-name', awayTeamName.length > 12 ? 'Rival' : awayTeamName);

  // Ataque y Ocasiones
  setElementText('stat-xg-home', xgHomeVal.toFixed(2));
  setElementText('stat-xg-away', xgAwayVal.toFixed(2));
  setBarWidth('bar-xg-home', calculatePercentage(xgHomeVal, xgAwayVal));

  setElementText('stat-total-shots-home', totalShotsHome);
  setElementText('stat-total-shots-away', totalShotsAway);
  setBarWidth('bar-total-shots-home', calculatePercentage(totalShotsHome, totalShotsAway));
  setElementText('stat-shots-breakdown-home', `${shotsTargetHome} a puerta • ${shotsOffHome} fuera • ${shotsBlockedHome} bloq.`);
  setElementText('stat-shots-breakdown-away', `${shotsTargetAway} a puerta • ${shotsOffAway} fuera • ${shotsBlockedAway} bloq.`);

  setElementText('stat-shots-target-home', shotsTargetHome);
  setElementText('stat-shots-target-away', shotsTargetAway);
  setBarWidth('bar-shots-target-home', calculatePercentage(shotsTargetHome, shotsTargetAway));

  setElementText('stat-big-chances-home', bigChancesHome);
  setElementText('stat-big-chances-away', bigChancesAway);
  setBarWidth('bar-big-chances-home', calculatePercentage(bigChancesHome, bigChancesAway));

  setElementText('stat-corners-home', cornersHome);
  setElementText('stat-corners-away', cornersAway);
  setBarWidth('bar-corners-home', calculatePercentage(cornersHome, cornersAway));

  // Posesión y Pases
  setElementText('stat-possession-home', `${possHome}%`);
  setElementText('stat-possession-away', `${possAway}%`);
  setBarWidth('bar-possession-home', possHome);

  setElementText('stat-passes-home', passesHome);
  setElementText('stat-passes-away', passesAway);
  setBarWidth('bar-passes-home', calculatePercentage(passesHome, passesAway));

  setElementHtml('stat-pass-acc-home', `${passAccPctHome}% <span class="stat-value__sub">(${completedPassesHome})</span>`);
  setElementHtml('stat-pass-acc-away', `<span class="stat-value__sub">(${completedPassesAway})</span> ${passAccPctAway}%`);
  setBarWidth('bar-pass-acc-home', calculatePercentage(passAccPctHome, passAccPctAway));

  setElementText('stat-final-third-home', `${finalThirdPctHome}%`);
  setElementText('stat-final-third-away', `${finalThirdPctAway}%`);
  setBarWidth('bar-final-third-home', calculatePercentage(finalThirdPctHome, finalThirdPctAway));

  // Defensa e Intensidad
  setElementText('stat-duels-home', `${duelsHomePct}%`);
  setElementText('stat-duels-away', `${duelsAwayPct}%`);
  setBarWidth('bar-duels-home', duelsHomePct);

  setElementText('stat-recoveries-home', recoveriesHome);
  setElementText('stat-recoveries-away', recoveriesAway);
  setBarWidth('bar-recoveries-home', calculatePercentage(recoveriesHome, recoveriesAway));

  setElementText('stat-saves-home', savesHome);
  setElementText('stat-saves-away', savesAway);
  setBarWidth('bar-saves-home', calculatePercentage(savesHome, savesAway));

  // Disciplina
  setElementText('stat-fouls-home', foulsHome);
  setElementText('stat-fouls-away', foulsAway);
  setBarWidth('bar-fouls-home', calculatePercentage(foulsHome, foulsAway));

  setElementText('stat-yellow-home', homeYellows);
  setElementText('stat-red-home', homeReds);
  setElementText('stat-yellow-away', awayYellows);
  setElementText('stat-red-away', awayReds);

  setElementText('stat-offsides-home', offsidesHome);
  setElementText('stat-offsides-away', offsidesAway);
  setBarWidth('bar-offsides-home', calculatePercentage(offsidesHome, offsidesAway));
}

const SUPABASE_PLAYERS_BASE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';

const MVP_PLAYER_IMAGE_ALIASES = {
  messi: 'lionel_messi.webp',
  'l. messi': 'lionel_messi.webp',
  'lionel messi': 'lionel_messi.webp',
  zidane: 'zinedine_zidane.webp',
  'z. zidane': 'zinedine_zidane.webp',
  'zinedine zidane': 'zinedine_zidane.webp',
  maldini: 'paolo_maldini.webp',
  'p. maldini': 'paolo_maldini.webp',
  'paolo maldini': 'paolo_maldini.webp',
  xavi: 'xavi_hernandez.webp',
  'xavi hernandez': 'xavi_hernandez.webp',
  iniesta: 'andres_iniesta.webp',
  'a. iniesta': 'andres_iniesta.webp',
  'andres iniesta': 'andres_iniesta.webp',
  ronaldo: 'ronaldo_nazario.webp',
  'r. nazario': 'ronaldo_nazario.webp',
  'ronaldo nazario': 'ronaldo_nazario.webp',
  'cristiano ronaldo': 'cristiano_ronaldo.webp',
  'c. ronaldo': 'cristiano_ronaldo.webp',
  casillas: 'iker_casillas.webp',
  'i. casillas': 'iker_casillas.webp',
  'iker casillas': 'iker_casillas.webp',
  buffon: 'gianluigi_buffon.webp',
  'g. buffon': 'gianluigi_buffon.webp',
  'gianluigi buffon': 'gianluigi_buffon.webp',
  beckenbauer: 'franz_beckenbauer.webp',
  'f. beckenbauer': 'franz_beckenbauer.webp',
  'franz beckenbauer': 'franz_beckenbauer.webp',
  maradona: 'diego_maradona.webp',
  'd. maradona': 'diego_maradona.webp',
  'diego maradona': 'diego_maradona.webp',
  cruyff: 'johan_cruyff.webp',
  'j. cruyff': 'johan_cruyff.webp',
  'johan cruyff': 'johan_cruyff.webp',
  pirlo: 'andrea_pirlo.webp',
  'a. pirlo': 'andrea_pirlo.webp',
  'andrea pirlo': 'andrea_pirlo.webp',
  pele: 'pele.webp',
  henry: 'thierry_henry.webp',
  't. henry': 'thierry_henry.webp',
  'thierry henry': 'thierry_henry.webp',
  'roberto carlos': 'roberto_carlos.webp',
  'r. carlos': 'roberto_carlos.webp',
  kahn: 'oliver_kahn.webp',
  'o. kahn': 'oliver_kahn.webp',
  'oliver kahn': 'oliver_kahn.webp',
  baresi: 'franco_baresi.webp',
  'f. baresi': 'franco_baresi.webp',
  'franco baresi': 'franco_baresi.webp',
  'van basten': 'marco_van_basten.webp',
  'm. van basten': 'marco_van_basten.webp',
  'marco van basten': 'marco_van_basten.webp',
  'g. muller': 'gerd_muller.webp',
  'gerd muller': 'gerd_muller.webp',
  'l. matthaus': 'lothar_matthaus.webp',
  'lothar matthaus': 'lothar_matthaus.webp',
  'm. platini': 'michel_platini.webp',
  'michel platini': 'michel_platini.webp',
  's. gerrard': 'steven_gerrard.webp',
  'steven gerrard': 'steven_gerrard.webp',
  'd. bergkamp': 'dennis_bergkamp.webp',
  'dennis bergkamp': 'dennis_bergkamp.webp',
  'e. van der sar': 'edwin_van_der_sar.webp',
  'edwin van der sar': 'edwin_van_der_sar.webp',
  'a. nesta': 'alessandro_nesta.webp',
  'alessandro nesta': 'alessandro_nesta.webp',
};

function resolveMvpPlayerPhotoUrl(playerObj, playerName = '') {
  const direct = playerObj?.photo_url || playerObj?.avatarUrl || playerObj?.image_filename || '';
  if (direct) {
    return direct.startsWith('http') || direct.startsWith('/') ? direct : `${SUPABASE_PLAYERS_BASE_URL}${direct}`;
  }

  const normalizedName = String(playerName || playerObj?.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  // Buscar coincidencia en el plantel del usuario por si tiene photo_url o image_filename
  const userPlayers = getUserSquad()?.players || [];
  const squadMatch = userPlayers.find((p) => {
    const pNorm = String(p?.name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    return pNorm && (pNorm === normalizedName || pNorm.includes(normalizedName) || normalizedName.includes(pNorm));
  });
  const squadImg = squadMatch?.photo_url || squadMatch?.avatarUrl || squadMatch?.image_filename || '';
  if (squadImg) {
    return squadImg.startsWith('http') || squadImg.startsWith('/') ? squadImg : `${SUPABASE_PLAYERS_BASE_URL}${squadImg}`;
  }

  if (MVP_PLAYER_IMAGE_ALIASES[normalizedName]) {
    return `${SUPABASE_PLAYERS_BASE_URL}${MVP_PLAYER_IMAGE_ALIASES[normalizedName]}`;
  }

  const slug = normalizedName
    .replace(/[^a-z0-9\s_]/g, '')
    .replace(/\s+/g, '_');

  return slug ? `${SUPABASE_PLAYERS_BASE_URL}${slug}.webp` : `${SUPABASE_PLAYERS_BASE_URL}lionel_messi.webp`;
}

/**
 * Determina de forma canónica, unificada y 100% determinista la figura del encuentro (MVP).
 * Garantiza coincidencia absoluta e inquebrantable entre la pestaña de Estadísticas y el pop-up de Resultado.
 */
export function determineOfficialMatchMvp(match) {
  if (match?.officialMvp) {
    return match.officialMvp;
  }

  const homeScore = match?.homeTeam?.score ?? 0;
  const awayScore = match?.awayTeam?.score ?? 0;
  const isLoss = homeScore < awayScore;
  const isWin = homeScore > awayScore;

  const homeTeamName = match?.homeTeam?.name || 'Tu Equipo';
  const awayTeamName = match?.awayTeam?.name || 'Equipo Rival';

  const events = Array.isArray(match?.events) ? match.events : [];
  const homeStarters = match?.lineups?.home || match?.lineups?.homeStarters || DEFAULT_MATCH_DATA.lineups.home;
  const awayStarters = match?.lineups?.away || match?.lineups?.awayStarters || DEFAULT_MATCH_DATA.lineups.away;
  const homeBench = match?.lineups?.homeBench || [];
  const awayBench = match?.lineups?.awayBench || [];

  const homePool = [...homeStarters, ...homeBench];
  const awayPool = [...awayStarters, ...awayBench];

  // REGLA DE ORO DE COMPETICIÓN:
  // - En DERROTA: El MVP DEBE PERTENECER AL EQUIPO RIVAL GANADOR.
  // - En VICTORIA: El MVP DEBE PERTENECER AL EQUIPO LOCAL DEL USUARIO.
  // - En EMPATE: Se evalúan ambos equipos para elegir al jugador con mayor impacto del partido.
  let targetSide = isLoss ? 'away' : (isWin ? 'home' : 'both');

  const candidates = [];

  function evaluatePool(pool, side) {
    pool.forEach((player) => {
      if (!player || (!player.name && !player.nombre)) return;
      const pName = player.name || player.nombre;
      const role = (player.role || player.posicion_base || 'DEL').toUpperCase();
      const baseRating = Number(player.rating_general || player.media_juego || 75);

      // Goles anotados por este jugador en el encuentro
      const playerGoals = events.filter((e) =>
        e &&
        e.side === side &&
        (e.type === 'goal' || e.type === 'penalty-goal') &&
        (e.player === pName || (e.player && (e.player.includes(pName) || pName.includes(e.player))))
      ).length;

      // Atajadas si es arquero
      const playerSaves = events.filter((e) =>
        e &&
        e.side === side &&
        e.type === 'save' &&
        (e.player === pName || (e.player && (e.player.includes(pName) || pName.includes(e.player))))
      ).length;

      // Pases clave / tiros de esquina
      const keyActions = events.filter((e) =>
        e &&
        e.side === side &&
        (e.type === 'freekick' || e.type === 'corner') &&
        (e.player === pName || (e.player && (e.player.includes(pName) || pName.includes(e.player))))
      ).length;

      // Cálculo compuesto de rendimiento
      let impactScore = playerGoals * 12;
      if (role === 'DEL') impactScore += 1.5;
      else if (role === 'MC') impactScore += 1.2 + keyActions * 1.5;
      else if (role === 'DEF') impactScore += (side === 'home' && awayScore === 0 ? 3.5 : (side === 'away' && homeScore === 0 ? 3.5 : 0));
      else if (role === 'POR') impactScore += playerSaves * 2.5 + (side === 'home' && awayScore === 0 ? 4.5 : (side === 'away' && homeScore === 0 ? 4.5 : 0));

      // Ponderación de jerarquía futbolística (ratings como Messi 99, Ronaldo 97 desempatan con justicia)
      impactScore += baseRating * 0.05;

      candidates.push({
        player,
        name: pName,
        role,
        side,
        goals: playerGoals,
        saves: playerSaves,
        baseRating,
        impactScore
      });
    });
  }

  if (targetSide === 'away') {
    evaluatePool(awayPool, 'away');
  } else if (targetSide === 'home') {
    evaluatePool(homePool, 'home');
  } else {
    evaluatePool(homePool, 'home');
    evaluatePool(awayPool, 'away');
  }

  // Ordenar candidatos por puntuación de impacto de forma descendente
  candidates.sort((a, b) => b.impactScore - a.impactScore);

  let best = candidates[0];
  if (!best) {
    const fallbackPool = targetSide === 'away' ? awayPool : homePool;
    const fallbackPlayer = fallbackPool.find(p => p.role === 'DEL' || p.role === 'MC') || fallbackPool[0] || { name: 'Lionel Messi', role: 'DEL' };
    best = {
      player: fallbackPlayer,
      name: fallbackPlayer.name || 'Lionel Messi',
      role: fallbackPlayer.role || 'DEL',
      side: targetSide === 'away' ? 'away' : 'home',
      goals: targetSide === 'away' ? awayScore : homeScore,
      saves: 0,
      baseRating: 90,
      impactScore: 10
    };
  }

  const isRival = best.side === 'away';
  const teamName = isRival ? awayTeamName : homeTeamName;
  const isCleanSheet = isRival ? (homeScore === 0) : (awayScore === 0);

  // Calificación del MVP (escala 8.4 a 9.8)
  let ratingNum = 8.5;
  if (best.goals >= 2) ratingNum = 9.4;
  else if (best.goals === 1) ratingNum = 8.8;
  else if (best.role === 'POR' && isCleanSheet) ratingNum = 9.0;
  else if (isCleanSheet) ratingNum = 8.6;
  else ratingNum = Math.min(9.5, Math.max(8.2, 8.2 + (best.baseRating - 75) * 0.03));

  const ratingStr = ratingNum.toFixed(1);

  // Resumen uniforme idéntico para pop-up y pestaña de estadísticas
  let summary = '';
  if (best.goals > 0) {
    summary = `${best.goals} ${best.goals > 1 ? 'Goles anotados' : 'Gol anotado'} • 4 Regates exitosos`;
  } else if (best.role === 'POR') {
    summary = isCleanSheet ? 'Valla invicta y atajadas clave' : `${Math.max(1, best.saves)} Atajadas • Portería segura`;
  } else if (best.role === 'MC') {
    summary = 'Control del mediocampo y visión de juego';
  } else if (best.role === 'DEF') {
    summary = isCleanSheet ? 'Solidez defensiva y portería a cero' : 'Liderazgo y cortes defensivos';
  } else {
    summary = isRival ? 'Figura del triunfo rival' : 'Desmarque y presión ofensiva';
  }

  const avatarUrl = resolveMvpPlayerPhotoUrl(best.player, best.name);

  const officialMvp = {
    name: best.name,
    role: best.role,
    teamName,
    isRival,
    matchGoals: best.goals,
    savesCount: best.saves,
    cleanSheet: isCleanSheet,
    matchRating: Number(ratingStr),
    rating: Number(ratingStr),
    summary,
    stats: summary,
    photoUrl: avatarUrl,
    avatarUrl,
    initials: safeGetInitials(best.name)
  };

  match.officialMvp = officialMvp;
  if (match.saveOutcome) {
    match.saveOutcome.matchMvp = officialMvp;
  }

  return officialMvp;
}

function updateLiveStatsMvpCard(match, events, homeScore, awayScore, savesHome, savesAway, elapsedMinute) {
  const isPrevia = elapsedMinute === 0 || String(match?.status || '').includes('PREVIA') || String(match?.status || '').includes('CALENTAMIENTO');
  if (isPrevia) {
    const mvpCardEl = document.getElementById('stats-mvp-card');
    if (mvpCardEl) {
      mvpCardEl.classList.remove('stats-mvp-card--home', 'stats-mvp-card--away');
    }
    setElementText('stats-mvp-overline', 'Jugador del Partido');
    const teamBadgeEl = document.getElementById('stats-mvp-team-badge');
    if (teamBadgeEl) {
      teamBadgeEl.textContent = 'En espera';
      teamBadgeEl.className = 'stats-mvp-team-badge';
    }
    const avatarEl = document.getElementById('stats-mvp-avatar');
    if (avatarEl) {
      avatarEl.innerHTML = `<span style="font-size:22px; line-height: 48px; display: block; text-align: center;">⚽</span>`;
    }
    setElementText('stats-mvp-badge', 'Previa');
    setElementText('stats-mvp-name', 'Por definir');
    setElementText('stats-mvp-summary', 'Se determinará al comenzar el encuentro');
    setElementText('stats-mvp-rating', '-');
    return;
  }

  // Si el partido ya finalizó o estamos en el minuto 90, usamos el MVP oficial canónico
  const isFinished = elapsedMinute >= 90 || String(match?.status || '') === 'FINAL' || (!match?.isLive && !String(match?.status || '').includes('EN VIVO') && !String(match?.status || '').includes('DESCANSO'));

  if (isFinished) {
    const officialMvp = determineOfficialMatchMvp(match);
    const isHomeMvp = !officialMvp.isRival;

    const mvpCardEl = document.getElementById('stats-mvp-card');
    if (mvpCardEl) {
      mvpCardEl.classList.toggle('stats-mvp-card--home', isHomeMvp);
      mvpCardEl.classList.toggle('stats-mvp-card--away', !isHomeMvp);
    }

    setElementText(
      'stats-mvp-overline',
      isHomeMvp ? 'Jugador del Partido' : 'Jugador del Partido · Rival'
    );

    const teamBadgeEl = document.getElementById('stats-mvp-team-badge');
    if (teamBadgeEl) {
      teamBadgeEl.textContent = officialMvp.teamName;
      teamBadgeEl.className = `stats-mvp-team-badge ${isHomeMvp ? 'stats-mvp-team-badge--home' : 'stats-mvp-team-badge--away'}`;
    }

    const avatarEl = document.getElementById('stats-mvp-avatar');
    if (avatarEl) {
      avatarEl.innerHTML = `<img src="${officialMvp.photoUrl}" alt="${officialMvp.name}" class="stats-mvp-avatar__img" loading="lazy" />`;
      const imgEl = avatarEl.querySelector('img');
      if (imgEl) {
        imgEl.addEventListener('error', () => {
          avatarEl.textContent = officialMvp.initials;
        }, { once: true });
      }
    }

    setElementText('stats-mvp-badge', 'Final');
    setElementText('stats-mvp-name', officialMvp.name);
    setElementText('stats-mvp-summary', officialMvp.summary);
    setElementText('stats-mvp-rating', officialMvp.matchRating.toFixed(1));
    return;
  }

  const homeStarters = match?.lineups?.home || match?.lineups?.homeStarters || DEFAULT_MATCH_DATA.lineups.home;
  const awayStarters = match?.lineups?.away || match?.lineups?.awayStarters || DEFAULT_MATCH_DATA.lineups.away;
  const homeBench = match?.lineups?.homeBench || [];
  const awayBench = match?.lineups?.awayBench || [];

  // Contar goles y acciones destacadas por jugador en lo que va de partido
  const scorerMap = {};
  events.forEach((ev) => {
    if (!ev || ev.isPeriodBreak || !ev.player) return;
    if (ev.type === 'goal' || ev.type === 'penalty-goal') {
      if (!scorerMap[ev.player]) {
        scorerMap[ev.player] = { goals: 0, side: ev.side };
      }
      scorerMap[ev.player].goals += 1;
    }
  });

  let mvpName = '';
  let mvpGoals = 0;
  let mvpSide = homeScore >= awayScore ? 'home' : 'away';

  Object.entries(scorerMap).forEach(([player, info]) => {
    // Priorizar goleador del equipo que va ganando o el máximo goleador del encuentro
    const bonus = (info.side === 'home' && homeScore >= awayScore) || (info.side === 'away' && awayScore > homeScore) ? 0.25 : 0;
    if (info.goals + bonus > mvpGoals) {
      mvpGoals = info.goals;
      mvpName = player;
      mvpSide = info.side;
    }
  });

  let mvpPlayerObj = null;
  let mvpRole = 'DEL';
  const sidePool = mvpSide === 'home' ? [...homeStarters, ...homeBench] : [...awayStarters, ...awayBench];
  const allPlayers = [...homeStarters, ...homeBench, ...awayStarters, ...awayBench];

  if (!mvpName) {
    const star = sidePool.find((p) => p.role === 'DEL' || p.role === 'MC') || sidePool[0] || { name: 'L. Messi', role: 'DEL' };
    mvpPlayerObj = star;
    mvpName = star.name;
    mvpRole = star.role || 'DEL';
  } else {
    const found =
      sidePool.find((p) => p.name === mvpName || mvpName.includes(p.name) || p.name?.includes(mvpName)) ||
      allPlayers.find((p) => p.name === mvpName || mvpName.includes(p.name) || p.name?.includes(mvpName));
    if (found) {
      mvpPlayerObj = found;
      if (found.role) mvpRole = found.role;
    }
  }

  const dribblesOrPasses = Math.max(1, Math.round((elapsedMinute / 90) * 4));
  let mvpSummary = '';
  if (mvpGoals > 0) {
    mvpSummary = `${mvpGoals} ${mvpGoals > 1 ? 'Goles' : 'Gol'} • ${dribblesOrPasses} Regates exitosos`;
  } else if (mvpRole === 'POR') {
    const gkSaves = mvpSide === 'home' ? savesHome : savesAway;
    mvpSummary = `${Math.max(1, gkSaves)} Atajadas • Portería segura`;
  } else {
    mvpSummary = `${dribblesOrPasses} Pases clave • ${Math.max(1, dribblesOrPasses - 1)} Regates exitosos`;
  }

  const rawRating = Math.min(9.8, 7.3 + mvpGoals * 0.85 + (elapsedMinute / 90) * 0.6);
  const mvpRating = rawRating.toFixed(1);

  const isHomeMvp = mvpSide !== 'away';
  const homeTeamName = match?.homeTeam?.name || 'Tu Equipo';
  const awayTeamName = match?.awayTeam?.name || 'Equipo Rival';
  const mvpTeamLabel = isHomeMvp ? homeTeamName : awayTeamName;

  // Diferenciar visualmente la tarjeta según el equipo del MVP (Local vs Rival)
  const mvpCardEl = document.getElementById('stats-mvp-card');
  if (mvpCardEl) {
    mvpCardEl.classList.toggle('stats-mvp-card--home', isHomeMvp);
    mvpCardEl.classList.toggle('stats-mvp-card--away', !isHomeMvp);
  }

  setElementText(
    'stats-mvp-overline',
    isHomeMvp ? 'Jugador del Partido' : 'Jugador del Partido · Rival'
  );

  const teamBadgeEl = document.getElementById('stats-mvp-team-badge');
  if (teamBadgeEl) {
    teamBadgeEl.textContent = mvpTeamLabel;
    teamBadgeEl.className = `stats-mvp-team-badge ${isHomeMvp ? 'stats-mvp-team-badge--home' : 'stats-mvp-team-badge--away'}`;
  }

  // Renderizar la foto del jugador MVP dentro de #stats-mvp-avatar con fallback a iniciales
  const avatarEl = document.getElementById('stats-mvp-avatar');
  if (avatarEl) {
    const photoUrl = resolveMvpPlayerPhotoUrl(mvpPlayerObj, mvpName);
    const initials = safeGetInitials(mvpName);
    avatarEl.innerHTML = `<img src="${photoUrl}" alt="${mvpName}" class="stats-mvp-avatar__img" loading="lazy" />`;
    const imgEl = avatarEl.querySelector('img');
    if (imgEl) {
      imgEl.addEventListener('error', () => {
        avatarEl.textContent = initials;
      }, { once: true });
    }
  }

  const isLive = Boolean(match?.isLive || String(match?.status || '').includes('EN VIVO') || match?.status === 'DESCANSO');
  setElementText('stats-mvp-badge', isLive ? 'En Vivo' : 'Final');
  setElementText('stats-mvp-name', mvpName);
  setElementText('stats-mvp-summary', mvpSummary);
  setElementText('stats-mvp-rating', mvpRating);
}

function calculatePercentage(valA, valB) {
  const sum = Number(valA) + Number(valB);
  if (sum === 0) return 50;
  return Math.round((Number(valA) / sum) * 100);
}

export function renderLineups(lineups = {}, homeTeam = {}, awayTeam = {}) {
  const homeTitleEl = document.getElementById('lineup-home-title');
  if (homeTitleEl) {
    const formationSuffix = homeTeam.formation ? ` (${homeTeam.formation})` : '';
    homeTitleEl.textContent = `${homeTeam.name || 'Tu Equipo'}${formationSuffix}`;
  }

  const awayTitleEl = document.getElementById('lineup-away-title');
  if (awayTitleEl) {
    const formationSuffix = awayTeam.formation ? ` (${awayTeam.formation})` : '';
    awayTitleEl.textContent = `${awayTeam.name || 'Equipo Rival'}${formationSuffix}`;
  }

  const userPlayers = getUserSquad()?.players || DEFAULT_HOME_SQUAD.players;

  const homeStarters = (lineups.homeStarters && lineups.homeStarters.length > 0)
    ? lineups.homeStarters
    : (lineups.home && lineups.home.length > 0)
      ? lineups.home
      : userPlayers.slice(0, 6);

  const homeBench = (lineups.homeBench && lineups.homeBench.length > 0)
    ? lineups.homeBench
    : userPlayers.slice(6);

  const awayStarters = (lineups.awayStarters && lineups.awayStarters.length > 0)
    ? lineups.awayStarters
    : (lineups.away && lineups.away.length > 0)
      ? lineups.away
      : DEFAULT_AWAY_SQUAD.players.slice(0, 6);

  const awayBench = (lineups.awayBench && lineups.awayBench.length > 0)
    ? lineups.awayBench
    : DEFAULT_AWAY_SQUAD.players.slice(6);

  const homeListEl = document.getElementById('lineup-home-players');
  if (homeListEl) {
    let html = renderPlayerListItems(homeStarters);
    if (homeBench && homeBench.length > 0) {
      html += `
        <li class="lineup-section-divider">
          <span class="lineup-section-subtitle">Suplentes</span>
        </li>
        ${renderPlayerListItems(homeBench, true)}
      `;
    }
    homeListEl.innerHTML = html;
  }

  const awayListEl = document.getElementById('lineup-away-players');
  if (awayListEl) {
    let html = renderPlayerListItems(awayStarters);
    if (awayBench && awayBench.length > 0) {
      html += `
        <li class="lineup-section-divider">
          <span class="lineup-section-subtitle">Suplentes</span>
        </li>
        ${renderPlayerListItems(awayBench, true)}
      `;
    }
    awayListEl.innerHTML = html;
  }
}

function renderPlayerListItems(players = [], isBench = false) {
  const benchClass = isBench ? 'lineup-player-item--bench' : '';
  return (players || [])
    .filter(Boolean)
    .map(
      (p) => `
      <li class="lineup-player-item ${benchClass}">
        <span class="player-name">${p.name || p.nombre || 'Jugador'}</span>
        <span class="player-role">${p.role || p.assignedRole || p.posicion_base || p.posicion || 'MC'}</span>
      </li>
    `
    )
    .join('');
}

export function setupMatchTabs() {
  const tabs = document.querySelectorAll('.match-tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');

      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      panels.forEach((panel) => {
        if (panel.id === targetId) {
          panel.classList.add('is-active');
          panel.removeAttribute('hidden');
        } else {
          panel.classList.remove('is-active');
          panel.setAttribute('hidden', '');
        }
      });
    });
  });
}

/**
 * =============================================================================
 * CONTROL DEL PARTIDO EN VIVO (10 CICLOS DE 9 MIN) Y SIMULACIÓN RÁPIDA
 * =============================================================================
 */


/**
 * =============================================================================
 * CELEBRACIÓN DE GOL INTERACTIVA (Lottie gool.json)
 * =============================================================================
 */

let cachedGoalAnimationData = null;
let currentLottieGoalAnim = null;
let goalCelebrationTimeout = null;

async function loadGoalAnimationData() {
  if (cachedGoalAnimationData) return cachedGoalAnimationData;
  try {
    let res = await fetch('/src/assets/images/gool.json');
    if (!res.ok) {
      res = await fetch('/src/assets/images/Gool.json');
    }
    if (res.ok) {
      cachedGoalAnimationData = await res.json();
      return cachedGoalAnimationData;
    }
  } catch (e) {
    console.warn('[Match] No se pudo precargar gool.json:', e);
  }
  return null;
}

async function ensureLottieLibrary() {
  if (window.lottie) return window.lottie;
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = '/src/assets/libs/lottie.min.js';
    script.onload = () => resolve(window.lottie);
    script.onerror = () => {
      const cdnScript = document.createElement('script');
      cdnScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js';
      cdnScript.onload = () => resolve(window.lottie);
      cdnScript.onerror = () => resolve(null);
      document.head.appendChild(cdnScript);
    };
    document.head.appendChild(script);
  });
}

export function dismissGoalCelebration() {
  if (goalCelebrationTimeout) {
    clearTimeout(goalCelebrationTimeout);
    goalCelebrationTimeout = null;
  }
  const overlay = document.getElementById('goal-celebration-overlay');
  if (overlay) {
    overlay.classList.remove('is-active');
    overlay.setAttribute('hidden', '');
    overlay.setAttribute('aria-hidden', 'true');
  }
  if (currentLottieGoalAnim) {
    try { currentLottieGoalAnim.destroy(); } catch (e) {}
    currentLottieGoalAnim = null;
  }
}

export async function playGoalCelebration(goalInfo = {}) {
  const overlay = document.getElementById('goal-celebration-overlay');
  const container = document.getElementById('goal-lottie-container');
  const titleEl = document.getElementById('goal-celebration-title');
  const authorEl = document.getElementById('goal-celebration-author');

  if (!overlay || !container) return;

  const [lottieInstance, animData] = await Promise.all([
    ensureLottieLibrary(),
    loadGoalAnimationData()
  ]);

  if (!lottieInstance || !animData) return;

  // Actualizar rótulo y autor del gol
  if (titleEl) titleEl.textContent = '¡GOOOOOOOOL!';
  if (authorEl) {
    const scorerText = goalInfo.player ? `${goalInfo.player}` : '';
    const minuteText = goalInfo.minute ? `(${goalInfo.minute}')` : '';
    const teamText = goalInfo.team ? `· ${goalInfo.team}` : '';
    authorEl.textContent = [scorerText, minuteText, teamText].filter(Boolean).join(' ');
  }

  // Destruir animación anterior si hubiese
  if (currentLottieGoalAnim) {
    try { currentLottieGoalAnim.destroy(); } catch (e) {}
    currentLottieGoalAnim = null;
  }
  container.innerHTML = '';

  // Renderizar Lottie con el JSON oficial gool.json
  currentLottieGoalAnim = lottieInstance.loadAnimation({
    container: container,
    renderer: 'svg',
    loop: false,
    autoplay: true,
    animationData: animData
  });

  // Mostrar el overlay con animación de entrada suave
  overlay.removeAttribute('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  void overlay.offsetWidth; // Forzar reflow
  overlay.classList.add('is-active');

  // Permitir cierre anticipado al hacer clic en el overlay
  if (!overlay.hasAttribute('data-click-bound')) {
    overlay.setAttribute('data-click-bound', 'true');
    overlay.addEventListener('click', () => {
      dismissGoalCelebration();
    });
  }

  // Duración del JSON: 3000 ms (90 frames a 30fps) + 400 ms de transición suave
  const DURATION_MS = 2200;
  const FADE_OUT_MS = 300;

  return new Promise((resolve) => {
    if (goalCelebrationTimeout) clearTimeout(goalCelebrationTimeout);

    goalCelebrationTimeout = setTimeout(() => {
      overlay.classList.remove('is-active');

      goalCelebrationTimeout = setTimeout(() => {
        overlay.setAttribute('hidden', '');
        overlay.setAttribute('aria-hidden', 'true');
        if (currentLottieGoalAnim) {
          try { currentLottieGoalAnim.destroy(); } catch (e) {}
          currentLottieGoalAnim = null;
        }
        resolve();
      }, FADE_OUT_MS);
    }, DURATION_MS);
  });
}


function clearGlobalSimulationTimers() {
  dismissGoalCelebration();
  if (window.__fantasySimulationInterval) {
    clearInterval(window.__fantasySimulationInterval);
    window.__fantasySimulationInterval = null;
  }
  if (window.__fantasyHalftimeTimeout) {
    clearTimeout(window.__fantasyHalftimeTimeout);
    window.__fantasyHalftimeTimeout = null;
  }
  if (liveSimulationInterval) {
    clearInterval(liveSimulationInterval);
    liveSimulationInterval = null;
  }
  if (halftimeTimeout) {
    clearTimeout(halftimeTimeout);
    halftimeTimeout = null;
  }
  isMatchLive = false;
}

export async function startLiveMatchPlayback() {
  clearGlobalSimulationTimers();

  const appNav = document.getElementById('app-navigation');
  if (appNav) appNav.style.display = 'none';

  const liveBtn = document.getElementById('btn-live-sim');
  if (liveBtn) liveBtn.classList.add('is-running');

  // 1. Obtener la plantilla real del usuario y un rival CPU aleatorio de los equipos del sistema
  currentFullMatch = null;
  const homeSquad = getUserSquad() || DEFAULT_HOME_SQUAD;
  let awaySquad = null;
  try {
    const rawRival = sessionStorage.getItem('fantasy_selected_rival');
    if (rawRival) {
      awaySquad = JSON.parse(rawRival);
      sessionStorage.removeItem('fantasy_selected_rival');
    }
  } catch (e) {}
  if (!awaySquad) {
    awaySquad = getRandomCpuTeam() || DEFAULT_AWAY_SQUAD;
  }
  const homeName = homeSquad.name || homeSquad.team_name || 'Tu Equipo';
  const awayName = awaySquad.name || awaySquad.team_name || 'Equipo Rival';
  console.info(`[Match] Simulación en vivo contra rival: ${homeName} vs ${awayName} (Formación: ${awaySquad.formation || '1-2-2-1'})`);

  const homeStarters = (homeSquad.players || []).slice(0, 6).filter(Boolean);
  const homeBench = (homeSquad.players || []).slice(6).filter(Boolean);
  const awayStarters = (awaySquad.players || []).slice(0, 6).filter(Boolean);
  const awayBench = (awaySquad.players || []).slice(6).filter(Boolean);

  // Renderizar de inmediato 0-0 y los nombres reales para evitar parpadeos con valores anteriores
  renderMatchDetails({
    status: 'PREVIA',
    isLive: false,
    homeTeam: { name: homeName, score: 0, formation: homeSquad.formation || '1-2-2-1' },
    awayTeam: { name: awayName, score: 0, formation: awaySquad.formation || '1-2-2-1' },
    liveAction: { team: homeName, status: 'CALENTAMIENTO' },
    events: [],
    stats: {
      possession: { home: 50, away: 50, label: 'Posesión' },
      shots: { home: 0, away: 0, label: 'Tiros a Puerta' },
      fouls: { home: 0, away: 0, label: 'Faltas' }
    },
    lineups: {
      homeStarters,
      homeBench,
      awayStarters,
      awayBench,
      home: homeStarters,
      away: awayStarters
    }
  });

  // 2. Simulación (Backend con fallback local offline)
  try {
    currentFullMatch = await matchService.simulateMatch(homeSquad, awaySquad);
  } catch (err) {
    console.warn('[Match] Error simulando con matchService, fallback local:', err);
    currentFullMatch = simulateMatchEngine(homeSquad, awaySquad);
  }

  if (!currentFullMatch) {
    currentFullMatch = simulateMatchEngine(homeSquad, awaySquad);
  }
  window.__fantasyCurrentFullMatch = currentFullMatch;
  const snapshots = currentFullMatch.cycleSnapshots || [];
  let activeSnapshotIndex = -1;
  currentSimulatedMinute = 1;
  isMatchLive = true;
  updateHeaderActionButton(false);

  // Estado inicial en el minuto 1 (con hito inicial en cronología)
  renderMatchDetails({
    status: "EN VIVO 1'",
    isLive: true,
    homeTeam: { name: homeName, score: 0, formation: homeSquad.formation || '1-2-2-1' },
    awayTeam: { name: awayName, score: 0, formation: awaySquad.formation || '1-2-2-1' },
    liveAction: { team: homeName, status: '¡PITIDO INICIAL! RUEDA EL BALÓN' },
    events: [{ minute: 0, isPeriodBreak: true, label: 'INICIO DEL PARTIDO' }],
    stats: {
      possession: { home: 50, away: 50, label: 'Posesión' },
      shots: { home: 0, away: 0, label: 'Tiros a Puerta' },
      fouls: { home: 0, away: 0, label: 'Faltas' }
    },
    lineups: currentFullMatch.lineups
  });

  const TICK_MS = 150; // Timing acelerado (~150ms por minuto simulado)

  function triggerHalftimePause() {
    // Detener temporalmente el reloj para el descanso
    if (liveSimulationInterval) {
      clearInterval(liveSimulationInterval);
      liveSimulationInterval = null;
      window.__fantasySimulationInterval = null;
    }

    const statusTextEl = document.getElementById('match-status-text');
    if (statusTextEl) statusTextEl.textContent = 'DESCANSO';
    const statusDot = document.getElementById('status-dot');
    if (statusDot) statusDot.classList.remove('is-live');

    // Pausa táctica de entretiempo (1.1 segundos) antes de reanudar el segundo tiempo
    halftimeTimeout = setTimeout(() => {
      if (!isMatchLive) return;
      currentSimulatedMinute = 45; // El siguiente tick avanzará a 46'
      if (statusDot) statusDot.classList.add('is-live');
      liveSimulationInterval = setInterval(runSimulationTick, TICK_MS);
      window.__fantasySimulationInterval = liveSimulationInterval;
    }, 1100);
    window.__fantasyHalftimeTimeout = halftimeTimeout;
  }

  function runSimulationTick() {
    if (!isMatchLive) return;

    currentSimulatedMinute++;

    // 1. Caso: Descanso al minuto 45
    if (currentSimulatedMinute === 45) {
      // Aplicar el snapshot correspondiente al descanso (ciclo 10)
      while (
        activeSnapshotIndex + 1 < snapshots.length &&
        snapshots[activeSnapshotIndex + 1].minute <= 45
      ) {
        activeSnapshotIndex++;
        const step = snapshots[activeSnapshotIndex];
        if (step.hasGoalThisCycle) triggerScoreBump();
        renderMatchDetails({
          status: 'DESCANSO',
          isLive: false,
          homeTeam: { name: homeName, score: step.homeScore, formation: homeSquad.formation },
          awayTeam: { name: awayName, score: step.awayScore, formation: awaySquad.formation },
          liveAction: step.liveAction,
          events: step.events,
          stats: step.stats,
          lineups: currentFullMatch.lineups
        });
      }

      triggerHalftimePause();
      return;
    }

    // 2. Caso: Fin del partido al minuto 90
    if (currentSimulatedMinute >= 90) {
      // Aplicar todos los snapshots restantes hasta el final
      while (activeSnapshotIndex + 1 < snapshots.length) {
        activeSnapshotIndex++;
        const step = snapshots[activeSnapshotIndex];
        if (step.hasGoalThisCycle) triggerScoreBump();
        renderMatchDetails({
          status: 'FINAL',
          isLive: false,
          homeTeam: { name: homeName, score: step.homeScore, formation: homeSquad.formation },
          awayTeam: { name: awayName, score: step.awayScore, formation: awaySquad.formation },
          liveAction: step.liveAction,
          events: step.events,
          stats: step.stats,
          lineups: currentFullMatch.lineups
        });
      }

      const statusTextEl = document.getElementById('match-status-text');
      if (statusTextEl) statusTextEl.textContent = 'FINAL';
      const statusDot = document.getElementById('status-dot');
      if (statusDot) statusDot.classList.remove('is-live');

      finishLiveMatch();
      return;
    }

    // 3. Minuto a minuto acelerado regular (1..44 y 46..89)
    let appliedNewSnapshot = false;
    while (
      activeSnapshotIndex + 1 < snapshots.length &&
      snapshots[activeSnapshotIndex + 1].minute <= currentSimulatedMinute
    ) {
      activeSnapshotIndex++;
      appliedNewSnapshot = true;
      const step = snapshots[activeSnapshotIndex];

      renderMatchDetails({
        status: `EN VIVO ${currentSimulatedMinute}'`,
        isLive: true,
        homeTeam: { name: homeName, score: step.homeScore, formation: homeSquad.formation },
        awayTeam: { name: awayName, score: step.awayScore, formation: awaySquad.formation },
        liveAction: step.liveAction,
        events: step.events,
        stats: step.stats,
        lineups: currentFullMatch.lineups
      });

      if (step.hasGoalThisCycle) {
        triggerScoreBump();

        // Extraer autor y equipo del gol para la celebración (evento más reciente al frente)
        const goalEvent = (step.events || []).find(e =>
          (e.type === 'goal' || e.type === 'penalty-goal') &&
          (e.minute === step.minute || Math.abs((e.minute || 0) - currentSimulatedMinute) <= 5)
        ) || (step.events || []).find(e => e.type === 'goal' || e.type === 'penalty-goal');

        const goalInfo = {
          player: goalEvent?.player || '',
          team: goalEvent?.side === 'home' ? homeName : (goalEvent?.side === 'away' ? awayName : ''),
          minute: goalEvent?.minute || step.minute || currentSimulatedMinute
        };

        // Disparar celebración de gol interactiva en paralelo sin detener el avance del partido
        playGoalCelebration(goalInfo);
      }
    }

    // Si este minuto no coincidió con un snapshot, avanzar el contador minuto a minuto en el badge
    if (!appliedNewSnapshot) {
      const statusTextEl = document.getElementById('match-status-text');
      if (statusTextEl) {
        statusTextEl.textContent = `EN VIVO ${currentSimulatedMinute}'`;
      }
      const statusDot = document.getElementById('status-dot');
      if (statusDot) statusDot.classList.add('is-live');
    }
  }

  liveSimulationInterval = setInterval(runSimulationTick, TICK_MS);
  window.__fantasySimulationInterval = liveSimulationInterval;
}

function triggerScoreBump() {
  const homeScoreEl = document.getElementById('home-score');
  const awayScoreEl = document.getElementById('away-score');
  if (homeScoreEl) {
    homeScoreEl.classList.add('is-bumped');
    setTimeout(() => homeScoreEl.classList.remove('is-bumped'), 500);
  }
  if (awayScoreEl) {
    awayScoreEl.classList.add('is-bumped');
    setTimeout(() => awayScoreEl.classList.remove('is-bumped'), 500);
  }
}

function finishLiveMatch() {
  clearGlobalSimulationTimers();

  const liveBtn = document.getElementById('btn-live-sim');
  if (liveBtn) liveBtn.classList.remove('is-running');

  const statusTextEl = document.getElementById('match-status-text');
  if (statusTextEl) statusTextEl.textContent = 'FINAL';
  const statusDot = document.getElementById('status-dot');
  if (statusDot) statusDot.classList.remove('is-live');
  updateHeaderActionButton(true);

  if (currentFullMatch) {
    if (!currentFullMatch.saveOutcome) {
      currentFullMatch.saveOutcome = matchService.saveMatchResult(currentFullMatch);
    }
    renderMatchDetails(currentFullMatch);
    setTimeout(() => {
      showMatchResultModal(currentFullMatch);
    }, 1200);
  }
}

/**
 * SIMULACIÓN RÁPIDA: Salto inmediato al minuto 90.
 */
export async function executeQuickSimulation() {
  console.debug('[Match] Simulación Rápida: Resolviendo al instante...');
  clearGlobalSimulationTimers();

  // 1. Obtener valores visibles actuales del marcador en pantalla
  const homeScoreEl = document.getElementById('home-score');
  const awayScoreEl = document.getElementById('away-score');
  const domHome = homeScoreEl ? (parseInt(homeScoreEl.textContent, 10) || 0) : 0;
  const domAway = awayScoreEl ? (parseInt(awayScoreEl.textContent, 10) || 0) : 0;

  // 2. Recuperar el partido activo (local o global de window)
  if (!currentFullMatch && window.__fantasyCurrentFullMatch) {
    currentFullMatch = window.__fantasyCurrentFullMatch;
  }

  if (!currentFullMatch) {
    const homeSquad = getUserSquad();
    let awaySquad = null;
    try {
      const rawRival = sessionStorage.getItem('fantasy_selected_rival');
      if (rawRival) awaySquad = JSON.parse(rawRival);
    } catch (e) {}
    if (!awaySquad) awaySquad = getRandomCpuTeam() || DEFAULT_AWAY_SQUAD;
    currentFullMatch = await matchService.simulateMatch(homeSquad, awaySquad);
    window.__fantasyCurrentFullMatch = currentFullMatch;
  }

  // 3. Respetar el marcador en desarrollo como piso mínimo
  if (currentFullMatch.homeTeam) {
    currentFullMatch.homeTeam.score = Math.max(currentFullMatch.homeTeam.score ?? 0, domHome);
  }
  if (currentFullMatch.awayTeam) {
    currentFullMatch.awayTeam.score = Math.max(currentFullMatch.awayTeam.score ?? 0, domAway);
  }

  // 4. Si existen snapshots, sincronizar el último snapshot con el resultado final
  const snapshots = currentFullMatch.cycleSnapshots || [];
  if (snapshots.length > 0) {
    const lastSnap = snapshots[snapshots.length - 1];
    lastSnap.homeScore = currentFullMatch.homeTeam.score;
    lastSnap.awayScore = currentFullMatch.awayTeam.score;
    currentFullMatch.events = lastSnap.events || currentFullMatch.events;
    currentFullMatch.stats = lastSnap.stats || currentFullMatch.stats;
  }

  currentFullMatch.status = 'FINAL';
  currentFullMatch.isLive = false;

  const statusTextEl = document.getElementById('match-status-text');
  if (statusTextEl) statusTextEl.textContent = 'FINAL';
  const statusDot = document.getElementById('status-dot');
  if (statusDot) statusDot.classList.remove('is-live');
  updateHeaderActionButton(true);

  if (!currentFullMatch.saveOutcome) {
    currentFullMatch.saveOutcome = matchService.saveMatchResult(currentFullMatch);
  }

  renderMatchDetails(currentFullMatch);
  showMatchResultModal(currentFullMatch);
}


function safeGetInitials(name = '') {
  if (typeof getInitials === 'function') {
    try { return getInitials(name); } catch (_) {}
  }
  if (!name) return 'LM';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function showMatchResultModal(match) {
  try {
  const homeScore = match.homeTeam?.score ?? 0;
  const awayScore = match.awayTeam?.score ?? 0;
  const isWin = homeScore > awayScore;
  const isLoss = homeScore < awayScore;
  const isDraw = homeScore === awayScore;

  const resultType = isWin ? 'VICTORIA' : (isDraw ? 'EMPATE' : 'DERROTA');
  const fallbackPoints = isWin ? '+25 Puntos' : (isDraw ? '+5 Puntos' : '-15 Puntos');

  const saveOutcome = match.saveOutcome || matchService.saveMatchResult(match);
  match.saveOutcome = saveOutcome;

  let matchMvp = saveOutcome?.matchMvp;
  const awayTeamName = match.awayTeam?.name || 'Equipo Rival';
  const homeTeamName = match.homeTeam?.name || 'Tu Equipo';

  // OBTENER LA FIGURA DEL ENCUENTRO OFICIAL (100% UNIFICADA CON LA PESTAÑA DE ESTADÍSTICAS)
  const officialMvp = determineOfficialMatchMvp(match);

  const isRivalMvp = Boolean(officialMvp?.isRival);
  const mvpName = officialMvp?.name || (isRivalMvp ? awayTeamName : 'Messi');
  const mvpRating = officialMvp?.matchRating || (isWin ? 9.2 : (isLoss ? 8.8 : 8.0));
  const mvpTeamName = officialMvp?.teamName || (isRivalMvp ? awayTeamName : homeTeamName);
  const mvpAvatarUrl = officialMvp?.avatarUrl || resolveMvpPlayerPhotoUrl(null, mvpName);
  const mvpStats = officialMvp?.summary || officialMvp?.stats || 'Rendimiento destacado';

  let pointsText;
  if (saveOutcome && typeof saveOutcome.pointsGained === 'number') {
    if (saveOutcome.pointsGained > 0) pointsText = `+${saveOutcome.pointsGained} Puntos`;
    else if (saveOutcome.pointsGained < 0) pointsText = `${saveOutcome.pointsGained} Puntos`;
    else pointsText = `0 Puntos`;
  } else {
    pointsText = fallbackPoints;
  }
  const rankText = saveOutcome?.currentStats?.ranking ? `#${saveOutcome.currentStats.ranking}` : (isWin ? '#428' : '#430');

  openMatchResultModal(
    {
      homeTeam: homeTeamName,
      awayTeam: awayTeamName,
      homeScore,
      awayScore,
      resultType,
      mvp: {
        name: mvpName,
        teamName: mvpTeamName,
        initials: safeGetInitials(mvpName),
        avatarUrl: mvpAvatarUrl,
        stats: mvpStats,
        rating: mvpRating,
        isRival: isRivalMvp
      },
      ranking: {
        pointsGained: pointsText,
        currentRank: rankText
      }
    },
    {
      onNextMatch: () => {
        clearGlobalSimulationTimers();
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate('/matchmaking');
        } else {
          window.location.hash = '/matchmaking';
        }
      },
      onGoHome: () => {
        if (window.router && window.router.navigate) window.router.navigate('/dashboard'); else window.location.href = '/dashboard';
      }
    }
  );
  } catch (modalError) {
    console.error('[Match] Error procesando showMatchResultModal:', modalError);
    // Modal de rescate asegurado para garantizar visualización
    const homeScore = match?.homeTeam?.score ?? 0;
    const awayScore = match?.awayTeam?.score ?? 0;
    const isWin = homeScore > awayScore;
    const isLoss = homeScore < awayScore;
    openMatchResultModal({
      homeTeam: match?.homeTeam?.name || 'Tu Equipo',
      awayTeam: match?.awayTeam?.name || 'Equipo Rival',
      homeScore,
      awayScore,
      resultType: isWin ? 'VICTORIA' : (isLoss ? 'DERROTA' : 'EMPATE'),
      mvp: {
        name: isLoss ? (match?.awayTeam?.name || 'Rival') : 'Messi',
        teamName: isLoss ? (match?.awayTeam?.name || 'Rival') : 'Tu Equipo',
        initials: isLoss ? 'RV' : 'ME',
        avatarUrl: resolveMvpPlayerPhotoUrl(null, isLoss ? 'Pelé' : 'Messi'),
        stats: 'Figura del partido',
        rating: 9.0,
        isRival: isLoss
      },
      ranking: {
        pointsGained: isWin ? '+25 Puntos' : (isLoss ? '-15 Puntos' : '+5 Puntos'),
        currentRank: '#430'
      }
    }, {
      onNextMatch: () => {
        clearGlobalSimulationTimers();
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate('/matchmaking');
        } else {
          window.location.hash = '/matchmaking';
        }
      },
      onGoHome: () => {
        if (window.router && window.router.navigate) window.router.navigate('/dashboard'); else window.location.href = '/dashboard';
      }
    });
  }
}

export function formatHistoryMatchToDetail(item = {}) {
  const homeName =
    (typeof item.homeTeam === 'object' ? item.homeTeam?.name : item.homeTeam) ||
    item.home_team_name ||
    'Tu Equipo';
  const awayName =
    (typeof item.awayTeam === 'object' ? item.awayTeam?.name : item.awayTeam) ||
    item.opponent ||
    item.rival ||
    item.away_team_name ||
    'Equipo Rival';

  const homeScore =
    item.homeScore ??
    item.home_score ??
    (typeof item.homeTeam === 'object' ? item.homeTeam?.score : undefined) ??
    0;
  const awayScore =
    item.awayScore ??
    item.away_score ??
    (typeof item.awayTeam === 'object' ? item.awayTeam?.score : undefined) ??
    0;

  let points = item.points ?? item.points_obtained ?? item.puntos;
  let resultType = item.resultType;
  if (!resultType) {
    if (homeScore > awayScore) resultType = 'win';
    else if (homeScore < awayScore) resultType = 'loss';
    else resultType = 'draw';
  }
  if (points === undefined || points === null) {
    points = resultType === 'win' ? 25 : resultType === 'draw' ? 5 : -15;
  }

  let events = Array.isArray(item.events) && item.events.length > 0 ? item.events : [];
  if (events.length === 0) {
    const generated = [];
    const homePlayers = ['Z. Zidane', 'L. Messi', 'P. Maldini', 'Xavi', 'Ronaldo'];
    const awayPlayers = ['R. Nazário', 'Pelé', 'M. Platini', 'L. Figo', 'R. Carlos'];
    for (let i = 0; i < homeScore; i++) {
      generated.push({
        minute: Math.min(88, 14 + i * 28),
        side: 'home',
        type: 'goal',
        player: homePlayers[i % homePlayers.length],
        detail: '(Gol)'
      });
    }
    for (let j = 0; j < awayScore; j++) {
      generated.push({
        minute: Math.min(89, 24 + j * 25),
        side: 'away',
        type: 'goal',
        player: awayPlayers[j % awayPlayers.length],
        detail: '(Gol)'
      });
    }
    generated.push({
      minute: 44,
      side: 'home',
      type: 'yellow-card',
      player: 'P. Maldini',
      detail: '(Tarjeta Amarilla)'
    });
    events = generated.sort((a, b) => b.minute - a.minute);
  }

  return {
    id: item.id || 1,
    status: 'FINAL',
    isLive: false,
    points,
    resultType,
    relativeDate: item.relativeDate || item.fecha || 'Reciente',
    homeTeam: {
      name: homeName,
      score: homeScore,
      formation: (typeof item.homeTeam === 'object' && item.homeTeam?.formation) || '1-2-2-1'
    },
    awayTeam: {
      name: awayName,
      score: awayScore,
      formation: (typeof item.awayTeam === 'object' && item.awayTeam?.formation) || '1-1-3-1'
    },
    liveAction: {
      team: homeScore >= awayScore ? homeName : awayName,
      status: 'FINAL DEL PARTIDO'
    },
    events,
    stats: item.stats && Object.keys(item.stats).length > 0 ? item.stats : DEFAULT_MATCH_DATA.stats,
    lineups: item.lineups && Object.keys(item.lineups).length > 0 ? item.lineups : DEFAULT_MATCH_DATA.lineups
  };
}

export async function fetchMatchDetail(matchId) {
  const idStr = String(matchId);

  // 1. Buscar en el historial persistido en localStorage
  try {
    const localHistory = JSON.parse(localStorage.getItem('fantasy_match_history') || '[]');
    const found = localHistory.find(m => String(m.id) === idStr);
    if (found) {
      console.info(`[Match] Partido #${matchId} encontrado en localStorage:`, found);
      return formatHistoryMatchToDetail(found);
    }
  } catch (err) {
    console.warn('[Match] Error buscando partido en historial local:', err);
  }

  // 2. Buscar en el listado por defecto de historial
  try {
    const { DEFAULT_HISTORY_MATCHES } = await import('../history/history.js');
    if (Array.isArray(DEFAULT_HISTORY_MATCHES)) {
      const defaultFound = DEFAULT_HISTORY_MATCHES.find(m => String(m.id) === idStr);
      if (defaultFound) {
        console.info(`[Match] Partido #${matchId} encontrado en DEFAULT_HISTORY_MATCHES:`, defaultFound);
        return formatHistoryMatchToDetail(defaultFound);
      }
    }
  } catch (e) {
    console.debug('[Match] No se pudo cargar DEFAULT_HISTORY_MATCHES dinámicamente:', e);
  }

  // 3. Fallback al partido inicial por defecto
  return DEFAULT_MATCH_DATA;
}

/**
 * Inicialización al cargar la página
 */
export async function initMatchDetailView() {
  const appNav = document.getElementById('app-navigation');
  if (appNav) appNav.style.display = 'none';

  const appContent = document.getElementById('app-content');
  if (appContent) {
    appContent.scrollTop = 0;
  }
  window.scrollTo(0, 0);

  activeStatFilter = 'general';
  setupMatchTabs();
  setupStatsCategoryFilters();

  // Validar requisitos reglamentarios de plantilla completa (6 titulares y 4 suplentes)
  const userSquad = getUserSquad();
  const starters = userSquad?.players?.slice(0, 6)?.filter(Boolean) || [];
  const reserves = userSquad?.players?.slice(6, 10)?.filter(Boolean) || [];
  if (starters.length < 6 || reserves.length < 4) {
    console.warn('[Match] Requisitos reglamentarios no cumplidos (6 titulares y 4 suplentes). Redirigiendo a Dashboard...');
    if (window.router && typeof window.router.navigate === 'function') {
      window.router.navigate('/dashboard');
    } else {
      window.location.hash = '#/dashboard';
    }
    return;
  }

  // Configurar botón volver para retornar al home del juego (/dashboard) y pausar simulación
  const backBtn = document.getElementById('btn-back');
  if (backBtn && !backBtn.hasAttribute('data-bound')) {
    backBtn.setAttribute('data-bound', 'true');
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      clearGlobalSimulationTimers();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/dashboard');
      } else {
        window.location.hash = '/dashboard';
      }
    });
  }

  const hashQuery = window.location.hash.includes('?') ? window.location.hash.split('?')[1] : '';
  const hashParams = new URLSearchParams(hashQuery);
  const searchParams = new URLSearchParams(window.location.search);
  const currentHashRoute = window.location.hash.split('?')[0].replace('#', '');

  const matchId = searchParams.get('id') || hashParams.get('id');
  const hasAutoplayParam = searchParams.get('autoplay') === 'true' || hashParams.get('autoplay') === 'true';
  const hasAutoplaySession = sessionStorage.getItem('fantasy_match_autoplay') === 'true';
  const isLiveMatchRoute = currentHashRoute === '/match/live' || currentHashRoute === '/match';

  // Si viene desde "BUSCAR RIVAL", con parámetro autoplay, o accediendo a /match/live sin un ID previo:
  const shouldStartLive = hasAutoplayParam || hasAutoplaySession || (isLiveMatchRoute && !matchId);
  sessionStorage.removeItem('fantasy_match_autoplay');

  if (shouldStartLive) {
    console.info('[Match] Autoplay activado: Iniciando simulación en directo contra equipo rival de la CPU...');
    startLiveMatchPlayback();
  } else {
    console.info(`[Match] Cargando detalles del partido ID: ${matchId}`);
    const matchData = await fetchMatchDetail(matchId || 1);
    renderMatchDetails(matchData);
  }

  const quickSimBtn = document.getElementById('btn-quick-sim');
  if (quickSimBtn && !quickSimBtn.hasAttribute('data-bound')) {
    quickSimBtn.setAttribute('data-bound', 'true');
    quickSimBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const statusText = document.getElementById('match-status-text')?.textContent || '';
      const isFinished = !isMatchLive && (
        statusText === 'FINAL' ||
        quickSimBtn.getAttribute('data-mode') === 'search-rival'
      );

      if (isFinished) {
        clearGlobalSimulationTimers();
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate('/matchmaking');
        } else {
          window.location.hash = '/matchmaking';
        }
      } else {
        executeQuickSimulation();
      }
    });
  }

  // El botón btn-live-sim fue retirado por diseño simplificado de la cabecera

  const statusBadge = document.getElementById('match-status-badge');
  if (statusBadge && !statusBadge.hasAttribute('data-bound')) {
    statusBadge.setAttribute('data-bound', 'true');
    statusBadge.addEventListener('click', () => {
      if (!isMatchLive) {
        startLiveMatchPlayback();
      } else {
        executeQuickSimulation();
      }
    });
  }
}

// En entorno SPA, la inicialización es gobernada por router.js al inyectar live-match.html

export const initMatch = initMatchDetailView;
export function startMatchSimulation(matchData = DEFAULT_MATCH_DATA) { renderMatchDetails(matchData); }
