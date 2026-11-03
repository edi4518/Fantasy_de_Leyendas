/**
 * @file matchmaking.js
 * @description Controlador de la pantalla intermedia de Matchmaking P2P y Comparativa Táctica (Versus).
 * Conecta el Dashboard con el partido en directo (Live Match), seleccionando uno de los 20 rivales del sistema
 * y renderizando la comparativa estadística real de ambas plantillas con barras divergentes animadas.
 * Ofrece un botón de acción en la parte inferior para que el usuario inicie el encuentro cuando esté listo.
 */

import { getRandomCpuTeam } from '../../domain/cpu-teams.js';
import { isTacticalCounter, FORMATIONS_6V6 } from '../../domain/formation-rules.js';

export const DEFAULT_HOME_SQUAD = {
  name: 'Tu Equipo',
  formation: '1-2-2-1',
  players: [
    { name: 'Casillas', role: 'POR', rating_general: 89, rating_fisico: 82, rating_palmares: 88, rating_defensa: 88, rating_creacion: 50, rating_tecnica: 65, rating_ataque: 20, precio: 8.5 },
    { name: 'Maldini', role: 'DEF', rating_general: 92, rating_defensa: 92, rating_fisico: 85, rating_palmares: 92, rating_creacion: 70, rating_tecnica: 78, rating_ataque: 40, precio: 10.5 },
    { name: 'Baresi', role: 'DEF', rating_general: 93, rating_defensa: 93, rating_fisico: 79, rating_palmares: 90, rating_creacion: 68, rating_tecnica: 75, rating_ataque: 35, precio: 10.0 },
    { name: 'Zidane', role: 'MC', rating_general: 97, rating_creacion: 96, rating_tecnica: 98, rating_fisico: 83, rating_palmares: 95, rating_ataque: 88, rating_defensa: 65, precio: 12.5 },
    { name: 'Xavi', role: 'MC', rating_general: 96, rating_creacion: 97, rating_tecnica: 95, rating_fisico: 76, rating_palmares: 94, rating_ataque: 78, rating_defensa: 68, precio: 11.0 },
    { name: 'Messi', role: 'DEL', rating_general: 99, rating_ataque: 99, rating_tecnica: 99, rating_creacion: 95, rating_fisico: 80, rating_palmares: 99, rating_defensa: 35, precio: 15.0 },
    { name: 'Ronaldo', role: 'DEL', rating_general: 97, rating_ataque: 97, rating_tecnica: 95, rating_fisico: 86, rating_palmares: 91, rating_defensa: 30, rating_creacion: 75, precio: 13.0 },
    { name: 'Iniesta', role: 'MC', rating_general: 95, rating_creacion: 94, rating_tecnica: 96, rating_fisico: 85, rating_palmares: 93, rating_ataque: 82, rating_defensa: 60, precio: 8.5 },
    { name: 'Puyol', role: 'DEF', rating_general: 90, rating_defensa: 90, rating_fisico: 88, rating_palmares: 89, rating_ataque: 30, rating_creacion: 50, rating_tecnica: 60, precio: 7.5 }
  ]
};

let matchmakingTimer = null;
let navigationExecuted = false;

/**
 * Inicializador principal llamado por el Router SPA
 * @param {Object} router - Instancia del router
 */
export function initMatchmaking(router) {
  navigationExecuted = false;
  clearExistingTimers();

  // 1. Obtener datos de la plantilla del usuario
  const homeSquad = getHomeSquad();

  // 2. Obtener un rival aleatorio de los 20 rivales del sistema
  const rival = getRandomCpuTeam();
  const awaySquad = rival || {
    name: 'Milan Clásico',
    formation: '1-2-1-2',
    players: DEFAULT_HOME_SQUAD.players.map(p => ({ ...p }))
  };

  // Guardar en sessionStorage para que el Live Match dispute el encuentro exactamente con este rival
  sessionStorage.setItem('fantasy_selected_rival', JSON.stringify(awaySquad));
  sessionStorage.setItem('fantasy_match_autoplay', 'true');

  // 3. Calcular estadísticas reales de ambas plantillas
  const homeStats = calculateTeamMetrics(homeSquad);
  const awayStats = calculateTeamMetrics(awaySquad);

  // 4. Renderizar cabecera y versus
  renderVersusHeader(homeSquad, awaySquad, homeStats, awayStats);

  // 5. Renderizar comparativa táctica divergente
  renderTacticalComparison(homeStats, awayStats, homeSquad, awaySquad);

  // 6. Iniciar secuencia de escaneo y activación del botón empezar partido
  startMatchmakingSequence(awaySquad, router);
}

