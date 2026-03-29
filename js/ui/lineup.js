// ─────────────────────────────────────────────
// ui/lineup.js
// Schermata convocazioni e formazione
// ─────────────────────────────────────────────

// Stato locale della schermata (non fa parte di G)
let luState = {
  formation:      {}, // posKey → rosterIdx
  convocati:      new Set(),
  selectedPlayer: null,
  selectedPos:    null,
  match:          null,
  isHome:         true,
  opp:            null,
  poType:         null, // null = regular, 'sf'/'final'/'pl'
  poMatch:        null,
};

// ── Apre la schermata convocazioni ───────────
function openLineup(match, isHome, opp, poType = null, poMatch = null) {
  luState = {
    formation: {}, convocati: new Set(),
    selectedPlayer: null, selectedPos: null,
    match, isHome, opp, poType, poMatch,
  };
  const label = poType === 'sf'    ? match.label
              : poType === 'final' ? 'Finale Scudetto'
              : poType === 'pl'    ? 'Play-out'
              : 'Giornata ' + match.round;

  document.getElementById('lu-lbl').textContent   = label + ' · ' + (isHome ? 'Casa' : 'Trasferta');
  document.getElementById('lu-title').textContent = G.myTeam.name + ' vs ' + opp.name;

  showScreen('sc-lineup');
  renderLineupPool();
  renderPlayerSelList();
  updateLuStatus();
}

function cancelLineup() {
  showScreen('sc-game');
  updateHeader();
  showTab('dash');
}

// ── Disegna il mini-campo con gli slot ────────
function renderLineupPool() {
  const container = document.getElementById('lineup-pool');
  container.innerHTML = '';
  const W = container.offsetWidth || 380;
  const H = Math.round(W / 1.6);
  container.style.height = H + 'px';

  // SVG sfondo
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', '0 0 380 238');
  svg.style.position = 'absolute'; svg.style.inset = '0';
  svg.innerHTML = `
    <rect width="380" height="238" fill="#00a8c8"/>
    <rect x="2" y="2" width="376" height="234" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity=".4" rx="6"/>
    <line x1="190" y1="2" x2="190" y2="236" stroke="#fff" stroke-width=".8" stroke-opacity=".2" stroke-dasharray="6,4"/>
    <path d="M95,190 Q190,145 285,190" fill="none" stroke="#fff" stroke-width="1.2" stroke-opacity=".4"/>
    <path d="M40,190 Q190,100 340,190" fill="none" stroke="#f0c040" stroke-width="1" stroke-opacity=".4"/>
    <rect x="155" y="218" width="70" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2" stroke-opacity=".6"/>
    <text x="190" y="230" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.5)">${G.myTeam.abbr}</text>
    <rect x="155" y="4"   width="70" height="16" rx="3" fill="none" stroke="#e74c3c" stroke-width="2" stroke-opacity=".6"/>
    <text x="190" y="16" text-anchor="middle" font-size="8" fill="rgba(231,76,60,.6)">${luState.opp ? luState.opp.abbr : 'OPP'}</text>
  `;
  container.appendChild(svg);

  // Slot posizioni
  POS_KEYS.forEach(pk => {
    const pos    = POSITIONS[pk];
    const filled = luState.formation[pk] !== undefined;
    const p      = filled ? G.rosters[G.myId][luState.formation[pk]] : null;
    const isSel  = luState.selectedPos === pk;

    const div = document.createElement('div');
    div.style.cssText = [
      'position:absolute',
      `left:calc(${pos.x * 100}% - 20px)`,
      `top:calc(${pos.y * 100}% - 20px)`,
      'width:40px', 'height:40px', 'border-radius:50%',
      'display:flex', 'align-items:center', 'justify-content:center',
      'cursor:pointer', 'z-index:5', 'transition:all .15s',
      'text-align:center', 'line-height:1.1',
    ].join(';');

    if (filled && p) {
      div.style.background   = '#185FA5';
      div.style.border       = isSel ? '3px solid var(--gold)' : '2px solid #00c2ff';
      div.style.boxShadow    = isSel ? '0 0 12px var(--gold)' : '';
      div.style.color        = '#fff';
      div.style.fontSize     = '9px';
      div.style.fontWeight   = '700';
      div.innerHTML = `<div><div>${p.name.split(' ').pop()}</div>
                       <div style="font-size:8px;opacity:.7">${pos.label}</div></div>`;
      div.title = p.name + ' · ' + pos.label + ' · Mano: ' + (p.hand === 'L' ? 'Sinistra' : 'Destra');
    } else {
      div.style.background   = 'rgba(0,0,0,.3)';
      div.style.border       = isSel ? '3px solid var(--gold)' : '2px dashed rgba(255,255,255,.4)';
      div.style.boxShadow    = isSel ? '0 0 12px var(--gold)' : '';
      div.style.color        = 'rgba(255,255,255,.6)';
      div.style.fontSize     = '9px';
      div.innerHTML          = `<div>${pos.label}</div>`;
    }
    div.onclick = () => selectPos(pk);
    container.appendChild(div);
  });
}

