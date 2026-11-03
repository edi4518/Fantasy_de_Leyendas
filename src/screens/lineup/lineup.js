/**
 * @file lineup.js
 * @description Controlador de la Pizarra Táctica y Alineación (6 titulares en cancha + 3 suplentes).
 * Sincronizado automáticamente con los fichajes del Mercado y con persistencia de posiciones personalizadas.
 */

import { FORMATIONS_6V6, isValidFormation } from '../../domain/formation-rules.js';
import { getPositionPenalty } from '../../domain/simulation-engine.js';
import { squadService } from '../../services/squad-service.js';
import { teamState } from '../../services/team-state.js';

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
    { name: 'Ronaldo', role: 'DEL', rating_ataque: 97, rating_tecnica: 95, rating_fisico: 86, rating_palmares: 91, rating_defensa: 30, rating_creacion: 75, precio: 13.0 },
    { name: 'Iniesta', role: 'MC', rating_creacion: 94, rating_tecnica: 96, rating_fisico: 85, rating_palmares: 93, rating_ataque: 82, rating_defensa: 60, precio: 8.5 },
    { name: 'Puyol', role: 'DEF', rating_defensa: 90, rating_fisico: 88, rating_palmares: 89, rating_ataque: 30, rating_creacion: 50, rating_tecnica: 60, precio: 7.5 }
  ]
};

/**
 * Determina la clase CSS de la píldora de valoración según la categoría de la media
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
  if (role === 'DEL') return Math.round(player.rating_ataque || 85);
  if (role === 'DEF') return Math.round(player.rating_defensa || 85);
  if (role === 'POR') return Math.round(player.rating_defensa || player.rating_general || 85);
  
  const cre = player.rating_creacion || 80;
  const tec = player.rating_tecnica || 80;
  return Math.round((cre * 0.5) + (tec * 0.5));
}

/**
 * Obtiene o calcula el precio en millones de un jugador
 */
export function getPlayerPrice(player) {
  if (!player) return 0;
  if (typeof player.precio === 'number' && player.precio > 0) return Number(player.precio);
  if (typeof player.price === 'number' && player.price > 0) return Number(player.price);
  const rating = getPlayerRating(player);
  const base = Math.max(2.0, ((rating - 60) * 0.35 + 3.0));
  return Math.round(base * 10) / 10;
}

// Estado local de la pantalla
let activeSquad = null;
let selectedSlot = null;
let activeActionSlotIndex = null;

export function persistActiveSquad() {
  if (!activeSquad) return;
  try {
    localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
    window.dispatchEvent(new CustomEvent('fantasy:squad-updated', { detail: activeSquad }));
  } catch (err) {
    console.debug('[Lineup] Error al persistir plantilla:', err);
  }
}

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
 * Carga la plantilla activa respetando el orden personalizado del usuario,
 * pero sincronizando e incorporando automáticamente cualquier nuevo fichaje del Mercado
 * en los huecos libres (titulares o banquillo de suplentes).
 */
