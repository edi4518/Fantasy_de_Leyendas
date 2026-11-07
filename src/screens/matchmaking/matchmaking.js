
/**
 * @file matchmaking.js
 * @description Controlador de la pantalla intermedia de Matchmaking P2P y Comparativa Táctica (Versus).
 * Conecta el Dashboard con el partido en directo (Live Match), seleccionando uno de los 20 rivales del sistema
 * y renderizando la comparativa estadística real de ambas plantillas con barras divergentes animadas.
 * Ofrece un botón de acción en la parte inferior para que el usuario inicie el encuentro cuando esté listo.
 */

import { getRandomCpuTeam } from '../../domain/cpu-teams.js';
import { isTacticalCounter, FORMATIONS_6V6 } from '../../domain/formation-rules.js';
import { matchService } from '../../services/match-service.js';


let matchmakingTimer = null;
let navigationExecuted = false;

/**
 * Inicializador principal llamado por el Router SPA
 * @param {Object} router - Instancia del router
 */
export async function initMatchmaking(router) {
  navigationExecuted = false;
  clearExistingTimers();

  // 1. Validar estrictamente los requisitos reglamentarios: 6 titulares y 4 suplentes
  const homeSquad = getHomeSquad();
  if (!homeSquad || !isSquadComplete(homeSquad)) {
    console.warn('[Matchmaking] Acceso denegado: Se requieren exactamente 6 titulares y 4 suplentes. Redirigiendo a Dashboard...');
    if (router && typeof router.navigate === 'function') {
      router.navigate('/dashboard');
    } else {
      window.location.hash = '#/dashboard';
    }
    return;
  }

  // 2. Obtener un rival real de los usuarios registrados en el backend
  let awaySquad = null;
  try {
    const userRaw = localStorage.getItem('fantasy_logged_user');
    const userObj = userRaw ? JSON.parse(userRaw) : null;
    const realOpponents = await matchService.getCpuOpponents();
    if (Array.isArray(realOpponents) && realOpponents.length > 0) {
      const others = realOpponents.filter(op => !userObj || op.user_id !== userObj.id);
      const pool = others.length > 0 ? others : realOpponents;
      const picked = pool[Math.floor(Math.random() * pool.length)];
      if (picked && Array.isArray(picked.players) && picked.players.length >= 6) {
        awaySquad = {
          name: picked.team_name || picked.name || 'Equipo Rival',
          formation: picked.formation || '1-2-2-1',
          cost: picked.costo_total || 0,
          players: picked.players.map(p => ({
            ...p,
            name: p.name || p.nombre,
            role: p.role || p.posicion_base || 'MC',
            posicion_base: p.posicion_base || p.role || 'MC',
            rating_general: p.rating_general || p.media_juego || 75
          }))
        };
      }
    }
  } catch (err) {
    console.debug('[Matchmaking] Error obteniendo rival real:', err);
  }

  // Fallback si aún no hay otros usuarios registrados con alineación completa
  if (!awaySquad) {
    const fallbackCpu = getRandomCpuTeam();
    awaySquad = fallbackCpu || {
      name: 'Milan Clásico',
      formation: '1-2-1-2',
      players: DEFAULT_HOME_SQUAD.players.map(p => ({ ...p }))
    };
  }

  // Guardar en sessionStorage para que el Live Match dispute el encuentro exactamente con este rival
  sessionStorage.setItem('fantasy_selected_rival', JSON.stringify(awaySquad));
  sessionStorage.setItem('fantasy_match_autoplay', 'true');

  // 3. Calcular estadísticas reales de ambas plantillas
  const homeStats = calculateTeamMetrics(homeSquad);
  const awayStats = calculateTeamMetrics(awaySquad);

  // 4. Renderizar cabecera y versus (soporta tanto IDs del template v1 como v2)
  renderVersusHeader(homeSquad, awaySquad, homeStats, awayStats);

  // 5. Renderizar comparativa táctica divergente
  renderTacticalComparison(homeStats, awayStats, homeSquad, awaySquad);

  // 6. Iniciar secuencia de escaneo, frenar spinner y activar el botón
  startMatchmakingSequence(awaySquad, router);
}

