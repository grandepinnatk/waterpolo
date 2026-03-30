// ─────────────────────────────────────────────
// ui/match.js — Schermata partita live
// ─────────────────────────────────────────────

let _animReqId  = null;
let _lastFrameT = null;

// ── Avvia partita live ────────────────────────
function startLiveMatch(match, isHome, opp, poType = null, poMatch = null) {
  // Assegna numeri di maglia dalla convocazione
  const shirtNumbers = G.lineup.shirtNumbers || {};

  G.ms = createMatchState({
    match, isHome,
    myTeam:   G.myTeam,
    oppTeam:  opp,
    myRoster:  G.rosters[G.myId],
    oppRoster: G.rosters[opp.id],
    formation: G.lineup.formation,
    shirtNumbers,
  });
  G.ms.poType  = poType;
  G.ms.poMatch = poMatch;
  G.ms.speed   = 1;

  poolInitTokens(G.ms);

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
  document.getElementById('m-clock').textContent     = '08:00';
  _setSpeedUI(1);

  if (_animReqId) cancelAnimationFrame(_animReqId);
  _lastFrameT = null;
  _animReqId  = requestAnimationFrame(_animLoop);

  refreshMatchUI();
  renderFieldLists();
}

// ── Loop animazione ───────────────────────────
function _animLoop(timestamp) {
  _animReqId = requestAnimationFrame(_animLoop);
  const rawDt = _lastFrameT ? Math.min((timestamp - _lastFrameT) / 1000, 0.1) : 0;
  _lastFrameT = timestamp;

  if (G.ms && G.ms.running && !G.ms.finished) {
    const speed = G.ms.speed || 1;
    // dt scalato: tutto il motore lavora in "tempo di gioco"
    const dt = rawDt * speed;

    const { periodEnded, matchEnded } = advanceTime(G.ms, rawDt); // advanceTime già moltiplica per speed
    if (periodEnded && !matchEnded) {
      // Pausa automatica a fine periodo per consentire sostituzioni
      G.ms.running = false;
      document.getElementById('btn-play').textContent = '▶ Avvia';
      _lastFrameT = null;
      _appendLog('⏸ Fine ' + (G.ms.period - 1) + '° Tempo — Partita in pausa. Puoi effettuare sostituzioni.', 'sv');
    }
    if (matchEnded) {
      document.getElementById('btn-end').style.display  = '';
      document.getElementById('btn-play').style.display = 'none';
    }

    // Accumula tempo di gioco verso il prossimo evento
    G.ms.lastActionTime += dt;
    if (G.ms.lastActionTime >= G.ms.nextActionIn) {
      // A velocità alta possono scattare più eventi per frame
      while (G.ms.lastActionTime >= G.ms.nextActionIn && !G.ms.finished) {
        G.ms.lastActionTime -= G.ms.nextActionIn;
        G.ms.nextActionIn    = rnd(4, 11);
        const event = generateMatchEvent(G.ms);
        if (event) {
          _appendLog(event.txt, event.cls);
          if (event.ballTarget) poolMoveBall(event.ballTarget.x, event.ballTarget.y);
          if (event.moverKey) {
            poolMoveToken(event.moverKey, event.moverTarget?.x || 0.5, event.moverTarget?.y || 0.5);
            poolResetToken(event.moverKey);
          }
          if (event.expelled !== undefined) _handleExpulsion(event.expelled, event.moverKey);
          poolSyncTokens(G.ms);
        }
      }
      renderFieldLists();
    }

    poolAnimStep(rawDt); // l'animazione visiva resta fluida indipendentemente da speed
    refreshMatchUI();
  } else {
    poolAnimStep(rawDt);
  }

  const canvas = document.getElementById('pool-canvas');
  drawPool(canvas, G.myTeam.abbr, G.ms ? G.ms.oppTeam.abbr : '');
}

