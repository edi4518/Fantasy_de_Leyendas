import { playerService } from '../../services/player-service.js';

const STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';

/**
 * Obtiene la URL completa de la imagen del jugador
 */
export function getPlayerAvatarUrl(player) {
  if (!player) return null;
  const rawImg = player.image_filename || player.avatarUrl || player.photo_url || player.image_url || player.imagen;
  if (!rawImg) return null;
  return rawImg.startsWith('http://') || rawImg.startsWith('https://')
    ? rawImg
    : `${STORAGE_URL}${rawImg}`;
}

/**
 * Normaliza y obtiene el nivel de energía física actual del jugador (0 a 100)
 */
export function getPlayerEnergy(player) {
  if (!player) return 100;
  const raw = player.energia ?? player.stamina;
  if (raw === undefined || raw === null || raw === '') return 100;
  const num = Number(raw);
  if (isNaN(num)) return 100;
  return Math.max(0, Math.min(100, Math.round(num)));
}

/**
 * Genera el HTML del avatar circular del jugador con fallback a su inicial y alt text con nivel de energía
 */
function getPlayerAvatarHtml(player, imgClass = 'lineup-token-img') {
  const playerName = player?.name || player?.nombre || 'Jugador';
  const initial = getPlayerInitial(playerName);
  const avatarUrl = getPlayerAvatarUrl(player);
  const energy = getPlayerEnergy(player);
  const altText = `${playerName} - Energía: ${energy}%`;
  if (!avatarUrl) {
    return `<span class="lineup-token-initial" title="${altText}" alt="${altText}" aria-label="${altText}">${initial}</span>`;
  }
  return `
    <div class="lineup-token-avatar" title="${altText}">
      <img src="${avatarUrl}" alt="${altText}" title="${altText}" class="${imgClass}" onerror="this.parentElement.outerHTML='<span class=\\'lineup-token-initial\\' title=\\'${altText}\\' alt=\\'${altText}\\'>${initial}</span>'" />
    </div>
  `;
}

/**
 * Determina la clase CSS de la píldora de valoración según la categoría de la media:
 * - Bronce común: 00 - 47
 * - Bronce especial: 48 - 64
 * - Plata común: 65 - 74
 * - Plata especial: 75 - 85
 * - Oro común: 86 - 94
 * - Oro especial: 95 - 99
 */
export function getRatingTierClass(rating) {
  const r = Number(rating) || 0;
  if (r <= 47) return 'tier-bronze-common';
  if (r <= 64) return 'tier-bronze-special';
  if (r <= 74) return 'tier-silver-common';
  if (r <= 85) return 'tier-silver-special';
  if (r <= 94) return 'tier-gold-common';
  return 'tier-gold-special'; // 95 - 99
}

/**
 * Calcula la valoración real del jugador según su rol y estadísticas
 */
export function getPlayerRating(player) {
  if (!player) return 75;
  if (typeof player.media_juego === 'number' && player.media_juego > 0) {
    return Math.round(player.media_juego);
  }
  if (typeof player.rating_general === 'number' && player.rating_general > 0) {
    return Math.round(player.rating_general);
  }

  const role = (player.role || player.posicion_base || 'MC').toUpperCase();
  if (role === 'DEL') {
    return Math.round(player.rating_ataque || 85);
  }
  if (role === 'DEF') {
    return Math.round(player.rating_defensa || 85);
  }
  if (role === 'POR') {
    return Math.round(player.rating_defensa || player.rating_general || 85);
  }
  // MC
  const cre = player.rating_creacion || 80;
  const tec = player.rating_tecnica || 80;
  return Math.round((cre * 0.5) + (tec * 0.5));
}

/**
 * Obtiene o calcula el precio en millones de un jugador
 */
export function getPlayerPrice(player) {
  if (!player) return 0;
  if (typeof player.precio === 'number' && player.precio > 0) {
    return Number(player.precio);
  }
  if (typeof player.price === 'number' && player.price > 0) {
    return Number(player.price);
  }
  const rating = getPlayerRating(player);
  const base = Math.max(2.0, ((rating - 60) * 0.35 + 3.0));
  return Math.round(base * 10) / 10;
}
/**
 * @file lineup.js
 * @description Controlador de la Pizarra Táctica y Alineación (6 titulares en cancha + 3 suplentes).
 * Soporta las 6 formaciones tácticas oficiales 6v6, selector desplegable dinámico,
 * cálculo reactivo de equilibrio/química, penalizaciones por posición y rotación/swap de jugadores.
 *
 * @exports { initLineup }
 */

import { FORMATIONS_6V6, isValidFormation } from '../../domain/formation-rules.js';
import { getPositionPenalty } from '../../domain/simulation-engine.js';
import { squadService } from '../../services/squad-service.js';

// Estado local de la pantalla
let activeSquad = null;
let selectedSlot = null; // { type: 'starter' | 'reserve', index: number }


// Variable para saber qué slot se está gestionando en el modal de acción
let activeActionSlotIndex = null;

/**
 * Persiste la alineación activa en localStorage y dispara el evento de sincronización global
 */
export function persistActiveSquad({ allowEmpty = false } = {}) {
  if (!activeSquad) return;
  try {
    localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
    window.dispatchEvent(new CustomEvent('fantasy:squad-updated', { detail: activeSquad }));
    let currentUserId = null;
    try {
      const userObj = JSON.parse(localStorage.getItem('user') || '{}');
      if (userObj && userObj.id) currentUserId = Number(userObj.id);
    } catch (_) {}

    // Salvaguarda: NUNCA enviar al backend una plantilla vacía para evitar destruir inventario en BD
    const hasAnyRealPlayer = Array.isArray(activeSquad.players) && activeSquad.players.some(Boolean);
    // Solo se sincroniza una plantilla vacía si fue el propio usuario quien vendió a todos (allowEmpty)
    if (!hasAnyRealPlayer && !allowEmpty) {
      console.debug('[Lineup] Sincronización con backend omitida (plantilla sin jugadores).');
      return;
    }

    squadService.saveSquad({
      formation: activeSquad.formation || '1-2-2-1',
      players: activeSquad.players || [],
      name: activeSquad.name || undefined,
      user_id: currentUserId,
      allow_empty: allowEmpty
    }).catch((err) => {
      console.debug('[Lineup] Sincronización automática con backend omitida:', err.message);
    });
  } catch (err) {
    console.debug('[Lineup] Error al persistir plantilla:', err);
  }
}

/**
 * Inicializador principal llamado por el router
 */
// Listener reactivo para actualizar estadísticas del jugador si el modal de acción está abierto
window.addEventListener('fantasy:player-stats-updated', () => {
  if (activeActionSlotIndex !== null) {
    const sheet = document.getElementById('player-action-sheet');
    if (sheet && sheet.classList.contains('is-open')) {
      openPlayerActionModal(activeActionSlotIndex);
    }
  }
});


/**
 * Sincroniza dinámicamente la plantilla activa con los datos oficiales de la base de datos (API)
 */
