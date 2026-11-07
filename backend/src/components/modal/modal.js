/**
 * @file modal.js
 * @description Módulo controlador reutilizable para el PopUp / Modal de Resultado del Partido.
 * Permite instanciar y abrir dinámicamente el modal con datos del encuentro, animaciones y gestión accesible de eventos.
 *
 * @exports { openMatchResultModal, closeModal, DEFAULT_MATCH_RESULT_DATA }
 */

const SUPABASE_PLAYERS_BASE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';

const MODAL_MVP_IMAGE_ALIASES = {
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
  'alessandro nesta': 'alessandro_nesta.webp'
};

function resolveModalMvpAvatarUrl(mvp = {}) {
  const direct = mvp?.avatarUrl || mvp?.photo_url || mvp?.image_filename || '';
  if (direct) {
    return direct.startsWith('http') || direct.startsWith('/') ? direct : `${SUPABASE_PLAYERS_BASE_URL}${direct}`;
  }

  const normalized = String(mvp?.name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized) return `${SUPABASE_PLAYERS_BASE_URL}lionel_messi.webp`;
  if (MODAL_MVP_IMAGE_ALIASES[normalized]) {
    return `${SUPABASE_PLAYERS_BASE_URL}${MODAL_MVP_IMAGE_ALIASES[normalized]}`;
  }

  const slug = normalized.replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_');
  return slug ? `${SUPABASE_PLAYERS_BASE_URL}${slug}.webp` : `${SUPABASE_PLAYERS_BASE_URL}lionel_messi.webp`;
}

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
    avatarUrl: 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/lionel_messi.webp',
    stats: '2 Goles, 1 Asistencia',
    rating: 9.8
  },
  ranking: {
    pointsGained: '+25 Puntos',
    currentRank: '—'
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

  // Determinar clases de estilo según el resultado del partido y los puntos
  const resultTypeUpper = (data.resultType || 'VICTORIA').toUpperCase();
  const rawPoints = String(data.ranking?.pointsGained ?? '+15 Puntos');
  const isLossResult = resultTypeUpper.includes('DERROTA') || rawPoints.trim().startsWith('-');
  const isDrawResult = resultTypeUpper.includes('EMPATE');
  const pointsModifierClass = isLossResult ? 'points-gained--loss' : (isDrawResult ? 'points-gained--draw' : '');

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
          <article class="modal-subcard mvp-subcard ${data.mvp?.isRival ? 'mvp-subcard--rival' : ''}" aria-labelledby="mvp-subcard-title">
            <span class="subcard-micro-label" id="mvp-subcard-title">${data.mvp?.isRival ? 'JUGADOR DEL PARTIDO · RIVAL' : 'JUGADOR DEL PARTIDO'}</span>
            <div class="mvp-subcard__content">
              <div class="mvp-subcard__player">
                <div class="mvp-avatar-circle ${data.mvp?.isRival ? 'mvp-avatar-circle--rival' : ''}" id="modal-mvp-avatar" aria-label="Imagen del jugador MVP">
                  <img src="${resolveModalMvpAvatarUrl(data.mvp)}" alt="${data.mvp?.name || 'MVP'}" class="mvp-avatar-circle__img" loading="lazy" />
                </div>
                <div class="mvp-info">
                  <div class="mvp-name-row">
                    <h3 class="mvp-name" id="modal-mvp-name">${data.mvp?.name || 'L. Messi'}</h3>
                    <span class="mvp-team-badge ${data.mvp?.isRival ? 'mvp-team-badge--rival' : 'mvp-team-badge--home'}" id="modal-mvp-team">
                      ${data.mvp?.teamName || (data.mvp?.isRival ? 'Equipo Rival' : 'Tu Equipo')}
                    </span>
                  </div>
                  <span class="mvp-stats" id="modal-mvp-stats">${data.mvp?.stats || '2 Goles, 1 Asistencia'}</span>
                </div>
              </div>

              <div class="mvp-rating-box">
                <span class="rating-label">Valoración</span>
                <strong class="rating-value ${data.mvp?.isRival ? 'rating-value--rival' : ''}" id="modal-mvp-rating">${Number(data.mvp?.rating ?? 9.8).toFixed(1)}</strong>
              </div>
            </div>
          </article>

          <!-- ACTUALIZACIÓN DE CLASIFICACIÓN -->
          <article class="modal-subcard ranking-subcard" aria-labelledby="ranking-subcard-title">
            <h3 class="ranking-subcard__title" id="ranking-subcard-title">Actualización de Clasificación</h3>
            <div class="ranking-subcard__content">
              <strong class="points-gained ${pointsModifierClass}" id="modal-points-gained">${rawPoints}</strong>
              <span class="current-rank-label">
                Puesto Actual: <strong class="current-rank-value" id="modal-current-rank">${data.ranking?.currentRank || '—'}</strong>
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

  // Puntos ganados o perdidos con color reactivo
  const pointsEl = document.getElementById('modal-points-gained');
  if (pointsEl) {
    if (data.ranking?.pointsGained !== undefined) {
      pointsEl.textContent = data.ranking.pointsGained;
    }
    const currentPointsText = pointsEl.textContent || '';
    const loss = (data.resultType || '').toUpperCase().includes('DERROTA') || currentPointsText.trim().startsWith('-');
    const draw = (data.resultType || '').toUpperCase().includes('EMPATE');
    pointsEl.classList.toggle('points-gained--loss', loss);
    pointsEl.classList.toggle('points-gained--draw', draw);
  }

  const rankEl = document.getElementById('modal-current-rank');
  if (rankEl && data.ranking?.currentRank !== undefined) {
    rankEl.textContent = data.ranking.currentRank;
  }

  // Actualización dinámica del MVP (soporte local y rival con badge de equipo)
  const mvpSubcard = document.querySelector('.mvp-subcard');
  const mvpTitleEl = document.getElementById('mvp-subcard-title');
  const mvpNameEl = document.getElementById('modal-mvp-name');
  const mvpTeamEl = document.getElementById('modal-mvp-team');
  const mvpStatsEl = document.getElementById('modal-mvp-stats');
  const mvpRatingEl = document.getElementById('modal-mvp-rating');
  const mvpAvatarEl = document.getElementById('modal-mvp-avatar');

  if (data.mvp) {
    if (mvpNameEl && data.mvp.name) mvpNameEl.textContent = data.mvp.name;
    if (mvpTeamEl) {
      const tName = data.mvp.teamName || (data.mvp.isRival ? 'Equipo Rival' : 'Tu Equipo');
      mvpTeamEl.textContent = tName;
      mvpTeamEl.className = `mvp-team-badge ${data.mvp.isRival ? 'mvp-team-badge--rival' : 'mvp-team-badge--home'}`;
    }
    if (mvpStatsEl) {
      mvpStatsEl.textContent = data.mvp.stats || 'Rendimiento destacado';
    }
    if (mvpRatingEl && data.mvp.rating !== undefined) {
      mvpRatingEl.textContent = Number(data.mvp.rating).toFixed(1);
    }

    if (data.mvp.isRival) {
      if (mvpSubcard) mvpSubcard.classList.add('mvp-subcard--rival');
      if (mvpTitleEl) mvpTitleEl.textContent = 'JUGADOR DEL PARTIDO · RIVAL';
      if (mvpAvatarEl) mvpAvatarEl.classList.add('mvp-avatar-circle--rival');
      if (mvpRatingEl) mvpRatingEl.classList.add('rating-value--rival');
    } else {
      if (mvpSubcard) mvpSubcard.classList.remove('mvp-subcard--rival');
      if (mvpTitleEl) mvpTitleEl.textContent = 'JUGADOR DEL PARTIDO';
      if (mvpAvatarEl) mvpAvatarEl.classList.remove('mvp-avatar-circle--rival');
      if (mvpRatingEl) mvpRatingEl.classList.remove('rating-value--rival');
    }

    if (mvpAvatarEl) {
      const resolvedAvatarUrl = resolveModalMvpAvatarUrl(data.mvp);
      const fallbackInitials = data.mvp.initials || getInitials(data.mvp.name || 'LM');
      if (resolvedAvatarUrl) {
        mvpAvatarEl.innerHTML = `<img src="${resolvedAvatarUrl}" alt="${data.mvp.name || 'MVP'}" class="mvp-avatar-circle__img" loading="lazy" />`;
        const imgEl = mvpAvatarEl.querySelector('img');
        if (imgEl) {
          imgEl.addEventListener('error', () => {
            mvpAvatarEl.textContent = fallbackInitials;
          }, { once: true });
        }
      } else {
        mvpAvatarEl.textContent = fallbackInitials;
      }
    }
  }
}

/**
 * Obtiene iniciales a partir de un nombre (ej. "Lionel Messi" -> "LM").
 */
export function getInitials(name = '') {
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
