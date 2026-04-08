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
  if (typeof MovementController !== 'undefined') MovementController.init(G.ms);
  if (typeof poolSetSpeeds === 'function') poolSetSpeeds(G.ms);

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
      if (typeof MovementController !== 'undefined') MovementController.onPeriodStart();
    }
    if (matchEnded) {
      document.getElementById('btn-end').style.display  = '';
      document.getElementById('btn-play').style.display = 'none';
      if (typeof MovementController !== 'undefined') MovementController.stop();
    }

    // Accumula tempo di gioco verso il prossimo evento
    G.ms.lastActionTime += dt;
    if (G.ms.lastActionTime >= G.ms.nextActionIn) {
      // A velocità alta possono scattare più eventi per frame
      while (G.ms.lastActionTime >= G.ms.nextActionIn && !G.ms.finished) {
        G.ms.lastActionTime -= G.ms.nextActionIn;
        G.ms.nextActionIn    = rnd(7, 14);
        const event = generateMatchEvent(G.ms);
        if (event) {
          _appendLog(event.txt, event.cls);
          if (event.goalScored && typeof poolShootAndScore === 'function') {
            const bt = event.ballTarget || { x: 0.5, y: 0.5 };
            poolShootAndScore(bt.x, bt.y, event.goalScorer || '', event.goalTeam || 'my');
            if (typeof MovementController !== 'undefined') MovementController.onPossessChange(event.goalTeam === 'my' ? 'opp' : 'my');
          } else if (event.ballTarget) {
            poolMoveBall(event.ballTarget.x, event.ballTarget.y);
            if (event.cls === 'myg' || event.cls === 'og') {
              if (typeof MovementController !== 'undefined') MovementController.onPossessChange(event.cls === 'myg' ? 'opp' : 'my');
            }
          }
          if (event.moverKey) {
            poolMoveToken(event.moverKey, event.moverTarget?.x || 0.5, event.moverTarget?.y || 0.5);
            poolResetToken(event.moverKey);
          }
          if (event.expelled !== undefined) _handleExpulsion(event.expelled, event.moverKey);
          poolSyncTokens(G.ms);
          if (typeof poolSetSpeeds === 'function') poolSetSpeeds(G.ms);
        }
      }
      renderFieldLists();
    }

    poolAnimStep(rawDt); // l'animazione visiva resta fluida indipendentemente da speed
    if (typeof MovementController !== 'undefined') MovementController.update(rawDt * (G.ms.speed || 1));

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


// Badge RIT per la schermata partita

// Badge SCAD per contratto in scadenza
function _scadBadge(p) {
  if (!p || (p.contractYears === undefined) || p.contractYears > 1) return '';
  return '<span style="font-size:9px;background:#7b2fbe;color:#fff;font-weight:700;' +
         'padding:1px 4px;border-radius:3px;margin-left:3px" title="Contratto in scadenza">SCAD</span>';
}

