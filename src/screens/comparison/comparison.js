import { playerService } from '../../services/player-service.js';

const PALETTE = [
  { main: '#2d6a4f', bg: 'rgba(45, 106, 79, 0.2)' },   // Verde Alex Morgan
  { main: '#d97706', bg: 'rgba(217, 119, 6, 0.2)' },   // Amarillo Sam Taylor
  { main: '#2563eb', bg: 'rgba(37, 99, 235, 0.2)' }    // Azul Jordan Lee
];

let radarChartInstance = null;
let cachedAllPlayers = null;

export async function renderComparisonScreen(container, router, params = {}) {
  const targetContainer = container || document.querySelector('#app-content');
  if (!targetContainer) return;

  if (!window.Chart) {
    await loadChartJs();
  }

  // Extraer IDs desde params, search o hash de la URL
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

  const playerIds = (rawIds || '').split(',').map(id => parseInt(id, 10)).filter(Boolean);

  // Inyectar HTML síncronamente
  targetContainer.innerHTML = `
    <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding-bottom: 120px; background: #f8fafc; min-height: 100vh; position: relative;">
      <!-- Header -->
      <header style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: white; border-bottom: 1px solid #e2e8f0;">
        <button id="btn-back-to-market" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #0f172a;">❮</button>
        <div style="text-align: center;">
          <h1 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #0f172a;">Comparativa de Jugadores</h1>
          <span style="font-size: 0.65rem; background: #e2edea; color: #2d6a4f; padding: 2px 8px; border-radius: 10px; font-weight: 700;">SIMULACIÓN COMPARATIVA</span>
        </div>
        <button style="background: none; border: none; font-size: 1.1rem; cursor: pointer; color: #0f172a;">📤</button>
      </header>

      <!-- Barra superior -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; background: white; margin-bottom: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
        <div>
          <span style="width: 8px; height: 8px; background: #2d6a4f; display: inline-block; border-radius: 50%; margin-right: 6px;"></span>
          <strong id="comp-player-count" style="font-size: 0.85rem; color: #0f172a;">0</strong> <strong style="font-size: 0.85rem; color: #0f172a;">JUGADORES COMPARADOS</strong>
        </div>
        <button id="btn-add-more-players" style="background: #2d6a4f; color: white; border: none; padding: 6px 14px; border-radius: 16px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          + Añadir
        </button>
      </div>

      <!-- Barra tricolor -->
      <div id="comp-color-bar" style="height: 4px; display: flex; width: 100%; margin-bottom: 12px;"></div>

      <!-- Tarjetas superiores con scroll -->
      <div style="padding: 0 20px;">
        <div id="comp-cards-scroll"></div>
      </div>

      <!-- Perfil Táctico (Radar Chart.js) -->
      <div style="background: white; margin: 16px 20px; border-radius: 20px; padding: 16px; border: 1px solid #e2e8f0;">
        <div style="font-size: 0.65rem; font-weight: 800; color: #64748b; margin-bottom: 12px; letter-spacing: 0.5px; display: flex; justify-content: space-between;">
          <span>[PERFIL TÁCTICO]</span>
          <span>MULTI-JUGADOR</span>
        </div>
        <div style="width: 100%; height: 220px; position: relative; display: flex; justify-content: center; align-items: center;">
          <canvas id="radarChart"></canvas>
        </div>
        <div id="radar-legend"></div>
      </div>

      <!-- Benchmark Estadístico Dinámico -->
      <div style="background: white; margin: 0 20px; border-radius: 20px; padding: 16px; border: 1px solid #e2e8f0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <span id="benchmark-title-label" style="font-size: 0.65rem; font-weight: 800; color: #64748b; letter-spacing: 0.5px;">[BENCHMARK ESTADÍSTICO]</span>
          <span style="font-size: 0.65rem; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; font-weight: 700; color: #475569;">5 MÉTRICAS</span>
        </div>
        <div id="benchmark-list"></div>
      </div>

      <!-- MODAL AÑADIR JUGADOR -->
      <div id="add-player-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: none; align-items: flex-end; justify-content: center; z-index: 99999; font-family: 'Plus Jakarta Sans', sans-serif;">
        <div style="background: white; width: 100%; max-width: 480px; height: 85vh; border-top-left-radius: 24px; border-top-right-radius: 24px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 -10px 25px rgba(0,0,0,0.2);">
          
          <div style="padding: 20px 20px 12px 20px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <h2 style="margin: 0 0 4px 0; font-size: 1.15rem; font-weight: 800; color: #0f172a;">Añadir Jugador</h2>
              <p style="margin: 0; font-size: 0.75rem; color: #64748b;">Selecciona una leyenda para comparar estadísticas</p>
            </div>
            <button id="btn-close-modal" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #64748b;">✕</button>
          </div>

          <div style="padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc;">
            <div style="position: relative; margin-bottom: 12px;">
              <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;">🔍</span>
              <input type="text" id="modal-search" placeholder="Buscar por apellido o nombre..." style="width: 100%; padding: 10px 12px 10px 36px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 0.8rem; background: white; outline: none; box-sizing: border-box;">
            </div>

            <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;" id="modal-filters">
              <button class="modal-filter-btn active" data-pos="TODOS" style="background: #2d6a4f; color: white; border: none; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">Todos</button>
              <button class="modal-filter-btn" data-pos="POR" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">POR</button>
              <button class="modal-filter-btn" data-pos="DEF" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">DEF</button>
              <button class="modal-filter-btn" data-pos="MC" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">MC</button>
              <button class="modal-filter-btn" data-pos="DEL" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">DEL</button>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 0.75rem; color: #475569; font-weight: 700;">
              <span id="sort-name-btn" style="cursor: pointer;">🔤 Orden: Apellido (A-Z)</span>
              <span id="sort-price-btn" style="cursor: pointer;">↕️ Por Precio</span>
            </div>
          </div>

          <div id="modal-player-list" style="flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 10px;"></div>

        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    initComparisonLogic(targetContainer, router, playerIds);
  }, 0);
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
    console.error("Error al obtener jugadores:", err);
    cachedAllPlayers = [];
  }

  const allPlayers = cachedAllPlayers || [];

  const renderModalList = () => {
    if (!modalPlayerList) return;
    const query = modalSearch ? modalSearch.value.toLowerCase().trim() : '';
    let available = allPlayers.filter(p => !playerIds.includes(p.id));

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
      modalPlayerList.innerHTML = `<p style="text-align: center; color: #94a3b8; font-size: 0.8rem; padding: 20px;">No se encontraron jugadores disponibles.</p>`;
      return;
    }

    modalPlayerList.innerHTML = available.map(p => {
      const ratingStar = p.media_juego ? (p.media_juego / 10).toFixed(1) : (p.rating_general ? (p.rating_general / 10).toFixed(1) : '8.5');
      const nameDisplay = p.nombre || p.name || 'Jugador';
      const posDisplay = p.posicion_base || p.role || 'Jugador';
      const priceDisplay = p.precio || p.price || 20.0;

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 12px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: #f1f5f9; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; color: #475569; border: 1px solid #cbd5e1;">
              👤
            </div>
            <div>
              <strong style="font-size: 0.85rem; color: #0f172a; display: block;">${nameDisplay}</strong>
              <span style="font-size: 0.7rem; color: #64748b;">${posDisplay} • ⭐ ${ratingStar}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">${priceDisplay}M €</span>
            <button class="btn-add-to-comparison" data-id="${p.id}" style="width: 32px; height: 32px; border-radius: 50%; background: #f8fafc; color: #2d6a4f; border: 1px solid #cbd5e1; font-size: 1rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;">
              +
            </button>
          </div>
        </div>
      `;
    }).join('');

    modalPlayerList.querySelectorAll('.btn-add-to-comparison').forEach(btn => {
      btn.addEventListener('click', () => {
        const idToAdd = parseInt(btn.dataset.id, 10);
        const newIds = [...playerIds, idToAdd];
        if (modal) modal.style.display = 'none';
        router.navigate(`/comparison?ids=${newIds.join(',')}`);
      });
    });
  };

  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.preventDefault();
      if (modal) {
        modal.style.display = 'flex';
        renderModalList();
      }
    });
  }

  if (closeModalBtn && modal) {
    closeModalBtn.addEventListener('click', () => {
      modal.style.display = 'none';
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });
  }

  if (modalSearch) {
    modalSearch.addEventListener('input', renderModalList);
  }

  modalFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modalFilterBtns.forEach(b => {
        b.style.background = 'white';
        b.style.color = '#475569';
        b.style.border = '1px solid #e2e8f0';
      });
      btn.style.background = '#2d6a4f';
      btn.style.color = 'white';
      btn.style.border = 'none';

      modalPosFilter = btn.dataset.pos;
      renderModalList();
    });
  });

  const sortNameBtn = container.querySelector('#sort-name-btn');
  const sortPriceBtn = container.querySelector('#sort-price-btn');

  if (sortNameBtn) {
    sortNameBtn.addEventListener('click', () => {
      sortByName = true;
      renderModalList();
    });
  }

  if (sortPriceBtn) {
    sortPriceBtn.addEventListener('click', () => {
      sortByName = false;
      renderModalList();
    });
  }

  if (playerIds.length === 0) {
    if (cardsScroll) {
      cardsScroll.innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b; font-size: 0.8rem;">No hay jugadores seleccionados para comparar. Vuelve al mercado y selecciona al menos 2.</p>';
    }
    return;
  }

  const players = allPlayers.filter(p => playerIds.includes(p.id));

  if (countText) countText.textContent = players.length;

  if (colorBar) {
    colorBar.innerHTML = players.map((_, idx) => `
      <span style="flex: 1; background-color: ${PALETTE[idx % PALETTE.length].main}; height: 100%;"></span>
    `).join('');
  }

  if (cardsScroll) {
    cardsScroll.style.cssText = "display: flex !important; flex-direction: row !important; gap: 10px; overflow-x: auto !important; overflow-y: hidden; width: 100%; padding-bottom: 8px; margin-bottom: 12px; white-space: nowrap;";

    cardsScroll.innerHTML = players.map((p, idx) => {
      const color = PALETTE[idx % PALETTE.length].main;
      const initials = p.nombre ? p.nombre.split(' ').map(n => n[0]).join('').slice(0, 2) : (p.name ? p.name.slice(0,2) : 'PL');

      return `
        <div style="flex: 0 0 160px !important; width: 160px !important; min-width: 160px !important; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 10px; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: inline-block; vertical-align: top;">
          ${players.length > 1 ? `<button class="btn-remove-card" data-id="${p.id}" style="position: absolute; top: 6px; right: 6px; background: transparent; border: none; color: #94a3b8; font-size: 0.9rem; cursor: pointer;">✕</button>` : ''}
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 36px !important; height: 36px !important; min-width: 36px !important; border-radius: 50%; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; background: #f1f5f9; color: ${color};">
              ${initials}
            </div>
            <div>
              <strong style="font-size: 0.8rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 95px; color: #0f172a;">${p.nombre || p.name}</strong>
              <span style="font-size: 0.6rem; font-weight: 700; padding: 1px 6px; border-radius: 6px; border: 1px solid #cbd5e1; color: #475569; display: inline-block; margin-top: 2px;">${p.posicion_base || p.role || 'DEF'}</span>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 0.65rem;">
            <div>
              <small style="color: #64748b; font-weight: 600; display: block;">VALOR</small>
              <strong style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">${p.precio || p.price || 20}M €</strong>
            </div>
            <div style="text-align: right;">
              <small style="color: #64748b; font-weight: 600; display: block;">NOTA MEDIA</small>
              <strong style="font-size: 0.85rem; font-weight: 800; color: ${color};">${p.media_juego || p.rating_general || 85}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');

    cardsScroll.querySelectorAll('.btn-remove-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idToRemove = parseInt(e.target.dataset.id, 10);
        const nextIds = playerIds.filter(id => id !== idToRemove);
        router.navigate(`/comparison?ids=${nextIds.join(',')}`);
      });
    });
  }

  if (legendContainer) {
    legendContainer.style.cssText = "display: flex !important; flex-direction: row !important; justify-content: flex-start; gap: 6px; overflow-x: auto !important; white-space: nowrap !important; padding-bottom: 4px; margin-top: 10px;";

    legendContainer.innerHTML = players.map((p, idx) => `
      <div style="display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 8px; font-size: 0.65rem; font-weight: 700; flex-shrink: 0;">
        <span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${PALETTE[idx % PALETTE.length].main}; display: inline-block;"></span>
        <span style="color: #1e293b;">${p.nombre || p.name}</span>
      </div>
    `).join('');
  }

  // 4. Renderizar Gráfico de Radar
  renderRadarChart(container, players);

  // 5. Renderizar Benchmark Estadístico Específico según la Posición
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
      labels: ['ATAQUE', 'CREACIÓN', 'TÉCNICA', 'DEFENSA', 'FÍSICO', 'PALMARES'],
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

  // Detectar la posición principal del primer jugador (o del grupo)
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
      <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 10px; margin-bottom: 8px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.7rem; font-weight: 800; color: #1e293b;">${m.title}</span>
          <span style="font-size: 0.6rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; background:#e6f4ea; color:#2d6a4f;">
            ${m.badge}: ${leaderName} (${maxVal}${m.unit})
          </span>
        </div>
        ${players.map((p, idx) => {
          const val = Number(p[m.key]) || 0;
          const pct = Math.min(100, Math.max(12, (val / (maxVal || 1)) * 100));
          const color = PALETTE[idx % PALETTE.length].main;
          const pName = p.nombre || p.name || 'Jugador';

          return `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 0.7rem;">
              <span style="width: 80px; font-weight: 600; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pName}</span>
              <div style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; border-radius: 3px; width: ${pct}%; background-color: ${color};"></div>
              </div>
              <span style="width: 45px; text-align: right; font-weight: 800; color: ${color};">${val}${m.unit}</span>
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