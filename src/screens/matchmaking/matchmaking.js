
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
import { getUnifiedLeaderboard, getUserRankInfo } from '../../services/ranking-service.js';
import { API_BASE_URL } from '../../services/api-client.js';

let matchmakingTimer = null;
let navigationExecuted = false;
let activeSearchId = 0;

function normalizeManagerAvatarOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/uploads/')) {
    const apiOrigin = (API_BASE_URL || '').replace(/\/api\/?$/, '');
    return `${apiOrigin}${trimmed}`;
  }
  return trimmed;
}

function resolveManagerAvatarUrl(managerData) {
  let localAvatar = null;
  let localUser = null;
  let authToken = '';
  try {
    localAvatar = localStorage.getItem('user_avatar') || null;
    const rawUser = localStorage.getItem('user') || localStorage.getItem('fantasy_logged_user');
    if (rawUser) localUser = JSON.parse(rawUser);
    authToken = localStorage.getItem('access_token') || localStorage.getItem('auth_token') || '';
  } catch (_) { }

  const localUserAvatar =
    localUser?.avatar_url ||
    localUser?.avatarUrl ||
    localUser?.photo_url ||
    localUser?.profile_picture ||
    null;
  const remoteAvatar =
    managerData?.avatarUrl ||
    managerData?.avatar_url ||
    managerData?.photo_url ||
    managerData?.profile_picture ||
    null;

  if (localAvatar && localAvatar.startsWith('data:image/')) {
    return localAvatar;
  }

  return (
    normalizeManagerAvatarOrigin(localAvatar) ||
    normalizeManagerAvatarOrigin(localUserAvatar) ||
    normalizeManagerAvatarOrigin(remoteAvatar) ||
    null
  );
}

function renderUserAvatarElement(containerEl, avatarUrl, fallbackName = 'Usuario') {
  if (!containerEl) return;
  const defaultSvg = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="32" height="32" aria-hidden="true">
      <path d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
  if (avatarUrl) {
    containerEl.innerHTML = `<img src="${avatarUrl}" alt="Avatar de ${fallbackName}" class="avatar-circle-img" referrerpolicy="no-referrer" onerror="this.outerHTML='<svg viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'1.8\\' width=\\'32\\' height=\\'32\\'><path d=\\'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\'/></svg>'" />`;
  } else {
    containerEl.innerHTML = defaultSvg;
  }
}

/**
 * Inicializador principal llamado por el Router SPA
 * @param {Object} router - Instancia del router
 */