export async function syncSquadWithDatabase() {
  try {
    if (!activeSquad || !Array.isArray(activeSquad.players)) {
      loadActiveSquad();
    }

    // Sincronizar o recuperar plantilla remota de MySQL (/api/squads/my-squad)
    const hasLocalPlayers = Array.isArray(activeSquad?.players) && activeSquad.players.some(Boolean);
    try {
      const remoteSquad = await squadService.getMySquad();
      if (remoteSquad && Array.isArray(remoteSquad.players) && remoteSquad.players.some(Boolean)) {
        if (!hasLocalPlayers) {
          activeSquad = {
            name: remoteSquad.name || activeSquad.name || 'Tu Equipo',
            formation: remoteSquad.formation || activeSquad.formation || '1-2-2-1',
            players: remoteSquad.players
          };
          while (activeSquad.players.length < 10) {
            activeSquad.players.push(null);
          }
          localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
          renderScreen();
        } else {
          // Sincronizar estado físico y energía desde el backend oficial
          let energySyncUpdated = false;
          activeSquad.players = activeSquad.players.map((lp) => {
            if (!lp) return lp;
            const rp = remoteSquad.players.find(r => r && (r.id === lp.id || (r.name && lp.name && r.name.toLowerCase() === lp.name.toLowerCase())));
            if (rp && rp.energia !== undefined && rp.energia !== null && !isNaN(Number(rp.energia))) {
              const remoteEnergy = Math.max(0, Math.min(100, Math.round(Number(rp.energia))));
              if (lp.energia !== remoteEnergy) {
                energySyncUpdated = true;
                return { ...lp, energia: remoteEnergy, stamina: remoteEnergy };
              }
            }
            return lp;
          });
          if (energySyncUpdated) {
            localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
            renderScreen();
          }
        }
      }
    } catch (e) {
      console.debug('[Lineup] No se pudo recuperar o sincronizar plantilla remota de MySQL:', e.message);
    }

    const catalog = await playerService.getAllPlayers();
    if (!Array.isArray(catalog) || catalog.length === 0) return;

    let updated = false;
    activeSquad.players = activeSquad.players.map((p) => {
      if (!p) return null;
      const catalogPlayer = catalog.find(cp => cp.id === p.id) ||
        catalog.find(cp => {
          const cleanCp = (cp.nombre || cp.name || '').toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
          const cleanP = (p.name || p.nombre || '').toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
          return cleanCp === cleanP || cleanCp.includes(cleanP) || cleanP.includes(cleanCp);
        });

      if (catalogPlayer) {
        updated = true;
        return {
          ...catalogPlayer,
          id: catalogPlayer.id,
          name: catalogPlayer.nombre,
          nombre: catalogPlayer.nombre,
          role: catalogPlayer.posicion_base,
          posicion_base: catalogPlayer.posicion_base,
          posicion_detalle: catalogPlayer.posicion_detalle,
          media_juego: catalogPlayer.media_juego,
          rating_general: catalogPlayer.media_juego,
          precio: catalogPlayer.precio,
          price: catalogPlayer.precio,
          rating_ataque: catalogPlayer.rating_ataque,
          rating_defensa: catalogPlayer.rating_defensa,
          rating_creacion: catalogPlayer.rating_creacion,
          rating_tecnica: catalogPlayer.rating_tecnica,
          rating_fisico: catalogPlayer.rating_fisico,
          rating_palmares: catalogPlayer.rating_palmares,
          image_filename: catalogPlayer.image_filename,
          energia: getPlayerEnergy(p),
          minutosJugados: typeof p.minutosJugados === 'number' ? p.minutosJugados : 0
        };
      }
      return p;
    });

    if (updated) {
      persistActiveSquad();
      renderScreen();
    }
  } catch (err) {
    console.warn('[Lineup] No se pudo sincronizar con la base de datos:', err.message);
  }
}

export function initLineup(router) {
  loadActiveSquad();
  setupDropdownEvents();
  setupInfoButton();
  setupActionModalEvents(router);
  setupSaveButton(router);
  renderScreen();
  syncSquadWithDatabase();
}


/**
 * Carga la plantilla activa desde localStorage o el fallback oficial
 */
function loadActiveSquad() {
  try {
    const raw = localStorage.getItem('fantasy_active_squad');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players)) {
        activeSquad = {
          name: parsed.name || 'Tu Equipo',
          formation: isValidFormation(parsed.formation) ? parsed.formation : '1-2-2-1',
          players: [...parsed.players]
        };

        while (activeSquad.players.length < 10) {
          activeSquad.players.push(null);
        }
        if (activeSquad.players.length > 10) {
          activeSquad.players = activeSquad.players.slice(0, 10);
        }
        return;
      }
    }
  } catch (err) {
    console.debug('[Lineup] Error al leer plantilla activa:', err);
  }

  activeSquad = {
    name: 'Tu Equipo',
    formation: '1-2-2-1',
    players: new Array(10).fill(null)
  };
  persistActiveSquad();
}

/**
 * Asegura que la lista de jugadores tenga al menos 9 futbolistas
 */
function fillSquadToTen() {
  if (!activeSquad || !activeSquad.players) activeSquad.players = [];
  while (activeSquad.players.length < 10) {
    activeSquad.players.push(null);
  }
}

/**
 * Restablece la plantilla completa oficial equilibrada con 6 titulares y 3 suplentes
 */
export function resetToBalancedSquad() {
  if (!activeSquad || !Array.isArray(activeSquad.players)) {
    loadActiveSquad();
  }

  const realPlayers = activeSquad.players.filter(Boolean);
  if (realPlayers.length === 0) {
    showToast('Tu plantilla está vacía. Ficha futbolistas en el mercado.');
    return;
  }

  const newSlots = new Array(10).fill(null);
  const remaining = [...realPlayers];

  // 1. Asignar POR al puesto 0
  const porIdx = remaining.findIndex(p => (p.role || p.posicion_base) === 'POR');
  if (porIdx !== -1) {
    newSlots[0] = remaining.splice(porIdx, 1)[0];
  }

  // 2. Asignar DEF a puestos 1 y 2
  for (let slot = 1; slot <= 2; slot++) {
    const defIdx = remaining.findIndex(p => (p.role || p.posicion_base) === 'DEF');
    if (defIdx !== -1) {
      newSlots[slot] = remaining.splice(defIdx, 1)[0];
    }
  }

  // 3. Asignar MC a puestos 3 y 4
  for (let slot = 3; slot <= 4; slot++) {
    const mcIdx = remaining.findIndex(p => (p.role || p.posicion_base) === 'MC');
    if (mcIdx !== -1) {
      newSlots[slot] = remaining.splice(mcIdx, 1)[0];
    }
  }

  // 4. Asignar DEL al puesto 5
  const delIdx = remaining.findIndex(p => (p.role || p.posicion_base) === 'DEL');
  if (delIdx !== -1) {
    newSlots[5] = remaining.splice(delIdx, 1)[0];
  }

  // 5. Ubicar restantes en los puestos titulares libres (0 a 5)
  for (let slot = 0; slot < 6; slot++) {
    if (!newSlots[slot] && remaining.length > 0) {
      newSlots[slot] = remaining.shift();
    }
  }

  // 6. Los restantes van al banquillo de reservas (6 a 9)
  for (let slot = 6; slot < 10; slot++) {
    if (remaining.length > 0) {
      newSlots[slot] = remaining.shift();
    }
  }

  activeSquad.players = newSlots;
  persistActiveSquad();
  renderScreen();
  showToast('¡Jugadores reubicados tácticamente en tu alineación!');
}

