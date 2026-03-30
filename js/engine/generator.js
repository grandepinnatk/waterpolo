// ─────────────────────────────────────────────
// engine/generator.js
// Generazione procedurale: giocatori, rose, calendario
// ─────────────────────────────────────────────
// Usa ITALIAN_FIRST_NAMES e ITALIAN_LAST_NAMES da js/data/names.js

const NATIONALITIES = ['ITA','ITA','ITA','ITA','CRO','SRB','HUN','GRE','MNE'];

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

  // Nome: Iniziale nome + Cognome (es. "M. Rossi")
  const firstName = pick(ITALIAN_FIRST_NAMES);
  const lastName  = pick(ITALIAN_LAST_NAMES);
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
    nat:       pick(NATIONALITIES),
    value:     Math.round(base * rnd(5000, 9000)),
    salary:    Math.round(base * rnd(250, 550)),
    morale:    rnd(65, 100),
    fitness:   rnd(70, 100),
    // statistiche stagionali
    goals: 0, assists: 0, saves: 0,
    // attributi tecnici
    stats: {
      att: cap(base + rnd(-8, 8)),
      def: cap(base + rnd(-8, 8)),
      spe: cap(base + rnd(-8, 8)),
      str: cap(base + rnd(-8, 8)),
    },
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
function generateSchedule(teams) {
  const ids = teams.map(t => t.id);
  const matches = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      matches.push({ home: ids[i], away: ids[j], played: false, score: null });
      matches.push({ home: ids[j], away: ids[i], played: false, score: null });
    }
  }
  matches.sort(() => Math.random() - 0.5);
  const perRound = ids.length / 2;
  matches.forEach((m, i) => { m.round = Math.floor(i / perRound) + 1; });
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