// ── Lista giocatori selezionabili ─────────────
function renderPlayerSelList() {
  const container = document.getElementById('player-sel-list');
  container.innerHTML = '';
  const roster      = G.rosters[G.myId];
  const usedByPos   = {};
  Object.entries(luState.formation).forEach(([pos, pi]) => { usedByPos[pi] = pos; });

  roster.forEach((p, i) => {
    const isSel    = luState.selectedPlayer === i;
    const usedPos  = usedByPos[i];
    const posLabel = usedPos ? POSITIONS[usedPos].label : '—';

    const div = document.createElement('div');
    div.className = 'player-card' + (isSel ? ' selected' : usedPos ? ' starter' : '');
    div.style.marginBottom = '4px';
    div.innerHTML = `
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${p.name}</div>
        <div style="font-size:11px;color:var(--muted)">
          ${p.role} · OVR ${p.overall} ·
          <span style="font-weight:700;color:${p.hand === 'L' ? '#80c0ff' : 'var(--muted)'}">
            ${p.hand === 'L' ? 'Mancino (L)' : 'Destro (R)'}
          </span>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;font-weight:600;color:${usedPos ? 'var(--blue)' : 'var(--muted)'}">${posLabel}</div>
        <div style="font-size:11px;color:var(--muted)">${p.fitness}% forma</div>
      </div>`;
    div.onclick = () => selectPlayerLu(i);
    container.appendChild(div);
  });
}

// ── Interazione: selezione posizione ──────────
function selectPos(pk) {
  if (luState.selectedPlayer !== null) {
    // Rimuovi il giocatore da qualsiasi altra posizione
    Object.keys(luState.formation).forEach(p => {
      if (luState.formation[p] === luState.selectedPlayer) delete luState.formation[p];
    });
    // Rimuovi chi c'era prima in questa posizione
    const prev = luState.formation[pk];
    if (prev !== undefined) luState.convocati.delete(prev);

    luState.formation[pk] = luState.selectedPlayer;
    luState.convocati.add(luState.selectedPlayer);
    luState.selectedPlayer = null;
    luState.selectedPos    = null;
  } else {
    luState.selectedPos = pk;
  }
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

// ── Interazione: selezione giocatore ──────────
function selectPlayerLu(i) {
  luState.selectedPlayer = luState.selectedPlayer === i ? null : i;
  if (luState.selectedPos !== null && luState.selectedPlayer !== null) {
    selectPos(luState.selectedPos);
    return;
  }
  renderPlayerSelList(); updateLuStatus();
}

// ── Auto-formazione ───────────────────────────
function autoFillLineup() {
  luState.formation = {}; luState.convocati = new Set();
  const roster = G.rosters[G.myId];
  const used   = new Set();

  // Portiere: il migliore disponibile
  const porCands = roster
    .map((p, i) => ({ p, i }))
    .filter(x => x.p.role === 'POR')
    .sort((a, b) => b.p.overall - a.p.overall);
  if (porCands.length) {
    luState.formation['GK'] = porCands[0].i;
    used.add(porCands[0].i);
    luState.convocati.add(porCands[0].i);
  }

  // Posizioni di campo: miglior giocatore per affinità di ruolo
  ['5','6','1','4','2','3'].forEach(pk => {
    const pref  = POS_ROLE_AFFINITY[pk];
    const cands = roster
      .map((p, i) => ({ p, i }))
      .filter(x => !used.has(x.i) && x.p.role !== 'POR')
      .sort((a, b) => {
        const sa = (a.p.role === pref ? 10 : 0) + a.p.overall;
        const sb = (b.p.role === pref ? 10 : 0) + b.p.overall;
        return sb - sa;
      });
    if (cands.length) {
      luState.formation[pk] = cands[0].i;
      used.add(cands[0].i);
      luState.convocati.add(cands[0].i);
    }
  });

  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

function clearLineup() {
  luState.formation = {}; luState.convocati = new Set();
  luState.selectedPlayer = null; luState.selectedPos = null;
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

// ── Stato e validazione ───────────────────────
function updateLuStatus() {
  const filled = Object.keys(luState.formation).length;
  const total  = POS_KEYS.length;
  const hasGK  = luState.formation['GK'] !== undefined;
  let msg = `Formazione: ${filled}/${total} posizioni`;
  if (!hasGK)                       msg += ' — <strong style="color:var(--red)">Serve un Portiere!</strong>';
  if (luState.selectedPlayer !== null) msg += ' — <strong style="color:var(--gold)">Clicca una posizione</strong>';
  if (luState.selectedPos !== null && luState.selectedPlayer === null) msg += ' — <strong style="color:var(--gold)">Clicca un giocatore</strong>';

  document.getElementById('lu-status').innerHTML = msg;
  document.getElementById('btn-confirm-lu').disabled = (filled !== total);
}

// ── Conferma e avvia la partita ───────────────
function confirmLineup() {
  G.lineup = { formation: { ...luState.formation }, convocati: [...luState.convocati] };
  showScreen('sc-match');
  startLiveMatch(luState.match, luState.isHome, luState.opp, luState.poType, luState.poMatch);
}

// ── PATCH: sovrascrive confirmLineup con versione che assegna numeri maglia ──
(function() {
  const _orig = confirmLineup;
  // eslint-disable-next-line no-global-assign
  confirmLineup = function() {
    // Assegna numeri di maglia: titolari 1-7, riserve 8+
    const shirtNumbers = {};
    let n = 1;
    POS_KEYS.forEach(pk => {
      const pi = luState.formation[pk];
      if (pi !== undefined) shirtNumbers[pi] = n++;
    });
    [...luState.convocati]
      .filter(pi => !Object.values(luState.formation).includes(pi))
      .forEach(pi => { shirtNumbers[pi] = n++; });

    G.lineup = {
      formation:    { ...luState.formation },
      convocati:    [...luState.convocati],
      shirtNumbers,
    };
    showScreen('sc-match');
    startLiveMatch(luState.match, luState.isHome, luState.opp, luState.poType, luState.poMatch);
  };
})();
