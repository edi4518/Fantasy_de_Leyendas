"""
Servicio del motor de simulación de partidos 6v6 para Fantasy de Leyendas.
Implementa las 6 formaciones tácticas oficiales y su sistema de counters ("Piedra, Papel o Tijera").
"""

import random
from typing import Dict, Any, List

FORMATIONS_6V6 = {
    "1-2-2-1": {
        "name": "1-2-2-1 (Equilibrio puro)",
        "slots": ["POR", "DEF", "DEF", "MC", "MC", "DEL"],
        "multipliers": {"attack": 1.00, "defense": 1.02, "creation": 1.02, "technique": 1.00},
        "counters": ["1-1-1-3"]
    },
    "1-2-1-2": {
        "name": "1-2-1-2 (Rombo)",
        "slots": ["POR", "DEF", "DEF", "MC", "DEL", "DEL"],
        "multipliers": {"attack": 1.12, "defense": 0.96, "creation": 0.95, "technique": 1.08},
        "counters": ["1-3-1-1"]
    },
    "1-1-2-2": {
        "name": "1-1-2-2 (Ataque Frontal)",
        "slots": ["POR", "DEF", "MC", "MC", "DEL", "DEL"],
        "multipliers": {"attack": 1.18, "defense": 0.85, "creation": 1.05, "technique": 1.05},
        "counters": ["1-2-2-1"]
    },
    "1-3-1-1": {
        "name": "1-3-1-1 (Alta Presión y Creación)",
        "slots": ["POR", "DEF", "DEF", "DEF", "MC", "DEL"],
        "multipliers": {"attack": 0.90, "defense": 1.16, "creation": 0.90, "technique": 0.95},
        "counters": ["1-1-3-1"]
    },
    "1-1-3-1": {
        "name": "1-1-3-1 (Dominio del Medio)",
        "slots": ["POR", "DEF", "MC", "MC", "MC", "DEL"],
        "multipliers": {"attack": 0.92, "defense": 0.88, "creation": 1.22, "technique": 1.20},
        "counters": ["1-1-2-2"]
    },
    "1-1-1-3": {
        "name": "1-1-1-3 (Ultra Ofensivo / All-In)",
        "slots": ["POR", "DEF", "MC", "DEL", "DEL", "DEL"],
        "multipliers": {"attack": 1.25, "defense": 0.78, "creation": 0.80, "technique": 1.05},
        "counters": ["1-3-1-1"]
    }
}


def get_position_penalty(natural_role: str, assigned_role: str) -> float:
    nat = (natural_role or "MC").upper()
    ass = (assigned_role or nat).upper()
    if nat == ass:
        return 0.0
    if nat == "POR" or ass == "POR":
        return 0.25
    if (nat == "DEF" and ass == "DEL") or (nat == "DEL" and ass == "DEF"):
        return 0.25
    return 0.15


def adjust_player(player: Dict[str, Any], assigned_role: str) -> Dict[str, Any]:
    nat = player.get("posicion_base") or player.get("role") or "MC"
    penalty = get_position_penalty(nat, assigned_role)
    eff = 1.0 - penalty

    return {
        "id": player.get("id"),
        "name": player.get("nombre") or player.get("name") or "Jugador",
        "natural_role": nat,
        "assigned_role": assigned_role,
        "penalty_rate": penalty,
        "rating_ataque": round((float(player.get("rating_ataque") or 75)) * eff),
        "rating_defensa": round((float(player.get("rating_defensa") or 75)) * eff),
        "rating_creacion": round((float(player.get("rating_creacion") or 75)) * eff),
        "rating_tecnica": round((float(player.get("rating_tecnica") or 75)) * eff),
        "rating_fisico": float(player.get("rating_fisico") or 80),
        "rating_palmares": float(player.get("rating_palmares") or 70),
        "rating_general": round((float(player.get("rating_general") or player.get("media_juego") or 80)) * eff),
    }