// ── Gestisce espulsione definitiva ────────────
function _handleExpulsion(expelledPi, tokenKey) {
  const result = forceSubstitutionExpelled(G.ms, expelledPi);
  if (!result) return;
  if (result.inPlayer) {
    _appendLog('↔ Auto-cambio: entra ' + result.inPlayer.name +
               ' (#' + (G.ms.shirtNumbers[G.ms.onField[result.posKey]] || '?') + ') al posto dell\'espulso', 'sub');
  } else {
    _appendLog('⚠ Nessun sostituto disponibile per posizione ' + result.posKey, 'fl');
  }
  // Nasconde il token del giocatore espulso
  if (tokenKey && _tokens) {
    const tok = _tokens[tokenKey];
    if (tok) { tok.expelled = true; tok.tx = -0.2; tok.ty = -0.2; }
  }
  // Aggiorna token con il nuovo giocatore
  if (result.inPlayer && tokenKey) {
    poolUpdateToken(tokenKey, G.ms);
  }
}

// ── Aggiorna UI testuale ──────────────────────
function refreshMatchUI() {
  const ms = G.ms; if (!ms) return;
  const hS = ms.isHome ? ms.myScore : ms.oppScore;
  const aS = ms.isHome ? ms.oppScore : ms.myScore;
  document.getElementById('m-score').textContent   = hS + ' - ' + aS;
  document.getElementById('m-period').textContent  = ms.period + '° Tempo';
  document.getElementById('sub-count').textContent = ms.subs;

  // ── Timer countdown: mostra secondi rimanenti nel periodo corrente ──
  const elapsed  = ms.totalSeconds - (ms.period - 1) * PERIOD_SECONDS;
  const remaining = Math.max(0, PERIOD_SECONDS - elapsed);
  const mm = Math.floor(remaining / 60);
  const ss = Math.floor(remaining % 60);
  document.getElementById('m-clock').textContent =
    String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');

  // ── Barre % attacco e difesa ──
  const totShots = ms.myShots + ms.oppShots || 1;
  const myAttPct  = Math.round((ms.myShots  / totShots) * 100);
  const oppAttPct = 100 - myAttPct;
  // Difesa: % parate sul totale tiri avversari
  const myDefPct  = ms.oppShots > 0 ? Math.round((ms.mySaves / ms.oppShots) * 100) : 100;
  const oppDefPct = ms.myShots  > 0 ? Math.round(((ms.myShots - ms.myScore) / ms.myShots) * 100) : 100;
  // Normalizza difesa a 100
  const defTot    = myDefPct + oppDefPct || 1;
  const myDefBar  = Math.round(myDefPct  / defTot * 100);
  const oppDefBar = 100 - myDefBar;

  const homeLabel = ms.isHome ? ms.myTeam.abbr : ms.oppTeam.abbr;
  const awayLabel = ms.isHome ? ms.oppTeam.abbr : ms.myTeam.abbr;
  const myIsHome  = ms.isHome;

  // Attacco
  const hAttPct = myIsHome ? myAttPct : oppAttPct;
  const aAttPct = myIsHome ? oppAttPct : myAttPct;
  const hAttBar = myIsHome ? myAttPct : oppAttPct;
  _setBar('m-att-home-pct', 'm-att-away-pct', 'm-att-bar-home', 'm-att-bar-away',
          hAttPct + '%', aAttPct + '%', hAttBar);

  // Difesa
  const hDefPct = myIsHome ? myDefPct : oppDefPct;
  const aDefPct = myIsHome ? oppDefPct : myDefPct;
  const hDefBar = myIsHome ? myDefBar : oppDefBar;
  _setBar('m-def-home-pct', 'm-def-away-pct', 'm-def-bar-home', 'm-def-bar-away',
          hDefPct + '%', aDefPct + '%', hDefBar);

  // ── Stats numeriche ──
  document.getElementById('m-stats').innerHTML = `
    <div class="irow"><span class="ilbl">Tiri miei</span>      <span>${ms.myShots}</span></div>
    <div class="irow"><span class="ilbl">Tiri avversario</span><span>${ms.oppShots}</span></div>
    <div class="irow"><span class="ilbl">Parate</span>         <span>${ms.mySaves}</span></div>
    <div class="irow"><span class="ilbl">Falli/Esp.</span>     <span>${ms.myFouls}</span></div>`;

  // ── Marcatori partita in corso ──
  const scorers = ms.myRoster.filter(p => p.goals > 0).sort((a, b) => b.goals - a.goals).slice(0, 6);
  document.getElementById('m-scorers').innerHTML = scorers.length
    ? scorers.map(p => {
        const shirt = Object.entries(ms.shirtNumbers).find(([pi]) => ms.myRoster[+pi] === p)?.[1] || '?';
        return `<div class="irow"><span>#${shirt} ${p.name}</span><span style="color:var(--blue);font-weight:700">⚽ ${p.goals}</span></div>`;
      }).join('')
    : '<div style="color:var(--muted);font-size:12px;padding:4px 0">Nessun gol ancora</div>';
}

