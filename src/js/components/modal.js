/**
 * @file modal.js
 * @description Módulo controlador reutilizable para el PopUp / Modal de Resultado del Partido.
 * Permite instanciar y abrir dinámicamente el modal con datos del encuentro, animaciones y gestión accesible de eventos.
 *
 * @exports { openMatchResultModal, closeModal, DEFAULT_MATCH_RESULT_DATA }
 */

/**
 * Datos por defecto alineados al prototipo visual de la aplicación.
 */
export const DEFAULT_MATCH_RESULT_DATA = {
  homeTeam: 'Tu Equipo',
  awayTeam: 'Equipo Rival',
  homeScore: 3,
  awayScore: 1,
  resultType: 'VICTORIA', // 'VICTORIA' | 'DERROTA' | 'EMPATE'
  mvp: {
    name: 'L. Messi',
    initials: 'LM',
    avatarUrl: null,
    stats: '2 Goles, 1 Asistencia',
    rating: 9.8
  },
  ranking: {
    pointsGained: '+15 Puntos',
    currentRank: '#430'
  }
};

/**
 * Referencia a la función de escucha de tecla Escape para limpieza segura.
 */
let escapeKeyListener = null;

/**
 * Abre el modal de Resultado del Partido poblándolo dinámicamente.
 * @param {typeof DEFAULT_MATCH_RESULT_DATA} data - Información del partido y MVP.
 * @param {Object} options - Callbacks opcionales de navegación.
 * @param {Function} [options.onNextMatch] - Acción al pulsar 'BUSCAR SIGUIENTE PARTIDO'.
 * @param {Function} [options.onGoHome] - Acción al pulsar 'VOLVER AL INICIO'.
 * @param {Function} [options.onClose] - Callback al cerrar el modal.
 */
