/**
 * @file match-detail.js
 * @description Controlador modular y data-driven para la pantalla de Detalles de Partido (Partido en Directo).
 * Sincronizado con formaciones reales de usuario, modal de resultados y flujo con "Buscar Rival" (autoplay).
 */

import { openMatchResultModal } from '../../components/modal/modal.js';
import { simulateMatchEngine, FORMATIONS_6V6 } from '../../domain/simulation-engine.js';
import { getRandomCpuTeam } from '../../domain/cpu-teams.js';
import { matchService } from '../../services/match-service.js';

export const DEFAULT_HOME_SQUAD = {
  name: 'Tu Equipo',
  formation: '1-2-2-1',
  players: [
    { name: 'Casillas', role: 'POR', rating_general: 89, rating_fisico: 82, rating_palmares: 88, rating_defensa: 30, rating_creacion: 20, rating_tecnica: 40, rating_ataque: 10 },
    { name: 'Maldini', role: 'DEF', rating_defensa: 92, rating_fisico: 85, rating_palmares: 92, rating_creacion: 70, rating_tecnica: 78, rating_ataque: 40 },
    { name: 'Baresi', role: 'DEF', rating_defensa: 93, rating_fisico: 79, rating_palmares: 90, rating_creacion: 68, rating_tecnica: 75, rating_ataque: 35 },
    { name: 'Zidane', role: 'MC', rating_creacion: 96, rating_tecnica: 98, rating_fisico: 83, rating_palmares: 95, rating_ataque: 88, rating_defensa: 65 },
    { name: 'Xavi', role: 'MC', rating_creacion: 97, rating_tecnica: 95, rating_fisico: 76, rating_palmares: 94, rating_ataque: 78, rating_defensa: 68 },
    { name: 'Messi', role: 'DEL', rating_ataque: 99, rating_tecnica: 99, rating_creacion: 95, rating_fisico: 80, rating_palmares: 99, rating_defensa: 35 },
    // 3 Suplentes reglamentarios
    { name: 'Ronaldo', role: 'DEL', rating_ataque: 97, rating_tecnica: 95, rating_fisico: 86, rating_palmares: 91, rating_defensa: 30, rating_creacion: 75 },
    { name: 'Iniesta', role: 'MC', rating_creacion: 94, rating_tecnica: 96, rating_fisico: 85, rating_palmares: 93, rating_ataque: 82, rating_defensa: 60 },
    { name: 'Puyol', role: 'DEF', rating_defensa: 90, rating_fisico: 88, rating_palmares: 89, rating_ataque: 30, rating_creacion: 50, rating_tecnica: 60 }
  ]
};

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
    // 3 Suplentes reglamentarios
    { name: 'Henry', role: 'DEL', rating_ataque: 94, rating_tecnica: 92, rating_fisico: 87, rating_palmares: 88, rating_defensa: 35, rating_creacion: 78 },
    { name: 'Rivaldo', role: 'DEL', rating_ataque: 93, rating_tecnica: 93, rating_fisico: 80, rating_palmares: 90, rating_defensa: 30, rating_creacion: 85 },
    { name: 'Roberto Carlos', role: 'DEF', rating_defensa: 86, rating_fisico: 92, rating_palmares: 88, rating_ataque: 80, rating_creacion: 75, rating_tecnica: 82 }
  ]
};

