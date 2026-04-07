// ─────────────────────────────────────────────
// engine/generator.js
// Generazione procedurale: giocatori, rose, calendario
// ─────────────────────────────────────────────
// Usa NAMES_BY_NAT da js/data/names.js per liste per nazionalità

// Pesi nazionalità: ITA preponderante, con presenze realiste delle altre
const NATIONALITIES = ['ITA','ITA','ITA','ITA','ITA','CRO','SRB','HUN','GRE','MNE','ESP'];

// ── Helpers ──────────────────────────────────
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(n)    { return Math.min(100, Math.max(0, Math.round(n))); }

// ── Ruoli che un giocatore può coprire ────────
// ~10% dei giocatori ha un secondo ruolo (bi-ruolo)
const SECONDARY_ROLE_MAP = {
  DIF: ['CEN'],
  CEN: ['DIF','ATT'],
  ATT: ['CEN','CB'],
  CB:  ['ATT'],
  POR: [],
};

function _pickSecondaryRole(primaryRole) {
  const options = SECONDARY_ROLE_MAP[primaryRole] || [];
  if (!options.length || Math.random() > 0.10) return null; // 10% chance bi-ruolo
  return pick(options);
}

// ── Generazione singolo giocatore ────────────
function generatePlayer(teamStrength, role) {
  const base = cap(teamStrength + rnd(-18, 10));
  const age  = rnd(18, 35);

  // Mano dominante: 70% destri, 25% mancini, 5% ambidestri
  const r = Math.random();
  const hand = r < 0.05 ? 'AMB' : r < 0.30 ? 'L' : 'R';

  // Bi-ruolo: ~10% dei giocatori
  const secondRole = _pickSecondaryRole(role);

  // Nazionalità: generata prima del nome per poter usare le liste corrette
  const nat = pick(NATIONALITIES);

  // Nome: usa liste per nazionalità, formato "I. Cognome"
  const natData   = (typeof NAMES_BY_NAT !== 'undefined' && NAMES_BY_NAT[nat]) ? NAMES_BY_NAT[nat] : { first: ITALIAN_FIRST_NAMES, last: ITALIAN_LAST_NAMES };
  const firstName = pick(natData.first);
  const lastName  = pick(natData.last);
  const name = firstName[0] + '. ' + lastName;

  return {
    name,
    firstName,
    lastName,
    age,
    role,
    secondRole,   // null o ruolo secondario
    hand,         // 'R', 'L', 'AMB'
    overall:   base,
    potential: Math.min(99, base + rnd(0, age < 23 ? 10 : 0)),
    nat,
    value:     Math.round(base * rnd(5000, 9000)),
    salary:    Math.round(base * rnd(250, 550)),
    contractYears: Math.floor(Math.random() * 4) + 1, // durata contratto 1-4 anni
    morale:    rnd(65, 100),
    fitness:   rnd(70, 100),
    // statistiche stagionali
    goals: 0, assists: 0, saves: 0,
    // attributi tecnici
    stats: {
      att: cap(base + rnd(-8, 8)),
      def: cap(base + rnd(-8, 8)),
      spe: cap(base + rnd(-8, 8)),  // VEL — velocità in campo
      str: cap(base + rnd(-8, 8)),
      tec: cap(base + rnd(-8, 8)),  // TEC — tecnica
      res: cap(base + rnd(-8, 8)),  // RES — resistenza fisica (influenza stamina drain)
    },
    // Massimo di Tecnica raggiungibile con l'allenamento (attributo nascosto)
    // Range: overall - 5 ... min(99, overall + 15 + bonus giovani)
    maxTec: Math.min(99, cap(base + rnd(-5, 15) + (age < 24 ? rnd(0, 8) : 0))),
    // Età massima di ritiro (attributo nascosto, non visibile al giocatore)
    // Distribuzione normale approssimata: media 35, σ≈2, range 32-40
    // Probabilità di infortunio per partita (attributo nascosto, 0.02-0.15)
    // Distribuzione: la maggior parte dei giocatori ha bassa prob (~0.03-0.06),
    // pochi hanno alta fragilità (~0.10-0.15). Usa distribuzione esponenziale troncata.
    injProb: (function() {
      // Valore base esponenziale: la maggioranza cade sotto 0.07
      const raw = -Math.log(1 - Math.random()) * 0.045;
      return Math.round(Math.max(0.02, Math.min(0.15, raw)) * 1000) / 1000;
    })(),
    retirementAge: (function() {
      // Box-Muller semplificato per distribuzione normale
      const u1 = Math.random(), u2 = Math.random();
      const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return Math.round(Math.max(32, Math.min(40, 35 + z * 2)));
    })(),
  };
}

