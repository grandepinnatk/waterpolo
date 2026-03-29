// ─────────────────────────────────────────────
// ui/match.js
// Schermata partita live: rendering, controlli,
// pannello cambi. Usa il motore in engine/match.js
// e il renderer in canvas/pool.js.
// ─────────────────────────────────────────────

let _animReqId = null;
let _lastFrameT = null;

// ── Avvia una partita live ────────────────────
function startLiveMatch(match, isHome, opp, poType = null, poMatch = null) {
  // Crea lo stato partita tramite il motore
  G.ms = createMatchState({
    match, isHome,
    myTeam:   G.myTeam,
    oppTeam:  opp,
    myRoster:  G.rosters[G.myId],
    oppRoster: G.rosters[opp.id],
    formation: G.lineup.formation,
  });
  G.ms.poType  = poType;
  G.ms.poMatch = poMatch;

  // Inizializza token canvas
  poolInitTokens(G.ms);

  // Header partita
  const homeTeam = isHome ? G.myTeam : opp;
  const awayTeam = isHome ? opp : G.myTeam;
  document.getElementById('m-lbl').textContent   = poType === 'final' ? 'Finale Scudetto'
                                                  : poType === 'sf'   ? match.label
                                                  : poType === 'pl'   ? 'Play-out'
                                                  : 'Giornata ' + match.round;
  document.getElementById('m-title').textContent = homeTeam.name + ' vs ' + awayTeam.name;
  document.getElementById('my-team-lbl').textContent = G.myTeam.name;
  document.getElementById('btn-end').style.display   = 'none';
  document.getElementById('btn-play').style.display  = '';
  document.getElementById('btn-play').textContent    = '▶ Avvia';
  document.getElementById('sub-panel').style.display = 'none';
  document.getElementById('action-log').innerHTML    = '';

  // Avvia loop
  if (_animReqId) cancelAnimationFrame(_animReqId);
  _lastFrameT = null;
  _animReqId  = requestAnimationFrame(_animLoop);

  refreshMatchUI();
  renderFieldLists();
}

// ── Loop di animazione (requestAnimationFrame) ─
function _animLoop(timestamp) {
  _animReqId = requestAnimationFrame(_animLoop);
  const dt = _lastFrameT ? Math.min((timestamp - _lastFrameT) / 1000, 0.1) : 0;
  _lastFrameT = timestamp;

  if (G.ms && G.ms.running && !G.ms.finished) {
    // Avanza tempo nel motore
    const { periodEnded, matchEnded } = advanceTime(G.ms, dt);
    if (periodEnded && !matchEnded) {
      _appendLog('⏱ Fine ' + G.ms.period + '° periodo', '');
    }
    if (matchEnded) {
      document.getElementById('btn-end').style.display  = '';
      document.getElementById('btn-play').style.display = 'none';
    }

    // Evento di gioco
    G.ms.lastActionTime += dt;
    if (G.ms.lastActionTime >= G.ms.nextActionIn) {
      G.ms.lastActionTime = 0;
      G.ms.nextActionIn   = rnd(4, 11);
      const event = generateMatchEvent(G.ms);
      if (event) {
        _appendLog(event.txt, event.cls);
        if (event.ballTarget) poolMoveBall(event.ballTarget.x, event.ballTarget.y);
        if (event.moverKey)   {
          poolMoveToken(event.moverKey, event.moverTarget.x, event.moverTarget.y);
          poolResetToken(event.moverKey);
        }
      }
    }

    // Anima token canvas
    poolAnimStep(dt);
    refreshMatchUI();
  } else {
    // Anche da fermi aggiorno il canvas (animazioni in corso)
    poolAnimStep(dt);
  }

  // Ridisegna vasca
  const canvas = document.getElementById('pool-canvas');
  drawPool(canvas, G.myTeam.abbr, G.ms ? G.ms.oppTeam.abbr : '');
}

// ── Aggiorna i dati testuali della schermata ──
function refreshMatchUI() {
  const ms = G.ms; if (!ms) return;
  const hS = ms.isHome ? ms.myScore : ms.oppScore;
  const aS = ms.isHome ? ms.oppScore : ms.myScore;
  document.getElementById('m-score').textContent  = hS + ' - ' + aS;
  document.getElementById('m-period').textContent = ms.period + '° Periodo';
  document.getElementById('m-clock').textContent  = formatMatchTime(ms.totalSeconds);
  document.getElementById('sub-count').textContent = ms.subs;

  // Stats
  document.getElementById('m-stats').innerHTML = `
    <div class="irow"><span class="ilbl">Tiri miei</span>      <span>${ms.myShots}</span></div>
    <div class="irow"><span class="ilbl">Tiri avversario</span><span>${ms.oppShots}</span></div>
    <div class="irow"><span class="ilbl">Parate</span>         <span>${ms.mySaves}</span></div>
    <div class="irow"><span class="ilbl">Falli commessi</span> <span>${ms.myFouls}</span></div>`;

  // Marcatori
  const scorers = ms.myRoster
    .filter(p => p.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 4);
  document.getElementById('m-scorers').innerHTML = scorers.length
    ? scorers.map(p => `<div class="irow"><span>${p.name}</span><span style="color:var(--blue)">⚽${p.goals}</span></div>`).join('')
    : '<div style="color:var(--muted);font-size:12px">Nessun marcatore</div>';
}