export const DEFAULT_MATCH_DATA = {
  id: 1,
  status: 'FINAL',
  homeTeam: { id: 101, name: 'Tu Equipo', score: 2, formation: '1-2-2-1' },
  awayTeam: { id: 102, name: 'Equipo Rival', score: 1, formation: '1-1-3-1' },
  liveAction: { team: 'Tu Equipo', status: 'ATAQUE PELIGROSO' },
  events: [
    { minute: 72, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
    { minute: 64, side: 'away', type: 'red-card', player: 'P. Maldini', detail: '(Tarjeta Roja)' },
    { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
    { minute: 28, side: 'away', type: 'goal', player: 'Pelé', detail: '(Gol)' },
    { minute: 15, side: 'home', type: 'goal', player: 'Z. Zidane', detail: '(Gol)' }
  ],
  stats: {
    possession: { home: 55, away: 45, label: 'Posesión' },
    shots: { home: 7, away: 4, label: 'Tiros a Puerta' },
    fouls: { home: 12, away: 8, label: 'Faltas' }
  },
  lineups: {
    home: [
      { name: 'Messi', role: 'DEL' },
      { name: 'Zidane', role: 'MC' },
      { name: 'Maldini', role: 'DEF' },
      { name: 'Xavi', role: 'MC' },
      { name: 'Ronaldo', role: 'DEL' },
      { name: 'Casillas', role: 'POR' }
    ],
    away: [
      { name: 'Beckenbauer', role: 'DEF' },
      { name: 'Maradona', role: 'MC' },
      { name: 'Rivaldo', role: 'DEL' },
      { name: 'Iniesta', role: 'MC' },
      { name: 'Henry', role: 'DEL' },
      { name: 'Buffon', role: 'POR' }
    ]
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
      if (parsed && Array.isArray(parsed.players) && parsed.players.length >= 6) {
        return {
          name: parsed.name || 'Tu Equipo',
          formation: parsed.formation || '1-2-2-1',
          players: parsed.players
        };
      }
    }
  } catch (err) {
    console.debug('[Match] Usando plantilla por defecto:', err.message);
  }
  return DEFAULT_HOME_SQUAD;
}

/**
 * Renderizado reactivo en el DOM.
 */
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
  renderStats(match.stats);
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

export function renderStats(stats = {}) {
  const container = document.getElementById('match-stats-list');
  if (!container || !stats) return;

  const entries = [
    {
      key: 'possession',
      label: 'Posesión',
      homeText: `${stats.possession?.home || 50}%`,
      awayText: `${stats.possession?.away || 50}%`,
      homePercent: stats.possession?.home || 50
    },
    {
      key: 'shots',
      label: 'Tiros a Puerta',
      homeText: `${stats.shots?.home ?? 0}`,
      awayText: `${stats.shots?.away ?? 0}`,
      homePercent: calculatePercentage(stats.shots?.home || 0, stats.shots?.away || 0)
    },
    {
      key: 'fouls',
      label: 'Faltas',
      homeText: `${stats.fouls?.home ?? 0}`,
      awayText: `${stats.fouls?.away ?? 0}`,
      homePercent: calculatePercentage(stats.fouls?.home || 0, stats.fouls?.away || 0)
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
          <div class="comparative-bar-fill--home" style="width: ${item.homePercent}%;"></div>
        </div>
      </div>
    `
    )
    .join('');
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

  const homeStarters = lineups.homeStarters || lineups.home || [];
  const homeBench = lineups.homeBench || (DEFAULT_HOME_SQUAD.players ? DEFAULT_HOME_SQUAD.players.slice(6, 9) : []);

  const homeListEl = document.getElementById('lineup-home-players');
  if (homeListEl) {
    let html = renderPlayerListItems(homeStarters);
    if (homeBench.length > 0) {
      html += `
        <li class="lineup-section-divider">
          <span class="lineup-section-subtitle">Suplentes</span>
        </li>
        ${renderPlayerListItems(homeBench, true)}
      `;
    }
    homeListEl.innerHTML = html;
  }

  const awayStarters = lineups.awayStarters || lineups.away || [];
  const awayBench = lineups.awayBench || (DEFAULT_AWAY_SQUAD.players ? DEFAULT_AWAY_SQUAD.players.slice(6, 9) : []);

  const awayListEl = document.getElementById('lineup-away-players');
  if (awayListEl) {
    let html = renderPlayerListItems(awayStarters);
    if (awayBench.length > 0) {
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
  return players
    .map(
      (p) => `
      <li class="lineup-player-item ${benchClass}">
        <span class="player-name">${p.name}</span>
        <span class="player-role">${p.role || p.posicion_base || 'MC'}</span>
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

export async function startLiveMatchPlayback() {
  if (liveSimulationInterval) {
    clearInterval(liveSimulationInterval);
    liveSimulationInterval = null;
  }
  if (halftimeTimeout) {
    clearTimeout(halftimeTimeout);
    halftimeTimeout = null;
  }

  const liveBtn = document.getElementById('btn-live-sim');
  if (liveBtn) liveBtn.classList.add('is-running');

  // 1. Obtener la plantilla real del usuario y un rival CPU aleatorio
  const homeSquad = getUserSquad();
  const awaySquad = getRandomCpuTeam() || DEFAULT_AWAY_SQUAD;

  // 2. Simulación (Backend con fallback local offline)
  currentFullMatch = await matchService.simulateMatch(homeSquad, awaySquad);
  const snapshots = currentFullMatch.cycleSnapshots || [];
  let activeSnapshotIndex = -1;
  currentSimulatedMinute = 1;
  isMatchLive = true;

  // Estado inicial en el minuto 1 (con hito inicial en cronología)
  renderMatchDetails({
    status: "EN VIVO 1'",
    isLive: true,
    homeTeam: { name: homeSquad.name, score: 0, formation: homeSquad.formation },
    awayTeam: { name: awaySquad.name, score: 0, formation: awaySquad.formation },
    liveAction: { team: homeSquad.name, status: '¡PITIDO INICIAL! RUEDA EL BALÓN' },
    events: [{ minute: 0, isPeriodBreak: true, label: 'INICIO DEL PARTIDO' }],
    stats: {
      possession: { home: 50, away: 50, label: 'Posesión' },
      shots: { home: 0, away: 0, label: 'Tiros a Puerta' },
      fouls: { home: 0, away: 0, label: 'Faltas' }
    },
    lineups: currentFullMatch.lineups
  });

  const TICK_MS = 150; // Timing acelerado (~150ms por minuto simulado)

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
          homeTeam: { name: homeSquad.name, score: step.homeScore, formation: homeSquad.formation },
          awayTeam: { name: awaySquad.name, score: step.awayScore, formation: awaySquad.formation },
          liveAction: step.liveAction,
          events: step.events,
          stats: step.stats,
          lineups: currentFullMatch.lineups
        });
      }

      // Detener temporalmente el reloj para el descanso
      if (liveSimulationInterval) {
        clearInterval(liveSimulationInterval);
        liveSimulationInterval = null;
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
      }, 1100);

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
          homeTeam: { name: homeSquad.name, score: step.homeScore, formation: homeSquad.formation },
          awayTeam: { name: awaySquad.name, score: step.awayScore, formation: awaySquad.formation },
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
      if (step.hasGoalThisCycle) {
        triggerScoreBump();
      }
      renderMatchDetails({
        status: `EN VIVO ${currentSimulatedMinute}'`,
        isLive: true,
        homeTeam: { name: homeSquad.name, score: step.homeScore, formation: homeSquad.formation },
        awayTeam: { name: awaySquad.name, score: step.awayScore, formation: awaySquad.formation },
        liveAction: step.liveAction,
        events: step.events,
        stats: step.stats,
        lineups: currentFullMatch.lineups
      });
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
  if (liveSimulationInterval) {
    clearInterval(liveSimulationInterval);
    liveSimulationInterval = null;
  }
  if (halftimeTimeout) {
    clearTimeout(halftimeTimeout);
    halftimeTimeout = null;
  }
  isMatchLive = false;

  const liveBtn = document.getElementById('btn-live-sim');
  if (liveBtn) liveBtn.classList.remove('is-running');

  const statusTextEl = document.getElementById('match-status-text');
  if (statusTextEl) statusTextEl.textContent = 'FINAL';
  const statusDot = document.getElementById('status-dot');
  if (statusDot) statusDot.classList.remove('is-live');

  if (currentFullMatch) {
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

  if (liveSimulationInterval) {
    clearInterval(liveSimulationInterval);
    liveSimulationInterval = null;
  }
  if (halftimeTimeout) {
    clearTimeout(halftimeTimeout);
    halftimeTimeout = null;
  }
  isMatchLive = false;

  const liveBtn = document.getElementById('btn-live-sim');
  if (liveBtn) liveBtn.classList.remove('is-running');

  if (!currentFullMatch) {
    const homeSquad = getUserSquad();
    const awaySquad = getRandomCpuTeam() || DEFAULT_AWAY_SQUAD;
    currentFullMatch = await matchService.simulateMatch(homeSquad, awaySquad);
  }

  const statusTextEl = document.getElementById('match-status-text');
  if (statusTextEl) statusTextEl.textContent = 'FINAL';
  const statusDot = document.getElementById('status-dot');
  if (statusDot) statusDot.classList.remove('is-live');

  renderMatchDetails(currentFullMatch);
  showMatchResultModal(currentFullMatch);
}

function showMatchResultModal(match) {
  const homeScore = match.homeTeam?.score ?? 0;
  const awayScore = match.awayTeam?.score ?? 0;
  const isWin = homeScore > awayScore;
  const isDraw = homeScore === awayScore;

  const resultType = isWin ? 'VICTORIA' : (isDraw ? 'EMPATE' : 'DERROTA');
  const points = isWin ? '+15 Puntos' : (isDraw ? '+5 Puntos' : '+0 Puntos');

  // Extracción del MVP del partido en base a los goles o salvadas
  const goalsEvents = (match.events || []).filter((e) => e.type === 'goal');
  let mvpName = 'L. Messi';
  let mvpStats = '1 Gol decisivo';
  let mvpRating = 9.4;

  if (goalsEvents.length > 0) {
    // Si hubo goles, el primer goleador o el más repetido
    const goalScorer = goalsEvents[0].player;
    mvpName = goalScorer;
    const goalsCount = goalsEvents.filter((e) => e.player === goalScorer).length;
    mvpStats = `${goalsCount} ${goalsCount > 1 ? 'Goles' : 'Gol'}`;
    mvpRating = 9.2 + Math.min(0.7, goalsCount * 0.3);
  } else {
    // Si fue 0-0, el portero de tu equipo
    const gk = match.lineups?.home?.find((p) => p.role === 'POR');
    mvpName = gk ? gk.name : 'I. Casillas';
    mvpStats = 'Valla invicta y atajadas clave';
    mvpRating = 9.0;
  }

  // Persistir resultado, puntos ganados y racha del mánager (Fase 4)
  const saveOutcome = matchService.saveMatchResult(match);
  const pointsText = saveOutcome?.pointsGained ? `+${saveOutcome.pointsGained} Puntos` : points;
  const rankText = saveOutcome?.currentStats?.ranking ? `#${saveOutcome.currentStats.ranking}` : (isWin ? '#428' : '#430');

  openMatchResultModal(
    {
      homeTeam: match.homeTeam?.name || 'Tu Equipo',
      awayTeam: match.awayTeam?.name || 'Equipo Rival',
      homeScore,
      awayScore,
      resultType,
      mvp: {
        name: mvpName,
        initials: getInitials(mvpName),
        stats: mvpStats,
        rating: mvpRating
      },
      ranking: {
        pointsGained: pointsText,
        currentRank: rankText
      }
    },
    {
      onNextMatch: () => {
        startLiveMatchPlayback();
      },
      onGoHome: () => {
        if (window.router && window.router.navigate) window.router.navigate('/dashboard'); else window.location.href = '/dashboard';
      }
    }
  );
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Genera una lista coherente de eventos de cronología cuando el partido
 * proviene de un marcador histórico sin eventos guardados.
 */
function generateEventsForScore(homeName, awayName, homeScore, awayScore) {
  const evs = [];
  evs.push({ minute: 90, isPeriodBreak: true, label: 'FIN DEL PARTIDO' });

  const homeMinutes = [14, 28, 41, 57, 72, 86, 33, 62].slice(0, homeScore);
  const homeScorers = ['L. Messi', 'Z. Zidane', 'X. Hernández', 'R. Nazário', 'P. Maldini', 'A. Iniesta'];

  homeMinutes.forEach((min, idx) => {
    evs.push({
      minute: min,
      side: 'home',
      type: 'goal',
      player: homeScorers[idx % homeScorers.length],
      detail: '(Gol)'
    });
  });

  const awayMinutes = [19, 36, 52, 69, 78, 88].slice(0, awayScore);
  const awayScorers = ['Pelé', 'D. Maradona', 'J. Cruyff', 'Rivaldo', 'T. Henry', 'A. Di Stéfano'];

  awayMinutes.forEach((min, idx) => {
    evs.push({
      minute: min,
      side: 'away',
      type: 'goal',
      player: awayScorers[idx % awayScorers.length],
      detail: '(Gol)'
    });
  });

  evs.push({ minute: 45, isPeriodBreak: true, label: 'DESCANSO' });

  if (homeScore === 0) {
    evs.push({ minute: 64, side: 'away', type: 'save', player: 'Portero Rival', detail: '(Atajada Clave)' });
  }
  if (awayScore === 0) {
    evs.push({ minute: 38, side: 'home', type: 'save', player: 'I. Casillas', detail: '(Atajada Clave)' });
  }

  evs.push({ minute: 0, isPeriodBreak: true, label: 'INICIO DEL PARTIDO' });

  return evs.sort((a, b) => b.minute - a.minute);
}

/**
 * Normaliza un registro de historial (de localStorage o fallback) a la estructura
 * completa requerida por renderMatchDetails.
 */
function formatHistoryMatchToDetail(item) {
  let homeScore = item.homeScore ?? item.home_score;
  let awayScore = item.awayScore ?? item.away_score;

  if (homeScore === undefined && item.score) {
    const parts = item.score.split('-').map(s => parseInt(s.trim(), 10));
    homeScore = isNaN(parts[0]) ? 0 : parts[0];
    awayScore = isNaN(parts[1]) ? 0 : parts[1];
  }

  homeScore = homeScore ?? 0;
  awayScore = awayScore ?? 0;

  const homeTeamName = (item.homeTeam && typeof item.homeTeam === 'object' ? item.homeTeam.name : item.homeTeam) || 'Tu Equipo';
  const awayTeamName = (item.awayTeam && typeof item.awayTeam === 'object' ? item.awayTeam.name : item.awayTeam) || item.rival || item.opponent || 'Equipo Rival';

  // Si ya tiene eventos guardados, usarlos; de lo contrario generar acordes al marcador
  let events = item.events;
  if (!events || events.length === 0) {
    events = generateEventsForScore(homeTeamName, awayTeamName, homeScore, awayScore);
  }

  // Si ya tiene estadísticas guardadas, usarlas; sino calcular coherentes
  let stats = item.stats;
  if (!stats || !stats.possession) {
    const isHomeSuperior = homeScore > awayScore;
    const isAwaySuperior = awayScore > homeScore;
    const possHome = isHomeSuperior ? Math.min(68, 50 + (homeScore - awayScore) * 5) : (isAwaySuperior ? Math.max(34, 50 - (awayScore - homeScore) * 5) : 50);
    const shotsHome = Math.max(homeScore, homeScore + Math.floor(Math.random() * 4) + 2);
    const shotsAway = Math.max(awayScore, awayScore + Math.floor(Math.random() * 4) + 1);

    stats = {
      possession: { home: possHome, away: 100 - possHome, label: 'Posesión' },
      shots: { home: shotsHome, away: shotsAway, label: 'Tiros a Puerta' },
      fouls: { home: 8 + Math.floor(Math.random() * 6), away: 7 + Math.floor(Math.random() * 6), label: 'Faltas' }
    };
  }

  const lineups = item.lineups && item.lineups.home ? item.lineups : DEFAULT_MATCH_DATA.lineups;

  return {
    id: item.id,
    status: 'FINAL',
    isLive: false,
    homeTeam: {
      name: homeTeamName,
      score: homeScore,
      formation: (item.homeTeam && item.homeTeam.formation) || '1-2-2-1'
    },
    awayTeam: {
      name: awayTeamName,
      score: awayScore,
      formation: (item.awayTeam && item.awayTeam.formation) || '1-1-3-1'
    },
    liveAction: {
      team: homeScore >= awayScore ? homeTeamName : awayTeamName,
      status: 'FINAL DEL PARTIDO'
    },
    events,
    stats,
    lineups
  };
}

/**
 * Obtiene los detalles de un partido por su ID desde LocalStorage, Backend o Mock histórico.
 * @param {string|number} matchId
 * @returns {Promise<Object>}
 */
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
  setupMatchTabs();

  // Configurar botón volver para retornar a la pantalla previa (ej. /history o /dashboard)
  const backBtn = document.getElementById('btn-back');
  if (backBtn && !backBtn.hasAttribute('data-bound')) {
    backBtn.setAttribute('data-bound', 'true');
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = '/history';
      }
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  const matchId = urlParams.get('id');
  const isAutoplay = urlParams.get('autoplay') === 'true' || sessionStorage.getItem('fantasy_match_autoplay') === 'true';
  sessionStorage.removeItem('fantasy_match_autoplay');

  // Si viene desde "BUSCAR RIVAL" en el Home (autoplay=true), arrancar automáticamente
  if (isAutoplay) {
    console.info('[Match] Autoplay activado desde Home: Iniciando simulación en vivo...');
    startLiveMatchPlayback();
  } else {
    console.info(`[Match] Cargando detalles del partido ID: ${matchId}`);
    const matchData = await fetchMatchDetail(matchId || 1);
    renderMatchDetails(matchData);
  }

  const quickSimBtn = document.getElementById('btn-quick-sim');
  if (quickSimBtn) {
    quickSimBtn.addEventListener('click', () => {
      executeQuickSimulation();
    });
  }

  const liveSimBtn = document.getElementById('btn-live-sim');
  if (liveSimBtn) {
    liveSimBtn.addEventListener('click', () => {
      startLiveMatchPlayback();
    });
  }

  const statusBadge = document.getElementById('match-status-badge');
  if (statusBadge) {
    statusBadge.addEventListener('click', () => {
      if (!isMatchLive) {
        startLiveMatchPlayback();
      } else {
        executeQuickSimulation();
      }
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMatchDetailView);
  } else {
    initMatchDetailView();
  }
}

export const initMatch = initMatchDetailView;
export function startMatchSimulation(matchData = DEFAULT_MATCH_DATA) { renderMatchDetails(matchData); }
