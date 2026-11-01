/**
 * @file simulation-engine.js
 * @description Motor de Simulación Táctica 6v6 para Fantasy de Leyendas.
 * Soporta las 6 formaciones tácticas oficiales y sus counters de zona.
 * Motor ampliado de 20 snapshots (~4.5 min cada uno) con diversidad de eventos:
 * goles, atajadas, penales, tiros libres, córners, tarjetas y sustituciones escalonadas.
 */

import { FORMATIONS_6V6, isTacticalCounter } from './formation-rules.js';

export { FORMATIONS_6V6 };

export const PENALTY_RATES = {
  NATURAL: 0.0,
  SIMILAR: 0.15,
  OUT_OF_POS: 0.25
};

// =============================================================================
// 1. SISTEMA DE SINERGIA Y PENALIZACIÓN POR POSICIÓN (FUERZA BASE)
// =============================================================================

export function getPositionPenalty(naturalRole, assignedRole) {
  if (!naturalRole || !assignedRole) return PENALTY_RATES.NATURAL;
  if (naturalRole === assignedRole) return PENALTY_RATES.NATURAL;

  if (naturalRole === 'POR' || assignedRole === 'POR') {
    return PENALTY_RATES.OUT_OF_POS;
  }

  if ((naturalRole === 'DEF' && assignedRole === 'DEL') || (naturalRole === 'DEL' && assignedRole === 'DEF')) {
    return PENALTY_RATES.OUT_OF_POS;
  }

  return PENALTY_RATES.SIMILAR;
}

export function getAdjustedPlayer(player, assignedRole) {
  const natural = (player.posicion_base || player.role || 'MC').toUpperCase();
  const assigned = (assignedRole || natural).toUpperCase();
  const penaltyRate = getPositionPenalty(natural, assigned);
  const efficiency = 1 - penaltyRate;

  return {
    ...player,
    assignedRole: assigned,
    penaltyRate,
    isNatural: penaltyRate === 0,
    rating_ataque: Math.round((Number(player.rating_ataque) || 75) * efficiency),
    rating_defensa: Math.round((Number(player.rating_defensa) || 75) * efficiency),
    rating_creacion: Math.round((Number(player.rating_creacion) || 75) * efficiency),
    rating_tecnica: Math.round((Number(player.rating_tecnica) || 75) * efficiency),
    rating_fisico: Number(player.rating_fisico) || 80,
    rating_palmares: Number(player.rating_palmares) || 70,
    rating_general: Math.round((Number(player.rating_general || player.media_juego) || 80) * efficiency)
  };
}

export function getTacticalBonus(homeFormationKey = '1-2-2-1', awayFormationKey = '1-2-2-1') {
  const homeForm = FORMATIONS_6V6[homeFormationKey] || FORMATIONS_6V6['1-2-2-1'];
  const awayForm = FORMATIONS_6V6[awayFormationKey] || FORMATIONS_6V6['1-2-2-1'];

  const homeMult = { ...homeForm.multipliers };
  const awayMult = { ...awayForm.multipliers };

  const homeCountersAway = isTacticalCounter(homeFormationKey, awayFormationKey);
  const awayCountersHome = isTacticalCounter(awayFormationKey, homeFormationKey);

  if (homeCountersAway) {
    homeMult.creation += 0.06;
    homeMult.attack += 0.06;
    homeMult.defense += 0.04;
  }

  if (awayCountersHome) {
    awayMult.creation += 0.06;
    awayMult.attack += 0.06;
    awayMult.defense += 0.04;
  }

  return { homeMult, awayMult, homeCountersAway, awayCountersHome };
}

// =============================================================================
// 2. BATALLA POR EL CONTROL DEL PARTIDO (POSESIÓN Y OCASIONES)
// =============================================================================

