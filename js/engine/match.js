// ─────────────────────────────────────────────
// engine/match.js  — Motore partita
// ─────────────────────────────────────────────

const PERIOD_SECONDS = 8 * 60;
const TOTAL_PERIODS  = 4;
const MAX_TEMP_EXP   = 3;    // gialli → espulsione definitiva
const MAX_EXPELLED   = 3;    // hard cap: mai sotto 4 giocatori in campo

// Boost tattico sulla forza squadra
const TACTIC_BOOST = {
  balanced: 0, attack: 8, defense: -5, counter: 3, press: 5,
};

// Probabilità base di fallo per evento × moltiplicatore tattico
// Calibrato su 200.000 simulazioni Monte Carlo.
// Risultati attesi:
//   defense:  ~0    esp/partita
//   balanced: ~0-1  esp/partita, raramente 2
//   counter:  ~0-1  esp/partita, talvolta 2
//   attack:   ~1-2  esp/partita, raramente 3
//   press:    ~1-3  esp/partita (stile aggressivo)
const BASE_FOUL_PROB = 0.050;
const TACTIC_FOUL_MULT = {
  defense:  0.40,
  balanced: 0.75,
  counter:  0.90,
  attack:   1.00,
  press:    1.10,
};

// Pesi per selezione giocatore che commette fallo:
// un giocatore già ammonito gioca più cauto
const YELLOW_WEIGHTS = [1.0, 0.35, 0.08]; // 0 gialli, 1 giallo, 2 gialli

// Affinità ruolo ↔ posizione: usata per il malus fuori-ruolo
// Ogni posizione ha un ruolo "nativo"; se il giocatore ha un ruolo diverso
// la sua efficacia in quella posizione viene ridotta
const POS_NATIVE_ROLE = {
  GK: 'POR',
  1:  'ATT',  // RW
  2:  'DIF',  // DR
  3:  'CEN',  // ATT centro
  4:  'DIF',  // DL
  5:  'ATT',  // LW
  6:  'CB',   // centroboa
};

// Fattore di efficacia quando il giocatore è fuori ruolo
// 'native' = ruolo corretto, 'adjacent' = ruolo simile, 'alien' = ruolo distante
// Fattore efficacia per ruolo giocatore → ruolo nativo della posizione
// ATT in pos 3 (native CEN): penalizzato perché pos 3 richiede visione di gioco, non finalizzazione
const ROLE_ADJACENCY = {
  POR: { POR: 1.0, DIF: 0.55, CEN: 0.40, ATT: 0.35, CB: 0.35 },
  DIF: { POR: 0.40, DIF: 1.0, CEN: 0.75, ATT: 0.60, CB: 0.55 },
  CEN: { POR: 0.40, DIF: 0.80, CEN: 1.0, ATT: 0.85, CB: 0.75 },
  ATT: { POR: 0.35, DIF: 0.60, CEN: 0.70, ATT: 1.0,  CB: 0.80 },
  CB:  { POR: 0.35, DIF: 0.60, CEN: 0.75, ATT: 0.80, CB: 1.0 },
};

// Penalità mano/posizione: fattore moltiplicativo applicato all'efficacia
// Mancini (L) in pos 4 e 5: penalizzati (braccio dominante a sfavore)
// Destri (R) in pos 1 e 2: penalizzati
// Pos 3 e 6: indifferente (gioco frontale/centrale)
// AMB: nessuna penalità ovunque
const HAND_POS_PENALTY = {
  L: { GK: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 0.82, 5: 0.82, 6: 1.0 },
  R: { GK: 1.0, 1: 0.82, 2: 0.82, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0 },
  AMB: { GK: 1.0, 1: 1.0, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0 },
};

// ── Costanti stamina ──────────────────────────
const STAMINA_BASE_DRAIN     = 0.004;   // drain/s base (forma 100, età 25, balanced)
const STAMINA_BENCH_RECOVERY = 0.0012;  // recupero/s in panchina

// Moltiplicatori tattici globali (applicati a tutti i giocatori in campo)
const TACTIC_STAMINA_MULT = {
  defense:  0.70,
  balanced: 1.00,
  counter:  1.10,
  attack:   1.30,
  press:    1.60,  // massimo consumo
};

