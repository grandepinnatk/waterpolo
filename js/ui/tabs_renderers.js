// Restituisce il nome completo nel formato "Cognome I."
function _shortPlayerName(p) {
  if (!p || !p.name) return "—";
  return p.name;
}

// ─────────────────────────────────────────────
// ui/dashboard.js  · ui/roster.js · ui/training.js
// ui/objectives.js · ui/standings.js · ui/calendar.js
// ui/playoff.js    · ui/market.js
//
// Tutti i renderer dei tab del gioco principale.
// Ogni funzione scrive l'innerHTML del suo contenitore.
// ─────────────────────────────────────────────

// ════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════
function renderDash() {
  const ms      = G.stand[G.myId];
  const pos     = getTeamPosition(G.stand, G.myId);
  const nm      = G.schedule.find(m => (m.home === G.myId || m.away === G.myId) && !m.played);
  const nextOpp = nm ? G.teams.find(t => t.id === (nm.home === G.myId ? nm.away : nm.home)) : null;

  let h = `<div class="g4" style="margin-bottom:12px">
    <div class="sc"><div class="sc-l">Posizione</div><div class="sc-n">${pos}°</div></div>
    <div class="sc"><div class="sc-l">Punti</div><div class="sc-n">${ms.pts}</div></div>
    <div class="sc"><div class="sc-l">V / P / S</div><div class="sc-n" style="font-size:15px">${ms.w}/${ms.d}/${ms.l}</div></div>
    <div class="sc"><div class="sc-l">Budget</div><div class="sc-n" style="font-size:13px">${formatMoney(G.budget)}</div></div>
  </div>`;

  if (G.phase === 'regular') {
    if (nm && nextOpp) {
      const ih = nm.home === G.myId;
      h += `<div class="card">
        <div class="slbl" style="margin-top:0">Prossima Partita — Giornata ${nm.round}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:14px">${ih ? '<strong>' + G.myTeam.name + '</strong>' : G.myTeam.name}
            <span style="color:var(--muted)"> vs </span>
            ${ih ? nextOpp.name : '<strong>' + nextOpp.name + '</strong>'}
          </div>
          <span style="font-size:12px;background:${ih ? 'rgba(0,194,255,.15)' : 'rgba(255,255,255,.1)'};
                 color:${ih ? 'var(--blue)' : 'var(--muted)'};padding:3px 10px;border-radius:6px">
            ${ih ? 'Casa' : 'Trasferta'}
          </span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn primary" onclick="openLineup(G.schedule.find(m=>(m.home===G.myId||m.away===G.myId)&&!m.played), G.schedule.find(m=>(m.home===G.myId||m.away===G.myId)&&!m.played)?.home===G.myId, G.teams.find(t=>t.id===(G.schedule.find(m=>(m.home===G.myId||m.away===G.myId)&&!m.played)?.home===G.myId?G.schedule.find(m=>(m.home===G.myId||m.away===G.myId)&&!m.played)?.away:G.schedule.find(m=>(m.home===G.myId||m.away===G.myId)&&!m.played)?.home)))">
            📋 Convocazioni
          </button>
          <button class="btn" onclick="simNextRound()">⏩ Simula Giornata</button>
          <button class="btn warn" onclick="simEntireSeason()">⏩⏩ Simula Campionato</button>
        </div>
      </div>`;
    } else {
      h += `<div class="alert success">Regular season conclusa! Vai su Playoff.</div>
            <button class="btn primary" onclick="initPostSeason();showTab('playoff')">Playoff & Playout →</button>`;
    }
  } else if (G.phase === 'playoff' || G.phase === 'playout') {
    h += `<div class="alert info">Fase finale in corso.</div>
          <button class="btn primary" onclick="showTab('playoff')">Vai ai Playoff →</button>`;
  } else {
    h += `<div class="alert success">Stagione conclusa!</div>
          <button class="btn primary" onclick="showTab('goals')">Vedi Obiettivi →</button>`;
  }

  h += `<div class="card" style="margin-top:12px">
    <div class="slbl" style="margin-top:0">Ultime notizie</div>
    ${G.msgs.slice(-6).reverse().map(m => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid rgba(30,58,92,.4)">${m}</div>`).join('')}
  </div>`;

  document.getElementById('tab-dash').innerHTML = h;
}

// ════════════════════════════════════════════
// ROSA
// ════════════════════════════════════════════
function renderRosa() {
  const roster = G.rosters[G.myId];
  const tlSet  = new Set((G.transferList || []).map(e => e.rosterIdx));
  let h = `<div class="card">
    <div style="font-weight:700;color:var(--blue);margin-bottom:10px">${G.myTeam.name} — Rosa (${roster.length})</div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px">Clicca su un giocatore per il dettaglio · Pulsante <strong>Vendi</strong> nel modale per metterlo sul mercato</div>
    <table><thead><tr>
      <th>Giocatore</th><th>Ruolo</th><th>Mano</th><th>Naz</th>
      <th>Età</th><th>OVR</th><th>Morale</th><th>Forma</th><th>GOL</th><th>ASS</th><th>Valore</th>
    </tr></thead><tbody>`;

  roster.forEach((p, i) => {
    const c   = p.overall >= 80 ? 'var(--blue)' : p.overall >= 65 ? 'var(--green)' : 'var(--gold)';
    const mc  = p.morale > 70 ? 'var(--green)' : p.morale > 40 ? 'var(--gold)' : 'var(--red)';
    const onMarket = tlSet.has(i);
    h += `<tr class="trhov" onclick="showPlayerModal(${i})" style="${onMarket ? 'background:rgba(240,192,64,.08)' : ''}">
      <td style="font-weight:600">${p.name}${onMarket ? ' <span style="font-size:10px;color:var(--gold);font-weight:600">VENDITA</span>' : ''}</td>
      <td><span class="badge ${p.role==='POR'?'S':p.role==='CB'?'B':p.role==='DIF'?'A':'C'}">${p.role}</span></td>
      <td><span class="badge ${p.hand==='AMB'?'C':p.hand==='L'?'L':'R'}" title="${p.hand==='AMB'?'Ambidestro':p.hand==='L'?'Mancino':'Destro'}">${p.hand}</span></td>
      <td style="color:var(--muted);font-size:12px">${p.nat}</td>
      <td>${p.age}</td>
      <td style="font-weight:700;color:${c}">${p.overall}</td>
      <td><span style="font-size:12px;font-weight:600;color:${mc}">${p.morale}%</span></td>
      <td><div class="prog-w" style="width:44px"><div class="prog-f" style="width:${p.fitness}%;background:${p.fitness>70?'var(--green)':'var(--gold)'}"></div></div></td>
      <td>${p.goals}</td><td>${p.assists}</td>
      <td style="font-size:12px;color:var(--muted)">${formatMoney(p.value)}</td>
    </tr>`;
  });

  h += `</tbody></table></div>`;
  document.getElementById('tab-rosa').innerHTML = h;
}

function showPlayerModal(i) {
  const p  = G.rosters[G.myId][i];
  const rl = { POR:'Portiere', DIF:'Difensore', CEN:'Centromediano', ATT:'Attaccante', CB:'Centroboa' };
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px;max-width:360px;width:90%;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--blue)">${p.name}</div>
          <div style="font-size:12px;color:var(--muted)">${rl[p.role] || p.role} · ${p.nat} · ${p.age} anni ·
            <strong>${p.hand === 'AMB' ? 'Ambidestro' : p.hand === 'L' ? 'Mancino' : 'Destro'}</strong>
          </div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      <div class="irow"><span class="ilbl">Overall</span>   <span style="font-size:18px;font-weight:700;color:var(--blue)">${p.overall}</span></div>
      <div class="irow"><span class="ilbl">Potenziale</span><span>${p.potential}</span></div>
      <div class="irow"><span class="ilbl">Valore</span>    <span>${formatMoney(p.value)}</span></div>
      <div class="irow"><span class="ilbl">Stipendio</span> <span>${formatMoney(p.salary)}/anno</span></div>
      <div class="irow"><span class="ilbl">Fitness</span>   <span style="color:${p.fitness > 70 ? 'var(--green)' : 'var(--gold)'}">${p.fitness}%</span></div>
      <div class="irow"><span class="ilbl">Morale</span>    <span>${p.morale}%</span></div>
      <div class="irow"><span class="ilbl">Gol / Assist</span><span>${p.goals} / ${p.assists}</span></div>
      ${p.role === 'POR' ? `<div class="irow"><span class="ilbl">Parate</span><span>${p.saves}</span></div>` : ''}
      <div style="margin-top:10px">
        <div class="slbl" style="margin-top:0">Attributi</div>
        ${[['att','ATT'],['def','DIF'],['spe','VEL'],['str','FOR'],['tec','TEC']].map(([a,lbl]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="font-size:12px;color:var(--muted);width:28px">${lbl}</div>
            <div style="flex:1;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden">
              <div style="width:${p.stats[a]}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
            <div style="font-size:12px;width:24px;font-weight:600">${p.stats[a]}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px" id="modal-sell-section-${i}">
        ${_buildSellSection(i)}
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

// ── Modale giocatore sul mercato (acquisti) ──
function showMarketPlayerModal(i) {
  const p  = G._mercList[i];
  if (!p) return;
  const rl   = { POR:'Portiere', DIF:'Difensore', CEN:'Centromediano', ATT:'Attaccante', CB:'Centroboa' };
  const hand = p.hand === 'AMB' ? 'Ambidestro' : p.hand === 'L' ? 'Mancino' : 'Destro';
  const mc   = p.morale > 70 ? 'var(--green)' : p.morale > 40 ? 'var(--gold)' : 'var(--red)';
  const ok   = G.budget >= p.value;

  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:200;backdrop-filter:blur(4px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:20px;max-width:360px;width:90%;max-height:85vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <div>
          <div style="font-weight:700;font-size:15px;color:var(--blue)">${p.name}</div>
          <div style="font-size:12px;color:var(--muted)">${rl[p.role] || p.role} · ${p.nat} · ${p.age} anni · <strong>${hand}</strong></div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">📍 ${p._tname}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      <div class="irow"><span class="ilbl">Overall</span>    <span style="font-size:18px;font-weight:700;color:var(--blue)">${p.overall}</span></div>
      <div class="irow"><span class="ilbl">Potenziale</span> <span>${p.potential}</span></div>
      <div class="irow"><span class="ilbl">Valore</span>     <span>${formatMoney(p.value)}</span></div>
      <div class="irow"><span class="ilbl">Stipendio</span>  <span>${formatMoney(p.salary)}/anno</span></div>
      <div class="irow"><span class="ilbl">Fitness</span>    <span style="color:${p.fitness > 70 ? 'var(--green)' : 'var(--gold)'}">${p.fitness}%</span></div>
      <div class="irow"><span class="ilbl">Morale</span>     <span style="color:${mc}">${p.morale}%</span></div>
      <div class="irow"><span class="ilbl">Gol / Assist</span><span>${p.goals} / ${p.assists}</span></div>
      ${p.role === 'POR' ? `<div class="irow"><span class="ilbl">Parate</span><span>${p.saves}</span></div>` : ''}
      <div style="margin-top:10px">
        <div class="slbl" style="margin-top:0">Attributi</div>
        ${[['att','ATT'],['def','DIF'],['spe','VEL'],['str','FOR'],['tec','TEC']].map(([a,lbl]) => `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="font-size:12px;color:var(--muted);width:28px">${lbl}</div>
            <div style="flex:1;height:5px;background:rgba(255,255,255,.1);border-radius:3px;overflow:hidden">
              <div style="width:${(p.stats&&p.stats[a])||0}%;height:100%;background:var(--blue);border-radius:3px"></div>
            </div>
            <div style="font-size:12px;width:24px;font-weight:600">${(p.stats&&p.stats[a])||'—'}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px">
        ${ok
          ? `<button class="btn primary" style="width:100%;padding:10px"
               onclick="buyPlayer(${i});this.closest('[style*=fixed]').remove()">
               💰 Acquista per ${formatMoney(p.value)}
             </button>`
          : `<div style="color:var(--red);font-size:13px;text-align:center;padding:8px">
               Budget insufficiente (mancano ${formatMoney(p.value - G.budget)})
             </div>`
        }
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