export function calculatePossessionAndChances(homePlayers, awayPlayers, homeMult, awayMult) {
  const homeScore = homePlayers.reduce(
    (acc, p) => acc + (p.rating_creacion * 0.6 + p.rating_tecnica * 0.4),
    0
  ) * homeMult.creation * homeMult.technique;

  const awayScore = awayPlayers.reduce(
    (acc, p) => acc + (p.rating_creacion * 0.6 + p.rating_tecnica * 0.4),
    0
  ) * awayMult.creation * awayMult.technique;

  const total = homeScore + awayScore || 1;
  const possessionHome = Math.min(75, Math.max(25, Math.round((homeScore / total) * 100)));
  const possessionAway = 100 - possessionHome;

  return { possessionHome, possessionAway };
}

// =============================================================================
// 3. DUELOS DE RESOLUCIÓN (ATAQUE VS DEFENSA + ARQUERO CON RNG)
// =============================================================================

export function resolveGoalChance(attackingPlayers = [], defendingPlayers = [], attackMult = { attack: 1.0 }, defMult = { defense: 1.0 }, isClutchActive = false) {
  const attackers = attackingPlayers.filter((p) => p && (p.assignedRole === 'DEL' || p.assignedRole === 'MC'));
  const leadAttacker = attackers.length > 0
    ? attackers.reduce((best, cur) => cur.rating_ataque > best.rating_ataque ? cur : best, attackers[0])
    : (attackingPlayers[0] || { name: 'Delantero', rating_ataque: 80, rating_palmares: 75 });

  let attackRating = (leadAttacker.rating_ataque || 80) * (attackMult.attack || 1.0);

  if (isClutchActive && (leadAttacker.rating_palmares || 70) >= 75) {
    attackRating *= 1.05;
  }

  const defenders = defendingPlayers.filter((p) => p && p.assignedRole === 'DEF');
  const goalkeeper = defendingPlayers.find((p) => p && p.assignedRole === 'POR') || defendingPlayers[0] || { name: 'Arquero', rating_general: 80, rating_palmares: 75 };

  const avgDefRating = defenders.length > 0
    ? (defenders.reduce((acc, p) => acc + (p.rating_defensa || 75), 0) / defenders.length) * (defMult.defense || 1.0)
    : 70;

  let gkRating = goalkeeper.rating_general || 80;
  if (isClutchActive && (goalkeeper.rating_palmares || 70) >= 75) {
    gkRating *= 1.05;
  }

  const defenseStrength = (avgDefRating * 0.5) + (gkRating * 0.5);

  const diff = attackRating - defenseStrength;
  let goalProbability = 0.45 + (diff * 0.010);
  goalProbability = Math.max(0.12, Math.min(0.78, goalProbability));

  const isGoal = Math.random() < goalProbability;

  return {
    isGoal,
    scorer: leadAttacker,
    goalkeeper,
    probability: Math.round(goalProbability * 100)
  };
}

// =============================================================================
// 4. DESGASTE FÍSICO Y SUSTITUCIONES INDIVIDUALES ESCALONADAS
// =============================================================================

export function applyFatigue(players = [], minute = 60) {
  if (minute < 55) return players;

  const minutesPast55 = minute - 55;
  return players.map((p) => {
    if (p.isSubFresh) return p; // Los suplentes entran frescos
    const fatigueLoss = (100 - p.rating_fisico) * 0.0025 * (minutesPast55 / 35);
    const fatigueMult = Math.max(0.72, 1 - fatigueLoss);

    return {
      ...p,
      rating_ataque: Math.round(p.rating_ataque * fatigueMult),
      rating_defensa: Math.round(p.rating_defensa * fatigueMult),
      rating_creacion: Math.round(p.rating_creacion * fatigueMult),
      rating_tecnica: Math.round(p.rating_tecnica * fatigueMult)
    };
  });
}