// ── Generazione rosa ──────────────────────────
// 2 POR · 3 DIF · 3 CEN · 4 ATT · 2 CB · 1 DIF extra
function generateRoster(team) {
  const roster = [];
  roster.push(generatePlayer(team.str, 'POR'));
  roster.push(generatePlayer(team.str, 'POR'));
  for (let i = 0; i < 3; i++) roster.push(generatePlayer(team.str, 'DIF'));
  for (let i = 0; i < 3; i++) roster.push(generatePlayer(team.str, 'CEN'));
  for (let i = 0; i < 4; i++) roster.push(generatePlayer(team.str, 'ATT'));
  for (let i = 0; i < 2; i++) roster.push(generatePlayer(team.str, 'CB'));
  roster.push(generatePlayer(team.str, 'DIF'));
  return roster;
}

// ── Generazione calendario (andata + ritorno) ─
// Algoritmo round-robin di Berger: garantisce che ogni squadra
// giochi esattamente UNA partita per giornata.
// Con N squadre (pari) → N-1 giornate di andata, N-1 di ritorno = 2(N-1) totale.
function generateSchedule(teams) {
  const ids    = [...teams.map(t => t.id)];
  const N      = ids.length; // deve essere pari (14 squadre)
  const rounds = N - 1;      // 13 giornate di andata

  // Algoritmo: fissa ids[0], ruota gli altri
  const fixed   = ids[0];
  const rotating = ids.slice(1);
  const andataRounds = [];

  for (let r = 0; r < rounds; r++) {
    const round = [];
    // Partita con il fisso
    const opp = rotating[r % rotating.length];
    if (r % 2 === 0) round.push({ home: fixed, away: opp });
    else             round.push({ home: opp,   away: fixed });
    // Altre N/2 - 1 partite
    for (let k = 1; k < N / 2; k++) {
      const a = rotating[(r + k) % rotating.length];
      const b = rotating[(r + rotating.length - k) % rotating.length];
      if (k % 2 === 0) round.push({ home: a, away: b });
      else             round.push({ home: b, away: a });
    }
    andataRounds.push(round);
  }

  // Ritorno: inverti casa/trasferta e aggiungi sfasamento casuale
  const ritornoRounds = andataRounds.map(round =>
    round.map(m => ({ home: m.away, away: m.home }))
  );

  // Mescola leggermente l'ordine delle giornate (non delle partite dentro la giornata)
  const shuffleRounds = arr => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const allRounds = [...shuffleRounds(andataRounds), ...shuffleRounds(ritornoRounds)];

  // Appiattisci in lista match con numero giornata
  const matches = [];
  allRounds.forEach((round, ri) => {
    round.forEach(m => {
      matches.push({ home: m.home, away: m.away, played: false, score: null, round: ri + 1 });
    });
  });

  return matches;
}

// ── Inizializzazione classifica ───────────────
function initStandings(teams) {
  const table = {};
  teams.forEach(t => {
    table[t.id] = { id:t.id, name:t.name, abbr:t.abbr, tier:t.tier,
                    g:0, w:0, d:0, l:0, gf:0, ga:0, pts:0 };
  });
  return table;
}

// ── Inizializzazione obiettivi ────────────────
function initObjectives(tier) {
  const list = OBJECTIVES_BY_TIER[tier] || OBJECTIVES_BY_TIER.C;
  return list.map(o => ({ ...o, achieved: false, failed: false, progress: 0 }));
}
