
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
  if (typeof player.rating_general === 'number' && player.rating_general > 0) {
    return Math.round(player.rating_general);
  }
  if (typeof player.media_juego === 'number' && player.media_juego > 0) {
    return Math.round(player.media_juego);
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
export const DEFAULT_HOME_SQUAD = {
  name: 'Tu Equipo',
  formation: '1-2-2-1',
  players: [
    { name: 'Casillas', role: 'POR', rating_general: 89, rating_fisico: 82, rating_palmares: 88, rating_defensa: 30, rating_creacion: 20, rating_tecnica: 40, rating_ataque: 10, precio: 8.5 },
    { name: 'Maldini', role: 'DEF', rating_defensa: 92, rating_fisico: 85, rating_palmares: 92, rating_creacion: 70, rating_tecnica: 78, rating_ataque: 40, precio: 10.5 },
    { name: 'Baresi', role: 'DEF', rating_defensa: 93, rating_fisico: 79, rating_palmares: 90, rating_creacion: 68, rating_tecnica: 75, rating_ataque: 35, precio: 10.0 },
    { name: 'Zidane', role: 'MC', rating_creacion: 96, rating_tecnica: 98, rating_fisico: 83, rating_palmares: 95, rating_ataque: 88, rating_defensa: 65, precio: 12.5 },
    { name: 'Xavi', role: 'MC', rating_creacion: 97, rating_tecnica: 95, rating_fisico: 76, rating_palmares: 94, rating_ataque: 78, rating_defensa: 68, precio: 11.0 },
    { name: 'Messi', role: 'DEL', rating_ataque: 99, rating_tecnica: 99, rating_creacion: 95, rating_fisico: 80, rating_palmares: 99, rating_defensa: 35, precio: 15.0 },
    // 3 Suplentes reglamentarios
    { name: 'Ronaldo', role: 'DEL', rating_ataque: 97, rating_tecnica: 95, rating_fisico: 86, rating_palmares: 91, rating_defensa: 30, rating_creacion: 75, precio: 13.0 },
    { name: 'Iniesta', role: 'MC', rating_creacion: 94, rating_tecnica: 96, rating_fisico: 85, rating_palmares: 93, rating_ataque: 82, rating_defensa: 60, precio: 8.5 },
    { name: 'Puyol', role: 'DEF', rating_defensa: 90, rating_fisico: 88, rating_palmares: 89, rating_ataque: 30, rating_creacion: 50, rating_tecnica: 60, precio: 7.5 }
  ]
};
import { squadService } from '../../services/squad-service.js';

// Estado local de la pantalla
let activeSquad = null;
let selectedSlot = null; // { type: 'starter' | 'reserve', index: number }


// Variable para saber qué slot se está gestionando en el modal de acción
let activeActionSlotIndex = null;

/**
 * Persiste la alineación activa en localStorage y dispara el evento de sincronización global
 */
export function persistActiveSquad() {
  if (!activeSquad) return;
  try {
    localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
    window.dispatchEvent(new CustomEvent('fantasy:squad-updated', { detail: activeSquad }));
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

export function initLineup(router) {
  loadActiveSquad();
  setupDropdownEvents();
  setupInfoButton();
  setupActionModalEvents(router);
  setupSaveButton(router);
  renderScreen();
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

        // Si la plantilla quedó incompleta por pruebas (menos de 6 jugadores válidos no nulos)
        const validPlayersCount = activeSquad.players.filter(Boolean).length;
        if (validPlayersCount < 6) {
          activeSquad.players = DEFAULT_HOME_SQUAD.players.map(p => ({ ...p }));
        } else {
          fillSquadToNine();
        }
        persistActiveSquad();
        return;
      }
    }
  } catch (err) {
    console.debug('[Lineup] Error al leer plantilla activa:', err);
  }

  // Fallback con copia profunda de DEFAULT_HOME_SQUAD
  activeSquad = {
    name: DEFAULT_HOME_SQUAD.name,
    formation: DEFAULT_HOME_SQUAD.formation || '1-2-2-1',
    players: DEFAULT_HOME_SQUAD.players.map(p => ({ ...p }))
  };
  fillSquadToNine();
  persistActiveSquad();
}

/**
 * Asegura que la lista de jugadores tenga al menos 9 futbolistas
 */
function fillSquadToNine() {
  if (!activeSquad.players) activeSquad.players = [];
  while (activeSquad.players.length < 9) {
    activeSquad.players.push(null);
  }
  for (let i = 0; i < 9; i++) {
    if (!activeSquad.players[i]) {
      const fallbackPlayer = DEFAULT_HOME_SQUAD.players[i] || {
        name: `Leyenda ${i + 1}`,
        role: i === 0 ? 'POR' : (i < 3 ? 'DEF' : (i < 5 ? 'MC' : 'DEL')),
        rating_general: 85,
        rating_ataque: 75,
        rating_defensa: 75,
        precio: 8.0
      };
      activeSquad.players[i] = { ...fallbackPlayer };
    }
  }
}