/**
 * Renderiza todos los elementos reactivos de la pantalla
 */
function renderScreen() {
  renderFormationDropdown();
  renderPitchPlayers();
  renderReserves();
  renderMetrics();
  renderTacticalAdvice();
}

/**
 * Renderiza el selector desplegable de formación
 */
const FORMATION_PRESETS = [
  { key: '1-2-2-1', tag: 'Equilibrada' },
  { key: '1-2-1-2', tag: 'Rombo' },
  { key: '1-1-2-2', tag: 'Ofensiva' },
  { key: '1-3-1-1', tag: 'Contención' },
  { key: '1-1-3-1', tag: 'Posesión' },
  { key: '1-1-1-3', tag: 'Ataque total' }
];

function renderFormationDropdown() {
  const currentText = document.getElementById('current-formation-text');
  if (currentText) {
    currentText.textContent = activeSquad.formation;
  }

  const list = document.getElementById('formation-options-list');
  if (!list) return;

  list.innerHTML = FORMATION_PRESETS.map(({ key, tag }) => {
    const isActive = key === activeSquad.formation;
    return `
      <li class="formation-dropdown__li">
        <button type="button" class="formation-dropdown__item ${isActive ? 'is-active' : ''}" data-formation="${key}">
          <span class="formation-dropdown__name">${key}</span>
          ${isActive ? `
            <svg class="formation-dropdown__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          ` : `
            <span class="formation-dropdown__tag">${tag}</span>
          `}
        </button>
      </li>
    `;
  }).join('');

  // Eventos de selección de formación
  list.querySelectorAll('.formation-dropdown__item').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newForm = btn.getAttribute('data-formation');
      if (newForm && newForm !== activeSquad.formation) {
        changeFormation(newForm);
      }
      closeDropdown();
    });
  });
}

/**
 * Cambia la formación activa y actualiza la pizarra
 */
function changeFormation(newFormationKey) {
  if (!isValidFormation(newFormationKey)) return;
  activeSquad.formation = newFormationKey;
  selectedSlot = null; // Reset de selección
  persistActiveSquad();
  renderScreen();
  showToast(`Formación cambiada a ${newFormationKey}`);
}

/**
 * Renderiza los 6 jugadores titulares distribuidos en filas tácticas según la formación
 */
function renderPitchPlayers() {
  const container = document.getElementById('pitch-players-layer');
  if (!container) return;

  const formationData = FORMATIONS_6V6[activeSquad.formation] || FORMATIONS_6V6['1-2-2-1'];
  const slots = formationData.slots; // ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL']

  // Los 6 titulares son los primeros 6 elementos del array (pueden tener jugador o null)
  const starters = activeSquad.players.slice(0, 6);

  const slotObjects = slots.map((assignedRole, index) => ({
    index,
    assignedRole,
    player: starters[index] || null
  }));

  const delRow = slotObjects.filter(s => s.assignedRole === 'DEL');
  const mcRow = slotObjects.filter(s => s.assignedRole === 'MC');
  const defRow = slotObjects.filter(s => s.assignedRole === 'DEF');
  const porRow = slotObjects.filter(s => s.assignedRole === 'POR');

  const rowsHtml = [
    renderLineRow(delRow, 'row-del'),
    renderLineRow(mcRow, 'row-mc'),
    renderLineRow(defRow, 'row-def'),
    renderLineRow(porRow, 'row-por')
  ].join('');

  container.innerHTML = rowsHtml;

  // Asignar eventos de click a cada ficha
  container.querySelectorAll('.pitch-slot').forEach(el => {
    el.addEventListener('click', (e) => {
      // Si hizo clic en el botón de quitar, no ejecutar selección
      if (e.target.closest('.pitch-slot__remove-btn')) return;
      const index = parseInt(el.getAttribute('data-index'), 10);
      handleSlotClick('starter', index);
    });
  });

  // Asignar eventos a botones de quitar jugador
  container.querySelectorAll('.pitch-slot__remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'), 10);
      removePlayerToBench(index);
    });
  });
}

/**
 * Genera el HTML de una fila de jugadores en la cancha
 */

/**
 * Genera el marcado HTML para la píldora visual de stamina (rayo + barra ancha redondeada + %)
 */
function getStaminaPillHtml(energia = 100) {
  const num = Number(energia);
  const val = (energia !== undefined && energia !== null && !isNaN(num))
    ? Math.max(0, Math.min(100, Math.round(num)))
    : 100;
  const isExhausted = val === 0;
  let tier = 'stamina-high';
  if (isExhausted) tier = 'stamina-empty';
  else if (val < 60) tier = 'stamina-low';
  else if (val < 80) tier = 'stamina-mid';

  const staminaAlt = isExhausted ? 'Agotado (0% energía) - Requiere descanso' : `Energía: ${val}%`;
  return `
    <div class="stamina-pill ${isExhausted ? 'stamina-pill--exhausted' : ''}" title="${staminaAlt}" alt="${staminaAlt}" aria-label="${staminaAlt}">
      <svg class="stamina-pill__bolt ${tier}" width="9" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" alt="${staminaAlt}">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <div class="stamina-pill__track ${isExhausted ? 'stamina-pill__track--exhausted' : ''}" role="progressbar" aria-valuenow="${val}" aria-valuemin="0" aria-valuemax="100" title="${staminaAlt}" alt="${staminaAlt}">
        <div class="stamina-pill__fill ${tier}" style="width: ${val}%"></div>
      </div>
      <span class="stamina-pill__text ${isExhausted ? 'stamina-pill__text--exhausted' : ''}" title="${staminaAlt}" alt="${staminaAlt}">${val}%</span>
    </div>
  `;
}

function renderLineRow(slotsInRow, rowClass) {
  if (!slotsInRow || slotsInRow.length === 0) return '';

  const slotsHtml = slotsInRow.map(({ index, assignedRole, player }) => {
    const isSelected = selectedSlot && selectedSlot.type === 'starter' && selectedSlot.index === index;

    // 1. CASO: Lugar vacío (quitaron al jugador) -> círculo punteado semi-transparente con '+'
    if (!player) {
      return `
        <div class="pitch-slot is-empty ${isSelected ? 'is-selected' : ''}" data-index="${index}" title="Puesto libre para ${assignedRole}. Haz clic para asignar un jugador.">
          <div class="pitch-slot__token">
            <span class="pitch-slot__empty-plus">+</span>
          </div>
          <span class="pitch-slot__name-empty">Vacío</span>
          <span class="pitch-slot__role-badge">${assignedRole}</span>
        </div>
      `;
    }

    // 2. CASO: Lugar ocupado con jugador
    const naturalRole = (player.role || player.posicion_base || 'MC').toUpperCase();
    const penaltyRate = getPositionPenalty(naturalRole, assignedRole);
    const isPenalized = penaltyRate > 0;
    const rating = getPlayerRating(player);

    const stamina = getPlayerEnergy(player);
    const isExhausted = stamina === 0;
    const slotTitle = isExhausted
      ? `¡AGOTADO (0% ENERGÍA)! ${player.name} (${naturalRole}) - Debes sacarlo del equipo titular.`
      : `${player.name} (${naturalRole}) - Asignado: ${assignedRole} - Energía: ${stamina}%`;

    return `
      <div class="pitch-slot ${isPenalized ? 'is-penalized' : ''} ${isExhausted ? 'is-exhausted' : ''} ${isSelected ? 'is-selected' : ''}" data-index="${index}" title="${slotTitle}" alt="${slotTitle}" aria-label="${slotTitle}">
        <div class="pitch-slot__token">
          ${getPlayerAvatarHtml(player)}
          <span class="pitch-slot__rating-pill ${getRatingTierClass(rating)}" title="Valoración del jugador: ${rating}">${rating}</span>
          ${isPenalized ? '<span class="pitch-slot__penalty-dot" title="Fuera de posición natural (-15% eficacia)"></span>' : ''}
          ${isExhausted ? '<span class="pitch-slot__exhausted-badge" title="0% energía. No puede jugar como titular.">AGOTADO</span>' : ''}
          <button type="button" class="pitch-slot__remove-btn" data-index="${index}" title="Mover ${player.name} al banquillo de reservas">✕</button>
        </div>
        <span class="pitch-slot__name">${player.name}</span>
        <span class="pitch-slot__role-badge">${assignedRole}</span>
        ${getStaminaPillHtml(stamina)}
      </div>
    `;
  }).join('');

  return `<div class="pitch-line-row ${rowClass}">${slotsHtml}</div>`;
}

