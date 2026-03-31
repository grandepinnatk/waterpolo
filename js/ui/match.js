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
  G.ms.speed   = 10;

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
  _setSpeedUI(10);

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

    // ── Sostituzione obbligatoria: giocatori a stamina 0 ──
    _checkExhaustedPlayers();

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

  // ── Stats numeriche — riga singola compatta ──
  document.getElementById('m-stats').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 6px;font-size:10px">
      <span style="color:var(--muted)">Tiri</span>      <span style="font-weight:700">${ms.myShots} — ${ms.oppShots}</span>
      <span style="color:var(--muted)">Parate</span>    <span style="font-weight:700">${ms.mySaves}</span>
      <span style="color:var(--muted)">Falli/Esp.</span><span style="font-weight:700">${ms.myFouls}</span>
    </div>`;

  // ── Parziali per tempo ──
  const partialsEl = document.getElementById('m-partials');
  if (partialsEl) {
    const homeTeam = ms.isHome ? ms.myTeam  : ms.oppTeam;
    const awayTeam = ms.isHome ? ms.oppTeam : ms.myTeam;
    const isMyHome = ms.isHome;
    const ps       = ms.periodScores || [{my:0,opp:0},{my:0,opp:0},{my:0,opp:0},{my:0,opp:0}];

    // Nomi corti per l'intestazione
    const homeLbl = homeTeam.abbr || homeTeam.name;
    const awayLbl = awayTeam.abbr || awayTeam.name;

    let html = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:3px 4px;font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase">Tempo</th>
            <th style="text-align:center;padding:3px 6px;font-size:10px;font-weight:700;color:${isMyHome ? 'var(--blue)' : 'var(--muted)'}">${homeLbl}</th>
            <th style="text-align:center;padding:3px 6px;font-size:10px;font-weight:700;color:${!isMyHome ? 'var(--blue)' : 'var(--muted)'}">${awayLbl}</th>
          </tr>
        </thead>
        <tbody>`;

    for (let t = 0; t < 4; t++) {
      const isCurrent = (t + 1) === ms.period && !ms.finished;
      const isPast    = (t + 1) < ms.period || ms.finished;
      const isFuture  = !isCurrent && !isPast;

      const homeGoals = isMyHome ? ps[t].my  : ps[t].opp;
      const awayGoals = isMyHome ? ps[t].opp : ps[t].my;

      const rowBg = isCurrent ? 'background:rgba(0,194,255,.07)' : '';
      const valStyle = isFuture
        ? 'color:rgba(255,255,255,.2)'
        : isCurrent
          ? 'font-weight:700;color:var(--text)'
          : 'color:var(--muted)';

      html += `
        <tr style="border-bottom:1px solid rgba(255,255,255,.05);${rowBg}">
          <td style="padding:5px 4px;color:${isCurrent ? 'var(--gold)' : 'var(--muted)'};font-size:11px;font-weight:${isCurrent ? 700 : 400}">
            ${isCurrent ? '▶ ' : ''}${t + 1}° T
          </td>
          <td style="text-align:center;padding:5px 6px;${valStyle}">${isFuture ? '—' : homeGoals}</td>
          <td style="text-align:center;padding:5px 6px;${valStyle}">${isFuture ? '—' : awayGoals}</td>
        </tr>`;
    }

    html += '</tbody></table>';
    partialsEl.innerHTML = html;
  }
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
// Restituisce "Cognome I." per le tabelle
function _shortPlayerName(p) {
  if (!p || !p.name) return '—';
  // Formato "M. Rossi" → "Rossi M."
  if (/^[A-Z]\. /.test(p.name)) {
    const parts = p.name.split(' ');
    const init  = parts[0];
    const cogn  = parts.slice(1).join(' ');
    return cogn + ' ' + init;
  }
  // Formato "Marco Rossi" → "Rossi M."
  const parts = p.name.trim().split(' ');
  if (parts.length >= 2) return parts[parts.length - 1] + ' ' + parts[0][0] + '.';
  return p.name;
}