// In contropiede le posizioni offensive corrono molto di più
const COUNTER_POS_MULT = {
  GK: 0.80, 2: 1.00, 4: 1.00,  // difensivi: normale o meno
  1: 1.35, 3: 1.25, 5: 1.35,   // attaccanti: molto più fatica
  6: 1.10,                       // centroboa: leggermente più fatica
};

const NEUTRAL_EVENTS = [
  'Azione di attacco neutralizzata', 'Contrattacco sventato',
  'Rimessa in gioco', 'Cambio possesso palla',
  'Superiorità numerica gestita', 'Tiro fuori misura', 'Fallo in attacco',
];

// ── Crea lo stato iniziale ────────────────────
function createMatchState({ match, isHome, myTeam, oppTeam, myRoster, oppRoster, formation, shirtNumbers }) {
  const onFieldIdxs = new Set(Object.values(formation));
  // In panchina vanno SOLO i giocatori convocati con numero assegnato
  // (i giocatori senza numero non sono stati convocati per questa gara)
  const numberedIdxs = new Set(Object.keys(shirtNumbers || {}).map(Number));
  const bench = myRoster
    .map((_, i) => i)
    .filter(i => !onFieldIdxs.has(i) && numberedIdxs.has(i));

  const tempExp = {};
  myRoster.forEach((_, i) => { tempExp[i] = 0; });

  // stamina: { rosterIdx → 0-100 } inizializzata dal fitness del giocatore
  const stamina = {};
  myRoster.forEach((p, i) => { stamina[i] = p.fitness; });

  return {
    match, isHome, myTeam, oppTeam,
    onField: { ...formation },
    bench,
    myScore: 0, oppScore: 0,
    period: 1, totalSeconds: 0,
    running: false, finished: false,
    myShots: 0, oppShots: 0, mySaves: 0, myFouls: 0,
    tactic: 'balanced',
    actions: [],
    myRoster, oppRoster,
    subs: 0, subOut: null, subIn: null,
    lastActionTime: 0, nextActionIn: rnd(4, 9),
    poType: null, poMatch: null,
    shirtNumbers: shirtNumbers || {},
    tempExp,
    expelled: new Set(),
    stamina,
    speed: 1,
    // Gol segnati IN QUESTA PARTITA: { rosterIdx → count }
    matchGoals:   {},
    matchAssists: {},
    // Parziali per periodo: array di { my, opp } per ciascuno dei 4 tempi
    periodScores: [ {my:0,opp:0}, {my:0,opp:0}, {my:0,opp:0}, {my:0,opp:0} ],
    // Punteggio al termine del periodo precedente (per calcolare il parziale corrente)
    _prevScore: { my:0, opp:0 },
  };
}

// ── Avanza il tempo ───────────────────────────
function advanceTime(ms, dt) {
  ms.totalSeconds += dt * ms.speed;

  // Cala la stamina dei giocatori in campo
  _drainStamina(ms, dt * ms.speed);

  const curPeriodSec = ms.totalSeconds - (ms.period - 1) * PERIOD_SECONDS;
  if (curPeriodSec >= PERIOD_SECONDS) {
    if (ms.period < TOTAL_PERIODS) {
      ms.period++;
      return { periodEnded: true, matchEnded: false };
    } else {
      ms.finished = true; ms.running = false;
      return { periodEnded: true, matchEnded: true };
    }
  }
  return { periodEnded: false, matchEnded: false };
}