export async function initMatchmaking(router) {
  const btnStartCheck = document.getElementById('btn-start-match');
  if (btnStartCheck && btnStartCheck.dataset.mmInit === '1') {
    return;
  }
  if (btnStartCheck) {
    btnStartCheck.dataset.mmInit = '1';
  }

  const searchId = ++activeSearchId;
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

  // 2. Estado inicial: solo datos propios; el rival queda en "buscando" sin datos ficticios
  const homeStats = calculateTeamMetrics(homeSquad);
  renderSearchingState(homeSquad, homeStats);
  setupStartButton(router);
  const searchStartedAt = Date.now();

  // 3. Obtener un rival real de los usuarios registrados en el backend
  let awaySquad = null;
  try {
    const userRaw = localStorage.getItem('user') || localStorage.getItem('fantasy_logged_user');
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
          userId: picked.user_id,
          user_id: picked.user_id,
          owner: picked.owner || picked.manager_name,
          manager_name: picked.manager_name || picked.owner,
          avatarUrl: picked.avatar_url || picked.avatarUrl || picked.photo_url || picked.profile_picture || null,
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
  if (searchId !== activeSearchId) return;

  if (!awaySquad) {
    awaySquad = getRandomCpuTeam();
  }

  // Guardar en sessionStorage para que el Live Match dispute el encuentro exactamente con este rival
  sessionStorage.setItem('fantasy_selected_rival', JSON.stringify(awaySquad));
  sessionStorage.setItem('fantasy_match_autoplay', 'true');

  // 4. Garantizar un tiempo mínimo de búsqueda para que la animación sea perceptible
  const MIN_SEARCH_MS = 900;
  const elapsed = Date.now() - searchStartedAt;
  if (elapsed < MIN_SEARCH_MS) {
    await new Promise(resolve => { matchmakingTimer = setTimeout(resolve, MIN_SEARCH_MS - elapsed); });
  }
  if (searchId !== activeSearchId || navigationExecuted || !document.getElementById('btn-start-match')) return;

  // 5. Rival encontrado: recién ahora se revelan sus datos
  const awayStats = calculateTeamMetrics(awaySquad);
  await renderVersusHeader(homeSquad, awaySquad, homeStats, awayStats);
  if (searchId !== activeSearchId || navigationExecuted || !document.getElementById('btn-start-match')) return;
  renderTacticalComparison(homeStats, awayStats, homeSquad, awaySquad);
  revealRivalFound(awaySquad);
}

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
  const hasExhaustedStarters = starters.some(p => {
    const raw = p?.energia ?? p?.stamina;
    if (raw === undefined || raw === null || raw === '') return false;
    const num = Number(raw);
    return !isNaN(num) && num === 0;
  });
  return starters.length === 6 && reserves.length === 4 && !hasExhaustedStarters;
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

async function renderVersusHeader(homeSquad, awaySquad, homeStats, awayStats) {
  // Datos locales (Soporta IDs de ambas plantillas)
  const homeNameEl = document.getElementById('user-name') || document.getElementById('home-team-name');
  const homeManagerEl = document.getElementById('user-owner') || document.getElementById('home-manager-name');
  const homeOvrEl = document.getElementById('user-ovr') || document.getElementById('home-team-ovr');
  const homeRankEl = document.getElementById('user-rank') || document.getElementById('home-team-rank');

  let localManagerName = 'Tú';
  let localRank = '-';

  // Datos del rival
  const awayNameEl = document.getElementById('rival-name') || document.getElementById('away-team-name');
  const awayManagerEl = document.getElementById('rival-owner') || document.getElementById('away-manager-name');
  const awayOvrEl = document.getElementById('rival-ovr') || document.getElementById('away-team-ovr');
  const awayRankEl = document.getElementById('rival-rank') || document.getElementById('away-team-rank');

  let awayManagerName = awaySquad.owner || awaySquad.manager_name || `Míster ${awaySquad.name?.split(' ')[0] || 'Rival'}`;
  let awayRank = '-';

  try {
    const rawUser = localStorage.getItem('user') || localStorage.getItem('fantasy_logged_user') || localStorage.getItem('fantasy_user');
    const savedUser = rawUser ? JSON.parse(rawUser) : {};
    const teamName = localStorage.getItem('team_name') || savedUser.team_name || homeSquad.name || 'Tu Equipo';

    if (savedUser.name || savedUser.nombre) {
      localManagerName = savedUser.name || savedUser.nombre;
    } else if (savedUser.first_name) {
      localManagerName = `${savedUser.first_name} ${savedUser.last_name || ''}`.trim();
    }

    // Obtenemos la tabla global unificada desde TiDB Cloud mediante el servicio
    const combinedEntries = await getUnifiedLeaderboard();

    // Verificamos si el usuario ya disputó partidos buscando su entrada unificada (por ID, email o club)
    const myEntry = combinedEntries.find(e =>
      (savedUser?.id && e.userId && Number(e.userId) === Number(savedUser.id)) ||
      (savedUser?.email && e.email && e.email.toLowerCase() === savedUser.email.toLowerCase()) ||
      (teamName && e.team_name && e.team_name.toLowerCase() === teamName.toLowerCase())
    );

    let rawStats = null;
    try {
      const raw = localStorage.getItem('fantasy_user_stats');
      if (raw) rawStats = JSON.parse(raw);
    } catch (_) {}

    const hasPlayed = Boolean(
      (myEntry && myEntry.has_played) ||
      (rawStats && rawStats.matchesPlayed > 0) ||
      (savedUser && savedUser.partidos_jugados > 0)
    );

    // Calculamos el rank exacto utilizando la misma función oficial del ranking global
    const rankInfo = getUserRankInfo(combinedEntries, savedUser, teamName, hasPlayed);
    if (rankInfo && rankInfo.displayRank) {
      localRank = rankInfo.displayRank; // Ej: "#1", "#3", o "-" si no ha jugado
    }

    // Buscamos la posición real y mánager del rival en el ranking unificado
    const rivalEntry = combinedEntries.find(e =>
      (awaySquad?.userId && e.userId && Number(e.userId) === Number(awaySquad.userId)) ||
      (awaySquad?.user_id && e.userId && Number(e.userId) === Number(awaySquad.user_id)) ||
      (awaySquad?.name && e.team_name && e.team_name.toLowerCase().trim() === awaySquad.name.toLowerCase().trim()) ||
      (awaySquad?.owner && e.manager_name && e.manager_name.toLowerCase().trim() === awaySquad.owner.toLowerCase().trim()) ||
      (awaySquad?.manager_name && e.manager_name && e.manager_name.toLowerCase().trim() === awaySquad.manager_name.toLowerCase().trim())
    );

    if (rivalEntry) {
      if (rivalEntry.manager_name) {
        awayManagerName = rivalEntry.manager_name;
      }
      if (rivalEntry.rank) {
        awayRank = `#${rivalEntry.rank}`;
      } else if (rivalEntry.has_played === false) {
        awayRank = '-';
      }
    }
  } catch (e) {
    console.debug('[Matchmaking] Error obteniendo el rank real del usuario o rival:', e);
  }

  if (homeNameEl) homeNameEl.textContent = homeSquad.name || 'Tu Equipo';
  if (homeManagerEl) homeManagerEl.textContent = localManagerName;
  if (homeOvrEl) homeOvrEl.textContent = `${homeStats.ovr} OVR`;
  if (homeRankEl) homeRankEl.textContent = `★ Rank: ${localRank}`;

  // Renderizar avatar del usuario
  const userAvatarUrl = resolveManagerAvatarUrl();
  const userAvatarCircle = document.getElementById('user-avatar-circle') || document.querySelector('.team-user .avatar-circle');
  renderUserAvatarElement(userAvatarCircle, userAvatarUrl, localManagerName);

  if (awayNameEl) awayNameEl.textContent = awaySquad.name;
  if (awayManagerEl) awayManagerEl.textContent = awayManagerName;
  if (awayOvrEl) awayOvrEl.textContent = `${awayStats.ovr} OVR`;
  if (awayRankEl) awayRankEl.textContent = `★ Rank: ${awayRank}`;

  // Renderizar avatar del rival
  const rivalAvatarCircle = document.getElementById('rival-avatar-circle') || document.querySelector('.team-rival .avatar-circle');
  const rivalAvatarUrl = awaySquad.avatarUrl || awaySquad.avatar_url || awaySquad.photo_url || awaySquad.profile_picture || null;
  renderUserAvatarElement(rivalAvatarCircle, rivalAvatarUrl, awaySquad.name || 'Rival');

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
 * Pinta los datos propios y deja todo lo del rival en estado neutro de búsqueda
 */
function renderSearchingState(homeSquad, homeStats) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('user-name', homeSquad.name || 'Tu Equipo');
  set('user-ovr', `${homeStats.ovr} OVR`);
  const userMap = { rating: homeStats.ovr, ataque: homeStats.ataque, creacion: homeStats.creacion, defensa: homeStats.defensa, fisico: homeStats.fisico };
  Object.entries(userMap).forEach(([k, v]) => {
    set(`stat-user-${k}`, v);
    const bar = document.getElementById(`bar-user-${k}`);
    if (bar) bar.style.width = `${Math.min(100, Math.max(10, v))}%`;
    set(`stat-rival-${k}`, '--');
    const rbar = document.getElementById(`bar-rival-${k}`);
    if (rbar) rbar.style.width = '0%';
  });

  set('rival-ovr', '-- OVR');
  set('rival-name', 'Buscando...');
  set('rival-owner', 'Esperando rival');
  set('rival-rank', '★ Rank: -');
  document.getElementById('team-rival')?.classList.add('is-searching');

  // Renderizar avatar del usuario y limpiar avatar rival mientras busca
  const userAvatarUrl = resolveManagerAvatarUrl();
  const userAvatarCircle = document.getElementById('user-avatar-circle') || document.querySelector('.team-user .avatar-circle');
  renderUserAvatarElement(userAvatarCircle, userAvatarUrl, homeSquad.name || 'Tú');

  const rivalAvatarCircle = document.getElementById('rival-avatar-circle') || document.querySelector('.team-rival .avatar-circle');
  renderUserAvatarElement(rivalAvatarCircle, null, 'Rival');

  const box = document.getElementById('tactical-insight-box');
  if (box) {
    box.classList.remove('is-favorable', 'is-warning');
    box.classList.add('is-neutral');
  }
  const insight = document.getElementById('insight-text');
  if (insight) insight.textContent = 'Analizando emparejamiento táctico...';

  document.querySelector('.pulse-spinner')?.classList.remove('is-stopped');
  set('status-title', 'Buscando rival en Liga de Leyendas...');
  set('status-desc', 'Escaneando plantillas registradas...');
  const progressBar = document.getElementById('matchmaking-progress-bar');
  if (progressBar) progressBar.style.width = '25%';
}

function setupStartButton(router) {
  const btnStart = document.getElementById('btn-start-match');
  if (!btnStart) return;
  btnStart.disabled = true;
  btnStart.innerHTML = `<span>BUSCANDO RIVAL...</span>`;
  btnStart.onclick = (e) => {
    e.preventDefault();
    if (btnStart.disabled) return;
    btnStart.disabled = true;
    btnStart.innerHTML = `<span>INICIANDO PARTIDO...</span>`;
    redirectToLiveMatch(router);
  };
}

/**
 * Confirma el rival: detiene el spinner, actualiza el estado y habilita el botón
 */
function revealRivalFound(awaySquad) {
  document.getElementById('team-rival')?.classList.remove('is-searching');
  document.querySelector('.pulse-spinner')?.classList.add('is-stopped');
  const progressBar = document.getElementById('matchmaking-progress-bar');
  if (progressBar) progressBar.style.width = '100%';
  const title = document.getElementById('status-title');
  if (title) title.textContent = `¡Rival encontrado: ${awaySquad.name}!`;
  const desc = document.getElementById('status-desc');
  if (desc) desc.textContent = 'Alineaciones confirmadas. Pulsa abajo para dar el pitido inicial.';

  // Actualizar avatar del rival encontrado
  const rivalAvatarCircle = document.getElementById('rival-avatar-circle') || document.querySelector('.team-rival .avatar-circle');
  const rivalAvatarUrl = awaySquad.avatarUrl || awaySquad.avatar_url || awaySquad.photo_url || awaySquad.profile_picture || null;
  renderUserAvatarElement(rivalAvatarCircle, rivalAvatarUrl, awaySquad.name || 'Rival');

  const btnStart = document.getElementById('btn-start-match');
  if (btnStart) {
    btnStart.disabled = false;
    btnStart.innerHTML = `<span>¡EMPEZAR PARTIDO!</span> <span class="arrow-icon">▶</span>`;
  }
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
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('btn-start-match')) {
      initMatchmaking(window.router);
    }
  });
}