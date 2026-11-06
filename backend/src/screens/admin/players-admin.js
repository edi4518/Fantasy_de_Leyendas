import { playerService } from '../../services/player-service.js';

export function renderPlayersAdminScreen(container) {
  let catalog = [];

  fetch('/src/screens/admin/players-admin.html')
    .then((res) => res.text())
    .then((html) => {
      container.innerHTML = html;
      initEvents();
      loadTableData();
    });

  function initEvents() {
    const modal = container.querySelector('#admin-player-modal');
    const form = container.querySelector('#admin-player-form');

    container.querySelector('#btn-open-create-modal').addEventListener('click', () => {
      form.reset();
      container.querySelector('#form-player-id').value = '';
      container.querySelector('#modal-title').textContent = 'Nueva Leyenda';
      modal.classList.remove('hidden');
    });

    container.querySelector('#btn-close-modal').addEventListener('click', () => modal.classList.add('hidden'));
    container.querySelector('#btn-cancel-modal').addEventListener('click', () => modal.classList.add('hidden'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const playerData = {
        id_jugador: container.querySelector('#form-player-id').value || null,
        nombre: container.querySelector('#form-nombre').value,
        posicion: container.querySelector('#form-posicion').value,
        nacionalidad: container.querySelector('#form-nacionalidad').value,
        rating_ataque: parseInt(container.querySelector('#form-ataque').value, 10),
        rating_creacion: parseInt(container.querySelector('#form-creacion').value, 10),
        rating_defensa: parseInt(container.querySelector('#form-defensa').value, 10),
        rating_fisico: parseInt(container.querySelector('#form-fisico').value, 10),
        precio_mercado_mv: parseFloat(container.querySelector('#form-precio').value)
      };

      try {
        if (playerData.id_jugador) {
          await playerService.updatePlayer(playerData.id_jugador, playerData);
        } else {
          await playerService.createPlayer(playerData);
        }
        modal.classList.add('hidden');
        loadTableData();
      } catch (err) {
        console.error('Error al guardar:', err);
      }
    });
  }

  async function loadTableData() {
    try {
      catalog = await playerService.getAllPlayers();
      const tbody = container.querySelector('#admin-table-body');
      
      tbody.innerHTML = catalog
        .map(
          (p) => `
        <tr>
          <td>#${p.id_jugador}</td>
          <td><strong>${p.nombre}</strong></td>
          <td>${p.posicion}</td>
          <td>${p.nacionalidad}</td>
          <td>${p.rating_ataque} / ${p.rating_creacion} / ${p.rating_defensa} / ${p.rating_fisico}</td>
          <td>${p.precio_mercado_mv}M €</td>
          <td>
            <button class="btn-action-edit" data-id="${p.id_jugador}">Editar</button>
            <button class="btn-action-delete" data-id="${p.id_jugador}">Baja</button>
          </td>
        </tr>
      `
        )
        .join('');

      // Eventos de edición y baja
      tbody.querySelectorAll('.btn-action-edit').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          const p = catalog.find((item) => item.id_jugador === parseInt(e.target.dataset.id, 10));
          if (!p) return;

          container.querySelector('#form-player-id').value = p.id_jugador;
          container.querySelector('#form-nombre').value = p.nombre;
          container.querySelector('#form-posicion').value = p.posicion;
          container.querySelector('#form-nacionalidad').value = p.nacionalidad;
          container.querySelector('#form-ataque').value = p.rating_ataque;
          container.querySelector('#form-creacion').value = p.rating_creacion;
          container.querySelector('#form-defensa').value = p.rating_defensa;
          container.querySelector('#form-fisico').value = p.rating_fisico;
          container.querySelector('#form-precio').value = p.precio_mercado_mv;

          container.querySelector('#modal-title').textContent = 'Editar Leyenda';
          container.querySelector('#admin-player-modal').classList.remove('hidden');
        });
      });

      tbody.querySelectorAll('.btn-action-delete').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          if (confirm('¿Dar de baja esta leyenda?[cite: 8]')) {
            await playerService.deletePlayer(parseInt(e.target.dataset.id, 10));
            loadTableData();
          }
        });
      });
    } catch (err) {
      console.error('Error al cargar la tabla de administración:', err);
    }
  }
}