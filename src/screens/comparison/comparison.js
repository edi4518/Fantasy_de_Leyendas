/**
 * @file comparison.js
 * @description Controlador para la pantalla de Comparativa de Jugadores.
 * Utiliza la vista HTML en src/screens/comparison/comparison.html y los estilos
 * modulares en src/styles/screens/comparison.css.
 *
 * @exports { renderComparisonScreen }
 */

import { playerService } from '../../services/player-service.js';

const PALETTE = [
  { main: '#2d6a4f', bg: 'rgba(45, 106, 79, 0.2)' },   // Verde
  { main: '#d97706', bg: 'rgba(217, 119, 6, 0.2)' },   // Ámbar
  { main: '#2563eb', bg: 'rgba(37, 99, 235, 0.2)' },   // Azul
  { main: '#9333ea', bg: 'rgba(147, 51, 234, 0.2)' },  // Púrpura
  { main: '#dc2626', bg: 'rgba(220, 38, 38, 0.2)' },   // Rojo
  { main: '#0891b2', bg: 'rgba(8, 145, 178, 0.2)' },   // Cian
  { main: '#db2777', bg: 'rgba(219, 39, 119, 0.2)' },  // Rosa
  { main: '#4f46e5', bg: 'rgba(79, 70, 229, 0.2)' },   // Índigo
  { main: '#ea580c', bg: 'rgba(234, 88, 12, 0.2)' },   // Naranja
  { main: '#0d9488', bg: 'rgba(13, 148, 136, 0.2)' }   // Turquesa
];

let radarChartInstance = null;
let cachedAllPlayers = null;

export async function renderComparisonScreen(container, router, params = {}) {
  const targetContainer = container || document.querySelector('#app-content');
  if (!targetContainer) return;

  if (!window.Chart) {
    await loadChartJs();
  }

  // Si el contenedor aún no tiene el template HTML de comparison.html, cargarlo
  if (!targetContainer.querySelector('.comparison-screen')) {
    try {
      const response = await fetch(`/src/screens/comparison/comparison.html?v=${Date.now()}`);
      if (response.ok) {
        targetContainer.innerHTML = await response.text();
      }
    } catch (err) {
      console.error('[Comparison] Error al cargar template HTML:', err);
    }
  }

  // Extraer IDs desde params, search, hash de la URL o selección guardada desde el Mercado
  let rawIds = params.ids || '';
  if (!rawIds) {
    const searchParams = new URLSearchParams(window.location.search);
    rawIds = searchParams.get('ids');
  }
  if (!rawIds && window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.split('?')[1];
    const hashParams = new URLSearchParams(hashQuery);
    rawIds = hashParams.get('ids');
  }

  let playerIds = (rawIds || '').split(',').map(id => parseInt(id, 10)).filter(Boolean);

  if (playerIds.length === 0) {
    try {
      const storedIds = JSON.parse(localStorage.getItem('fantasy_compare_ids') || '[]');
      if (Array.isArray(storedIds) && storedIds.length > 0) {
        playerIds = storedIds.map(id => parseInt(id, 10)).filter(Boolean);
      }
    } catch (_) {}
  } else {
    try {
      localStorage.setItem('fantasy_compare_ids', JSON.stringify(playerIds));
    } catch (_) {}
  }

  await initComparisonLogic(targetContainer, router, playerIds);
}