function loadActiveSquad() {
  try {
    let currentFormation = '1-2-2-1';
    const marketState = teamState.getState();
    const marketRoster = (marketState && Array.isArray(marketState.roster)) ? marketState.roster : [];

    let currentPlayers = Array(9).fill(null);

    // 1. Intentar cargar la alineación guardada previamente por el usuario
    const raw = localStorage.getItem('fantasy_active_squad');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && isValidFormation(parsed.formation)) {
          currentFormation = parsed.formation;
        }
        if (parsed && Array.isArray(parsed.players)) {
          // Mantener los jugadores actuales, filtrando por si alguno fue vendido en el mercado
          currentPlayers = parsed.players.map(p => {
            if (!p) return null;
            const stillExists = marketRoster.find(mp => mp.id === p.id || mp.name === p.name);
            return stillExists ? p : null;
          });
        }
      } catch (e) {}
    }

    // 2. Sincronización automática: Agregar los NUEVOS jugadores del mercado que aún no están en la plantilla
    marketRoster.forEach(mp => {
      const formattedMp = formatMarketPlayer(mp);
      // Comprobar si este fichaje ya está ubicado en algún slot de la cancha o banquillo
      const alreadyInSquad = currentPlayers.some(p => p && (p.id === formattedMp.id || p.name === formattedMp.name));

      if (!alreadyInSquad) {
        // Buscar el primer hueco libre (null) -> Si los 6 titulares están llenos, irá automáticamente a SUP 1, 2 o 3 (índices 6, 7 y 8)
        const emptyIdx = currentPlayers.findIndex(slot => slot === null);
        if (emptyIdx !== -1) {
          currentPlayers[emptyIdx] = formattedMp;
        }
      }
    });

    activeSquad = {
      name: 'Tu Equipo',
      formation: currentFormation,
      players: currentPlayers
    };

    fillSquadToNine();
    persistActiveSquad();

  } catch (err) {
    console.debug('[Lineup] Error al sincronizar plantilla con el mercado:', err);
    activeSquad = {
      name: 'Tu Equipo',
      formation: '1-2-2-1',
      players: Array(9).fill(null)
    };
    fillSquadToNine();
    persistActiveSquad();
  }
}
function formatMarketPlayer(mp) {
  return {
    id: mp.id,
    name: mp.name || mp.nombre || 'Leyenda',
    role: (mp.role || mp.posicion_base || 'MC').toUpperCase(),
    rating_general: mp.rating_general || mp.media_juego || 85,
    rating_ataque: mp.rating_ataque || 80,
    rating_defensa: mp.rating_defensa || 80,
    rating_creacion: mp.rating_creacion || 80,
    rating_tecnica: mp.rating_tecnica || 80,
    rating_fisico: mp.rating_fisico || 80,
    rating_palmares: mp.rating_palmares || 85,
    precio: mp.precio || mp.price || 10.0,
    energia: typeof mp.energia === 'number' ? mp.energia : 100
  };
}

function fillSquadToNine() {
  if (!activeSquad.players) activeSquad.players = [];
  while (activeSquad.players.length < 9) {
    activeSquad.players.push(null);
  }
}

/**
 * Restablece la plantilla por completo y limpia los fichajes del mercado
 * para restaurar el presupuesto a 100M.
 */
export function resetToBalancedSquad() {
  try {
    // 1. Limpiar almacenamiento local de alineación y mercado
    localStorage.removeItem('fantasy_active_squad');
    localStorage.removeItem('fantasy_market_roster');
    localStorage.removeItem('team_state');
    localStorage.removeItem('fantasy_team_state');

    // 2. Limpiar el estado en memoria de teamState si está disponible
    if (typeof teamState !== 'undefined') {
      if (typeof teamState.clear === 'function') {
        teamState.clear();
      } else if (typeof teamState.setState === 'function') {
        teamState.setState({ roster: [], budget: 100.0, spent: 0 });
      }
    }
  } catch (err) {
    console.debug('[Lineup] Error al limpiar almacenamiento:', err);
  }

  // 3. Vaciar la plantilla activa
  activeSquad = {
    name: 'Tu Equipo',
    formation: '1-2-2-1',
    players: Array(9).fill(null)
  };

  fillSquadToNine();
  persistActiveSquad();

  // 4. Disparar eventos globales para actualizar Dashboard y Mercado al instante
  window.dispatchEvent(new CustomEvent('fantasy:squad-updated', { detail: activeSquad }));
  window.dispatchEvent(new CustomEvent('fantasy:market-updated'));

  // 5. Renderizar y notificar
  renderScreen();
  showToast('¡Plantilla vaciada y presupuesto restablecido a 100M!');
}

function renderScreen() {
  renderFormationDropdown();
  renderPitchPlayers();
  renderReserves();
  renderMetrics();
  renderTacticalAdvice();
}

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
  if (currentText) currentText.textContent = activeSquad.formation;

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