/**
 * Obtiene la plantilla del usuario desde localStorage con fallback
 */
function getHomeSquad() {
  try {
    const raw = localStorage.getItem('fantasy_active_squad');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players) && parsed.players.filter(Boolean).length >= 6) {
        return {
          name: parsed.name || 'Tu Equipo',
          formation: parsed.formation || '1-2-2-1',
          players: [...parsed.players]
        };
      }
    }
  } catch (e) {
    console.debug('[Matchmaking] Error leyendo plantilla del usuario:', e);
  }
  return { ...DEFAULT_HOME_SQUAD, players: DEFAULT_HOME_SQUAD.players.map(p => ({ ...p })) };
}

/**
 * Calcula las métricas de equipo ponderadas por líneas y roles tácticos (estilo EA FC / Football Manager)
 * evitando que los arqueros o centrales reduzcan artificialmente el promedio ofensivo,
 * o que los delanteros reduzcan la solidez de la zaga defensiva.
 */
export function calculateTeamMetrics(squad) {
  const formation = squad.formation || '1-2-2-1';
  const mults = FORMATIONS_6V6[formation]?.multipliers || { attack: 1.0, defense: 1.0, creation: 1.0, technique: 1.0 };
  const formationSlots = FORMATIONS_6V6[formation]?.slots || ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL'];

  const getRole = p => (p.role || p.posicion_base || (p.posicion?.startsWith('Arquero') ? 'POR' : p.posicion?.startsWith('Defensor') ? 'DEF' : p.posicion?.startsWith('Mediocampista') ? 'MC' : 'DEL') || 'MC').toUpperCase();

  // Si los primeros 6 no coinciden con los slots de la formación (por ej. plantilla desordenada), alinear según slots
  let starters = (squad.players || []).slice(0, 6).filter(Boolean);
  const allPlayers = (squad.players || []).filter(Boolean);
  if (allPlayers.length > 6) {
    const pool = [...allPlayers];
    const aligned = [];
    for (const slotRole of formationSlots) {
      const idx = pool.findIndex(p => getRole(p) === slotRole);
      if (idx !== -1) aligned.push(pool.splice(idx, 1)[0]);
      else aligned.push(pool.shift());
    }
    starters = aligned;
  }

  const forwards = starters.filter(p => getRole(p) === 'DEL');
  const midfielders = starters.filter(p => getRole(p) === 'MC');
  const defenders = starters.filter(p => getRole(p) === 'DEF');
  const keepers = starters.filter(p => getRole(p) === 'POR');

  const avg = (arr, selector, fallback = 80) => {
    if (!arr || arr.length === 0) return fallback;
    const sum = arr.reduce((acc, p) => acc + (Number(selector(p)) || fallback), 0);
    return sum / arr.length;
  };

  const getGeneral = p => {
    if (typeof p.rating_general === 'number' && p.rating_general > 0) return Math.round(p.rating_general);
    if (typeof p.media_juego === 'number' && p.media_juego > 0) return Math.round(p.media_juego);
    const role = getRole(p);
    if (role === 'DEL') return Math.round(p.rating_ataque || 88);
    if (role === 'DEF') return Math.round(p.rating_defensa || 88);
    if (role === 'POR') return Math.round(p.rating_defensa || 88);
    return Math.round(((Number(p.rating_creacion) || 85) * 0.5) + ((Number(p.rating_tecnica) || 85) * 0.5));
  };

  const getAtk = p => Math.round(Number(p.rating_ataque || getGeneral(p)));
  const getDef = p => Math.round(Number(p.rating_defensa || getGeneral(p)));
  const getCre = p => Math.round(Number(p.rating_creacion || getGeneral(p)));
  const getTec = p => Math.round(Number(p.rating_tecnica || getGeneral(p)));
  const getFis = p => Math.round(Number(p.rating_fisico || 80));

  // 1. ATAQUE: Ponderación de Delanteros (70%) y Mediocampistas (30%) + bonus de formación
  let rawAttack = 82;
  if (forwards.length > 0 && midfielders.length > 0) {
    rawAttack = (avg(forwards, getAtk) * 0.70) + (avg(midfielders, getAtk) * 0.30);
  } else if (forwards.length > 0) {
    rawAttack = avg(forwards, getAtk);
  } else if (midfielders.length > 0) {
    rawAttack = avg(midfielders, getAtk) * 0.95;
  } else {
    rawAttack = avg(starters, getAtk);
  }
  const finalAttack = Math.min(99, Math.max(65, Math.round(rawAttack * (mults.attack || 1.0))));

  // 2. DEFENSA: Ponderación de Defensores (75%) y Arquero (25%) + bonus de formación
  let rawDefense = 82;
  if (defenders.length > 0 && keepers.length > 0) {
    const keeperVal = avg(keepers, p => Math.max(getDef(p), getGeneral(p)));
    rawDefense = (avg(defenders, getDef) * 0.75) + (keeperVal * 0.25);
  } else if (defenders.length > 0) {
    rawDefense = avg(defenders, getDef);
  } else {
    rawDefense = avg(starters, getDef);
  }
  const finalDefense = Math.min(99, Math.max(65, Math.round(rawDefense * (mults.defense || 1.0))));

  // 3. CREACIÓN: Ponderación de Mediocampistas (80%) y resto de campo (20%) + bonus de formación
  let rawCreation = 82;
  if (midfielders.length > 0) {
    const midVal = avg(midfielders, p => (getCre(p) * 0.65 + getTec(p) * 0.35));
    const outfieldOther = starters.filter(p => getRole(p) !== 'POR' && getRole(p) !== 'MC');
    const otherVal = outfieldOther.length > 0 ? avg(outfieldOther, p => Math.max(getCre(p), getTec(p) * 0.8)) : midVal;
    rawCreation = (midVal * 0.80) + (otherVal * 0.20);
  } else {
    rawCreation = avg(starters.filter(p => getRole(p) !== 'POR'), getCre);
  }
  const finalCreation = Math.min(99, Math.max(65, Math.round(rawCreation * (mults.creation || 1.0))));

  // 4. FÍSICO: Promedio ponderado de jugadores de campo
  const outfield = starters.filter(p => getRole(p) !== 'POR');
  const finalFisico = Math.min(99, Math.max(65, Math.round(avg(outfield.length > 0 ? outfield : starters, getFis))));

  // 5. RATING GLOBAL (OVR): Promedio de calidad general de los 6 titulares
  const finalOvr = Math.min(99, Math.max(65, Math.round(avg(starters, getGeneral))));

  return {
    ovr: finalOvr,
    ataque: finalAttack,
    creacion: finalCreation,
    defensa: finalDefense,
    fisico: finalFisico
  };
}

