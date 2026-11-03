import { playerService } from '../../services/player-service.js';

// Avatar genérico en SVG por si una imagen no existe o falla la red
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%2338bdf8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

const POSITION_MAP = {
  'POR': 'Portero',
  'DEF': 'Defensa',
  'MC': 'Centrocampista',
  'DEL': 'Delantero'
};

export async function renderMarketScreen(container, router) {
  const targetContainer = container || document.querySelector('#app-content');
  if (!targetContainer) return;

  initMarketLogic(targetContainer, router);
}

async function initMarketLogic(container, router) {
  const listContainer = container.querySelector('#market-player-list');
  const searchInput = container.querySelector('#market-search-input');
  const filterBtns = container.querySelectorAll('.filter-btn');

  if (!listContainer) return;

  let catalog = [];
  let selectedPosition = 'ALL';
  let searchQuery = '';
  let selectedForCompare = new Set();
  let sortMode = 'default';

  listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #6b7280;">Cargando jugadores...</p>';

  try {
    catalog = await playerService.getAllPlayers();
    renderCatalog();

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderCatalog();
      });
    }

    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPosition = btn.dataset.position;
        renderCatalog();
      });
    });

    const sortIcon = container.querySelector('.sort-icon');
    if (sortIcon) {
      sortIcon.style.cursor = 'pointer';
      sortIcon.title = 'Ordenar por precio';
      sortIcon.addEventListener('click', () => {
        if (sortMode === 'default') {
          sortMode = 'price-desc';
        } else if (sortMode === 'price-desc') {
          sortMode = 'price-asc';
        } else {
          sortMode = 'default';
        }
        
        sortIcon.style.color = sortMode !== 'default' ? '#2d6a4f' : '#64748b';
        renderCatalog();
      });
    }

  } catch (err) {
    console.error("Error al cargar mercado:", err);
    listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error al conectar con el servidor.</p>';
  }

  function renderCatalog() {
    let filtered = catalog.filter((player) => {
      const matchPos = selectedPosition === 'ALL' || player.posicion_base === selectedPosition;
      const matchSearch = player.nombre.toLowerCase().includes(searchQuery);
      return matchPos && matchSearch;
    });

    if (sortMode === 'price-desc') {
      filtered.sort((a, b) => b.precio - a.precio);
    } else if (sortMode === 'price-asc') {
      filtered.sort((a, b) => a.precio - b.precio);
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #6b7280;">No se encontraron futbolistas.</p>';
      return;
    }

    // Se genera el HTML completamente limpio sin atributos onerror inline
    listContainer.innerHTML = filtered.map((player) => {
      const isSelected = selectedForCompare.has(player.id);
      const readablePosition = POSITION_MAP[player.posicion_base] || player.posicion_base;
      const playerImage = player.photo_url || DEFAULT_AVATAR;

      return `
        <article class="player-item-card" data-id="${player.id}">
          <div class="player-info-left">
            <div class="player-avatar-box">
              <img 
                src="${playerImage}" 
                alt="${player.nombre}" 
                class="player-avatar-img"
                loading="lazy"
              />
            </div>
            <div>
              <h3 class="player-name">${player.nombre}</h3>
              <p class="player-pos">${readablePosition}</p>
            </div>
          </div>
          <div class="player-right-group">
            <span class="player-price">${player.precio}M</span>
            <button class="btn-add-player ${isSelected ? 'selected' : ''}" data-id="${player.id}">
              ${isSelected ? '✓' : '+'}
            </button>
          </div>
        </article>
      `;
    }).join('');

    // Manejador seguro para imágenes que no existan en Supabase
    listContainer.querySelectorAll('.player-avatar-img').forEach((img) => {
      img.addEventListener('error', () => {
        img.src = DEFAULT_AVATAR;
      }, { once: true });
    });

    // Eventos de selección para comparar
    listContainer.querySelectorAll('.btn-add-player').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.currentTarget.dataset.id, 10);
        if (selectedForCompare.has(id)) {
          selectedForCompare.delete(id);
        } else {
          if (selectedForCompare.size < 3) {
            selectedForCompare.add(id);
          } else {
            alert('Puedes comparar hasta 3 jugadores simultáneamente.');
          }
        }
        updateCompareButton();
        renderCatalog();
      });
    });
  }

  function updateCompareButton() {
    const btnCompare = container.querySelector('#btn-go-to-compare');
    const countSpan = container.querySelector('#compare-count');
    if (countSpan) countSpan.textContent = selectedForCompare.size;
    if (btnCompare) {
      btnCompare.disabled = selectedForCompare.size < 2;
      if (selectedForCompare.size >= 2) {
        btnCompare.onclick = () => {
          const ids = Array.from(selectedForCompare).join(',');
          router.navigate(`/comparison?ids=${ids}`);
        };
      }
    }
  }
}