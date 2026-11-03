/**
 * @file player-card.js
 * Componente visual de tarjeta de jugador
 */

// Avatar genérico en SVG para cuando una imagen no exista o falle la conexión
const DEFAULT_AVATAR = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="%2338bdf8"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>';

export function createPlayerCard(player) {
  const card = document.createElement('article');
  card.className = 'player-card';
  card.dataset.playerId = player.id;

  const nombreJugador = player.nombre || player.name || 'Jugador';
  // Toma directamente la URL resuelta por FastAPI; si no viene, usa el fallback
  const foto = player.photo_url || DEFAULT_AVATAR;

  card.innerHTML = `
    <div class="player-card__avatar-wrapper">
      <img 
        src="${foto}" 
        alt="${nombreJugador}" 
        class="player-card__img"
        loading="lazy"
      />
    </div>
    <div class="player-card__body">
      <span class="player-card__badge-pos">${player.posicion_base || ''}</span>
      <h3 class="player-card__name">${nombreJugador}</h3>
      <span class="player-card__price">${player.precio ?? 0}M €</span>
    </div>
  `;

  // Fallback seguro si la imagen da 404 en Supabase
  const imgElement = card.querySelector('.player-card__img');
  if (imgElement) {
    imgElement.addEventListener('error', () => {
      imgElement.src = DEFAULT_AVATAR;
    }, { once: true });
  }

  return card;
}