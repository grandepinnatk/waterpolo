// ─────────────────────────────────────────────
// engine/standings.js
// Classifica, aggiornamento risultati, simulazione partite
// ─────────────────────────────────────────────

// ── Simulazione risultato ─────────────────────
// Usa forza delle squadre + varianza casuale.
// boost: modificatore tattico del coach (+/- punti forza)
function simulateResult(homeTeam, awayTeam, boost = 0) {
  const hStr = homeTeam.str + rnd(-8, 8) + 3 + boost; // +3 fattore campo
  const aStr = awayTeam.str + rnd(-8, 8);
  const tot  = hStr + aStr;
  const home = Math.max(0, Math.round((hStr / tot) * rnd(6, 18) * rnd(8, 14) / 10));
  const away = Math.max(0, Math.round((aStr / tot) * rnd(6, 18) * rnd(8, 14) / 10));
  return { home, away };
}

// ── Aggiornamento classifica dopo una partita ─
function updateStandings(standings, homeId, awayId, score) {
  const h = standings[homeId];
  const a = standings[awayId];
  h.g++; a.g++;
  h.gf += score.home; h.ga += score.away;
  a.gf += score.away; a.ga += score.home;
  if (score.home > score.away) { h.w++; h.pts += 3; a.l++; }
  else if (score.home < score.away) { a.w++; a.pts += 3; h.l++; }
  else { h.d++; a.d++; h.pts++; a.pts++; }
}

// ── Classifica ordinata ───────────────────────
// Criteri: punti > differenza reti > gol fatti
function getSortedStandings(standings) {
  return Object.values(standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const drA = a.gf - a.ga, drB = b.gf - b.ga;
    if (drB !== drA) return drB - drA;
    return b.gf - a.gf;
  });
}

// ── Posizione di una squadra ──────────────────
function getTeamPosition(standings, teamId) {
  return getSortedStandings(standings).findIndex(s => s.id === teamId) + 1;
}

// ── Simula tutte le partite di una giornata ───
// Salta le partite del giocatore (home o away = myId)
function simulateRound(schedule, standings, teams, roundNum, myId) {
  const roundMatches = schedule.filter(m => m.round === roundNum && !m.played);
  roundMatches.forEach(m => {
    if (m.home === myId || m.away === myId) return; // partita del giocatore → skip
    const hT = teams.find(t => t.id === m.home);
    const aT = teams.find(t => t.id === m.away);
    m.score  = simulateResult(hT, aT);
    m.played = true;
    updateStandings(standings, m.home, m.away, m.score);
  });
}

// ── Simula tutte le rimanenti (campionato rapido) ─
function simulateAllRemaining(schedule, standings, teams, myId) {
  schedule
    .filter(m => !m.played && m.home !== myId && m.away !== myId)
    .forEach(m => {
      const hT = teams.find(t => t.id === m.home);
      const aT = teams.find(t => t.id === m.away);
      m.score  = simulateResult(hT, aT);
      m.played = true;
      updateStandings(standings, m.home, m.away, m.score);
    });
}

// ── Verifica e finalizza obiettivi ───────────
function checkObjectivesProgress(objectives, standings, myId, playoffResult) {
  const pos = getTeamPosition(standings, myId);
  const ms  = standings[myId];
  objectives.forEach(o => {
    if (o.achieved || o.failed) return;
    if (o.type === 'position') o.progress = pos;
    if (o.type === 'wins')     o.progress = ms.w;
    if (o.type === 'goals')    o.progress = ms.gf;
    if (o.type === 'survive')  o.progress = pos <= 12 ? 1 : 0;
    if (o.type === 'champion') o.progress = playoffResult === 'champion' ? 1 : 0;
  });
}

function finalizeObjectives(objectives, standings, myId, playoffResult) {
  const pos = getTeamPosition(standings, myId);
  const ms  = standings[myId];
  let totalReward = 0;

  objectives.forEach(o => {
    if (o.achieved) return;
    switch (o.type) {
      case 'champion': o.achieved = (playoffResult === 'champion'); break;
      case 'position': o.achieved = (pos <= o.target); break;
      case 'survive':  o.achieved = (pos <= 12); break;
      case 'wins':     o.achieved = (ms.w >= (o.target || 0)); break;
      case 'goals':    o.achieved = (ms.gf >= (o.target || 0)); break;
    }
    if (o.achieved) totalReward += o.reward;
    else            o.failed = true;
  });

  return totalReward;
}