// Controlla giocatori esauriti (stamina = 0) in campo e li segnala
function _checkExhaustedPlayers() {
  const ms = G.ms; if (!ms || ms.finished) return;
  const exhausted = [];
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    if (ms.expelled.has(pi)) return;
    const stamina = ms.stamina[pi];
    if (stamina !== undefined && stamina <= 0 && !ms._notifiedExhausted?.has(pi)) {
      if (!ms._notifiedExhausted) ms._notifiedExhausted = new Set();
      ms._notifiedExhausted.add(pi);
      const p = ms.myRoster[pi];
      const shirt = ms.shirtNumbers[pi] || '?';
      exhausted.push({ pi, pk, p, shirt });
    }
  });
  exhausted.forEach(({ pi, pk, p, shirt }) => {
    const name = p ? _shortPlayerName(p) : '#' + shirt;
    _appendLog(`⚠️ #${shirt} ${name} è esaurito — sostituzione necessaria!`, 'fl');
  });
  // Pausa automatica se ci sono esauriti — SOLO se ci sono abbastanza giocatori per sostituire
  if (exhausted.length > 0 && ms.running) {
    const activePlayers = Object.values(ms.onField).filter(pi => !ms.expelled.has(pi)).length;
    const benchAvail    = ms.bench.filter(pi => !ms.expelled.has(pi)).length;
    if (activePlayers > 5 && benchAvail > 0) {
      // Può fare sostituzioni: forza pausa
      ms.running = false;
      document.getElementById('btn-play').textContent = '▶ Avvia';
      _lastFrameT = null;
      _appendLog('⏸ Pausa automatica — giocatori esauriti in campo. Effettua una sostituzione.', 'sv');
    } else {
      // Solo 5 in campo o panchina vuota: non si può sostituire, continua con penalità
      _appendLog('⚠️ Giocatore esaurito ma nessuna sostituzione possibile — efficacia drasticamente ridotta.', 'fl');
    }
  }
}

// Badge ruolo colorato (stessa classe CSS della tab Rosa)
function _roleBadge(role) {
  const cls = role==='POR'?'S': role==='DIF'?'A': role==='CB'?'B': 'C';
  return `<span class="badge ${cls}">${role}</span>`;
}

// Badge mano colorato
function _handBadge(hand) {
  const cls = hand==='AMB'?'AMB': hand==='L'?'L': 'R';
  return `<span class="badge ${cls}">${hand}</span>`;
}

