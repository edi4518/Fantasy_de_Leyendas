import { playerService } from '../../services/player-service.js';

// URL base de tu bucket público en Supabase
const STORAGE_URL = "https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/";

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

    // Evento para el botón de ordenar por precio (⇅)
    const sortIcon = container.querySelector('.sort-icon');
    if (sortIcon) {
      sortIcon.style.cursor = 'pointer';
      sortIcon.title = 'Ordenar por precio';
      sortIcon.addEventListener('click', () => {
        if (sortMode === 'default') {
          sortMode = 'price-desc'; // Mayor a menor precio
        } else if (sortMode === 'price-desc') {
          sortMode = 'price-asc';  // Menor a mayor precio
        } else {
          sortMode = 'default';    // Orden original
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

    // Aplicar ordenamiento según el modo activo
    if (sortMode === 'price-desc') {
      filtered.sort((a, b) => b.precio - a.precio);
    } else if (sortMode === 'price-asc') {
      filtered.sort((a, b) => a.precio - b.precio);
    }

    if (filtered.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #6b7280;">No se encontraron futbolistas.</p>';
      return;
    }

    listContainer.innerHTML = filtered.map((player) => {
      const isSelected = selectedForCompare.has(player.id);
      const readablePosition = POSITION_MAP[player.posicion_base] || player.posicion_base;

      // Construcción de la URL de la imagen combinando la base y el archivo del jugador
      const playerImage = player.image_filename 
        ? `${STORAGE_URL}${player.image_filename}` 
        : null;

      return `
        <article class="player-item-card">
          <div class="player-info-left">
            <div class="player-avatar-box" style="overflow: hidden; display: flex; align-items: center; justify-content: center;">
              ${playerImage 
                ? `<img src="${playerImage}" alt="${player.nombre}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.outerHTML='👤'" />` 
                : '👤'}
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