export function openMatchResultModal(data = DEFAULT_MATCH_RESULT_DATA, options = {}) {
  // 1. Cerrar cualquier modal previo existente
  closeModal(false);

  // 2. Localizar o crear el contenedor de modales
  let container = document.getElementById('app-modal-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'app-modal-container';
    document.body.appendChild(container);
  }

  // 3. Crear el marcado HTML del modal
  const modalHTML = `
    <div class="match-result-overlay" id="match-result-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-result-title">
      <div class="match-result-modal" id="match-result-modal">

        <!-- HEADER DEL MODAL -->
        <header class="modal-header">
          <h2 class="modal-header__title" id="modal-result-title">Resultado del Partido</h2>
          <button type="button" class="modal-close-btn" id="modal-result-close" aria-label="Cerrar resultado">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        <div class="modal-body">
          <!-- MARCADOR PRINCIPAL -->
          <section class="modal-scoreboard" aria-label="Marcador final">
            <div class="modal-scoreboard__teams">
              <span class="modal-team-name modal-team-name--home" id="modal-home-team">Tu Equipo</span>
              <div class="modal-score-display" id="modal-score-display">
                <span id="modal-home-score">3</span>
                <span class="score-dash">–</span>
                <span id="modal-away-score">1</span>
              </div>
              <span class="modal-team-name modal-team-name--away" id="modal-away-team">Equipo Rival</span>
            </div>

            <div class="modal-result-badge modal-result-badge--win" id="modal-result-badge">
              VICTORIA
            </div>
          </section>

          <!-- JUGADOR DEL PARTIDO (MVP) -->
          <article class="modal-subcard mvp-subcard" aria-labelledby="mvp-subcard-title">
            <span class="subcard-micro-label" id="mvp-subcard-title">JUGADOR DEL PARTIDO</span>
            <div class="mvp-subcard__content">
              <div class="mvp-subcard__player">
                <div class="mvp-avatar-circle" id="modal-mvp-avatar" aria-label="Iniciales del jugador">
                  ${data.mvp?.initials || 'LM'}
                </div>
                <div class="mvp-info">
                  <h3 class="mvp-name" id="modal-mvp-name">${data.mvp?.name || 'L. Messi'}</h3>
                  <span class="mvp-stats" id="modal-mvp-stats">${data.mvp?.stats || '2 Goles, 1 Asistencia'}</span>
                </div>
              </div>

              <div class="mvp-rating-box">
                <span class="rating-label">Valoración</span>
                <strong class="rating-value" id="modal-mvp-rating">${Number(data.mvp?.rating ?? 9.8).toFixed(1)}</strong>
              </div>
            </div>
          </article>

          <!-- ACTUALIZACIÓN DE CLASIFICACIÓN -->
          <article class="modal-subcard ranking-subcard" aria-labelledby="ranking-subcard-title">
            <h3 class="ranking-subcard__title" id="ranking-subcard-title">Actualización de Clasificación</h3>
            <div class="ranking-subcard__content">
              <strong class="points-gained" id="modal-points-gained">${data.ranking?.pointsGained || '+15 Puntos'}</strong>
              <span class="current-rank-label">
                Puesto Actual: <strong class="current-rank-value" id="modal-current-rank">${data.ranking?.currentRank || '#430'}</strong>
              </span>
            </div>
          </article>

          <!-- BOTONES DE ACCIÓN -->
          <div class="modal-actions">
            <button type="button" class="btn btn--primary btn-modal-primary" id="modal-btn-next-match">
              BUSCAR SIGUIENTE PARTIDO
            </button>
            <button type="button" class="btn btn--secondary btn-modal-secondary" id="modal-btn-home">
              VOLVER AL INICIO
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  container.innerHTML = modalHTML;

  // 4. Poblar y estilizar dinámicamente los datos
  populateModalData(data);

  // 5. Configurar escuchadores de eventos
  setupModalEventListeners(options);
}

/**
 * Rellena los datos dinámicos en el DOM del modal.
 */
function populateModalData(data = DEFAULT_MATCH_RESULT_DATA) {
  const homeTeamEl = document.getElementById('modal-home-team');
  if (homeTeamEl && data.homeTeam) homeTeamEl.textContent = data.homeTeam;

  const awayTeamEl = document.getElementById('modal-away-team');
  if (awayTeamEl && data.awayTeam) awayTeamEl.textContent = data.awayTeam;

  const homeScoreEl = document.getElementById('modal-home-score');
  if (homeScoreEl && data.homeScore !== undefined) homeScoreEl.textContent = data.homeScore.toString();

  const awayScoreEl = document.getElementById('modal-away-score');
  if (awayScoreEl && data.awayScore !== undefined) awayScoreEl.textContent = data.awayScore.toString();

  // Badge de resultado (Victoria / Derrota / Empate)
  const resultBadgeEl = document.getElementById('modal-result-badge');
  if (resultBadgeEl) {
    const type = (data.resultType || 'VICTORIA').toUpperCase();
    resultBadgeEl.textContent = type;
    resultBadgeEl.className = 'modal-result-badge';

    if (type.includes('DERROTA')) {
      resultBadgeEl.classList.add('modal-result-badge--loss');
    } else if (type.includes('EMPATE')) {
      resultBadgeEl.classList.add('modal-result-badge--draw');
    } else {
      resultBadgeEl.classList.add('modal-result-badge--win');
    }
  }

  // Avatar de iniciales o imagen
  const mvpAvatarEl = document.getElementById('modal-mvp-avatar');
  if (mvpAvatarEl) {
    if (data.mvp?.avatarUrl) {
      mvpAvatarEl.innerHTML = `<img src="${data.mvp.avatarUrl}" alt="${data.mvp.name}">`;
    } else {
      mvpAvatarEl.textContent = data.mvp?.initials || getInitials(data.mvp?.name || 'LM');
    }
  }
}

/**
 * Obtiene iniciales a partir de un nombre (ej. "Lionel Messi" -> "LM").
 */
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Configura los event listeners para el cierre e interacción del modal.
 */
function setupModalEventListeners(options = {}) {
  const overlay = document.getElementById('match-result-overlay');
  const modal = document.getElementById('match-result-modal');
  const closeBtn = document.getElementById('modal-result-close');
  const btnNextMatch = document.getElementById('modal-btn-next-match');
  const btnHome = document.getElementById('modal-btn-home');

  // 1. Cierre al pulsar el botón 'X'
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      closeModal();
      if (typeof options.onClose === 'function') options.onClose();
    });
  }

  // 2. Cierre al hacer clic en el backdrop oscuro exterior
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (modal && !modal.contains(e.target)) {
        closeModal();
        if (typeof options.onClose === 'function') options.onClose();
      }
    });
  }

  // 3. Cierre al pulsar la tecla Escape
  if (escapeKeyListener) {
    document.removeEventListener('keydown', escapeKeyListener);
  }
  escapeKeyListener = (e) => {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeModal();
      if (typeof options.onClose === 'function') options.onClose();
    }
  };
  document.addEventListener('keydown', escapeKeyListener);

  // 4. Acción: 'BUSCAR SIGUIENTE PARTIDO'
  if (btnNextMatch) {
    btnNextMatch.addEventListener('click', () => {
      console.info('[Modal] Acción: Buscar Siguiente Partido');
      closeModal();
      if (typeof options.onNextMatch === 'function') {
        options.onNextMatch();
      } else {
        // Redirección por defecto a búsqueda o recarga de simulación
        if (window.location.hash) {
          window.location.hash = '#/match/live';
        } else {
          window.location.href = 'match-detail.html';
        }
      }
    });
  }

  // 5. Acción: 'VOLVER AL INICIO'
  if (btnHome) {
    btnHome.addEventListener('click', () => {
      console.info('[Modal] Acción: Volver al Inicio');
      closeModal();
      if (typeof options.onGoHome === 'function') {
        options.onGoHome();
      } else {
        // Redirección por defecto a la vista principal
        if (window.location.hash) {
          window.location.hash = '#/dashboard';
        } else {
          window.location.href = 'home.html';
        }
      }
    });
  }
}

/**
 * Cierra y desmonta el modal con animación suave de salida.
 * @param {boolean} animated - Si debe reproducir la animación de salida (por defecto true).
 */
export function closeModal(animated = true) {
  const overlay = document.getElementById('match-result-overlay');
  if (!overlay) return;

  // Limpiar escuchador de tecla Escape
  if (escapeKeyListener) {
    document.removeEventListener('keydown', escapeKeyListener);
    escapeKeyListener = null;
  }

  if (animated) {
    overlay.classList.add('is-closing');
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }, 150);
  } else {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
  }
}