export function makeSingleSubstitution(starters = [], inPlayer = null) {
  if (!inPlayer) return { activeStarters: starters, subInfo: null };

  const candidates = starters
    .filter((p) => p.assignedRole !== 'POR' && !p.isSubFresh)
    .sort((a, b) => a.rating_fisico - b.rating_fisico);

  if (candidates.length === 0) return { activeStarters: starters, subInfo: null };

  const outPlayer = candidates[0];
  const preparedIn = getAdjustedPlayer(inPlayer, outPlayer.assignedRole);
  preparedIn.isSubFresh = true;

  const nextStarters = [...starters];
  const idx = nextStarters.findIndex((p) => p.name === outPlayer.name);
  if (idx !== -1) {
    nextStarters[idx] = preparedIn;
    return {
      activeStarters: nextStarters,
      subInfo: { out: outPlayer.name, in: inPlayer.name, role: outPlayer.assignedRole }
    };
  }

  return { activeStarters: starters, subInfo: null };
}

// =============================================================================
// MOTOR PRINCIPAL DE SIMULACIÓN POR CICLOS (20 CICLOS, 90 MINUTOS)
// =============================================================================

export const FALLBACK_DEFAULT_PLAYERS = [
  { id: 101, name: 'I. Casillas', posicion_base: 'POR', rating_defensa: 88, rating_ataque: 20, rating_creacion: 40, rating_tecnica: 50 },
  { id: 102, name: 'P. Maldini', posicion_base: 'DEF', rating_defensa: 92, rating_ataque: 40, rating_creacion: 65, rating_tecnica: 70 },
  { id: 103, name: 'F. Beckenbauer', posicion_base: 'DEF', rating_defensa: 90, rating_ataque: 60, rating_creacion: 80, rating_tecnica: 85 },
  { id: 104, name: 'Z. Zidane', posicion_base: 'MC', rating_defensa: 65, rating_ataque: 85, rating_creacion: 95, rating_tecnica: 96 },
  { id: 105, name: 'Xavi H.', posicion_base: 'MC', rating_defensa: 68, rating_ataque: 78, rating_creacion: 94, rating_tecnica: 92 },
  { id: 106, name: 'L. Messi', posicion_base: 'DEL', rating_defensa: 35, rating_ataque: 98, rating_creacion: 93, rating_tecnica: 98 },
  { id: 107, name: 'G. Buffon', posicion_base: 'POR', rating_defensa: 87, rating_ataque: 20, rating_creacion: 40, rating_tecnica: 50 },
  { id: 108, name: 'A. Iniesta', posicion_base: 'MC', rating_defensa: 60, rating_ataque: 80, rating_creacion: 92, rating_tecnica: 93 },
  { id: 109, name: 'Ronaldo N.', posicion_base: 'DEL', rating_defensa: 30, rating_ataque: 96, rating_creacion: 82, rating_tecnica: 94 }
];