/**
 * Renderiza los 4 suplentes en la sección de reservas
 */
function renderReserves() {
  const container = document.getElementById('reserves-slots-container');
  if (!container) return;

  const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8], activeSquad.players[9]];
  const filledCount = reserves.filter(Boolean).length;
  const countLabel = document.getElementById('reserves-count-label');
  if (countLabel) {
    countLabel.textContent = `${filledCount} / 4 jugadores`;
  }

  container.innerHTML = [0, 1, 2, 3].map(subIndex => {
    const globalIndex = 6 + subIndex;
    const player = reserves[subIndex];
    const isSelected = selectedSlot && selectedSlot.type === 'reserve' && selectedSlot.index === globalIndex;
    const hasPlayer = Boolean(player);
    const rating = hasPlayer ? getPlayerRating(player) : null;
    const stamina = hasPlayer ? getPlayerEnergy(player) : null;
    const isExhausted = hasPlayer && stamina === 0;
    const reserveTitle = hasPlayer
      ? (isExhausted ? `¡AGOTADO (0% energía)! ${player.name} (${player.role || 'MC'}) - Descansando en banquillo` : `${player.name} (${player.role || 'MC'}) - Energía: ${stamina}%`)
      : 'Banquillo libre';

    return `
      <div class="reserve-slot ${hasPlayer ? 'has-player' : 'is-empty'} ${isExhausted ? 'is-exhausted' : ''} ${isSelected ? 'is-selected' : ''}" data-index="${globalIndex}" title="${reserveTitle}" alt="${reserveTitle}" aria-label="${reserveTitle}">
        <div class="reserve-slot__circle">
          ${hasPlayer ? `
            <button type="button" class="reserve-slot__remove-btn" data-index="${globalIndex}" title="Gestionar / Vender suplente">✕</button>
            ${getPlayerAvatarHtml(player)}
            <span class="reserve-slot__rating-pill ${getRatingTierClass(rating)}" title="Valoración: ${rating}">${rating}</span>
            ${isExhausted ? '<span class="reserve-slot__exhausted-badge" title="Agotado (0% energía)">0%</span>' : ''}
          ` : '<span class="reserve-slot__plus">+</span>'}
        </div>
        <span class="reserve-slot__label">${hasPlayer ? player.name : `SUP ${subIndex + 1}`}</span>
        <span class="reserve-slot__role">${hasPlayer ? (player.role || 'MC') : 'Libre'}</span>
        ${hasPlayer ? getStaminaPillHtml(stamina) : ''}
      </div>
    `;
  }).join('');

  // Eventos de click en reservas
  container.querySelectorAll('.reserve-slot').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.reserve-slot__remove-btn')) return;
      const index = parseInt(el.getAttribute('data-index'), 10);
      handleSlotClick('reserve', index);
    });
  });

  // Botón 'X' en reservas para vender o gestionar
  container.querySelectorAll('.reserve-slot__remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'), 10);
      openPlayerActionModal(index);
    });
  });
}

/**
 * Abre el menú modal de acción al pulsar la 'X' o querer gestionar un jugador
 */
function removePlayerToBench(slotIndex) {
  openPlayerActionModal(slotIndex);
}

function setLineupModalLayerActive(isActive) {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('has-lineup-modal-open', Boolean(isActive));
  const appContent = document.getElementById('app-content');
  const appNav = document.getElementById('app-navigation');
  if (appContent) {
    appContent.style.zIndex = isActive ? '1500' : '';
  }
  if (appNav) {
    appNav.style.zIndex = isActive ? '1' : '';
    appNav.style.pointerEvents = isActive ? 'none' : '';
  }
}

/**
 * Abre el menú para Vender, Mover al Banquillo o Intercambiar al jugador
 */