function _setBar(idHPct, idAPct, idHBar, idABar, hLabel, aLabel, hPct) {
  const hEl = document.getElementById(idHPct); if (hEl) hEl.textContent = hLabel;
  const aEl = document.getElementById(idAPct); if (aEl) aEl.textContent = aLabel;
  const hB  = document.getElementById(idHBar);  if (hB)  hB.style.width = hPct + '%';
  const aB  = document.getElementById(idABar);  if (aB)  aB.style.width = (100 - hPct) + '%';
}

// ── Aggiunge riga al log ──────────────────────
function _appendLog(txt, cls) {
  const ms = G.ms; if (!ms) return;
  ms.actions.push({ t: formatMatchTime(ms.totalSeconds), txt, cls });
  const log = document.getElementById('action-log'); if (!log) return;
  const el = document.createElement('div');
  el.className   = 'ae ' + (cls || '');
  el.textContent = '[' + formatMatchTime(ms.totalSeconds) + '] ' + txt;
  log.insertBefore(el, log.firstChild);
  while (log.children.length > 40) log.removeChild(log.lastChild);
}

// ── Liste in campo / panchina ─────────────────
function renderFieldLists() {
  const ms = G.ms; if (!ms) return;

  // Costruisce pallini espulsioni temporanee
  function expDots(pi) {
    const count = ms.tempExp[pi] || 0;
    if (count === 0) return '<span style="color:var(--muted);font-size:11px">—</span>';
    return Array.from({ length: count }).map((_, i) => {
      const color = (count >= MAX_TEMP_EXP || i === MAX_TEMP_EXP - 1) ? '#e74c3c' : '#f0c040';
      return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:2px;border:1px solid rgba(0,0,0,.3)"></span>`;
    }).join('');
  }

  // Barra + percentuale stamina
  function staminaCell(pi) {
    const st  = Math.round(ms.stamina[pi] ?? 100);
    const col = st > 65 ? '#2ecc71' : st > 35 ? '#f0c040' : '#e74c3c';
    return `<div style="display:flex;align-items:center;gap:3px">
      <div style="width:32px;height:5px;background:rgba(255,255,255,.15);border-radius:3px;overflow:hidden;flex-shrink:0">
        <div style="width:${st}%;height:100%;background:${col};border-radius:3px;transition:width .4s"></div>
      </div>
      <span style="font-size:10px;color:${col};font-weight:700;min-width:26px">${st}%</span>
    </div>`;
  }

  // Intestazione colonne comune
  const tableHeader = `
    <div style="display:grid;grid-template-columns:28px 1fr 38px 72px 52px 36px;
                gap:4px;padding:3px 4px 5px;border-bottom:1px solid var(--border);
                font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">
      <div>#</div><div>Nome</div><div>Ruolo</div><div>Stamina</div><div>Esp.</div><div>OVR</div>
    </div>`;

  // ── IN CAMPO ──────────────────────────────
  let fieldHtml = tableHeader;
  // Ordina: GK per primo, poi per numero maglia
  const onFieldEntries = Object.entries(ms.onField).sort(([pkA, piA], [pkB, piB]) => {
    if (pkA === 'GK') return -1;
    if (pkB === 'GK') return  1;
    return (ms.shirtNumbers[piA] || 99) - (ms.shirtNumbers[piB] || 99);
  });

  onFieldEntries.forEach(([pk, pi]) => {
    const p     = ms.myRoster[pi]; if (!p) return;
    const pos   = POSITIONS[pk];
    const shirt = ms.shirtNumbers[pi] || '—';
    const isExp = ms.expelled.has(pi);
    fieldHtml += `
      <div style="display:grid;grid-template-columns:28px 1fr 38px 72px 52px 36px;
                  gap:4px;align-items:center;padding:5px 4px;
                  border-bottom:1px solid rgba(30,58,92,.35);
                  opacity:${isExp ? '.4' : '1'}">
        <div style="font-weight:700;color:var(--blue);font-size:12px">#${shirt}</div>
        <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${p.name.split(' ').pop()}
          ${isExp ? '<span style="font-size:9px;color:var(--red);display:block">ESPULSO</span>' : ''}
        </div>
        <div><span style="font-size:10px;font-weight:600;color:var(--blue)">${pos ? pos.label : pk}</span></div>
        <div>${isExp ? '<span style="color:var(--muted);font-size:11px">—</span>' : staminaCell(pi)}</div>
        <div>${expDots(pi)}</div>
        <div style="font-size:11px;font-weight:600;color:var(--muted)">${p.overall}</div>
      </div>`;
  });
  document.getElementById('field-players').innerHTML = fieldHtml;

  // ── PANCHINA ──────────────────────────────
  let benchHtml = tableHeader;
  const benchSorted = [...ms.bench].sort((a, b) =>
    (ms.shirtNumbers[a] || 99) - (ms.shirtNumbers[b] || 99)
  );

  benchSorted.forEach(pi => {
    const p     = ms.myRoster[pi]; if (!p) return;
    const shirt = ms.shirtNumbers[pi] || '—';
    const isExp = ms.expelled.has(pi);
    benchHtml += `
      <div style="display:grid;grid-template-columns:28px 1fr 38px 72px 52px 36px;
                  gap:4px;align-items:center;padding:5px 4px;
                  border-bottom:1px solid rgba(30,58,92,.35);
                  opacity:${isExp ? '.35' : '1'};
                  ${isExp ? 'text-decoration:line-through' : ''}">
        <div style="font-weight:700;color:var(--muted);font-size:12px">#${shirt}</div>
        <div style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${p.name.split(' ').pop()}
        </div>
        <div><span style="font-size:10px;font-weight:600;color:var(--muted)">${p.role}</span></div>
        <div>${staminaCell(pi)}</div>
        <div>${expDots(pi)}</div>
        <div style="font-size:11px;font-weight:600;color:var(--muted)">${p.overall}</div>
      </div>`;
  });
  document.getElementById('bench-players').innerHTML = benchHtml || '<div style="color:var(--muted);font-size:12px;padding:8px">Panchina vuota</div>';
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
  ms.totalSeconds = ms.period * PERIOD_SECONDS - 3;
  if (ms.totalSeconds > TOTAL_PERIODS * PERIOD_SECONDS) {
    ms.totalSeconds = TOTAL_PERIODS * PERIOD_SECONDS;
    ms.finished = true;
  }
  refreshMatchUI();
}