class SimulationService:
    """Motor de cálculo y simulación táctica 6v6."""

    def simulate(self, home_squad: Dict[str, Any], away_squad: Dict[str, Any]) -> Dict[str, Any]:
        home_form_key = home_squad.get("formation") or "1-2-2-1"
        away_form_key = away_squad.get("formation") or "1-2-2-1"

        home_cfg = FORMATIONS_6V6.get(home_form_key, FORMATIONS_6V6["1-2-2-1"])
        away_cfg = FORMATIONS_6V6.get(away_form_key, FORMATIONS_6V6["1-2-2-1"])

        home_mult = dict(home_cfg["multipliers"])
        away_mult = dict(away_cfg["multipliers"])

        # Counters tácticos ("Piedra, Papel o Tijera")
        if away_form_key in home_cfg.get("counters", []):
            home_mult["creation"] += 0.06
            home_mult["attack"] += 0.06
            home_mult["defense"] += 0.04

        if home_form_key in away_cfg.get("counters", []):
            away_mult["creation"] += 0.06
            away_mult["attack"] += 0.06
            away_mult["defense"] += 0.04

        home_players_raw = home_squad.get("players") or []
        away_players_raw = away_squad.get("players") or []

        home_starters = [
            adjust_player(p, home_cfg["slots"][i])
            for i, p in enumerate(home_players_raw[:6])
        ]
        away_starters = [
            adjust_player(p, away_cfg["slots"][i])
            for i, p in enumerate(away_players_raw[:6])
        ]

        home_bench = home_players_raw[6:9]
        away_bench = away_players_raw[6:9]

        home_score = 0
        away_score = 0
        home_shots = 0
        away_shots = 0
        home_fouls = 0
        away_fouls = 0
        events = []
        cycle_snapshots = []
        subs_made = False

        events.append({"minute": 0, "isPeriodBreak": True, "label": "INICIO DEL PARTIDO"})

        for cycle in range(1, 21):
            minute = 45 if cycle == 10 else (90 if cycle == 20 else round(cycle * 4.5))
            is_break = cycle == 10
            is_full = cycle == 20
            is_clutch = minute >= 85 and abs(home_score - away_score) <= 1

            if minute >= 55:
                home_starters = self._apply_fatigue(home_starters, minute)
                away_starters = self._apply_fatigue(away_starters, minute)

            home_dom = sum(p["rating_creacion"] * 0.6 + p["rating_tecnica"] * 0.4 for p in home_starters) * home_mult["creation"] * home_mult["technique"]
            away_dom = sum(p["rating_creacion"] * 0.6 + p["rating_tecnica"] * 0.4 for p in away_starters) * away_mult["creation"] * away_mult["technique"]
            total_dom = home_dom + away_dom or 1.0

            pos_home = min(75, max(25, round((home_dom / total_dom) * 100)))
            pos_away = 100 - pos_home

            attacking_home = (random.random() * 100) < pos_home
            att_starters = home_starters if attacking_home else away_starters
            def_starters = away_starters if attacking_home else home_starters
            att_mult = home_mult if attacking_home else away_mult
            def_mult = away_mult if attacking_home else home_mult
            att_side = "home" if attacking_home else "away"
            def_side = "away" if attacking_home else "home"

            if random.random() < 0.22:
                if attacking_home:
                    away_fouls += 1
                else:
                    home_fouls += 1

            if not is_break and not is_full:
                roll = random.random()
                if roll < 0.04:  # Penal
                    if attacking_home: home_shots += 1
                    else: away_shots += 1
                    taker = next((p for p in att_starters if p.get("assigned_role") in ("DEL", "MC")), att_starters[0])
                    if random.random() < 0.75:
                        if attacking_home: home_score += 1
                        else: away_score += 1
                        events.append({"minute": minute, "side": att_side, "type": "penalty-goal", "player": taker["name"], "detail": "(Gol de Penal)"})
                    else:
                        gk = next((p for p in def_starters if p.get("assigned_role") == "POR"), def_starters[0])
                        events.append({"minute": minute, "side": def_side, "type": "save", "player": gk["name"], "detail": "(Penal Atajado)"})
                elif roll < 0.12:  # Tiro libre
                    if attacking_home: home_shots += 1
                    else: away_shots += 1
                    kicker = max(att_starters, key=lambda x: x.get("rating_tecnica", 75))
                    if random.random() < 0.25:
                        if attacking_home: home_score += 1
                        else: away_score += 1
                        events.append({"minute": minute, "side": att_side, "type": "goal", "player": kicker["name"], "detail": "(Tiro Libre Directo)"})
                    else:
                        events.append({"minute": minute, "side": att_side, "type": "freekick", "player": kicker["name"], "detail": "(Tiro Libre Peligroso)"})
                elif roll < 0.26:  # Córner
                    kicker = max(att_starters, key=lambda x: x.get("rating_creacion", 75))
                    events.append({"minute": minute, "side": att_side, "type": "corner", "player": kicker["name"], "detail": "(Tiro de Esquina)"})
                    if random.random() < 0.18:
                        hdr = next((p for p in att_starters if p.get("assigned_role") in ("DEF", "DEL")), att_starters[0])
                        if attacking_home: home_score += 1; home_shots += 1
                        else: away_score += 1; away_shots += 1
                        events.append({"minute": minute, "side": att_side, "type": "goal", "player": hdr["name"], "detail": "(Gol de Cabeza)"})
                elif roll < 0.64:  # Jugada normal
                    if attacking_home: home_shots += 1
                    else: away_shots += 1
                    is_goal, scorer = self._resolve_duel(att_starters, def_starters, att_mult["attack"], def_mult["defense"], is_clutch)
                    if is_goal:
                        if attacking_home: home_score += 1
                        else: away_score += 1
                        events.append({"minute": minute, "side": att_side, "type": "goal", "player": scorer["name"], "detail": "(Gol)"})
                    elif random.random() < 0.50:
                        gk = next((p for p in def_starters if p.get("assigned_role") == "POR"), def_starters[0])
                        events.append({"minute": minute, "side": def_side, "type": "save", "player": gk["name"], "detail": "(Atajada Clave)"})

                # Tarjetas
                if random.random() < 0.12:
                    is_red = random.random() < 0.10
                    p_fouled = def_starters[random.randint(0, len(def_starters) - 1)]
                    events.append({
                        "minute": minute,
                        "side": def_side,
                        "type": "red-card" if is_red else "yellow-card",
                        "player": p_fouled["name"],
                        "detail": "(Tarjeta Roja Directa)" if is_red else "(Tarjeta Amarilla)"
                    })

            if is_break:
                events.append({"minute": 45, "isPeriodBreak": True, "label": "DESCANSO"})
            if is_full:
                events.append({"minute": 90, "isPeriodBreak": True, "label": "FIN DEL PARTIDO"})

            cycle_snapshots.append({
                "cycle": cycle,
                "minute": minute,
                "home_score": home_score,
                "away_score": away_score,
                "possession": {"home": pos_home, "away": pos_away}
            })

        avg_pos_home = round(sum(c["possession"]["home"] for c in cycle_snapshots) / len(cycle_snapshots))
        avg_pos_away = 100 - avg_pos_home

        return {
            "match_id": random.randint(1000, 9999),
            "status": "FINAL",
            "home_team": {
                "name": home_squad.get("name", "Tu Equipo"),
                "score": home_score,
                "formation": home_form_key,
                "formation_name": home_cfg["name"]
            },
            "away_team": {
                "name": away_squad.get("name", "Equipo Rival"),
                "score": away_score,
                "formation": away_form_key,
                "formation_name": away_cfg["name"]
            },
            "stats": {
                "possession": {"home": avg_pos_home, "away": avg_pos_away, "label": "Posesión"},
                "shots": {"home": home_shots, "away": away_shots, "label": "Tiros a Puerta"},
                "fouls": {"home": home_fouls, "away": away_fouls, "label": "Faltas"},
            },
            "events": events,
            "cycle_snapshots": cycle_snapshots,
            "cycleSnapshots": cycle_snapshots,
            "lineups": {
                "home": [{"name": p["name"], "role": p["assigned_role"]} for p in home_starters],
                "away": [{"name": p["name"], "role": p["assigned_role"]} for p in away_starters],
                "homeStarters": [{"name": p["name"], "role": p["assigned_role"]} for p in home_starters],
                "homeBench": [{"name": p.get("name", "Suplente"), "role": p.get("role", "MC")} for p in home_bench],
                "awayStarters": [{"name": p["name"], "role": p["assigned_role"]} for p in away_starters],
                "awayBench": [{"name": p.get("name", "Suplente"), "role": p.get("role", "MC")} for p in away_bench],
            }
        }

    def _apply_fatigue(self, players: List[Dict[str, Any]], minute: int) -> List[Dict[str, Any]]:
        minutes_past = minute - 60
        result = []
        for p in players:
            loss = (100.0 - p["rating_fisico"]) * 0.002 * (minutes_past / 30.0)
            mult = max(0.75, 1.0 - loss)
            cp = dict(p)
            cp["rating_ataque"] = round(p["rating_ataque"] * mult)
            cp["rating_defensa"] = round(p["rating_defensa"] * mult)
            cp["rating_creacion"] = round(p["rating_creacion"] * mult)
            cp["rating_tecnica"] = round(p["rating_tecnica"] * mult)
            result.append(cp)
        return result

    def _make_substitutions(self, starters: List[Dict[str, Any]], bench: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not bench:
            return starters

        st = list(starters)
        candidates = sorted(
            [p for p in st if p["assigned_role"] != "POR"],
            key=lambda x: x["rating_fisico"]
        )

        for i in range(min(3, len(bench), len(candidates))):
            out_p = candidates[i]
            in_raw = bench[i]
            in_adj = adjust_player(in_raw, out_p["assigned_role"])
            idx = next((j for j, p in enumerate(st) if p["name"] == out_p["name"]), -1)
            if idx != -1:
                st[idx] = in_adj
        return st

    def _resolve_duel(self, attackers: List[Dict[str, Any]], defenders: List[Dict[str, Any]], att_mult: float, def_mult: float, is_clutch: bool):
        fwds = [p for p in attackers if p.get("assigned_role") in ("DEL", "MC")]
        lead = max(fwds, key=lambda x: x.get("rating_ataque", 75)) if fwds else (attackers[0] if attackers else {"name": "Delantero", "rating_ataque": 80, "rating_palmares": 75})

        att_pwr = lead.get("rating_ataque", 80) * att_mult
        if is_clutch and lead.get("rating_palmares", 70) >= 75:
            att_pwr *= 1.05

        defs = [p for p in defenders if p.get("assigned_role") == "DEF"]
        gk = next((p for p in defenders if p.get("assigned_role") == "POR"), (defenders[0] if defenders else {"name": "Arquero", "rating_general": 80, "rating_palmares": 75}))

        avg_def = (sum(p.get("rating_defensa", 75) for p in defs) / len(defs) if defs else 70.0) * def_mult
        gk_pwr = gk.get("rating_general", 80.0)
        if is_clutch and gk.get("rating_palmares", 70) >= 75:
            gk_pwr *= 1.05

        def_pwr = (avg_def * 0.5) + (gk_pwr * 0.5)
        diff = att_pwr - def_pwr

        goal_prob = max(0.15, min(0.85, 0.50 + (diff * 0.012)))
        is_goal = random.random() < goal_prob
        return is_goal, lead