function _buildSellSection(i) {
  const p      = G.rosters[G.myId][i];
  if (!p) return '';
  const entry  = (G.transferList || []).find(e => e.rosterIdx === i);
  const offers = entry && entry.offers && entry.offers.length ? entry.offers : [];

  if (entry) {
    // Già in vendita
    let html = `<div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">In vendita — prezzo richiesto: ${formatMoney(entry.askingPrice)}</div>`;
    if (offers.length) {
      html += `<div class="slbl" style="margin-top:0;margin-bottom:6px">Offerte ricevute</div>`;
      offers.forEach((o, oi) => {
        const accepted = o.amount >= entry.askingPrice;
        html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;font-size:12px"><strong>${o.teamName}</strong>: ${formatMoney(o.amount)}
            <span style="color:${accepted?'var(--green)':'var(--red)'}"> (${Math.round(o.amount/entry.askingPrice*100)}%)</span>
          </div>
          <button class="btn sm success" onclick="acceptOffer(${i},${oi});this.closest('[style*=fixed]').remove();renderRosa();">Accetta</button>
          <button class="btn sm" onclick="rejectOffer(${i},${oi});document.getElementById('modal-sell-section-${i}').innerHTML=_buildSellSection(${i})">Rifiuta</button>
        </div>`;
      });
    } else {
      html += `<div style="font-size:12px;color:var(--muted)">Nessuna offerta ricevuta. Le offerte arrivano a fine giornata.</div>`;
    }
    html += `<button class="btn danger sm" style="margin-top:10px" onclick="removeFromMarket(${i});this.closest('[style*=fixed]').remove();renderRosa()">Ritira dal mercato</button>`;
    return html;
  } else {
    // Non in vendita: mostra form per mettere in vendita
    return `<div style="font-size:13px;font-weight:600;margin-bottom:8px">Metti in vendita</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <span style="font-size:12px;color:var(--muted)">Prezzo richiesto:</span>
        <input type="number" id="sell-price-${i}" value="${p.value}" min="${Math.round(p.value*0.3)}" step="10000"
          style="width:110px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--panel2);color:var(--text);font-size:13px;text-align:right;padding:0 6px">
        <span style="font-size:11px;color:var(--muted)">min ${formatMoney(Math.round(p.value*0.3))}</span>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Il giocatore perderà morale. Le offerte arriveranno nelle prossime giornate.</div>
      <button class="btn warn" onclick="
        const pr=parseInt(document.getElementById('sell-price-${i}').value,10);
        if(!pr||pr<${Math.round(p.value*0.3)}){alert('Prezzo troppo basso');return;}
        putPlayerOnMarket(${i},pr);
        this.closest('[style*=fixed]').remove();
        renderRosa();
      ">💰 Metti in vendita</button>`;
  }
}

// ════════════════════════════════════════════
// ALLENAMENTO
// ════════════════════════════════════════════
function renderTrain() {
  const roster = G.rosters[G.myId];
  const avgFit = Math.round(roster.reduce((s, p) => s + p.fitness, 0) / roster.length);
  const avgOvr = Math.round(roster.reduce((s, p) => s + p.overall, 0) / roster.length);

  let h = `<div class="g3" style="margin-bottom:12px">
    <div class="sc"><div class="sc-l">Sessioni</div><div class="sc-n">${G.trainWeeks}</div></div>
    <div class="sc"><div class="sc-l">Fitness media</div><div class="sc-n">${avgFit}%</div></div>
    <div class="sc"><div class="sc-l">OVR media rosa</div><div class="sc-n">${avgOvr}</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">`;

  TRAINING_TYPES.forEach((tr, i) => {
    const ok  = G.budget >= tr.cost;
    const sel = G._selTrain === i;
    h += `<div class="card" style="cursor:${ok ? 'pointer' : 'not-allowed'};opacity:${ok ? 1 : 0.5};
               border:1px solid ${sel ? 'var(--gold)' : 'var(--border)'}"
               onclick="${ok ? 'pickTrain(' + i + ')' : ''}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:18px">${tr.icon}</span>
        <div style="font-size:13px;font-weight:600">${tr.name}</div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${tr.desc}</div>
      <div style="font-size:12px;color:${tr.cost ? 'var(--gold)' : 'var(--green)'};font-weight:600">
        ${tr.cost ? formatMoney(tr.cost) : 'Gratuito'}
      </div>
    </div>`;
  });

  h += `</div><div id="train-confirm"></div>`;

  if (G.trainHistory && G.trainHistory.length) {
    h += `<div class="card">
      <div class="slbl" style="margin-top:0">Storico Allenamenti</div>
      <table><thead><tr><th>#</th><th>Tipo</th><th>Effetti</th><th>Costo</th></tr></thead><tbody>`;
    G.trainHistory.slice(-6).reverse().forEach(t => {
      h += `<tr><td style="color:var(--muted)">${t.n}</td><td>${t.name}</td>
             <td style="color:var(--muted)">${t.eff}</td><td>${formatMoney(t.cost)}</td></tr>`;
    });
    h += `</tbody></table></div>`;
  }
  document.getElementById('tab-train').innerHTML = h;
}

function pickTrain(i) {
  G._selTrain = i;
  const tr = TRAINING_TYPES[i];
  document.getElementById('train-confirm').innerHTML = `
    <div class="card" style="border:1px solid var(--gold)">
      <div style="font-weight:600;color:var(--gold);margin-bottom:6px">${tr.icon} ${tr.name}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Costo: ${formatMoney(tr.cost)}</div>
      <button class="btn success" onclick="doTrain(${i})">Conferma Sessione</button>
      <button class="btn" onclick="G._selTrain=null;renderTrain()" style="margin-left:8px">Annulla</button>
    </div>`;
}

function doTrain(i) {
  const tr = TRAINING_TYPES[i];
  if (G.budget < tr.cost) return;
  G.budget -= tr.cost;
  G.trainWeeks++;
  const roster = G.rosters[G.myId];
  let improved = 0;

  roster.forEach(p => {
    if (tr.eff.fitness) p.fitness = cap(p.fitness + rnd(1, tr.eff.fitness));
    if (tr.eff.morale)  p.morale  = cap(p.morale  + rnd(1, tr.eff.morale));
    if (tr.eff.att)     p.stats.att = cap(p.stats.att + rnd(0, tr.eff.att));
    if (tr.eff.def)     p.stats.def = cap(p.stats.def + rnd(0, tr.eff.def));
    if (tr.eff.spe)     p.stats.spe = cap(p.stats.spe + rnd(0, tr.eff.spe));
    if (tr.eff.str)     p.stats.str = cap(p.stats.str + rnd(0, tr.eff.str));
    if (tr.eff.tec) {
      // La Tecnica non può superare il massimo nascosto (maxTec) del giocatore
      const ceiling = p.maxTec !== undefined ? p.maxTec : 99;
      const gain    = rnd(0, tr.eff.tec);
      p.stats.tec   = Math.min(ceiling, cap(p.stats.tec + gain));
    }
    if (tr.eff.gk && p.role === 'POR') p.overall = Math.min(99, p.overall + 2);
    p.fitness = cap(p.fitness - (tr.fatigue || 0) + rnd(-2, 2));
    if (rnd(1, 100) <= 12) { p.overall = Math.min(99, p.overall + 1); improved++; }
  });

  const effDesc = tr.eff ? Object.entries(tr.eff).map(([k, v]) => '+' + v + ' ' + k).join(', ') : '';
  G.trainHistory.push({ n: G.trainWeeks, name: tr.name, eff: effDesc, cost: tr.cost });
  G.msgs.push('Allenamento: ' + tr.name + '. ' + improved + ' giocatori migliorati.');
  G._selTrain = null;
  updateHeader(); autoSave(); renderTrain();
}

// ════════════════════════════════════════════
// OBIETTIVI
// ════════════════════════════════════════════
function renderGoals() {
  checkObjectivesProgress(G.objectives, G.stand, G.myId, G.playoffResult);
  const pos = getTeamPosition(G.stand, G.myId);
  const ms  = G.stand[G.myId];

  let h = `<div class="card">
    <div style="font-size:14px;font-weight:700;color:var(--blue);margin-bottom:4px">Obiettivi — ${G.myTeam.name}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:14px">
      Pos: ${pos}° · Pts: ${ms.pts} · V: ${ms.w} · Gol: ${ms.gf}
    </div>`;

  G.objectives.forEach(o => {
    const icon = o.achieved ? '✅' : o.failed ? '❌' : '⏳';
    let prog = '';
    let pct  = 0;
    if (o.type === 'position') { prog = `Attuale: ${pos}° / Target: top ${o.target}`; pct = Math.min(100, Math.round((o.target / pos) * 100)); }
    else if (o.type === 'wins')    { prog = `${ms.w}/${o.target} vittorie`;  pct = Math.min(100, Math.round(ms.w / (o.target || 1) * 100)); }
    else if (o.type === 'goals')   { prog = `${ms.gf}/${o.target} gol`;      pct = Math.min(100, Math.round(ms.gf / (o.target || 1) * 100)); }
    else if (o.type === 'survive') { prog = pos <= 12 ? 'In salvo (' + pos + '°)' : 'ATTENZIONE (' + pos + '°)'; }
    else if (o.type === 'champion'){ prog = G.playoffResult === 'champion' ? 'Campione!' : G.phase === 'done' ? 'Non raggiunto' : 'Playoff non ancora disputati'; }

    h += `<div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:20px">${icon}</div>
      <div style="flex:1">
        <div style="font-weight:600">${o.name}</div>
        <div style="font-size:12px;color:var(--muted)">${o.desc}</div>
        ${prog ? `<div style="font-size:12px;color:${o.achieved ? 'var(--green)' : o.failed ? 'var(--red)' : 'var(--blue)'};margin-top:3px">${prog}</div>` : ''}
        ${pct ? `<div class="prog-w" style="margin-top:5px"><div class="prog-f" style="width:${pct}%;background:${o.achieved ? 'var(--green)' : 'var(--blue)'}"></div></div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:12px;color:var(--muted)">Premio</div>
        <div style="font-weight:700;color:var(--green)">+${formatMoney(o.reward)}</div>
        <div style="font-size:11px;color:var(--muted)">${o.points} pt</div>
      </div>
    </div>`;
  });
  h += `</div>`;

  if (G.phase === 'done') {
    const totPts = G.objectives.filter(o => o.achieved).reduce((s, o) => s + o.points, 0);
    const totRew = G.objectives.filter(o => o.achieved).reduce((s, o) => s + o.reward, 0);
    h += `<div class="card" style="border:1px solid var(--green)">
      <div style="font-weight:700;margin-bottom:8px;color:var(--green)">Riepilogo Stagione</div>
      <div class="irow"><span class="ilbl">Posizione finale</span><span>${pos}°</span></div>
      <div class="irow"><span class="ilbl">Punti obiettivi</span><span style="font-weight:700">${totPts}</span></div>
      <div class="irow"><span class="ilbl">Premi incassati</span><span style="font-weight:700;color:var(--green)">${formatMoney(totRew)}</span></div>
    </div>`;
  }
  document.getElementById('tab-goals').innerHTML = h;
}

// ════════════════════════════════════════════
// CLASSIFICA
// ════════════════════════════════════════════
function renderStand() {
  document.getElementById('tab-stand').innerHTML = _buildStandContent('classifica');
}

function _showStandTab(tab) {
  document.getElementById('tab-stand').innerHTML = _buildStandContent(tab);
}

function _buildStandContent(activeTab) {
  // ── Tab nav ──
  let h = `<div style="display:flex;gap:6px;margin-bottom:12px">
    <button class="btn${activeTab === 'classifica' ? ' primary' : ' sm'}" onclick="_showStandTab('classifica')" style="font-size:13px">🏆 Classifica</button>
    <button class="btn${activeTab === 'marcatori'  ? ' primary' : ' sm'}" onclick="_showStandTab('marcatori')"  style="font-size:13px">⚽ Marcatori</button>
  </div>`;

  if (activeTab === 'classifica') {
    // ── Classifica ──
    const s = getSortedStandings(G.stand);
    h += `<div class="card">
      <div style="font-weight:700;color:var(--blue);margin-bottom:10px">Classifica Serie A1 — 2025/26</div>
      <table><thead><tr>
        <th>#</th><th>Squadra</th><th>G</th><th>V</th><th>P</th><th>S</th>
        <th>GF</th><th>GS</th><th>DR</th><th>Pts</th>
      </tr></thead><tbody>`;

    s.forEach((t, i) => {
      const isme = t.id === G.myId;
      const pos  = i + 1;
      const pbg  = pos === 1 ? '#f0c040' : pos === 2 ? '#888' : pos === 3 ? '#cd7f32' : 'transparent';
      const zone = pos <= 4 ? 'rgba(0,194,255,.08)' : pos >= 11 && pos <= 13 ? 'rgba(240,192,64,.08)' : pos === 14 ? 'rgba(231,76,60,.08)' : '';
      h += `<tr style="background:${isme ? 'rgba(0,194,255,.12)' : zone}">
        <td><div style="width:20px;height:20px;border-radius:50%;background:${pbg};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${pos <= 3 ? '#001220' : 'var(--muted)'}">${pos}</div></td>
        <td style="font-weight:${isme ? 700 : 400}">${t.name}${isme ? ' ★' : ''}</td>
        <td>${t.g}</td><td>${t.w}</td><td>${t.d}</td><td>${t.l}</td>
        <td>${t.gf}</td><td>${t.ga}</td>
        <td style="color:${t.gf - t.ga >= 0 ? 'var(--green)' : 'var(--red)'}">${t.gf - t.ga > 0 ? '+' : ''}${t.gf - t.ga}</td>
        <td style="font-weight:700;color:var(--blue)">${t.pts}</td>
      </tr>`;
    });

    h += `</tbody></table>
      <div style="margin-top:10px;font-size:11px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap">
        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(0,194,255,.2);border-radius:2px;margin-right:4px"></span>Playoff (1-4)</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(240,192,64,.2);border-radius:2px;margin-right:4px"></span>Play-out (11-13)</span>
        <span><span style="display:inline-block;width:10px;height:10px;background:rgba(231,76,60,.2);border-radius:2px;margin-right:4px"></span>Retrocessa (14)</span>
      </div>
    </div>`;

  } else {
    // ── Marcatori lega ──
    // Raccoglie tutti i giocatori di tutte le squadre con almeno 1 gol
    const allScorers = [];
    G.teams.forEach(t => {
      const roster = G.rosters[t.id] || [];
      roster.forEach(p => {
        if (p.goals > 0) {
          allScorers.push({
            name:   _shortPlayerName ? _shortPlayerName(p) : p.name,
            team:   t.name,
            teamAbbr: t.abbr,
            role:   p.role,
            goals:  p.goals,
            assists: p.assists || 0,
            isMe:   t.id === G.myId,
          });
        }
      });
    });
    allScorers.sort((a, b) => b.goals !== a.goals ? b.goals - a.goals : b.assists - a.assists);

    h += `<div class="card">
      <div style="font-weight:700;color:var(--blue);margin-bottom:10px">Marcatori Serie A1 — 2025/26</div>`;

    if (!allScorers.length) {
      h += `<div style="color:var(--muted);padding:16px;text-align:center;font-size:13px">
        Nessun gol segnato ancora in questa stagione
      </div>`;
    } else {
      h += `<table><thead><tr>
        <th>#</th><th>Giocatore</th><th>Squadra</th><th>Ruolo</th><th style="text-align:center">⚽</th><th style="text-align:center">Ass.</th>
      </tr></thead><tbody>`;

      allScorers.forEach((p, i) => {
        const pos = i + 1;
        const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : pos;
        h += `<tr style="background:${p.isMe ? 'rgba(0,194,255,.10)' : ''}">
          <td style="font-weight:700;color:var(--muted);font-size:12px">${medal}</td>
          <td style="font-weight:${p.isMe ? 700 : 400}">${p.name}${p.isMe ? ' ★' : ''}</td>
          <td style="font-size:12px;color:var(--muted)">${p.teamAbbr}</td>
          <td><span class="badge ${p.role === 'POR' ? 'S' : p.role === 'CB' ? 'B' : p.role === 'DIF' ? 'A' : 'C'}">${p.role}</span></td>
          <td style="text-align:center;font-weight:700;color:var(--blue)">${p.goals}</td>
          <td style="text-align:center;color:var(--muted)">${p.assists}</td>
        </tr>`;
      });

      h += `</tbody></table>`;
    }
    h += `</div>`;
  }

  return h;
}

// ════════════════════════════════════════════
// CALENDARIO
// ════════════════════════════════════════════
function renderCal() {
  const myMatches = G.schedule
    .filter(m => m.home === G.myId || m.away === G.myId)
    .sort((a, b) => a.round - b.round);

  let h = `<div style="font-weight:700;color:var(--blue);margin-bottom:10px">Calendario ${G.myTeam.name}</div>`;
  myMatches.forEach(m => {
    const ih  = m.home === G.myId;
    const opp = G.teams.find(t => t.id === (ih ? m.away : m.home));
    let res = '', resc = '';
    if (m.played && m.score) {
      const mw = (ih && m.score.home > m.score.away) || (!ih && m.score.away > m.score.home);
      const md = m.score.home === m.score.away;
      res  = mw ? 'V' : md ? 'P' : 'S';
      resc = mw ? 'var(--green)' : md ? 'var(--gold)' : 'var(--red)';
    }
    h += `<div class="card" style="padding:10px;margin-bottom:6px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:11px;color:var(--muted)">G${m.round} · ${ih ? 'Casa' : 'Trasferta'}</div>
        ${m.played && res ? `<div style="font-size:13px;font-weight:700;color:${resc}">${res}</div>` : '<div style="color:var(--muted)">—</div>'}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:4px">
        <div style="font-size:13px;font-weight:${ih ? 700 : 400}">${ih ? G.myTeam.name : opp.name}</div>
        ${m.played && m.score ? `<div style="background:var(--panel2);border-radius:6px;padding:3px 14px;font-size:15px;font-weight:700">${m.score.home} - ${m.score.away}</div>` : '<div style="color:var(--muted)">vs</div>'}
        <div style="font-size:13px;font-weight:${ih ? 400 : 700}">${ih ? opp.name : G.myTeam.name}</div>
      </div>
    </div>`;
  });
  document.getElementById('tab-cal').innerHTML = h;
}

// ════════════════════════════════════════════
// PLAYOFF
// ════════════════════════════════════════════
function renderPlayoff() {
  if (G.phase === 'regular') {
    document.getElementById('tab-playoff').innerHTML = `<div class="alert info">La fase playoff inizierà al termine della regular season.</div>`;
    return;
  }
  if (G.phase === 'done') {
    document.getElementById('tab-playoff').innerHTML = `<div class="alert success">Stagione conclusa! Vai su Obiettivi.</div>`;
    return;
  }
  const pb = G.poBracket, plb = G.plBracket;
  const tname = id => G.teams.find(t => t.id === id)?.name || 'TBD';

  const renderBracketMatch = (m, accentColor = 'var(--border)') => {
    const isme = m.home === G.myId || m.away === G.myId;
    return `<div style="background:var(--panel2);border:1px solid ${isme ? accentColor : 'var(--border)'};border-radius:8px;padding:10px;margin-bottom:6px">
      <div style="font-size:11px;color:var(--muted)">${m.label || ''}</div>
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-top:4px">
        <span style="font-weight:${m.home === G.myId ? 700 : 400}">${tname(m.home)}</span>
        <span style="color:var(--muted)">vs</span>
        <span style="font-weight:${m.away === G.myId ? 700 : 400}">${tname(m.away)}</span>
      </div>
      ${m.winner ? `<div style="color:var(--green);font-size:12px;margin-top:4px">Passa: ${tname(m.winner)}</div>` : ''}
    </div>`;
  };

  let h = `<div style="font-size:15px;font-weight:700;color:var(--blue);margin-bottom:12px">Fase Finale</div>`;

  // Playoff bracket
  h += `<div class="card"><div style="font-weight:700;margin-bottom:10px;color:var(--blue)">Playoff Scudetto</div>`;
  pb.sf.forEach(sf => { h += renderBracketMatch(sf, 'var(--blue)'); });
  if (pb.final.home) {
    h += renderBracketMatch({ ...pb.final, label: 'Finale Scudetto' }, 'var(--gold)');
    if (pb.final.winner) h += `<div style="color:var(--gold);font-size:14px;margin-top:6px">🏆 Campione: ${tname(pb.final.winner)}</div>`;
  }
  h += `</div>`;

  // Playout
  h += `<div class="card"><div style="font-weight:700;margin-bottom:10px;color:var(--red)">Play-out Retrocessione</div>`;
  [plb.m1, plb.m2].forEach(m => {
    if (!m.home && !m.away) return;
    h += renderBracketMatch(m, 'var(--red)');
  });
  if (plb.relegated) h += `<div class="alert danger">Retrocede: ${tname(plb.relegated)}</div>`;
  if (G.relegated)   h += `<div class="alert danger">Retrocessione diretta: ${tname(G.relegated)}</div>`;
  h += `</div>`;

  // Azioni
  h += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">`;
  const sfDone  = pb.sf.every(s => s.winner);
  const finDone = pb.final.winner;

  if (!sfDone) {
    pb.sf.forEach((sf, i) => {
      if (sf.winner) return;
      if (sf.home === G.myId || sf.away === G.myId) {
        h += `<button class="btn primary" onclick="startPOMatch('sf',${i})">Gioca ${sf.label}</button>`;
      } else {
        h += `<button class="btn" onclick="simPOMatch('sf',${i})">Simula ${sf.label}</button>`;
      }
    });
  } else if (!finDone) {
    if (pb.final.home === G.myId || pb.final.away === G.myId) {
      h += `<button class="btn primary" onclick="startPOMatch('final',0)">Gioca Finale Scudetto</button>`;
    } else {
      h += `<button class="btn" onclick="simPOMatch('final',0)">Simula Finale</button>`;
    }
  }

  if (!plb.m1.winner && plb.m1.home) {
    if (plb.m1.home === G.myId || plb.m1.away === G.myId) {
      h += `<button class="btn danger" onclick="startPOMatch('pl','m1')">Gioca Play-out 1</button>`;
    } else {
      h += `<button class="btn" onclick="simPLMatch('m1')">Simula PL1</button>`;
    }
  } else if (plb.m1.winner && !plb.m2.winner) {
    if (!plb.m2.home) plb.m2.home = plb.m1.winner;
    if (plb.m2.home === G.myId || plb.m2.away === G.myId) {
      h += `<button class="btn danger" onclick="startPOMatch('pl','m2')">Gioca Play-out Finale</button>`;
    } else {
      h += `<button class="btn" onclick="simPLMatch('m2')">Simula PL Finale</button>`;
    }
  }
  if (finDone && plb.done) h += `<button class="btn success" onclick="closeSeason()">Chiudi Stagione</button>`;
  h += `</div>`;
  document.getElementById('tab-playoff').innerHTML = h;
}

// ════════════════════════════════════════════
// MERCATO
// ════════════════════════════════════════════
function renderMarket() {
  // ── Giocatori IN ENTRATA (da altre squadre) ──
  const avail = [];
  G.teams.forEach(t => {
    if (t.id === G.myId) return;
    G.rosters[t.id].forEach(p => {
      if (p.overall > 55 && Math.random() > 0.55) avail.push({ ...p, _tid: t.id, _tname: t.name });
    });
  });
  avail.sort((a, b) => b.overall - a.overall);
  const list = avail.slice(0, 14);
  G._mercList = list;

  // ── Giocatori IN USCITA (nostra rosa sul mercato) ──
  const selling = (G.transferList || []).map(entry => ({
    entry,
    p: G.rosters[G.myId][entry.rosterIdx],
    rosterIdx: entry.rosterIdx,
  })).filter(x => x.p);

  let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="font-weight:700;color:var(--blue);font-size:15px">Mercato Trasferimenti</div>
    <div style="font-size:12px;color:var(--muted)">Budget: <strong style="color:var(--blue)">${formatMoney(G.budget)}</strong></div>
  </div>`;

  // Sezione USCITE
  h += `<div class="card" style="margin-bottom:12px">
    <div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <span style="color:var(--gold)">💰 Giocatori in uscita</span>
      <span style="font-size:11px;color:var(--muted)">(${selling.length} sul mercato — vai su <strong>Rosa</strong> per aggiungerne)</span>
    </div>`;

  if (!selling.length) {
    h += `<div style="color:var(--muted);font-size:13px;padding:8px 0">Nessun giocatore in lista di trasferimento. Clicca su un giocatore nella scheda Rosa per metterlo in vendita.</div>`;
  } else {
    h += `<table><thead><tr>
      <th>Giocatore</th><th>Ruolo</th><th>OVR</th><th>Prezzo richiesto</th><th>Offerte</th><th></th>
    </tr></thead><tbody>`;
    selling.forEach(({ entry, p, rosterIdx }) => {
      const offerCount  = entry.offers ? entry.offers.length : 0;
      const bestOffer   = entry.offers && entry.offers.length
        ? Math.max(...entry.offers.map(o => o.amount)) : 0;
      const hasGoodOffer = bestOffer >= entry.askingPrice;
      h += `<tr>
        <td style="font-weight:600">${p.name} <span style="font-size:10px;color:var(--muted)">(${p.age}a)</span></td>
        <td><span class="badge ${p.role==='POR'?'S':p.role==='CB'?'B':p.role==='DIF'?'A':'C'}">${p.role}</span></td>
        <td style="font-weight:700">${p.overall}</td>
        <td style="font-size:12px">${formatMoney(entry.askingPrice)}</td>
        <td><span style="font-size:12px;color:${hasGoodOffer?'var(--green)':offerCount>0?'var(--gold)':'var(--muted)'}">
          ${offerCount > 0 ? offerCount + ' offerta/e' + (hasGoodOffer ? ' ✓' : '') : '—'}
        </span></td>
        <td style="display:flex;gap:4px">
          <button class="btn sm primary" onclick="showPlayerModal(${rosterIdx})">Dettagli</button>
          <button class="btn sm" onclick="removeFromMarket(${rosterIdx});renderMarket()">✕</button>
        </td>
      </tr>`;
    });
    h += `</tbody></table>`;
  }
  h += `</div>`;

  // Sezione ACQUISTI
  h += `<div class="card">
    <div style="font-weight:600;margin-bottom:8px;color:var(--blue)">🔍 Giocatori disponibili sul mercato</div>
    <table><thead><tr>
      <th>Giocatore</th><th>Mano</th><th>Da</th><th>Ruolo</th><th>OVR</th><th>Morale</th><th>Valore</th><th></th>
    </tr></thead><tbody>`;

  list.forEach((p, i) => {
    const ok = G.budget >= p.value;
    const mc = p.morale > 70 ? 'var(--green)' : p.morale > 40 ? 'var(--gold)' : 'var(--red)';
    h += `<tr class="trhov" onclick="showMarketPlayerModal(${i})">
      <td style="font-weight:600;cursor:pointer">${p.name} <span style="font-size:11px;color:var(--muted)">(${p.age}a)</span></td>
      <td><span class="badge ${p.hand==='AMB'?'C':p.hand==='L'?'L':'R'}">${p.hand}</span></td>
      <td style="font-size:12px;color:var(--muted)">${p._tname}</td>
      <td><span class="badge ${p.role==='POR'?'S':p.role==='CB'?'B':p.role==='DIF'?'A':'C'}">${p.role}</span></td>
      <td style="font-weight:700">${p.overall}</td>
      <td style="font-size:12px;color:${mc}">${p.morale}%</td>
      <td style="font-size:12px">${formatMoney(p.value)}</td>
      <td onclick="event.stopPropagation()"><button class="btn sm ${ok?'primary':''}" onclick="buyPlayer(${i})" ${ok?'':'disabled'}>Acquista</button></td>
    </tr>`;
  });
  h += `</tbody></table></div>`;
  document.getElementById('tab-market').innerHTML = h;
}

function buyPlayer(i) {
  const p = G._mercList[i];
  if (!p || G.budget < p.value) return;
  G.budget -= p.value;
  const np = { ...p }; delete np._tid; delete np._tname;
  // Bonus morale all'acquisto: nuovo giocatore entusiasta
  np.morale = Math.min(100, np.morale + rnd(8, 15));
  G.rosters[G.myId].push(np);
  G.rosters[p._tid] = G.rosters[p._tid].filter(pl => pl.name !== p.name);
  G.msgs.push('✅ Acquistato ' + p.name + ' da ' + p._tname + ' per ' + formatMoney(p.value) + '. Morale alto!');
  updateHeader(); autoSave(); renderMarket();
}