function openPlayerActionModal(slotIndex) {
  if (!activeSquad || !activeSquad.players || !activeSquad.players[slotIndex]) {
    loadActiveSquad();
  }
  const player = activeSquad?.players?.[slotIndex];
  if (!player) return;

  activeActionSlotIndex = slotIndex;
  const isStarter = slotIndex < 6;

  const backdrop = document.getElementById('player-action-backdrop');
  const sheet = document.getElementById('player-action-sheet');
  const nameEl = document.getElementById('action-player-name');
  const roleEl = document.getElementById('action-player-role');
  const tokenEl = document.getElementById('action-player-token');
  const benchBtn = document.getElementById('btn-action-bench');

  if (nameEl) nameEl.textContent = player.name;
  const energy = getPlayerEnergy(player);
  const isExhausted = energy === 0;
  if (roleEl) {
    roleEl.textContent = `${player.role || 'MC'} · Rating ${getPlayerRating(player)} · Energía: ${energy}%${isExhausted ? ' (AGOTADO)' : ''}`;
  }
  if (tokenEl) tokenEl.innerHTML = getPlayerAvatarHtml(player);

  const exhaustedNotice = document.getElementById('action-player-exhausted-notice');
  if (exhaustedNotice) {
    if (isExhausted) {
      exhaustedNotice.textContent = isStarter
        ? '⚠️ Jugador sin energía física (0%). No puede disputar partidos como titular. Muévelo al banquillo para descansar y recuperarse.'
        : '💤 Jugador sin energía (0%). Recuperará +35% de energía descansando en el banquillo en cada partido.';
      exhaustedNotice.style.display = 'block';
    } else if (!isStarter && energy < 100) {
      exhaustedNotice.textContent = `💤 Descansando en banquillo (${energy}%). Recuperará +35% de energía por partido hasta alcanzar su tope del 100%.`;
      exhaustedNotice.style.display = 'block';
    } else {
      exhaustedNotice.style.display = 'none';
    }
  }

  // Cargar estadísticas reales acumuladas del jugador
  const statsBox = document.getElementById('player-action-stats-box');
  if (statsBox) {
    let playerStats = {};
    try {
      const raw = localStorage.getItem('fantasy_player_stats');
      if (raw) playerStats = JSON.parse(raw);
    } catch (e) {}

    function isSamePlayerName(a, b) {
      if (!a || !b) return false;
      const cleanA = a.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
      const cleanB = b.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
      return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
    }

    const pStats = playerStats[player.name] ||
      Object.values(playerStats).find(v => isSamePlayerName(v.name, player.name)) ||
      Object.entries(playerStats).find(([k]) => isSamePlayerName(k, player.name))?.[1] ||
      {};
    const hasPlayed = (pStats.matchesPlayed || 0) > 0;
    const matches = pStats.matchesPlayed || 0;
    const goals = pStats.goals || 0;
    let cleanRating = null;
    if (hasPlayed) {
      const rawR = Number(pStats.avgRating);
      if (!isNaN(rawR) && rawR >= 4.0 && rawR <= 10.0) {
        cleanRating = rawR;
      } else {
        const goalsBonus = Math.min(2.0, (goals / matches) * 2.5);
        const pSkill = Number(player.rating_general || player.media_juego || 75);
        const skillBonus = Math.min(0.8, Math.max(-0.6, (pSkill - 70) * 0.02));
        cleanRating = Math.round(Math.min(9.8, Math.max(5.5, 6.4 + goalsBonus + skillBonus)) * 10) / 10;
      }
    }
    const rating = (hasPlayed && cleanRating != null) ? cleanRating.toFixed(1) : '-';
    const mvps = pStats.mvpAwards || 0;

    statsBox.innerHTML = `
      <div class="action-stat-pill" title="Partidos Jugados">
        <span class="action-stat-label">PJ</span>
        <strong class="action-stat-val">${matches}</strong>
      </div>
      <div class="action-stat-pill" title="Goles Marcados">
        <span class="action-stat-label">Goles</span>
        <strong class="action-stat-val">${goals}</strong>
      </div>
      <div class="action-stat-pill action-stat-pill--rating" title="Nota Media">
        <span class="action-stat-label">Nota</span>
        <strong class="action-stat-val">${rating}</strong>
      </div>
      <div class="action-stat-pill action-stat-pill--mvp" title="Premios MVP">
        <span class="action-stat-label">MVP</span>
        <strong class="action-stat-val">${mvps}</strong>
      </div>
    `;
  }

  // Verificar si hay hueco libre en el banquillo
  let hasFreeReserve = false;
  for (let i = 6; i <= 9; i++) {
    if (!activeSquad.players[i]) {
      hasFreeReserve = true;
      break;
    }
  }

  // Si ya está en el banquillo o el banquillo está lleno
  if (benchBtn) {
    if (!isStarter) {
      benchBtn.style.display = 'none';
    } else if (!hasFreeReserve) {
      benchBtn.style.display = 'flex';
      benchBtn.classList.add('is-disabled');
      benchBtn.title = 'El banquillo está lleno (4/4)';
    } else {
      benchBtn.style.display = 'flex';
      benchBtn.classList.remove('is-disabled');
      benchBtn.title = '';
    }
  }

  if (backdrop && sheet) {
    setLineupModalLayerActive(true);
    backdrop.removeAttribute('hidden');
    sheet.removeAttribute('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      sheet.classList.add('is-open');
    });
  }
}

function closePlayerActionModal() {
  const backdrop = document.getElementById('player-action-backdrop');
  const sheet = document.getElementById('player-action-sheet');
  const emptySheet = document.getElementById('empty-slot-sheet');

  if (backdrop) {
    backdrop.classList.remove('is-open');
  }
  if (sheet) sheet.classList.remove('is-open');
  if (emptySheet) emptySheet.classList.remove('is-open');

  setTimeout(() => {
    if (backdrop) backdrop.setAttribute('hidden', '');
    if (sheet) sheet.setAttribute('hidden', '');
    if (emptySheet) emptySheet.setAttribute('hidden', '');
    setLineupModalLayerActive(false);
    activeActionSlotIndex = null;
  }, 280);
}

/**
 * Abre el modal cuando se toca un puesto vacío (+)
 */
function openEmptySlotModal(slotIndex, router) {
  activeActionSlotIndex = slotIndex;
  const isStarter = slotIndex < 6;

  const formationData = FORMATIONS_6V6[activeSquad.formation] || FORMATIONS_6V6['1-2-2-1'];
  const expectedRole = isStarter ? formationData.slots[slotIndex] : 'SUP';

  const backdrop = document.getElementById('player-action-backdrop');
  const emptySheet = document.getElementById('empty-slot-sheet');
  const titleEl = document.getElementById('empty-slot-title');
  const subtitleEl = document.getElementById('empty-slot-subtitle');
  const reservesBox = document.getElementById('empty-slot-reserves-container');

  if (titleEl) {
    titleEl.textContent = `Puesto Vacío (${expectedRole})`;
  }
  if (subtitleEl) {
    subtitleEl.textContent = isStarter
      ? `Asigna un suplente o ficha en el mercado`
      : `Banquillo libre. Ve al mercado a fichar un suplente`;
  }

  if (reservesBox) {
    // Buscar qué suplentes están disponibles en el banquillo
    const availableReserves = [];
    for (let i = 6; i <= 9; i++) {
      if (activeSquad.players[i]) {
        availableReserves.push({ index: i, player: activeSquad.players[i] });
      }
    }

    if (availableReserves.length > 0 && isStarter) {
      reservesBox.innerHTML = `
        <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 2px;">SUPLENTES DISPONIBLES EN BANQUILLO:</span>
        ` + availableReserves.map(item => {
          const resEnergy = getPlayerEnergy(item.player);
          const isExhausted = resEnergy === 0;
          return `
          <button type="button" class="empty-slot-reserve-item ${isExhausted ? 'is-exhausted-reserve' : ''}" data-reserve-index="${item.index}" ${isExhausted ? 'data-is-exhausted="true"' : ''} title="${item.player.name} (${item.player.role || 'MC'}) - Energía: ${resEnergy}%${isExhausted ? ' (Agotado)' : ''}" alt="${item.player.name}">
            <span class="empty-slot-reserve-item__left">
              <span class="empty-slot-reserve-item__avatar">${getPlayerAvatarHtml(item.player)}</span>
              <span>${item.player.name} (${item.player.role || 'MC'}) · ${isExhausted ? '<strong style="color: #DC2626;">0% AGOTADO</strong>' : `${resEnergy}%`}</span>
            </span>
            <span style="color: ${isExhausted ? '#DC2626' : '#2D6A4F'}; font-weight: 800;">${isExhausted ? 'No Apto' : `Media: ${getPlayerRating(item.player)}`}</span>
          </button>
        `;
        }).join('');

      reservesBox.querySelectorAll('.empty-slot-reserve-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const isExhausted = btn.getAttribute('data-is-exhausted') === 'true';
          const resIdx = parseInt(btn.getAttribute('data-reserve-index'), 10);
          const pickedPlayer = activeSquad.players[resIdx];
          if (isExhausted || (pickedPlayer && getPlayerEnergy(pickedPlayer) === 0)) {
            showToast(`¡${pickedPlayer?.name || 'El jugador'} tiene 0% de energía! No puede jugar como titular.`);
            return;
          }
          activeSquad.players[slotIndex] = activeSquad.players[resIdx];
          activeSquad.players[resIdx] = null;
          persistActiveSquad();
          closePlayerActionModal();
          renderScreen();
          showToast(`¡${activeSquad.players[slotIndex].name} alineado en el campo!`);
        });
      });
    } else {
      reservesBox.innerHTML = '';
    }
  }

  if (backdrop && emptySheet) {
    setLineupModalLayerActive(true);
    backdrop.removeAttribute('hidden');
    emptySheet.removeAttribute('hidden');
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      emptySheet.classList.add('is-open');
    });
  }
}