// ── Pannello cambi ────────────────────────────
// Apre il pannello e mette in pausa la partita
function openSub() {
  const ms = G.ms; if (!ms || ms.finished) return;
  // Metti in pausa
  if (ms.running) {
    ms.running = false;
    document.getElementById('btn-play').textContent = '▶ Avvia';
  }
  ms.subOut = null; ms.subIn = null;
  document.getElementById('sub-panel').style.display = 'block';
  document.getElementById('btn-confirm-sub').disabled = true;
  _renderSubLists();
}
function closeSub() {
  document.getElementById('sub-panel').style.display = 'none';
  if (G.ms) { G.ms.subOut = null; G.ms.subIn = null; }
}

function _renderSubLists() {
  const ms = G.ms; if (!ms) return;

  function expDots(pi) {
    const count  = ms.tempExp[pi] || 0;
    const isLast = count >= MAX_TEMP_EXP;
    if (count === 0) return '';
    return Array.from({ length: count }).map((_, i) => {
      const color = (isLast || i === MAX_TEMP_EXP - 1) ? '#e74c3c' : '#f0c040';
      return `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-left:3px;vertical-align:middle;border:1px solid rgba(0,0,0,.25)"></span>`;
    }).join('');
  }

  function staminaBadge(pi) {
    const st  = Math.round(ms.stamina[pi] ?? 100);
    const col = st > 65 ? '#2ecc71' : st > 35 ? '#f0c040' : '#e74c3c';
    return `<span style="font-size:11px;font-weight:600;color:${col};margin-left:6px">⚡${st}%</span>`;
  }

  // Mostra avviso se il giocatore entrante è fuori ruolo per quella posizione
  function roleBadge(pi, pk) {
    if (!pk) return '';
    const p = ms.myRoster[pi]; if (!p) return '';
    const nativeRole = POS_NATIVE_ROLE[pk];
    if (!nativeRole) return '';
    const adj = ROLE_ADJACENCY[p.role];
    const eff = adj ? (adj[nativeRole] || 0.6) : 1.0;
    if (eff >= 0.85) return '';
    const label = eff >= 0.70 ? '⚠ fuori ruolo' : '⚠⚠ molto fuori ruolo';
    const col   = eff >= 0.70 ? '#f0c040' : '#e74c3c';
    return `<span style="font-size:10px;color:${col};margin-left:5px">${label}</span>`;
  }

  // ESCE DAL CAMPO
  let outHtml = '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Seleziona il giocatore che deve uscire:</div>';
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const p     = ms.myRoster[pi]; if (!p) return;
    const shirt = ms.shirtNumbers[pi] || '—';
    const isExp = ms.expelled.has(pi);
    const sel   = ms.subOut === pk;
    outHtml += `
      <div class="player-card${sel ? ' selected' : ''}" onclick="${isExp ? '' : "selSubOut('" + pk + "')"}"
           style="margin-bottom:6px;${isExp ? 'opacity:.35;cursor:not-allowed' : ''}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
            <span style="color:var(--blue);margin-right:4px">#${shirt}</span>
            ${p.name}
            ${expDots(pi)}
            ${staminaBadge(pi)}
            ${isExp ? '<span style="color:var(--red);font-size:10px;margin-left:4px">ESPULSO</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--muted)">${POSITIONS[pk] ? POSITIONS[pk].label : pk} · ${p.role} · ${p.hand}</div>
        </div>
        ${sel ? '<span style="color:var(--blue);font-size:18px">✓</span>' : ''}
      </div>`;
  });
  document.getElementById('sub-out-list').innerHTML = outHtml;

  // ENTRA IN CAMPO — mostra stamina e avviso fuori-ruolo rispetto alla posizione che andrà a coprire
  const targetPk = ms.subOut; // posizione che verrà occupata dall'entrante
  let inHtml = '<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Seleziona il giocatore che deve entrare:</div>';
  ms.bench.forEach(pi => {
    const p     = ms.myRoster[pi]; if (!p) return;
    const shirt = ms.shirtNumbers[pi] || '—';
    const isExp = ms.expelled.has(pi);
    const sel   = ms.subIn === pi;
    inHtml += `
      <div class="player-card${sel ? ' selected' : ''}" onclick="${isExp ? '' : 'selSubIn(' + pi + ')'}"
           style="margin-bottom:6px;${isExp ? 'opacity:.35;cursor:not-allowed' : ''}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
            <span style="color:var(--muted);margin-right:4px">#${shirt}</span>
            ${p.name}
            ${expDots(pi)}
            ${staminaBadge(pi)}
            ${targetPk ? roleBadge(pi, targetPk) : ''}
            ${isExp ? '<span style="color:var(--red);font-size:10px;margin-left:4px">ESPULSO</span>' : ''}
          </div>
          <div style="font-size:11px;color:var(--muted)">${p.role} · OVR ${p.overall} · ${p.hand}</div>
        </div>
        ${sel ? '<span style="color:var(--blue);font-size:18px">✓</span>' : ''}
      </div>`;
  });
  document.getElementById('sub-in-list').innerHTML = inHtml;
}