// ── Aggiunge una riga al log ──────────────────
function _appendLog(txt, cls) {
  const ms = G.ms; if (!ms) return;
  ms.actions.push({ t: formatMatchTime(ms.totalSeconds), txt, cls });
  const log = document.getElementById('action-log'); if (!log) return;
  const el = document.createElement('div');
  el.className   = 'ae ' + (cls || '');
  el.textContent = '[' + formatMatchTime(ms.totalSeconds) + '] ' + txt;
  log.insertBefore(el, log.firstChild);
  while (log.children.length > 30) log.removeChild(log.lastChild);
}

// ── Liste giocatori in campo / panchina ───────
function renderFieldLists() {
  const ms = G.ms; if (!ms) return;
  let fieldHtml = '';
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const p   = ms.myRoster[pi]; if (!p) return;
    const pos = POSITIONS[pk];
    fieldHtml += `<div class="irow">
      <span><strong>${p.name}</strong> <span style="font-size:11px;color:var(--muted)">(${p.hand})</span></span>
      <span style="color:var(--blue);font-size:11px">${pos ? pos.label : pk}</span>
    </div>`;
  });
  document.getElementById('field-players').innerHTML = fieldHtml || '<div style="color:var(--muted)">—</div>';

  let benchHtml = '';
  ms.bench.forEach(pi => {
    const p = ms.myRoster[pi]; if (!p) return;
    benchHtml += `<div class="irow">
      <span>${p.name} <span style="font-size:11px;color:var(--muted)">${p.role}·${p.hand}</span></span>
      <span style="color:var(--muted);font-size:11px">OVR ${p.overall}</span>
    </div>`;
  });
  document.getElementById('bench-players').innerHTML = benchHtml || '<div style="color:var(--muted)">Panchina vuota</div>';
}

// ── Controlli partita ─────────────────────────
function togglePlay() {
  const ms = G.ms; if (!ms || ms.finished) return;
  ms.running = !ms.running;
  document.getElementById('btn-play').textContent = ms.running ? '⏸ Pausa' : '▶ Avvia';
  _lastFrameT = null;
}

function skipPeriod() {
  const ms = G.ms; if (!ms || ms.finished) return;
  ms.running = false;
  document.getElementById('btn-play').textContent = '▶ Avvia';
  const periodSecs = PERIOD_SECONDS;
  ms.totalSeconds  = ms.period * periodSecs - 3;
  if (ms.totalSeconds > TOTAL_PERIODS * periodSecs) {
    ms.totalSeconds = TOTAL_PERIODS * periodSecs;
    ms.finished = true;
  }
  refreshMatchUI();
}

// ── Pannello cambi ────────────────────────────
function openSub() {
  const ms = G.ms; if (!ms) return;
  ms.subOut = null; ms.subIn = null;
  document.getElementById('sub-panel').style.display = 'block';
  document.getElementById('btn-confirm-sub').disabled = true;
  _renderSubLists();
}
function closeSub() {
  document.getElementById('sub-panel').style.display = 'none';
}

function _renderSubLists() {
  const ms = G.ms; if (!ms) return;
  let outHtml = '';
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const p   = ms.myRoster[pi]; if (!p) return;
    const sel = ms.subOut === pk;
    outHtml += `<div class="player-card${sel ? ' selected' : ''}" onclick="selSubOut('${pk}')" style="margin-bottom:4px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">${POSITIONS[pk] ? POSITIONS[pk].label : pk} · OVR ${p.overall} · ${p.hand}</div>
      </div>
    </div>`;
  });
  document.getElementById('sub-out-list').innerHTML = outHtml;

  let inHtml = '';
  ms.bench.forEach(pi => {
    const p   = ms.myRoster[pi]; if (!p) return;
    const sel = ms.subIn === pi;
    inHtml += `<div class="player-card${sel ? ' selected' : ''}" onclick="selSubIn(${pi})" style="margin-bottom:4px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">${p.role} · OVR ${p.overall} · ${p.hand}</div>
      </div>
    </div>`;
  });
  document.getElementById('sub-in-list').innerHTML = inHtml;
}