function changeFormation(newFormationKey) {
  if (!isValidFormation(newFormationKey)) return;
  activeSquad.formation = newFormationKey;
  selectedSlot = null;
  persistActiveSquad();
  renderScreen();
  showToast(`Formación cambiada a ${newFormationKey}`);
}

function renderPitchPlayers() {
  const container = document.getElementById('pitch-players-layer');
  if (!container) return;

  const formationData = FORMATIONS_6V6[activeSquad.formation] || FORMATIONS_6V6['1-2-2-1'];
  const slots = formationData.slots;
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

  container.innerHTML = [
    renderLineRow(delRow, 'row-del'),
    renderLineRow(mcRow, 'row-mc'),
    renderLineRow(defRow, 'row-def'),
    renderLineRow(porRow, 'row-por')
  ].join('');

  container.querySelectorAll('.pitch-slot').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.pitch-slot__remove-btn')) return;
      const index = parseInt(el.getAttribute('data-index'), 10);
      handleSlotClick('starter', index);
    });
  });

  container.querySelectorAll('.pitch-slot__remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'), 10);
      removePlayerToBench(index);
    });
  });
}

function getStaminaPillHtml(energia = 100) {
  const val = Math.max(0, Math.min(100, Math.round(Number(energia) || 100)));
  let tier = 'stamina-high';
  if (val < 60) tier = 'stamina-low';
  else if (val < 80) tier = 'stamina-mid';

  return `
    <div class="stamina-pill" title="Energía física: ${val}%">
      <svg class="stamina-pill__bolt ${tier}" width="9" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
      <div class="stamina-pill__track">
        <div class="stamina-pill__fill ${tier}" style="width: ${val}%"></div>
      </div>
      <span class="stamina-pill__text">${val}%</span>
    </div>
  `;
}

function renderLineRow(slotsInRow, rowClass) {
  if (!slotsInRow || slotsInRow.length === 0) return '';

  const slotsHtml = slotsInRow.map(({ index, assignedRole, player }) => {
    const isSelected = selectedSlot && selectedSlot.type === 'starter' && selectedSlot.index === index;

    if (!player) {
      return `
        <div class="pitch-slot is-empty ${isSelected ? 'is-selected' : ''}" data-index="${index}" title="Puesto libre para ${assignedRole}">
          <div class="pitch-slot__token">
            <span class="pitch-slot__empty-plus">+</span>
          </div>
          <span class="pitch-slot__name-empty">Vacío</span>
          <span class="pitch-slot__role-badge">${assignedRole}</span>
        </div>
      `;
    }

    const naturalRole = (player.role || player.posicion_base || 'MC').toUpperCase();
    const penaltyRate = getPositionPenalty(naturalRole, assignedRole);
    const isPenalized = penaltyRate > 0;
    const rating = getPlayerRating(player);
    const stamina = typeof player.energia === 'number' ? player.energia : 100;

    return `
      <div class="pitch-slot ${isPenalized ? 'is-penalized' : ''} ${isSelected ? 'is-selected' : ''}" data-index="${index}" title="${player.name} (${naturalRole}) - Asignado: ${assignedRole}">
        <div class="pitch-slot__token">
          <span>${getPlayerInitial(player.name)}</span>
          <span class="pitch-slot__rating-pill ${getRatingTierClass(rating)}" title="Valoración: ${rating}">${rating}</span>
          ${isPenalized ? '<span class="pitch-slot__penalty-dot" title="Fuera de posición natural (-15% eficacia)"></span>' : ''}
          <button type="button" class="pitch-slot__remove-btn" data-index="${index}" title="Mover al banquillo">✕</button>
        </div>
        <span class="pitch-slot__name">${player.name}</span>
        <span class="pitch-slot__role-badge">${assignedRole}</span>
        ${getStaminaPillHtml(stamina)}
      </div>
    `;
  }).join('');

  return `<div class="pitch-line-row ${rowClass}">${slotsHtml}</div>`;
}

