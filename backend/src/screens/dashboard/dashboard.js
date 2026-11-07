const STORAGE_URL = 'https://jkdrdrdggclbjatzbpev.supabase.co/storage/v1/object/public/players/';
import { FORMATIONS_6V6 } from '../../domain/formation-rules.js';
import { apiClient } from '../../services/api-client.js?v=50';
import { squadService } from '../../services/squad-service.js?v=50';
import { getPlayerRating, getPlayerPrice } from '../lineup/lineup.js?v=50';

const DASHBOARD_PLAYER_IMAGE_ALIASES = {
  messi: 'lionel_messi.webp',
  'l. messi': 'lionel_messi.webp',
  'lionel messi': 'lionel_messi.webp',
  zidane: 'zinedine_zidane.webp',
  'z. zidane': 'zinedine_zidane.webp',
  'zinedine zidane': 'zinedine_zidane.webp',
  maldini: 'paolo_maldini.webp',
  'p. maldini': 'paolo_maldini.webp',
  'paolo maldini': 'paolo_maldini.webp',
  xavi: 'xavi_hernandez.webp',
  'xavi hernandez': 'xavi_hernandez.webp',
  iniesta: 'andres_iniesta.webp',
  'a. iniesta': 'andres_iniesta.webp',
  'andres iniesta': 'andres_iniesta.webp',
  ronaldo: 'ronaldo_nazario.webp',
  'r. nazario': 'ronaldo_nazario.webp',
  'ronaldo nazario': 'ronaldo_nazario.webp',
  'cristiano ronaldo': 'cristiano_ronaldo.webp',
  'c. ronaldo': 'cristiano_ronaldo.webp',
  casillas: 'iker_casillas.webp',
  'i. casillas': 'iker_casillas.webp',
  'iker casillas': 'iker_casillas.webp',
  buffon: 'gianluigi_buffon.webp',
  'g. buffon': 'gianluigi_buffon.webp',
  'gianluigi buffon': 'gianluigi_buffon.webp',
  beckenbauer: 'franz_beckenbauer.webp',
  'f. beckenbauer': 'franz_beckenbauer.webp',
  'franz beckenbauer': 'franz_beckenbauer.webp',
  maradona: 'diego_maradona.webp',
  'd. maradona': 'diego_maradona.webp',
  'diego maradona': 'diego_maradona.webp',
  cruyff: 'johan_cruyff.webp',
  'j. cruyff': 'johan_cruyff.webp',
  'johan cruyff': 'johan_cruyff.webp',
  pirlo: 'andrea_pirlo.webp',
  'a. pirlo': 'andrea_pirlo.webp',
  'andrea pirlo': 'andrea_pirlo.webp',
  pele: 'pele.webp',
  henry: 'thierry_henry.webp',
  't. henry': 'thierry_henry.webp',
  'thierry henry': 'thierry_henry.webp',
  'roberto carlos': 'roberto_carlos.webp',
  'r. carlos': 'roberto_carlos.webp',
  kahn: 'oliver_kahn.webp',
  'o. kahn': 'oliver_kahn.webp',
  'oliver kahn': 'oliver_kahn.webp',
  baresi: 'franco_baresi.webp',
  'f. baresi': 'franco_baresi.webp',
  'franco baresi': 'franco_baresi.webp',
  puyol: 'carles_puyol.webp',
  'c. puyol': 'carles_puyol.webp',
  'carles puyol': 'carles_puyol.webp'
};

function resolveDashboardPlayerAvatarUrl(player) {
  if (!player) return null;
  const rawImg = player.image_filename || player.photo_url || player.avatarUrl || '';
  if (rawImg) {
    return rawImg.startsWith('http://') || rawImg.startsWith('https://') || rawImg.startsWith('/')
      ? rawImg
      : `${STORAGE_URL}${rawImg}`;
  }

  const normalized = String(player.name || player.nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!normalized) return null;
  if (DASHBOARD_PLAYER_IMAGE_ALIASES[normalized]) {
    return `${STORAGE_URL}${DASHBOARD_PLAYER_IMAGE_ALIASES[normalized]}`;
  }

  const slug = normalized.replace(/[^a-z0-9\s_]/g, '').replace(/\s+/g, '_');
  return slug ? `${STORAGE_URL}${slug}.webp` : null;
}
/**
 * @file dashboard.js
 * @description Módulo controlador para la vista principal (Dashboard / Inicio) de Fantasy de Leyendas.
 * Gestiona el renderizado dinámico de métricas, plantilla, MVP y la integración con el backend FastAPI.
 *
 * @exports { initDashboard, initHomeView, renderDashboard, renderHome, DEFAULT_HOME_DATA }
 */

/**
 * Datos por defecto alineados con el prototipo visual de la aplicación.
 * Sirven como estado inicial y fallback seguro en caso de desconexión o desarrollo offline.
 */
export const DEFAULT_HOME_DATA = {
  manager: {
    name: 'Nombre del Mánager',
    season: 'Temporada 24 / 25',
    ranking: 450,
    avatarUrl: null
  },
  budget: {
    spent: 0.0,
    available: 150.0,
    total: 150.0,
    percentage: 0
  },
  valGlobal: 0,
  formation: '1-2-2-1',
  startersCount: 0,
  reservesCount: 0,
  totalPlayers: 0,
  mvp: {
    name: 'Sin MVP asignado',
    tag: 'MVP',
    position: 'Ficha en el mercado',
    matches: 0,
    goals: 0,
    score: '-',
    maxScore: 10,
    avatarUrl: null
  },
  team: {
    count: 0,
    max: 6,
    slots: [
      { slotIndex: 0, assignedRole: 'POR', player: null, avatarUrl: null },
      { slotIndex: 1, assignedRole: 'DEF', player: null, avatarUrl: null },
      { slotIndex: 2, assignedRole: 'DEF', player: null, avatarUrl: null },
      { slotIndex: 3, assignedRole: 'MC', player: null, avatarUrl: null },
      { slotIndex: 4, assignedRole: 'MC', player: null, avatarUrl: null },
      { slotIndex: 5, assignedRole: 'DEL', player: null, avatarUrl: null }
    ],
    players: []
  },
  streak: {
    lastMatch: {
      result: 'V',
      scoreText: 'V 2 – 1',
      opponent: 'vs MánagerX'
    },
    recentResults: ['V', 'V', 'D', 'E', 'V']
  }
};