function renderVersusHeader(homeSquad, awaySquad, homeStats, awayStats) {
  // Datos locales
  const homeNameEl = document.getElementById('home-team-name');
  const homeManagerEl = document.getElementById('home-manager-name');
  const homeOvrEl = document.getElementById('home-team-ovr');
  const homeRankEl = document.getElementById('home-team-rank');

  let localManagerName = 'Tú';
  try {
    const rawUser = localStorage.getItem('fantasy_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.name || u.nombre) localManagerName = u.name || u.nombre;
    }
  } catch (e) {}

  if (homeNameEl) homeNameEl.textContent = homeSquad.name || 'Tu Equipo';
  if (homeManagerEl) homeManagerEl.textContent = localManagerName;
  if (homeOvrEl) homeOvrEl.textContent = `${homeStats.ovr} OVR`;
  if (homeRankEl) homeRankEl.textContent = 'Rank: #450';

  // Datos del rival
  const awayNameEl = document.getElementById('away-team-name');
  const awayManagerEl = document.getElementById('away-manager-name');
  const awayOvrEl = document.getElementById('away-team-ovr');
  const awayRankEl = document.getElementById('away-team-rank');

  const rivalRankNumber = Math.floor(Math.random() * 80) + 390;

  if (awayNameEl) awayNameEl.textContent = awaySquad.name;
  if (awayManagerEl) awayManagerEl.textContent = `Míster ${awaySquad.name.split(' ')[0]}`;
  if (awayOvrEl) awayOvrEl.textContent = `${awayStats.ovr} OVR`;
  if (awayRankEl) awayRankEl.textContent = `Rank: #${rivalRankNumber}`;

  // ID aleatorio de Sala
  const roomEl = document.getElementById('matchmaking-room-id');
  if (roomEl) {
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    roomEl.textContent = `Sala #${randomHex}-A`;
  }
}

