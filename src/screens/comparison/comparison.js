import { playerService } from '../../services/player-service.js';

const PALETTE = [
  { main: '#2d6a4f', bg: 'rgba(45, 106, 79, 0.2)' },   // Verde Alex Morgan
  { main: '#d97706', bg: 'rgba(217, 119, 6, 0.2)' },   // Amarillo Sam Taylor
  { main: '#2563eb', bg: 'rgba(37, 99, 235, 0.2)' }    // Azul Jordan Lee
];

let radarChartInstance = null;

export async function renderComparisonScreen(container, router, params = {}) {
  const targetContainer = container || document.querySelector('#app-content');
  if (!targetContainer) return;

  if (!window.Chart) {
    await loadChartJs();
  }

  // Soporte robusto para extraer IDs tanto de params, search o hash de la URL
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

  initComparisonLogic(targetContainer, router, playerIds);
}

async function initComparisonLogic(container, router, playerIds) {
  const cardsScroll = container.querySelector('#comp-cards-scroll');
  const countText = container.querySelector('#comp-player-count');
  const benchmarkList = container.querySelector('#benchmark-list');
  const legendContainer = container.querySelector('#radar-legend');
  const colorBar = container.querySelector('#comp-color-bar');
  const btnBack = container.querySelector('#btn-back-to-market');
  const btnAdd = container.querySelector('#btn-add-more-players');
  const btnSearch = container.querySelector('#btn-comparison-search');

  // Eventos de navegación seguros
  if (btnBack) {
    btnBack.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/market');
    });
  }
  if (btnAdd) {
    btnAdd.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/market');
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate('/market');
    });
  }
  
  if (playerIds.length === 0) {
    if (cardsScroll) {
      cardsScroll.innerHTML = '<p style="padding: 20px; text-align: center; color: #64748b; font-size: 0.8rem;">No hay jugadores seleccionados para comparar. Vuelve al mercado y selecciona al menos 2.</p>';
    }
    return;
  }

  try {
    const allPlayers = await playerService.getAllPlayers();
    const players = allPlayers.filter(p => playerIds.includes(p.id));

    if (countText) countText.textContent = players.length;

    // 1. Barra tricolor superior proporcional
    if (colorBar) {
      colorBar.innerHTML = players.map((_, idx) => `
        <span style="flex: 1; background-color: ${PALETTE[idx % PALETTE.length].main}; height: 100%;"></span>
      `).join('');
    }

    // 2. Tarjetas superiores con scroll horizontal
    if (cardsScroll) {
      cardsScroll.style.cssText = "display: flex !important; flex-direction: row !important; gap: 10px; overflow-x: auto !important; overflow-y: hidden; width: 100%; padding-bottom: 8px; margin-bottom: 12px; white-space: nowrap;";

      cardsScroll.innerHTML = players.map((p, idx) => {
        const color = PALETTE[idx % PALETTE.length].main;
        const initials = p.nombre ? p.nombre.split(' ').map(n => n[0]).join('').slice(0, 2) : 'PL';

        return `
          <div style="flex: 0 0 160px !important; width: 160px !important; min-width: 160px !important; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 10px; position: relative; box-shadow: 0 2px 4px rgba(0,0,0,0.02); display: inline-block; vertical-align: top;">
            <button class="btn-remove-card" data-id="${p.id}" style="position: absolute; top: 6px; right: 6px; background: transparent; border: none; color: #94a3b8; font-size: 0.9rem; cursor: pointer;">✕</button>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 36px !important; height: 36px !important; min-width: 36px !important; border-radius: 50%; border: 2px solid ${color}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.75rem; background: #f1f5f9; color: ${color};">
                ${initials}
              </div>
              <div>
                <strong style="font-size: 0.8rem; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 95px; color: #0f172a;">${p.nombre}</strong>
                <span style="font-size: 0.6rem; font-weight: 700; padding: 1px 6px; border-radius: 6px; border: 1px solid #cbd5e1; color: #475569; display: inline-block; margin-top: 2px;">${p.posicion_base}</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 0.65rem;">
              <div>
                <small style="color: #64748b; font-weight: 600; display: block;">VALOR</small>
                <strong style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">${p.precio}M €</strong>
              </div>
              <div style="text-align: right;">
                <small style="color: #64748b; font-weight: 600; display: block;">NOTA MEDIA</small>
                <strong style="font-size: 0.85rem; font-weight: 800; color: ${color};">${p.media_juego}</strong>
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

    // 3. Leyenda horizontal del Radar
    if (legendContainer) {
      legendContainer.style.cssText = "display: flex !important; flex-direction: row !important; justify-content: flex-start; gap: 6px; overflow-x: auto !important; white-space: nowrap !important; padding-bottom: 4px; margin-top: 10px;";

      legendContainer.innerHTML = players.map((p, idx) => `
        <div style="display: inline-flex; align-items: center; gap: 4px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 3px 8px; border-radius: 8px; font-size: 0.65rem; font-weight: 700; flex-shrink: 0;">
          <span style="width: 6px; height: 6px; border-radius: 50%; background-color: ${PALETTE[idx % PALETTE.length].main}; display: inline-block;"></span>
          <span style="color: #1e293b;">${p.nombre}</span>
        </div>
      `).join('');
    }

    // 4. Renderizar Gráfico de Radar
    renderRadarChart(container, players);

    // 5. Renderizar Benchmarks Estadísticos
    if (benchmarkList) {
      renderBenchmarks(benchmarkList, players);
    }

  } catch (err) {
    console.error("Error al cargar comparativa:", err);
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
      label: p.nombre,
      data: [
        p.rating_ataque || 75,
        p.rating_creacion || 70,
        p.rating_tecnica || 80,
        p.rating_fisico || 75,
        p.rating_defensa || 60,
        p.rating_palmares || 85
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
      labels: ['ATAQUE', 'CREACIÓN', 'TÁCTICA', 'FÍSICO', 'DEFENSA', 'RITMO'],
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

function renderBenchmarks(container, players) {
  const metrics = [
    { title: 'GOLES / PARTIDO', key: 'goles_p90', badge: 'MÁXIMO', unit: '' },
    { title: 'PASES CLAVE / 90 MIN', key: 'pases_clave_p90', badge: 'RÉCORD', unit: '' },
    { title: 'PUNTOS TOTALES', key: 'media_juego', badge: 'LÍDER', unit: '' },
    { title: 'PRECISIÓN DE PASE', key: 'precision_pases', badge: 'ÉLITE', unit: '%' },
    { title: 'DUELOS GANADOS %', key: 'porcentaje_duelos_defensivos', badge: 'TOP', unit: '%' }
  ];

  container.innerHTML = metrics.map(m => {
    const maxVal = Math.max(...players.map(p => p[m.key] || 0));
    const leader = players.find(p => (p[m.key] || 0) === maxVal);

    return `
      <div style="background: #ffffff; border: 1px solid #f1f5f9; border-radius: 12px; padding: 10px; margin-bottom: 8px; font-family: 'Plus Jakarta Sans', sans-serif;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 0.7rem; font-weight: 800; color: #1e293b;">${m.title}</span>
          <span style="font-size: 0.6rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; background:#e6f4ea; color:#2d6a4f;">
            ${m.badge}: ${leader ? leader.nombre.split(' ')[0] : maxVal}${m.unit}
          </span>
        </div>
        ${players.map((p, idx) => {
          const val = p[m.key] || 0;
          const pct = Math.min(100, Math.max(10, (val / (maxVal || 1)) * 100));
          const color = PALETTE[idx % PALETTE.length].main;

          return `
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 0.7rem;">
              <span style="width: 80px; font-weight: 600; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.nombre}</span>
              <div style="flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; border-radius: 3px; width: ${pct}%; background-color: ${color};"></div>
              </div>
              <span style="width: 32px; text-align: right; font-weight: 800; color: ${color};">${val}${m.unit}</span>
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