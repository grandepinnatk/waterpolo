// ─────────────────────────────────────────────
// engine/match.js  — Motore partita
// ─────────────────────────────────────────────

const PERIOD_SECONDS = 8 * 60;
const TOTAL_PERIODS  = 4;
const MAX_TEMP_EXP   = 3;   // espulsioni temporanee → espulsione definitiva

const TACTIC_BOOST = {
  balanced: 0, attack: 8, defense: -5, counter: 3, press: 5,
};

const NEUTRAL_EVENTS = [
  'Azione di attacco neutralizzata', 'Contrattacco sventato',
  'Rimessa in gioco', 'Cambio possesso palla',
  'Superiorità numerica gestita', 'Tiro fuori misura', 'Fallo in attacco',
];

// ── Crea lo stato iniziale di una partita ────
function createMatchState({ match, isHome, myTeam, oppTeam, myRoster, oppRoster, formation, shirtNumbers }) {
  const onFieldIdxs = new Set(Object.values(formation));
  const bench = myRoster.map((_, i) => i).filter(i => !onFieldIdxs.has(i));

  // tempExp: { rosterIdx → contatore espulsioni temporanee }
  const tempExp = {};
  myRoster.forEach((_, i) => { tempExp[i] = 0; });

  // expelled: set di rosterIdx definitivamente espulsi (3 gialli)
  const expelled = new Set();

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
    // numeri di maglia { rosterIdx → numero }
    shirtNumbers: shirtNumbers || {},
    // espulsioni temporanee
    tempExp,
    expelled,
    // velocità simulazione (moltiplicatore su dt)
    speed: 1,
  };
}

// ── Avanza il tempo ───────────────────────────
function advanceTime(ms, dt) {
  ms.totalSeconds += dt * ms.speed;
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

// ── Genera evento di gioco ────────────────────
function generateMatchEvent(ms) {
  const boost  = TACTIC_BOOST[ms.tactic] || 0;
  const myStr  = ms.myTeam.str + boost;
  const oppStr = ms.oppTeam.str;
  const tot    = myStr + oppStr;
  const myCh   = myStr / tot;
  const r      = Math.random();

  // Giocatori in campo non espulsi
  const activePlayers = Object.entries(ms.onField)
    .filter(([pk]) => pk !== 'GK')
    .map(([pk, pi]) => ({ pk, pi, p: ms.myRoster[pi] }))
    .filter(x => x.p && !ms.expelled.has(x.pi));

  // ── ATTACCO MIO ──────────────────────────
  if (r < myCh * 0.35) {
    ms.myShots++;
    if (!activePlayers.length) return null;
    const attacker  = pick(activePlayers);
    const goalProb  = 0.38 + ((myStr - oppStr) / 250);

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
        ballTarget: { x: 0.50, y: 0.05 },
        moverKey: 'my_' + attacker.pk,
        moverTarget: { x: MY_POS_MAP[attacker.pk]?.x || 0.5, y: 0.15 },
      };
    } else {
      const oppGk = ms.oppRoster.find(p => p.role === 'POR');
      return {
        txt: 'Tiro di ' + attacker.p.name + ' — parata' + (oppGk ? ' di ' + oppGk.name : ''),
        cls: '',
        ballTarget: { x: 0.50, y: 0.12 },
        moverKey: 'my_' + attacker.pk,
        moverTarget: { x: MY_POS_MAP[attacker.pk]?.x || 0.5, y: 0.20 },
      };
    }
  }

  // ── ATTACCO AVVERSARIO ───────────────────
  if (r > 1 - (1 - myCh) * 0.35) {
    ms.oppShots++;
    const goalProb = 0.38 + ((oppStr - myStr) / 250);
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
  if (Math.random() < 0.28 && activePlayers.length) {
    ms.myFouls++;
    const fp  = pick(activePlayers);
    const pi  = fp.pi;
    ms.tempExp[pi] = (ms.tempExp[pi] || 0) + 1;
    const count = ms.tempExp[pi];
    const shirt = ms.shirtNumbers[pi] || '?';

    if (count >= MAX_TEMP_EXP) {
      // Espulsione definitiva
      ms.expelled.add(pi);
      return {
        txt: '🔴 ESPULSO! ' + fp.p.name + ' (#' + shirt + ') — 3 espulsioni temporanee. Va in panchina.',
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

// ── Forza un cambio per espulsione definitiva ─
// Sposta il giocatore in panchina, mette il primo sostituto disponibile
// (se disponibile), altrimenti la posizione rimane scoperta.
function forceSubstitutionExpelled(ms, expelledRosterIdx) {
  // Trova la posizione del giocatore espulso
  const posKey = Object.entries(ms.onField).find(([, pi]) => pi === expelledRosterIdx)?.[0];
  if (!posKey) return null;
  // Sposta in panchina
  ms.bench.push(expelledRosterIdx);
  // Cerca sostituto non espulso in panchina
  const sub = ms.bench.find(i => i !== expelledRosterIdx && !ms.expelled.has(i) &&
    (posKey === 'GK' ? ms.myRoster[i].role === 'POR' : ms.myRoster[i].role !== 'POR'));
  if (sub !== undefined) {
    ms.onField[posKey] = sub;
    ms.bench = ms.bench.filter(i => i !== sub);
    ms.subs++;
    return { posKey, inPlayer: ms.myRoster[sub], outPlayer: ms.myRoster[expelledRosterIdx] };
  } else {
    // Nessun sostituto disponibile: posizione aperta
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
