// ─────────────────────────────────────────────
// engine/match.js
// Motore partita: inizializzazione, eventi di gioco,
// timer, gestione cambi.
// NON gestisce rendering — solo stato e logica.
// ─────────────────────────────────────────────

const PERIOD_SECONDS = 8 * 60; // 8 minuti per periodo
const TOTAL_PERIODS  = 4;

// Modificatori tattici applicati alla forza della squadra
const TACTIC_BOOST = {
  balanced: 0,
  attack:   8,
  defense: -5,
  counter:  3,
  press:    5,
};

// Frasi neutre per eventi non determinanti
const NEUTRAL_EVENTS = [
  'Azione di attacco neutralizzata',
  'Contrattacco sventato',
  'Rimessa in gioco',
  'Cambio possesso palla',
  'Espulsione temporanea',
  'Superiorità numerica gestita',
  'Tiro fuori misura',
  'Fallo in attacco',
];

// ── Crea lo stato iniziale di una partita ─────
function createMatchState({ match, isHome, myTeam, oppTeam, myRoster, oppRoster, formation }) {
  // bench = tutti i giocatori non in formazione
  const onFieldIdxs = new Set(Object.values(formation));
  const bench = myRoster.map((_, i) => i).filter(i => !onFieldIdxs.has(i));

  return {
    // metadati
    match, isHome, myTeam, oppTeam,
    // formazione { posKey → rosterIdx }
    onField: { ...formation },
    bench,
    // punteggio
    myScore:  0,
    oppScore: 0,
    // tempo
    period:       1,
    totalSeconds: 0,
    running:      false,
    finished:     false,
    // statistiche
    myShots:  0,
    oppShots: 0,
    mySaves:  0,
    myFouls:  0,
    // tattica
    tactic: 'balanced',
    // log azioni
    actions: [],
    // rose
    myRoster,
    oppRoster,
    // cambi (illimitati in pallanuoto)
    subs:   0,
    subOut: null,
    subIn:  null,
    // timer tra un evento e il successivo
    lastActionTime: 0,
    nextActionIn:   rnd(4, 9),
    // playoff (null in regular season)
    poType:  null,
    poMatch: null,
  };
}

// ── Avanza il tempo e verifica fine periodo ───
// Ritorna { periodEnded, matchEnded }
function advanceTime(ms, dt) {
  ms.totalSeconds += dt;
  const curPeriodSec = ms.totalSeconds - (ms.period - 1) * PERIOD_SECONDS;

  if (curPeriodSec >= PERIOD_SECONDS) {
    if (ms.period < TOTAL_PERIODS) {
      ms.period++;
      return { periodEnded: true, matchEnded: false };
    } else {
      ms.finished = true;
      ms.running  = false;
      return { periodEnded: true, matchEnded: true };
    }
  }
  return { periodEnded: false, matchEnded: false };
}

