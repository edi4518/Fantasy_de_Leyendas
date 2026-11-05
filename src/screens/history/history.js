import { apiClient } from '../../services/api-client.js';
import { fetchMatchDetail } from '../match/match.js?v=16';
/**
 * @file history.js
 * @description Controlador modular para la vista de Historial de Partidos de Fantasy de Leyendas.
 * Consume el endpoint GET /api/matches/history, gestiona el renderizado dinámico de tarjetas
 * y muestra el popup modal de Detalles del Partido sincronizado con los datos de match.js.
 *
 * @exports { initHistory, initHistoryView, fetchMatchHistory, renderHistory, DEFAULT_HISTORY_MATCHES }
 */

let currentHistoryMatches = [];

/**
 * Listado canónico de partidos por defecto alineado con la interfaz de Stitch.
 * Proporciona renderizado instantáneo y fallback en entornos offline.
 */
export const DEFAULT_HISTORY_MATCHES = [
  {
    id: 1,
    opponent: 'Real Galácticos',
    relativeDate: 'Hoy',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Real Galácticos',
    awayTeamDisplay: 'Real Galáctic...',
    homeScore: 2,
    awayScore: 1,
    points: 25,
    resultType: 'win',
    events: [
      { minute: 88, side: 'away', type: 'yellow-card', player: 'R. Carlos', detail: '(Tarjeta Amarilla)' },
      { minute: 74, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
      { minute: 61, side: 'away', type: 'missed-penalty', player: 'L. Figo', detail: '(Penalti Fallado)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 44, side: 'home', type: 'yellow-card', player: 'P. Maldini', detail: '(Tarjeta Amarilla)' },
      { minute: 28, side: 'away', type: 'goal', player: 'R. Nazário', detail: '(Gol)' },
      { minute: 12, side: 'home', type: 'goal', player: 'Z. Zidane', detail: '(Gol)' }
    ]
  },
  {
    id: 2,
    opponent: 'Milan Vintage',
    relativeDate: 'Hace 2 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Milan Vintage',
    awayTeamDisplay: 'Milan Vintage',
    homeScore: 1,
    awayScore: 1,
    points: 5,
    resultType: 'draw',
    events: [
      { minute: 81, side: 'away', type: 'yellow-card', player: 'F. Baresi', detail: '(Tarjeta Amarilla)' },
      { minute: 67, side: 'away', type: 'goal', player: 'M. van Basten', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 38, side: 'home', type: 'yellow-card', player: 'Xavi', detail: '(Tarjeta Amarilla)' },
      { minute: 19, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' }
    ]
  },
  {
    id: 3,
    opponent: 'Santos Eterno',
    relativeDate: 'Hace 3 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Santos Eterno',
    awayTeamDisplay: 'Santos Eterno',
    homeScore: 0,
    awayScore: 3,
    points: -15,
    resultType: 'loss',
    events: [
      { minute: 84, side: 'away', type: 'goal', player: 'Pelé', detail: '(Gol)' },
      { minute: 69, side: 'home', type: 'missed-penalty', player: 'Z. Zidane', detail: '(Penalti Fallado)' },
      { minute: 53, side: 'away', type: 'goal', player: 'Coutinho', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 34, side: 'home', type: 'yellow-card', player: 'C. Puyol', detail: '(Tarjeta Amarilla)' },
      { minute: 16, side: 'away', type: 'goal', player: 'Pelé', detail: '(Gol)' }
    ]
  },
  {
    id: 4,
    opponent: 'Bayern Leyendas',
    relativeDate: 'Hace 4 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Bayern Leyendas',
    awayTeamDisplay: 'Bayern Leyend...',
    homeScore: 3,
    awayScore: 2,
    points: 25,
    resultType: 'win',
    events: [
      { minute: 86, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
      { minute: 71, side: 'away', type: 'goal', player: 'G. Müller', detail: '(Gol)' },
      { minute: 55, side: 'home', type: 'goal', player: 'Ronaldo', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 31, side: 'away', type: 'goal', player: 'L. Matthäus', detail: '(Gol)' },
      { minute: 14, side: 'home', type: 'goal', player: 'Z. Zidane', detail: '(Gol)' }
    ]
  },
  {
    id: 5,
    opponent: 'Ajax Clásico',
    relativeDate: 'Hace 5 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Ajax Clásico',
    awayTeamDisplay: 'Ajax Clásico',
    homeScore: 2,
    awayScore: 2,
    points: 5,
    resultType: 'draw',
    events: [
      { minute: 79, side: 'away', type: 'goal', player: 'J. Cruyff', detail: '(Gol)' },
      { minute: 62, side: 'home', type: 'goal', player: 'A. Iniesta', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 29, side: 'away', type: 'goal', player: 'J. Neeskens', detail: '(Gol)' },
      { minute: 11, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' }
    ]
  },
  {
    id: 6,
    opponent: 'Liverpool Épico',
    relativeDate: 'Hace 6 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Liverpool Épico',
    awayTeamDisplay: 'Liverpool Épico',
    homeScore: 1,
    awayScore: 0,
    points: 25,
    resultType: 'win',
    events: [
      { minute: 77, side: 'away', type: 'yellow-card', player: 'S. Gerrard', detail: '(Tarjeta Amarilla)' },
      { minute: 58, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 22, side: 'home', type: 'yellow-card', player: 'P. Maldini', detail: '(Tarjeta Amarilla)' }
    ]
  },
  {
    id: 7,
    opponent: 'Boca Histórico',
    relativeDate: 'Hace 7 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Boca Histórico',
    awayTeamDisplay: 'Boca Histórico',
    homeScore: 0,
    awayScore: 1,
    points: -15,
    resultType: 'loss',
    events: [
      { minute: 82, side: 'home', type: 'yellow-card', player: 'Z. Zidane', detail: '(Tarjeta Amarilla)' },
      { minute: 64, side: 'away', type: 'goal', player: 'J. Riquelme', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 27, side: 'away', type: 'yellow-card', player: 'M. Palermo', detail: '(Tarjeta Amarilla)' }
    ]
  },
  {
    id: 8,
    opponent: 'Juve Dinastía',
    relativeDate: 'Hace 8 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Juve Dinastía',
    awayTeamDisplay: 'Juve Dinastía',
    homeScore: 2,
    awayScore: 0,
    points: 25,
    resultType: 'win',
    events: [
      { minute: 75, side: 'home', type: 'goal', player: 'Ronaldo', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 39, side: 'away', type: 'yellow-card', player: 'G. Chiellini', detail: '(Tarjeta Amarilla)' },
      { minute: 18, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' }
    ]
  },
  {
    id: 9,
    opponent: 'Arsenal Invictos',
    relativeDate: 'Hace 9 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Arsenal Invictos',
    awayTeamDisplay: 'Arsenal Invic...',
    homeScore: 3,
    awayScore: 3,
    points: 5,
    resultType: 'draw',
    events: [
      { minute: 89, side: 'away', type: 'goal', player: 'T. Henry', detail: '(Gol)' },
      { minute: 73, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
      { minute: 59, side: 'away', type: 'goal', player: 'D. Bergkamp', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 36, side: 'home', type: 'goal', player: 'Z. Zidane', detail: '(Gol)' },
      { minute: 24, side: 'away', type: 'goal', player: 'P. Vieira', detail: '(Gol)' },
      { minute: 10, side: 'home', type: 'goal', player: 'Ronaldo', detail: '(Gol)' }
    ]
  },
  {
    id: 10,
    opponent: 'Manchester Clásico',
    relativeDate: 'Hace 10 días',
    homeTeam: 'Tu Equipo',
    awayTeam: 'Manchester Clásico',
    awayTeamDisplay: 'Manchester Cl...',
    homeScore: 2,
    awayScore: 1,
    points: 25,
    resultType: 'win',
    events: [
      { minute: 83, side: 'home', type: 'goal', player: 'L. Messi', detail: '(Gol)' },
      { minute: 52, side: 'away', type: 'goal', player: 'E. Cantona', detail: '(Gol)' },
      { minute: 45, isPeriodBreak: true, label: 'DESCANSO' },
      { minute: 21, side: 'home', type: 'goal', player: 'Xavi', detail: '(Gol)' }
    ]
  }
];

/**
 * Consulta el historial de partidos disputados desde la API de FastAPI o LocalStorage.
 * @returns {Promise<Array>} Lista de registros de partidos.
 */
export async function fetchMatchHistory() {
  try {
    const data = await apiClient.get('/matches/history');
    if (data) {
      const rawList = Array.isArray(data) ? data : (data.history || []);
      if (rawList.length > 0) {
        return normalizeHistoryData(rawList);
      }
    }
  } catch (error) {
    console.info('[History] Backend no disponible o modo offline. Comprobando persistencia local:', error.message);
  }

  // Fusión con historial guardado en localStorage
  try {
    const saved = localStorage.getItem('fantasy_match_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeHistoryData(parsed);
      }
    }
  } catch (e) {
    console.debug('[History] Error leyendo partidos locales:', e);
  }

  return DEFAULT_HISTORY_MATCHES;
}

/**
 * Normaliza los datos provenientes de la API backend o local.
 * @param {Array} rawList
 * @returns {Array}
 */
function normalizeHistoryData(rawList = []) {
  return rawList.map((item, index) => {
    let homeScore = item.home_score ?? item.homeScore ?? (typeof item.homeTeam === 'object' ? item.homeTeam?.score : undefined);
    let awayScore = item.away_score ?? item.awayScore ?? (typeof item.awayTeam === 'object' ? item.awayTeam?.score : undefined);

    if (homeScore === undefined && item.score) {
      const parts = item.score.split('-').map(s => parseInt(s.trim(), 10));
      homeScore = isNaN(parts[0]) ? 0 : parts[0];
      awayScore = isNaN(parts[1]) ? 0 : parts[1];
    }

    homeScore = homeScore ?? 0;
    awayScore = awayScore ?? 0;

    const homeTeamName =
      item.home_team_name ||
      (typeof item.homeTeam === 'object' ? item.homeTeam?.name : item.homeTeam) ||
      'Tu Equipo';

    const opponentName =
      item.opponent_name ||
      item.away_team_name ||
      (typeof item.awayTeam === 'object' ? item.awayTeam?.name : item.awayTeam) ||
      item.rival ||
      item.opponent ||
      `Rival ${index + 1}`;

    let resultType = 'draw';
    let points = 5;
    if (homeScore > awayScore) {
      resultType = 'win';
      points = 25;
    } else if (homeScore < awayScore) {
      resultType = 'loss';
      points = -15;
    }

    return {
      id: item.id || item.match_id || index + 1,
      opponent: opponentName,
      relativeDate: item.relative_date || item.relativeDate || item.date || item.fecha || 'Reciente',
      homeTeam: homeTeamName,
      awayTeam: opponentName,
      awayTeamDisplay: opponentName.length > 13 ? `${opponentName.substring(0, 12)}...` : opponentName,
      homeScore,
      awayScore,
      points: item.points_obtained ?? item.points ?? item.puntos ?? points,
      resultType,
      events: Array.isArray(item.events) ? item.events : [],
      stats: item.stats || {},
      lineups: item.lineups || {}
    };
  });
}

/**
 * Renderiza dinámicamente el listado de tarjetas de partidos en el DOM.
 * @param {Array} matches
 */
export function renderHistory(matches = DEFAULT_HISTORY_MATCHES) {
  currentHistoryMatches = Array.isArray(matches) ? matches : DEFAULT_HISTORY_MATCHES;
  const container = document.getElementById('history-cards-container');
  const subtitleEl = document.getElementById('history-subtitle');

  if (subtitleEl) {
    subtitleEl.textContent = `Mostrando los últimos ${currentHistoryMatches.length} resultados`;
  }

  if (!container) return;

  if (!Array.isArray(currentHistoryMatches) || currentHistoryMatches.length === 0) {
    container.innerHTML = `
      <div class="history-empty-state">
        <span class="history-empty-icon" aria-hidden="true">⚽</span>
        <h3 class="history-empty-title">Sin partidos disputados</h3>
        <p class="history-empty-desc">Aún no has simulado encuentros esta temporada. Busca un rival desde el Inicio para empezar a competir.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentHistoryMatches
    .map((match) => {
      let pointsClass = 'points-badge--win';
      let formattedPoints = `+${match.points}`;

      if (match.points > 0 && match.resultType === 'draw') {
        pointsClass = 'points-badge--draw';
        formattedPoints = `+${match.points}`;
      } else if (match.points < 0 || match.resultType === 'loss') {
        pointsClass = 'points-badge--loss';
        formattedPoints = `${match.points}`;
      }

      const awayDisplay = match.awayTeamDisplay || (match.awayTeam.length > 13 ? `${match.awayTeam.substring(0, 12)}...` : match.awayTeam);

      return `
        <article class="card history-match-card" data-match-id="${match.id}">
          <div class="history-card__header">
            <h2 class="history-card__opponent">${match.opponent}</h2>
            <span class="history-card__date">${match.relativeDate}</span>
          </div>

          <div class="history-card__scoreboard">
            <span class="team-name team-name--home">${match.homeTeam}</span>
            <div class="score-display">
              <span class="score-num">${match.homeScore}</span>
              <span class="score-divider">–</span>
              <span class="score-num">${match.awayScore}</span>
            </div>
            <span class="team-name team-name--away" title="${match.awayTeam}">${awayDisplay}</span>
          </div>

          <div class="history-card__footer">
            <span class="points-wrapper">
              Puntos obtenidos: <strong class="points-badge ${pointsClass}">${formattedPoints}</strong>
            </span>
            <a role="button" tabindex="0" class="match-details-link" data-id="${match.id}" aria-label="Ver detalles del partido contra ${match.opponent}">
              Ver Detalles
              <svg class="match-details-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9 5l7 7-7 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"></path>
              </svg>
            </a>
          </div>
        </article>
      `;
    })
    .join('');
}

/**
 * Mapea el tipo de evento de match.js al formato visual del popup de Historial.
 * @param {Object} event
 * @returns {{ label: string, icon: string, tagClass: string, badgeClass: string }}
 */
function getHistoryTimelineEventPresentation(event) {
  const isHome = event.side === 'home';
  const type = event.type || '';
  const detailLower = (event.detail || '').toLowerCase();

  if (type === 'goal') {
    return {
      label: 'Gol',
      icon: '⚽',
      tagClass: isHome ? 'history-timeline-event-tag--home-goal' : 'history-timeline-event-tag--away-goal',
      badgeClass: isHome ? 'history-timeline-badge--home-goal' : 'history-timeline-badge--away-goal'
    };
  }

  if (type === 'penalty-goal') {
    return {
      label: 'Penalti (Gol)',
      icon: '⚽',
      tagClass: isHome ? 'history-timeline-event-tag--home-goal' : 'history-timeline-event-tag--away-goal',
      badgeClass: isHome ? 'history-timeline-badge--home-goal' : 'history-timeline-badge--away-goal'
    };
  }

  if (type === 'yellow-card') {
    return {
      label: 'Tarjeta Amarilla',
      icon: '🟨',
      tagClass: 'history-timeline-event-tag--yellow',
      badgeClass: 'history-timeline-badge--yellow'
    };
  }

  if (type === 'red-card') {
    return {
      label: 'Tarjeta Roja',
      icon: '🟥',
      tagClass: 'history-timeline-event-tag--danger',
      badgeClass: 'history-timeline-badge--danger'
    };
  }

  if (type === 'missed-penalty' || type === 'penalty-miss' || detailLower.includes('penal')) {
    return {
      label: 'Penalti Fallado',
      icon: '❌',
      tagClass: 'history-timeline-event-tag--danger',
      badgeClass: 'history-timeline-badge--danger'
    };
  }

  if (type === 'save') {
    return {
      label: 'Atajada Clave',
      icon: '🧤',
      tagClass: 'history-timeline-event-tag--neutral',
      badgeClass: 'history-timeline-badge--neutral'
    };
  }

  if (type === 'freekick') {
    return {
      label: 'Tiro Libre',
      icon: '🎯',
      tagClass: 'history-timeline-event-tag--neutral',
      badgeClass: 'history-timeline-badge--neutral'
    };
  }

  if (type === 'corner') {
    return {
      label: 'Tiro de Esquina',
      icon: '⛳',
      tagClass: 'history-timeline-event-tag--neutral',
      badgeClass: 'history-timeline-badge--neutral'
    };
  }

  if (type === 'substitution') {
    return {
      label: 'Cambio Táctico',
      icon: '🔄',
      tagClass: 'history-timeline-event-tag--neutral',
      badgeClass: 'history-timeline-badge--neutral'
    };
  }

  const cleanDetail = (event.detail || 'Acción').replace(/^[(\s]+|[)\s]+$/g, '');
  return {
    label: cleanDetail,
    icon: '⚽',
    tagClass: isHome ? 'history-timeline-event-tag--home-goal' : 'history-timeline-event-tag--away-goal',
    badgeClass: isHome ? 'history-timeline-badge--home-goal' : 'history-timeline-badge--away-goal'
  };
}

/**
 * Abre el popup de Detalles del Partido obteniendo los mismos datos que match-detail-container.
 * @param {string|number} matchId
 */
export async function openHistoryMatchModal(matchId) {
  const modal = document.getElementById('history-details-modal');
  if (!modal) return;

  // 1. Obtener los detalles del partido desde fetchMatchDetail (misma fuente que match-detail-container)
  const detail = await fetchMatchDetail(matchId);
  const historyEntry = currentHistoryMatches.find(m => String(m.id) === String(matchId));

  const homeName = detail?.homeTeam?.name || historyEntry?.homeTeam || 'Tu Equipo';
  const awayName = detail?.awayTeam?.name || historyEntry?.opponent || historyEntry?.awayTeam || 'Rival';
  const homeScore = detail?.homeTeam?.score ?? historyEntry?.homeScore ?? 0;
  const awayScore = detail?.awayTeam?.score ?? historyEntry?.awayScore ?? 0;

  let points = historyEntry?.points ?? detail?.points;
  let resultType = historyEntry?.resultType || detail?.resultType;
  if (!resultType) {
    if (homeScore > awayScore) resultType = 'win';
    else if (homeScore < awayScore) resultType = 'loss';
    else resultType = 'draw';
  }
  if (points === undefined || points === null) {
    points = resultType === 'win' ? 25 : resultType === 'draw' ? 5 : -15;
  }

  // 2. Poblar el marcador y la leyenda
  const homeNameEl = document.getElementById('history-modal-home-name');
  const awayNameEl = document.getElementById('history-modal-away-name');
  const legendHomeEl = document.getElementById('history-modal-legend-home');
  const homeScoreEl = document.getElementById('history-modal-home-score');
  const awayScoreEl = document.getElementById('history-modal-away-score');

  if (homeNameEl) homeNameEl.textContent = homeName;
  if (awayNameEl) awayNameEl.textContent = awayName;
  if (legendHomeEl) legendHomeEl.textContent = homeName;
  if (homeScoreEl) homeScoreEl.textContent = String(homeScore);
  if (awayScoreEl) awayScoreEl.textContent = String(awayScore);

  // 3. Poblar la cronología del partido (ordenada cronológicamente de menor a mayor minuto)
  const timelineContainer = document.getElementById('history-modal-timeline');
  if (timelineContainer) {
    const rawEvents = (Array.isArray(detail?.events) && detail.events.length > 0)
      ? detail.events
      : (Array.isArray(historyEntry?.events) ? historyEntry.events : []);

    const matchEvents = rawEvents
      .filter(ev => ev && !ev.isPeriodBreak)
      .slice()
      .sort((a, b) => (Number(a.minute) || 0) - (Number(b.minute) || 0));

    if (matchEvents.length === 0) {
      timelineContainer.innerHTML = `
        <div class="history-timeline-empty">Sin eventos destacados registrados en este encuentro.</div>
      `;
    } else {
      const rowsHtml = matchEvents
        .map((ev) => {
          const isHome = ev.side === 'home';
          const pres = getHistoryTimelineEventPresentation(ev);
          const minuteLabel = `${ev.minute}'`;

          if (isHome) {
            return `
              <div class="history-timeline-row" data-minute="${ev.minute}">
                <div class="history-timeline-side history-timeline-side--home">
                  <span class="history-timeline-player">${ev.player || homeName}</span>
                  <span class="history-timeline-event-tag ${pres.tagClass}">${pres.label} <span aria-hidden="true">${pres.icon}</span></span>
                </div>
                <div class="history-timeline-badge ${pres.badgeClass}">${minuteLabel}</div>
                <div class="history-timeline-side history-timeline-side--away"></div>
              </div>
            `;
          }

          return `
            <div class="history-timeline-row" data-minute="${ev.minute}">
              <div class="history-timeline-side history-timeline-side--home"></div>
              <div class="history-timeline-badge ${pres.badgeClass}">${minuteLabel}</div>
              <div class="history-timeline-side history-timeline-side--away">
                <span class="history-timeline-player">${ev.player || awayName}</span>
                <span class="history-timeline-event-tag ${pres.tagClass}">${pres.label} <span aria-hidden="true">${pres.icon}</span></span>
              </div>
            </div>
          `;
        })
        .join('');

      timelineContainer.innerHTML = `
        <div class="history-timeline-line" aria-hidden="true"></div>
        <div class="history-timeline-list">
          ${rowsHtml}
        </div>
      `;
    }
  }

  // 4. Poblar la tarjeta de Puntos Obtenidos
  const pointsEl = document.getElementById('history-modal-points');
  if (pointsEl) {
    const formattedPts = points > 0 ? `+${points} Puntos` : `${points} Puntos`;
    pointsEl.textContent = formattedPts;
    pointsEl.className = 'history-modal-points-value';
    if (resultType === 'draw' || (points > 0 && homeScore === awayScore)) {
      pointsEl.classList.add('history-modal-points-value--draw');
    } else if (points < 0 || resultType === 'loss') {
      pointsEl.classList.add('history-modal-points-value--loss');
    } else {
      pointsEl.classList.add('history-modal-points-value--win');
    }
  }

  // 5. Mostrar el modal con transición suave
  modal.removeAttribute('hidden');
  modal.setAttribute('aria-hidden', 'false');
  void modal.offsetWidth;
  modal.classList.add('is-open');
}

/**
 * Cierra el popup de Detalles del Partido.
 */
export function closeHistoryMatchModal() {
  const modal = document.getElementById('history-details-modal');
  if (!modal) return;

  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  modal.setAttribute('hidden', '');
}

/**
 * Configura los event listeners para abrir y cerrar el modal al pulsar 'Ver Detalles'.
 */
export function setupHistoryEventListeners() {
  if (window.__historyCaptureClickHandler) {
    document.removeEventListener('click', window.__historyCaptureClickHandler, true);
  }

  window.__historyCaptureClickHandler = (e) => {
    const historyView = document.getElementById('history-view');
    if (!historyView) return;

    const link = e.target.closest('.match-details-link');
    if (link && historyView.contains(link)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const matchId = link.getAttribute('data-id') || link.closest('[data-match-id]')?.getAttribute('data-match-id') || 1;
      openHistoryMatchModal(matchId);
      return;
    }

    const closeBtn = e.target.closest('#btn-close-history-modal');
    if (closeBtn) {
      e.preventDefault();
      e.stopPropagation();
      closeHistoryMatchModal();
      return;
    }

    const modal = document.getElementById('history-details-modal');
    if (modal && e.target === modal) {
      closeHistoryMatchModal();
    }
  };

  document.addEventListener('click', window.__historyCaptureClickHandler, true);

  if (!window.__historyModalEscBound) {
    window.__historyModalEscBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const activeModal = document.getElementById('history-details-modal');
        if (activeModal && !activeModal.hasAttribute('hidden')) {
          closeHistoryMatchModal();
        }
      }
    });
  }
}

/**
 * Inicialización completa de la pantalla Historial de Partidos.
 * @param {Object} [router]
 */
export async function initHistory(router) {
  console.info('[History] Inicializando vista Historial de Partidos...');
  renderHistory(DEFAULT_HISTORY_MATCHES);
  setupHistoryEventListeners(router);

  const liveMatches = await fetchMatchHistory();
  renderHistory(liveMatches);
}

export const initHistoryView = initHistory;

if (document.getElementById('history-view')) {
  setupHistoryEventListeners();
}
