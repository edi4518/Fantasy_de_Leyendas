/**
 * @file market.js
 * @description Controlador para la pantalla de Mercado de Fichajes de Leyendas.
 * Conectado en tiempo real con la API FastAPI (/api/players), la persistencia de la plantilla
 * y la bandeja interactiva de selección para comparar y fichar.
 *
 * @exports { renderMarketScreen }
 */

import { playerService } from '../../services/player-service.js';
import { squadService } from '../../services/squad-service.js';
import { getRatingTierClass } from '../lineup/lineup.js';

const STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';

const POSITION_NAMES = {
  POR: 'Portero',
  DEF: 'Defensa',
  MC: 'Centrocampista',
  DEL: 'Delantero'
};

const POSITION_DETAILS = {
  POR: 'Portero titular',
  DEF: 'Defensa central',
  MC: 'Medio organizador',
  DEL: 'Delantero estrella'
};

/**
 * Punto de entrada principal invocado por router.js
 */
export async function renderMarketScreen(container, router) {
  const targetContainer = container || document.querySelector('#app-content');
  if (!targetContainer) return;

  initMarketController(targetContainer, router);
}

/**
 * Inicializador de la lógica y eventos del mercado
 */
async function initMarketController(container, router) {
  const listAvailable = container.querySelector('#market-player-list');
  const listSquad = container.querySelector('#my-squad-player-list');
  const searchInput = container.querySelector('#market-search-input');
  const filterBtns = container.querySelectorAll('.filter-pill');
  const sortBtn = container.querySelector('#btn-sort-market');
  const traySection = container.querySelector('#selected-players-tray');
  const trayChips = container.querySelector('#tray-chips-container');
  const trayCountBadge = container.querySelector('#tray-count-badge');
  const trayTotalPrice = container.querySelector('#tray-total-price');
  const bottomDock = container.querySelector('#market-bottom-dock');
  const btnCompare = container.querySelector('#btn-go-to-compare');
  const btnBuy = container.querySelector('#btn-buy-selected');
  const compareCountSpan = container.querySelector('#compare-count');
  const buyTotalSpan = container.querySelector('#buy-total-price');
  const budgetAvailableEl = container.querySelector('#market-budget-available');
  const squadCountEl = container.querySelector('#market-squad-count');
  const squadBadgeEl = container.querySelector('#squad-section-count-badge');
  const squadValueEl = container.querySelector('#squad-total-value-num');
  const squadSectionEl = container.querySelector('#my-squad-section') || container.querySelector('.market-section--squad');
  const squadHeaderEl = container.querySelector('#squad-section-header');
  const btnToggleSquad = container.querySelector('#btn-toggle-squad');
  const toggleSquadLabel = container.querySelector('#toggle-squad-label');

  // Elementos del Modal Bottom-Sheet de Estadísticas Individuales
  const modalBackdrop = container.querySelector('#market-player-modal-backdrop');
  const modalSheet = container.querySelector('#market-player-modal-sheet');
  const btnCloseModal = container.querySelector('#btn-close-player-modal');
  const modalAvatarContainer = container.querySelector('#market-modal-avatar-container');
  const modalPlayerName = container.querySelector('#market-modal-player-name');
  const modalRating = container.querySelector('#market-modal-rating');
  const modalRoleBadge = container.querySelector('#market-modal-role-badge');
  const modalRoleDesc = container.querySelector('#market-modal-role-desc');
  const modalPrice = container.querySelector('#market-modal-price');
  const modalRadarLegend = container.querySelector('#market-modal-radar-legend');
  const modalBenchmarkTitle = container.querySelector('#market-modal-benchmark-title');
  const modalBenchmarkList = container.querySelector('#market-modal-benchmark-list');
  const radarCanvas = container.querySelector('#marketPlayerRadarChart');

  let marketRadarChartInstance = null;

  if (!listAvailable) return;

  let catalog = [];
  let activeSquad = loadActiveSquadFromStorage();
  let selectedPosition = 'ALL';
  let searchQuery = '';
  let sortMode = 'default'; // 'default' | 'price-desc' | 'price-asc'
  let selectedForAction = new Set(); // IDs de jugadores seleccionados con (+)

  listAvailable.innerHTML = '<p class="market-feedback-msg p-6 text-center text-sm text-[#6B7280]">Conectando con la base de datos de leyendas...</p>';

  try {
    catalog = await playerService.getAllPlayers();
    try {
      const remoteRes = await squadService.getMySquad();
      if (remoteRes && remoteRes.squad && Array.isArray(remoteRes.squad.players)) {
        activeSquad = {
          name: remoteRes.squad.name || activeSquad.name || 'Tu Equipo',
          formation: remoteRes.squad.formation || activeSquad.formation || '1-2-2-1',
          players: remoteRes.squad.players
        };
        ensureTenSlots(activeSquad);
        localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
      }
    } catch (_) {
      // Si no hay plantilla previa en BD, se mantiene la local
    }
    renderAllViews();
  } catch (err) {
    console.error('[Market] Error al conectar con la API de jugadores:', err);
    listAvailable.innerHTML = '<p class="market-feedback-msg p-6 text-center text-sm text-[#C92A2A]">No se pudo conectar con el servidor de la API.</p>';
  }

  // =============================================================================
  // EVENT LISTENERS
  // =============================================================================

  // Desplegar / contraer la sección "Mi Plantilla / Fichados"
  const toggleSquadCollapse = () => {
    if (!squadSectionEl) return;
    const isCollapsed = squadSectionEl.classList.toggle('is-collapsed');
    if (btnToggleSquad) {
      btnToggleSquad.setAttribute('aria-expanded', String(!isCollapsed));
    }
    if (toggleSquadLabel) {
      toggleSquadLabel.textContent = isCollapsed ? 'Mostrar' : 'Ocultar';
    }
  };

  if (btnToggleSquad) {
    btnToggleSquad.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSquadCollapse();
    });
  }

  if (squadHeaderEl) {
    squadHeaderEl.addEventListener('click', () => {
      toggleSquadCollapse();
    });
  }

  // Búsqueda en vivo
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderAvailableList();
    });
  }

  // Filtros de Posición
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => {
        b.classList.remove('active', 'bg-[#2D6A4F]', 'text-white');
        b.classList.add('bg-white', 'text-[#212529]', 'border', 'border-[#DEE2E6]');
      });
      btn.classList.add('active', 'bg-[#2D6A4F]', 'text-white');
      btn.classList.remove('bg-white', 'text-[#212529]');
      selectedPosition = btn.dataset.position || 'ALL';
      renderAvailableList();
    });
  });

  // Ordenar por precio
  if (sortBtn) {
    sortBtn.addEventListener('click', () => {
      if (sortMode === 'default') sortMode = 'price-desc';
      else if (sortMode === 'price-desc') sortMode = 'price-asc';
      else sortMode = 'default';

      sortBtn.style.color = sortMode !== 'default' ? '#2D6A4F' : '#6B7280';
      renderAvailableList();
    });
  }

  // Botón Comparar
  if (btnCompare) {
    btnCompare.addEventListener('click', () => {
      if (selectedForAction.size < 2) return;
      const idsArray = Array.from(selectedForAction).map((id) => Number(id)).filter(Boolean);
      const ids = idsArray.join(',');

      // Persistir selección para garantizar que la pantalla Comparativa refleje los jugadores elegidos
      try {
        const squadPlayers = (activeSquad.players || []).filter(Boolean);
        const allKnownPlayers = [...catalog, ...squadPlayers];
        const selectedPlayersData = idsArray
          .map((id) => allKnownPlayers.find((p) => Number(p.id) === id))
          .filter(Boolean);
        localStorage.setItem('fantasy_compare_ids', JSON.stringify(idsArray));
        localStorage.setItem('fantasy_compare_players', JSON.stringify(selectedPlayersData));
      } catch (err) {
        console.warn('[Market] No se pudo guardar la selección de comparativa en localStorage:', err);
      }

      router.navigate(`/comparison?ids=${ids}`);
    });
  }

  // Botón Fichar Jugadores Seleccionados
  if (btnBuy) {
    btnBuy.addEventListener('click', () => {
      handleBuySelected();
    });
  }

  // Delegación de eventos en el contenedor
  container.addEventListener('click', (e) => {
    // 1. Eliminar futbolistas de la bandeja
    const removeBtn = e.target.closest('.btn-remove-tray');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = removeBtn.getAttribute('data-id') || removeBtn.dataset.id;
      removeSelectedPlayer(id);
      return;
    }

    // 2. Click en avatar, nombre o info izquierda del jugador -> Abrir modal de estadísticas
    const playerRowLeft = e.target.closest('.player-row-left');
    if (playerRowLeft) {
      const rowItem = playerRowLeft.closest('.player-row-item');
      if (rowItem && rowItem.dataset.id) {
        const playerId = parseInt(rowItem.dataset.id, 10);
        if (playerId) {
          openPlayerStatsModal(playerId);
        }
      }
    }
  });

  // Eventos para cerrar el Modal Bottom-Sheet de Estadísticas
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', (e) => {
      e.preventDefault();
      closePlayerStatsModal();
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', () => {
      closePlayerStatsModal();
    });
  }

  const handleEscKey = (e) => {
    if (e.key === 'Escape' && modalSheet && !modalSheet.hidden) {
      closePlayerStatsModal();
    }
  };
  window.addEventListener('keydown', handleEscKey);

  /**
   * Abre el Modal Bottom-Sheet con el Radar Táctico y Benchmark Estadístico del Jugador
   */
  async function openPlayerStatsModal(playerId) {
    const idNum = Number(playerId);
    let player = (catalog || []).find((p) => Number(p.id) === idNum);
    if (!player) {
      player = (activeSquad.players || []).find((p) => p && Number(p.id) === idNum);
    }
    if (!player) return;

    if (!window.Chart) {
      await loadChartJs();
    }

    const positionLabel = player.posicion_base || player.role || 'MC';
    const posClass = `player-slot--${positionLabel.toLowerCase()}`;
    const detailLabel = player.posicion_detalle || POSITION_NAMES[positionLabel] || positionLabel;
    const rating = player.media_juego || player.rating_general || 75;
    const price = Number(player.precio || 10).toFixed(1).replace('.0', '');
    const rawImage = player.image_filename || player.avatarUrl || player.photo_url || player.image_url || player.imagen;
    const playerImage = rawImage
      ? (rawImage.startsWith('http://') || rawImage.startsWith('https://') ? rawImage : `${STORAGE_URL}${rawImage}`)
      : null;
    const initials = (player.nombre || player.name || 'PL')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2);

    // Cabecera del modal
    if (modalAvatarContainer) {
      modalAvatarContainer.className = `market-player-sheet__avatar player-slot__avatar ${posClass}`;
      modalAvatarContainer.dataset.position = positionLabel;
      modalAvatarContainer.innerHTML = playerImage
        ? `<img src="${playerImage}" alt="${player.nombre || player.name}" class="player-slot__img" onerror="this.outerHTML='<span class=\\'comp-avatar-initials\\'>${initials}</span>'" />`
        : `<span class="comp-avatar-initials">${initials}</span>`;
    }

    if (modalPlayerName) {
      modalPlayerName.textContent = player.nombre || player.name || 'Jugador';
    }

    if (modalRating) {
      modalRating.textContent = rating;
      modalRating.className = `player-rating-star ${getRatingTierClass(rating)}`;
    }

    if (modalRoleBadge) {
      modalRoleBadge.textContent = positionLabel;
      modalRoleBadge.className = `player-role-badge player-role-badge--${positionLabel.toLowerCase()}`;
    }

    if (modalRoleDesc) {
      modalRoleDesc.textContent = detailLabel;
    }

    if (modalPrice) {
      modalPrice.textContent = `${price}M €`;
    }

    // Renderizar Radar Táctico Hexagonal
    renderSinglePlayerRadar(player);

    // Renderizar Benchmark Estadístico Posicional
    renderSinglePlayerBenchmarks(player);

    // Mostrar modal con animación slide-up
    if (modalBackdrop && modalSheet) {
      modalBackdrop.classList.remove('is-closing');
      modalSheet.classList.remove('is-closing');
      modalBackdrop.hidden = false;
      modalSheet.hidden = false;
    }
  }

  /**
   * Cierra el modal con animación suave hacia abajo (slide-down)
   */
  function closePlayerStatsModal() {
    if (!modalBackdrop || !modalSheet || modalSheet.hidden) return;
    modalBackdrop.classList.add('is-closing');
    modalSheet.classList.add('is-closing');
    setTimeout(() => {
      modalBackdrop.hidden = true;
      modalSheet.hidden = true;
      modalBackdrop.classList.remove('is-closing');
      modalSheet.classList.remove('is-closing');
      if (marketRadarChartInstance) {
        marketRadarChartInstance.destroy();
        marketRadarChartInstance = null;
      }
    }, 220);
  }

  /**
   * Renderiza el gráfico de radar hexagonal (Chart.js)
   */
  function renderSinglePlayerRadar(player) {
    if (!radarCanvas || !window.Chart) return;

    if (marketRadarChartInstance) {
      marketRadarChartInstance.destroy();
      marketRadarChartInstance = null;
    }

    const pName = player.nombre || player.name || 'Jugador';

    if (modalRadarLegend) {
      modalRadarLegend.innerHTML = `
        <div class="comp-legend-item" style="--player-color: #2D6A4F;">
          <span class="comp-legend-dot"></span>
          <span class="comp-legend-name">${pName}</span>
        </div>
      `;
    }

    marketRadarChartInstance = new window.Chart(radarCanvas, {
      type: 'radar',
      data: {
        labels: ['ATAQUE', 'CREACIÓN', 'TÉCNICA', 'DEFENSA', 'FÍSICO', 'PALMARÉS'],
        datasets: [{
          label: pName,
          data: [
            player.rating_ataque ?? 50,
            player.rating_creacion ?? 50,
            player.rating_tecnica ?? 50,
            player.rating_defensa ?? 50,
            player.rating_fisico ?? 50,
            player.rating_palmares ?? 50
          ],
          backgroundColor: 'rgba(45, 106, 79, 0.2)',
          borderColor: '#2D6A4F',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#2D6A4F'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 20 },
            grid: { color: '#e2e8f0' },
            angleLines: { color: '#cbd5e1' }
          }
        }
      }
    });
  }

  /**
   * Renderiza los benchmarks estadísticos correspondientes a la posición del jugador
   */
  function renderSinglePlayerBenchmarks(player) {
    if (!modalBenchmarkList) return;

    const primaryPos = (player.posicion_base || player.role || 'DEL').toUpperCase();
    let metrics = [];
    let posName = 'DELANTEROS';

    if (primaryPos.includes('POR')) {
      posName = 'ARQUEROS';
      metrics = [
        { title: 'VALLAS INVICTAS', key: 'vallas_invictas', badge: 'MÁXIMO', unit: '' },
        { title: 'RECUPERACIONES / 90 MIN', key: 'recuperaciones_p90', badge: 'TOP', unit: '' },
        { title: 'NOTA MEDIA', key: 'media_juego', badge: 'LÍDER', unit: '' },
        { title: 'RATING DEFENSA', key: 'rating_defensa', badge: 'ÉLITE', unit: '' },
        { title: 'RATING FÍSICO', key: 'rating_fisico', badge: 'TOP', unit: '' }
      ];
    } else if (primaryPos.includes('DEF')) {
      posName = 'DEFENSORES';
      metrics = [
        { title: 'ENTRADAS / 90 MIN', key: 'entradas_exitosas_p90', badge: 'MÁXIMO', unit: '' },
        { title: 'INTERCEPCIONES / 90 MIN', key: 'intercepciones_p90', badge: 'TOP', unit: '' },
        { title: '% DUELOS DEFENSIVOS', key: 'porcentaje_duelos_defensivos', badge: 'ÉLITE', unit: '%' },
        { title: 'RECUPERACIONES / 90 MIN', key: 'recuperaciones_p90', badge: 'MÁXIMO', unit: '' },
        { title: 'PUNTOS TOTALES', key: 'media_juego', badge: 'LÍDER', unit: '' }
      ];
    } else if (primaryPos.includes('MC') || primaryPos.includes('MED')) {
      posName = 'MEDIOCENTROS';
      metrics = [
        { title: 'PASES CLAVE / 90 MIN', key: 'pases_clave_p90', badge: 'RÉCORD', unit: '' },
        { title: 'PRECISIÓN DE PASE', key: 'precision_pases', badge: 'ÉLITE', unit: '%' },
        { title: 'ASISTENCIAS / 90 MIN', key: 'asistencias_p90', badge: 'TOP', unit: '' },
        { title: 'GOLES / PARTIDO', key: 'goles_p90', badge: 'MÁXIMO', unit: '' },
        { title: 'PUNTOS TOTALES', key: 'media_juego', badge: 'LÍDER', unit: '' }
      ];
    } else {
      posName = 'DELANTEROS';
      metrics = [
        { title: 'GOLES / PARTIDO', key: 'goles_p90', badge: 'MÁXIMO', unit: '' },
        { title: 'OCASIONES CREADAS / 90 MIN', key: 'ocasiones_creadas_p90', badge: 'RÉCORD', unit: '' },
        { title: '% REGATES EXITOSOS', key: 'porcentaje_regates', badge: 'TOP', unit: '%' },
        { title: 'CONVERSIÓN DE GOLES', key: 'conversion_goles', badge: 'ÉLITE', unit: '%' },
        { title: 'PUNTOS TOTALES', key: 'media_juego', badge: 'LÍDER', unit: '' }
      ];
    }

    if (modalBenchmarkTitle) {
      modalBenchmarkTitle.textContent = `[BENCHMARK ESTADÍSTICO — ${posName}]`;
    }

    const pName = player.nombre || player.name || 'Jugador';
    const leaderName = pName.split(' ')[0];

    modalBenchmarkList.innerHTML = metrics.map((m) => {
      const val = Number(player[m.key]) || 0;
      return `
        <div class="comp-bench-card">
          <div class="comp-bench-header">
            <span class="comp-bench-title">${m.title}</span>
            <span class="comp-bench-badge">
              ${m.badge}: ${leaderName} (${val}${m.unit})
            </span>
          </div>
          <div class="comp-bench-row" style="--player-color: #2D6A4F; --bar-width: 100%;">
            <span class="comp-bench-name">${pName}</span>
            <div class="comp-bench-bar-track">
              <div class="comp-bench-bar-fill"></div>
            </div>
            <span class="comp-bench-val">${val}${m.unit}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // =============================================================================
  // MÉTODOS DE RENDERIZADO
  // =============================================================================

  function renderAllViews() {
    renderHeaderStats();
    renderSquadList();
    renderAvailableList();
    renderTrayAndDock();
  }

  /**
   * Actualiza el encabezado con el presupuesto disponible y el conteo de plantilla
   */
  function renderHeaderStats() {
    const squadPlayers = (activeSquad.players || []).filter(Boolean);
    const totalSpent = squadPlayers.reduce((acc, p) => acc + (Number(p.precio) || 0), 0);
    const spentRounded = Math.round(totalSpent * 10) / 10;
    const availableBudget = Math.max(0, Math.round((150.0 - spentRounded) * 10) / 10);

    if (budgetAvailableEl) budgetAvailableEl.textContent = `${availableBudget}M`;
    if (squadCountEl) squadCountEl.textContent = `${squadPlayers.length} / 10`;
    if (squadBadgeEl) squadBadgeEl.textContent = `${squadPlayers.length} / 10`;
    if (squadValueEl) squadValueEl.textContent = `${spentRounded}M`;
  }

  /**
   * Renderiza la sección "Mi Plantilla / Fichados" con botón para vender
   */
  function renderSquadList() {
    if (!listSquad) return;

    const squadPlayers = (activeSquad.players || []).filter(Boolean);

    if (squadPlayers.length === 0) {
      listSquad.innerHTML = '<p class="market-feedback-msg">No tienes futbolistas en la plantilla. Ficha abajo en el mercado.</p>';
      return;
    }

    listSquad.innerHTML = squadPlayers.map((player) => {
      const isSelected = selectedForAction.has(player.id) || selectedForAction.has(Number(player.id)) || selectedForAction.has(String(player.id));
      const playerImage = player.image_filename ? `${STORAGE_URL}${player.image_filename}` : null;
      const positionLabel = player.posicion_base || player.role || 'MC';
      const posClass = `player-slot--${positionLabel.toLowerCase()}`;
      const detailLabel = player.posicion_detalle || POSITION_DETAILS[positionLabel] || 'Jugador de leyenda';
      const rating = player.media_juego || player.rating_general || 75;
      const price = Number(player.precio || 10).toFixed(1).replace('.0', '');

      return `
        <article class="player-row-item" data-purpose="squad-player-item" data-id="${player.id}">
          <div class="player-row-left">
            <div class="player-row-avatar player-slot__avatar ${posClass}" data-position="${positionLabel}">
              ${playerImage
                ? `<img src="${playerImage}" alt="${player.nombre || player.name}" class="player-slot__img" onerror="this.outerHTML='<svg class=\'player-slot__icon\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'1.8\' viewBox=\'0 0 24 24\'><path d=\'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z\' stroke-linecap=\'round\' stroke-linejoin=\'round\'></path></svg>'"/>`
                : `<svg class="player-slot__icon" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
              }
            </div>
            <div class="player-row-info">
              <div class="player-name-row">
                <h3 class="player-row-name">${player.nombre || player.name}</h3>
                <span class="player-rating-star ${getRatingTierClass(rating)}">${rating}</span>
              </div>
              <div class="player-sub-row">
                <span class="player-role-badge player-role-badge--${positionLabel.toLowerCase()}" data-role="${positionLabel}">${positionLabel}</span>
                <span class="player-desc-text">${detailLabel}</span>
              </div>
            </div>
          </div>
          <div class="player-row-right">
            <span class="player-row-price">${price}M</span>
            <button aria-label="Comparar a ${player.nombre || player.name}" title="${isSelected ? 'Quitar de la comparativa' : 'Seleccionar para comparar'}" class="btn-player-action btn-toggle-select ${isSelected ? 'is-selected' : ''}" type="button" data-id="${player.id}">
              ${isSelected
                ? `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                : `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 3h5v5"></path><path d="M4 20L21 3"></path><path d="M21 16v5h-5"></path><path d="M15 15l6 6"></path><path d="M4 4l5 5"></path></svg>`
              }
            </button>
            <button aria-label="Vender a ${player.nombre || player.name}" title="Vender jugador" class="btn-player-action btn-player-action--sell btn-sell-player" type="button" data-id="${player.id}">
              <svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    listSquad.querySelectorAll('.btn-toggle-select').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        toggleSelectPlayer(id);
      });
    });

    listSquad.querySelectorAll('.btn-sell-player').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        handleSellPlayer(id);
      });
    });
  }

  /**
   * Renderiza la lista de "Jugadores Disponibles" en el mercado
   */
  function renderAvailableList() {
    if (!listAvailable) return;

    const squadPlayerIds = new Set(
      (activeSquad.players || []).filter(Boolean).map(p => p.id)
    );

    let filtered = catalog.filter((player) => {
      if (squadPlayerIds.has(player.id)) return false;

      const matchPos = selectedPosition === 'ALL' || player.posicion_base === selectedPosition;
      const matchSearch = (player.nombre || '').toLowerCase().includes(searchQuery);
      return matchPos && matchSearch;
    });

    if (sortMode === 'price-desc') {
      filtered.sort((a, b) => (b.precio || 0) - (a.precio || 0));
    } else if (sortMode === 'price-asc') {
      filtered.sort((a, b) => (a.precio || 0) - (b.precio || 0));
    }

    if (filtered.length === 0) {
      listAvailable.innerHTML = '<p class="market-feedback-msg">No se encontraron futbolistas disponibles con los filtros actuales.</p>';
      return;
    }

    listAvailable.innerHTML = filtered.map((player) => {
      const isSelected = selectedForAction.has(player.id) || selectedForAction.has(Number(player.id)) || selectedForAction.has(String(player.id));
      const playerImage = player.image_filename ? `${STORAGE_URL}${player.image_filename}` : null;
      const positionLabel = player.posicion_base || 'MC';
      const posClass = `player-slot--${positionLabel.toLowerCase()}`;
      const positionReadable = player.posicion_detalle || POSITION_NAMES[positionLabel] || positionLabel;
      const rating = player.media_juego || 75;
      const price = Number(player.precio || 10).toFixed(1).replace('.0', '');

      return `
        <article class="player-row-item" data-purpose="player-item" data-id="${player.id}">
          <div class="player-row-left">
            <div class="player-row-avatar player-slot__avatar ${posClass}" data-position="${positionLabel}">
              ${playerImage
                ? `<img src="${playerImage}" alt="${player.nombre}" class="player-slot__img" onerror="this.outerHTML='<svg class=\\\'player-slot__icon\\\' fill=\\\'none\\\' stroke=\\\'currentColor\\\' stroke-width=\\\'1.8\\\' viewBox=\\\'0 0 24 24\\\'><path d=\\\'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z\\\' stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\'></path></svg>'"/>`
                : `<svg class="player-slot__icon" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
              }
            </div>
            <div class="player-row-info">
              <div class="player-name-row">
                <h3 class="player-row-name">${player.nombre}</h3>
                <span class="player-rating-star ${getRatingTierClass(rating)}">${rating}</span>
              </div>
              <div class="player-sub-row">
                <span class="player-role-badge player-role-badge--${positionLabel.toLowerCase()}" data-role="${positionLabel}">${positionLabel}</span>
                <span class="player-desc-text">${positionReadable}</span>
              </div>
            </div>
          </div>
          <div class="player-row-right">
            <span class="player-row-price">${price}M</span>
            <button aria-label="Fichar o seleccionar a ${player.nombre}" class="btn-player-action btn-toggle-select ${isSelected ? 'is-selected' : ''}" type="button" data-id="${player.id}">
              ${isSelected
                ? `<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`
                : `<svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`
              }
            </button>
          </div>
        </article>
      `;
    }).join('');

    listAvailable.querySelectorAll('.btn-toggle-select').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        toggleSelectPlayer(id);
      });
    });
  }

  /**
   * Renderiza la bandeja interactiva de seleccionados y el dock inferior
   */
  function renderTrayAndDock() {
    const selectedCount = selectedForAction.size;

    if (selectedCount === 0) {
      if (traySection) {
        traySection.hidden = true;
        traySection.style.setProperty('display', 'none', 'important');
      }
      if (bottomDock) {
        bottomDock.hidden = true;
        bottomDock.style.setProperty('display', 'none', 'important');
      }
      if (trayChips) {
        trayChips.innerHTML = '';
      }
      return;
    }

    // Actualizar Visibilidad de Bandeja y Dock
    if (traySection) {
      traySection.hidden = false;
      traySection.style.removeProperty('display');
    }
    if (bottomDock) {
      bottomDock.hidden = false;
      bottomDock.style.removeProperty('display');
    }

    const squadPlayerIds = new Set(
      (activeSquad.players || []).filter(Boolean).map(p => Number(p.id))
    );

    const selectedPlayers = catalog.filter(p => selectedForAction.has(p.id) || selectedForAction.has(Number(p.id)) || selectedForAction.has(String(p.id)));
    const toBuyPlayers = selectedPlayers.filter(p => !squadPlayerIds.has(Number(p.id)));
    const totalPrice = toBuyPlayers.reduce((acc, p) => acc + (Number(p.precio) || 0), 0);
    const totalPriceFormatted = Math.round(totalPrice * 10) / 10;

    // Actualizar Metricas de Bandeja
    if (trayCountBadge) trayCountBadge.textContent = `${selectedCount} ${selectedCount === 1 ? 'jugador' : 'jugadores'}`;
    if (trayTotalPrice) trayTotalPrice.textContent = `${totalPriceFormatted}M`;

    if (trayChips) {
      trayChips.innerHTML = selectedPlayers.map((p) => {
        const isOwned = squadPlayerIds.has(Number(p.id));
        const price = Number(p.precio || 10).toFixed(1).replace('.0', '');
        const metaText = isOwned ? `${p.posicion_base} • En tu equipo` : `${p.posicion_base} • ${price}M`;
        const ownedClass = isOwned ? 'tray-chip--owned' : '';

        return `
          <div class="tray-chip ${ownedClass}">
            <div class="tray-chip__info">
              <span class="tray-chip__name">${p.nombre}</span>
              <span class="tray-chip__meta ${isOwned ? 'tray-chip__meta--owned' : ''}">${metaText}</span>
            </div>
            <button type="button" aria-label="Quitar de selección a ${p.nombre}" title="Eliminar" class="tray-chip__remove-btn btn-remove-tray" data-id="${p.id}">✕</button>
          </div>
        `;
      }).join('');

      trayChips.querySelectorAll('.btn-remove-tray').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const id = e.currentTarget.getAttribute('data-id') || e.currentTarget.dataset.id;
          removeSelectedPlayer(id);
        });
      });
    }

    // Actualizar Dock Inferior
    if (compareCountSpan) compareCountSpan.textContent = selectedCount;

    if (btnCompare) {
      btnCompare.disabled = selectedCount < 2;
    }

    if (btnBuy) {
      if (toBuyPlayers.length > 0) {
        btnBuy.disabled = false;
        btnBuy.innerHTML = `
          <svg class="dock-icon" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
            <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
          <span>Fichar (<span id="buy-total-price">${totalPriceFormatted}M</span>)</span>
        `;
      } else {
        btnBuy.disabled = true;
        btnBuy.innerHTML = `
          <svg class="dock-icon" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>En tu plantilla</span>
        `;
      }
    }
  }

  // =============================================================================
  // ACCIONES DEL USUARIO (SELECCIONAR, QUITAR, COMPRAR, VENDER)
  // =============================================================================

  function removeSelectedPlayer(rawId) {
    const numId = Number(rawId);
    const strId = String(rawId);

    selectedForAction.delete(rawId);
    if (!Number.isNaN(numId)) selectedForAction.delete(numId);
    selectedForAction.delete(strId);

    for (const id of Array.from(selectedForAction)) {
      if (id === rawId || id === numId || String(id) === strId || Number(id) === numId) {
        selectedForAction.delete(id);
      }
    }

    renderSquadList();
    renderAvailableList();
    renderTrayAndDock();
  }

  function clearAllSelectedPlayers() {
    selectedForAction.clear();
    renderAvailableList();
    renderTrayAndDock();
  }

  function toggleSelectPlayer(rawId) {
    const playerId = Number(rawId);

    // Comprobar si ya esta en la seleccion
    let existingId = null;
    for (const id of selectedForAction) {
      if (Number(id) === playerId || String(id) === String(rawId)) {
        existingId = id;
        break;
      }
    }

    if (existingId !== null) {
      selectedForAction.delete(existingId);
    } else {
      selectedForAction.add(playerId);
    }

    renderSquadList();
    renderAvailableList();
    renderTrayAndDock();
  }

  /**
   * Vende a un futbolista de la plantilla activa
   */
  function handleSellPlayer(playerId) {
    const playerIndex = (activeSquad.players || []).findIndex(p => p && p.id === playerId);
    if (playerIndex === -1) return;

    const player = activeSquad.players[playerIndex];
    showSellConfirmModal(player, () => {
      activeSquad.players[playerIndex] = null;
      persistActiveSquad(activeSquad, { allowEmpty: true });

      selectedForAction.delete(playerId);
      renderAllViews();
      showMarketToast(`Has vendido a ${player.nombre || player.name} por +${player.precio || 10}M`, 'success');
    });
  }

  /**
   * Ficha a los jugadores seleccionados y los coloca en los puestos libres de la plantilla
   */
  function handleBuySelected() {
    const squadPlayerIds = new Set(
      (activeSquad.players || []).filter(Boolean).map(p => Number(p.id))
    );

    const selectedPlayers = catalog.filter(p => selectedForAction.has(p.id) || selectedForAction.has(Number(p.id)) || selectedForAction.has(String(p.id)));
    const toBuyPlayers = selectedPlayers.filter(p => !squadPlayerIds.has(Number(p.id)));

    if (toBuyPlayers.length === 0) {
      showMarketToast('Los futbolistas seleccionados ya forman parte de tu plantilla.', 'info');
      return;
    }

    const currentSquadPlayers = (activeSquad.players || []).filter(Boolean);
    const freeSlotsCount = 10 - currentSquadPlayers.length;

    if (toBuyPlayers.length > freeSlotsCount) {
      showMarketAlert({
        title: 'Plantilla sin espacio suficiente',
        message: `Sólo dispones de ${freeSlotsCount} hueco(s) libre(s) en tu plantilla e intentas fichar a ${toBuyPlayers.length} futbolista(s). Vende jugadores primero para hacer espacio.`,
        type: 'warning'
      });
      return;
    }

    const currentSpent = currentSquadPlayers.reduce((acc, p) => acc + (Number(p.precio) || 0), 0);
    const costToBuy = toBuyPlayers.reduce((acc, p) => acc + (Number(p.precio) || 0), 0);

    if (currentSpent + costToBuy > 150.0) {
      const excess = Math.round((currentSpent + costToBuy - 150.0) * 10) / 10;
      showMarketAlert({
        title: 'Presupuesto insuficiente',
        message: `La operación supera el límite salarial de 150.0M por ${excess}M. Necesitas vender futbolistas para equilibrar las finanzas.`,
        type: 'danger'
      });
      return;
    }

    ensureTenSlots(activeSquad);

    toBuyPlayers.forEach((p) => {
      // 1. Buscar puesto libre en los 6 titulares (pitch-card, indices 0 a 5)
      let targetIdx = -1;

      if (p.posicion_base === 'POR' && !activeSquad.players[0]) {
        targetIdx = 0;
      } else {
        for (let i = 1; i < 6; i++) {
          if (!activeSquad.players[i]) {
            targetIdx = i;
            break;
          }
        }
        if (targetIdx === -1 && !activeSquad.players[0]) {
          targetIdx = 0;
        }
      }

      // 2. Si los 6 puestos titulares están completos, ubicar en reservas (indices 6 a 9)
      if (targetIdx === -1) {
        for (let i = 6; i < 10; i++) {
          if (!activeSquad.players[i]) {
            targetIdx = i;
            break;
          }
        }
      }

      if (targetIdx !== -1) {
        const rawImage = p.image_filename || p.image_url || p.photo_url || p.avatarUrl || p.imagen || null;
        const resolvedAvatarUrl = rawImage
          ? (rawImage.startsWith('http://') || rawImage.startsWith('https://') ? rawImage : `${STORAGE_URL}${rawImage}`)
          : null;

        activeSquad.players[targetIdx] = {
          ...p,
          id: p.id,
          name: p.nombre || p.name,
          nombre: p.nombre || p.name,
          role: p.posicion_base || p.role,
          posicion_base: p.posicion_base || p.role,
          posicion_detalle: p.posicion_detalle,
          rating_general: p.media_juego || p.rating_general,
          media_juego: p.media_juego || p.rating_general,
          precio: p.precio,
          price: p.precio,
          rating_ataque: p.rating_ataque,
          rating_defensa: p.rating_defensa,
          rating_creacion: p.rating_creacion,
          rating_tecnica: p.rating_tecnica,
          rating_fisico: p.rating_fisico,
          rating_palmares: p.rating_palmares,
          image_filename: p.image_filename || rawImage,
          avatarUrl: resolvedAvatarUrl,
          photo_url: resolvedAvatarUrl,
          energia: 100,
          minutosJugados: 0
        };

        // Eliminar jugador fichado de la selección
        selectedForAction.delete(p.id);
        selectedForAction.delete(Number(p.id));
        selectedForAction.delete(String(p.id));
      }
    });

    persistActiveSquad(activeSquad);

    showMarketToast(`¡Fichaje completado! ${toBuyPlayers.length} futbolista(s) incorporados a tu plantilla.`, 'success');
    renderAllViews();
  }
}

// =============================================================================
// SISTEMA DE MODALES Y NOTIFICACIONES ESTÉTICAS IN-GAME (ZERO WINDOW ALERTS)
// =============================================================================

function showMarketAlert({ title, message, type = 'warning' }) {
  closeMarketModal();

  const overlay = document.createElement('div');
  overlay.id = 'market-active-modal';
  overlay.className = 'market-modal-overlay';

  const isDanger = type === 'danger';
  const iconSvg = isDanger
    ? `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`
    : `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;

  overlay.innerHTML = `
    <div class="market-modal-card" role="dialog" aria-modal="true">
      <div class="market-modal-icon-wrap market-modal-icon-wrap--${type}">
        ${iconSvg}
      </div>
      <h3 class="market-modal-title">${title}</h3>
      <p class="market-modal-desc">${message}</p>
      <div class="market-modal-actions">
        <button type="button" class="market-modal-btn market-modal-btn--primary" id="market-modal-dismiss-btn">
          Entendido
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const dismissBtn = overlay.querySelector('#market-modal-dismiss-btn');
  dismissBtn.focus();
  dismissBtn.addEventListener('click', closeMarketModal);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMarketModal();
  });
}

function showSellConfirmModal(player, onConfirm) {
  closeMarketModal();

  const overlay = document.createElement('div');
  overlay.id = 'market-active-modal';
  overlay.className = 'market-modal-overlay';

  const playerName = player.nombre || player.name || 'Futbolista';
  const playerRole = player.posicion_base || player.role || 'JUG';
  const playerPrice = Number(player.precio || player.price || 10).toFixed(1);
  const playerRating = player.media_juego || player.rating_general || 80;
  
  const rawImage = player.image_filename || player.image_url || player.imagen;
  const playerImage = rawImage
    ? (rawImage.startsWith('http://') || rawImage.startsWith('https://') ? rawImage : `${STORAGE_URL}${rawImage}`)
    : null;

  overlay.innerHTML = `
    <div class="market-modal-card" role="dialog" aria-modal="true">
      <div class="market-modal-icon-wrap market-modal-icon-wrap--danger">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </div>
      <h3 class="market-modal-title">¿Vender a ${playerName}?</h3>
      <p class="market-modal-desc">El jugador abandonará tu plantilla y el saldo se añadirá a tu presupuesto.</p>
      
      <div class="market-modal-player-preview">
        <div class="modal-preview-avatar player-slot__avatar player-slot--${(playerRole || 'mc').toLowerCase()}" data-position="${playerRole || 'MC'}">
          ${playerImage
            ? `<img src="${playerImage}" alt="${playerName}" class="player-slot__img" onerror="this.outerHTML='<svg class=\\\'player-slot__icon\\\' fill=\\\'none\\\' stroke=\\\'currentColor\\\' stroke-width=\\\'1.8\\\' viewBox=\\\'0 0 24 24\\\'><path d=\\\'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z\\\' stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\'></path></svg>'"/>`
            : `<svg class="player-slot__icon" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" stroke-linecap="round" stroke-linejoin="round"></path></svg>`
          }
        </div>
        <div class="modal-preview-info">
          <div class="modal-preview-name">${playerName}</div>
          <div class="modal-preview-sub">
            <span class="modal-preview-badge">${playerRole}</span>
            <span>★ ${playerRating}</span>
          </div>
        </div>
        <div class="modal-preview-refund">
          <div class="modal-preview-refund-label">Recuperas</div>
          <div class="modal-preview-refund-val">+${playerPrice}M</div>
        </div>
      </div>

      <div class="market-modal-actions">
        <button type="button" class="market-modal-btn market-modal-btn--cancel" id="market-modal-cancel-btn">
          Cancelar
        </button>
        <button type="button" class="market-modal-btn market-modal-btn--danger" id="market-modal-confirm-btn">
          Sí, vender
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#market-modal-cancel-btn').addEventListener('click', closeMarketModal);
  overlay.querySelector('#market-modal-confirm-btn').addEventListener('click', () => {
    closeMarketModal();
    if (typeof onConfirm === 'function') onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeMarketModal();
  });
}

function closeMarketModal() {
  const modal = document.getElementById('market-active-modal');
  if (!modal) return;

  modal.classList.add('is-closing');
  setTimeout(() => {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }, 160);
}

function showMarketToast(message, type = 'success') {
  let container = document.getElementById('market-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'market-toast-container';
    container.className = 'market-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `market-toast market-toast--${type}`;

  const iconSvg = type === 'success'
    ? `<svg class="market-toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>`
    : `<svg class="market-toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`;

  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('is-hiding');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 220);
  }, 2800);
}