/**
 * Restablece la plantilla completa oficial equilibrada con 6 titulares y 3 suplentes
 */
export function resetToBalancedSquad() {
  activeSquad = {
    name: DEFAULT_HOME_SQUAD.name || 'Tu Equipo',
    formation: '1-2-2-1',
    players: DEFAULT_HOME_SQUAD.players.map(p => ({ ...p }))
  };
  fillSquadToNine();
  persistActiveSquad();
  renderScreen();
  showToast('¡Plantilla equilibrada oficial restaurada (6 titulares y 3 suplentes)!');
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

    return `
      <div class="pitch-slot ${isPenalized ? 'is-penalized' : ''} ${isSelected ? 'is-selected' : ''}" data-index="${index}" title="${player.name} (${naturalRole}) - Asignado: ${assignedRole}">
        <div class="pitch-slot__token">
          <span>${getPlayerInitial(player.name)}</span>
          <span class="pitch-slot__rating-pill ${getRatingTierClass(rating)}" title="Valoración del jugador: ${rating}">${rating}</span>
          ${isPenalized ? '<span class="pitch-slot__penalty-dot" title="Fuera de posición natural (-15% eficacia)"></span>' : ''}
          <button type="button" class="pitch-slot__remove-btn" data-index="${index}" title="Mover ${player.name} al banquillo de reservas">✕</button>
        </div>
        <span class="pitch-slot__name">${player.name}</span>
        <span class="pitch-slot__role-badge">${assignedRole}</span>
      </div>
    `;
  }).join('');

  return `<div class="pitch-line-row ${rowClass}">${slotsHtml}</div>`;
}

/**
 * Renderiza los 3 suplentes en la sección de reservas
 */