async function initComparisonLogic(container, router, playerIds) {
  const cardsScroll = container.querySelector('#comp-cards-scroll');
  const countText = container.querySelector('#comp-player-count');
  const benchmarkList = container.querySelector('#benchmark-list');
  const legendContainer = container.querySelector('#radar-legend');
  const colorBar = container.querySelector('#comp-color-bar');
  const btnBack = container.querySelector('#btn-back-to-market');
  const btnAdd = container.querySelector('#btn-add-more-players');

  const modal = container.querySelector('#add-player-modal');
  const closeModalBtn = container.querySelector('#btn-close-modal');
  const modalSearch = container.querySelector('#modal-search');
  const modalPlayerList = container.querySelector('#modal-player-list');
  const modalFilterBtns = container.querySelectorAll('.modal-filter-btn');
  const sortNameBtn = container.querySelector('#sort-name-btn');
  const sortPriceBtn = container.querySelector('#sort-price-btn');

  let modalPosFilter = 'TODOS';
  let sortByName = true;

  if (btnBack) {
    btnBack.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/market');
    });
  }

  try {
    if (!cachedAllPlayers || cachedAllPlayers.length === 0) {
      cachedAllPlayers = await playerService.getAllPlayers();
    }
  } catch (err) {
    console.error('[Comparison] Error al obtener jugadores:', err);
    cachedAllPlayers = [];
  }

  const allPlayersMap = new Map();
  (cachedAllPlayers || []).forEach(p => {
    if (p && p.id != null) allPlayersMap.set(Number(p.id), p);
  });

  // Incorporar jugadores guardados desde el Mercado o Plantilla activa como respaldo
  try {
    const savedComparePlayers = JSON.parse(localStorage.getItem('fantasy_compare_players') || '[]');
    if (Array.isArray(savedComparePlayers)) {
      savedComparePlayers.forEach(p => {
        if (p && p.id != null && !allPlayersMap.has(Number(p.id))) {
          allPlayersMap.set(Number(p.id), p);
        }
      });
    }
    const savedSquad = JSON.parse(localStorage.getItem('fantasy_active_squad') || '{}');
    if (savedSquad && Array.isArray(savedSquad.players)) {
      savedSquad.players.filter(Boolean).forEach(p => {
        if (p && p.id != null && !allPlayersMap.has(Number(p.id))) {
          allPlayersMap.set(Number(p.id), p);
        }
      });
    }
  } catch (_) {}

  const allPlayers = Array.from(allPlayersMap.values());

  const openModal = () => {
    if (!modal) return;
    modal.hidden = false;
    renderModalList();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        modal.classList.add('is-open');
        if (modalSearch) modalSearch.focus();
      });
    });
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('is-open');
    setTimeout(() => {
      if (!modal.classList.contains('is-open')) {
        modal.hidden = true;
      }
    }, 280);
  };

  const STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';

  const renderModalList = () => {
    if (!modalPlayerList) return;
    const query = modalSearch ? modalSearch.value.toLowerCase().trim() : '';
    let available = allPlayers.filter(p => !playerIds.includes(Number(p.id)));

    if (query) {
      available = available.filter(p => (p.nombre || p.name || '').toLowerCase().includes(query));
    }

    if (modalPosFilter !== 'TODOS') {
      available = available.filter(p => {
        const pos = (p.posicion_base || p.role || '').toUpperCase();
        if (modalPosFilter === 'MC') return pos.includes('MC') || pos.includes('MED');
        return pos.includes(modalPosFilter);
      });
    }

    if (sortByName) {
      available.sort((a, b) => (a.nombre || a.name || '').localeCompare(b.nombre || b.name || ''));
    } else {
      available.sort((a, b) => (b.precio || b.price || 0) - (a.precio || a.price || 0));
    }

    if (available.length === 0) {
      modalPlayerList.innerHTML = '<p class="comp-modal-empty">No se encontraron futbolistas disponibles con los filtros actuales.</p>';
      return;
    }

    modalPlayerList.innerHTML = available.map(p => {
      const rating = p.media_juego || p.rating_general || 80;
      const nameDisplay = p.nombre || p.name || 'Jugador';
      const posDisplay = p.posicion_base || p.role || 'MC';
      const detailDisplay = p.posicion_detalle || p.nacionalidad || 'Leyenda histórica';
      const priceDisplay = Number(p.precio || p.price || 10).toFixed(1).replace('.0', '');
      const initials = nameDisplay.split(' ').map(n => n[0]).join('').slice(0, 2);
      const playerImage = p.image_filename ? `${STORAGE_URL}${p.image_filename}` : null;

      return `
        <article class="comp-modal-item">
          <div class="comp-modal-item-left">
            <div class="comp-modal-avatar">
              ${playerImage
                ? `<img src="${playerImage}" alt="${nameDisplay}" onerror="this.outerHTML='<span class=\\'comp-modal-avatar-initials\\'>${initials}</span>'"/>`
                : `<span class="comp-modal-avatar-initials">${initials}</span>`
              }
            </div>
            <div class="comp-modal-item-info">
              <div class="comp-modal-name-row">
                <strong class="comp-modal-item-name">${nameDisplay}</strong>
                <span class="comp-modal-rating-badge">★ ${rating}</span>
              </div>
              <div class="comp-modal-sub-row">
                <span class="comp-modal-role-badge">${posDisplay}</span>
                <span class="comp-modal-item-meta">${detailDisplay}</span>
              </div>
            </div>
          </div>
          <div class="comp-modal-item-right">
            <span class="comp-modal-item-price">${priceDisplay}M</span>
            <button type="button" class="btn-add-to-comparison" data-id="${p.id}" aria-label="Añadir a ${nameDisplay}">
              <svg fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </article>
      `;
    }).join('');

    modalPlayerList.querySelectorAll('.btn-add-to-comparison').forEach(btn => {
      btn.addEventListener('click', () => {
        const idToAdd = parseInt(btn.dataset.id, 10);
        const newIds = [...playerIds, idToAdd];
        try {
          localStorage.setItem('fantasy_compare_ids', JSON.stringify(newIds));
        } catch (_) {}
        closeModal();
        router.navigate(`/comparison?ids=${newIds.join(',')}`);
      });
    });
  };

  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }

  if (modalSearch) {
    modalSearch.addEventListener('input', renderModalList);
  }

  modalFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modalPosFilter = btn.dataset.pos;
      renderModalList();
    });
  });

  if (sortNameBtn) {
    sortNameBtn.addEventListener('click', () => {
      sortByName = true;
      sortNameBtn.classList.add('is-active');
      if (sortPriceBtn) sortPriceBtn.classList.remove('is-active');
      renderModalList();
    });
  }

  if (sortPriceBtn) {
    sortPriceBtn.addEventListener('click', () => {
      sortByName = false;
      sortPriceBtn.classList.add('is-active');
      if (sortNameBtn) sortNameBtn.classList.remove('is-active');
      renderModalList();
    });
  }

  if (playerIds.length === 0) {
    if (cardsScroll) {
      cardsScroll.innerHTML = '<p class="comp-empty-msg">No hay jugadores seleccionados para comparar. Vuelve al mercado y selecciona al menos 2.</p>';
    }
    return;
  }

  // Preservar el orden exacto de selección de los jugadores
  const players = playerIds
    .map(id => allPlayers.find(p => Number(p.id) === Number(id)))
    .filter(Boolean);

  if (countText) countText.textContent = players.length;

  if (colorBar) {
    colorBar.innerHTML = players.map((_, idx) => `
      <span class="comp-color-segment" style="--player-color: ${PALETTE[idx % PALETTE.length].main};"></span>
    `).join('');
  }

  if (cardsScroll) {
    cardsScroll.innerHTML = players.map((p, idx) => {
      const color = PALETTE[idx % PALETTE.length].main;
      const initials = p.nombre
        ? p.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)
        : (p.name ? p.name.slice(0, 2) : 'PL');

      return `
        <article class="comp-player-card" style="--player-color: ${color};">
          ${players.length > 1 ? `<button type="button" class="btn-remove-card" data-id="${p.id}" aria-label="Quitar a ${p.nombre || p.name}">✕</button>` : ''}
          <div class="comp-card-top">
            <div class="comp-avatar-circle">
              ${initials}
            </div>
            <div class="comp-card-info">
              <strong class="comp-card-name">${p.nombre || p.name}</strong>
              <span class="comp-pos-badge">${p.posicion_base || p.role || 'DEF'}</span>
            </div>
          </div>
          <div class="comp-card-stats-row">
            <div>
              <small class="comp-stat-label">VALOR</small>
              <strong class="comp-stat-value">${p.precio || p.price || 20}M €</strong>
            </div>
            <div class="comp-stat-col--right">
              <small class="comp-stat-label">NOTA MEDIA</small>
              <strong class="comp-stat-value comp-stat-value--accent">${p.media_juego || p.rating_general || 85}</strong>
            </div>
          </div>
        </article>
      `;
    }).join('');

    cardsScroll.querySelectorAll('.btn-remove-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idToRemove = parseInt(e.currentTarget.dataset.id, 10);
        const nextIds = playerIds.filter(id => id !== idToRemove);
        try {
          localStorage.setItem('fantasy_compare_ids', JSON.stringify(nextIds));
        } catch (_) {}
        router.navigate(`/comparison?ids=${nextIds.join(',')}`);
      });
    });
  }

  if (legendContainer) {
    legendContainer.innerHTML = players.map((p, idx) => `
      <div class="comp-legend-item" style="--player-color: ${PALETTE[idx % PALETTE.length].main};">
        <span class="comp-legend-dot"></span>
        <span class="comp-legend-name">${p.nombre || p.name}</span>
      </div>
    `).join('');
  }

  // Renderizar Gráfico de Radar
  renderRadarChart(container, players);

  // Renderizar Benchmark Estadístico Específico según la Posición
  const targetBenchmarkList = container.querySelector('#benchmark-list') || benchmarkList;
  const titleLabel = container.querySelector('#benchmark-title-label');
  if (targetBenchmarkList) {
    renderPositionBenchmarks(targetBenchmarkList, titleLabel, players);
  }
}