function renderReserves() {
  const container = document.getElementById('reserves-slots-container');
  if (!container) return;

  const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8]];
  const filledCount = reserves.filter(Boolean).length;
  const countLabel = document.getElementById('reserves-count-label');
  if (countLabel) countLabel.textContent = `${filledCount} / 3 jugadores`;

  container.innerHTML = [0, 1, 2].map(subIndex => {
    const globalIndex = 6 + subIndex;
    const player = reserves[subIndex];
    const isSelected = selectedSlot && selectedSlot.type === 'reserve' && selectedSlot.index === globalIndex;
    const hasPlayer = Boolean(player);
    const rating = hasPlayer ? getPlayerRating(player) : null;

    return `
      <div class="reserve-slot ${hasPlayer ? 'has-player' : 'is-empty'} ${isSelected ? 'is-selected' : ''}" data-index="${globalIndex}">
        <div class="reserve-slot__circle">
          ${hasPlayer ? `
            <button type="button" class="reserve-slot__remove-btn" data-index="${globalIndex}">✕</button>
            <span>${getPlayerInitial(player.name)}</span>
            <span class="reserve-slot__rating-pill ${getRatingTierClass(rating)}">${rating}</span>
          ` : '<span class="reserve-slot__plus">+</span>'}
        </div>
        <span class="reserve-slot__label">${hasPlayer ? player.name : `SUP ${subIndex + 1}`}</span>
        <span class="reserve-slot__role">${hasPlayer ? (player.role || 'MC') : 'Libre'}</span>
        ${hasPlayer ? getStaminaPillHtml(player.energia) : ''}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.reserve-slot').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.reserve-slot__remove-btn')) return;
      const index = parseInt(el.getAttribute('data-index'), 10);
      handleSlotClick('reserve', index);
    });
  });

  container.querySelectorAll('.reserve-slot__remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.getAttribute('data-index'), 10);
      openPlayerActionModal(index);
    });
  });
}

function removePlayerToBench(slotIndex) {
  openPlayerActionModal(slotIndex);
}

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

  const statsBox = document.getElementById('player-action-stats-box');
  if (statsBox) {
    let playerStats = {};
    try {
      const raw = localStorage.getItem('fantasy_player_stats');
      if (raw) playerStats = JSON.parse(raw);
    } catch (e) {}

    const pStats = playerStats[player.name] || {};
    const hasPlayed = (pStats.matchesPlayed || 0) > 0;
    const matches = pStats.matchesPlayed || 0;
    const goals = pStats.goals || 0;
    const rating = (hasPlayed && pStats.avgRating != null) ? Number(pStats.avgRating).toFixed(1) : '-';
    const mvps = pStats.mvpAwards || 0;

    statsBox.innerHTML = `
      <div class="action-stat-pill"><span class="action-stat-label">PJ</span><strong class="action-stat-val">${matches}</strong></div>
      <div class="action-stat-pill"><span class="action-stat-label">Goles</span><strong class="action-stat-val">${goals}</strong></div>
      <div class="action-stat-pill action-stat-pill--rating"><span class="action-stat-label">Nota</span><strong class="action-stat-val">${rating}</strong></div>
      <div class="action-stat-pill action-stat-pill--mvp"><span class="action-stat-label">MVP</span><strong class="action-stat-val">${mvps}</strong></div>
    `;
  }

  let hasFreeReserve = false;
  for (let i = 6; i <= 8; i++) {
    if (!activeSquad.players[i]) { hasFreeReserve = true; break; }
  }

  if (benchBtn) {
    if (!isStarter) {
      benchBtn.style.display = 'none';
    } else if (!hasFreeReserve) {
      benchBtn.style.display = 'flex';
      benchBtn.classList.add('is-disabled');
    } else {
      benchBtn.style.display = 'flex';
      benchBtn.classList.remove('is-disabled');
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

  if (backdrop) backdrop.classList.remove('is-open');
  if (sheet) sheet.classList.remove('is-open');
  if (emptySheet) emptySheet.classList.remove('is-open');

  setTimeout(() => {
    if (backdrop) backdrop.setAttribute('hidden', '');
    if (sheet) sheet.setAttribute('hidden', '');
    if (emptySheet) emptySheet.setAttribute('hidden', '');
    activeActionSlotIndex = null;
  }, 280);
}

function openEmptySlotModal(slotIndex) {
  activeActionSlotIndex = slotIndex;
  const isStarter = slotIndex < 6;
  const formationData = FORMATIONS_6V6[activeSquad.formation] || FORMATIONS_6V6['1-2-2-1'];
  const expectedRole = isStarter ? formationData.slots[slotIndex] : 'SUP';

  const backdrop = document.getElementById('player-action-backdrop');
  const emptySheet = document.getElementById('empty-slot-sheet');
  const titleEl = document.getElementById('empty-slot-title');
  const subtitleEl = document.getElementById('empty-slot-subtitle');
  const reservesBox = document.getElementById('empty-slot-reserves-container');

  if (titleEl) titleEl.textContent = `Puesto Vacío (${expectedRole})`;
  if (subtitleEl) subtitleEl.textContent = isStarter ? `Asigna un suplente o ficha en el mercado` : `Banquillo libre`;

  if (reservesBox) {
    const availableReserves = [];
    for (let i = 6; i <= 8; i++) {
      if (activeSquad.players[i]) availableReserves.push({ index: i, player: activeSquad.players[i] });
    }

    if (availableReserves.length > 0 && isStarter) {
      reservesBox.innerHTML = `<span style="font-size: 0.7rem; font-weight: 700; color: #64748b; margin-bottom: 2px;">SUPLENTES DISPONIBLES:</span>` + 
        availableReserves.map(item => `
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

function setupActionModalEvents(router) {
  const closeBtn = document.getElementById('btn-close-action-modal');
  const closeEmptyBtn = document.getElementById('btn-close-empty-modal');
  const backdrop = document.getElementById('player-action-backdrop');

  if (closeBtn) closeBtn.addEventListener('click', closePlayerActionModal);
  if (closeEmptyBtn) closeEmptyBtn.addEventListener('click', closePlayerActionModal);
  if (backdrop) backdrop.addEventListener('click', closePlayerActionModal);

  const benchBtn = document.getElementById('btn-action-bench');
  if (benchBtn) {
    benchBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      const player = activeSquad.players[activeActionSlotIndex];

      let targetReserveIndex = -1;
      for (let i = 6; i <= 8; i++) {
        if (!activeSquad.players[i]) { targetReserveIndex = i; break; }
      }

      if (targetReserveIndex === -1) {
        showToast('El banquillo está lleno (3/3).');
        closePlayerActionModal();
        return;
      }

      activeSquad.players[targetReserveIndex] = player;
      activeSquad.players[activeActionSlotIndex] = null;
      persistActiveSquad();
      closePlayerActionModal();
      renderScreen();
      showToast(`${player.name} movido al banquillo.`);
    });
  }

  const swapBtn = document.getElementById('btn-action-swap');
  if (swapBtn) {
    swapBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      selectedSlot = { type: activeActionSlotIndex < 6 ? 'starter' : 'reserve', index: activeActionSlotIndex };
      closePlayerActionModal();
      renderScreen();
      showToast(`Seleccionado: ${activeSquad.players[activeActionSlotIndex]?.name}. Toca otro jugador para intercambiar.`);
    });
  }

  const sellBtn = document.getElementById('btn-action-sell');
  if (sellBtn) {
    sellBtn.addEventListener('click', () => {
      if (activeActionSlotIndex === null) return;
      const player = activeSquad.players[activeActionSlotIndex];
      const playerName = player?.name || 'Jugador';

      if (player && player.id) {
        teamState.removePlayer(player.id);
      }

      activeSquad.players[activeActionSlotIndex] = null;
      selectedSlot = null;
      persistActiveSquad();
      closePlayerActionModal();
      renderScreen();
      showToast(`¡${playerName} vendido al mercado!`);
    });
  }

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

