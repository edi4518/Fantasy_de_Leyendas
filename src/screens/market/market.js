import { playerService } from '../../services/player-service.js';
import { teamState } from '../../services/team-state.js';

// URL base de tu bucket público en Supabase
const STORAGE_URL = "https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/";

const POSITION_MAP = {
  'POR': 'Portero',
  'DEF': 'Defensa',
  'MC': 'Centrocampista',
  'DEL': 'Delantero'
};

let selectedIdsForAction = new Set();

export async function renderMarketScreen(container, router) {
  const targetContainer = container || document.querySelector('#app-content');
  if (!targetContainer) return;

  try {
    const allPlayers = await playerService.getAllPlayers();
    let state = teamState.getState();

    targetContainer.innerHTML = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; padding-bottom: 130px; background: #f8fafc; min-height: 100vh; position: relative;">
        <!-- Header -->
        <header style="display: flex; justify-content: space-between; align-items: flex-start; padding: 16px 20px; background: white; border-bottom: 1px solid #e2e8f0;">
          <div>
            <h1 style="margin: 0; font-size: 1.3rem; font-weight: 800; color: #0f172a;">Mercado de Fichajes</h1>
            <button id="btn-reset-budget" style="margin-top: 6px; padding: 4px 8px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; font-size: 0.65rem; font-weight: 700; cursor: pointer;">
              🔄 Reiniciar (100M)
            </button>
          </div>
          <div style="text-align: right;">
            <span style="font-size: 0.6rem; font-weight: 700; color: #64748b; text-transform: uppercase; display: block;">PRESUPUESTO DISPONIBLE</span>
            <strong id="market-budget" style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${(state.budget || 100).toFixed(1)}M</strong>
            <span style="font-size: 0.65rem; font-weight: 700; color: #64748b; display: block; margin-top: 2px;">Plantilla: <strong id="market-roster-count" style="color: #0f172a;">${state.roster ? state.roster.length : 0} / 9</strong></span>
          </div>
        </header>

        <!-- Buscador y Filtros -->
        <div style="padding: 16px 20px 8px 20px;">
          <div style="position: relative; margin-bottom: 12px;">
            <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8;">🔍</span>
            <input type="text" id="market-search" placeholder="Buscar futbolistas..." style="width: 100%; padding: 10px 12px 10px 36px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 0.8rem; background: white; outline: none; box-sizing: border-box;">
          </div>
          
          <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;" id="position-filters">
            <button class="filter-btn active" data-pos="TODOS" style="background: #2d6a4f; color: white; border: none; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">Todos</button>
            <button class="filter-btn" data-pos="POR" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">POR</button>
            <button class="filter-btn" data-pos="DEF" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">DEF</button>
            <button class="filter-btn" data-pos="MC" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">MC</button>
            <button class="filter-btn" data-pos="DEL" style="background: white; color: #475569; border: 1px solid #e2e8f0; padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; cursor: pointer; white-space: nowrap;">DEL</button>
          </div>
        </div>

        <!-- Lista de Jugadores Disponibles con Selector de Ordenar -->
        <div style="padding: 0 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase;">Jugadores Disponibles</div>
            <select id="market-sort" style="font-size: 0.7rem; font-weight: 700; color: #475569; background: white; border: 1px solid #cbd5e1; border-radius: 8px; padding: 4px 8px; outline: none; cursor: pointer;">
              <option value="default">↕️ Ordenar</option>
              <option value="price-asc">Precio: Menor a Mayor</option>
              <option value="price-desc">Precio: Mayor a Menor</option>
              <option value="rating-desc">Mayor Valoración</option>
              <option value="name-asc">Nombre (A-Z)</option>
            </select>
          </div>
          <div id="market-player-list" style="display: flex; flex-direction: column; gap: 8px;">
            <!-- Renderizado dinámico -->
          </div>
        </div>

        <!-- Footer Dual-Action perfectamente acoplado al ancho interno del celular -->
        <div style="position: fixed; bottom: 65px; left: 50%; transform: translateX(-50%); width: calc(100% - 40px); max-width: 440px; background: white; padding: 12px 16px; border-top: 1px solid #e2e8f0; border-radius: 16px; display: flex; gap: 10px; z-index: 100; box-sizing: border-box; box-shadow: 0 -4px 15px rgba(0,0,0,0.08);">
          <button id="btn-compare" style="flex: 1; padding: 10px 8px; background: #f8fafc; color: #2d6a4f; border: 1px solid #cbd5e1; border-radius: 12px; font-weight: 700; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;">
            🔀 Comparar (<span id="compare-count">0</span>)
          </button>
          <button id="btn-sign" style="flex: 1; padding: 10px 8px; background: #2d6a4f; color: white; border: none; border-radius: 12px; font-weight: 700; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap;">
            🛍️ Fichar (<span id="sign-count">0</span>)
          </button>
        </div>
      </div>
    `;

    const listContainer = targetContainer.querySelector('#market-player-list');
    const searchInput = targetContainer.querySelector('#market-search');
    const sortSelect = targetContainer.querySelector('#market-sort');
    const filterBtns = targetContainer.querySelectorAll('.filter-btn');
    const compareCountSpan = targetContainer.querySelector('#compare-count');
    const signCountSpan = targetContainer.querySelector('#sign-count');
    const budgetDisplay = targetContainer.querySelector('#market-budget');
    const rosterDisplay = targetContainer.querySelector('#market-roster-count');
    
    let currentPos = 'TODOS';

    const updateUIList = () => {
      const currentState = teamState.getState();
      budgetDisplay.textContent = `${currentState.budget.toFixed(1)}M`;
      rosterDisplay.textContent = `${currentState.roster.length} / 9`;

      const query = searchInput.value.toLowerCase().trim();
      const sortVal = sortSelect.value;
      const rosterIds = currentState.roster ? currentState.roster.map(p => p.id) : [];

      let filtered = allPlayers.filter(p => {
        const matchesSearch = p.nombre ? p.nombre.toLowerCase().includes(query) : true;
        const matchesPos = currentPos === 'TODOS' || (p.posicion_base && p.posicion_base.toUpperCase().includes(currentPos));
        const notInRoster = !rosterIds.includes(p.id);
        return matchesSearch && matchesPos && notInRoster;
      });

      // Lógica de Ordenamiento
      if (sortVal === 'price-asc') {
        filtered.sort((a, b) => (a.precio || 0) - (b.precio || 0));
      } else if (sortVal === 'price-desc') {
        filtered.sort((a, b) => (b.precio || 0) - (a.precio || 0));
      } else if (sortVal === 'rating-desc') {
        filtered.sort((a, b) => (b.media_juego || 0) - (a.media_juego || 0));
      } else if (sortVal === 'name-asc') {
        filtered.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
      }

      if (filtered.length === 0) {
        listContainer.innerHTML = `<p style="text-align: center; color: #94a3b8; font-size: 0.75rem; padding: 20px;">No hay jugadores disponibles en este filtro.</p>`;
        return;
      }

      listContainer.innerHTML = filtered.map(p => {
        const isSelected = selectedIdsForAction.has(p.id);
        const ratingStar = p.media_juego ? (p.media_juego / 10).toFixed(1) : '8.0';

        // Usamos tu lógica original con image_filename
        const playerImage = p.image_filename 
          ? `${STORAGE_URL}${p.image_filename}` 
          : null;

        return `
          <div class="market-player-card" data-id="${p.id}" style="display: flex; align-items: center; justify-content: space-between; background: white; border: 1px solid ${isSelected ? '#2d6a4f' : '#e2e8f0'}; border-radius: 16px; padding: 10px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #f1f5f9; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #cbd5e1; flex-shrink: 0;">
                ${playerImage 
                  ? `<img src="${playerImage}" alt="${p.nombre || 'Jugador'}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none';">`
                  : `<span style="font-size: 0.8rem; font-weight: 700; color: #475569;">👤</span>`
                }
              </div>
              <div>
                <strong style="font-size: 0.85rem; color: #0f172a; display: block;">${p.nombre || 'Sin nombre'}</strong>
                <span style="font-size: 0.7rem; color: #64748b;">${p.posicion_base || 'Jugador'} • ⭐ ${ratingStar}</span>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">${p.precio || 0}M €</span>
              <button class="btn-toggle-select" data-id="${p.id}" style="width: 32px; height: 32px; border-radius: 50%; background: ${isSelected ? '#2d6a4f' : '#f1f5f9'}; color: ${isSelected ? 'white' : '#2d6a4f'}; border: 1px solid ${isSelected ? '#2d6a4f' : '#cbd5e1'}; font-size: 1rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                ${isSelected ? '✓' : '+'}
              </button>
            </div>
          </div>
        `;
      }).join('');

      listContainer.querySelectorAll('.btn-toggle-select').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = parseInt(btn.dataset.id, 10);
          if (selectedIdsForAction.has(id)) {
            selectedIdsForAction.delete(id);
          } else {
            selectedIdsForAction.add(id);
          }
          compareCountSpan.textContent = selectedIdsForAction.size;
          signCountSpan.textContent = selectedIdsForAction.size;
          updateUIList();
        });
      });
    };

    updateUIList();

    targetContainer.querySelector('#btn-reset-budget').addEventListener('click', () => {
      teamState.resetState();
      selectedIdsForAction.clear();
      compareCountSpan.textContent = 0;
      signCountSpan.textContent = 0;
      updateUIList();
      alert('¡Presupuesto restablecido a 100.0M!');
    });

    searchInput.addEventListener('input', updateUIList);
    sortSelect.addEventListener('change', updateUIList);

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        filterBtns.forEach(b => {
          b.style.background = 'white';
          b.style.color = '#475569';
          b.style.border = '1px solid #e2e8f0';
        });
        btn.style.background = '#2d6a4f';
        btn.style.color = 'white';
        btn.style.border = 'none';

        currentPos = btn.dataset.pos;
        updateUIList();
      });
    });

    // Acción Comparar
    targetContainer.querySelector('#btn-compare').addEventListener('click', () => {
      if (selectedIdsForAction.size === 0) {
        alert('Selecciona al menos 1 jugador para comparar.');
        return;
      }
      const idsParam = Array.from(selectedIdsForAction).join(',');
      router.navigate(`/comparison?ids=${idsParam}`);
    });

    // Acción Fichar
    targetContainer.querySelector('#btn-sign').addEventListener('click', () => {
      if (selectedIdsForAction.size === 0) {
        alert('Selecciona al menos 1 jugador para fichar.');
        return;
      }
      const playersToSign = allPlayers.filter(p => selectedIdsForAction.has(p.id));
      const success = teamState.addPlayers(playersToSign);

      if (success) {
        selectedIdsForAction.clear();
        
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; z-index: 99999;
          font-family: 'Plus Jakarta Sans', sans-serif;
        `;

        modalOverlay.innerHTML = `
          <div style="background: white; width: 85%; max-width: 320px; border-radius: 20px; padding: 24px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">✅</div>
            <h3 style="margin: 0 0 8px 0; font-size: 1.1rem; font-weight: 800; color: #0f172a;">¡Jugadores Fichados!</h3>
            <p style="margin: 0 0 20px 0; font-size: 0.8rem; color: #64748b;">Se han sumado a tu plantilla. Revisa la alineación para colocarlos en la cancha.</p>
            <button id="modal-accept-btn" style="width: 100%; padding: 10px; background: #2d6a4f; color: white; border: none; border-radius: 12px; font-weight: 800; font-size: 0.85rem; cursor: pointer;">Ver Alineación</button>
          </div>
        `;

        document.body.appendChild(modalOverlay);

        modalOverlay.querySelector('#modal-accept-btn').addEventListener('click', () => {
          modalOverlay.remove();
          
          if (!localStorage.getItem("auth_token")) {
            localStorage.setItem("auth_token", "dev-test-token");
          }
          
          router.navigate('/lineup');
        });
      }
    });

  } catch (err) {
    console.error("Error al cargar el mercado:", err);
  }
}