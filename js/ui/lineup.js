// ─────────────────────────────────────────────
// ui/lineup.js  — Convocazioni e formazione
//
// Feature:
//  1. Numerazione manuale camicie (1-13) nella lista
//  2. Formazione ricordata tra una gara e l'altra (G.savedLineup)
//  3. Drag-and-drop dalla lista → slot in campo
// ─────────────────────────────────────────────

let luState = {
  formation: {}, convocati: new Set(), shirtNumbers: {},
  selectedPlayer: null, selectedPos: null, dragSrc: null,
  match: null, isHome: true, opp: null, poType: null, poMatch: null,
};

const MAX_CONVOCATI = 13;

// ── Apre la schermata ─────────────────────────
function openLineup(match, isHome, opp, poType = null, poMatch = null) {
  const saved = G.savedLineup || {};
  luState = {
    formation:      { ...(saved.formation || {}) },
    convocati:      new Set(saved.convocati || []),
    shirtNumbers:   { ...(saved.shirtNumbers || {}) },
    selectedPlayer: null, selectedPos: null, dragSrc: null,
    match, isHome, opp, poType, poMatch,
  };
  const label = poType === 'sf' ? match.label
              : poType === 'final' ? 'Finale Scudetto'
              : poType === 'pl' ? 'Play-out'
              : 'Giornata ' + match.round;
  document.getElementById('lu-lbl').textContent   = label + ' · ' + (isHome ? 'Casa' : 'Trasferta');
  document.getElementById('lu-title').textContent = G.myTeam.name + ' vs ' + opp.name;
  showScreen('sc-lineup');
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

function cancelLineup() { showScreen('sc-game'); updateHeader(); showTab('dash'); }

// ── Campo visuale con drag-and-drop ───────────
function renderLineupPool() {
  const container = document.getElementById('lineup-pool');
  container.innerHTML = '';
  const W = container.offsetWidth || 380;
  const H = Math.round(W / 1.6);
  container.style.height = H + 'px';

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%');
  svg.setAttribute('viewBox', '0 0 380 238');
  svg.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  svg.innerHTML = `
    <rect width="380" height="238" fill="#00a8c8"/>
    <rect x="2" y="2" width="376" height="234" fill="none" stroke="#fff" stroke-width="1.5" stroke-opacity=".4" rx="6"/>
    <line x1="190" y1="2" x2="190" y2="236" stroke="#fff" stroke-width=".8" stroke-opacity=".2" stroke-dasharray="6,4"/>
    <path d="M95,190 Q190,145 285,190" fill="none" stroke="#fff" stroke-width="1.2" stroke-opacity=".4"/>
    <path d="M40,190 Q190,100 340,190" fill="none" stroke="#f0c040" stroke-width="1" stroke-opacity=".4"/>
    <rect x="155" y="218" width="70" height="16" rx="3" fill="none" stroke="#fff" stroke-width="2" stroke-opacity=".6"/>
    <text x="190" y="230" text-anchor="middle" font-size="8" fill="rgba(255,255,255,.5)">${G.myTeam.abbr}</text>
    <rect x="155" y="4" width="70" height="16" rx="3" fill="none" stroke="#e74c3c" stroke-width="2" stroke-opacity=".6"/>
    <text x="190" y="16" text-anchor="middle" font-size="8" fill="rgba(231,76,60,.6)">${luState.opp ? luState.opp.abbr : 'OPP'}</text>`;
  container.appendChild(svg);

  POS_KEYS.forEach(pk => {
    const pos   = POSITIONS[pk];
    const pi    = luState.formation[pk];
    const filled = pi !== undefined;
    const p     = filled ? G.rosters[G.myId][pi] : null;
    const isSel = luState.selectedPos === pk;
    const shirt = filled ? (luState.shirtNumbers[pi] || '') : '';

    const slot = document.createElement('div');
    slot.dataset.poskey = pk;
    slot.style.cssText = [
      'position:absolute',
      `left:calc(${pos.x * 100}% - 22px)`,
      `top:calc(${pos.y * 100}% - 22px)`,
      'width:44px', 'height:44px', 'border-radius:50%',
      'display:flex', 'align-items:center', 'justify-content:center',
      'cursor:pointer', 'z-index:5', 'transition:all .15s',
      'text-align:center', 'line-height:1.2', 'user-select:none',
    ].join(';');

    if (filled && p) {
      slot.style.background = '#185FA5';
      slot.style.border     = isSel ? '3px solid var(--gold)' : '2px solid #00c2ff';
      slot.style.boxShadow  = isSel ? '0 0 14px var(--gold)' : '';
      slot.style.color      = '#fff';
      slot.innerHTML = `<div style="font-size:8px;font-weight:700">
        <div style="font-size:11px;color:#f0c040">${shirt}</div>
        <div style="font-size:8px">${p.name.split(' ').pop()}</div>
        <div style="font-size:7px;opacity:.7">${pos.label}</div>
      </div>`;
      slot.title = `#${shirt} ${p.name} · ${pos.label}`;
    } else {
      slot.style.background = 'rgba(0,0,0,.3)';
      slot.style.border     = isSel ? '3px solid var(--gold)' : '2px dashed rgba(255,255,255,.4)';
      slot.style.boxShadow  = isSel ? '0 0 14px var(--gold)' : '';
      slot.style.color      = 'rgba(255,255,255,.6)';
      slot.innerHTML        = `<div style="font-size:9px">${pos.label}</div>`;
    }

    slot.onclick = () => selectPos(pk);

    // Drop target
    slot.addEventListener('dragover', e => { e.preventDefault(); slot.style.outline = '2px solid #f0c040'; });
    slot.addEventListener('dragleave', () => { slot.style.outline = ''; });
    slot.addEventListener('drop', e => {
      e.preventDefault(); slot.style.outline = '';
      const srcPi = parseInt(e.dataTransfer.getData('rosterIdx'), 10);
      if (!isNaN(srcPi)) _assignToPos(pk, srcPi);
    });

    container.appendChild(slot);
  });
}

// ── Lista giocatori con numeri maglia ─────────
function renderPlayerSelList() {
  const container = document.getElementById('player-sel-list');
  container.innerHTML = '';
  const roster    = G.rosters[G.myId];
  const usedByPos = {};
  Object.entries(luState.formation).forEach(([pk, pi]) => { usedByPos[pi] = pk; });

  // Intestazione
  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:grid;grid-template-columns:34px 1fr 76px 38px;gap:4px;padding:3px 6px 5px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid var(--border);margin-bottom:4px';
  hdr.innerHTML = '<div title="Numero maglia">#</div><div>Giocatore</div><div>Pos / Ruolo</div><div>Forma</div>';
  container.appendChild(hdr);

  roster.forEach((p, i) => {
    const isSel  = luState.selectedPlayer === i;
    const usedPk = usedByPos[i];
    const isConv = luState.convocati.has(i);
    const shirt  = luState.shirtNumbers[i] || '';
    const posLabel = usedPk ? (POSITIONS[usedPk]?.label || usedPk) : (isConv ? 'Riserva' : '');

    const row = document.createElement('div');
    row.style.cssText = [
      'display:grid', 'grid-template-columns:34px 1fr 76px 38px',
      'gap:4px', 'align-items:center', 'padding:5px 6px',
      'border-radius:8px', 'margin-bottom:3px', 'transition:all .12s',
      'border:1.5px solid ' + (isSel ? 'var(--blue)' : usedPk ? '#185FA5' : isConv ? 'rgba(255,255,255,.1)' : 'transparent'),
      'background:' + (isSel ? 'rgba(0,194,255,.12)' : usedPk ? 'rgba(24,95,165,.15)' : isConv ? 'rgba(255,255,255,.04)' : 'transparent'),
      'cursor:' + (usedPk || isConv ? 'grab' : 'pointer'),
    ].join(';');

    // Cella numero maglia
    const shirtCell = document.createElement('div');
    shirtCell.style.cssText = 'display:flex;align-items:center;justify-content:center';
    if (isConv) {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.min = '1'; inp.max = '13';
      inp.value = shirt;
      inp.placeholder = '—';
      inp.title = 'Numero maglia (1-13)';
      inp.style.cssText = 'width:30px;height:26px;border-radius:5px;border:1px solid var(--border);background:var(--panel2);color:var(--blue);font-weight:700;font-size:12px;text-align:center;padding:0;cursor:text';
      inp.onclick  = e => e.stopPropagation();
      inp.ondblclick = e => e.stopPropagation();
      inp.onchange = () => {
        const v = parseInt(inp.value, 10);
        if (!isNaN(v) && v >= 1 && v <= 13) {
          // Rimuovi lo stesso numero da altri giocatori
          Object.keys(luState.shirtNumbers).forEach(k => {
            if (luState.shirtNumbers[k] === v && parseInt(k, 10) !== i) delete luState.shirtNumbers[k];
          });
          luState.shirtNumbers[i] = v;
        } else {
          delete luState.shirtNumbers[i];
          inp.value = '';
        }
        renderLineupPool(); renderPlayerSelList(); updateLuStatus();
      };
      shirtCell.appendChild(inp);
    } else {
      shirtCell.innerHTML = `<span style="font-size:11px;color:var(--muted)">—</span>`;
    }
    row.appendChild(shirtCell);

    // Cella nome
    const nameCell = document.createElement('div');
    nameCell.style.cssText = 'min-width:0';
    nameCell.innerHTML = `
      <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
      <div style="font-size:10px;color:var(--muted)">${p.role} · <span style="color:${p.hand==='L'?'#80c0ff':'var(--muted)'}">${p.hand==='L'?'Mancino':'Destro'}</span> · OVR ${p.overall}</div>`;
    row.appendChild(nameCell);

    // Cella posizione
    const posCell = document.createElement('div');
    posCell.innerHTML = `<span style="font-size:11px;font-weight:600;color:${usedPk?'var(--blue)':isConv?'var(--muted)':'rgba(255,255,255,.2)'}">${posLabel||'—'}</span>`;
    row.appendChild(posCell);

    // Cella forma
    const fc = p.fitness > 70 ? '#2ecc71' : p.fitness > 45 ? '#f0c040' : '#e74c3c';
    const fitCell = document.createElement('div');
    fitCell.innerHTML = `<span style="font-size:11px;color:${fc}">${p.fitness}%</span>`;
    row.appendChild(fitCell);

    // Click per selezionare / aggiungere ai convocati
    row.onclick = () => selectPlayerLu(i);

    // Doppio click: rimuovi dai convocati
    row.ondblclick = e => {
      e.stopPropagation();
      if (isConv) removeFromConvocati(i);
    };

    // Drag source
    if (usedPk || isConv) {
      row.draggable = true;
      row.addEventListener('dragstart', e => {
        luState.dragSrc = i;
        e.dataTransfer.setData('rosterIdx', String(i));
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => { row.style.opacity = '.4'; }, 0);
      });
      row.addEventListener('dragend', () => { row.style.opacity = ''; });
    }

    container.appendChild(row);
  });

  // Footer info
  const footer = document.createElement('div');
  footer.style.cssText = 'margin-top:8px;padding:6px 8px;border-radius:7px;background:var(--panel2);font-size:11px;color:var(--muted);line-height:1.5';
  footer.innerHTML = `<strong style="color:var(--blue)">${luState.convocati.size}</strong>/${MAX_CONVOCATI} convocati ·
    Clicca per selezionare · <strong>Trascina</strong> sulle posizioni ·
    Doppio click per rimuovere`;
  container.appendChild(footer);
}