/**
 * Renderiza la Comparativa Táctica (Head-to-head) con barras divergentes
 */
function renderTacticalComparison(homeStats, awayStats, homeSquad, awaySquad) {
  const metrics = [
    { id: 'ovr', home: homeStats.ovr, away: awayStats.ovr },
    { id: 'att', home: homeStats.ataque, away: awayStats.ataque },
    { id: 'cre', home: homeStats.creacion, away: awayStats.creacion },
    { id: 'def', home: homeStats.defensa, away: awayStats.defensa },
    { id: 'fis', home: homeStats.fisico, away: awayStats.fisico }
  ];

  metrics.forEach(m => {
    // Valores numéricos
    const homeValEl = document.getElementById(`stat-val-home-${m.id}`);
    const awayValEl = document.getElementById(`stat-val-away-${m.id}`);
    if (homeValEl) {
      homeValEl.textContent = m.home;
      if (m.home > m.away) homeValEl.classList.add('is-winner-home');
    }
    if (awayValEl) {
      awayValEl.textContent = m.away;
      if (m.away > m.home) awayValEl.classList.add('is-winner-away');
    }

    // Barras de progreso divergentes (escala 0-100%)
    const homeBarEl = document.getElementById(`bar-home-${m.id}`);
    const awayBarEl = document.getElementById(`bar-away-${m.id}`);

    setTimeout(() => {
      if (homeBarEl) {
        homeBarEl.style.width = `${Math.min(100, Math.max(10, m.home))}%`;
        if (m.home > m.away) homeBarEl.classList.add('is-dominant');
      }
      if (awayBarEl) {
        awayBarEl.style.width = `${Math.min(100, Math.max(10, m.away))}%`;
        if (m.away > m.home) awayBarEl.classList.add('is-dominant');
      }
    }, 200);
  });

  // Factor táctico dinámico
  renderDynamicTacticalFactor(homeStats, awayStats, homeSquad, awaySquad);
}

/**
 * Ejecuta la secuencia progresiva de matchmaking y activa el botón para empezar el partido
 */
function startMatchmakingSequence(awaySquad, router) {
  const progressBar = document.getElementById('matchmaking-progress-bar');
  const titleEl = document.getElementById('countdown-text');
  const subEl = document.getElementById('countdown-subtitle');
  const btnStart = document.getElementById('btn-start-match');
  const btnStartLabel = document.getElementById('btn-start-match-label');

  // Fase 1: Estado inicial de búsqueda
  if (progressBar) progressBar.style.width = '25%';
  if (btnStart) btnStart.disabled = true;
  if (btnStartLabel) btnStartLabel.textContent = 'BUSCANDO RIVAL...';

  // Configurar evento de clic en el botón de empezar partido
  if (btnStart && !btnStart.hasAttribute('data-bound')) {
    btnStart.setAttribute('data-bound', 'true');
    btnStart.addEventListener('click', (e) => {
      e.preventDefault();
      if (btnStart.disabled) return;
      btnStart.disabled = true;
      if (btnStartLabel) btnStartLabel.textContent = 'INICIANDO PARTIDO...';
      redirectToLiveMatch(router);
    });
  }

  // Fase 2 (1.2 segundos): Rival encontrado y activación del botón
  setTimeout(() => {
    if (progressBar) progressBar.style.width = '100%';
    if (titleEl) {
      titleEl.innerHTML = `<span class="is-ready">¡Rival encontrado: ${awaySquad.name}!</span>`;
    }
    if (subEl) {
      subEl.textContent = 'Alineaciones confirmadas. Pulsa abajo para dar el pitido inicial.';
    }

    // Activar botón de inicio en verde césped con animación de pulso
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.classList.add('is-ready');
    }
    if (btnStartLabel) {
      btnStartLabel.textContent = '¡EMPEZAR PARTIDO!';
    }
  }, 1200);

  // Soporte de respaldo: si el usuario hace clic en la tarjeta de estado también inicia
  const statusCard = document.querySelector('.matchmaking-status-card');
  if (statusCard && !statusCard.hasAttribute('data-bound')) {
    statusCard.setAttribute('data-bound', 'true');
    statusCard.style.cursor = 'pointer';
    statusCard.title = 'Toca para empezar el partido';
    statusCard.addEventListener('click', () => {
      if (btnStart && !btnStart.disabled) {
        btnStart.click();
      }
    });
  }
}