// ── Calo stamina in campo + recupero in panchina ──
//
// Drain per giocatore = BASE × tacticMult × posMult × ageFactor / fitnessFactor / statFactor
//
//   tacticMult  : globale per tutti (press=1.60, balanced=1.00, defense=0.70)
//   posMult     : in contropiede, posizioni 1/3/5 corrono di più (fino a ×1.35)
//   ageFactor   : giocatori >30 anni si stancano +15% per anno oltre i 30
//   fitnessFactor: forma alta = si stanca meno (0.55–1.0)
//   statFactor  : alto SPE (velocità) = drain leggermente minore (atleta più efficiente)
//
function _drainStamina(ms, dtGame) {
  const tactic     = ms.tactic || 'balanced';
  const tacticMult = TACTIC_STAMINA_MULT[tactic] || 1.0;

  // Mappa posKey → rosterIdx (solo chi è in campo e non espulso)
  const fieldMap = {};
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    if (!ms.expelled.has(pi)) fieldMap[pi] = pk;
  });
  const onFieldSet = new Set(Object.keys(fieldMap).map(Number));

  ms.myRoster.forEach((p, pi) => {
    if (!p) return;

    if (onFieldSet.has(pi)) {
      // ── IN CAMPO ──────────────────────────
      const pk = fieldMap[pi];

      // Moltiplicatore posizione (rilevante in contropiede)
      const posMult = (tactic === 'counter')
        ? (COUNTER_POS_MULT[pk] || 1.0)
        : 1.0;

      // Età: ogni anno oltre i 30 aumenta il drain del 12%
      const ageFactor = p.age > 30 ? 1 + (p.age - 30) * 0.12 : 1.0;

      // Forma fisica: giocatori in forma si stancano meno (range 0.55–1.0)
      const fitnessFactor = 0.55 + (p.fitness / 222);

      // Statistiche: SPE alto = atleta più efficiente (−10% al massimo)
      const speFactor = p.stats && p.stats.spe ? 1 - (p.stats.spe / 1000) : 1.0;

      const drain = STAMINA_BASE_DRAIN * tacticMult * posMult * ageFactor / fitnessFactor * speFactor * dtGame;
      ms.stamina[pi] = Math.max(0, ms.stamina[pi] - drain);

    } else {
      // ── IN PANCHINA o espulso: recupero graduale ──
      ms.stamina[pi] = Math.min(100, ms.stamina[pi] + STAMINA_BENCH_RECOVERY * dtGame);
    }
  });
}

// ── Efficacia giocatore in posizione ─────────
// Combina: malus fuori-ruolo × penalità mano/posizione
// Considera anche il secondo ruolo (bi-ruolo): usa il migliore tra i due
function _roleEffectiveness(player, posKey) {
  if (!player) return 0.5;
  const nativeRole = POS_NATIVE_ROLE[posKey];
  if (!nativeRole) return 1.0;

  // Calcola efficacia ruolo (considera anche secondRole se presente)
  function _roleAdj(role) {
    const adj = ROLE_ADJACENCY[role];
    return adj ? (adj[nativeRole] || 0.60) : 0.60;
  }
  let roleFactor = _roleAdj(player.role);
  if (player.secondRole) {
    roleFactor = Math.max(roleFactor, _roleAdj(player.secondRole));
  }

  // Penalità mano/posizione (AMB non ha penalità)
  const hand = player.hand || 'R';
  const handPenaltyMap = HAND_POS_PENALTY[hand] || HAND_POS_PENALTY['R'];
  const handFactor = handPenaltyMap[posKey] !== undefined ? handPenaltyMap[posKey] : 1.0;

  return roleFactor * handFactor;
}