function renderRadarChart(container, players) {
  const canvas = container.querySelector('#radarChart');
  if (!canvas) return;

  if (radarChartInstance) {
    radarChartInstance.destroy();
  }

  const datasets = players.map((p, idx) => {
    const palette = PALETTE[idx % PALETTE.length];
    return {
      label: p.nombre || p.name,
      data: [
        p.rating_ataque ?? 50,
        p.rating_creacion ?? 50,
        p.rating_tecnica ?? 50,
        p.rating_defensa ?? 50,
        p.rating_fisico ?? 50,
        p.rating_palmares ?? 50
      ],
      backgroundColor: palette.bg,
      borderColor: palette.main,
      borderWidth: 2,
      pointRadius: 2
    };
  });

  radarChartInstance = new Chart(canvas, {
    type: 'radar',
    data: {
      labels: ['ATAQUE', 'CREACIÓN', 'TÉCNICA', 'DEFENSA', 'FÍSICO', 'PALMARÉS'],
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { display: false },
          grid: { color: '#e2e8f0' },
          angleLines: { color: '#cbd5e1' }
        }
      }
    }
  });
}

function renderPositionBenchmarks(container, titleLabel, players) {
  if (!container || players.length === 0) return;

  const primaryPos = (players[0]?.posicion_base || players[0]?.role || 'DEL').toUpperCase();

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

  if (titleLabel) {
    titleLabel.textContent = `[BENCHMARK ESTADÍSTICO — ${posName}]`;
  }

  container.innerHTML = metrics.map(m => {
    const vals = players.map(p => Number(p[m.key]) || 0);
    const maxVal = Math.max(...vals, 0.001);
    const leaderIdx = vals.indexOf(maxVal);
    const leader = players[leaderIdx];
    const leaderName = leader ? (leader.nombre || leader.name || '').split(' ')[0] : maxVal;

    return `
      <div class="comp-bench-card">
        <div class="comp-bench-header">
          <span class="comp-bench-title">${m.title}</span>
          <span class="comp-bench-badge">
            ${m.badge}: ${leaderName} (${maxVal}${m.unit})
          </span>
        </div>
        ${players.map((p, idx) => {
          const val = Number(p[m.key]) || 0;
          const pct = Math.min(100, Math.max(12, (val / (maxVal || 1)) * 100));
          const color = PALETTE[idx % PALETTE.length].main;
          const pName = p.nombre || p.name || 'Jugador';

          return `
            <div class="comp-bench-row" style="--player-color: ${color}; --bar-width: ${pct}%;">
              <span class="comp-bench-name">${pName}</span>
              <div class="comp-bench-bar-track">
                <div class="comp-bench-bar-fill"></div>
              </div>
              <span class="comp-bench-val">${val}${m.unit}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }).join('');
}

function loadChartJs() {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}