/**
 * Redirige fluidamente a la pantalla del partido en directo
 */
function redirectToLiveMatch(router) {
  if (navigationExecuted) return;
  navigationExecuted = true;
  clearExistingTimers();

  // Usamos replace en la barra para que la pantalla intermedia no quede atrapada en el historial hacia atrás
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', '#/match/live?autoplay=true');
  }
  if (router && typeof router.navigate === 'function') {
    router.navigate('/match/live?autoplay=true');
  } else if (window.router && typeof window.router.navigate === 'function') {
    window.router.navigate('/match/live?autoplay=true');
  } else {
    window.location.hash = '/match/live?autoplay=true';
  }
}

function clearExistingTimers() {
  if (matchmakingTimer) {
    clearTimeout(matchmakingTimer);
    matchmakingTimer = null;
  }
}


/**
 * Renderiza el factor táctico dinámico analizando diferencias estadísticas y counters de formaciones
 */
function renderDynamicTacticalFactor(homeStats, awayStats, homeSquad, awaySquad) {
  const container = document.getElementById('matchmaking-tactical-factor');
  const iconWrap = document.getElementById('matchmaking-factor-icon-wrap');
  const textEl = document.getElementById('matchmaking-factor-text');

  if (!container || !textEl) return;

  const analysis = calculateTacticalFactor(homeStats, awayStats, homeSquad, awaySquad);

  // Aplicar clases de estado según el balance (favorable, warning, neutral)
  container.classList.remove('is-favorable', 'is-warning', 'is-neutral');
  container.classList.add(`is-${analysis.type}`);

  // Inyectar icono vectorial y texto analítico
  if (iconWrap) {
    iconWrap.innerHTML = getFactorIconSvg(analysis.icon);
  }
  textEl.textContent = analysis.text;
}

/**
 * Evalúa las estadísticas y formaciones de ambos equipos para determinar el análisis táctico más representativo
 */
