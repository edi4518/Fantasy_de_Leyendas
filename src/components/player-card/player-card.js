/**
 * @file player-card.js
 * @description Componente visual para tarjetas de leyendas consumiendo datos y fotos desde la API.
 */

const DEFAULT_AVATAR = '/public/images/default-avatar.png';

/**
 * Genera el elemento visual de la tarjeta de jugador.
 * @param {Object} player - Datos del jugador devueltos por FastAPI
 * @returns {HTMLElement}
 */
export function createPlayerCard(player) {
  const card = document.createElement('article');
  card.className = 'player-card';
  card.dataset.playerId = player.id;

  const imageSource = player.photo_url || DEFAULT_AVATAR;

  card.innerHTML = `
    <div class="player-card__avatar-wrapper">
      <img 
        src="${imageSource}" 
        alt="${player.name}" 
        class="player-card__img"
        loading="lazy"
        onerror="this.onerror=null; this.src='${DEFAULT_AVATAR}';"
      />
    </div>
    <div class="player-card__body">
      <span class="player-card__badge-pos">${player.position}</span>
      <h3 class="player-card__name">${player.name}</h3>
      <span class="player-card__price">${player.price}M €</span>
    </div>
  `;

  return card;
}