// ── Genera evento di gioco ────────────────────
function generateMatchEvent(ms) {
  const tacticBoost = TACTIC_BOOST[ms.tactic] || 0;

  // Calcola forza effettiva: include malus fuori-ruolo e stamina
  let myEffective = 0;
  const activePlayers = [];
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const p = ms.myRoster[pi];
    if (!p || ms.expelled.has(pi)) return;
    const roleFactor    = _roleEffectiveness(p, pk);
    const staminaFactor = 0.6 + (ms.stamina[pi] / 100) * 0.4; // range 0.6-1.0
    const eff           = p.overall * roleFactor * staminaFactor;
    myEffective += eff;
    if (pk !== 'GK') activePlayers.push({ pk, pi, p, eff });
  });
  myEffective = (myEffective / 7) + tacticBoost;

  const oppStr = ms.oppTeam.str;
  const tot    = myEffective + oppStr;
  const myCh   = myEffective / tot;
  const r      = Math.random();

  // ── ATTACCO MIO ──────────────────────────
  if (r < myCh * 0.35) {
    ms.myShots++;
    if (!activePlayers.length) return null;

    // Probabilità di scelta proporzionale all'efficacia
    const attacker = _weightedPick(activePlayers, x => x.eff);
    const tec      = attacker.p.stats?.tec ?? 50; // Tecnica attaccante (0-100)

    // ── Passaggio sbagliato: tecnica bassa → più errori in costruzione ──
    // Prob errore passaggio: da ~15% (tec=0) a ~2% (tec=100)
    const passErrProb = 0.15 - (tec / 100) * 0.13;
    if (Math.random() < passErrProb) {
      return {
        txt: '❌ Palla persa — ' + attacker.p.name + ' sbaglia il passaggio',
        cls: 'fl',
        ballTarget: { x: rnd(3, 7) / 10, y: rnd(3, 7) / 10 },
      };
    }

    // ── Finalizzazione: tecnica influenza la prob gol ──
    // Bonus tecnica: da -0.04 (tec=0) a +0.04 (tec=100), centrato su tec=50
    const tecBonus  = (tec - 50) / 100 * 0.08;
    const goalProb  = 0.38 + ((myEffective - oppStr) / 250) + tecBonus;

    if (Math.random() < goalProb) {
      ms.myScore++;
      attacker.p.goals++;
      ms.matchGoals[attacker.pi] = (ms.matchGoals[attacker.pi] || 0) + 1;
      // Aggiorna parziale del periodo corrente
      if (ms.periodScores && ms.period >= 1 && ms.period <= 4) {
        ms.periodScores[ms.period - 1].my++;
      }
      const others = activePlayers.filter(x => x.pk !== attacker.pk);

      // ── Assist: giocatore con tecnica più alta ha più probabilità di servire ──
      const ast = others.length
        ? _weightedPick(others, x => 0.5 + (x.p.stats?.tec ?? 50) / 200)
        : null;
      if (ast) {
        ast.p.assists++;
        ms.matchAssists[ast.pi] = (ms.matchAssists[ast.pi] || 0) + 1;
      }
      return {
        txt: '⚽ GOL! ' + attacker.p.name + ' (#' + (ms.shirtNumbers[attacker.pi] || '?') + ') segna!' +
             (ast ? ' Assist: ' + ast.p.name : ''),
        cls: 'myg',
        ballTarget:  { x: 0.50, y: 0.05 },
        moverKey:    'my_' + attacker.pk,
        moverTarget: { x: MY_POS_MAP[attacker.pk]?.x || 0.5, y: 0.15 },
      };
    } else {
      const oppGk = ms.oppRoster.find(p => p.role === 'POR');
      return {
        txt: 'Tiro di ' + attacker.p.name + ' — parata' + (oppGk ? ' di ' + oppGk.name : ''),
        cls: '',
        ballTarget:  { x: 0.50, y: 0.12 },
        moverKey:    'my_' + attacker.pk,
        moverTarget: { x: MY_POS_MAP[attacker.pk]?.x || 0.5, y: 0.20 },
      };
    }
  }

  // ── ATTACCO AVVERSARIO ───────────────────
  if (r > 1 - (1 - myCh) * 0.35) {
    ms.oppShots++;
    const goalProb = 0.38 + ((oppStr - myEffective) / 250);
    if (Math.random() < goalProb) {
      ms.oppScore++;
      // Aggiorna parziale del periodo corrente
      if (ms.periodScores && ms.period >= 1 && ms.period <= 4) {
        ms.periodScores[ms.period - 1].opp++;
      }
      return { txt: '⚽ ' + ms.oppTeam.name + ' segna! Gol subito.', cls: 'og', ballTarget: { x: 0.50, y: 0.95 } };
    } else {
      const myGk = ms.myRoster[ms.onField['GK']];
      if (myGk) { ms.mySaves++; myGk.saves++; }
      return {
        txt: 'Parata' + (myGk ? ' di ' + myGk.name : '') + '!',
        cls: 'sv', ballTarget: { x: 0.50, y: 0.88 },
      };
    }
  }

  // ── EVENTO NEUTRO / FALLO ────────────────
  // Hard cap: se siamo già al massimo di espulsi non ci sono altri falli
  const foulProb = BASE_FOUL_PROB * (TACTIC_FOUL_MULT[ms.tactic] || 1.0);
  if (ms.expelled.size < MAX_EXPELLED && Math.random() < foulProb && activePlayers.length) {
    ms.myFouls++;

    // Selezione pesata: giocatori già ammoniti hanno peso minore
    const foulCandidates = activePlayers.map(x => ({
      ...x,
      foulWeight: YELLOW_WEIGHTS[Math.min(ms.tempExp[x.pi] || 0, 2)],
    })).filter(x => (ms.tempExp[x.pi] || 0) < MAX_TEMP_EXP);

    if (!foulCandidates.length) return { txt: pick(NEUTRAL_EVENTS), cls: '', ballTarget: { x: 0.5, y: 0.5 } };

    const fp    = _weightedPick(foulCandidates, x => x.foulWeight);
    const pi    = fp.pi;
    const shirt = ms.shirtNumbers[pi] || '?';
    ms.tempExp[pi] = (ms.tempExp[pi] || 0) + 1;
    const count = ms.tempExp[pi];

    if (count >= MAX_TEMP_EXP) {
      ms.expelled.add(pi);
      return {
        txt: '🔴 ESPULSO! ' + fp.p.name + ' (#' + shirt + ') — 3ª espulsione temporanea.',
        cls: 'exp',
        expelled: pi,
        moverKey: 'my_' + fp.pk,
      };
    } else {
      return {
        txt: '🟡 Esp. temporanea (' + count + '/3) — ' + fp.p.name + ' (#' + shirt + ')',
        cls: 'fl',
        ballTarget: { x: rnd(3, 7) / 10, y: rnd(3, 7) / 10 },
      };
    }
  }

  return { txt: pick(NEUTRAL_EVENTS), cls: '', ballTarget: { x: rnd(3, 7) / 10, y: rnd(3, 7) / 10 } };
}

