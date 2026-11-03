/**
 * @file match-detail.js
 * @description Controlador modular y data-driven para la pantalla de Detalles de Partido (Partido en Directo).
 * Sincronizado con formaciones reales de usuario, modal de resultados y flujo con "Buscar Rival" (autoplay).
 */

import { openMatchResultModal, getInitials } from '../../components/modal/modal.js?v=6';
import { simulateMatchEngine, FORMATIONS_6V6 } from '../../domain/simulation-engine.js?v=6';
import { getRandomCpuTeam } from '../../domain/cpu-teams.js?v=6';
import { matchService } from '../../services/match-service.js?v=6';

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
      if (parsed && Array.isArray(parsed.players)) {
        // Rellenar cualquier posición nula con DEFAULT_HOME_SQUAD para que la plantilla siempre esté completa
        const filledPlayers = parsed.players.map((p, i) => p || DEFAULT_HOME_SQUAD.players[i] || {
          name: `Leyenda ${i + 1}`,
          role: i === 0 ? 'POR' : (i < 3 ? 'DEF' : (i < 5 ? 'MC' : 'DEL')),
          rating_general: 85,
          rating_ataque: 75,
          rating_defensa: 75
        });

        while (filledPlayers.length < 9) {
          const idx = filledPlayers.length;
          filledPlayers.push(DEFAULT_HOME_SQUAD.players[idx] || {
            name: `Leyenda ${idx + 1}`,
            role: idx === 0 ? 'POR' : (idx < 3 ? 'DEF' : (idx < 5 ? 'MC' : 'DEL')),
            rating_general: 85,
            rating_ataque: 75,
            rating_defensa: 75
          });
        }

        return {
          name: parsed.name || 'Tu Equipo',
          formation: parsed.formation || '1-2-2-1',
          players: filledPlayers
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
  renderStats(match.stats);

  const isFinished = match.status === 'FINAL' || (!match.isLive && match.status && !match.status.includes('EN VIVO') && !match.status.includes('DESCANSO'));
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

  const liveBtn = document.getElementById('btn-live-sim');
  if (liveBtn) liveBtn.classList.add('is-running');

  // 1. Obtener la plantilla real del usuario y un rival CPU aleatorio de los 20 equipos del sistema
  currentFullMatch = null;
  const homeSquad = getUserSquad();
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
  console.info(`[Match] Simulación en vivo contra CPU: ${homeSquad.name} vs ${awaySquad.name} (Formación: ${awaySquad.formation})`);

  // 2. Simulación (Backend con fallback local offline)
  currentFullMatch = await matchService.simulateMatch(homeSquad, awaySquad);
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

      triggerHalftimePause();
      return;
    }
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

      if (step.hasGoalThisCycle) {
        triggerScoreBump();

        // Extraer autor y equipo del gol para la celebración (evento más reciente al frente)
        const goalEvent = (step.events || []).find(e =>
          (e.type === 'goal' || e.type === 'penalty-goal') &&
          (e.minute === step.minute || Math.abs((e.minute || 0) - currentSimulatedMinute) <= 5)
        ) || (step.events || []).find(e => e.type === 'goal' || e.type === 'penalty-goal');

        const goalInfo = {
          player: goalEvent?.player || '',
          team: goalEvent?.side === 'home' ? homeSquad.name : (goalEvent?.side === 'away' ? awaySquad.name : ''),
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
  const fallbackPoints = isWin ? '+15 Puntos' : (isDraw ? '+5 Puntos' : '-15 Puntos');

  const saveOutcome = match.saveOutcome || matchService.saveMatchResult(match);
  match.saveOutcome = saveOutcome;

  let matchMvp = saveOutcome?.matchMvp;
  const awayTeamName = match.awayTeam?.name || 'Equipo Rival';
  const homeTeamName = match.homeTeam?.name || 'Tu Equipo';

  // REGLA DE ORO DE COMPETICIÓN:
  // Si el usuario pierde el partido (DERROTA), el MVP DEBE PERTENECER AL EQUIPO RIVAL GANADOR
  if (isLoss) {
    if (!matchMvp || !matchMvp.isRival) {
      const awayGoalEvents = (match.events || []).filter(e =>
        e.side === 'away' && (e.type === 'goal' || e.type === 'penalty-goal')
      );
      const awayStarters = match.lineups?.away || match.lineups?.awayStarters || [];

      let topScorer = null;
      let maxGoals = 0;
      if (awayGoalEvents.length > 0) {
        const counts = {};
        awayGoalEvents.forEach(e => {
          const n = e.player || 'Delantero Rival';
          counts[n] = (counts[n] || 0) + 1;
          if (counts[n] > maxGoals) { maxGoals = counts[n]; topScorer = n; }
        });
      }

      if (!topScorer) {
        const fwd = awayStarters.find(p => p.role === 'DEL') || awayStarters[awayStarters.length - 1];
        topScorer = fwd?.name || 'Goleador Rival';
        maxGoals = Math.max(1, awayScore);
      }

      const foundRival = awayStarters.find(p => p.name === topScorer);
      matchMvp = {
        name: topScorer,
        role: foundRival?.role || 'DEL',
        matchRating: maxGoals >= 2 ? 9.3 : 8.8,
        matchGoals: maxGoals,
        savesCount: 0,
        cleanSheet: homeScore === 0,
        goalsConceded: homeScore,
        isRival: true,
        teamName: awayTeamName
      };
    }
  } else if (isWin) {
    if (!matchMvp || matchMvp.isRival) {
      const homeStarters = match.lineups?.home || match.lineups?.homeStarters || [];
      const leader = homeStarters.find(p => p.role === 'DEL' || p.role === 'MC') || homeStarters[0] || { name: 'Messi', role: 'DEL' };
      matchMvp = {
        name: leader.name,
        role: leader.role || 'DEL',
        matchRating: 9.2,
        matchGoals: Math.max(1, homeScore),
        savesCount: 0,
        cleanSheet: awayScore === 0,
        goalsConceded: awayScore,
        isRival: false,
        teamName: homeTeamName
      };
    }
  }

  const isRivalMvp = Boolean(matchMvp?.isRival);
  const mvpName = matchMvp?.name || (isRivalMvp ? awayTeamName : 'Messi');
  const mvpRating = matchMvp?.matchRating || (isWin ? 9.2 : (isLoss ? 9.0 : 8.0));
  const mvpTeamName = matchMvp?.teamName || (isRivalMvp ? awayTeamName : homeTeamName);

  let mvpStats = 'Rendimiento destacado';
  if (isRivalMvp) {
    if (matchMvp?.matchGoals > 0) {
      mvpStats = `${matchMvp.matchGoals} ${matchMvp.matchGoals > 1 ? 'Goles anotados' : 'Gol anotado'}`;
    } else if (matchMvp?.role === 'POR') {
      mvpStats = matchMvp.cleanSheet ? 'Valla invicta y atajadas clave' : `${matchMvp.savesCount || 2} atajadas clave`;
    } else {
      mvpStats = 'Figura del triunfo rival';
    }
  } else {
    if (matchMvp?.role === 'POR') {
      const isCleanSheet = awayScore === 0;
      const saves = matchMvp.savesCount || 0;
      if (isCleanSheet) {
        mvpStats = saves > 0 ? `Valla invicta y ${saves} ${saves === 1 ? 'atajada clave' : 'atajadas clave'}` : 'Valla invicta';
      } else {
        mvpStats = saves > 0 ? `${saves} ${saves === 1 ? 'atajada clave' : 'atajadas clave'}` : 'Seguridad bajo los tres palos';
      }
    } else if (matchMvp?.matchGoals > 0) {
      mvpStats = `${matchMvp.matchGoals} ${matchMvp.matchGoals > 1 ? 'Goles anotados' : 'Gol anotado'}`;
    } else if (matchMvp?.role === 'DEL') {
      mvpStats = 'Desmarque y presión ofensiva';
    } else if (matchMvp?.role === 'MC') {
      mvpStats = 'Control del mediocampo y visión de juego';
    } else if (matchMvp?.role === 'DEF') {
      mvpStats = awayScore === 0 ? 'Solidez y portería a cero' : 'Liderazgo y cortes defensivos';
    }
  }

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
        stats: 'Figura del partido',
        rating: 9.0,
        isRival: isLoss
      },
      ranking: {
        pointsGained: isWin ? '+15 Puntos' : (isLoss ? '-15 Puntos' : '+5 Puntos'),
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