// Alias de retrocompatibilidad
export const initMatchmakingScreen = initMatchmaking;

/**
 * Obtiene la plantilla del usuario desde localStorage con fallback
 */
function getHomeSquad() {
  try {
    const raw = localStorage.getItem('fantasy_active_squad');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.players)) {
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
  return null;
}

function isSquadComplete(squad) {
  if (!squad || !Array.isArray(squad.players)) return false;
  const starters = squad.players.slice(0, 6).filter(Boolean);
  const reserves = squad.players.slice(6, 10).filter(Boolean);
  return starters.length === 6 && reserves.length === 4;
}

/**
 * Calcula las métricas de equipo ponderadas por líneas y roles tácticos
 */
export function calculateTeamMetrics(squad) {
  const formation = squad.formation || '1-2-2-1';
  const mults = FORMATIONS_6V6[formation]?.multipliers || { attack: 1.0, defense: 1.0, creation: 1.0, technique: 1.0 };
  const formationSlots = FORMATIONS_6V6[formation]?.slots || ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL'];

  const getRole = p => (p.role || p.posicion_base || (p.posicion?.startsWith('Arquero') ? 'POR' : p.posicion?.startsWith('Defensor') ? 'DEF' : p.posicion?.startsWith('Mediocampista') ? 'MC' : 'DEL') || 'MC').toUpperCase();

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
    if (typeof p.media_juego === 'number' && p.media_juego > 0) return Math.round(p.media_juego);
    if (typeof p.rating_general === 'number' && p.rating_general > 0) return Math.round(p.rating_general);
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

  // 1. ATAQUE
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

  // 2. DEFENSA
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

  // 3. CREACIÓN
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

  // 4. FÍSICO
  const outfield = starters.filter(p => getRole(p) !== 'POR');
  const finalFisico = Math.min(99, Math.max(65, Math.round(avg(outfield.length > 0 ? outfield : starters, getFis))));

  // 5. RATING GLOBAL (OVR)
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
  // Datos locales (Soporta IDs de ambas plantillas)
  const homeNameEl = document.getElementById('user-name') || document.getElementById('home-team-name');
  const homeManagerEl = document.getElementById('user-owner') || document.getElementById('home-manager-name');
  const homeOvrEl = document.getElementById('user-ovr') || document.getElementById('home-team-ovr');
  const homeRankEl = document.getElementById('user-rank') || document.getElementById('home-team-rank');

  let localManagerName = 'Tú';
  let localRank = '#1';
  try {
    const rawUser = localStorage.getItem('user') || localStorage.getItem('fantasy_user');
    if (rawUser) {
      const u = JSON.parse(rawUser);
      if (u.name || u.nombre) localManagerName = u.name || u.nombre;
      if (u.ranking) localRank = `#${u.ranking}`;
    }
  } catch (e) { }

  if (homeNameEl) homeNameEl.textContent = homeSquad.name || 'Tu Equipo';
  if (homeManagerEl) homeManagerEl.textContent = localManagerName;
  if (homeOvrEl) homeOvrEl.textContent = `${homeStats.ovr} OVR`;
  if (homeRankEl) homeRankEl.textContent = `★ Rank: ${localRank}`;

  // Datos del rival
  const awayNameEl = document.getElementById('rival-name') || document.getElementById('away-team-name');
  const awayManagerEl = document.getElementById('rival-owner') || document.getElementById('away-manager-name');
  const awayOvrEl = document.getElementById('rival-ovr') || document.getElementById('away-team-ovr');
  const awayRankEl = document.getElementById('rival-rank') || document.getElementById('away-team-rank');

  const rivalRankNumber = Math.floor(Math.random() * 80) + 390;

  if (awayNameEl) awayNameEl.textContent = awaySquad.name;
  if (awayManagerEl) awayManagerEl.textContent = `Míster ${awaySquad.name.split(' ')[0]}`;
  if (awayOvrEl) awayOvrEl.textContent = `${awayStats.ovr} OVR`;
  if (awayRankEl) awayRankEl.textContent = `★ Rank: #${rivalRankNumber}`;

  // ID aleatorio de Sala
  const roomEl = document.getElementById('matchmaking-room-id');
  if (roomEl) {
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    roomEl.textContent = `SALA #${randomHex}-A`;
  }
}