// Etichetta posizione semplificata: GK→POR, altrimenti il numero
function _simplePosLabel(pk) {
  if (!pk) return '—';
  if (pk === 'GK') return 'POR';
  return String(pk);  // '1','2','3','4','5','6'
}

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

  // Intestazione colonne — IN CAMPO e PANCHINA hanno griglie diverse
  const COL_FIELD = '24px 1fr 28px 30px 28px 60px 36px 22px 22px 28px';
  const COL_BENCH = '24px 1fr 30px 28px 60px 36px 22px 22px 28px';

  const fieldTableHeader = `
    <div style="display:grid;grid-template-columns:${COL_FIELD};
                gap:3px;padding:3px 4px 5px;border-bottom:1px solid var(--border);
                font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">
      <div>#</div><div>Nome</div><div>Pos.</div><div>Ruolo</div><div>Mano</div>
      <div>Stamina</div><div>Esp.</div>
      <div title="Gol" style="text-align:center">&#x26BD;</div>
      <div title="Assist" style="text-align:center">&#x1F91D;</div>
      <div>OVR</div>
    </div>`;

  const benchTableHeader = `
    <div style="display:grid;grid-template-columns:${COL_BENCH};
                gap:3px;padding:3px 4px 5px;border-bottom:1px solid var(--border);
                font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">
      <div>#</div><div>Nome</div><div>Ruolo</div><div>Mano</div>
      <div>Stamina</div><div>Esp.</div>
      <div title="Gol" style="text-align:center">&#x26BD;</div>
      <div title="Assist" style="text-align:center">&#x1F91D;</div>
      <div>OVR</div>
    </div>`;

  // ── IN CAMPO ──────────────────────────────
  let fieldHtml = fieldTableHeader;
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
    const mGoals   = ms.matchGoals   && ms.matchGoals[pi]   || 0;
    const mAssists = ms.matchAssists && ms.matchAssists[pi] || 0;
    // Posizione: POR / 1-6
    const posLabel = _simplePosLabel(pk);
    // Colore mano
    const handColor = p.hand === 'L' ? '#80c0ff' : p.hand === 'AMB' ? 'var(--green)' : 'var(--muted)';
    fieldHtml += `
      <div style="display:grid;grid-template-columns:${COL_FIELD};
                  gap:3px;align-items:center;padding:5px 4px;
                  border-bottom:1px solid rgba(30,58,92,.35);
                  opacity:${isExp ? '.4' : '1'}">
        <div style="font-weight:700;color:var(--blue);font-size:11px">#${shirt}</div>
        <div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_shortPlayerName(p)}
          ${isExp ? '<span style="font-size:9px;color:var(--red);display:block">ESP</span>' : ''}
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--blue);text-align:center">${posLabel}</div>
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-align:center">${p.role}</div>
        <div style="font-size:10px;font-weight:600;color:${handColor};text-align:center">${p.hand}</div>
        <div>${isExp ? '<span style="color:var(--muted);font-size:11px">—</span>' : staminaCell(pi)}</div>
        <div>${expDots(pi)}</div>
        <div style="font-size:11px;font-weight:700;color:${mGoals>0?'var(--blue)':'var(--muted)'};text-align:center">${mGoals > 0 ? mGoals : '—'}</div>
        <div style="font-size:11px;font-weight:700;color:${mAssists>0?'var(--green)':'var(--muted)'};text-align:center">${mAssists > 0 ? mAssists : '—'}</div>
        <div style="font-size:11px;font-weight:600;color:var(--muted)">${p.overall}</div>
      </div>`;
  });
  document.getElementById('field-players').innerHTML = fieldHtml;

  // ── PANCHINA ──────────────────────────────
  let benchHtml = benchTableHeader;
  const benchSorted = [...ms.bench].sort((a, b) =>
    (ms.shirtNumbers[a] || 99) - (ms.shirtNumbers[b] || 99)
  );

  benchSorted.forEach(pi => {
    const p     = ms.myRoster[pi]; if (!p) return;
    const shirt = ms.shirtNumbers[pi] || '—';
    const isExp = ms.expelled.has(pi);
    const bGoals   = ms.matchGoals   && ms.matchGoals[pi]   || 0;
    const bAssists = ms.matchAssists && ms.matchAssists[pi] || 0;
    const bHandCol = p.hand === 'L' ? '#80c0ff' : p.hand === 'AMB' ? 'var(--green)' : 'var(--muted)';
    benchHtml += `
      <div style="display:grid;grid-template-columns:${COL_BENCH};
                  gap:3px;align-items:center;padding:5px 4px;
                  border-bottom:1px solid rgba(30,58,92,.35);
                  opacity:${isExp ? '.35' : '1'};
                  ${isExp ? 'text-decoration:line-through' : ''}">
        <div style="font-weight:700;color:var(--muted);font-size:11px">#${shirt}</div>
        <div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${_shortPlayerName(p)}
        </div>
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-align:center">${p.role}</div>
        <div style="font-size:10px;font-weight:600;color:${bHandCol};text-align:center">${p.hand}</div>
        <div>${staminaCell(pi)}</div>
        <div>${expDots(pi)}</div>
        <div style="font-size:11px;font-weight:700;color:${bGoals>0?'var(--blue)':'var(--muted)'};text-align:center">${bGoals > 0 ? bGoals : '—'}</div>
        <div style="font-size:11px;font-weight:700;color:${bAssists>0?'var(--green)':'var(--muted)'};text-align:center">${bAssists > 0 ? bAssists : '—'}</div>
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
          <div style="font-size:11px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:2px">${_simplePosLabel(pk)} · ${_roleBadge(p.role)} ${_handBadge(p.hand)} <span style="color:var(--muted)">${p.age}a</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span onclick="event.stopPropagation();showMatchPlayerInfo(${pi})"
                title="Scheda giocatore"
                style="width:18px;height:18px;border-radius:50%;border:1px solid var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;color:var(--muted);font-style:italic;font-weight:700;flex-shrink:0">i</span>
          ${sel ? '<span style="color:var(--blue);font-size:18px">✓</span>' : ''}
        </div>
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
          <div style="font-size:11px;display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:2px">${_roleBadge(p.role)} ${_handBadge(p.hand)} <span style="color:var(--muted)">${p.age}a · OVR ${p.overall}</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span onclick="event.stopPropagation();showMatchPlayerInfo(${pi})"
                title="Scheda giocatore"
                style="width:18px;height:18px;border-radius:50%;border:1px solid var(--muted);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;color:var(--muted);font-style:italic;font-weight:700;flex-shrink:0">i</span>
          ${sel ? '<span style="color:var(--blue);font-size:18px">✓</span>' : ''}
        </div>
      </div>`;
  });
  document.getElementById('sub-in-list').innerHTML = inHtml;
}