function calculateTacticalFactor(homeStats, awayStats, homeSquad, awaySquad) {
  const homeForm = homeSquad.formation || '1-2-2-1';
  const awayForm = awaySquad.formation || '1-2-1-2';

  const diffAtk = homeStats.ataque - awayStats.ataque;
  const diffDef = homeStats.defensa - awayStats.defensa;
  const diffCre = homeStats.creacion - awayStats.creacion;
  const diffFis = homeStats.fisico - awayStats.fisico;
  const diffOvr = homeStats.ovr - awayStats.ovr;

  const potOfensivaLocal = homeStats.ataque - awayStats.defensa;
  const potOfensivaRival = awayStats.ataque - homeStats.defensa;

  // 1. Counter táctico directo según formation-rules.js
  if (isTacticalCounter(homeForm, awayForm)) {
    const homeFormName = FORMATIONS_6V6[homeForm]?.shortName || homeForm;
    const awayFormName = FORMATIONS_6V6[awayForm]?.shortName || awayForm;
    return {
      type: 'favorable',
      icon: 'sparkles',
      text: `¡Counter táctico favorable! Tu esquema ${homeForm} (${homeFormName}) neutraliza la formación ${awayForm} rival.`
    };
  }

  if (isTacticalCounter(awayForm, homeForm)) {
    const awayFormName = FORMATIONS_6V6[awayForm]?.shortName || awayForm;
    return {
      type: 'warning',
      icon: 'alert',
      text: `Alerta táctica: El rival plantea ${awayForm} (${awayFormName}), diseñada para bloquear los circuitos de tu ${homeForm}.`
    };
  }

  // 2. Duelo de área: delantera vs zaga rival
  if (potOfensivaLocal >= 5) {
    return {
      type: 'favorable',
      icon: 'target',
      text: `Ventaja ofensiva: Tu delantera (${homeStats.ataque}) supera la zaga rival (${awayStats.defensa}) por +${potOfensivaLocal} pts.`
    };
  }

  if (potOfensivaRival >= 5) {
    return {
      type: 'warning',
      icon: 'shield',
      text: `Peligro rival: El ataque rival (${awayStats.ataque}) exigirá máxima concentración a tu defensa (${homeStats.defensa}).`
    };
  }

  // 3. Batalla en la medular (Creación y posesión)
  if (diffCre >= 4) {
    return {
      type: 'favorable',
      icon: 'compass',
      text: `Control de la medular: Mayor volumen de creación y precisión (+${diffCre} pts) para dictar el ritmo.`
    };
  }

  if (diffCre <= -4) {
    return {
      type: 'warning',
      icon: 'compass',
      text: `Presión en el centro: El rival cuenta con mejor circuito creativo (+${Math.abs(diffCre)} pts) para filtrar pases.`
    };
  }

  // 4. Solidez defensiva global
  if (diffDef >= 5) {
    return {
      type: 'favorable',
      icon: 'shield',
      text: `Solidez táctica: Tu cerrojo defensivo supera al del rival (+${diffDef} pts), concediendo pocos espacios.`
    };
  }

  if (diffDef <= -5) {
    return {
      type: 'warning',
      icon: 'shield',
      text: `Muralla rival: El oponente presenta un bloque defensivo muy compacto (+${Math.abs(diffDef)} pts).`
    };
  }

  // 5. Superioridad física y presión
  if (diffFis >= 5) {
    return {
      type: 'favorable',
      icon: 'zap',
      text: `Poderío físico: Mayor potencia (+${diffFis} pts) para imponerse en duelos divididos y balones aéreos.`
    };
  }

  if (diffFis <= -5) {
    return {
      type: 'warning',
      icon: 'zap',
      text: `Desgaste físico: El rival impone un ritmo de presión alta con mayor fuelle físico (+${Math.abs(diffFis)} pts).`
    };
  }

  // 6. Diferencia de Ataque directo
  if (diffAtk >= 4) {
    return {
      type: 'favorable',
      icon: 'target',
      text: `Poder de fuego: Mayor contundencia atacante (+${diffAtk} pts) para definir frente al arco.`
    };
  }

  if (diffAtk <= -4) {
    return {
      type: 'warning',
      icon: 'target',
      text: `Delantera rival peligrosa: Mayor promedio anotador visitante (+${Math.abs(diffAtk)} pts).`
    };
  }

  // 7. Diferencia en OVR general
  if (diffOvr >= 3) {
    return {
      type: 'favorable',
      icon: 'sparkles',
      text: `Favorito en los papeles: Tu plantilla promedia mayor calidad global (+${diffOvr} OVR).`
    };
  }

  if (diffOvr <= -3) {
    return {
      type: 'warning',
      icon: 'alert',
      text: `Prueba de fuego: El rival llega con mayor valoración global promedio (+${Math.abs(diffOvr)} OVR).`
    };
  }

  // 8. Paridad táctica absoluta
  return {
    type: 'neutral',
    icon: 'balance',
    text: `Duelo de máxima paridad (${homeStats.ovr} vs ${awayStats.ovr} OVR) · Se definirá en detalles y efectividad.`
  };
}

/**
 * Retorna el SVG vectorial según la categoría de análisis táctico
 */
function getFactorIconSvg(iconType) {
  switch (iconType) {
    case 'target':
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <circle cx="12" cy="12" r="6"></circle>
        <circle cx="12" cy="12" r="2"></circle>
      </svg>`;

    case 'shield':
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>`;

    case 'compass':
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="10"></circle>
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>
      </svg>`;

    case 'zap':
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>`;

    case 'sparkles':
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
      </svg>`;

    case 'alert':
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>`;

    case 'balance':
    default:
      return `<svg class="matchmaking-tactical-factor__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
        <path d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"></path>
      </svg>`;
  }
}