/**
 * Puebla dinámicamente los elementos del DOM de la pantalla de inicio con los datos proporcionados.
 * @param {typeof DEFAULT_HOME_DATA} data - Objeto con los datos consolidados de la pantalla.
 */
export function renderHome(data = DEFAULT_HOME_DATA) {
  try {
    // 1. Datos del Mánager y Clasificación
    const managerNameEl = document.getElementById('manager-name');
    if (managerNameEl && data.manager?.name) {
      managerNameEl.textContent = data.manager.name;
    }

    const managerSeasonEl = document.getElementById('manager-season');
    if (managerSeasonEl && data.manager?.season) {
      managerSeasonEl.textContent = data.manager.season;
    }

    const rankingValueEl = document.getElementById('ranking-value');
    if (rankingValueEl && data.manager?.ranking !== undefined) {
      rankingValueEl.textContent = `#${data.manager.ranking}`;
    }

    const managerAvatarEl = document.getElementById('manager-avatar');
    if (managerAvatarEl && data.manager?.avatarUrl) {
      managerAvatarEl.innerHTML = `<img src="${data.manager.avatarUrl}" alt="${data.manager.name}" class="avatar-img">`;
    }

    // 2. Presupuesto y Barra de Progreso
    const budgetSpentEl = document.getElementById('budget-spent');
    if (budgetSpentEl && data.budget?.spent !== undefined) {
      budgetSpentEl.textContent = `${Number(data.budget.spent).toFixed(1)}M`;
    }

    const budgetAvailableEl = document.getElementById('budget-available');
    if (budgetAvailableEl && data.budget?.available !== undefined) {
      budgetAvailableEl.textContent = `${Number(data.budget.available).toFixed(1)}M`;
    }

    const budgetPercentEl = document.getElementById('budget-percentage');
    const budgetBarEl = document.getElementById('budget-progress-bar');
    const budgetContainerEl = document.getElementById('budget-progress-container');
    const budgetLimitEl = document.getElementById('budget-limit-text');

    if (budgetLimitEl) {
      budgetLimitEl.textContent = `Límite: ${data.budget?.total || 150}M`;
    }

    const percentage = data.budget?.percentage ?? Math.round((data.budget?.spent / (data.budget?.total || 150)) * 100);

    if (budgetPercentEl) {
      budgetPercentEl.textContent = `${percentage}%`;
    }
    if (budgetBarEl) {
      budgetBarEl.style.width = `${Math.min(Math.max(percentage, 0), 100)}%`;
    }
    if (budgetContainerEl) {
      budgetContainerEl.setAttribute('aria-valuenow', percentage.toString());
    }

    // Formación e Información de Alineación en Budget Card
    const formationBadgeEl = document.getElementById('budget-formation-badge');
    if (formationBadgeEl && data.formation) {
      formationBadgeEl.textContent = data.formation;
    }

    const lineupStatusEl = document.getElementById('budget-lineup-status');
    if (lineupStatusEl) {
      const starters = data.startersCount ?? 0;
      const reserves = data.reservesCount ?? 0;
      if (starters < 6 || reserves < 4) {
        lineupStatusEl.textContent = `Alineación: ${starters}/6 Titulares • ${reserves}/4 Suplentes`;
        lineupStatusEl.classList.add('is-incomplete');
      } else {
        lineupStatusEl.textContent = `Alineación: ${starters} Titulares • ${reserves} Suplentes`;
        lineupStatusEl.classList.remove('is-incomplete');
      }
    }

    // 3. Valoración Global
    const valGlobalEl = document.getElementById('val-global-value');
    if (valGlobalEl && data.valGlobal !== undefined) {
      valGlobalEl.textContent = data.valGlobal.toString();
    }

    // 4. Sección MVP
    const mvpNameEl = document.getElementById('mvp-name');
    if (mvpNameEl && data.mvp?.name) {
      mvpNameEl.textContent = data.mvp.name;
    }

    const mvpTagEl = document.getElementById('mvp-tag');
    if (mvpTagEl && data.mvp?.tag) {
      mvpTagEl.textContent = data.mvp.tag;
    }

    const mvpPosEl = document.getElementById('mvp-pos');
    if (mvpPosEl && data.mvp?.position) {
      mvpPosEl.textContent = data.mvp.position;
    }

    const mvpScoreEl = document.getElementById('mvp-score');
    if (mvpScoreEl) {
      if (data.mvp?.score !== undefined && data.mvp?.score !== null && data.mvp?.score !== '-') {
        const num = Number(data.mvp.score);
        mvpScoreEl.textContent = !isNaN(num) && num > 0 ? num.toFixed(1) : '-';
      } else {
        mvpScoreEl.textContent = '-';
      }
    }

    const mvpMatchesEl = document.getElementById('mvp-matches');
    if (mvpMatchesEl) {
      mvpMatchesEl.textContent = (data.mvp?.matches ?? 0).toString();
    }

    const mvpGoalsEl = document.getElementById('mvp-goals');
    if (mvpGoalsEl) {
      mvpGoalsEl.textContent = (data.mvp?.goals ?? 0).toString();
    }

    const mvpAvatarEl = document.getElementById('mvp-avatar');
    if (mvpAvatarEl) {
      if (data.mvp?.avatarUrl) {
        mvpAvatarEl.innerHTML = `<img src="${data.mvp.avatarUrl}" alt="${data.mvp.name}" onerror="this.outerHTML='<svg class=\\'mvp-avatar-icon\\' viewBox=\\'0 0 24 24\\' fill=\\'currentColor\\' stroke=\\'none\\' aria-hidden=\\'true\\'><path d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/></svg>'">`;
      } else {
        mvpAvatarEl.innerHTML = `<svg class="mvp-avatar-icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" /></svg>`;
      }
    }

    // 5. Mi Equipo (Grid / Flex de Jugadores con soporte para slots vacíos punteados)
    const teamCountEl = document.getElementById('team-players-count');
    if (teamCountEl && data.team) {
      teamCountEl.textContent = `${data.team.count ?? 0} / ${data.team.max ?? 6} jugadores`;
    }

    const teamSlotsContainer = document.getElementById('team-slots-container');
    if (teamSlotsContainer) {
      const slotsToRender = Array.isArray(data.team?.slots) && data.team.slots.length > 0
        ? data.team.slots
        : (data.team?.players?.length > 0
            ? data.team.players.map((p, i) => ({ slotIndex: i, assignedRole: p.role, player: p, avatarUrl: p.avatarUrl }))
            : [
                { slotIndex: 0, assignedRole: 'POR', player: null },
                { slotIndex: 1, assignedRole: 'DEF', player: null },
                { slotIndex: 2, assignedRole: 'DEF', player: null },
                { slotIndex: 3, assignedRole: 'MC', player: null },
                { slotIndex: 4, assignedRole: 'MC', player: null },
                { slotIndex: 5, assignedRole: 'DEL', player: null }
              ]
          );

      teamSlotsContainer.innerHTML = slotsToRender
        .map((slot) => {
          const assignedRole = (slot.assignedRole || 'MC').toUpperCase();
          const player = slot.player;

          // CASO 1: Slot vacío con líneas punteadas (idéntico al estilo de pitch-slot__token)
          if (!player) {
            return `
              <div class="player-slot player-slot--empty" role="listitem" title="Puesto libre (${assignedRole})">
                <div class="player-slot__avatar player-slot__avatar--empty" data-position="${assignedRole}" aria-label="Puesto libre ${assignedRole}">
                  <span class="player-slot__empty-plus">+</span>
                </div>
                <span class="player-slot__role player-slot__role--empty">${assignedRole}</span>
              </div>
            `;
          }

          // CASO 2: Slot ocupado con jugador ubicado en el pitch-slot
          const naturalRole = (player.role || player.posicion_base || assignedRole).toUpperCase();
          const role = assignedRole.toUpperCase();
          const roleClass = role.toLowerCase();
          const name = player.nombre || player.name || `Jugador ${role}`;
          const rawImg = player.image_filename || player.photo_url || player.avatarUrl || slot.avatarUrl;
          const avatarUrl = rawImg
            ? (rawImg.startsWith('http://') || rawImg.startsWith('https://') ? rawImg : `${STORAGE_URL}${rawImg}`)
            : null;

          return `
            <div class="player-slot player-slot--${roleClass}" role="listitem" title="${name} (${naturalRole}) - ${role}">
              <div class="player-slot__avatar" data-position="${role}" aria-label="${name} - ${role}">
                ${
                  avatarUrl
                    ? `<img src="${avatarUrl}" alt="${name}" onerror="this.outerHTML='<svg class=\'player-slot__icon\' viewBox=\'0 0 24 24\' fill=\'currentColor\' stroke=\'none\' aria-hidden=\'true\'><path d=\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\'/></svg>'">`
                    : `<svg class="player-slot__icon" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>`
                }
              </div>
              <span class="player-slot__role">${role}</span>
            </div>
          `;
        })
        .join('');
    }

    // 6. Racha Reciente (Totalmente dinámica y reactiva desde MySQL)
    const streakResultBadge = document.getElementById('streak-result-badge');
    const streakResultScore = document.getElementById('streak-result-score');
    const streakOpponentEl = document.getElementById('streak-opponent-text');

    if (data.streak?.lastMatch) {
      const res = (data.streak.lastMatch.result || 'V').toUpperCase();
      let colorClass = 'text-win';
      if (res === 'D') colorClass = 'text-loss';
      else if (res === 'E' || res === '-') colorClass = 'text-draw';

      if (streakResultBadge) {
        streakResultBadge.textContent = res;
        streakResultBadge.className = colorClass;
      }

      if (streakResultScore) {
        const rawScore = data.streak.lastMatch.score || '0 – 0';
        streakResultScore.textContent = rawScore.replace('-', '–');
      }

      if (streakOpponentEl) {
        let opp = data.streak.lastMatch.opponent || 'MánagerX';
        if (!opp.startsWith('vs ') && !opp.startsWith('¡')) opp = `vs ${opp}`;
        streakOpponentEl.textContent = opp;
      }
    }

    const streakCirclesContainer = document.getElementById('streak-circles-container');
    if (streakCirclesContainer && Array.isArray(data.streak?.recentResults)) {
      if (data.streak.recentResults.length === 0) {
        streakCirclesContainer.innerHTML = [1, 2, 3, 4, 5]
          .map(() => `<span class="streak-circle streak-circle--draw" title="Sin partido disputado">-</span>`)
          .join('');
      } else {
        streakCirclesContainer.innerHTML = data.streak.recentResults
          .slice(0, 5)
          .map((result) => {
            const normalized = (result || 'V').toUpperCase();
            let modifier = 'streak-circle--win';
            let title = 'Victoria';

            if (normalized === 'D') {
              modifier = 'streak-circle--loss';
              title = 'Derrota';
            } else if (normalized === 'E') {
              modifier = 'streak-circle--draw';
              title = 'Empate';
            }

            return `<span class="streak-circle ${modifier}" title="${title} (${normalized})">${normalized}</span>`;
          })
          .join('');
      }
    }
  } catch (error) {
    console.error('[Dashboard] Error al renderizar la vista Home:', error);
  }
}