// ── Genera un evento di gioco ─────────────────
// Ritorna un oggetto { txt, cls, scoreDelta }
// scoreDelta: { my: +1 } o { opp: +1 } o null
function generateMatchEvent(ms) {
  const boost  = TACTIC_BOOST[ms.tactic] || 0;
  const myStr  = ms.myTeam.str + boost;
  const oppStr = ms.oppTeam.str;
  const tot    = myStr + oppStr;
  const myCh   = myStr / tot;
  const r      = Math.random();

  // ── Attacco mio ──────────────────────────
  if (r < myCh * 0.35) {
    ms.myShots++;
    const fieldPlayers = Object.entries(ms.onField)
      .filter(([pk]) => pk !== 'GK')
      .map(([pk, pi]) => ({ pk, pi, p: ms.myRoster[pi] }))
      .filter(x => x.p);

    if (!fieldPlayers.length) return null;
    const attacker = pick(fieldPlayers);
    const goalProb = 0.38 + ((myStr - oppStr) / 250);

    if (Math.random() < goalProb) {
      ms.myScore++;
      attacker.p.goals++;
      const others = fieldPlayers.filter(x => x.pk !== attacker.pk);
      const ast    = others.length ? pick(others) : null;
      if (ast) ast.p.assists++;
      return {
        txt:  '⚽ GOL! ' + attacker.p.name + ' segna!' + (ast ? ' Assist: ' + ast.p.name : ''),
        cls:  'myg',
        ballTarget: { x: 0.50, y: 0.05 },
        moverKey: 'my_' + attacker.pk,
        moverTarget: { x: MY_POS_MAP[attacker.pk]?.x || 0.5, y: 0.15 },
      };
    } else {
      const oppGk = ms.oppRoster.find(p => p.role === 'POR');
      return {
        txt:  'Tiro di ' + attacker.p.name + ' — parata' + (oppGk ? ' di ' + oppGk.name : ''),
        cls:  '',
        ballTarget: { x: 0.50, y: 0.12 },
        moverKey: 'my_' + attacker.pk,
        moverTarget: { x: MY_POS_MAP[attacker.pk]?.x || 0.5, y: 0.20 },
      };
    }
  }

  // ── Attacco avversario ────────────────────
  if (r > 1 - (1 - myCh) * 0.35) {
    ms.oppShots++;
    const oppPos = OPP_POS[pick(Object.keys(OPP_POS).filter(k => k !== 'GK'))];
    const goalProb = 0.38 + ((oppStr - myStr) / 250);

    if (Math.random() < goalProb) {
      ms.oppScore++;
      return {
        txt:  '⚽ ' + ms.oppTeam.name + ' segna! Gol subito.',
        cls:  'og',
        ballTarget: { x: 0.50, y: 0.95 },
      };
    } else {
      const myGk = ms.myRoster[ms.onField['GK']];
      if (myGk) { ms.mySaves++; myGk.saves++; }
      return {
        txt:  'Parata' + (myGk ? ' di ' + myGk.name : '') + '! Ottima risposta.',
        cls:  'sv',
        ballTarget: { x: 0.50, y: 0.88 },
      };
    }
  }

  // ── Evento neutro ─────────────────────────
  if (Math.random() < 0.28) {
    ms.myFouls++;
    const fieldPlayers = Object.entries(ms.onField)
      .filter(([pk]) => pk !== 'GK')
      .map(([, pi]) => ms.myRoster[pi])
      .filter(Boolean);
    const fp = fieldPlayers.length ? pick(fieldPlayers) : null;
    return {
      txt: '🟡 Fallo di ' + (fp ? fp.name : 'un giocatore') + ' — superiorità avversaria',
      cls: 'fl',
      ballTarget: { x: rnd(3, 7) / 10, y: rnd(3, 7) / 10 },
    };
  }

  return {
    txt: pick(NEUTRAL_EVENTS),
    cls: '',
    ballTarget: { x: rnd(3, 7) / 10, y: rnd(3, 7) / 10 },
  };
}

// ── Formatta timestamp mm:ss ──────────────────
function formatMatchTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// ── Effettua un cambio ────────────────────────
// Ritorna { outPlayer, inPlayer } o null se non valido
function performSubstitution(ms, outPosKey, inRosterIdx) {
  const outRosterIdx = ms.onField[outPosKey];
  if (outRosterIdx === undefined) return null;

  const outPlayer = ms.myRoster[outRosterIdx];
  const inPlayer  = ms.myRoster[inRosterIdx];
  if (!outPlayer || !inPlayer) return null;

  // Aggiorna formazione e panchina
  ms.onField[outPosKey] = inRosterIdx;
  ms.bench = ms.bench.filter(i => i !== inRosterIdx);
  ms.bench.push(outRosterIdx);
  ms.subs++;

  return { outPlayer, inPlayer, posKey: outPosKey };
}

// ── Calcola il risultato finale ───────────────
function getFinalScore(ms) {
  return {
    home: ms.isHome ? ms.myScore : ms.oppScore,
    away: ms.isHome ? ms.oppScore : ms.myScore,
  };
}

// ── Premi vittoria/pareggio ───────────────────
function getMatchReward(myScore, oppScore) {
  if (myScore > oppScore) return 75000;
  if (myScore === oppScore) return 25000;
  return 0;
}