// Apre la scheda del giocatore durante la partita (popup riutilizzando showPlayerModal se disponibile)
function showMatchPlayerInfo(pi) {
  const ms = G.ms; if (!ms) return;
  const p  = ms.myRoster[pi]; if (!p) return;
  const rl = { POR:'Portiere', DIF:'Difensore', CEN:'Centromediano', ATT:'Attaccante', CB:'Centroboa' };
  const hand = p.hand === 'AMB' ? 'Ambidestro' : p.hand === 'L' ? 'Mancino' : 'Destro';
  const mc = p.morale > 70 ? 'var(--green)' : p.morale > 40 ? 'var(--gold)' : 'var(--red)';
  const shirt = ms.shirtNumbers[pi] || '—';
  const stam  = Math.round(ms.stamina[pi] ?? p.fitness);
  const mGoals   = ms.matchGoals?.[pi]   || 0;
  const mAssists = ms.matchAssists?.[pi] || 0;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:400;backdrop-filter:blur(4px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:18px;max-width:320px;width:90%;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--blue)">#${shirt} ${p.name}</div>
          <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:4px;flex-wrap:wrap">${rl[p.role]||p.role} · ${p.nat} · ${p.age}a · ${_handBadge(p.hand)}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      <div class="irow"><span class="ilbl">Overall</span>   <span style="font-size:16px;font-weight:700;color:var(--blue)">${p.overall}</span></div>
      <div class="irow"><span class="ilbl">Stamina</span>   <span style="color:${stam>60?'var(--green)':stam>30?'var(--gold)':'var(--red)'};font-weight:700">${stam}%</span></div>
      <div class="irow"><span class="ilbl">Morale</span>    <span style="color:${mc}">${p.morale}%</span></div>
      <div class="irow"><span class="ilbl">Gol partita</span><span style="color:var(--blue);font-weight:700">${mGoals}</span></div>
      <div class="irow"><span class="ilbl">Assist partita</span><span style="color:var(--green);font-weight:700">${mAssists}</span></div>
      <div style="margin-top:10px">
        <div class="slbl" style="margin-top:0">Attributi</div>
        ${[['att','ATT'],['def','DIF'],['spe','VEL'],['str','FOR'],['tec','TEC']].map(([a,lbl]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
            <div style="font-size:11px;color:var(--muted);width:28px">${lbl}</div>
            <div style="flex:1;height:4px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden">
              <div style="width:${p.stats?.[a]||0}%;height:100%;background:var(--blue)"></div>
            </div>
            <div style="font-size:11px;width:24px;font-weight:600">${p.stats?.[a]||'—'}</div>
          </div>`).join('')}
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
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
function _showEndMatchPopup(ms) {
  const hS    = ms.isHome ? ms.myScore : ms.oppScore;
  const aS    = ms.isHome ? ms.oppScore : ms.myScore;
  const homeN = ms.isHome ? ms.myTeam.name  : ms.oppTeam.name;
  const awayN = ms.isHome ? ms.oppTeam.name : ms.myTeam.name;
  const won   = ms.myScore > ms.oppScore;
  const drew  = ms.myScore === ms.oppScore;
  const resultLabel = won ? '🏆 VITTORIA' : drew ? '🤝 PAREGGIO' : '😞 SCONFITTA';
  const resultColor = won ? 'var(--green)' : drew ? 'var(--gold)' : 'var(--red)';

  // Parziali
  const ps = ms.periodScores || [{my:0,opp:0},{my:0,opp:0},{my:0,opp:0},{my:0,opp:0}];
  let partialsHtml = `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
    <thead><tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:left;padding:3px 6px;font-size:10px;color:var(--muted)">Tempo</th>
      <th style="text-align:center;padding:3px 8px;font-size:10px;color:${ms.isHome?'var(--blue)':'var(--muted)'}">${ms.isHome?ms.myTeam.abbr:ms.oppTeam.abbr}</th>
      <th style="text-align:center;padding:3px 8px;font-size:10px;color:${!ms.isHome?'var(--blue)':'var(--muted)'}">${ms.isHome?ms.oppTeam.abbr:ms.myTeam.abbr}</th>
    </tr></thead><tbody>`;
  ps.forEach((p, t) => {
    const hG = ms.isHome ? p.my : p.opp;
    const aG = ms.isHome ? p.opp : p.my;
    partialsHtml += `<tr style="border-bottom:1px solid rgba(255,255,255,.05)">
      <td style="padding:4px 6px;color:var(--muted)">${t+1}° T</td>
      <td style="text-align:center;padding:4px 8px;font-weight:600">${hG}</td>
      <td style="text-align:center;padding:4px 8px;font-weight:600">${aG}</td>
    </tr>`;
  });
  partialsHtml += `</tbody></table>`;

  // Marcatori
  const scorers = Object.entries(ms.matchGoals || {})
    .filter(([,g]) => g > 0).sort(([,a],[,b]) => b-a);
  let scorersHtml = scorers.length
    ? scorers.map(([piStr, goals]) => {
        const pi = parseInt(piStr);
        const p  = ms.myRoster[pi];
        const shirt = ms.shirtNumbers[pi] || '?';
        const name  = p ? _shortPlayerName(p) : '#'+shirt;
        const ast   = ms.matchAssists?.[pi] || 0;
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px">
          <span>#${shirt} ${name}</span>
          <span>
            <span style="color:var(--blue);font-weight:700">⚽ ${goals}</span>
            ${ast ? `<span style="color:var(--green);margin-left:8px">🤝 ${ast}</span>` : ''}
          </span>
        </div>`;
      }).join('')
    : '<div style="color:var(--muted);font-size:12px">Nessun marcatore</div>';

  // Assist (chi ha assist ma non gol)
  const pureAst = Object.entries(ms.matchAssists || {})
    .filter(([piStr, ast]) => ast > 0 && !(ms.matchGoals?.[piStr] > 0));
  if (pureAst.length) {
    scorersHtml += pureAst.map(([piStr, ast]) => {
      const pi = parseInt(piStr);
      const p  = ms.myRoster[pi];
      const shirt = ms.shirtNumbers[pi] || '?';
      const name  = p ? _shortPlayerName(p) : '#'+shirt;
      return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px">
        <span style="color:var(--muted)">#${shirt} ${name}</span>
        <span style="color:var(--green);font-weight:700">🤝 ${ast}</span>
      </div>`;
    }).join('');
  }

  // Stats
  const statsHtml = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px;margin-bottom:12px">
      <div class="irow"><span class="ilbl">Tiri miei</span><span>${ms.myShots}</span></div>
      <div class="irow"><span class="ilbl">Tiri avv.</span><span>${ms.oppShots}</span></div>
      <div class="irow"><span class="ilbl">Parate</span><span>${ms.mySaves}</span></div>
      <div class="irow"><span class="ilbl">Falli/Esp.</span><span>${ms.myFouls}</span></div>
    </div>`;

  const ov = document.createElement('div');
  ov.id = 'end-match-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.80);display:flex;align-items:center;justify-content:center;z-index:400;backdrop-filter:blur(6px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:16px;
                padding:24px;max-width:420px;width:92%;max-height:88vh;overflow-y:auto">

      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:28px;font-weight:800;color:${resultColor};letter-spacing:2px">${resultLabel}</div>
        <div style="font-size:13px;color:var(--muted);margin-top:4px">${homeN} vs ${awayN}</div>
        <div style="font-size:42px;font-weight:800;color:var(--blue);letter-spacing:6px;margin:8px 0">${hS} – ${aS}</div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Parziali</div>
      ${partialsHtml}

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Statistiche</div>
      ${statsHtml}

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Marcatori & Assist</div>
      <div style="margin-bottom:16px">${scorersHtml}</div>

      <button class="btn primary" style="width:100%;padding:12px;font-size:14px;font-weight:700"
        onclick="document.getElementById('end-match-popup').remove();endMatchConfirm()">
        Chiudi e torna al menu →
      </button>
    </div>`;

  document.body.appendChild(ov);
}

// Eseguito dopo che l'utente chiude il popup fine partita
function endMatchConfirm() {
  _doEndMatch();
}

function endMatch() {
  if (_animReqId) { cancelAnimationFrame(_animReqId); _animReqId = null; }
  _lastFrameT = null;
  const ms = G.ms; if (!ms) return;

  // Mostra prima il popup fine partita (solo per partite di campionato e playoff)
  if (!ms.poMatch || true) {
    _showEndMatchPopup(ms);
    return; // il flusso continua dopo che l'utente chiude il popup
  }
  _doEndMatch();
}

function _doEndMatch() {
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
    addLedger('playoff', earned, `Playoff: ${G.myTeam.name} vs ${ms.oppTeam.name} (${ms.myScore}-${ms.oppScore})`, currentRound());
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
    if (earned) {
      const tipo = mw ? 'vittoria' : 'pareggio';
      addLedger(tipo, earned, `G${ms.match.round}: ${G.myTeam.name} vs ${ms.oppTeam.name} (${ms.myScore}-${ms.oppScore})`, ms.match.round);
    }
    // Deduzione ingaggi (solo regular season)
    if (G.phase === 'regular') {
      const wage = calcWageBill();
      if (wage > 0) {
        G.budget -= wage;
        addLedger('ingaggi', -wage, `Monte ingaggi G${ms.match.round}`, ms.match.round);
        G.msgs.push(`💸 Ingaggi G${ms.match.round}: -${formatMoney(wage)}`);
      }
    }
    G.msgs.push('G' + ms.match.round + ': ' + G.myTeam.name + ' ' +
                (mw ? 'VINCE' : md ? 'pareggia' : 'perde') + ' vs ' + ms.oppTeam.name +
                ' (' + ms.myScore + '-' + ms.oppScore + ')' + (earned ? ' +' + formatMoney(earned) : ''));
    updateMoraleAfterMatch(ms);
    generateTransferOffers();
    if (typeof refreshMarketPool === 'function') refreshMarketPool();
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