export const renderDashboard = renderHome;

/**
 * Consulta los endpoints de backend FastAPI para obtener los datos consolidados.
 * Endpoints configurados:
 * - GET /api/me: Perfil y club del mánager autenticado.
 * - GET /api/analytics/summary: Métricas de rendimiento, valoración y racha de partidos.
 *
 * @returns {Promise<typeof DEFAULT_HOME_DATA>} Datos consolidados para renderizar.
 */
export async function fetchHomeData() {
  const token = localStorage.getItem('access_token') || localStorage.getItem('auth_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };

  let managerData = null;
  let analyticsData = null;

  // 1. Fetch Perfil del Mánager (/api/me) a través del cliente oficial de FastAPI
  try {
    managerData = await apiClient.get('/me');
  } catch (err) {
    console.info('[Dashboard] Modo offline o backend no disponible para /api/me:', err.message);
  }

  // 2. Fetch Resumen Analítico (/api/analytics/summary)
  try {
    analyticsData = await apiClient.get('/analytics/summary');
  } catch (err) {
    console.info('[Dashboard] Modo offline o backend no disponible para analíticas:', err.message);
  }

  // 3. Fusión con persistencia de partidos locales
  let localStats = null;
  let localLastMatch = null;
  try {
    const rawStats = localStorage.getItem('fantasy_user_stats');
    if (rawStats) localStats = JSON.parse(rawStats);
    const rawHistory = localStorage.getItem('fantasy_match_history');
    if (rawHistory) {
      const historyArr = JSON.parse(rawHistory);
      if (Array.isArray(historyArr) && historyArr.length > 0) {
        localLastMatch = historyArr[0];
      }
    }
  } catch (e) {
    console.debug('[Dashboard] Error leyendo datos locales de partidos:', e);
  }

    // 3.5 Lectura de estadisticas acumuladas de jugadores
  let playerStats = {};
  try {
    const rawPlayerStats = localStorage.getItem('fantasy_player_stats');
    if (rawPlayerStats) playerStats = JSON.parse(rawPlayerStats);
  } catch (e) {
    console.debug('[Dashboard] Error leyendo estadisticas locales de jugadores:', e);
  }

  // 4. Lectura y cálculo reactivo de la Alineación y Plantilla Activa (LocalStorage + MySQL /squads/my-squad)
  let activeSquad = null;
  try {
    const rawSquad = localStorage.getItem('fantasy_active_squad');
    if (rawSquad) {
      activeSquad = JSON.parse(rawSquad);
    }
  } catch (e) {
    console.debug('[Dashboard] Error leyendo plantilla activa:', e);
  }

  // Si en localStorage no hay jugadores o queremos sincronizar estadísticas desde MySQL:
  try {
    const remoteRes = await squadService.getMySquad();
    const remotePlayers = Array.isArray(remoteRes?.players) ? remoteRes.players : [];
    const remoteHasPlayers = remotePlayers.some(Boolean);
    const localHasPlayers = Array.isArray(activeSquad?.players) && activeSquad.players.some(Boolean);

    if (remoteHasPlayers || !localHasPlayers) {
      if (remoteHasPlayers) {
        activeSquad = {
          name: remoteRes.name || managerData?.team_name || 'Tu Equipo',
          formation: remoteRes.formation || '1-2-2-1',
          players: remotePlayers
        };
        localStorage.setItem('fantasy_active_squad', JSON.stringify(activeSquad));
      }
    }

    // Sincronizar estadísticas del club desde user_players de MySQL
    if (Array.isArray(remotePlayers)) {
      remotePlayers.forEach((rp) => {
        if (rp && (rp.nombre || rp.name) && (rp.partidos_club > 0 || rp.goles_club > 0 || rp.mvps_club > 0)) {
          const pKey = rp.nombre || rp.name;
          if (!playerStats[pKey] || (rp.partidos_club || 0) >= (playerStats[pKey].matchesPlayed || 0)) {
            playerStats[pKey] = {
              name: pKey,
              matchesPlayed: rp.partidos_club || 0,
              goals: rp.goles_club || 0,
              cleanSheets: rp.vallas_invictas_club || 0,
              mvpAwards: rp.mvps_club || 0,
              avgRating: rp.rating_promedio ?? null
            };
          }
        }
      });
      if (Object.keys(playerStats).length > 0) {
        localStorage.setItem('fantasy_player_stats', JSON.stringify(playerStats));
      }
    }
  } catch (err) {
    console.debug('[Dashboard] Sincronización de plantilla MySQL omitida:', err.message);
  }

  // Garantizar estructura de plantilla de 10 posiciones (0..5 titulares, 6..9 reservas)
  if (!activeSquad || !Array.isArray(activeSquad.players)) {
    activeSquad = {
      name: 'Tu Equipo',
      formation: '1-2-2-1',
      players: new Array(10).fill(null)
    };
  }
  while (activeSquad.players.length < 10) {
    activeSquad.players.push(null);
  }

  const starters = activeSquad.players.slice(0, 6).filter(Boolean);
  const reserves = activeSquad.players.slice(6).filter(Boolean);
  const allSquadPlayers = activeSquad.players.filter(Boolean);

  // Cálculo del presupuesto gastado y disponible (Tope salarial oficial: 150.0M)
  const totalSpent = allSquadPlayers.reduce((acc, p) => acc + getPlayerPrice(p), 0);
  const spentRounded = Math.round(totalSpent * 10) / 10;
  const availableRounded = Math.max(0, Math.round((150.0 - spentRounded) * 10) / 10);
  const budgetPercentage = Math.min(100, Math.round((spentRounded / 150.0) * 100));

  // Cálculo de Valoración Global (media real de los 6 puestos titulares)
  const startersTotalRating = starters.reduce((acc, p) => acc + getPlayerRating(p), 0);
  const calculatedValGlobal = starters.length > 0 ? Math.round(startersTotalRating / 6) : 0;

  // Helper flexible para comparar nombres de jugadores (ej. "L. Messi" y "Messi")
  function isSameName(a, b) {
    if (!a || !b) return false;
    const cleanA = a.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
    const cleanB = b.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
    return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
  }

  function getPlayerStatRecord(playerName) {
    if (!playerName) return null;
    return playerStats[playerName] || Object.values(playerStats).find(v => isSameName(v.name, playerName)) || null;
  }

  // Jugador destacado / MVP: prioriza a futbolistas con partidos disputados, goles y premios MVP oficiales
  const playersWithMatches = allSquadPlayers.filter(p => {
    const s = getPlayerStatRecord(p.name);
    return (s?.matchesPlayed || 0) > 0;
  });

  let topPlayer;
  let topStats;

  if (playersWithMatches.length > 0) {
    topPlayer = [...playersWithMatches].sort((a, b) => {
      const sA = getPlayerStatRecord(a.name) || {};
      const sB = getPlayerStatRecord(b.name) || {};
      const scoreA = (sA.mvpAwards || 0) * 15 + (sA.goals || 0) * 5 + (Number(sA.avgRating) || 0) * 2;
      const scoreB = (sB.mvpAwards || 0) * 15 + (sB.goals || 0) * 5 + (Number(sB.avgRating) || 0) * 2;
      return scoreB - scoreA;
    })[0];
    topStats = getPlayerStatRecord(topPlayer.name);
  } else {
    topPlayer = allSquadPlayers.find(p => p.role === 'DEL') || starters[0] || allSquadPlayers[0];
    topStats = { matchesPlayed: 0, goals: 0, avgRating: null };
  }

  // 5. Mapeo y fusión con el esquema canónico
  const consolidatedData = {
    ...DEFAULT_HOME_DATA,
    manager: {
      ...DEFAULT_HOME_DATA.manager,
      name: managerData?.username || managerData?.name || DEFAULT_HOME_DATA.manager.name,
      season: managerData?.season || DEFAULT_HOME_DATA.manager.season,
      ranking: localStats?.ranking ?? managerData?.ranking ?? DEFAULT_HOME_DATA.manager.ranking
    },
    budget: {
      total: 150.0,
      spent: spentRounded,
      available: availableRounded,
      percentage: budgetPercentage
    },
    valGlobal: calculatedValGlobal,
    formation: activeSquad.formation || '1-2-2-1',
    startersCount: starters.length,
    reservesCount: reserves.length,
    totalPlayers: allSquadPlayers.length,
    team: {
      count: starters.length,
      max: 6,
      slots: [0, 1, 2, 3, 4, 5].map((slotIdx) => {
        const formationSlots = FORMATIONS_6V6[activeSquad.formation]?.slots || ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL'];
        const assignedRole = formationSlots[slotIdx] || 'JUG';
        const p = activeSquad.players[slotIdx];
        if (!p) {
          return { slotIndex: slotIdx, assignedRole, player: null, avatarUrl: null };
        }
        const rawImg = p.image_filename || p.photo_url || p.avatarUrl;
        const avatarUrl = rawImg
          ? (rawImg.startsWith('http://') || rawImg.startsWith('https://') ? rawImg : `${STORAGE_URL}${rawImg}`)
          : null;
        return { slotIndex: slotIdx, assignedRole, player: p, avatarUrl };
      }),
      players: starters.map((p, idx) => ({
        id: p.id || idx + 1,
        name: p.nombre || p.name,
        role: p.role || p.posicion_base,
        rating: getPlayerRating(p),
        avatarUrl: p.image_filename ? (p.image_filename.startsWith('http') ? p.image_filename : `${STORAGE_URL}${p.image_filename}`) : null
      }))
    },
    mvp: topPlayer ? {
      name: topPlayer.name || topPlayer.nombre,
      tag: 'MVP',
      position: (topPlayer.role || topPlayer.posicion_base || 'DEL').toUpperCase(),
      matches: topStats?.matchesPlayed || 0,
      goals: topStats?.goals || 0,
      score: (topStats?.matchesPlayed > 0 && topStats?.avgRating != null)
        ? Number(topStats.avgRating).toFixed(1)
        : '-',
      maxScore: 10,
      avatarUrl: topPlayer.image_filename
        ? (topPlayer.image_filename.startsWith('http') ? topPlayer.image_filename : `${STORAGE_URL}${topPlayer.image_filename}`)
        : (topPlayer.photo_url || topPlayer.avatarUrl || null)
    } : {
      name: 'Sin MVP asignado',
      tag: 'MVP',
      position: 'Ficha en el mercado',
      matches: 0,
      goals: 0,
      score: '-',
      maxScore: 10,
      avatarUrl: null
    },
    streak: {
      ...DEFAULT_HOME_DATA.streak,
      recentResults: (Array.isArray(analyticsData?.streak?.recentResults) && analyticsData.streak.recentResults.length > 0)
        ? analyticsData.streak.recentResults.slice(0, 5)
        : ((localStats?.streak && Array.isArray(localStats.streak) && localStats.streak.length > 0)
            ? localStats.streak.slice(0, 5)
            : (analyticsData?.has_matches === false ? [] : DEFAULT_HOME_DATA.streak.recentResults)),
      lastMatch: analyticsData?.streak?.lastMatch
        ? analyticsData.streak.lastMatch
        : (localLastMatch ? {
            result: localLastMatch.resultado === 'VICTORIA' ? 'V' : (localLastMatch.resultado === 'EMPATE' ? 'E' : 'D'),
            score: localLastMatch.score || '2 – 1',
            scoreText: `${localLastMatch.resultado === 'VICTORIA' ? 'V' : (localLastMatch.resultado === 'EMPATE' ? 'E' : 'D')} ${localLastMatch.score || '2 – 1'}`,
            opponent: localLastMatch.rival ? (localLastMatch.rival.startsWith('vs ') ? localLastMatch.rival : `vs ${localLastMatch.rival}`) : 'vs MánagerX'
          } : (analyticsData?.has_matches === false ? {
            result: '-',
            score: '0 – 0',
            scoreText: '- 0 – 0',
            opponent: '¡Busca tu primer rival!'
          } : DEFAULT_HOME_DATA.streak.lastMatch))
    }
  };

  return consolidatedData;
}

/**
 * Inicializa los eventos de interacción de la pantalla Dashboard.
 * @param {Object} [router] - Instancia de navegación SPA.
 */
/**
 * Valida si la plantilla del usuario cumple con los requisitos para disputar partidos:
 * 6 jugadores titulares en cancha (indices 0 a 5) y 4 suplentes en el banquillo (indices 6 a 9).
 */
export function getLineupValidationStatus() {
  let squad = null;
  try {
    const raw = localStorage.getItem('fantasy_active_squad');
    if (raw) squad = JSON.parse(raw);
  } catch (e) {}

  const players = Array.isArray(squad?.players) ? squad.players : [];
  const starters = players.slice(0, 6).filter(Boolean);
  const reserves = players.slice(6, 10).filter(Boolean);

  const startersCount = starters.length;
  const reservesCount = reserves.length;
  const isValid = startersCount === 6 && reservesCount === 4;

  return {
    isValid,
    startersCount,
    reservesCount,
    missingStarters: 6 - startersCount,
    missingReserves: 4 - reservesCount,
    totalCount: startersCount + reservesCount
  };
}

export function closeLineupRequirementModal() {
  const existing = document.getElementById('lineup-req-modal-overlay');
  if (existing) {
    existing.classList.add('is-closing');
    setTimeout(() => existing.remove(), 160);
  }
}

/**
 * Muestra el modal in-game cuando no se cumplen los requisitos para buscar rival.
 */
export function showLineupRequirementModal(status, router) {
  closeLineupRequirementModal();

  const overlay = document.createElement('div');
  overlay.id = 'lineup-req-modal-overlay';
  overlay.className = 'lineup-req-overlay';

  overlay.innerHTML = `
    <div class="lineup-req-card" role="dialog" aria-modal="true" aria-labelledby="lineup-req-title">
      <div class="lineup-req-icon-wrap" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>

      <h3 class="lineup-req-title" id="lineup-req-title">Alineacion Incompleta</h3>
      <p class="lineup-req-desc">
        Para buscar rival y disputar un partido debes cumplir los requisitos oficiales de tu equipo:
      </p>

      <div class="lineup-req-list">
        <div class="lineup-req-item">
          <span>6 Titulares en cancha</span>
          <span class="lineup-req-badge ${status.startersCount === 6 ? 'lineup-req-badge--complete' : 'lineup-req-badge--incomplete'}">
            ${status.startersCount} / 6 ${status.startersCount === 6 ? 'OK' : `(faltan ${status.missingStarters})`}
          </span>
        </div>
        <div class="lineup-req-item">
          <span>4 Suplentes en banquillo</span>
          <span class="lineup-req-badge ${status.reservesCount === 4 ? 'lineup-req-badge--complete' : 'lineup-req-badge--incomplete'}">
            ${status.reservesCount} / 4 ${status.reservesCount === 4 ? 'OK' : `(faltan ${status.missingReserves})`}
          </span>
        </div>
      </div>

      <div class="lineup-req-actions">
        ${
          status.totalCount > 0 && status.missingStarters > 0
            ? `<button type="button" class="lineup-req-btn lineup-req-btn--primary" id="btn-modal-go-lineup">
                 Configurar en Pizarra
               </button>`
            : `<button type="button" class="lineup-req-btn lineup-req-btn--primary" id="btn-modal-go-market">
                 Fichar en el Mercado
               </button>`
        }
        ${
          status.totalCount > 0 && status.missingStarters > 0
            ? `<button type="button" class="lineup-req-btn lineup-req-btn--secondary" id="btn-modal-go-market">
                 Ir al Mercado a Fichar
               </button>`
            : ''
        }
        <button type="button" class="lineup-req-btn lineup-req-btn--secondary" id="btn-modal-dismiss-req">
          Entendido
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const btnLineup = overlay.querySelector('#btn-modal-go-lineup');
  if (btnLineup) {
    btnLineup.addEventListener('click', () => {
      closeLineupRequirementModal();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/lineup');
      } else if (router && typeof router.navigate === 'function') {
        router.navigate('/lineup');
      } else {
        window.location.hash = '#/lineup';
      }
    });
  }

  const btnMarket = overlay.querySelector('#btn-modal-go-market');
  if (btnMarket) {
    btnMarket.addEventListener('click', () => {
      closeLineupRequirementModal();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/market');
      } else if (router && typeof router.navigate === 'function') {
        router.navigate('/market');
      } else {
        window.location.hash = '#/market';
      }
    });
  }

  const btnDismiss = overlay.querySelector('#btn-modal-dismiss-req');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', closeLineupRequirementModal);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeLineupRequirementModal();
  });
}

export function setupHomeEventListeners(router) {
  // 1. Botón "BUSCAR RIVAL" con animación de Matchmaking
    // 1. Boton "BUSCAR RIVAL" con validacion estricta (6 titulares y 4 suplentes)
  const btnBuscarRival = document.getElementById('btn-buscar-rival');
  if (btnBuscarRival) {
    btnBuscarRival.addEventListener('click', (e) => {
      e.preventDefault();

      // REGLA OFICIAL: Validar que cumpla con 6 titulares en cancha y 4 suplentes en banquillo
      const lineupStatus = getLineupValidationStatus();
      if (!lineupStatus.isValid) {
        showLineupRequirementModal(lineupStatus, router);
        return;
      }

      console.info('[Dashboard] Iniciando emparejamiento para buscar rival...');

      // Animacion de busqueda activa
      btnBuscarRival.disabled = true;
      btnBuscarRival.classList.add('is-searching');
      btnBuscarRival.innerHTML = `
        <span class="spinner-radar" aria-hidden="true"></span>
        <span>BUSCANDO RIVAL...</span>
      `;

      setTimeout(() => {
        if (window.router && typeof window.router.navigate === 'function') {
          window.router.navigate('/matchmaking');
        } else if (router && typeof router.navigate === 'function') {
          router.navigate('/matchmaking');
        } else {
          window.location.hash = '/matchmaking';
        }
      }, 350);
    });
  }

  // 2. Enlace "ÚLTIMO PARTIDO >" hacia Historial
  const streakLastMatchLink = document.getElementById('streak-last-match-link');
  if (streakLastMatchLink) {
    streakLastMatchLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/history');
      } else if (router && typeof router.navigate === 'function') {
        router.navigate('/history');
      } else {
        window.location.href = '/history';
      }
    });
  }

  // 3. Enlace directo a Pizarra Táctica / Alineación
  const lineupLink = document.getElementById('budget-lineup-link');
  if (lineupLink) {
    lineupLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.router && typeof window.router.navigate === 'function') {
        window.router.navigate('/lineup');
      } else if (router && typeof router.navigate === 'function') {
        router.navigate('/lineup');
      } else {
        window.location.hash = '#/lineup';
      }
    });
  }

  // 4. Escucha de sincronización reactiva cuando la alineación cambia
  const squadUpdateHandler = async () => {
    try {
      const liveData = await fetchHomeData();
      renderHome(liveData);
      if (statsModal && !statsModal.hasAttribute('hidden')) {
        renderStatsModalContent();
      }
    } catch (e) {
      console.debug('[Dashboard] Error al refrescar datos de alineación:', e);
    }
  };
  window.addEventListener('fantasy:squad-updated', squadUpdateHandler);
  window.addEventListener('fantasy:player-stats-updated', squadUpdateHandler);
  window.addEventListener('storage', (e) => {
    if (e.key === 'fantasy_active_squad' || e.key === 'fantasy_player_stats') {
      squadUpdateHandler();
    }
  });

  // 5. Modal de Estadísticas Completas de los 9 Jugadores
  const statsModal = document.getElementById('stats-modal-sheet');
  const statsBackdrop = document.getElementById('stats-modal-backdrop');
  const btnStats = document.getElementById('btn-team-stats');
  const mvpClickable = document.getElementById('mvp-stats-clickable');
  const btnCloseStats = document.getElementById('btn-close-stats-modal');
  const statsListContainer = document.getElementById('stats-modal-list');

  function openStatsModal() {
    if (!statsModal || !statsBackdrop) return;
    renderStatsModalContent();
    statsBackdrop.removeAttribute('hidden');
    statsModal.removeAttribute('hidden');
  }

  function closeStatsModal() {
    if (!statsModal || !statsBackdrop) return;
    statsModal.setAttribute('hidden', '');
    statsBackdrop.setAttribute('hidden', '');
  }

  function renderStatsModalContent() {
    if (!statsListContainer) return;

    let squad = null;
    try {
      const raw = localStorage.getItem('fantasy_active_squad');
      if (raw) squad = JSON.parse(raw);
    } catch (e) {}

    let stats = {};
    try {
      const raw = localStorage.getItem('fantasy_player_stats');
      if (raw) stats = JSON.parse(raw);
    } catch (e) {}

    const rawList = Array.isArray(squad?.players) ? squad.players : [];
    const signedPlayers = [];
    rawList.forEach((player, idx) => {
      if (player && (player.name || player.nombre)) {
        signedPlayers.push({ player, slotIndex: idx });
      }
    });

    if (signedPlayers.length === 0) {
      statsListContainer.innerHTML = `
        <div class="player-stat-card player-stat-card--empty" style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2.5rem 1rem; color: #64748B; gap: 0.5rem; width: 100%;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <line x1="17" y1="8" x2="23" y2="14"></line>
            <line x1="23" y1="8" x2="17" y2="14"></line>
          </svg>
          <p style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #1E293B;">Sin futbolistas en tu plantilla</p>
          <p style="margin: 0; font-size: 0.8rem; color: #64748B;">Ficha jugadores en el mercado para ver sus estadísticas individuales aquí.</p>
        </div>
      `;
      return;
    }

    function isSameNameModal(a, b) {
      if (!a || !b) return false;
      const cleanA = a.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
      const cleanB = b.toLowerCase().replace(/^[a-z]\.\s*/, '').trim();
      return cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA);
    }

    statsListContainer.innerHTML = signedPlayers.map(({ player: p, slotIndex: idx }) => {
      const role = (p.role || p.posicion_base || 'MC').toUpperCase();
      const pName = p.name || p.nombre || 'Jugador';
      const pStats = stats[pName] ||
        Object.values(stats).find(v => isSameNameModal(v.name, pName)) ||
        Object.entries(stats).find(([k]) => isSameNameModal(k, pName))?.[1] ||
        {};
      const hasPlayed = (pStats.matchesPlayed || 0) > 0;
      const matches = pStats.matchesPlayed || 0;
      const goals = pStats.goals || 0;
      const rating = (hasPlayed && pStats.avgRating != null)
        ? Number(pStats.avgRating).toFixed(1)
        : '-';
      const isStarter = idx < 6;
      const tokenClass = `player-stat-card__token--${role.toLowerCase()}`;
      const avatarUrl = resolveDashboardPlayerAvatarUrl(p);

      return `
        <div class="player-stat-card">
          <div class="player-stat-card__left">
            <div class="player-stat-card__token ${tokenClass}" data-fallback-role="${role}">
              ${avatarUrl ? `<img src="${avatarUrl}" alt="${pName}" class="player-stat-card__img" loading="lazy" />` : role}
            </div>
            <div class="player-stat-card__info">
              <span class="player-stat-card__name">${pName}</span>
              <span class="player-stat-card__tag">${isStarter ? 'Titular' : 'Suplente'} • ${role} • Rating Base ${getPlayerRating(p)}</span>
            </div>
          </div>
          <div class="player-stat-card__right">
            <span class="stat-chip" title="Partidos Jugados">
              <span class="stat-chip__label">PJ</span>
              <strong class="stat-chip__val">${matches}</strong>
            </span>
            <span class="stat-chip" title="Goles anotados">
              <span class="stat-chip__label">Goles</span>
              <strong class="stat-chip__val">${goals}</strong>
            </span>
            <span class="stat-chip stat-chip--rating" title="Nota Media">
              <span class="stat-chip__label">Nota</span>
              <strong class="stat-chip__val">${rating}</strong>
            </span>
          </div>
        </div>
      `;
    }).join('');

    statsListContainer.querySelectorAll('.player-stat-card__img').forEach((imgEl) => {
      imgEl.addEventListener('error', () => {
        const tokenEl = imgEl.closest('.player-stat-card__token');
        if (tokenEl) {
          tokenEl.textContent = tokenEl.getAttribute('data-fallback-role') || 'JUG';
        }
      }, { once: true });
    });
  }

  if (btnStats) btnStats.addEventListener('click', openStatsModal);
  if (mvpClickable) mvpClickable.addEventListener('click', openStatsModal);
  if (btnCloseStats) btnCloseStats.addEventListener('click', closeStatsModal);
  if (statsBackdrop) statsBackdrop.addEventListener('click', closeStatsModal);
}

/**
 * Garantiza la integridad del DOM del Dashboard verificando que tanto la
 * tarjeta de Racha Reciente como el botón ¡BUSCAR RIVAL! existan físicamente en el DOM.
 */
export function ensureDashboardIntegrity() {
  const main = document.querySelector('.home-main');
  if (!main) return;

  // 1. Asegurar tarjeta de Racha Reciente
  let streakCard = document.getElementById('recent-streak');
  if (!streakCard) {
    console.info('[Dashboard] Inyectando tarjeta de Racha Reciente en el DOM...');
    streakCard = document.createElement('article');
    streakCard.className = 'card home-card streak-card';
    streakCard.id = 'recent-streak';
    streakCard.setAttribute('aria-labelledby', 'streak-title');
    streakCard.innerHTML = `
      <div class="streak-card__header">
        <h3 class="streak-card__title" id="streak-title">Racha Reciente</h3>
        <a href="/history" data-link class="streak-card__link" id="streak-last-match-link" aria-label="Ver detalles del último partido">
          ÚLTIMO PARTIDO &gt;
        </a>
      </div>
      <div class="streak-card__content">
        <div class="streak-match-info" id="streak-match-info">
          <strong class="streak-result-highlight" id="streak-result-container">
            <span class="text-win" id="streak-result-badge">V</span>
            <span id="streak-result-score">2 – 1</span>
          </strong>
          <span class="streak-opponent" id="streak-opponent-text">vs MánagerX</span>
        </div>
        <div class="streak-circles-wrapper" id="streak-circles-container" aria-label="Historial de los últimos 5 partidos">
          <span class="streak-circle streak-circle--win" title="Victoria (V)">V</span>
          <span class="streak-circle streak-circle--win" title="Victoria (V)">V</span>
          <span class="streak-circle streak-circle--loss" title="Derrota (D)">D</span>
          <span class="streak-circle streak-circle--draw" title="Empate (E)">E</span>
          <span class="streak-circle streak-circle--win" title="Victoria (V)">V</span>
        </div>
      </div>
    `;
    main.appendChild(streakCard);
  }

  // 2. Asegurar contenedor Dock para el botón Buscar Rival arriba de la barra de navegación
  const homeView = document.getElementById('home-view') || document.querySelector('.home-app-container');
  let ctaDock = document.getElementById('home-cta-dock');
  if (!ctaDock && homeView) {
    ctaDock = document.createElement('footer');
    ctaDock.className = 'home-cta-dock';
    ctaDock.id = 'home-cta-dock';
    homeView.appendChild(ctaDock);
  }

  // 3. Asegurar botón de Buscar Rival dentro del dock inferior
  let btnRival = document.getElementById('btn-buscar-rival');
  if (!btnRival) {
    console.info('[Dashboard] Inyectando botón ¡BUSCAR RIVAL! en dock inferior...');
    btnRival = document.createElement('button');
    btnRival.className = 'btn btn--primary btn-buscar-rival';
    btnRival.id = 'btn-buscar-rival';
    btnRival.type = 'button';
    btnRival.setAttribute('aria-label', 'Buscar rival para jugar partido');
    btnRival.innerHTML = `
      <svg class="btn-buscar-rival__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <span>¡BUSCAR RIVAL!</span>
    `;
    if (ctaDock) {
      ctaDock.appendChild(btnRival);
    } else {
      main.appendChild(btnRival);
    }
  } else if (ctaDock && btnRival.parentElement !== ctaDock) {
    // Si estaba dentro de main, moverlo al dock fijo arriba de la barra de navegación
    ctaDock.appendChild(btnRival);
  }
}

/**
 * Función de arranque del módulo Dashboard para el Router SPA.
 * @param {Object} [router]
 */
export async function initDashboard(router) {
  // Sincronización reactiva en tiempo real con la pantalla de Alineación y Mercado
  if (!window.__dashboardSquadListenerAttached) {
    window.__dashboardSquadListenerAttached = true;
    window.addEventListener('fantasy:squad-updated', async () => {
      try {
        const updatedData = await fetchHomeData();
        renderHome(updatedData);
      } catch (err) {
        console.debug('[Dashboard] Error actualizando tras squad-updated:', err);
      }
    });
  }

  console.info('[Dashboard] Inicializando vista Dashboard...');
  ensureDashboardIntegrity();
  setupHomeEventListeners(router);

  try {
    const liveData = await fetchHomeData();
    renderHome(liveData);
  } catch (error) {
    console.warn('[Dashboard] Fallo al cargar datos remotos, conservando estado inicial:', error);
    renderHome(DEFAULT_HOME_DATA);
  }
}

export const initHomeView = initDashboard;
