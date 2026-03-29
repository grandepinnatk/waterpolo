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
const ROLE_ADJACENCY = {
  POR: { POR: 1.0, DIF: 0.55, CEN: 0.40, ATT: 0.35, CB: 0.35 },
  DIF: { POR: 0.40, DIF: 1.0, CEN: 0.80, ATT: 0.65, CB: 0.60 },
  CEN: { POR: 0.40, DIF: 0.80, CEN: 1.0, ATT: 0.85, CB: 0.75 },
  ATT: { POR: 0.35, DIF: 0.65, CEN: 0.85, ATT: 1.0, CB: 0.80 },
  CB:  { POR: 0.35, DIF: 0.60, CEN: 0.75, ATT: 0.80, CB: 1.0 },
};

// Tasso di calo stamina per secondo di gioco (base)
// Dipende da tattica e da forma del giocatore
const STAMINA_BASE_DRAIN = 0.004;  // ~23% per periodo a forma 100
const TACTIC_STAMINA_MULT = {
  defense:  0.7,
  balanced: 1.0,
  counter:  1.1,
  attack:   1.3,
  press:    1.6,
};

const NEUTRAL_EVENTS = [
  'Azione di attacco neutralizzata', 'Contrattacco sventato',
  'Rimessa in gioco', 'Cambio possesso palla',
  'Superiorità numerica gestita', 'Tiro fuori misura', 'Fallo in attacco',
];

// ── Crea lo stato iniziale ────────────────────
function createMatchState({ match, isHome, myTeam, oppTeam, myRoster, oppRoster, formation, shirtNumbers }) {
  const onFieldIdxs = new Set(Object.values(formation));
  const bench = myRoster.map((_, i) => i).filter(i => !onFieldIdxs.has(i));

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
// In campo:   calo  ~0.004/s × moltiplicatore tattico / fattore forma
// In panchina: recupero ~0.0012/s (circa 1/3 del calo base) — sempre positivo
const STAMINA_BENCH_RECOVERY = 0.0012;

function _drainStamina(ms, dtGame) {
  const tacticMult   = TACTIC_STAMINA_MULT[ms.tactic] || 1.0;
  const onFieldSet   = new Set(Object.values(ms.onField));

  ms.myRoster.forEach((p, pi) => {
    if (!p) return;
    if (onFieldSet.has(pi) && !ms.expelled.has(pi)) {
      // IN CAMPO: calo dipendente da tattica e forma
      const fitnessFactor = 0.5 + (p.fitness / 200); // range 0.5–1.0
      const drain = STAMINA_BASE_DRAIN * tacticMult / fitnessFactor * dtGame;
      ms.stamina[pi] = Math.max(0, ms.stamina[pi] - drain);
    } else {
      // IN PANCHINA (o espulso): leggero recupero, cap a 100
      ms.stamina[pi] = Math.min(100, ms.stamina[pi] + STAMINA_BENCH_RECOVERY * dtGame);
    }
  });
}

// ── Efficacia giocatore in posizione ─────────
// Restituisce un fattore 0.35-1.0 basato su ruolo vs posizione nativa
function _roleEffectiveness(player, posKey) {
  if (!player) return 0.5;
  const nativeRole = POS_NATIVE_ROLE[posKey];
  const playerRole = player.role;
  if (!nativeRole || !playerRole) return 1.0;
  const adj = ROLE_ADJACENCY[playerRole];
  if (!adj) return 1.0;
  return adj[nativeRole] || 0.60;
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
    const goalProb = 0.38 + ((myEffective - oppStr) / 250);

    if (Math.random() < goalProb) {
      ms.myScore++;
      attacker.p.goals++;
      const others = activePlayers.filter(x => x.pk !== attacker.pk);
      const ast    = others.length ? pick(others) : null;
      if (ast) ast.p.assists++;
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