/**
 * Renderiza la Comparativa Táctica
 */
function renderTacticalComparison(homeStats, awayStats, homeSquad, awaySquad) {
  const metrics = [
    { id: 'ovr', key: 'rating', home: homeStats.ovr, away: awayStats.ovr },
    { id: 'att', key: 'ataque', home: homeStats.ataque, away: awayStats.ataque },
    { id: 'cre', key: 'creacion', home: homeStats.creacion, away: awayStats.creacion },
    { id: 'def', key: 'defensa', home: homeStats.defensa, away: awayStats.defensa },
    { id: 'fis', key: 'fisico', home: homeStats.fisico, away: awayStats.fisico }
  ];

  metrics.forEach(m => {
    // Valores numéricos (busca por ID nuevo o viejo)
    const homeValEl = document.getElementById(`stat-user-${m.key}`) || document.getElementById(`stat-val-home-${m.id}`);
    const awayValEl = document.getElementById(`stat-rival-${m.key}`) || document.getElementById(`stat-val-away-${m.id}`);

    if (homeValEl) homeValEl.textContent = m.home;
    if (awayValEl) awayValEl.textContent = m.away;

    // Barras de progreso
    const homeBarEl = document.getElementById(`bar-user-${m.key}`) || document.getElementById(`bar-home-${m.id}`);
    const awayBarEl = document.getElementById(`bar-rival-${m.key}`) || document.getElementById(`bar-away-${m.id}`);

    setTimeout(() => {
      if (homeBarEl) {
        homeBarEl.style.width = `${Math.min(100, Math.max(10, m.home))}%`;
      }
      if (awayBarEl) {
        awayBarEl.style.width = `${Math.min(100, Math.max(10, m.away))}%`;
      }
    }, 150);
  });

  // Factor táctico dinámico
  renderDynamicTacticalFactor(homeStats, awayStats, homeSquad, awaySquad);
}

/**
 * Ejecuta la secuencia progresiva de matchmaking, detiene el spinner y activa el botón
 */
function startMatchmakingSequence(awaySquad, router) {
  const spinnerEl = document.querySelector('.pulse-spinner');
  const progressBar = document.getElementById('matchmaking-progress-bar');
  const titleEl = document.getElementById('status-title') || document.getElementById('countdown-text');
  const subEl = document.querySelector('.match-found-desc') || document.getElementById('countdown-subtitle');
  const btnStart = document.getElementById('btn-start-match');

  // Estado inicial de búsqueda
  if (spinnerEl) spinnerEl.classList.remove('is-stopped');
  if (progressBar) progressBar.style.width = '25%';
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.style.opacity = '0.75';
    btnStart.innerHTML = `<span>BUSCANDO RIVAL...</span>`;
  }

  // Configurar evento de clic en el botón de empezar partido
  if (btnStart) {
    btnStart.onclick = (e) => {
      e.preventDefault();
      if (btnStart.disabled) return;
      btnStart.disabled = true;
      btnStart.innerHTML = `<span>INICIANDO PARTIDO...</span>`;
      redirectToLiveMatch(router);
    };
  }

  // Secuencia (900ms): Detener spinner, confirmar rival y habilitar botón
  matchmakingTimer = setTimeout(() => {
    // 1. Detener el giro del spinner
    if (spinnerEl) spinnerEl.classList.add('is-stopped');
    if (progressBar) progressBar.style.width = '100%';

    // 2. Textos confirmados
    if (titleEl) {
      titleEl.textContent = `¡Rival encontrado: ${awaySquad.name}!`;
    }
    if (subEl) {
      subEl.textContent = 'Alineaciones confirmadas. Pulsa abajo para dar el pitido inicial.';
    }

    // 3. Activar botón de inicio
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.style.opacity = '1';
      btnStart.innerHTML = `<span>¡EMPEZAR PARTIDO!</span> <span class="arrow-icon">▶</span>`;
    }
  }, 900);
}