function selSubOut(pk) { G.ms.subOut = pk; _checkSubReady(); _renderSubLists(); }
function selSubIn(pi)  { G.ms.subIn  = pi; _checkSubReady(); _renderSubLists(); }
function _checkSubReady() {
  document.getElementById('btn-confirm-sub').disabled = !(G.ms.subOut !== null && G.ms.subIn !== null);
}

function confirmSub() {
  const ms = G.ms;
  if (!ms || ms.subOut === null || ms.subIn === null) return;
  const result = performSubstitution(ms, ms.subOut, ms.subIn);
  if (!result) return;
  // Aggiorna etichetta token canvas
  poolUpdateToken('my_' + result.posKey, result.posKey === 'GK' ? 'P' : result.posKey);
  _appendLog('↔ Esce ' + result.outPlayer.name + ' — entra ' + result.inPlayer.name + ' (' + POSITIONS[result.posKey].label + ')', 'sub');
  ms.subOut = null; ms.subIn = null;
  renderFieldLists();
  closeSub();
  refreshMatchUI();
  autoSave();
}

// ── Fine partita ──────────────────────────────
function endMatch() {
  if (_animReqId) { cancelAnimationFrame(_animReqId); _animReqId = null; }
  _lastFrameT = null;
  const ms = G.ms; if (!ms) return;

  const score = getFinalScore(ms);

  if (ms.poMatch) {
    // ── Partita playoff/playout ────────────
    ms.poMatch.scores.push(score);
    const totHome = ms.poMatch.scores.reduce((s, x) => s + x.home, 0);
    const totAway = ms.poMatch.scores.reduce((s, x) => s + x.away, 0);
    const winner  = totHome > totAway ? ms.poMatch.home
                  : totAway > totHome ? ms.poMatch.away
                  : (Math.random() < 0.5 ? ms.poMatch.home : ms.poMatch.away);
    ms.poMatch.winner = winner;
    _resolvePlayoffMatch(ms.poType, ms.poMatch, winner);
    const earned = winner === G.myId ? 120000 : 40000;
    G.budget += earned;
    G.msgs.push(G.myTeam.name + (winner === G.myId ? ' avanza' : ' eliminato') +
                ' (' + ms.myScore + '-' + ms.oppScore + ') +' + formatMoney(earned));
    G.ms = null;
    showScreen('sc-game');
    updateHeader(); showTab('playoff');
  } else {
    // ── Partita regular season ─────────────
    ms.match.score   = score;
    ms.match.played  = true;
    updateStandings(G.stand, ms.match.home, ms.match.away, score);
    const mw = (ms.isHome && ms.myScore > ms.oppScore) || (!ms.isHome && ms.myScore > ms.oppScore);
    const md = ms.myScore === ms.oppScore;
    const earned = getMatchReward(ms.myScore, ms.oppScore);
    G.budget += earned;
    G.msgs.push('G' + ms.match.round + ': ' + G.myTeam.name + ' ' +
                (mw ? 'VINCE' : md ? 'pareggia' : 'perde') + ' vs ' + ms.oppTeam.name +
                ' (' + ms.myScore + '-' + ms.oppScore + ')' + (earned ? ' +' + formatMoney(earned) : ''));
    simulateRound(G.schedule, G.stand, G.teams, ms.match.round, G.myId);
    G.ms = null;
    showScreen('sc-game');
    updateHeader(); showTab('dash');
  }
  autoSave();
}

// ── Risolve avanzamento playoff/playout ───────
function _resolvePlayoffMatch(poType, poMatch, winner) {
  const pb  = G.poBracket;
  const plb = G.plBracket;
  if (poType === 'sf') {
    if (pb.sf.every(s => s.winner)) {
      pb.final.home = pb.sf[0].winner;
      pb.final.away = pb.sf[1].winner;
    }
  } else if (poType === 'final') {
    pb.done = true;
    if (winner === G.myId) { G.playoffResult = 'champion'; G.msgs.push('HAI VINTO LO SCUDETTO! 🏆'); }
    else G.msgs.push('Campione d\'Italia: ' + G.teams.find(t => t.id === winner)?.name);
  } else if (poType === 'pl') {
    const loser = winner === poMatch.home ? poMatch.away : poMatch.home;
    if (poMatch === plb.m2) {
      plb.relegated = loser; plb.done = true;
      if (loser === G.myId) { G.playoffResult = 'relegated'; G.msgs.push('Sei retrocesso in Serie A2!'); }
      else G.msgs.push(G.teams.find(t => t.id === loser)?.name + ' retrocede in A2.');
    } else {
      plb.m2.home = winner;
    }
  }
}