export function simulateMatchEngine(homeTeamData = {}, awayTeamData = {}) {
  const homeFormationKey = homeTeamData?.formation || '1-2-2-1';
  const awayFormationKey = awayTeamData?.formation || '1-2-2-1';

  const homeRoles = FORMATIONS_6V6[homeFormationKey]?.slots || ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL'];
  const awayRoles = FORMATIONS_6V6[awayFormationKey]?.slots || ['POR', 'DEF', 'DEF', 'MC', 'MC', 'DEL'];

  const homeRaw = (Array.isArray(homeTeamData?.players) && homeTeamData.players.length >= 6)
    ? homeTeamData.players
    : FALLBACK_DEFAULT_PLAYERS;
  const awayRaw = (Array.isArray(awayTeamData?.players) && awayTeamData.players.length >= 6)
    ? awayTeamData.players
    : FALLBACK_DEFAULT_PLAYERS;

  let homeStarters = homeRaw.slice(0, 6).map((p, i) => getAdjustedPlayer(p, homeRoles[i]));
  let awayStarters = awayRaw.slice(0, 6).map((p, i) => getAdjustedPlayer(p, awayRoles[i]));

  const initialHomeStarters = [...homeStarters];
  const initialAwayStarters = [...awayStarters];

  const homeBench = homeRaw.slice(6, 9);
  const awayBench = awayRaw.slice(6, 9);

  let homeBenchIndex = 0;
  let awayBenchIndex = 0;

  const { homeMult, awayMult, homeCountersAway, awayCountersHome } = getTacticalBonus(homeFormationKey, awayFormationKey);

  let homeScore = 0;
  let awayScore = 0;
  let homeShots = 0;
  let awayShots = 0;
  let homeFouls = 0;
  let awayFouls = 0;

  // Cronología: arranca con el pitido inicial
  const events = [];
  const cycleSnapshots = [];

  // Hito 1: Inicio del partido (Punto 4)
  events.push({ minute: 0, isPeriodBreak: true, label: 'INICIO DEL PARTIDO' });

  // 20 ciclos de ~4.5 minutos cada uno
  for (let cycle = 1; cycle <= 20; cycle++) {
    const minute = cycle === 10 ? 45 : (cycle === 20 ? 90 : Math.round(cycle * 4.5));
    const isPeriodBreak = cycle === 10;
    const isFullTime = cycle === 20;
    const isClutchTime = minute >= 85 && Math.abs(homeScore - awayScore) <= 1;
    let hasGoalThisCycle = false;

    // Desgaste físico a partir del minuto 55'
    if (minute >= 55) {
      homeStarters = applyFatigue(homeStarters, minute);
      awayStarters = applyFatigue(awayStarters, minute);
    }

    // Sustituciones escalonadas distribuidas en el segundo tiempo (Punto 5)
    let subEventThisCycle = null;
    let isSubAction = false;

    // Cambio 1 Local (Ciclo 12 ~54')
    if (cycle === 12 && homeBenchIndex < homeBench.length) {
      const res = makeSingleSubstitution(homeStarters, homeBench[homeBenchIndex++]);
      homeStarters = res.activeStarters;
      if (res.subInfo) {
        subEventThisCycle = {
          minute: minute - 1,
          side: 'home',
          type: 'substitution',
          player: res.subInfo.in,
          detail: `(Entra por ${res.subInfo.out})`
        };
        isSubAction = true;
      }
    }
    // Cambio 1 Visitante (Ciclo 13 ~59')
    else if (cycle === 13 && awayBenchIndex < awayBench.length) {
      const res = makeSingleSubstitution(awayStarters, awayBench[awayBenchIndex++]);
      awayStarters = res.activeStarters;
      if (res.subInfo) {
        subEventThisCycle = {
          minute: minute - 1,
          side: 'away',
          type: 'substitution',
          player: res.subInfo.in,
          detail: `(Entra por ${res.subInfo.out})`
        };
        isSubAction = true;
      }
    }
    // Cambio 2 Local (Ciclo 15 ~68')
    else if (cycle === 15 && homeBenchIndex < homeBench.length) {
      const res = makeSingleSubstitution(homeStarters, homeBench[homeBenchIndex++]);
      homeStarters = res.activeStarters;
      if (res.subInfo) {
        subEventThisCycle = {
          minute: minute - 1,
          side: 'home',
          type: 'substitution',
          player: res.subInfo.in,
          detail: `(Entra por ${res.subInfo.out})`
        };
        isSubAction = true;
      }
    }
    // Cambio 2 Visitante (Ciclo 16 ~72')
    else if (cycle === 16 && awayBenchIndex < awayBench.length) {
      const res = makeSingleSubstitution(awayStarters, awayBench[awayBenchIndex++]);
      awayStarters = res.activeStarters;
      if (res.subInfo) {
        subEventThisCycle = {
          minute: minute - 1,
          side: 'away',
          type: 'substitution',
          player: res.subInfo.in,
          detail: `(Entra por ${res.subInfo.out})`
        };
        isSubAction = true;
      }
    }
    // Cambio 3 Local (Ciclo 17 ~77')
    else if (cycle === 17 && homeBenchIndex < homeBench.length) {
      const res = makeSingleSubstitution(homeStarters, homeBench[homeBenchIndex++]);
      homeStarters = res.activeStarters;
      if (res.subInfo) {
        subEventThisCycle = {
          minute: minute - 1,
          side: 'home',
          type: 'substitution',
          player: res.subInfo.in,
          detail: `(Entra por ${res.subInfo.out})`
        };
        isSubAction = true;
      }
    }
    // Cambio 3 Visitante (Ciclo 18 ~81')
    else if (cycle === 18 && awayBenchIndex < awayBench.length) {
      const res = makeSingleSubstitution(awayStarters, awayBench[awayBenchIndex++]);
      awayStarters = res.activeStarters;
      if (res.subInfo) {
        subEventThisCycle = {
          minute: minute - 1,
          side: 'away',
          type: 'substitution',
          player: res.subInfo.in,
          detail: `(Entra por ${res.subInfo.out})`
        };
        isSubAction = true;
      }
    }

    if (subEventThisCycle) {
      events.unshift(subEventThisCycle);
    }

    // Posesión y dominio en este ciclo
    const { possessionHome, possessionAway } = calculatePossessionAndChances(
      homeStarters,
      awayStarters,
      homeMult,
      awayMult
    );

    const activeTeamName = possessionHome >= 50 ? (homeTeamData.name || 'Tu Equipo') : (awayTeamData.name || 'Equipo Rival');
    let actionStatus = 'CONTROL DE BALÓN';
    let actionTeam = activeTeamName;

    const rollOccasion = Math.random() * 100;
    const attackingHome = rollOccasion < possessionHome;
    const attTeam = attackingHome ? (homeTeamData.name || 'Tu Equipo') : (awayTeamData.name || 'Equipo Rival');
    const defTeam = attackingHome ? (awayTeamData.name || 'Equipo Rival') : (homeTeamData.name || 'Tu Equipo');
    const attSide = attackingHome ? 'home' : 'away';
    const defSide = attackingHome ? 'away' : 'home';
    const attStarters = attackingHome ? homeStarters : awayStarters;
    const defStarters = attackingHome ? awayStarters : homeStarters;
    const attMult = attackingHome ? homeMult : awayMult;
    const defMult = attackingHome ? awayMult : homeMult;

    // Faltas del ciclo
    if (Math.random() < 0.22) {
      if (attackingHome) awayFouls++;
      else homeFouls++;
    }

    // Generación de jugadas de peligro y eventos diversos (Punto 2)
    if (!isPeriodBreak && !isFullTime) {
      const occasionRoll = Math.random();

      // 1. PENALTI (~4% de probabilidad)
      if (occasionRoll < 0.04) {
        actionTeam = attTeam;
        actionStatus = '¡PENALTI COBRADO!';
        if (attackingHome) homeShots++; else awayShots++;

        const takers = attStarters.filter(p => p.assignedRole === 'DEL' || p.assignedRole === 'MC');
        const taker = takers.length > 0 ? takers[0] : attStarters[0];
        const gk = defStarters.find(p => p.assignedRole === 'POR') || defStarters[0];

        // 75% conversión de penal
        if (Math.random() < 0.75) {
          if (attackingHome) homeScore++; else awayScore++;
          actionStatus = '¡GOL DE PENALTI!';
          hasGoalThisCycle = true;
          events.unshift({
            minute,
            side: attSide,
            type: 'penalty-goal',
            player: taker.name,
            detail: '(Gol de Penal)'
          });
        } else {
          actionStatus = '¡PENALTI ATAJADO POR EL PORTERO!';
          events.unshift({
            minute,
            side: defSide,
            type: 'save',
            player: gk.name,
            detail: '(Penal Atajado)'
          });
        }
      }
      // 2. TIRO LIBRE PELIGROSO (~8% de probabilidad)
      else if (occasionRoll < 0.12) {
        actionTeam = attTeam;
        actionStatus = 'TIRO LIBRE AL BORDE DEL ÁREA';
        if (attackingHome) homeShots++; else awayShots++;

        const kickers = [...attStarters].sort((a, b) => b.rating_tecnica - a.rating_tecnica);
        const kicker = kickers[0] || attStarters[0];
        const gk = defStarters.find(p => p.assignedRole === 'POR') || defStarters[0];

        const freekickRoll = Math.random();
        if (freekickRoll < 0.25) {
          if (attackingHome) homeScore++; else awayScore++;
          actionStatus = '¡GOLAZO DE TIRO LIBRE!';
          hasGoalThisCycle = true;
          events.unshift({
            minute,
            side: attSide,
            type: 'goal',
            player: kicker.name,
            detail: '(Tiro Libre Directo)'
          });
        } else if (freekickRoll < 0.65) {
          actionStatus = '¡PARADÓN DEL ARQUERO A TIRO LIBRE!';
          events.unshift({
            minute,
            side: defSide,
            type: 'save',
            player: gk.name,
            detail: '(Atajada Clave)'
          });
        } else {
          actionStatus = 'TIRO LIBRE CERCA DEL TRAVESAÑO';
          events.unshift({
            minute,
            side: attSide,
            type: 'freekick',
            player: kicker.name,
            detail: '(Tiro Libre Peligroso)'
          });
        }
      }
      // 3. TIRO DE ESQUINA / CÓRNER (~14% de probabilidad)
      else if (occasionRoll < 0.26) {
        actionTeam = attTeam;
        actionStatus = 'TIRO DE ESQUINA PELIGROSO';
        const kickers = [...attStarters].sort((a, b) => b.rating_creacion - a.rating_creacion);
        const kicker = kickers[0] || attStarters[0];

        events.unshift({
          minute,
          side: attSide,
          type: 'corner',
          player: kicker.name,
          detail: '(Tiro de Esquina)'
        });

        // Chance de gol de cabeza tras córner (18%)
        if (Math.random() < 0.18) {
          const headers = attStarters.filter(p => p.assignedRole === 'DEF' || p.assignedRole === 'DEL');
          const headerGuy = headers[Math.floor(Math.random() * headers.length)] || attStarters[0];
          if (attackingHome) { homeScore++; homeShots++; } else { awayScore++; awayShots++; }
          actionStatus = '¡CABEZAZO Y GOOOOL TRAS CÓRNER!';
          hasGoalThisCycle = true;
          events.unshift({
            minute,
            side: attSide,
            type: 'goal',
            player: headerGuy.name,
            detail: '(Gol de Cabeza)'
          });
        }
      }
      // 4. JUGADA COLECTIVA / ATAQUE A PUERTA (~38% de probabilidad)
      else if (occasionRoll < 0.64) {
        if (attackingHome) homeShots++; else awayShots++;
        actionTeam = attTeam;
        actionStatus = 'ATAQUE PELIGROSO';

        const duel = resolveGoalChance(attStarters, defStarters, attMult, defMult, isClutchTime);
        if (duel.isGoal) {
          if (attackingHome) homeScore++; else awayScore++;
          actionStatus = '¡GOOOOL!';
          hasGoalThisCycle = true;
          events.unshift({
            minute,
            side: attSide,
            type: 'goal',
            player: duel.scorer.name,
            detail: '(Gol)'
          });
        } else {
          if (Math.random() < 0.50) {
            actionStatus = '¡PARADÓN DEL ARQUERO!';
            events.unshift({
              minute,
              side: defSide,
              type: 'save',
              player: duel.goalkeeper.name,
              detail: '(Atajada Clave)'
            });
          } else {
            actionStatus = 'DEFENSA CERRADA';
          }
        }
      }
    }

    // Tarjetas disciplinarias en el ciclo (~10% chance)
    if (!isPeriodBreak && !isFullTime && Math.random() < 0.10) {
      const isRed = Math.random() < 0.08;
      const fouledAway = attackingHome;
      const targetSide = fouledAway ? 'away' : 'home';
      const punishedTeam = fouledAway ? awayStarters : homeStarters;
      // Preferir jugadores de campo (DEF, MC, DEL) para amonestaciones
      const outfieldPlayers = punishedTeam.filter(p => p.assignedRole !== 'POR');
      const cardPool = outfieldPlayers.length > 0 ? outfieldPlayers : punishedTeam;
      const player = cardPool[Math.floor(Math.random() * cardPool.length)]?.name || 'Defensa';
      const cardMinute = (subEventThisCycle || hasGoalThisCycle) ? Math.min(90, minute + 1) : minute;

      events.unshift({
        minute: cardMinute,
        side: targetSide,
        type: isRed ? 'red-card' : 'yellow-card',
        player,
        detail: isRed ? '(Tarjeta Roja Directa)' : '(Tarjeta Amarilla)'
      });
      actionStatus = isRed ? '¡TARJETA ROJA DIRECTA!' : 'TARJETA AMARILLA';
    }

    // Hito 2: Descanso al minuto 45 (Ciclo 10)
    if (isPeriodBreak) {
      events.unshift({ minute: 45, isPeriodBreak: true, label: 'DESCANSO' });
      actionStatus = 'DESCANSO';
      actionTeam = homeTeamData.name || 'Tu Equipo';
    }

    // Hito 3: Fin del partido al minuto 90 (Ciclo 20)
    if (isFullTime) {
      events.unshift({ minute: 90, isPeriodBreak: true, label: 'FIN DEL PARTIDO' });
      actionStatus = 'FINAL DEL PARTIDO';
      actionTeam = homeTeamData.name || 'Tu Equipo';
    }

    const statusBadge = isPeriodBreak
      ? 'DESCANSO'
      : (cycle === 20 ? 'FINAL' : `EN VIVO ${minute}'`);

    cycleSnapshots.push({
      cycle,
      minute,
      statusBadge,
      isLive: cycle < 20,
      homeScore,
      awayScore,
      hasGoalThisCycle,
      liveAction: {
        team: actionTeam,
        status: actionStatus
      },
      stats: {
        possession: { home: possessionHome, away: possessionAway, label: 'Posesión' },
        shots: { home: homeShots, away: awayShots, label: 'Tiros a Puerta' },
        fouls: { home: homeFouls, away: awayFouls, label: 'Faltas' }
      },
      events: [...events]
    });
  }

  const avgPossessionHome = Math.round(
    cycleSnapshots.reduce((acc, c) => acc + c.stats.possession.home, 0) / cycleSnapshots.length
  );
  const avgPossessionAway = 100 - avgPossessionHome;

  return {
    id: Date.now(),
    status: 'FINAL',
    homeTeam: {
      name: homeTeamData.name || 'Tu Equipo',
      score: homeScore,
      formation: homeFormationKey,
      formationName: FORMATIONS_6V6[homeFormationKey]?.name || homeFormationKey,
      hasCounterAdvantage: homeCountersAway
    },
    awayTeam: {
      name: awayTeamData.name || 'Equipo Rival',
      score: awayScore,
      formation: awayFormationKey,
      formationName: FORMATIONS_6V6[awayFormationKey]?.name || awayFormationKey,
      hasCounterAdvantage: awayCountersHome
    },
    liveAction: {
      team: homeTeamData.name || 'Tu Equipo',
      status: 'FINAL DEL PARTIDO'
    },
    events,
    stats: {
      possession: { home: avgPossessionHome, away: avgPossessionAway, label: 'Posesión' },
      shots: { home: homeShots, away: awayShots, label: 'Tiros a Puerta' },
      fouls: { home: homeFouls, away: awayFouls, label: 'Faltas' }
    },
    lineups: {
      home: initialHomeStarters.map((p) => ({ name: p.name, role: p.assignedRole })),
      away: initialAwayStarters.map((p) => ({ name: p.name, role: p.assignedRole })),
      homeStarters: initialHomeStarters.map((p) => ({ name: p.name, role: p.assignedRole })),
      homeBench: homeBench.map((p) => ({ name: p.name, role: p.role || p.posicion_base || 'MC' })),
      awayStarters: initialAwayStarters.map((p) => ({ name: p.name, role: p.assignedRole })),
      awayBench: awayBench.map((p) => ({ name: p.name, role: p.role || p.posicion_base || 'MC' }))
    },
    cycleSnapshots
  };
}