/**
 * Redirige fluidamente a la pantalla del partido en directo
 */
function redirectToLiveMatch(router) {
  if (navigationExecuted) return;
  navigationExecuted = true;
  clearExistingTimers();

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
 * Renderiza el factor táctico dinámico analizando diferencias estadísticas
 */
function renderDynamicTacticalFactor(homeStats, awayStats, homeSquad, awaySquad) {
  const container = document.getElementById('tactical-insight-box') || document.getElementById('matchmaking-tactical-factor');
  const textEl = document.getElementById('insight-text') || document.getElementById('matchmaking-factor-text');

  if (!textEl) return;

  const analysis = calculateTacticalFactor(homeStats, awayStats, homeSquad, awaySquad);
  textEl.innerHTML = analysis.text;

  if (container) {
    container.classList.remove('is-favorable', 'is-warning', 'is-neutral');
    container.classList.add(`is-${analysis.type}`);
  }
}

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

  if (isTacticalCounter(homeForm, awayForm)) {
    const homeFormName = FORMATIONS_6V6[homeForm]?.shortName || homeForm;
    const awayFormName = FORMATIONS_6V6[awayForm]?.shortName || awayForm;
    return {
      type: 'favorable',
      text: `<strong>¡Counter táctico favorable!</strong> Tu esquema ${homeForm} (${homeFormName}) neutraliza la formación ${awayForm} rival.`
    };
  }

  if (isTacticalCounter(awayForm, homeForm)) {
    const awayFormName = FORMATIONS_6V6[awayForm]?.shortName || awayForm;
    return {
      type: 'warning',
      text: `<strong>Alerta táctica:</strong> El rival plantea ${awayForm} (${awayFormName}), diseñada para bloquear los circuitos de tu ${homeForm}.`
    };
  }

  if (potOfensivaLocal >= 5) {
    return {
      type: 'favorable',
      text: `<strong>Ventaja ofensiva:</strong> Tu delantera (${homeStats.ataque}) supera la zaga rival (${awayStats.defensa}) por +${potOfensivaLocal} pts.`
    };
  }

  if (potOfensivaRival >= 5) {
    return {
      type: 'warning',
      text: `<strong>Peligro rival:</strong> El ataque rival (${awayStats.ataque}) exigirá máxima concentración a tu defensa (${homeStats.defensa}).`
    };
  }

  if (diffCre >= 4) {
    return {
      type: 'favorable',
      text: `<strong>Control de la medular:</strong> Mayor volumen de creación y precisión (+${diffCre} pts) para dictar el ritmo.`
    };
  }

  if (diffCre <= -4) {
    return {
      type: 'warning',
      text: `<strong>Presión en el centro:</strong> El rival cuenta con mejor circuito creativo (+${Math.abs(diffCre)} pts).`
    };
  }

  if (diffDef >= 5) {
    return {
      type: 'favorable',
      text: `<strong>Solidez táctica:</strong> Tu cerrojo defensivo supera al del rival (+${diffDef} pts).`
    };
  }

  if (diffDef <= -5) {
    return {
      type: 'warning',
      text: `<strong>Muralla rival:</strong> El oponente presenta un bloque defensivo muy compacto (+${Math.abs(diffDef)} pts).`
    };
  }

  if (diffFis >= 5) {
    return {
      type: 'favorable',
      text: `<strong>Poderío físico:</strong> Mayor potencia (+${diffFis} pts) para imponerse en balones divididos.`
    };
  }

  if (diffOvr >= 3) {
    return {
      type: 'favorable',
      text: `<strong>Favorito en los papeles:</strong> Tu plantilla promedia mayor calidad global (+${diffOvr} OVR).`
    };
  }

  return {
    type: 'neutral',
    text: `<strong>Duelo parejo:</strong> Máxima paridad (${homeStats.ovr} vs ${awayStats.ovr} OVR). Se definirá en detalles y efectividad.`
  };
}

// Fallback por si la pantalla se carga fuera del router SPA
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('btn-start-match')) {
    initMatchmaking(window.router);
  }
});