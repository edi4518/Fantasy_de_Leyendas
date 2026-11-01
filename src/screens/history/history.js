/**
 * @file history.js
 * @description Controlador modular para la vista de Historial de Partidos de Fantasy de Leyendas.
 * Consume el endpoint GET /api/matches/history, gestiona el renderizado dinámico de tarjetas
 * y coordina la navegación al detalle de cada enfrentamiento.
 *
 * @exports { initHistory, initHistoryView, fetchMatchHistory, renderHistory, DEFAULT_HISTORY_MATCHES }
 */

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
    resultType: 'win'
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
    resultType: 'draw'
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
    resultType: 'loss'
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
    resultType: 'win'
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
    resultType: 'draw'
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
    resultType: 'win'
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
    resultType: 'loss'
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
    resultType: 'win'
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
    resultType: 'draw'
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
    resultType: 'win'
  }
];

/**
 * Consulta el historial de partidos disputados desde la API de FastAPI o LocalStorage.
 * @returns {Promise<Array>} Lista de registros de partidos.
 */
export async function fetchMatchHistory() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  try {
    const response = await fetch('/api/matches/history', { headers });
    if (response.ok) {
      const data = await response.json();
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
    let homeScore = item.home_score ?? item.homeScore;
    let awayScore = item.away_score ?? item.awayScore;

    if (homeScore === undefined && item.score) {
      const parts = item.score.split('-').map(s => parseInt(s.trim(), 10));
      homeScore = isNaN(parts[0]) ? 0 : parts[0];
      awayScore = isNaN(parts[1]) ? 0 : parts[1];
    }

    homeScore = homeScore ?? 0;
    awayScore = awayScore ?? 0;

    const opponentName = item.opponent_name || item.away_team_name || item.rival || item.opponent || `Rival ${index + 1}`;

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
      relativeDate: item.relative_date || item.date || item.fecha || 'Reciente',
      homeTeam: item.home_team_name || item.homeTeam || 'Tu Equipo',
      awayTeam: opponentName,
      awayTeamDisplay: opponentName.length > 13 ? `${opponentName.substring(0, 12)}...` : opponentName,
      homeScore,
      awayScore,
      points: item.points_obtained ?? item.puntos ?? points,
      resultType
    };
  });
}

/**
 * Renderiza dinámicamente el listado de tarjetas de partidos en el DOM.
 * @param {Array} matches
 */
export function renderHistory(matches = DEFAULT_HISTORY_MATCHES) {
  const container = document.getElementById('history-cards-container');
  const subtitleEl = document.getElementById('history-subtitle');

  if (subtitleEl) {
    subtitleEl.textContent = `Mostrando los últimos ${matches.length} resultados`;
  }

  if (!container) return;

  if (!Array.isArray(matches) || matches.length === 0) {
    container.innerHTML = `
      <div class="history-empty-state">
        <span class="history-empty-icon" aria-hidden="true">⚽</span>
        <h3 class="history-empty-title">Sin partidos disputados</h3>
        <p class="history-empty-desc">Aún no has simulado encuentros esta temporada. Busca un rival desde el Inicio para empezar a competir.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = matches
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
            <a href="/match/live?id=${match.id}" data-link class="match-details-link" data-id="${match.id}" aria-label="Ver detalles del partido contra ${match.opponent}">
              Ver detalles &gt;
            </a>
          </div>
        </article>
      `;
    })
    .join('');
}

/**
 * Configura los event listeners para navegación y clics en 'Ver detalles'.
 * @param {Object} [router]
 */
export function setupHistoryEventListeners(router) {
  const container = document.getElementById('history-cards-container');

  if (container) {
    container.addEventListener('click', (e) => {
      const link = e.target.closest('.match-details-link');
      if (link) {
        e.preventDefault();
        const matchId = link.getAttribute('data-id');
        console.info(`[History] Navegando a detalle del partido #${matchId}`);

        if (router && typeof router.navigate === 'function') {
          router.navigate(`/match/live?id=${matchId}`);
        } else {
          window.location.href = `/match/live?id=${matchId}`;
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