/**
 * Configura los eventos de los botones del modal de gestión de jugador
 */
function setupActionModalEvents(router) {
  const closeBtn = document.getElementById('btn-close-action-modal');
  const closeEmptyBtn = document.getElementById('btn-close-empty-modal');
  const backdrop = document.getElementById('player-action-backdrop');

  if (closeBtn) closeBtn.addEventListener('click', closePlayerActionModal);
  if (closeEmptyBtn) closeEmptyBtn.addEventListener('click', closePlayerActionModal);
  if (backdrop) backdrop.addEventListener('click', closePlayerActionModal);

  // 1. Mover al banquillo
  const benchBtn = document.getElementById('btn-action-bench');
  if (benchBtn) {
    benchBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      const player = activeSquad.players[activeActionSlotIndex];

      let targetReserveIndex = -1;
      for (let i = 6; i <= 9; i++) {
        if (!activeSquad.players[i]) {
          targetReserveIndex = i;
          break;
        }
      }

      if (targetReserveIndex === -1) {
        showToast('El banquillo está lleno (4/4). Vende a un suplente o realiza un intercambio.');
        closePlayerActionModal();
        return;
      }

      activeSquad.players[targetReserveIndex] = player;
      activeSquad.players[activeActionSlotIndex] = null;
      persistActiveSquad();
      closePlayerActionModal();
      renderScreen();
      showToast(`${player.name} movido al banquillo de reservas.`);
    });
  }

  // 2. Intercambiar por un suplente
  const swapBtn = document.getElementById('btn-action-swap');
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      selectedSlot = { type: activeActionSlotIndex < 6 ? 'starter' : 'reserve', index: activeActionSlotIndex };
      closePlayerActionModal();
      renderScreen();
      showToast(`Seleccionado: ${activeSquad.players[activeActionSlotIndex]?.name}. Toca el jugador de reemplazo.`);
    });
  }

  // 3. Vender / Liberar al mercado
  const sellBtn = document.getElementById('btn-action-sell');
  if (sellBtn) {
    sellBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      const player = activeSquad.players[activeActionSlotIndex];
      const playerName = player?.name || 'Jugador';

      // Quitar de la plantilla
      activeSquad.players[activeActionSlotIndex] = null;
      selectedSlot = null;

      // Persistir de inmediato (si era el último jugador, se vacía también el backend)
      persistActiveSquad({ allowEmpty: true });

      closePlayerActionModal();
      renderScreen();
      showToast(`¡${playerName} vendido al mercado! Puesto libre para fichar una nueva leyenda.`);
    });
  }

  // 5. Ir al mercado a fichar
  const gotoMarketBtn = document.getElementById('btn-empty-goto-market');
  if (gotoMarketBtn) {
    gotoMarketBtn.addEventListener('click', () => {
      closePlayerActionModal();
      if (router && typeof router.navigate === 'function') {
        router.navigate('/market');
      } else {
        window.location.hash = '/market';
      }
    });
  }
}


/**
 * Maneja el click en un slot para seleccionar, mover o intercambiar jugadores
 */
function handleSlotClick(type, index) {
  const playerAtClicked = activeSquad.players[index];

  // 1. Si no hay selección previa
  if (!selectedSlot) {
    // Si hace clic en un lugar vacío y no tiene a nadie seleccionado, abrir opciones / mercado
    if (!playerAtClicked) {
      openEmptySlotModal(index);
      return;
    }

    selectedSlot = { type, index };
    renderPitchPlayers();
    renderReserves();
    showToast(`Seleccionado: ${playerAtClicked.name}. Haz clic en otro puesto o suplente para mover/intercambiar.`);
    return;
  }

  // 2. Si hace clic en el mismo slot, deseleccionamos
  if (selectedSlot.type === type && selectedSlot.index === index) {
    selectedSlot = null;
    renderPitchPlayers();
    renderReserves();
    return;
  }

  // 3. Intercambio o asignación a puesto vacío
  const firstIndex = selectedSlot.index;
  const secondIndex = index;
  const playerFirst = activeSquad.players[firstIndex];
  const playerSecond = activeSquad.players[secondIndex];

  // Regla estricta: un jugador con 0% de energía no puede ingresar al equipo titular (índices 0 a 5)
  const isTargetStarter = secondIndex < 6;
  const isSourceStarter = firstIndex < 6;

  if (!isSourceStarter && isTargetStarter && playerFirst && getPlayerEnergy(playerFirst) === 0) {
    showToast(`¡${playerFirst.name} está agotado (0% energía)! Debe descansar en el banquillo.`);
    selectedSlot = null;
    renderPitchPlayers();
    renderReserves();
    return;
  }

  if (isSourceStarter && !isTargetStarter && playerSecond && getPlayerEnergy(playerSecond) === 0) {
    showToast(`¡${playerSecond.name} está agotado (0% energía)! No puede entrar al once titular.`);
    selectedSlot = null;
    renderPitchPlayers();
    renderReserves();
    return;
  }

  activeSquad.players[firstIndex] = playerSecond;
  activeSquad.players[secondIndex] = playerFirst;

  selectedSlot = null;
  persistActiveSquad();
  renderScreen();

  if (playerFirst && !playerSecond) {
    showToast(`¡${playerFirst.name} ubicado en la posición!`);
  } else if (!playerFirst && playerSecond) {
    showToast(`¡${playerSecond.name} reubicado!`);
  } else if (playerFirst && playerSecond) {
    showToast(`¡Intercambio realizado entre ${playerFirst.name} y ${playerSecond.name}!`);
  }
}

/**
 * Calcula y muestra el equilibrio y química del equipo
 */