function handleSlotClick(type, index) {
  const playerAtClicked = activeSquad.players[index];

  if (!selectedSlot) {
    if (!playerAtClicked) {
      openEmptySlotModal(index);
      return;
    }
    selectedSlot = { type, index };
    renderPitchPlayers();
    renderReserves();
    showToast(`Seleccionado: ${playerAtClicked.name}. Toca otro puesto.`);
    return;
  }

  if (selectedSlot.type === type && selectedSlot.index === index) {
    selectedSlot = null;
    renderPitchPlayers();
    renderReserves();
    return;
  }

  const firstIndex = selectedSlot.index;
  const secondIndex = index;
  const playerFirst = activeSquad.players[firstIndex];
  const playerSecond = activeSquad.players[secondIndex];

  activeSquad.players[firstIndex] = playerSecond;
  activeSquad.players[secondIndex] = playerFirst;

  selectedSlot = null;
  persistActiveSquad(); // Guarda automáticamente las posiciones al intercambiar
  renderScreen();
  showToast('¡Intercambio realizado y guardado con éxito!');
}

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
      synergyTextEl.textContent = `Alineación incompleta: faltan ${missingCount} jugador(es)`;
    } else if (totalPenalty === 0) {
      synergyTextEl.textContent = 'Química óptima: todos en su rol natural';
    } else {
      synergyTextEl.textContent = `Jugadores fuera de posición natural`;
    }
  }

  const avgRatingEl = document.getElementById('lineup-avg-rating');
  if (avgRatingEl) {
    avgRatingEl.innerHTML = `Media: <strong>${avgRating}</strong>`;
  }

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