function renderReserves() {
  const container = document.getElementById('reserves-slots-container');
  if (!container) return;

  const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8]];
  const filledCount = reserves.filter(Boolean).length;
  const countLabel = document.getElementById('reserves-count-label');
  if (countLabel) {
    countLabel.textContent = `${filledCount} / 3 jugadores`;
  }

  container.innerHTML = [0, 1, 2].map(subIndex => {
    const globalIndex = 6 + subIndex;
    const player = reserves[subIndex];
    const isSelected = selectedSlot && selectedSlot.type === 'reserve' && selectedSlot.index === globalIndex;
    const hasPlayer = Boolean(player);
    const rating = hasPlayer ? getPlayerRating(player) : null;

    return `
      <div class="reserve-slot ${hasPlayer ? 'has-player' : 'is-empty'} ${isSelected ? 'is-selected' : ''}" data-index="${globalIndex}" title="${hasPlayer ? `${player.name} (${player.role || 'MC'})` : 'Banquillo libre'}">
        <div class="reserve-slot__circle">
          ${hasPlayer ? `
            <button type="button" class="reserve-slot__remove-btn" data-index="${globalIndex}" title="Gestionar / Vender suplente">✕</button>
            <span>${getPlayerInitial(player.name)}</span>
            <span class="reserve-slot__rating-pill ${getRatingTierClass(rating)}" title="Valoración: ${rating}">${rating}</span>
          ` : '<span class="reserve-slot__plus">+</span>'}
        </div>
        <span class="reserve-slot__label">${hasPlayer ? player.name : `SUP ${subIndex + 1}`}</span>
        <span class="reserve-slot__role">${hasPlayer ? (player.role || 'MC') : 'Libre'}</span>
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
  if (roleEl) roleEl.textContent = `${player.role || 'MC'} · Rating ${getPlayerRating(player)}`;
  if (tokenEl) tokenEl.textContent = getPlayerInitial(player.name);

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
    const rating = (hasPlayed && pStats.avgRating != null) ? Number(pStats.avgRating).toFixed(1) : '-';
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
  for (let i = 6; i <= 8; i++) {
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
      benchBtn.title = 'El banquillo está lleno (3/3)';
    } else {
      benchBtn.style.display = 'flex';
      benchBtn.classList.remove('is-disabled');
      benchBtn.title = '';
    }
  }

  if (backdrop && sheet) {
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
    for (let i = 6; i <= 8; i++) {
      if (activeSquad.players[i]) {
        availableReserves.push({ index: i, player: activeSquad.players[i] });
      }
    }

    if (availableReserves.length > 0 && isStarter) {
      reservesBox.innerHTML = `
        <span style="font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 2px;">SUPLENTES DISPONIBLES EN BANQUILLO:</span>
        ` + availableReserves.map(item => `
          <button type="button" class="empty-slot-reserve-item" data-reserve-index="${item.index}">
            <span>${item.player.name} (${item.player.role || 'MC'})</span>
            <span style="color: #2D6A4F; font-weight: 800;">Media: ${getPlayerRating(item.player)}</span>
          </button>
        `).join('');

      reservesBox.querySelectorAll('.empty-slot-reserve-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const resIdx = parseInt(btn.getAttribute('data-reserve-index'), 10);
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
      for (let i = 6; i <= 8; i++) {
        if (!activeSquad.players[i]) {
          targetReserveIndex = i;
          break;
        }
      }

      if (targetReserveIndex === -1) {
        showToast('El banquillo está lleno (3/3). Vende a un suplente o realiza un intercambio.');
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

      // Persistir de inmediato
      persistActiveSquad();

      closePlayerActionModal();
      renderScreen();
      showToast(`¡${playerName} vendido al mercado! Puesto libre para fichar una nueva leyenda.`);
    });
  }

  // 4. Restaurar leyenda equilibrada para este puesto vacío
  const restoreSlotBtn = document.getElementById('btn-empty-restore-default');
  if (restoreSlotBtn) {
    restoreSlotBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      const fallback = DEFAULT_HOME_SQUAD.players[activeActionSlotIndex] || {
        name: `Leyenda ${activeActionSlotIndex + 1}`,
        role: activeActionSlotIndex === 0 ? 'POR' : (activeActionSlotIndex < 3 ? 'DEF' : (activeActionSlotIndex < 5 ? 'MC' : 'DEL')),
        rating_general: 88,
        rating_ataque: 80,
        rating_defensa: 80,
        precio: 10.0
      };
      activeSquad.players[activeActionSlotIndex] = { ...fallback };
      persistActiveSquad();
      closePlayerActionModal();
      renderScreen();
      showToast(`¡${fallback.name} incorporado a tu plantilla en esta posición!`);
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

  const filledStarters = starters.filter(Boolean);
  const missingCount = 6 - filledStarters.length;

  starters.forEach((player, i) => {
    if (!player) return;
    const assignedRole = slots[i];
    const naturalRole = (player.role || player.posicion_base || 'MC').toUpperCase();
    const penalty = getPositionPenalty(naturalRole, assignedRole);
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
    if (missingCount > 0) {
      synergyTextEl.textContent = `Alineación incompleta: faltan ${missingCount} jugador(es) en cancha`;
    } else if (totalPenalty === 0) {
      synergyTextEl.textContent = 'Química óptima: todos los jugadores en su rol natural';
    } else {
      synergyTextEl.textContent = `${Math.round(totalPenalty * 100 / 0.15)} jugador(es) fuera de su posición natural`;
    }
  }

  const avgRatingEl = document.getElementById('lineup-avg-rating');
  if (avgRatingEl) {
    avgRatingEl.innerHTML = `Media: <strong>${avgRating}</strong>`;
  }

  // Actualizar estado del botón de Confirmar Alineación
  const saveBtn = document.getElementById('btn-save-lineup');
  if (saveBtn) {
    const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8]];
    const totalFilled = filledStarters.length + reserves.filter(Boolean).length;

    if (totalFilled < 9) {
      saveBtn.classList.add('is-disabled');
      saveBtn.textContent = `Incompleto (${totalFilled}/9 Jugadores)`;
    } else {
      saveBtn.classList.remove('is-disabled');
      saveBtn.textContent = 'Confirmar Alineación';
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
function setupDropdownEvents() {
  const trigger = document.getElementById('formation-selector-btn');
  const dropdown = document.getElementById('formation-dropdown');

  if (trigger && dropdown) {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdown.hasAttribute('hidden');
      if (isHidden) {
        dropdown.removeAttribute('hidden');
        trigger.setAttribute('aria-expanded', 'true');
      } else {
        dropdown.setAttribute('hidden', '');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
        closeDropdown();
      }
    });
  }
}

function closeDropdown() {
  const dropdown = document.getElementById('formation-dropdown');
  const trigger = document.getElementById('formation-selector-btn');
  if (dropdown) dropdown.setAttribute('hidden', '');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
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
    const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8]];

    const filledStarters = starters.filter(Boolean).length;
    const filledReserves = reserves.filter(Boolean).length;
    const totalFilled = filledStarters + filledReserves;

    // Validación obligatoria: Exactamente 6 titulares y 3 suplentes
    if (totalFilled < 9) {
      const missingStarters = 6 - filledStarters;
      const missingReserves = 3 - filledReserves;

      let msg = 'No puedes confirmar la alineación: ';
      if (missingStarters > 0 && missingReserves > 0) {
        msg += `Faltan ${missingStarters} titular(es) y ${missingReserves} suplente(s).`;
      } else if (missingStarters > 0) {
        msg += `Faltan ${missingStarters} jugador(es) en la cancha.`;
      } else {
        msg += `Faltan ${missingReserves} suplente(s) en el banquillo.`;
      }
      msg += ' Ve al Mercado para fichar y completar tu equipo (9 jugadores en total).';

      showToast(msg);
      return;
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

      showToast('¡Alineación oficial confirmada con éxito (6 titulares y 3 suplentes)!');
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