function renderMetrics() {
  const formationData = FORMATIONS_6V6[activeSquad.formation] || FORMATIONS_6V6['1-2-2-1'];
  const slots = formationData.slots;
  const starters = activeSquad.players.slice(0, 6);

  let totalPenalty = 0;
  let totalRating = 0;
  let penalizedCount = 0;

  const filledStarters = starters.filter(Boolean);
  const missingCount = 6 - filledStarters.length;
  const exhaustedStarters = filledStarters.filter(p => getPlayerEnergy(p) === 0);

  starters.forEach((player, i) => {
    if (!player) return;
    const assignedRole = slots[i];
    const naturalRole = (player.role || player.posicion_base || 'MC').toUpperCase();
    const penalty = getPositionPenalty(naturalRole, assignedRole);
    if (penalty > 0) penalizedCount++;
    totalPenalty += penalty;
    totalRating += getPlayerRating(player);
  });

  // Química: 100% si todos están en posición natural, se resta penalización
  const balancePct = missingCount > 0
    ? Math.max(20, Math.round((filledStarters.length / 6) * 100 - (totalPenalty * 30)))
    : Math.max(50, Math.round(100 - (totalPenalty * 50)));
  const avgRating = filledStarters.length > 0 ? Math.round(totalRating / filledStarters.length) : 0;

  const balanceValEl = document.getElementById('lineup-balance-value');
  if (balanceValEl) balanceValEl.textContent = `${balancePct}%`;

  const barEl = document.getElementById('lineup-balance-bar');
  if (barEl) {
    barEl.style.width = `${balancePct}%`;
    barEl.style.backgroundColor = balancePct >= 90 ? 'var(--color-primary)' : (balancePct >= 75 ? '#F59E0B' : '#C92A2A');
  }

  const synergyTextEl = document.getElementById('lineup-synergy-text');
  if (synergyTextEl) {
    if (exhaustedStarters.length > 0) {
      synergyTextEl.innerHTML = `<strong style="color: #DC2626;">⚠️ Titular sin energía (0%):</strong> Debes sustituir a ${exhaustedStarters.map(p => p.name).join(', ')}`;
    } else if (missingCount > 0) {
      synergyTextEl.textContent = `Alineación incompleta: faltan ${missingCount} jugador(es) en cancha`;
    } else if (penalizedCount === 0) {
      synergyTextEl.textContent = 'Química óptima: todos los jugadores en su rol natural';
    } else {
      synergyTextEl.textContent = `${penalizedCount} jugador(es) fuera de su posición natural`;
    }
  }

  const avgRatingEl = document.getElementById('lineup-avg-rating');
  if (avgRatingEl) {
    avgRatingEl.innerHTML = `Media: <strong>${avgRating}</strong>`;
  }

  // Actualizar estado del botón de Confirmar Alineación
  const saveBtn = document.getElementById('btn-save-lineup');
  if (saveBtn) {
    const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8], activeSquad.players[9]];
    const totalFilled = filledStarters.length + reserves.filter(Boolean).length;

    if (exhaustedStarters.length > 0) {
      saveBtn.classList.add('is-disabled', 'is-exhausted-blocked');
      saveBtn.disabled = true;
      saveBtn.textContent = exhaustedStarters.length === 1
        ? `Sustituye a ${exhaustedStarters[0].name} (0% energía)`
        : `Sustituye a los titulares agotados (${exhaustedStarters.length})`;
    } else {
      saveBtn.classList.remove('is-disabled', 'is-exhausted-blocked');
      saveBtn.disabled = false;
      if (totalFilled === 10) {
        saveBtn.textContent = 'Confirmar Alineación';
      } else if (filledStarters.length > 0) {
        saveBtn.textContent = `Guardar Alineación (${filledStarters.length}/6 Titulares)`;
      } else {
        saveBtn.textContent = 'Guardar Alineación';
      }
    }
  }
}

/**
 * Diccionario de consejos tácticos enriquecidos e interactivos por formación
 */
const TACTICAL_ADVICES = {
  '1-2-2-1': '<strong>Equilibrio Puro:</strong> Estructura clásica que permite control tanto en el fondo como en el centro del campo. Ideal para transiciones seguras y neutralizar rivales ultra ofensivos.',
  '1-2-1-2': '<strong>Rombo Ofensivo:</strong> Disposición en rombo que conecta la zaga con dos puntas móviles. Excelente para el juego combinativo y desbordar defensas estáticas.',
  '1-1-2-2': '<strong>Ataque Frontal:</strong> Sacrifica ancho defensivo para sobrecargar la ofensiva con dos puntas. Ideal si cuentas con mediocampistas de buen pie y finalizadores letales.',
  '1-3-1-1': '<strong>Cerrojo y Presión:</strong> Tres defensores para neutralizar el centro y ahogar circuitos rivales. Muy efectiva contra formaciones basadas en la posesión en la medular.',
  '1-1-3-1': '<strong>Dominio del Medio:</strong> Superioridad numérica con tres mediocampistas. Garantiza el control de la pelota y abastece constantemente al delantero centro.',
  '1-1-1-3': '<strong>Ultra Ofensivo (All-In):</strong> Esquema agresivo con tres delanteros en punta. Dinamita defensas cerradas, aunque exige máxima concentración en las contras rivales.'
};

/**
 * Renderiza el consejo táctico dinámico e interactivo según la formación activa
 */
function renderTacticalAdvice() {
  const adviceEl = document.getElementById('tactical-advice-text');
  if (!adviceEl) return;

  const currentAdvice = TACTICAL_ADVICES[activeSquad.formation] ||
    FORMATIONS_6V6[activeSquad.formation]?.description ||
    'Formación táctica equilibrada en el terreno de juego.';

  // Transición visual fluida al cambiar de formación
  if (adviceEl.innerHTML.trim() !== currentAdvice.trim()) {
    adviceEl.style.opacity = '0';
    setTimeout(() => {
      adviceEl.innerHTML = currentAdvice;
      adviceEl.style.opacity = '1';
    }, 150);
  }
}

/**
 * Configura los eventos del dropdown flotante de formación
 */
// Referencia al listener de clic global para evitar fugas de memoria y listeners duplicados en la SPA
let dropdownDocumentClickListener = null;

function setupDropdownEvents() {
  const trigger = document.getElementById('formation-selector-btn');
  const dropdown = document.getElementById('formation-dropdown');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');

  if (!trigger || !dropdown) return;

  // 1. Limpiar listener previo en document para evitar acumulación al navegar en SPA
  if (dropdownDocumentClickListener) {
    document.removeEventListener('click', dropdownDocumentClickListener);
    dropdownDocumentClickListener = null;
  }

  // 2. Click en el botón de formación
  trigger.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  };

  // 3. Click en el wrapper exterior
  if (wrapper) {
    wrapper.onclick = (e) => {
      if (!dropdown.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
      }
    };
  }

  // 4. Click fuera del wrapper para cerrar
  dropdownDocumentClickListener = (e) => {
    const currentWrapper = document.querySelector('.formation-dropdown-wrapper');
    if (currentWrapper && !currentWrapper.contains(e.target)) {
      closeDropdown();
    }
  };

  document.addEventListener('click', dropdownDocumentClickListener);
}

function toggleDropdown() {
  const dropdown = document.getElementById('formation-dropdown');
  const trigger = document.getElementById('formation-selector-btn');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');
  if (!dropdown) return;

  const isClosed = dropdown.hasAttribute('hidden') || !dropdown.classList.contains('is-open');
  if (isClosed) {
    openDropdown();
  } else {
    closeDropdown();
  }
}

function openDropdown() {
  const dropdown = document.getElementById('formation-dropdown');
  const trigger = document.getElementById('formation-selector-btn');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');
  if (dropdown) {
    dropdown.removeAttribute('hidden');
    dropdown.classList.add('is-open');
  }
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  if (wrapper) wrapper.classList.add('is-open');
}

function closeDropdown() {
  const dropdown = document.getElementById('formation-dropdown');
  const trigger = document.getElementById('formation-selector-btn');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');
  if (dropdown) {
    dropdown.setAttribute('hidden', '');
    dropdown.classList.remove('is-open');
  }
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (wrapper) wrapper.classList.remove('is-open');
}

/**
 * Configura el botón de información táctica
 */
