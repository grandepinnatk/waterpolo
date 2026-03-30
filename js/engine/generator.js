// ─────────────────────────────────────────────
// engine/generator.js
// Generazione procedurale: giocatori, rose, calendario
// ─────────────────────────────────────────────

const FIRST_NAMES = ['Marco','Luca','Andrea','Davide','Francesco','Matteo','Pietro',
  'Giacomo','Alberto','Lorenzo','Nicola','Stefano','Paolo','Simone','Roberto',
  'Alessandro','Federico','Riccardo','Emanuele','Gianluca','Vittorio','Tommaso'];

const LAST_NAMES = ['Rossi','Ferrari','Russo','Bianchi','Conti','Esposito','Romano',
  'Greco','Bruno','Gallo','De Luca','Ricci','Marino','Colombo','Mancini',
  'Barbieri','Fontana','Ferrara','Vitale','Caruso','Pellegrini','Lombardi'];

const NATIONALITIES = ['ITA','ITA','ITA','ITA','CRO','SRB','HUN','GRE'];

// ── Helpers ──────────────────────────────────
function rnd(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(n)    { return Math.min(100, Math.max(0, Math.round(n))); }

// ── Generazione singolo giocatore ────────────
function generatePlayer(teamStrength, role) {
  const base = cap(teamStrength + rnd(-18, 10));
  const age  = rnd(18, 35);
  const hand = Math.random() < 0.25 ? 'L' : 'R'; // 25% mancini

  return {
    name:      pick(FIRST_NAMES) + ' ' + pick(LAST_NAMES),
    age,
    role,
    hand,
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

// ── Generazione rosa (15 giocatori) ──────────
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
// Algoritmo round-robin: ogni coppia di squadre
// si affronta due volte (home/away invertiti).
function generateSchedule(teams) {
  const ids = teams.map(t => t.id);
  const matches = [];

  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      matches.push({ home: ids[i], away: ids[j], played: false, score: null });
      matches.push({ home: ids[j], away: ids[i], played: false, score: null });
    }
  }

  // Distribuisce casualmente in giornate
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