const TACTICAL_ADVICES = {
  '1-2-2-1': '<strong>Equilibrio Puro:</strong> Estructura clásica que permite control tanto en el fondo como en el centro del campo.',
  '1-2-1-2': '<strong>Rombo Ofensivo:</strong> Disposición en rombo que conecta la zaga con dos puntas móviles.',
  '1-1-2-2': '<strong>Ataque Frontal:</strong> Sacrifica ancho defensivo para sobrecargar la ofensiva con dos puntas.',
  '1-3-1-1': '<strong>Cerrojo y Presión:</strong> Tres defensores para neutralizar el centro y ahogar circuitos rivales.',
  '1-1-3-1': '<strong>Dominio del Medio:</strong> Superioridad numérica con tres mediocampistas.',
  '1-1-1-3': '<strong>Ultra Ofensivo (All-In):</strong> Esquema agresivo con tres delanteros en punta.'
};

function renderTacticalAdvice() {
  const adviceEl = document.getElementById('tactical-advice-text');
  if (!adviceEl) return;
  const currentAdvice = TACTICAL_ADVICES[activeSquad.formation] || 'Formación táctica equilibrada.';
  adviceEl.innerHTML = currentAdvice;
}

let dropdownDocumentClickListener = null;

function setupDropdownEvents() {
  const trigger = document.getElementById('formation-selector-btn');
  const dropdown = document.getElementById('formation-dropdown');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');

  if (!trigger || !dropdown) return;

  if (dropdownDocumentClickListener) {
    document.removeEventListener('click', dropdownDocumentClickListener);
    dropdownDocumentClickListener = null;
  }

  trigger.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  };

  if (wrapper) {
    wrapper.onclick = (e) => {
      if (!dropdown.contains(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
      }
    };
  }

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
  if (isClosed) openDropdown();
  else closeDropdown();
}