// ── Selezione pesata da array ─────────────────
function _weightedPick(arr, weightFn) {
  let total = 0;
  arr.forEach(x => { total += weightFn(x); });
  let r = Math.random() * total;
  for (const x of arr) { r -= weightFn(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
}

// ── Formatta mm:ss ────────────────────────────
function formatMatchTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// ── Effettua un cambio ────────────────────────
function performSubstitution(ms, outPosKey, inRosterIdx) {
  const outRosterIdx = ms.onField[outPosKey];
  if (outRosterIdx === undefined) return null;
  const outPlayer = ms.myRoster[outRosterIdx];
  const inPlayer  = ms.myRoster[inRosterIdx];
  if (!outPlayer || !inPlayer) return null;
  ms.onField[outPosKey] = inRosterIdx;
  ms.bench = ms.bench.filter(i => i !== inRosterIdx);
  ms.bench.push(outRosterIdx);
  ms.subs++;
  return { outPlayer, inPlayer, posKey: outPosKey, outRosterIdx, inRosterIdx };
}

// ── Cambio forzato per espulsione definitiva ──
function forceSubstitutionExpelled(ms, expelledRosterIdx) {
  const posKey = Object.entries(ms.onField).find(([, pi]) => pi === expelledRosterIdx)?.[0];
  if (!posKey) return null;
  ms.bench.push(expelledRosterIdx);
  const sub = ms.bench.find(i =>
    i !== expelledRosterIdx && !ms.expelled.has(i) &&
    (posKey === 'GK' ? ms.myRoster[i]?.role === 'POR' : ms.myRoster[i]?.role !== 'POR')
  );
  if (sub !== undefined) {
    ms.onField[posKey] = sub;
    ms.bench = ms.bench.filter(i => i !== sub);
    ms.subs++;
    return { posKey, inPlayer: ms.myRoster[sub], outPlayer: ms.myRoster[expelledRosterIdx] };
  } else {
    delete ms.onField[posKey];
    return { posKey, inPlayer: null, outPlayer: ms.myRoster[expelledRosterIdx] };
  }
}

function getFinalScore(ms) {
  return {
    home: ms.isHome ? ms.myScore : ms.oppScore,
    away: ms.isHome ? ms.oppScore : ms.myScore,
  };
}

function getMatchReward(myScore, oppScore) {
  if (myScore > oppScore) return 75000;
  if (myScore === oppScore) return 25000;
  return 0;
}