// =============================================================================
// FUNCIONES AUXILIARES DE ESTADO Y PERSISTENCIA
// =============================================================================

function loadActiveSquadFromStorage() {
  try {
    const raw = localStorage.getItem('fantasy_active_squad');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players)) {
        ensureTenSlots(parsed);
        return parsed;
      }
    }
  } catch (e) {
    console.debug('[Market] Error leyendo plantilla activa:', e);
  }

  const defaultSquad = {
    name: 'Tu Equipo',
    formation: '1-2-2-1',
    players: new Array(10).fill(null)
  };
  ensureTenSlots(defaultSquad);
  return defaultSquad;
}

function ensureTenSlots(squad) {
  if (!Array.isArray(squad.players)) squad.players = [];
  while (squad.players.length < 10) {
    squad.players.push(null);
  }
}

function persistActiveSquad(squad, { allowEmpty = false } = {}) {
  try {
    localStorage.setItem('fantasy_active_squad', JSON.stringify(squad));
    window.dispatchEvent(new CustomEvent('fantasy:squad-updated', { detail: squad }));
    let currentUserId = null;
    try {
      const userObj = JSON.parse(localStorage.getItem('user') || '{}');
      if (userObj && userObj.id) currentUserId = Number(userObj.id);
    } catch (_) {}

    // Salvaguarda: NUNCA enviar al backend una plantilla vacía para evitar destruir inventario en BD
    const hasAnyRealPlayer = Array.isArray(squad.players) && squad.players.some(Boolean);
    if (!hasAnyRealPlayer && !allowEmpty) {
      console.debug('[Market] Sincronización con backend omitida (plantilla sin futbolistas).');
      return;
    }

    squadService.saveSquad({
      formation: squad.formation || '1-2-2-1',
      players: squad.players || [],
      name: squad.name || undefined,
      user_id: currentUserId,
      allow_empty: allowEmpty
    }).catch((err) => {
      console.debug('[Market] Sincronización de plantilla con backend omitida:', err.message);
    });
  } catch (err) {
    console.debug('[Market] Error al persistir plantilla activa:', err);
  }
}

function loadChartJs() {
  if (typeof window !== 'undefined' && window.Chart) {
    return Promise.resolve(window.Chart);
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => resolve(window.Chart);
    document.head.appendChild(script);
  });
}