// ── Logica assegnazione ───────────────────────
function _assignToPos(pk, pi) {
  Object.keys(luState.formation).forEach(p => {
    if (luState.formation[p] === pi) delete luState.formation[p];
  });
  luState.formation[pk] = pi;
  luState.convocati.add(pi);
  luState.selectedPlayer = null;
  luState.selectedPos    = null;
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

function selectPos(pk) {
  if (luState.selectedPlayer !== null) {
    _assignToPos(pk, luState.selectedPlayer);
  } else {
    luState.selectedPos = luState.selectedPos === pk ? null : pk;
    renderLineupPool(); updateLuStatus();
  }
}

function selectPlayerLu(i) {
  if (luState.selectedPlayer === i) {
    luState.selectedPlayer = null;
  } else {
    luState.selectedPlayer = i;
    if (!luState.convocati.has(i) && luState.convocati.size < MAX_CONVOCATI) {
      luState.convocati.add(i);
    }
  }
  if (luState.selectedPos !== null && luState.selectedPlayer !== null) {
    _assignToPos(luState.selectedPos, luState.selectedPlayer);
    return;
  }
  renderPlayerSelList(); updateLuStatus();
}

function removeFromConvocati(pi) {
  luState.convocati.delete(pi);
  delete luState.shirtNumbers[pi];
  Object.keys(luState.formation).forEach(pk => {
    if (luState.formation[pk] === pi) delete luState.formation[pk];
  });
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

// ── Auto-formazione ───────────────────────────
function autoFillLineup() {
  luState.formation = {}; luState.convocati = new Set(); luState.shirtNumbers = {};
  const roster = G.rosters[G.myId];
  const used   = new Set();

  const por = roster.map((p, i) => ({ p, i }))
    .filter(x => x.p.role === 'POR')
    .sort((a, b) => b.p.overall - a.p.overall)[0];
  if (por) { luState.formation['GK'] = por.i; used.add(por.i); luState.convocati.add(por.i); }

  ['5','6','1','4','2','3'].forEach(pk => {
    const pref  = POS_ROLE_AFFINITY[pk];
    const cands = roster.map((p, i) => ({ p, i }))
      .filter(x => !used.has(x.i) && x.p.role !== 'POR')
      .sort((a, b) => ((b.p.role===pref?10:0)+b.p.overall) - ((a.p.role===pref?10:0)+a.p.overall));
    if (cands.length) { luState.formation[pk]=cands[0].i; used.add(cands[0].i); luState.convocati.add(cands[0].i); }
  });

  // Riserve migliori
  roster.map((p, i) => ({ p, i }))
    .filter(x => !used.has(x.i))
    .sort((a, b) => b.p.overall - a.p.overall)
    .forEach(({ i }) => { if (luState.convocati.size < MAX_CONVOCATI) luState.convocati.add(i); });

  _autoAssignShirts();
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

function _autoAssignShirts() {
  luState.shirtNumbers = {};
  let n = 1;
  POS_KEYS.forEach(pk => {
    const pi = luState.formation[pk];
    if (pi !== undefined) luState.shirtNumbers[pi] = n++;
  });
  [...luState.convocati]
    .filter(pi => !Object.values(luState.formation).includes(pi))
    .forEach(pi => { luState.shirtNumbers[pi] = n++; });
}

function clearLineup() {
  luState.formation = {}; luState.convocati = new Set(); luState.shirtNumbers = {};
  luState.selectedPlayer = null; luState.selectedPos = null;
  renderLineupPool(); renderPlayerSelList(); updateLuStatus();
}

// ── Validazione ───────────────────────────────
function updateLuStatus() {
  const filled    = Object.keys(luState.formation).length;
  const hasGK     = luState.formation['GK'] !== undefined;
  const convCount = luState.convocati.size;
  const withShirt = [...luState.convocati].filter(pi => luState.shirtNumbers[pi] !== undefined).length;
  const shirtsOk  = withShirt === convCount && convCount > 0;
  const vals      = Object.values(luState.shirtNumbers);
  const unique    = new Set(vals).size === vals.length;

  let msg = `Formazione: <strong>${filled}/${POS_KEYS.length}</strong> · Convocati: <strong>${convCount}/${MAX_CONVOCATI}</strong>`;
  if (!hasGK && filled > 0) msg += ' · <span style="color:var(--red)">⚠ Portiere mancante</span>';
  if (convCount > 0 && !shirtsOk) msg += ' · <span style="color:var(--gold)">Assegna un # a tutti i convocati</span>';
  if (!unique) msg += ' · <span style="color:var(--red)">⚠ Numeri duplicati</span>';
  if (luState.selectedPlayer !== null) msg += ' · <span style="color:var(--gold)">Ora clicca una posizione</span>';
  if (luState.selectedPos !== null && luState.selectedPlayer === null) msg += ' · <span style="color:var(--gold)">Ora clicca un giocatore</span>';

  document.getElementById('lu-status').innerHTML = msg;
  document.getElementById('btn-confirm-lu').disabled = !(filled === POS_KEYS.length && hasGK && convCount >= 7 && shirtsOk && unique);
}

// ── Conferma ──────────────────────────────────
function confirmLineup() {
  const data = {
    formation:    { ...luState.formation },
    convocati:    [...luState.convocati],
    shirtNumbers: { ...luState.shirtNumbers },
  };
  G.savedLineup = { ...data }; // ricorda per la prossima gara
  G.lineup      = { ...data };
  showScreen('sc-match');
  startLiveMatch(luState.match, luState.isHome, luState.opp, luState.poType, luState.poMatch);
}