function selSubOut(pk) {
  if (!G.ms || G.ms.expelled.has(G.ms.onField[pk])) return;
  G.ms.subOut = pk; _checkSubReady(); _renderSubLists();
}
function selSubIn(pi) {
  if (!G.ms || G.ms.expelled.has(pi)) return;
  G.ms.subIn = pi; _checkSubReady(); _renderSubLists();
}
function _checkSubReady() {
  const ready = G.ms && G.ms.subOut !== null && G.ms.subIn !== null;
  document.getElementById('btn-confirm-sub').disabled = !ready;
}

function confirmSub() {
  const ms = G.ms;
  if (!ms || ms.subOut === null || ms.subIn === null) return;
  const result = performSubstitution(ms, ms.subOut, ms.subIn);
  if (!result) return;
  poolUpdateToken('my_' + result.posKey, ms);
  const shirtOut = ms.shirtNumbers[result.outRosterIdx] || '?';
  const shirtIn  = ms.shirtNumbers[result.inRosterIdx]  || '?';
  _appendLog('↔ Esce #' + shirtOut + ' ' + result.outPlayer.name +
             ' — Entra #' + shirtIn + ' ' + result.inPlayer.name +
             ' (' + POSITIONS[result.posKey].label + ')', 'sub');
  closeSub();
  renderFieldLists();
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
    showScreen('sc-game'); updateHeader(); showTab('playoff');
  } else {
    ms.match.score  = score; ms.match.played = true;
    updateStandings(G.stand, ms.match.home, ms.match.away, score);
    const mw = (ms.isHome && ms.myScore > ms.oppScore) || (!ms.isHome && ms.myScore > ms.oppScore);
    const md = ms.myScore === ms.oppScore;
    const earned = getMatchReward(ms.myScore, ms.oppScore);
    G.budget += earned;
    G.msgs.push('G' + ms.match.round + ': ' + G.myTeam.name + ' ' +
                (mw ? 'VINCE' : md ? 'pareggia' : 'perde') + ' vs ' + ms.oppTeam.name +
                ' (' + ms.myScore + '-' + ms.oppScore + ')' + (earned ? ' +' + formatMoney(earned) : ''));
    updateMoraleAfterMatch(ms);
    generateTransferOffers();
    simulateRound(G.schedule, G.stand, G.teams, ms.match.round, G.myId);
    G.ms = null;
    showScreen('sc-game'); updateHeader(); showTab('dash');
  }
  autoSave();
}

function _resolvePlayoffMatch(poType, poMatch, winner) {
  const pb = G.poBracket, plb = G.plBracket;
  if (poType === 'sf') {
    if (pb.sf.every(s => s.winner)) { pb.final.home = pb.sf[0].winner; pb.final.away = pb.sf[1].winner; }
  } else if (poType === 'final') {
    pb.done = true;
    if (winner === G.myId) { G.playoffResult = 'champion'; G.msgs.push('HAI VINTO LO SCUDETTO! 🏆'); }
    else G.msgs.push("Campione d'Italia: " + G.teams.find(t => t.id === winner)?.name);
  } else if (poType === 'pl') {
    const loser = winner === poMatch.home ? poMatch.away : poMatch.home;
    if (poMatch === plb.m2) {
      plb.relegated = loser; plb.done = true;
      if (loser === G.myId) { G.playoffResult = 'relegated'; G.msgs.push('Sei retrocesso in Serie A2!'); }
      else G.msgs.push(G.teams.find(t => t.id === loser)?.name + ' retrocede in A2.');
    } else { plb.m2.home = winner; }
  }
}