const FORMATION_DETAILS = [
  {
    key: '1-2-2-1',
    name: '1-2-2-1 (Equilibrio puro)',
    desc: 'Estructura clásica que permite control tanto en el fondo como en el centro del campo, ideal para transiciones seguras.'
  },
  {
    key: '1-2-1-2',
    name: '1-2-1-2 (Rombo)',
    desc: 'Disposición en rombo en el medio campo que conecta la zaga con dos puntas móviles, perfecta para el juego combinativo y vertical por el centro.'
  },
  {
    key: '1-1-2-2',
    name: '1-1-2-2 (Ataque Frontal)',
    desc: 'Sacrifica ancho defensivo para acumular poder de fuego arriba. Ideal si se ficha a creadores y finalizadores letales.'
  },
  {
    key: '1-3-1-1',
    name: '1-3-1-1 (Alta Presión y Creación)',
    desc: 'Enfoque en ahogar al rival en su campo y surtir de balones constantes al único delantero centro.'
  },
  {
    key: '1-1-3-1',
    name: '1-1-3-1 (Dominio del Medio)',
    desc: 'Enfoque en ahogar al rival en su campo y surtir de balones constantes al único delantero centro, priorizando el control de la pelota.'
  },
  {
    key: '1-1-1-3',
    name: '1-1-1-3 (Ultra Ofensivo / All-In)',
    desc: 'Formación kamikaze. Todo el presupuesto se gasta en el tridente de ataque, confiando en que el equipo hará más goles de los que va a recibir.'
  }
];

function setupInfoButton() {
  const infoBtn = document.getElementById('btn-tactical-info');
  const modalBackdrop = document.getElementById('tactical-modal-backdrop');
  const modalSheet = document.getElementById('tactical-modal-sheet');
  const closeBtn = document.getElementById('btn-close-tactical-modal');

  if (!infoBtn || !modalSheet || !modalBackdrop) return;

  infoBtn.addEventListener('click', openTacticalModal);
  if (closeBtn) closeBtn.addEventListener('click', closeTacticalModal);

  const resetBtn = document.getElementById('btn-reset-squad');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      resetToBalancedSquad();
    });
  }
  modalBackdrop.addEventListener('click', closeTacticalModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modalSheet.hasAttribute('hidden')) {
      closeTacticalModal();
    }
  });
}

function openTacticalModal() {
  const modalBackdrop = document.getElementById('tactical-modal-backdrop');
  const modalSheet = document.getElementById('tactical-modal-sheet');
  const listContainer = document.getElementById('tactical-modal-list');

  if (!modalBackdrop || !modalSheet || !listContainer) return;

  // Renderizar las 6 tarjetas de formación
  listContainer.innerHTML = FORMATION_DETAILS.map(f => {
    const isActive = f.key === activeSquad.formation;
    return `
      <article class="formation-card ${isActive ? 'is-active' : ''}" data-formation="${f.key}">
        <div class="formation-card__header">
          <div class="formation-card__title-group">
            <h3 class="formation-card__title">${f.name}</h3>
            ${isActive ? '<span class="formation-card__badge">ACTIVA</span>' : ''}
          </div>
          ${isActive ? `
            <div class="formation-card__check">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
          ` : ''}
        </div>
        <p class="formation-card__desc">${f.desc}</p>
      </article>
    `;
  }).join('');

  // Evento para cambiar formación directamente haciendo click en una tarjeta
  listContainer.querySelectorAll('.formation-card').forEach(card => {
    card.addEventListener('click', () => {
      const formKey = card.getAttribute('data-formation');
      if (formKey && formKey !== activeSquad.formation) {
        changeFormation(formKey);
      }
      closeTacticalModal();
    });
  });

  // Mostrar con animación de abajo hacia arriba
  setLineupModalLayerActive(true);
  modalBackdrop.removeAttribute('hidden');
  modalSheet.removeAttribute('hidden');

  requestAnimationFrame(() => {
    modalBackdrop.classList.add('is-open');
    modalSheet.classList.add('is-open');
  });
}

function closeTacticalModal() {
  const modalBackdrop = document.getElementById('tactical-modal-backdrop');
  const modalSheet = document.getElementById('tactical-modal-sheet');

  if (!modalBackdrop || !modalSheet) return;

  modalBackdrop.classList.remove('is-open');
  modalSheet.classList.remove('is-open');

  setTimeout(() => {
    modalBackdrop.setAttribute('hidden', '');
    modalSheet.setAttribute('hidden', '');
    setLineupModalLayerActive(false);
  }, 280);
}

/**
 * Configura el botón de confirmar y guardar alineación con validación estricta de 9 jugadores
 */
function setupSaveButton(router) {
  const saveBtn = document.getElementById('btn-save-lineup');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const starters = activeSquad.players.slice(0, 6);
    const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8], activeSquad.players[9]];

    const exhaustedStarters = starters.filter(p => p && getPlayerEnergy(p) === 0);
    if (exhaustedStarters.length > 0) {
      showToast(`¡${exhaustedStarters.map(p => p.name).join(', ')} no tiene energía (0%)! Debes moverlo al banquillo.`);
      return;
    }

    const filledStarters = starters.filter(Boolean).length;
    const filledReserves = reserves.filter(Boolean).length;
    const totalFilled = filledStarters + filledReserves;

    // Notificación informativa si faltan puestos por completar
    if (totalFilled < 10) {
      const missingStarters = 6 - filledStarters;
      const missingReserves = 4 - filledReserves;
      console.info(`[Lineup] Guardando alineación parcial: ${filledStarters}/6 titulares, ${filledReserves}/4 suplentes.`);
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';

      // 1. Persistencia local inmediata
      persistActiveSquad();

      // 2. Sincronización con el backend (si está disponible)
      try {
        await squadService.saveSquad({
          formation: activeSquad.formation,
          players: activeSquad.players
        });
      } catch (e) {
        console.debug('[Lineup] Guardado local offline completado.');
      }

      if (totalFilled === 10) {
        showToast('¡Alineación oficial confirmada y sincronizada con el inicio!');
      } else {
        showToast(`¡Alineación guardada con éxito! (${filledStarters}/6 titulares sincronizados con el inicio)`);
      }
    } catch (err) {
      console.error('[Lineup] Error al guardar alineación:', err);
      showToast('Error al guardar la alineación.');
    } finally {
      saveBtn.disabled = false;
      renderMetrics();
    }
  });
}

/**
 * Obtiene la inicial del jugador para el token
 */
function getPlayerInitial(name = '') {
  if (!name) return 'J';
  const clean = name.replace(/^[A-Z]\.\s*/, '');
  return clean.charAt(0).toUpperCase();
}

/**
 * Muestra un toast feedback no invasivo
 */
function showToast(message) {
  let toast = document.getElementById('lineup-feedback-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'lineup-feedback-toast';
    toast.className = 'lineup-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('is-visible');

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2600);
}

if (typeof window !== 'undefined' && !window.__lineupSquadListenerAttached) {
  window.__lineupSquadListenerAttached = true;
  window.addEventListener('fantasy:squad-updated', (e) => {
    if (e.detail && Array.isArray(e.detail.players)) {
      activeSquad = {
        name: e.detail.name || 'Tu Equipo',
        formation: isValidFormation(e.detail.formation) ? e.detail.formation : (activeSquad?.formation || '1-2-2-1'),
        players: [...e.detail.players]
      };
      while (activeSquad.players.length < 10) {
        activeSquad.players.push(null);
      }
      const container = document.querySelector('.lineup-container');
      if (container) {
        renderScreen();
      }
    }
  });
}