function openDropdown() {
  const dropdown = document.getElementById('formation-dropdown');
  const trigger = document.getElementById('formation-selector-btn');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');
  if (dropdown) { dropdown.removeAttribute('hidden'); dropdown.classList.add('is-open'); }
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  if (wrapper) wrapper.classList.add('is-open');
}

function closeDropdown() {
  const dropdown = document.getElementById('formation-dropdown');
  const trigger = document.getElementById('formation-selector-btn');
  const wrapper = document.querySelector('.formation-dropdown-wrapper');
  if (dropdown) { dropdown.setAttribute('hidden', ''); dropdown.classList.remove('is-open'); }
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (wrapper) wrapper.classList.remove('is-open');
}

const FORMATION_DETAILS = [
  { key: '1-2-2-1', name: '1-2-2-1 (Equilibrio puro)', desc: 'Estructura clásica que permite control total.' },
  { key: '1-2-1-2', name: '1-2-1-2 (Rombo)', desc: 'Disposición en rombo en el medio campo.' },
  { key: '1-1-2-2', name: '1-1-2-2 (Ataque Frontal)', desc: 'Poder de fuego arriba.' },
  { key: '1-3-1-1', name: '1-3-1-1 (Alta Presión)', desc: 'Ahogar al rival en su campo.' },
  { key: '1-1-3-1', name: '1-1-3-1 (Dominio del Medio)', desc: 'Superioridad numérica en la medular.' },
  { key: '1-1-1-3', name: '1-1-1-3 (Ultra Ofensivo)', desc: 'Todo al ataque con tridente.' }
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
  if (resetBtn) resetBtn.addEventListener('click', resetToBalancedSquad);

  modalBackdrop.addEventListener('click', closeTacticalModal);
}

function openTacticalModal() {
  const modalBackdrop = document.getElementById('tactical-modal-backdrop');
  const modalSheet = document.getElementById('tactical-modal-sheet');
  const listContainer = document.getElementById('tactical-modal-list');

  if (!modalBackdrop || !modalSheet || !listContainer) return;

  listContainer.innerHTML = FORMATION_DETAILS.map(f => {
    const isActive = f.key === activeSquad.formation;
    return `
      <article class="formation-card ${isActive ? 'is-active' : ''}" data-formation="${f.key}">
        <div class="formation-card__header">
          <div class="formation-card__title-group">
            <h3 class="formation-card__title">${f.name}</h3>
            ${isActive ? '<span class="formation-card__badge">ACTIVA</span>' : ''}
          </div>
        </div>
        <p class="formation-card__desc">${f.desc}</p>
      </article>
    `;
  }).join('');

  listContainer.querySelectorAll('.formation-card').forEach(card => {
    card.addEventListener('click', () => {
      const formKey = card.getAttribute('data-formation');
      if (formKey && formKey !== activeSquad.formation) changeFormation(formKey);
      closeTacticalModal();
    });
  });

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

function setupSaveButton(router) {
  const saveBtn = document.getElementById('btn-save-lineup');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const starters = activeSquad.players.slice(0, 6).filter(Boolean);
    const reserves = [activeSquad.players[6], activeSquad.players[7], activeSquad.players[8]].filter(Boolean);
    const totalFilled = starters.length + reserves.length;

    if (totalFilled < 9) {
      showToast('Debes completar los 9 jugadores (6 titulares y 3 suplentes) para confirmar.');
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Guardando...';
      persistActiveSquad();
      try {
        await squadService.saveSquad({
          formation: activeSquad.formation,
          players: activeSquad.players
        });
      } catch (e) {}
      showToast('¡Alineación oficial confirmada con éxito!');
    } catch (err) {
      showToast('Error al guardar la alineación.');
    } finally {
      saveBtn.disabled = false;
      renderMetrics();
    }
  });
}

function getPlayerInitial(name = '') {
  if (!name) return 'J';
  const clean = name.replace(/^[A-Z]\.\s*/, '');
  return clean.charAt(0).toUpperCase();
}

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