function _ritBadge(p) {
  if (!p || p.retirementAge === undefined) return '';
  if ((p.age + 1) < p.retirementAge) return '';
  return '<span style="font-size:9px;background:#c0392b;color:#fff;font-weight:700;' +
         'padding:1px 4px;border-radius:3px;margin-left:3px" title="Si ritira a fine stagione">RIT</span>';
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
  const COL_FIELD = '24px 1fr 36px 28px 30px 28px 60px 36px 22px 22px 28px';  // aggiunta col VOTO
  const COL_BENCH = '24px 1fr 36px 30px 28px 60px 36px 22px 22px 28px';  // aggiunta col VOT

  const fieldTableHeader = `
    <div style="display:grid;grid-template-columns:${COL_FIELD};
                gap:3px;padding:3px 4px 5px;border-bottom:1px solid var(--border);
                font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">
      <div>#</div><div>Nome</div>
      <div title="Voto" style="text-align:center;color:var(--gold)">VOT</div>
      <div>Pos.</div><div>Ruolo</div><div>Mano</div>
      <div>Stamina</div><div>Esp.</div>
      <div title="Gol" style="text-align:center">&#x26BD;</div>
      <div title="Assist" style="text-align:center">&#x1F91D;</div>
      <div>OVR</div>
    </div>`;

  const benchTableHeader = `
    <div style="display:grid;grid-template-columns:${COL_BENCH};
                gap:3px;padding:3px 4px 5px;border-bottom:1px solid var(--border);
                font-size:9px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.3px">
      <div>#</div><div>Nome</div>
      <div title="Voto" style="text-align:center;color:var(--gold)">VOT</div>
      <div>Ruolo</div><div>Mano</div>
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
    // Voto live
    const rating = (typeof calcPlayerRating === 'function') ? calcPlayerRating(pi, ms) : 6.0;
    const ratingColor = rating >= 7.5 ? 'var(--green)' : rating >= 6.5 ? 'var(--gold)' : rating >= 5.5 ? 'var(--muted)' : 'var(--red)';
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
        <div style="font-size:12px;font-weight:800;color:${ratingColor};text-align:center">${rating.toFixed(1)}</div>
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
    // Voto panchina: se ha già giocato lo calcoliamo, altrimenti '-'
    const bHasPlayed = ms.matchDuels && ms.matchDuels[pi] !== undefined;
    const bRating    = bHasPlayed && typeof calcPlayerRating === 'function' ? calcPlayerRating(pi, ms) : null;
    const bRatingCol = bRating ? (bRating >= 7.5 ? 'var(--green)' : bRating >= 6.5 ? 'var(--gold)' : bRating >= 5.5 ? 'var(--muted)' : 'var(--red)') : 'var(--muted)';
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
        <div style="font-size:12px;font-weight:800;color:${bRatingCol};text-align:center">${bRating !== null ? bRating.toFixed(1) : '—'}</div>
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

  // Se stiamo avviando e il canvas è in fase 'idle' (kickoff),
  // inizia lo sprint a 1x — la velocità verrà ripristinata quando il pos 3 tocca la palla
  if (ms.running && typeof poolBeginSprint === 'function') {
    // poolBeginSprint gestisce internamente la fase; se non è idle non fa nulla
    const prevSpeed = ms.speed;
    poolBeginSprint(prevSpeed);
    // Forza velocità 1x durante lo sprint
    if (typeof _poolPhaseIsSprint === 'function' && _poolPhaseIsSprint()) {
      setSpeed(1);
    }
  }
}

// Espone la fase corrente del pool al match UI
function _poolPhaseIsSprint() {
  // pool.js espone _phase tramite questa funzione
  return typeof poolGetPhase === 'function' && poolGetPhase() === 'sprint';
}

function skipPeriod() {
  const ms = G.ms; if (!ms || ms.finished) return;
  ms.running = false;
  document.getElementById('btn-play').textContent = '▶ Avvia';

  // Calcola quanti secondi di gioco restano nel periodo corrente
  const periodStart  = (ms.period - 1) * PERIOD_SECONDS;
  const periodEnd    = ms.period * PERIOD_SECONDS;
  const secsLeft     = periodEnd - ms.totalSeconds;

  if (secsLeft <= 0) { refreshMatchUI(); return; }

  // Simula gli eventi rimanenti del periodo: ogni evento si ripete
  // ogni ~7s di gioco (media dell'intervallo 4-11s usato nel loop reale)
  const SIM_INTERVAL = 7; // secondi di gioco per evento
  let simTime = 0;

  _appendLog('⏩ Simulazione fine ' + ms.period + '° tempo...', '');

  while (simTime < secsLeft) {
    // Avanza la stamina per questo chunk di tempo
    if (typeof _drainStaminaChunk === 'function') {
      _drainStaminaChunk(ms, SIM_INTERVAL);
    } else {
      // Fallback inline: applica drain proporzionale
      const DRAIN_BASE = 0.012;
      Object.entries(ms.onField).forEach(([pk, pi]) => {
        if (ms.expelled.has(pi)) return;
        const p = ms.myRoster[pi];
        if (!p) return;
        const drain = DRAIN_BASE * SIM_INTERVAL * (pk === 'GK' ? 0.4 : 1.0);
        if (ms.stamina[pi] === undefined) ms.stamina[pi] = p.fitness;
        ms.stamina[pi] = Math.max(0, ms.stamina[pi] - drain);
      });
    }

    // Genera un evento simulato
    const event = generateMatchEvent(ms);
    if (event && event.txt) {
      _appendLog(event.txt, event.cls);
      // Aggiorna animazione canvas
      if (event.ballTarget) poolMoveBall(event.ballTarget.x, event.ballTarget.y);
      if (event.goalScored && typeof poolShowGoal === 'function') {
        poolShowGoal(event.goalScorer || '', event.goalTeam || 'my');
      }
      if (event.expelled !== undefined) _handleExpulsion(event.expelled, event.moverKey);
    }

    simTime += SIM_INTERVAL;
  }

  // Porta il tempo esattamente a fine periodo
  ms.totalSeconds = periodEnd;

  // Triggera la fine periodo come fa il game loop
  if (ms.period < TOTAL_PERIODS) {
    ms.period++;
    if (typeof poolStartPeriod === 'function') poolStartPeriod();
    _appendLog('⏸ Fine ' + (ms.period - 1) + '° Tempo — Partita in pausa. Puoi effettuare sostituzioni.', 'sv');
  } else {
    ms.finished = true;
    document.getElementById('btn-end').style.display  = '';
    document.getElementById('btn-play').style.display = 'none';
    _appendLog('🏁 Fine partita!', 'sv');
    // Le stelle e la deduzione ingaggi vengono assegnate in _doEndMatch
    // quando l'utente clicca "Fine Partita". Segniamo un flag per sicurezza.
    ms._skipEndedMatch = true;
  }

  poolSyncTokens(ms);
  renderFieldLists();
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
            ${p.name}${_ritBadge(p)}${_scadBadge(p)}
            ${expDots(pi)}
            ${staminaBadge(pi)}
            ${(function(){ const r = (typeof calcPlayerRating==='function') ? calcPlayerRating(pi,ms) : null; const col = r?(r>=7.5?'var(--green)':r>=6.5?'var(--gold)':r>=5.5?'var(--muted)':'var(--red)'):'var(--muted)'; return '<span style="font-size:11px;font-weight:800;color:'+col+';margin-left:5px">'+( r!==null ? r.toFixed(1) : '—')+'</span>'; })()}
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
      <div class="player-card${sel ? ' selected' : ''}" onclick="${(isExp || p.injured) ? '' : 'selSubIn(' + pi + ')'}"
           style="margin-bottom:6px;${(isExp || p.injured) ? 'opacity:.35;cursor:not-allowed' : ''}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;display:flex;align-items:center;flex-wrap:wrap;gap:2px">
            <span style="color:var(--muted);margin-right:4px">#${shirt}</span>
            ${p.name}${_ritBadge(p)}
            ${p.injured ? '<span style="font-size:9px;background:#c0392b;color:#fff;font-weight:700;padding:1px 4px;border-radius:3px;margin-left:4px">INF+</span>' : ''}
            ${expDots(pi)}
            ${staminaBadge(pi)}
            ${(function(){ const played = ms.matchDuels && ms.matchDuels[pi]!==undefined; const r = played&&(typeof calcPlayerRating==='function') ? calcPlayerRating(pi,ms) : null; const col = r?(r>=7.5?'var(--green)':r>=6.5?'var(--gold)':r>=5.5?'var(--muted)':'var(--red)'):'var(--muted)'; return '<span style="font-size:11px;font-weight:800;color:'+col+';margin-left:5px">'+(r!==null?r.toFixed(1):'—')+'</span>'; })()}
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
          <div style="font-weight:700;font-size:15px;color:var(--blue)">#${shirt} ${p.name}${_ritBadge(p)}</div>
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
        ${[['att','ATT'],['def','DIF'],['spe','VEL'],['str','FOR'],['tec','TEC'],['res','RES']].map(([a,lbl]) => `
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

  // +4 stelle per giornata — assegnate per ogni tipo di partita (campionato e playoff)
  if (window.G && G.stars !== undefined) {
    G.stars = (G.stars || 0) + 4;
    if (typeof _updateStarsBox === 'function') _updateStarsBox();
  }

  if (ms.poMatch) {
    ms.poMatch.scores.push(score);
    const totHome = ms.poMatch.scores.reduce((s, x) => s + x.home, 0);
    const totAway = ms.poMatch.scores.reduce((s, x) => s + x.away, 0);

    if (totHome !== totAway) {
      // Vincitore chiaro — risolvi normalmente
      const winner = totHome > totAway ? ms.poMatch.home : ms.poMatch.away;
      ms.poMatch.winner = winner;
      _resolvePlayoffMatch(ms.poType, ms.poMatch, winner);
      const earned = winner === G.myId ? 120000 : 40000;
      G.budget += earned;
      addLedger('playoff', earned, 'Playoff: ' + G.myTeam.name + ' vs ' + ms.oppTeam.name + ' (' + ms.myScore + '-' + ms.oppScore + ')', currentRound());
      G.msgs.push(G.myTeam.name + (winner === G.myId ? ' avanza' : ' eliminato') + ' (' + ms.myScore + '-' + ms.oppScore + ') +' + formatMoney(earned));
      G.ms = null;
      showScreen('sc-game'); updateHeader(); showTab('playoff');
    } else if (!ms.extraTime) {
      // Pareggio → 2 tempi supplementari
      ms.extraTime = true;
      ms.myScore  = totHome; ms.oppScore = totAway;
      _showExtraTimePopup();
    } else {
      // Supplementari finiti ancora pari → rigori
      _showPenaltyPopup();
    }
  } else {
    // Salva posizione PRIMA di aggiornare la classifica
    G.prevPos = getTeamPosition(G.stand, G.myId);
    ms.match.score  = score; ms.match.played = true;
    updateStandings(G.stand, ms.match.home, ms.match.away, score);

    // Salva dettagli partita (marcatori + parziali) sul match per il calendario
    const homeScorers = [], awayScorers = [];
    const isHomeMe = ms.isHome;
    // Marcatori miei (dal matchGoals)
    Object.entries(ms.matchGoals || {}).forEach(([piStr, goals]) => {
      const p = ms.myRoster[+piStr];
      if (p && goals > 0) {
        const assists = ms.matchAssists?.[+piStr] || 0;
        (isHomeMe ? homeScorers : awayScorers).push({ name: p.name, goals, assists });
      }
    });
    // Marcatori avversari: generiamo dai gol totali (non tracciati individualmente)
    if (typeof simulateMatchStats === 'function') {
      const oppRoster = G.rosters[ms.oppTeam.id] || [];
      const fakeOppScore = isHomeMe ? { home: 0, away: ms.oppScore } : { home: ms.oppScore, away: 0 };
      const det = simulateMatchStats(oppRoster, oppRoster, { home: ms.oppScore, away: 0 });
      if (det) (isHomeMe ? awayScorers : homeScorers).push(...det.home);
    }
    // Parziali dalla partita giocata
    const ps = ms.periodScores || [{my:0,opp:0},{my:0,opp:0},{my:0,opp:0},{my:0,opp:0}];
    const partials = ps.map(p => isHomeMe ? {h:p.my, a:p.opp} : {h:p.opp, a:p.my});
    ms.match.details = {
      home: isHomeMe ? homeScorers : awayScorers,
      away: isHomeMe ? awayScorers : homeScorers,
      partials,
    };
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
    // Giocatori infortunati: penalizza fitness e assegna durata infortunio (2-6 giornate)
    if (ms.injuries && ms.injuries.length) {
      ms.injuries.forEach(pi => {
        const p = ms.myRoster[pi]; if (!p) return;
        const penalty = 15 + Math.floor(Math.random() * 16);
        p.fitness = Math.max(5, (p.fitness || 70) - penalty);
        p.injured      = true;
        p.injuryWeeks  = 2 + Math.floor(Math.random() * 5); // 2-6 giornate
        G.msgs.push('🚑 ' + p.name + ' infortunato: forma ' + p.fitness + '% — out per ' + p.injuryWeeks + ' giornate.');
      });
    }
    // Salva voti finali nelle ultime 4 partite di ogni giocatore
    // null = non convocato / non ha giocato
    if (typeof calcPlayerRating === 'function') {
      const convocati = new Set(Object.keys(ms.shirtNumbers || {}).map(Number));
      ms.myRoster.forEach((p, pi) => {
        if (!p) return;
        if (!p.lastRatings) p.lastRatings = [];
        if (!convocati.has(pi)) {
          // Non convocato → null
          p.lastRatings.push(null);
        } else {
          // Convocato → voto calcolato
          const _lr = calcPlayerRating(pi, ms);
          p.lastRatings.push(_lr);
          // Conta presenza se ha ricevuto un voto reale (non null)
          if (_lr !== null) p.careerApps = (p.careerApps || 0) + 1;
        }
        if (p.lastRatings.length > 4) p.lastRatings.shift();
      });
    }
    updateMoraleAfterMatch(ms);
    generateTransferOffers();
    if (typeof refreshMarketPool === 'function') refreshMarketPool();
    // Decrementa infortuni preesistenti (non causati da questa partita)
    (G.rosters[G.myId] || []).forEach(p => {
      if (!p || !p.injured) return;
      if (ms.injuries && ms.injuries.includes(
        G.rosters[G.myId].indexOf(p)
      )) return; // già gestiti sopra
      p.injuryWeeks = (p.injuryWeeks || 1) - 1;
      if (p.injuryWeeks <= 0) {
        p.injured     = false;
        p.injuryWeeks = 0;
        G.msgs.push('✅ ' + p.name + ' è guarito — torna disponibile.');
      }
    });
    simulateRound(G.schedule, G.stand, G.teams, ms.match.round, G.myId, G.rosters);
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


// ── Supplementari: popup informativo ────────────────────────────────────
function _showExtraTimePopup() {
  const ms = G.ms;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(6px)';
  const hN = ms.isHome ? G.myTeam.name : ms.oppTeam.name;
  const aN = ms.isHome ? ms.oppTeam.name : G.myTeam.name;
  const sc = ms.isHome ? ms.myScore + '-' + ms.oppScore : ms.oppScore + '-' + ms.myScore;
  ov.id = 'penalty-et-popup';
  ov.innerHTML = '<div style="background:var(--panel);border:2px solid #f0c040;border-radius:16px;padding:28px 24px;max-width:380px;width:92%;text-align:center">'  +
    '<div style="font-size:36px;margin-bottom:8px">⏱️</div>' +
    '<div style="font-size:18px;font-weight:800;color:#f0c040;margin-bottom:6px">TEMPI SUPPLEMENTARI</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,.7);margin-bottom:6px">' + hN + ' vs ' + aN + '</div>' +
    '<div style="font-size:32px;font-weight:900;color:#fff;margin-bottom:12px">' + sc + '</div>' +
    '<div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:20px">Parità al 90\'. Si giocano 2 tempi supplementari da 3 minuti.</div>' +
    '<button onclick="document.getElementById(\'penalty-et-popup\').remove();continueMatchET()" style="width:100%;padding:12px;font-size:14px;font-weight:800;' +
    'background:linear-gradient(135deg,#f0c040,#b8860b);border:none;border-radius:8px;color:#000;cursor:pointer">' +
    '▶ Gioca i Supplementari</button>' +
    '</div>';
  document.body.appendChild(ov);
}

// Riprende la partita per i supplementari (resetta il timer, mantiene i giocatori)
function continueMatchET() {
  const ms = G.ms; if (!ms) return;
  ms.periodScores = ms.periodScores || [];
  ms._etDone = false;
  // Riparte la simulazione con 2 periodi extra
  G.ms._extraPeriods = 2;
  G.ms._extraGoals   = { my: 0, opp: 0 };
  // Simula 2 periodi supplementari rapidamente
  for (let ep = 0; ep < 2; ep++) {
    const myStr  = (ms.myRoster || []).filter(p => p && !p.injured).reduce((s, p) => s + p.overall, 0) / 7;
    const oppStr = ms.oppTeam.str;
    const tot    = myStr + oppStr;
    const myG    = Math.random() < 0.3 ? (Math.random() < myStr/tot ? 1 : 0) : 0;
    const oppG   = Math.random() < 0.3 ? (Math.random() < oppStr/tot ? 1 : 0) : 0;
    ms._extraGoals.my   += myG;
    ms._extraGoals.opp  += oppG;
    ms.myScore  += myG;
    ms.oppScore += oppG;
  }
  // Aggiorna scores per la risoluzione
  const hS = ms.isHome ? ms.myScore : ms.oppScore;
  const aS = ms.isHome ? ms.oppScore : ms.myScore;
  ms.poMatch.scores[ms.poMatch.scores.length - 1] = { home: hS, away: aS };

  G.msgs.push('⏱️ Supplementari: ' + (ms.isHome ? G.myTeam.name : ms.oppTeam.name) + ' ' + ms.myScore + '-' + ms.oppScore + ' ' + (ms.isHome ? ms.oppTeam.name : G.myTeam.name));

  if (ms.myScore !== ms.oppScore) {
    // Qualcuno ha segnato nei supplementari → fine
    _doEndMatch();
  } else {
    // Ancora pari → rigori
    _showPenaltyPopup();
  }
}

// ── Popup rigori ────────────────────────────────────────────────────────
function _showPenaltyPopup() {
  const ms = G.ms; if (!ms) return;
  const roster = (G.rosters[G.myId] || []).map((p, i) => ({ p, i }))
                   .filter(({ p }) => p && !p.injured && p.role !== 'POR')
                   .sort((a, b) => b.p.overall - a.p.overall);
  const PENALTY_COUNT = 5;
  const selected = [];

  const ov = document.createElement('div');
  ov.id = 'penalty-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(8px)';

  function renderPopup() {
    const hN = ms.isHome ? G.myTeam.name : ms.oppTeam.name;
    const aN = ms.isHome ? ms.oppTeam.name : G.myTeam.name;
    const sc = ms.isHome ? ms.myScore + '-' + ms.oppScore : ms.oppScore + '-' + ms.myScore;

    let rows = roster.map(({ p, i }) => {
      const idx    = selected.indexOf(i);
      const order  = idx >= 0 ? idx + 1 : null;
      const stamp  = Math.round(ms.stamina[i] ?? p.fitness);
      const prob   = Math.round(_penaltyProb(p, stamp) * 100);
      const probCol = prob >= 75 ? '#2ecc71' : prob >= 60 ? '#f0c040' : '#e74c3c';
      const selBg  = order ? 'rgba(0,194,255,.15)' : 'transparent';
      const selBdr = order ? 'rgba(0,194,255,.5)' : 'rgba(255,255,255,.1)';
      return '<div onclick="window._penaltyToggle(' + i + ')" style="' +
        'display:grid;grid-template-columns:24px 1fr 50px 50px 60px 50px;align-items:center;gap:8px;' +
        'padding:8px 10px;border:1px solid ' + selBdr + ';border-radius:8px;margin-bottom:4px;' +
        'background:' + selBg + ';cursor:pointer;transition:background .12s">' +
        '<div style="font-size:14px;font-weight:900;color:' + (order ? '#00c2ff' : 'rgba(255,255,255,.2)') + ';text-align:center">' +
          (order || '·') + '</div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;color:#fff">' + p.name + '</div>' +
          '<div style="font-size:10px;color:rgba(255,255,255,.4)">' + p.role + ' · ' + p.age + 'a</div>' +
        '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center">' +
          '<div style="font-size:9px;color:rgba(255,255,255,.3)">TEC</div>' + (p.stats.tec||'—') + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center">' +
          '<div style="font-size:9px;color:rgba(255,255,255,.3)">FOR</div>' + (p.stats.str||'—') + '</div>' +
        '<div style="font-size:11px;color:rgba(255,255,255,.5);text-align:center">' +
          '<div style="font-size:9px;color:rgba(255,255,255,.3)">STAM</div>' + stamp + '%</div>' +
        '<div style="font-size:12px;font-weight:800;color:' + probCol + ';text-align:right">' + prob + '%</div>' +
        '</div>';
    }).join('');

    const canShoot = selected.length === PENALTY_COUNT;
    ov.innerHTML = '<div style="background:var(--panel);border:2px solid rgba(0,194,255,.4);border-radius:16px;' +
      'padding:20px;max-width:520px;width:95%;max-height:90vh;overflow-y:auto">' +
      // Header
      '<div style="text-align:center;margin-bottom:16px">' +
        '<div style="font-size:30px;margin-bottom:6px">🎯</div>' +
        '<div style="font-size:18px;font-weight:800;color:#00c2ff">RIGORI</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,.6);margin-top:4px">' + hN + ' vs ' + aN + ' · ' + sc + '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:rgba(255,255,255,.5);margin-bottom:8px">' +
        'Seleziona <strong style="color:#00c2ff">5 rigoristi</strong> nell\'ordine di battuta (clicca per selezionare/deselezionare). ' +
        'La % indica la probabilità di segnare.' +
      '</div>' +
      // Header colonne
      '<div style="display:grid;grid-template-columns:24px 1fr 50px 50px 60px 50px;gap:8px;padding:0 10px 6px;' +
        'font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.28)">' +
        '<div>#</div><div>Giocatore</div><div style="text-align:center">TEC</div><div style="text-align:center">FOR</div>' +
        '<div style="text-align:center">Stamina</div><div style="text-align:right">%</div>' +
      '</div>' +
      rows +
      '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1);' +
        'display:flex;align-items:center;justify-content:space-between">' +
        '<div style="font-size:12px;color:rgba(255,255,255,.4)">Selezionati: <strong style="color:#00c2ff">' +
          selected.length + '</strong> / 5</div>' +
        '<button id="pen-shoot-btn" onclick="window._executePenalties()" style="padding:10px 24px;font-size:13px;font-weight:800;' +
          'border-radius:8px;background:' + (canShoot ? 'linear-gradient(135deg,#00c2ff,#0066cc)' : 'rgba(255,255,255,.1)') + ';' +
          'border:none;color:' + (canShoot ? '#000' : 'rgba(255,255,255,.3)') + ';cursor:' + (canShoot ? 'pointer' : 'not-allowed') + '">' +
          '🎯 Batti i rigori</button>' +
      '</div>' +
      '</div>';
  }

  window._penaltySelected = selected;
  window._penaltyRoster   = roster;

  window._penaltyToggle = function(i) {
    const idx = selected.indexOf(i);
    if (idx >= 0) {
      selected.splice(idx, 1);
    } else if (selected.length < PENALTY_COUNT) {
      selected.push(i);
    }
    renderPopup();
  };

  window._executePenalties = function() {
    if (selected.length < PENALTY_COUNT) return;
    const ms = G.ms;
    // Nostri rigoristi nell'ordine scelto
    const myShooters  = selected.map(i => ({ p: G.rosters[G.myId][i], stamina: Math.round(ms.stamina[i] ?? G.rosters[G.myId][i]?.fitness ?? 70) }));
    // Rigoristi avversari: i top 5 per OVR
    const oppRoster   = (G.rosters[ms.oppTeam.id] || []).filter(p => p && !p.injured && p.role !== 'POR')
                          .sort((a,b) => b.overall - a.overall).slice(0,5);

    let myG = 0, oppG = 0;
    const log = [];
    for (let k = 0; k < PENALTY_COUNT; k++) {
      const mine = myShooters[k]; const oppP = oppRoster[k];
      const myScore  = mine && Math.random() < _penaltyProb(mine.p, mine.stamina);
      const oppScore = oppP && Math.random() < _penaltyProb(oppP, oppP.fitness);
      if (myScore)  myG++;
      if (oppScore) oppG++;
      log.push({ myName: mine?.p?.name || '?', myScore, oppName: oppP?.name || '?', oppScore });
    }
    // Sudden death se pari dopo 5
    let sd = 0;
    while (myG === oppG && sd < 20) {
      sd++;
      const mine = myShooters[sd % PENALTY_COUNT]; const oppP = oppRoster[sd % PENALTY_COUNT];
      const myScore  = mine && Math.random() < _penaltyProb(mine.p, mine.stamina);
      const oppScore = oppP && Math.random() < _penaltyProb(oppP, oppP.fitness);
      if (myScore) myG++; if (oppScore) oppG++;
      log.push({ myName: mine?.p?.name || '?', myScore, oppName: oppP?.name || '?', oppScore, sd: true });
    }

    // Mostra risultato
    ov.remove();
    _showPenaltyResult(log, myG, oppG);
  };

  document.body.appendChild(ov);
  renderPopup();
}

// Mostra il risultato dei rigori e poi chiude la partita
function _showPenaltyResult(log, myG, oppG) {
  const ms = G.ms;
  const myWin = myG > oppG;
  const hN = ms.isHome ? G.myTeam.name : ms.oppTeam.name;
  const aN = ms.isHome ? ms.oppTeam.name : G.myTeam.name;
  const myTeamLabel  = G.myTeam.name;
  const oppTeamLabel = ms.oppTeam.name;

  let rows = log.map((r, i) => {
    const num = r.sd ? 'SD' : String(i + 1);
    return '<tr style="border-bottom:1px solid rgba(255,255,255,.05)">' +
      '<td style="padding:5px 8px;font-size:11px;color:rgba(255,255,255,.4);text-align:center">' + num + '</td>' +
      '<td style="padding:5px 8px;font-size:12px;font-weight:' + (r.myScore ? '700' : '400') + ';color:' + (r.myScore ? '#2ecc71' : '#e74c3c') + '">' +
        r.myName + ' ' + (r.myScore ? '✓' : '✗') + '</td>' +
      '<td style="padding:5px 8px;font-size:12px;font-weight:' + (r.oppScore ? '700' : '400') + ';color:' + (r.oppScore ? '#2ecc71' : '#e74c3c') + ';text-align:right">' +
        (r.oppScore ? '✓' : '✗') + ' ' + r.oppName + '</td>' +
    '</tr>';
  }).join('');

  const res  = document.createElement('div');
  res.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(8px)';
  res.id = 'pen-result-popup';
  res.innerHTML = '<div style="background:var(--panel);border:2px solid ' + (myWin ? '#2ecc71' : '#e74c3c') + ';border-radius:16px;padding:22px;max-width:460px;width:95%;max-height:85vh;overflow-y:auto">' +
    '<div style="text-align:center;margin-bottom:14px">' +
      '<div style="font-size:30px;margin-bottom:6px">' + (myWin ? '🎯✅' : '🎯❌') + '</div>' +
      '<div style="font-size:18px;font-weight:800;color:' + (myWin ? '#2ecc71' : '#e74c3c') + '">' + (myWin ? 'AVANTI! RIGORI VINTI' : 'RIGORI PERSI') + '</div>' +
      '<div style="font-size:28px;font-weight:900;color:#fff;margin:8px 0">' + myTeamLabel + ' ' + myG + ' - ' + oppG + ' ' + oppTeamLabel + '</div>' +
    '</div>' +
    '<table style="width:100%;margin-bottom:14px"><thead>' +
      '<tr><th style="padding:4px 8px;font-size:10px;color:rgba(255,255,255,.3)">#</th>' +
      '<th style="padding:4px 8px;font-size:10px;color:rgba(255,255,255,.3)">' + myTeamLabel + '</th>' +
      '<th style="padding:4px 8px;font-size:10px;color:rgba(255,255,255,.3);text-align:right">' + oppTeamLabel + '</th></tr>' +
    '</thead><tbody>' + rows + '</tbody></table>' +
    '<button onclick="document.getElementById(\'pen-result-popup\').remove();_finalizePenaltyMatch(' + (myWin ? 'true' : 'false') + ')" style="width:100%;padding:12px;font-size:14px;font-weight:800;' +
    'background:linear-gradient(135deg,#0a5ca8,#0844a0);border:none;border-radius:8px;color:#fff;cursor:pointer">' +
    'Continua →</button>' +
    '</div>';
  document.body.appendChild(res);
}

// Finalizza la partita dopo i rigori
function _finalizePenaltyMatch(myWin) {
  const ms = G.ms; if (!ms) return;
  // +4 stelle (partita playoff ai rigori)
  if (window.G && G.stars !== undefined) {
    G.stars = (G.stars || 0) + 4;
    if (typeof _updateStarsBox === 'function') _updateStarsBox();
  }
  const winner = myWin ? G.myId : ms.oppTeam.id;
  ms.poMatch.winner = winner;
  G.msgs.push('🎯 Rigori: ' + G.myTeam.name + (myWin ? ' VINCE e avanza!' : ' eliminato ai rigori.'));
  _resolvePlayoffMatch(ms.poType, ms.poMatch, winner);
  const earned = winner === G.myId ? 120000 : 40000;
  G.budget += earned;
  addLedger('playoff', earned, 'Playoff rigori: ' + G.myTeam.name + ' vs ' + ms.oppTeam.name, currentRound ? currentRound() : 0);
  G.ms = null;
  showScreen('sc-game'); updateHeader(); showTab('playoff');
}
