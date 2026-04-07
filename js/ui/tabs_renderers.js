// ════════════════════════════════════════════
// POPUP ROSA SQUADRA — richiamabile da ovunque
// showTeamRosterPopup(teamId) apre un modale con la rosa completa
// ════════════════════════════════════════════
function showTeamRosterPopup(teamId) {
  const team   = G.teams.find(t => t.id === teamId);
  if (!team) return;
  const roster = G.rosters[teamId] || [];
  const rl     = { POR:'Portiere', DIF:'Difensore', CEN:'Centromediano', ATT:'Attaccante', CB:'Centroboa' };
  const isMe   = teamId === G.myId;

  const existing = document.getElementById('team-roster-popup');
  if (existing) existing.remove();

  // Ordina: POR → DIF → CEN → ATT → CB
  const roleOrder = { POR:0, DIF:1, CEN:2, ATT:3, CB:4 };
  const sorted = [...roster].sort((a, b) =>
    (roleOrder[a.role] ?? 5) - (roleOrder[b.role] ?? 5) ||
    b.overall - a.overall
  );

  // Calcola OVR medio
  const avgOvr = roster.length
    ? Math.round(roster.reduce((s, p) => s + p.overall, 0) / roster.length)
    : 0;

  const rows = sorted.map(p => {
    const rCls = p.role==='POR'?'S': p.role==='DIF'?'A': p.role==='CB'?'B':'C';
    const hCls = p.hand==='AMB'?'AMB': p.hand==='L'?'L':'R';
    return `<tr>
      <td style="font-size:12px;font-weight:600">${p.name}</td>
      <td><span class="badge ${rCls}">${p.role}</span></td>
      <td><span class="badge ${hCls}">${p.hand}</span></td>
      <td style="font-size:11px;color:var(--muted);text-align:center">${p.age}</td>
      <td style="font-weight:700;color:var(--blue);text-align:center">${p.overall}</td>
      <td style="font-size:11px;color:var(--muted);text-align:right">${p.nat}</td>
    </tr>`;
  }).join('');

  const ov = document.createElement('div');
  ov.id = 'team-roster-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:500;backdrop-filter:blur(6px);overflow-y:auto;padding:20px';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;
                padding:20px;max-width:580px;width:95%;max-height:85vh;overflow-y:auto">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;border-radius:50%;background:${team.col || 'var(--blue)'};
                      display:flex;align-items:center;justify-content:center;font-size:12px;
                      font-weight:700;color:#fff;flex-shrink:0">${team.abbr}</div>
          <div>
            <div style="font-weight:700;font-size:16px;color:var(--blue)">${team.name}${isMe ? ' ★' : ''}</div>
            <div style="font-size:11px;color:var(--muted)">${team.city || ''} · OVR medio: ${avgOvr} · ${roster.length} giocatori</div>
          </div>
        </div>
        <button onclick="document.getElementById('team-roster-popup').remove()"
                style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      <!-- Tabella rosa -->
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--border);font-size:10px;color:var(--muted);text-transform:uppercase">
            <th style="text-align:left;padding:4px 6px">Giocatore</th>
            <th>Ruolo</th>
            <th>Mano</th>
            <th style="text-align:center">Età</th>
            <th style="text-align:center">OVR</th>
            <th style="text-align:right">Naz.</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
// Esponi globalmente
window.showTeamRosterPopup = showTeamRosterPopup;

// Sostituisce i nomi squadra in un testo con link cliccabili
function _linkTeamNames(text) {
  if (!G || !G.teams) return text;
  let result = text;
  G.teams.forEach(t => {
    if (!t.name || t.name.length < 3) return;
    // Escape caratteri speciali nel nome per regex
    const escaped = t.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(' + escaped + ')', 'g');
    result = result.replace(re,
      `<span onclick="showTeamRosterPopup('${t.id}')" ` +
      `style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;color:inherit" ` +
      `title="Vedi rosa ${t.name}">$1</span>`
    );
  });
  return result;
}


// Badge RIT — visibile accanto al nome in tutte le liste
function _ritBadge(p) {
  if (!p || p.retirementAge === undefined) return '';
  if ((p.age + 1) < p.retirementAge) return '';
  return ' <span style="font-size:9px;background:#c0392b;color:#fff;font-weight:700;' +
         'padding:1px 4px;border-radius:3px;margin-left:3px" title="Si ritira a fine stagione">RIT</span>';
}

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

// ── Popup dettaglio partita (clic sul punteggio in calendario) ──
function showMatchDetailPopup(matchIdx) {
  const m  = G.schedule[matchIdx];
  if (!m || !m.played || !m.score) return;

  const hT = G.teams.find(t => t.id === m.home);
  const aT = G.teams.find(t => t.id === m.away);
  const d  = m.details || null;

  const existing = document.getElementById('match-detail-popup');
  if (existing) existing.remove();

  // Parziali
  let partialsHtml = '';
  if (d && d.partials) {
    partialsHtml = `
      <div style="margin-bottom:14px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">Parziali</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="text-align:center;padding:3px 6px;color:var(--muted);font-weight:600;font-size:10px">Tempo</th>
              <th style="text-align:center;padding:3px 8px;color:${m.home===G.myId?'var(--blue)':'var(--muted)'};font-weight:700;font-size:11px">${hT?hT.abbr:'?'}</th>
              <th style="text-align:center;padding:3px 8px;color:${m.away===G.myId?'var(--blue)':'var(--muted)'};font-weight:700;font-size:11px">${aT?aT.abbr:'?'}</th>
            </tr>
          </thead>
          <tbody>
            ${d.partials.map((p,i) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,.04)">
                <td style="text-align:center;color:var(--muted);padding:4px">${i+1}° T</td>
                <td style="text-align:center;font-weight:600;padding:4px">${p.h}</td>
                <td style="text-align:center;font-weight:600;padding:4px">${p.a}</td>
              </tr>`).join('')}
            <tr style="border-top:1px solid var(--border);font-weight:700">
              <td style="text-align:center;color:var(--muted);padding:5px">Tot.</td>
              <td style="text-align:center;color:var(--blue);padding:5px">${m.score.home}</td>
              <td style="text-align:center;color:var(--blue);padding:5px">${m.score.away}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  } else {
    partialsHtml = `<div style="margin-bottom:14px;font-size:12px;color:var(--muted)">Parziali non disponibili</div>`;
  }

  // Marcatori per squadra
  function buildScorersList(list, label) {
    if (!list || !list.length) return `<div style="color:var(--muted);font-size:12px;padding:4px 0">—</div>`;
    return list
      .filter(s => s.goals > 0 || s.assists > 0)
      .sort((a,b) => b.goals - a.goals || b.assists - a.assists)
      .map(s => {
        const goalsStr   = s.goals   > 0 ? `<span style="color:var(--blue);font-weight:700">⚽${s.goals}</span>` : '';
        const assistsStr = s.assists > 0 ? `<span style="color:var(--green);font-size:11px"> 🤝${s.assists}</span>` : '';
        return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px">
          <span>${s.name}</span>
          <span style="display:flex;gap:6px;align-items:center">${goalsStr}${assistsStr}</span>
        </div>`;
      }).join('') || `<div style="color:var(--muted);font-size:12px;padding:4px 0">—</div>`;
  }

  const homeIsMe = m.home === G.myId;
  const awayIsMe = m.away === G.myId;

  const ov = document.createElement('div');
  ov.id = 'match-detail-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:500;backdrop-filter:blur(6px);overflow-y:auto;padding:20px';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;
                padding:20px;max-width:540px;width:95%;max-height:85vh;overflow-y:auto">

      <!-- Header risultato -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:11px;color:var(--muted)">G${m.round}</div>
        <button onclick="document.getElementById('match-detail-popup').remove()"
                style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>

      <!-- Tabellone -->
      <div style="text-align:center;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:center;gap:16px">
          <div style="flex:1;text-align:right">
            <span onclick="showTeamRosterPopup('${m.home}')" style="font-size:15px;font-weight:${homeIsMe?700:500};cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;color:${homeIsMe?'var(--blue)':'var(--text)'}">${hT?hT.name:'?'}</span>
          </div>
          <div style="background:var(--panel2);border-radius:10px;padding:8px 20px;font-size:24px;font-weight:700;flex-shrink:0">
            ${m.score.home} - ${m.score.away}
          </div>
          <div style="flex:1;text-align:left">
            <span onclick="showTeamRosterPopup('${m.away}')" style="font-size:15px;font-weight:${awayIsMe?700:500};cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;color:${awayIsMe?'var(--blue)':'var(--text)'}">${aT?aT.name:'?'}</span>
          </div>
        </div>
      </div>

      <!-- Parziali -->
      ${partialsHtml}

      <!-- Marcatori -->
      ${d ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div>
          <div style="font-size:11px;font-weight:700;color:${homeIsMe?'var(--blue)':'var(--muted)'};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${hT?hT.abbr:'Casa'}</div>
          ${buildScorersList(d.home)}
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:${awayIsMe?'var(--blue)':'var(--muted)'};text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">${aT?aT.abbr:'Ospiti'}</div>
          ${buildScorersList(d.away)}
        </div>
      </div>` : '<div style="font-size:12px;color:var(--muted)">Statistiche dettagliate non disponibili per questa partita.</div>'}

    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
window.showMatchDetailPopup = showMatchDetailPopup;

// ════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════
function renderDash() {
  const ms      = G.stand[G.myId];
  const pos     = getTeamPosition(G.stand, G.myId);
  // Usa nextMyMatch() per trovare la partita con il round minore non giocato
  const nm      = (typeof nextMyMatch === 'function') ? nextMyMatch() : G.schedule.filter(m => (m.home === G.myId || m.away === G.myId) && !m.played).sort((a,b) => a.round - b.round)[0] || null;
  const nextOpp = nm ? G.teams.find(t => t.id === (nm.home === G.myId ? nm.away : nm.home)) : null;

  let h = `<div class="g4" style="margin-bottom:12px">
    <div class="sc"><div class="sc-l">Posizione</div><div class="sc-n" style="display:flex;align-items:center;justify-content:center;gap:6px">${pos}°${(function(){
      const played = G.schedule ? G.schedule.filter(m => m.played && (m.home === G.myId || m.away === G.myId)).length : 0;
      if (played <= 1) return ''; // nessuna variazione alla prima giornata
      if (!G.prevPos || G.prevPos === pos) return '<span style="color:#f0a030;font-size:14px;line-height:1" title="Stabile">—</span>';
      if (pos < G.prevPos) return '<span style="color:#2ecc71;font-size:16px;line-height:1" title="Salito di ' + (G.prevPos - pos) + ' posizioni">▲</span>';
      return '<span style="color:#e74c3c;font-size:16px;line-height:1" title="Sceso di ' + (pos - G.prevPos) + ' posizioni">▼</span>';
    })()}</div></div>
    <div class="sc"><div class="sc-l">Punti</div><div class="sc-n">${ms.pts}</div></div>
    <div class="sc"><div class="sc-l">V / P / S</div><div class="sc-n" style="font-size:15px">${ms.w}/${ms.d}/${ms.l}</div></div>
    <div class="sc"><div class="sc-l">Budget</div><div class="sc-n" style="font-size:13px">${formatMoney(G.budget)}</div></div>
  </div>`;

  if (G.phase === 'regular') {
    if (nm && nextOpp) {
      const ih = nm.home === G.myId;
      // Casa sempre prima: se siamo in trasferta, l'avversario è la squadra di casa
      const homeTeamName = ih ? G.myTeam.name : nextOpp.name;
      const awayTeamName = ih ? nextOpp.name   : G.myTeam.name;
      const homeTeamId   = ih ? G.myId         : nextOpp.id;
      const awayTeamId   = ih ? nextOpp.id      : G.myId;
      const homeIsMine   = ih;
      h += `<div class="card">
        <div class="slbl" style="margin-top:0">Prossima Partita — Giornata ${nm.round}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:14px">
            <span onclick="showTeamRosterPopup('${homeTeamId}')" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;font-weight:${homeIsMine?700:400}">${homeTeamName}</span>
            <span style="color:var(--muted)"> vs </span>
            <span onclick="showTeamRosterPopup('${awayTeamId}')" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px;font-weight:${homeIsMine?400:700}">${awayTeamName}</span>
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
          <button class="btn" onclick="confirmSimNextRound()">⏩ Simula Giornata</button>
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
    const sNum = G.seasonNumber || 1;
    h += `<div class="alert success" style="margin-bottom:10px">
            🏆 Stagione ${sNum} conclusa! Budget: <strong>${formatMoney(G.budget)}</strong>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px">
            <button class="btn primary" onclick="showTab('goals')">📋 Vedi Obiettivi</button>
            <button class="btn success" onclick="_confirmNewSeason()">🏊 Nuova Stagione →</button>
          </div>`;
  }

  // Ultime notizie: paginazione 15 per pagina, max 90 notizie
  const NEWS_PER_PAGE = 15;
  const NEWS_MAX      = 90;
  const allMsgs = G.msgs.slice(-NEWS_MAX).reverse(); // ultime 90, più recenti prima
  const newsPage = G._newsPage || 0;
  const totalPages = Math.max(1, Math.ceil(allMsgs.length / NEWS_PER_PAGE));
  const safePage   = Math.min(newsPage, totalPages - 1);
  const pageItems  = allMsgs.slice(safePage * NEWS_PER_PAGE, (safePage + 1) * NEWS_PER_PAGE);

  const prevDis = safePage === 0 ? 'opacity:.35;pointer-events:none' : 'cursor:pointer';
  const nextDis = safePage >= totalPages - 1 ? 'opacity:.35;pointer-events:none' : 'cursor:pointer';

  h += `<div class="card" style="margin-top:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <div class="slbl" style="margin-top:0;margin-bottom:0">Ultime notizie</div>
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">
        <span>Pag. ${safePage + 1} / ${totalPages}</span>
        <button onclick="G._newsPage=Math.max(0,(G._newsPage||0)-1);renderDash()"
                style="background:var(--panel2);border:1px solid var(--border);border-radius:5px;
                       padding:2px 8px;color:var(--muted);font-size:12px;${prevDis}">‹</button>
        <button onclick="G._newsPage=Math.min(${totalPages-1},(G._newsPage||0)+1);renderDash()"
                style="background:var(--panel2);border:1px solid var(--border);border-radius:5px;
                       padding:2px 8px;color:var(--muted);font-size:12px;${nextDis}">›</button>
      </div>
    </div>
    ${pageItems.map(m => `<div style="font-size:13px;padding:4px 0;border-bottom:1px solid rgba(30,58,92,.4)">${_linkTeamNames(m)}</div>`).join('')}
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
      <th>Età</th><th>OVR</th><th>Morale</th><th>Forma</th><th>GOL</th><th>ASS</th>
      <th title="Ultimi 4 voti" style="color:var(--gold)">Voti</th>
      <th>Valore</th>
    </tr></thead><tbody>`;

  roster.forEach((p, i) => {
    const c   = p.overall >= 80 ? 'var(--blue)' : p.overall >= 65 ? 'var(--green)' : 'var(--gold)';
    const mc  = p.morale > 70 ? 'var(--green)' : p.morale > 40 ? 'var(--gold)' : 'var(--red)';
    const onMarket = tlSet.has(i);
    // Voti ultime 4 partite (null = non ha giocato, assente dal rating)
    const ratings = p.lastRatings || [];
    const ratingsHtml = ratings.length === 0
      ? '<span style="color:var(--muted);font-size:11px">—</span>'
      : ratings.map(function(r) {
          if (r === null)
            return '<span style="font-size:11px;font-weight:600;color:var(--muted);margin-right:3px" title="Non ha giocato">-</span>';
          var col = r >= 7.5 ? 'var(--green)' : r >= 6.5 ? 'var(--gold)' : r >= 5.5 ? 'var(--muted)' : 'var(--red)';
          return '<span style="font-size:11px;font-weight:700;color:' + col + ';margin-right:3px">' + r.toFixed(1) + '</span>';
        }).join('<span style="color:var(--muted);font-size:9px">·</span>');
    // Badge RIT e INF
    const ritBadge = _ritBadge(p);
    const infWeeks   = p.injuryWeeks || '';
    const infTitle   = p.injured ? 'Infortunato — out per ' + (p.injuryWeeks || '?') + ' giornate' : '';
    const infBadge   = p.injured ? ' <span style="font-size:10px;background:#e74c3c;color:#fff;font-weight:700;padding:1px 5px;border-radius:4px;margin-left:4px" title="' + infTitle + '">INF+' + (infWeeks ? ' ' + infWeeks + 'G' : '') + '</span>' : '';
    h += '<tr class="trhov" onclick="showPlayerModal(' + i + ')" style="' + (onMarket ? 'background:rgba(240,192,64,.08)' : '') + '">'
      + '<td style="font-weight:600">' + p.name + ritBadge + infBadge + (onMarket ? ' <span style="font-size:10px;color:var(--gold);font-weight:600">VENDITA</span>' : '') + '</td>'
      + '<td><span class="badge ' + (p.role==='POR'?'S':p.role==='CB'?'B':p.role==='DIF'?'A':'C') + '">' + p.role + '</span></td>'
      + '<td><span class="badge ' + (p.hand==='AMB'?'C':p.hand==='L'?'L':'R') + '" title="' + (p.hand==='AMB'?'Ambidestro':p.hand==='L'?'Mancino':'Destro') + '">' + p.hand + '</span></td>'
      + '<td style="color:var(--muted);font-size:12px">' + p.nat + '</td>'
      + '<td>' + p.age + '</td>'
      + '<td style="font-weight:700;color:' + c + '">' + p.overall + '</td>'
      + '<td><span style="font-size:12px;font-weight:600;color:' + mc + '">' + p.morale + '%</span></td>'
      + '<td><div class="prog-w" style="width:44px"><div class="prog-f" style="width:' + p.fitness + '%;background:' + (p.fitness>70?'var(--green)':'var(--gold)') + '"></div></div></td>'
      + '<td>' + p.goals + '</td><td>' + p.assists + '</td>'
      + '<td style="white-space:nowrap">' + ratingsHtml + '</td>'
      + '<td style="font-size:12px;color:var(--muted)">' + formatMoney(p.value) + '</td>'
      + '</tr>';
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
          <div style="font-weight:700;font-size:15px;color:var(--blue)">${p.name}${_ritBadge(p)}</div>
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
      <div class="irow"><span class="ilbl">Forma</span>   <span style="color:${p.fitness > 70 ? 'var(--green)' : 'var(--gold)'}">${p.fitness}%</span></div>
      <div class="irow"><span class="ilbl">Morale</span>    <span>${p.morale}%</span></div>
      <div class="irow"><span class="ilbl">Gol / Assist</span><span>${p.goals} / ${p.assists}</span></div>
      ${p.role === 'POR' ? `<div class="irow"><span class="ilbl">Parate</span><span>${p.saves}</span></div>` : ''}
      <div style="margin-top:10px">
        <div class="slbl" style="margin-top:0">Attributi</div>
        ${[['att','ATT'],['def','DIF'],['spe','VEL'],['str','FOR'],['tec','TEC'],['res','RES']].map(([a,lbl]) => `
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
          <div style="font-weight:700;font-size:15px;color:var(--blue)">${p.name}${_ritBadge(p)}</div>
          <div style="font-size:12px;color:var(--muted)">${rl[p.role] || p.role} · ${p.nat} · ${p.age} anni · <strong>${hand}</strong></div>
          <div style="font-size:12px;color:var(--muted);margin-top:2px">📍 ${p._tname}</div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--muted)">✕</button>
      </div>
      <div class="irow"><span class="ilbl">Overall</span>    <span style="font-size:18px;font-weight:700;color:var(--blue)">${p.overall}</span></div>
      <div class="irow"><span class="ilbl">Potenziale</span> <span>${p.potential}</span></div>
      <div class="irow"><span class="ilbl">Valore</span>     <span>${formatMoney(p.value)}</span></div>
      <div class="irow"><span class="ilbl">Stipendio</span>  <span>${formatMoney(p.salary)}/anno</span></div>
      <div class="irow"><span class="ilbl">Forma</span>    <span style="color:${p.fitness > 70 ? 'var(--green)' : 'var(--gold)'}">${p.fitness}%</span></div>
      <div class="irow"><span class="ilbl">Morale</span>     <span style="color:${mc}">${p.morale}%</span></div>
      <div class="irow"><span class="ilbl">Gol / Assist</span><span>${p.goals} / ${p.assists}</span></div>
      ${p.role === 'POR' ? `<div class="irow"><span class="ilbl">Parate</span><span>${p.saves}</span></div>` : ''}
      <div style="margin-top:10px">
        <div class="slbl" style="margin-top:0">Attributi</div>
        ${[['att','ATT'],['def','DIF'],['spe','VEL'],['str','FOR'],['tec','TEC'],['res','RES']].map(([a,lbl]) => `
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
    // Calcola penale rescissione: metà degli ingaggi rimanenti
    const contractLeft = Math.max(1, p.contractYears || 1);
    const rescPenalty  = Math.round((p.salary || 0) * contractLeft * 0.5);
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
      ">💰 Metti in vendita</button>
      <div style="margin-top:12px;border-top:1px solid rgba(255,80,80,.2);padding-top:12px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:6px">
          <strong>Rescissione contratto</strong> — penale: <strong style="color:var(--red)">${formatMoney(rescPenalty)}</strong>
          (${contractLeft} ${contractLeft===1?'anno':'anni'} rimasto/i × ingaggio/2).
          Il giocatore va sul mercato a costo zero.
        </div>
        <button class="btn danger sm" onclick="rescindContract(${i});this.closest('[style*=fixed]').remove();renderRosa();">✂️ Rescindi contratto</button>
      </div>`;
  }
}

// ════════════════════════════════════════════
// ALLENAMENTO
// ════════════════════════════════════════════
function renderTrain() {
  const roster = G.rosters[G.myId];
  const avgFit = Math.round(roster.reduce((s, p) => s + p.fitness, 0) / roster.length);
  const avgOvr = Math.round(roster.reduce((s, p) => s + p.overall, 0) / roster.length);
  const stars  = G.stars || 0;

  let h = `<div class="g4" style="margin-bottom:12px">
    <div class="sc"><div class="sc-l">Sessioni</div><div class="sc-n">${G.trainWeeks}</div></div>
    <div class="sc"><div class="sc-l">Forma media</div><div class="sc-n">${avgFit}%</div></div>
    <div class="sc"><div class="sc-l">OVR media</div><div class="sc-n">${avgOvr}</div></div>
    <div class="sc"><div class="sc-l">⭐ Stelle</div><div class="sc-n" style="color:var(--gold)">${stars}</div></div>
  </div>
  <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
    Ogni giornata ricevi <strong>+4 stelle</strong>. Le stelle si spendono selezionando un tipo di allenamento.
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">`;

  TRAINING_TYPES.forEach((tr, i) => {
    const starCost = tr.stars || 1;
    const canAffordBudget = G.budget >= tr.cost;
    const canAffordStars  = stars >= starCost;
    const ok  = canAffordBudget && canAffordStars;
    h += `<div class="card" style="cursor:${ok ? 'pointer' : 'not-allowed'};opacity:${ok ? 1 : 0.5};
               border:1px solid var(--border);transition:border-color .15s"
               onmouseover="if(${ok}) this.style.borderColor='var(--gold)'"
               onmouseout="this.style.borderColor='var(--border)'"
               onclick="${ok ? 'openTrainPopup(' + i + ')' : 'showTrainBlockedMsg(' + canAffordStars + ',' + canAffordBudget + ')'}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span style="font-size:20px">${tr.icon}</span>
        <div style="font-size:13px;font-weight:600">${tr.name}</div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${tr.desc}</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--gold);font-weight:700">
          ${'⭐'.repeat(starCost)} ${starCost} ${starCost===1?'stella':'stelle'}
        </span>
        <span style="font-size:12px;color:${tr.cost ? (canAffordBudget?'var(--muted)':'var(--red)') : 'var(--green)'}">
          ${tr.cost ? formatMoney(tr.cost) : 'Gratuito'}
        </span>
        ${!canAffordStars ? '<span style="font-size:10px;color:var(--red)">Stelle insufficienti</span>' : ''}
        ${!canAffordBudget ? '<span style="font-size:10px;color:var(--red)">Budget insufficiente</span>' : ''}
      </div>
    </div>`;
  });

  h += `</div>`;

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

// Mostra messaggio bloccante se stelle o budget insufficienti
function showTrainBlockedMsg(hasStars, hasBudget) {
  var existing = document.getElementById('train-blocked-popup');
  if (existing) existing.remove();

  var msg, icon;
  if (!hasStars) {
    icon = '⭐';
    msg  = 'Non hai abbastanza token <strong>⭐ Stella</strong> per completare l&#39;attività.<br><br>Attendi il prossimo turno per ricevere nuove stelle.';
  } else {
    icon = '💸';
    msg  = 'Non hai il <strong>denaro sufficiente</strong> per completare questa attività.<br><br>Controlla il tuo budget nel tab Finanza.';
  }

  var ov = document.createElement('div');
  ov.id = 'train-blocked-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:500;backdrop-filter:blur(6px)';

  var box = document.createElement('div');
  box.style.cssText = [
    'background:linear-gradient(180deg,#1a1a2e,#0f0f1e)',
    'border:2px solid #3a3060',
    'border-radius:16px',
    'padding:28px 24px',
    'max-width:360px',
    'width:90%',
    'text-align:center',
    'box-shadow:0 8px 40px rgba(0,0,0,.8)'
  ].join(';');
  box.innerHTML =
    '<div style="font-size:44px;margin-bottom:12px">' + icon + '</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.7;margin-bottom:22px">' + msg + '</div>' +
    '<button id="train-blocked-ok" style="padding:10px 32px;font-size:13px;font-weight:800;' +
    'border-radius:8px;border:2px solid #00c2ff;background:linear-gradient(135deg,#0a5ca8,#0844a0);' +
    'color:#fff;cursor:pointer">OK</button>';

  ov.appendChild(box);
  document.body.appendChild(ov);

  document.getElementById('train-blocked-ok').addEventListener('click', function() {
    document.getElementById('train-blocked-popup').remove();
  });
  ov.addEventListener('click', function(e) {
    if (e.target === ov) ov.remove();
  });
}

// Apre il popup di conferma allenamento con indicatori +/-
function openTrainPopup(i) {
  const tr     = TRAINING_TYPES[i];
  const stars  = G.stars || 0;
  const starCost = tr.stars || 1;

  // Calcola effetti attesi (range min-max)
  function effRow(label, minV, maxV, color) {
    if (!maxV) return '';
    const sign = minV >= 0 ? '+' : '';
    return `<div style="display:flex;align-items:center;justify-content:space-between;
                         padding:5px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <span style="font-size:12px;color:var(--muted)">${label}</span>
      <span style="font-size:13px;font-weight:700;color:${color}">
        ${sign}${minV === maxV ? minV : minV + '→' + sign + maxV}
      </span>
    </div>`;
  }

  const eff = tr.eff;
  const fatigueSign = (tr.fatigue || 0) > 0;
  let effHTML = '';
  if (eff.fitness)  effHTML += effRow('Forma',          1, eff.fitness,  'var(--green)');
  if (eff.morale)   effHTML += effRow('Morale',           1, eff.morale,   'var(--green)');
  if (eff.att)      effHTML += effRow('ATT (attacco)',     0, eff.att,      'var(--blue)');
  if (eff.def)      effHTML += effRow('DIF (difesa)',      0, eff.def,      'var(--blue)');
  if (eff.spe)      effHTML += effRow('VEL (velocità)',    0, eff.spe,      'var(--blue)');
  if (eff.str)      effHTML += effRow('FOR (forza)',       0, eff.str,      'var(--blue)');
  if (eff.tec)      effHTML += effRow('TEC (tecnica)',     0, eff.tec,      'var(--blue)');
  if (eff.res)      effHTML += effRow('RES (resistenza)',   0, eff.res,      'var(--blue)');
  if (eff.gk)       effHTML += effRow('OVR Portieri',      2, 2,            'var(--blue)');
  if (tr.fatigue)   effHTML += effRow('Forma (fatica)',  fatigueSign ? -(tr.fatigue) : Math.abs(tr.fatigue),
                                                           fatigueSign ? -(tr.fatigue) : Math.abs(tr.fatigue),
                                                           fatigueSign ? 'var(--red)' : 'var(--green)');
  effHTML += effRow('OVR (miglioramento)', 0, '+1 (12% prob)', 'var(--gold)');

  const ov = document.createElement('div');
  ov.id = 'train-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:500;backdrop-filter:blur(6px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:2px solid var(--border);border-radius:16px;
                padding:22px;max-width:400px;width:92%;max-height:85vh;overflow-y:auto">
      <!-- Header -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:28px">${tr.icon}</span>
          <div>
            <div style="font-weight:800;font-size:15px;color:var(--blue)">${tr.name}</div>
            <div style="font-size:11px;color:var(--muted)">${tr.desc}</div>
          </div>
        </div>
        <button onclick="document.getElementById('train-popup').remove()"
                style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--muted)">✕</button>
      </div>

      <!-- Costi -->
      <div style="display:flex;gap:12px;margin-bottom:14px">
        <div style="flex:1;background:rgba(255,215,0,.08);border:1px solid rgba(255,215,0,.3);
                    border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:20px">⭐</div>
          <div style="font-size:16px;font-weight:800;color:var(--gold)">${starCost}</div>
          <div style="font-size:10px;color:var(--muted)">${starCost===1?'stella':'stelle'} (hai ${stars})</div>
        </div>
        <div style="flex:1;background:rgba(240,192,64,.08);border:1px solid rgba(240,192,64,.3);
                    border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:20px">💰</div>
          <div style="font-size:14px;font-weight:800;color:var(--gold)">${tr.cost ? formatMoney(tr.cost) : 'Gratuito'}</div>
          <div style="font-size:10px;color:var(--muted)">costo</div>
        </div>
      </div>

      <!-- Effetti attesi -->
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;
                    letter-spacing:.5px;margin-bottom:8px">Effetti attesi (intera rosa)</div>
        ${effHTML}
      </div>

      <!-- Bottoni -->
      <div style="display:flex;gap:10px">
        <button onclick="doTrain(${i})"
                style="flex:1;padding:11px;font-size:13px;font-weight:800;border-radius:8px;
                       border:2px solid var(--blue);background:linear-gradient(135deg,#0a5ca8,#0844a0);
                       color:#fff;cursor:pointer">
          ✓ Conferma allenamento
        </button>
        <button onclick="document.getElementById('train-popup').remove()"
                style="padding:11px 18px;font-size:13px;font-weight:700;border-radius:8px;
                       border:2px solid var(--border);background:var(--panel2);color:var(--muted);cursor:pointer">
          Annulla
        </button>
      </div>
    </div>`;
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}

function doTrain(i) {
  const tr = TRAINING_TYPES[i];
  const starCost = tr.stars || 1;
  if (G.budget < tr.cost) { alert('Budget insufficiente.'); return; }
  if ((G.stars || 0) < starCost) { alert('Stelle insufficienti.'); return; }

  // Rimuovi popup
  const popup = document.getElementById('train-popup');
  if (popup) popup.remove();

  G.budget -= tr.cost;
  G.stars   = (G.stars || 0) - starCost;
  if (typeof _updateStarsBox === 'function') _updateStarsBox();
  addLedger('allenamento', -tr.cost, `Sessione: ${tr.name}`, currentRound());
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
    if (tr.eff.res)     p.stats.res = cap((p.stats.res || 50) + rnd(0, tr.eff.res));
    if (tr.eff.tec) {
      const ceiling = p.maxTec !== undefined ? p.maxTec : 99;
      p.stats.tec   = Math.min(ceiling, cap(p.stats.tec + rnd(0, tr.eff.tec)));
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
    const sNum = G.seasonNumber || 1;
    h += `<div class="card" style="border:1px solid var(--green)">
      <div style="font-weight:700;margin-bottom:8px;color:var(--green)">Riepilogo Stagione ${sNum}</div>
      <div class="irow"><span class="ilbl">Posizione finale</span><span>${pos}°</span></div>
      <div class="irow"><span class="ilbl">Punti obiettivi</span><span style="font-weight:700">${totPts}</span></div>
      <div class="irow"><span class="ilbl">Premi incassati</span><span style="font-weight:700;color:var(--green)">${formatMoney(totRew)}</span></div>
      <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px">
          Inizia la stagione successiva mantenendo rosa, budget, stelle e progressi.
        </div>
        <button class="btn success" onclick="_confirmNewSeason()" style="width:100%">
          🏊 Inizia Stagione ${sNum + 1}
        </button>
      </div>
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
        <td style="font-weight:${isme ? 700 : 400}"><span onclick="showTeamRosterPopup('${t.id}')" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px" title="Vedi rosa">${t.name}</span>${isme ? ' ★' : ''}</td>
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
    // Raccoglie gol di TUTTI i giocatori di tutte le squadre (incluse NPC)
    const allScorers = [];
    G.teams.forEach(t => {
      const roster = G.rosters[t.id] || [];
      roster.forEach(p => {
        if ((p.goals || 0) > 0) {
          allScorers.push({
            name:     _shortPlayerName ? _shortPlayerName(p) : p.name,
            team:     t.name,
            teamAbbr: t.abbr,
            teamId:   t.id,
            role:     p.role,
            goals:    p.goals  || 0,
            assists:  p.assists || 0,
            isMe:     t.id === G.myId,
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
          <td style="font-size:12px"><span onclick="showTeamRosterPopup('${p.teamId}')" style="cursor:pointer;color:var(--muted);text-decoration:underline dotted;text-underline-offset:3px" title="Vedi rosa">${p.teamAbbr}</span></td>
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
function renderCal(activeTab) {
  activeTab = activeTab || 'andata';
  const halfRounds    = 13;
  const andataRounds  = Array.from({length: halfRounds}, (_, i) => i + 1);
  const ritornoRounds = Array.from({length: halfRounds}, (_, i) => i + halfRounds + 1);
  const currentRounds = activeTab === 'andata' ? andataRounds : ritornoRounds;

  const rounds = {};
  G.schedule.forEach(function(m) {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  function matchRow(m) {
    var hT   = G.teams.find(function(t){ return t.id === m.home; });
    var aT   = G.teams.find(function(t){ return t.id === m.away; });
    var isMe = m.home === G.myId || m.away === G.myId;
    var ih   = m.home === G.myId;
    var mIdx = G.schedule.indexOf(m);
    var scoreHtml, badge = '';

    if (m.played && m.score) {
      scoreHtml = '<span'
        + ' onclick="showMatchDetailPopup(' + mIdx + ')"'
        + ' style="background:var(--panel2);border-radius:6px;padding:3px 14px;'
        + 'font-size:14px;font-weight:700;cursor:pointer;transition:background .15s"'
        + ' onmouseover="this.style.background=\'rgba(0,194,255,.18)\'"'
        + ' onmouseout="this.style.background=\'var(--panel2)\'"'
        + ' title="Dettaglio partita">'
        + m.score.home + ' - ' + m.score.away
        + '</span>';
      if (isMe) {
        var mw = (ih && m.score.home > m.score.away) || (!ih && m.score.away > m.score.home);
        var md = m.score.home === m.score.away;
        var vc = mw ? 'var(--green)' : md ? 'var(--gold)' : 'var(--red)';
        badge = '<span style="font-size:11px;font-weight:700;color:' + vc + ';margin-left:2px">' + (mw?'V':md?'P':'S') + '</span>';
      }
    } else {
      scoreHtml = '<span style="color:var(--muted);font-size:13px;padding:0 10px">vs</span>';
    }

    var homeName = hT ? hT.name : '?';
    var awayName = aT ? aT.name : '?';
    return '<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;'
      + 'border-radius:8px;margin-bottom:3px;'
      + 'background:' + (isMe ? 'rgba(0,194,255,.06)' : 'rgba(255,255,255,.02)') + ';'
      + 'border:1px solid ' + (isMe ? 'rgba(0,194,255,.18)' : 'rgba(255,255,255,.05)') + '">'
      + '<div style="flex:1;text-align:right;font-size:13px;font-weight:' + (m.home===G.myId?700:400) + '">'
      + '<span onclick="showTeamRosterPopup(\'' + m.home + '\')" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">' + homeName + '</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0">' + scoreHtml + badge + '</div>'
      + '<div style="flex:1;text-align:left;font-size:13px;font-weight:' + (m.away===G.myId?700:400) + '">'
      + '<span onclick="showTeamRosterPopup(\'' + m.away + '\')" style="cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px">' + awayName + '</span>'
      + '</div>'
      + '</div>';
  }

  var h = '<div style="display:flex;gap:6px;margin-bottom:14px">'
    + '<button class="btn' + (activeTab==='andata'?' primary':' sm') + '" onclick="_showCalTab(\'andata\')" style="font-size:13px">&#x2B05; Andata</button>'
    + '<button class="btn' + (activeTab==='ritorno'?' primary':' sm') + '" onclick="_showCalTab(\'ritorno\')" style="font-size:13px">Ritorno &#x27A1;</button>'
    + '</div>';

  currentRounds.forEach(function(r) {
    var matches = rounds[r];
    if (!matches) return;
    var myMatch = matches.find(function(m){ return m.home === G.myId || m.away === G.myId; });
    var roundBadge = '';
    if (myMatch && myMatch.played) {
      var ih = myMatch.home === G.myId;
      var mw = (ih && myMatch.score.home > myMatch.score.away) || (!ih && myMatch.score.away > myMatch.score.home);
      var md = myMatch.score.home === myMatch.score.away;
      var col = mw ? 'rgba(46,204,113,.25)' : md ? 'rgba(240,192,64,.25)' : 'rgba(231,76,60,.25)';
      roundBadge = '<span style="font-size:10px;padding:1px 7px;border-radius:4px;background:' + col + ';font-weight:700">' + (mw?'V':md?'P':'S') + '</span>';
    }

    h += '<div style="margin-bottom:14px">'
      + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">'
      + '<span style="font-size:12px;font-weight:700;color:var(--blue)">G' + r + '</span>'
      + roundBadge
      + '</div>'
      + matches.map(matchRow).join('')
      + '</div>';
  });

  document.getElementById('tab-cal').innerHTML = h;
}

function _showCalTab(tab) {
  renderCal(tab);
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

  // ── Sezione OFFERTE DA FINALIZZARE ──────────────────────────────
  const pending = G.pendingPurchases || [];
  const curRnd  = typeof currentRound === 'function' ? currentRound() : 0;

  let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div style="font-weight:700;color:var(--blue);font-size:15px">Mercato Trasferimenti</div>
    <div style="font-size:12px;color:var(--muted)">Budget: <strong style="color:var(--blue)">${formatMoney(G.budget)}</strong></div>
  </div>`;

  if (pending.length > 0) {
    h += `<div class="card" style="margin-bottom:12px;border:2px solid var(--green)">
      <div style="font-weight:700;color:var(--green);margin-bottom:8px;display:flex;align-items:center;gap:8px">
        ✅ Offerte da finalizzare
        <span style="font-size:11px;font-weight:400;color:var(--muted)">(scadono alla prossima giornata)</span>
      </div>
      <table><thead><tr>
        <th>Giocatore</th><th>Da</th><th>Ruolo</th><th>OVR</th><th>Prezzo offerta</th><th>Scade</th><th></th>
      </tr></thead><tbody>`;
    pending.forEach((pp, i) => {
      const p = pp.player;
      const canBuy = G.budget >= pp.offerAmount;
      const roundsLeft = pp.expiresAfterRound - curRnd;
      const expLbl = roundsLeft <= 0 ? '⚠️ Scaduta' : roundsLeft === 1 ? '⚠️ Ultima G!' : roundsLeft + ' G';
      const expCol = roundsLeft <= 1 ? 'var(--red)' : 'var(--gold)';
      h += `<tr>
        <td style="font-weight:600">${p.name} <span style="font-size:11px;color:var(--muted)">(${p.age}a)</span></td>
        <td style="font-size:12px;color:var(--muted)">${p._tname}</td>
        <td><span class="badge ${p.role==='POR'?'S':p.role==='CB'?'B':p.role==='DIF'?'A':'C'}">${p.role}</span></td>
        <td style="font-weight:700">${p.overall}</td>
        <td style="font-size:13px;font-weight:700;color:var(--green)">${formatMoney(pp.offerAmount)}</td>
        <td style="font-size:11px;font-weight:700;color:${expCol}">${expLbl}</td>
        <td>
          ${canBuy
            ? `<button class="btn sm success" onclick="buyFromPending(${i})">Conferma acquisto</button>`
            : `<span style="font-size:11px;color:var(--red)">Budget insuff.</span>`
          }
        </td>
      </tr>`;
    });
    h += `</tbody></table></div>`;
  }

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

  // Sezione ACQUISTI — usa marketPool persistente
  if (!G.marketPool || !G.marketPool.length) {
    if (typeof initMarketPool === 'function') initMarketPool();
  }
  const pool = G.marketPool || [];
  G._mercList = pool.map(e => e.player); // compatibilità con showMarketPlayerModal

  h += `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <div style="font-weight:600;color:var(--blue)">🔍 Giocatori disponibili sul mercato</div>
      <div style="font-size:11px;color:var(--muted)">Lista aggiornata ogni giornata</div>
    </div>
    <table><thead><tr>
      <th>Giocatore</th><th>Mano</th><th>Da</th><th>Ruolo</th><th>OVR</th><th>Valore</th><th>Scade</th><th></th>
    </tr></thead><tbody>`;

  pool.forEach((entry, i) => {
    const p   = entry.player;
    const ok  = G.budget >= p.value;
    const has = entry.pendingOffer !== null;
    const res = entry.offerResult;
    const daysLbl = entry.daysLeft === 1 ? '⚠️ ultima G' : entry.daysLeft + ' G';
    const dayColor = entry.daysLeft === 1 ? 'var(--red)' : entry.daysLeft <= 2 ? 'var(--gold)' : 'var(--muted)';

    let offerBadge = '';
    if (res === 'accepted') {
      offerBadge = `<span style="font-size:10px;color:var(--green);font-weight:700">✓ Accettata</span>`;
    } else if (has) {
      offerBadge = `<span style="font-size:10px;color:var(--gold)">⏳ In attesa</span>`;
    }

    h += `<tr class="trhov" onclick="showMarketPlayerModal(${i})">
      <td style="font-weight:600;cursor:pointer">
        ${p.name}${_ritBadge(p)} <span style="font-size:11px;color:var(--muted)">(${p.age}a)</span>
        ${offerBadge ? '<br>' + offerBadge : ''}
      </td>
      <td><span class="badge ${p.hand==='AMB'?'C':p.hand==='L'?'L':'R'}">${p.hand}</span></td>
      <td style="font-size:12px"><span onclick="showTeamRosterPopup('${p._tid}')" style="cursor:pointer;color:var(--muted);text-decoration:underline dotted;text-underline-offset:3px" title="Vedi rosa">${p._tname}</span></td>
      <td><span class="badge ${p.role==='POR'?'S':p.role==='CB'?'B':p.role==='DIF'?'A':'C'}">${p.role}</span></td>
      <td style="font-weight:700">${p.overall}</td>
      <td style="font-size:12px">${formatMoney(p.value)}</td>
      <td style="font-size:11px;color:${dayColor};font-weight:600">${daysLbl}</td>
      <td onclick="event.stopPropagation()" style="display:flex;gap:4px;flex-wrap:wrap">
        ${res === 'accepted'
          ? `<button class="btn sm primary" onclick="buyPlayerFromPool(${i})">Conferma</button>`
          : ok
            ? `<button class="btn sm primary" onclick="buyPlayerFromPool(${i})">Acquista</button>`
            : ''
        }
        ${!has && res !== 'accepted'
          ? `<button class="btn sm warn" onclick="openOfferPopup(${i})">Offerta</button>`
          : ''
        }
      </td>
    </tr>`;
  });

  if (!pool.length) {
    h += `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:16px">Nessun giocatore disponibile — gioca una partita per aggiornare il mercato</td></tr>`;
  }

  h += `</tbody></table></div>`;
  document.getElementById('tab-market').innerHTML = h;
}

function buyPlayer(i) {
  buyPlayerFromPool(i);
}

function buyPlayerFromPool(i) {
  const pool = G.marketPool || [];
  const entry = pool[i];
  if (!entry) return;
  const p = entry.player;
  // Se offerta accettata usa quel prezzo, altrimenti prezzo pieno
  const price = (entry.offerResult === 'accepted' && entry.offerResultAmount)
    ? entry.offerResultAmount
    : p.value;
  if (G.budget < price) {
    G.msgs.push('❌ Budget insufficiente per acquistare ' + p.name + '.');
    renderMarket(); return;
  }
  G.budget -= price;
  addLedger('acquisto', -price, `Acquistato ${p.name} da ${p._tname}`, currentRound());
  const np = { ...p }; delete np._tid; delete np._tname;
  np.morale = Math.min(100, np.morale + rnd(8, 15));
  G.rosters[G.myId].push(np);
  G.rosters[p._tid] = (G.rosters[p._tid] || []).filter(pl => pl.name !== p.name);
  // Se la rosa avversaria scende sotto 13, genera automaticamente un sostituto
  _replenishRoster(p._tid);
  // Rimuovi dal pool
  G.marketPool.splice(i, 1);
  G.msgs.push('✅ Acquistato ' + p.name + ' da ' + p._tname + ' per ' + formatMoney(price) + '. Morale alto!');
  updateHeader(); autoSave(); renderMarket();
}

// ── Popup offerta ─────────────────────────────
function openOfferPopup(i) {
  const pool  = G.marketPool || [];
  const entry = pool[i];
  if (!entry) return;
  const p = entry.player;

  const existing = document.getElementById('offer-popup');
  if (existing) existing.remove();

  const minOffer = Math.round(p.value * 0.50);  // minimo 50% del valore
  const stepK    = Math.max(1000, Math.round(p.value / 20 / 1000) * 1000);

  const ov = document.createElement('div');
  ov.id = 'offer-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:300;backdrop-filter:blur(4px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:22px;max-width:360px;width:90%">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:var(--blue)">Fai un'offerta</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px">${p.name} · ${p._tname} · OVR ${p.overall}</div>

      <div class="irow" style="margin-bottom:8px">
        <span class="ilbl">Valore di mercato</span>
        <span style="font-weight:700">${formatMoney(p.value)}</span>
      </div>
      <div class="irow" style="margin-bottom:16px">
        <span class="ilbl">Budget disponibile</span>
        <span style="font-weight:700;color:var(--blue)">${formatMoney(G.budget)}</span>
      </div>

      <div style="margin-bottom:6px;font-size:12px;color:var(--muted);font-weight:600">Importo offerta</div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <button onclick="_offerStep(-1,${i})" style="background:var(--panel2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:16px;color:var(--text)">−</button>
        <input type="number" id="offer-amount" value="${Math.round(p.value * 0.85)}"
          min="${minOffer}" step="${stepK}"
          style="flex:1;text-align:center;background:var(--panel2);border:1px solid var(--border);border-radius:6px;padding:6px;color:var(--text);font-size:14px;font-weight:700">
        <button onclick="_offerStep(1,${i})" style="background:var(--panel2);border:1px solid var(--border);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:16px;color:var(--text)">+</button>
      </div>
      <div id="offer-hint" style="font-size:11px;color:var(--muted);margin-bottom:16px;min-height:16px"></div>

      <div style="display:flex;gap:8px">
        <button class="btn primary" style="flex:1" onclick="submitOffer(${i})">Invia Offerta</button>
        <button class="btn" onclick="document.getElementById('offer-popup').remove()">Annulla</button>
      </div>
      <div style="margin-top:10px;font-size:10px;color:var(--muted);text-align:center">
        La risposta arriverà nella prossima giornata
      </div>
    </div>`;

  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
  _updateOfferHint(i);
}

function _offerStep(dir, i) {
  const pool  = G.marketPool || [];
  const entry = pool[i]; if (!entry) return;
  const p     = entry.player;
  const step  = Math.max(1000, Math.round(p.value / 20 / 1000) * 1000);
  const inp   = document.getElementById('offer-amount');
  if (!inp) return;
  inp.value = Math.max(Math.round(p.value * 0.50), parseInt(inp.value) + dir * step);
  _updateOfferHint(i);
}

function _updateOfferHint(i) {
  const pool  = G.marketPool || [];
  const entry = pool[i]; if (!entry) return;
  const p     = entry.player;
  const inp   = document.getElementById('offer-amount');
  const hint  = document.getElementById('offer-hint');
  if (!inp || !hint) return;
  const amount = parseInt(inp.value) || 0;
  const pct    = amount / p.value;
  let txt = '', color = 'var(--muted)';
  if (pct >= 1.0)      { txt = '✓ Offerta superiore al valore — alta probabilità di accettazione'; color = 'var(--green)'; }
  else if (pct >= 0.90){ txt = 'Offerta vicina al valore — buona probabilità'; color = 'var(--green)'; }
  else if (pct >= 0.75){ txt = 'Offerta discreta — probabilità moderata'; color = 'var(--gold)'; }
  else if (pct >= 0.50){ txt = 'Offerta bassa — probabilità ridotta'; color = 'var(--red)'; }
  else                 { txt = 'Offerta troppo bassa'; color = 'var(--red)'; }
  hint.textContent = txt; hint.style.color = color;
}

function submitOffer(i) {
  const pool  = G.marketPool || [];
  const entry = pool[i]; if (!entry) return;
  const p     = entry.player;
  const inp   = document.getElementById('offer-amount');
  const amount = parseInt(inp?.value) || 0;
  if (amount <= 0 || G.budget < amount) {
    alert('Budget insufficiente per questa offerta.'); return;
  }
  entry.pendingOffer = { amount, roundMade: currentRound ? currentRound() : 0 };
  entry.offerResult  = null;
  G.msgs.push('📨 Offerta di ' + formatMoney(amount) + ' inviata per ' + p.name + ' (' + p._tname + '). Risposta alla prossima giornata.');
  document.getElementById('offer-popup')?.remove();
  autoSave(); renderMarket();
}

// ════════════════════════════════════════════
// FINANZA
// ════════════════════════════════════════════
function renderFinance() {
  const ledger  = G.ledger || [];
  const roster  = G.rosters[G.myId] || [];

  // ── Totali per categoria ──
  const totals = { vittoria:0, pareggio:0, ingaggi:0, acquisto:0, vendita:0, allenamento:0, obiettivo:0, playoff:0 };
  ledger.forEach(e => { if (totals[e.type] !== undefined) totals[e.type] += e.amount; });

  const totalIn  = ledger.filter(e => e.amount > 0).reduce((s,e) => s + e.amount, 0);
  const totalOut = ledger.filter(e => e.amount < 0).reduce((s,e) => s + e.amount, 0);
  const saldo    = totalIn + totalOut;

  // ── Monte ingaggi ──
  const wageBillAnn = roster.reduce((s,p) => s + (p.salary||0), 0);
  const wageBillDay = (typeof calcWageBill === 'function') ? calcWageBill() : Math.round(wageBillAnn / (REGULAR_SEASON_ROUNDS || 26));
  const inFinal     = G.phase !== 'regular';

  // ── Introiti da vittorie/premi: vittorie + pareggi + playoff + obiettivi ──
  const totalPrize = totals.vittoria + totals.pareggio + totals.playoff + totals.obiettivo;
  // ── Acquisti/vendite ──
  const totalBuy   = totals.acquisto;  // negativo
  const totalSell  = totals.vendita;   // positivo
  // ── Ingaggi versati ──
  const totalWages = totals.ingaggi;   // negativo

  // ── Helpers ──
  const fmPos = v => `<span style="color:var(--green);font-weight:700">+${formatMoney(Math.abs(v))}</span>`;
  const fmNeg = v => `<span style="color:var(--red);font-weight:700">−${formatMoney(Math.abs(v))}</span>`;
  const fmVal = v => v >= 0 ? fmPos(v) : fmNeg(v);
  const fmSaldo = v => v >= 0
    ? `<span style="color:var(--green);font-weight:700">+${formatMoney(v)}</span>`
    : `<span style="color:var(--red);font-weight:700">${formatMoney(v)}</span>`;

  const typeIcon  = { vittoria:'🏆', pareggio:'🤝', ingaggi:'💸', acquisto:'🛒', vendita:'💰', allenamento:'🏋️', obiettivo:'🎯', playoff:'🥇' };
  const typeLabel = { vittoria:'Vittoria', pareggio:'Pareggio', ingaggi:'Ingaggi', acquisto:'Acquisto', vendita:'Vendita', allenamento:'Allenamento', obiettivo:'Obiettivo', playoff:'Playoff' };
  const recent = [...ledger].reverse().slice(0, 40);

  // Giornate di regular season giocate (per calcolare ingaggi versati vs attesi)
  const roundsPlayed = G.schedule
    ? G.schedule.filter(m => m.played && (m.home === G.myId || m.away === G.myId)).length
    : 0;

  let h = `
  <!-- ── RIEPILOGO STATO ECONOMICO ── -->
  <div class="card" style="margin-bottom:12px">
    <div class="slbl" style="margin-top:0">💰 Stato Economico del Club</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;font-size:13px">

      <!-- Budget attuale -->
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,58,92,.3)">
        <span style="color:var(--muted)">Budget attuale</span>
        <span style="font-weight:700;color:var(--blue)">${formatMoney(G.budget)}</span>
      </div>
      <!-- Saldo netto -->
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,58,92,.3)">
        <span style="color:var(--muted)">Saldo netto stagione</span>
        <span>${fmSaldo(saldo)}</span>
      </div>

      <!-- Introiti da vittorie e premi -->
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,58,92,.3)">
        <span style="color:var(--muted)">🏆 Introiti vittorie e premi</span>
        <span style="color:var(--green);font-weight:700">+${formatMoney(totalPrize)}</span>
      </div>
      <!-- Vendita giocatori -->
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,58,92,.3)">
        <span style="color:var(--muted)">💰 Introiti vendita giocatori</span>
        <span style="color:${totalSell > 0 ? 'var(--green)' : 'var(--muted)'};font-weight:700">${totalSell > 0 ? '+' + formatMoney(totalSell) : '—'}</span>
      </div>

      <!-- Acquisto giocatori -->
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,58,92,.3)">
        <span style="color:var(--muted)">🛒 Uscite acquisto giocatori</span>
        <span style="color:${totalBuy < 0 ? 'var(--red)' : 'var(--muted)'};font-weight:700">${totalBuy < 0 ? '−' + formatMoney(Math.abs(totalBuy)) : '—'}</span>
      </div>
      <!-- Monte ingaggi versato -->
      <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(30,58,92,.3)">
        <span style="color:var(--muted)">💸 Monte ingaggi versato</span>
        <span style="color:${totalWages < 0 ? 'var(--red)' : 'var(--muted)'};font-weight:700">${totalWages < 0 ? '−' + formatMoney(Math.abs(totalWages)) : '—'}</span>
      </div>

    </div>
  </div>

  <!-- ── MONTE INGAGGI ── -->
  <div class="card" style="margin-bottom:12px">
    <div class="slbl" style="margin-top:0">💸 Monte Ingaggi</div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;text-align:center">
      <div style="background:var(--panel2);border-radius:10px;padding:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Annuale (totale rosa)</div>
        <div style="font-size:16px;font-weight:700;color:var(--text)">${formatMoney(wageBillAnn)}</div>
      </div>
      <div style="background:var(--panel2);border-radius:10px;padding:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Per giornata (÷${REGULAR_SEASON_ROUNDS || 26})</div>
        <div style="font-size:16px;font-weight:700;color:var(--red)">−${formatMoney(wageBillDay)}</div>
      </div>
      <div style="background:var(--panel2);border-radius:10px;padding:12px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Giocatori in rosa</div>
        <div style="font-size:16px;font-weight:700;color:var(--text)">${roster.length}</div>
      </div>
    </div>

    <div style="font-size:12px;padding:8px 12px;border-radius:8px;background:${inFinal ? 'rgba(240,192,64,.08)' : 'rgba(255,255,255,.04)'};border:1px solid ${inFinal ? 'rgba(240,192,64,.3)' : 'var(--border)'}">
      ${inFinal
        ? '⚠️ <strong>Fase finale in corso</strong>: il monte ingaggi non viene più dedotto nelle fasi playoff/playout.'
        : `ℹ️ Il monte ingaggi viene dedotto <strong>automaticamente al termine di ogni giornata</strong> della regular season (${roundsPlayed}/${REGULAR_SEASON_ROUNDS || 26} giornate giocate). È variabile: aumenta con gli acquisti, diminuisce con le cessioni.`}
    </div>
  </div>

  <!-- ── STORICO TRANSAZIONI ── -->
  <div class="card">
    <div class="slbl" style="margin-top:0">🧾 Storico Transazioni</div>
    ${recent.length === 0
      ? '<div style="font-size:13px;color:var(--muted);padding:8px 0">Nessuna transazione ancora registrata.</div>'
      : `<table style="width:100%;font-size:12px">
          <thead><tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;color:var(--muted);font-weight:600;padding-bottom:6px">Descrizione</th>
            <th style="text-align:center;color:var(--muted);font-weight:600;padding-bottom:6px;width:40px">G.</th>
            <th style="text-align:right;color:var(--muted);font-weight:600;padding-bottom:6px;width:110px">Importo</th>
          </tr></thead>
          <tbody>
            ${recent.map(e => `
              <tr style="border-bottom:1px solid rgba(30,58,92,.25)">
                <td style="padding:5px 0">${typeIcon[e.type]||'•'} ${e.note || typeLabel[e.type] || e.type}</td>
                <td style="text-align:center;color:var(--muted)">${e.round || '—'}</td>
                <td style="text-align:right;padding:5px 0">${fmVal(e.amount)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`}
  </div>`;

  document.getElementById('tab-finance').innerHTML = h;
}


// ════════════════════════════════════════════
// STORICO
// ════════════════════════════════════════════
function renderHistory() {
  const history = G.seasonHistory || [];
  const roster  = G.rosters[G.myId] || [];

  // ── Record di carriera (da statistiche cumulative) ──────────────────
  let topGoals = null, topAssists = null, topApps = null;
  roster.forEach(p => {
    if (!p) return;
    const cg = (p.careerGoals   || 0) + (p.goals   || 0);
    const ca = (p.careerAssists || 0) + (p.assists || 0);
    const cp = (p.careerApps    || 0);
    if (!topGoals   || cg > (topGoals.careerGoals   || 0) + (topGoals.goals   || 0))   topGoals   = p;
    if (!topAssists || ca > (topAssists.careerAssists || 0) + (topAssists.assists || 0)) topAssists = p;
    if (!topApps    || cp > (topApps.careerApps || 0))                                   topApps    = p;
  });

  function _statVal(p, careerKey, seasonKey) {
    if (!p) return 0;
    return (p[careerKey] || 0) + (p[seasonKey] || 0);
  }

  let h = '<div style="max-width:860px">';

  // ── Record del club ─────────────────────────────────────────────────
  h += `<div class="card" style="margin-bottom:14px">
    <div class="slbl" style="margin-top:0">🏅 Record del Club</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">`;

  function _recordCard(icon, label, p, val, suffix) {
    if (!p) return '<div class="sc"><div class="sc-l">' + icon + ' ' + label + '</div><div class="sc-n" style="font-size:13px;color:var(--muted)">—</div></div>';
    return '<div class="sc">' +
      '<div class="sc-l">' + icon + ' ' + label + '</div>' +
      '<div style="font-size:13px;font-weight:700;color:var(--blue);margin-top:4px">' + p.name + '</div>' +
      '<div style="font-size:16px;font-weight:800;color:var(--gold)">' + val + ' <span style="font-size:11px;color:var(--muted)">' + suffix + '</span></div>' +
      '</div>';
  }

  h += _recordCard('⚽', 'Miglior marcatore', topGoals,   _statVal(topGoals, 'careerGoals', 'goals'), 'gol');
  h += _recordCard('🤝', 'Miglior assistman', topAssists, _statVal(topAssists, 'careerAssists', 'assists'), 'assist');
  h += _recordCard('📅', 'Più stagioni in rosa', topApps, topApps ? (topApps.careerApps || 0) : 0, 'stagioni');

  h += '</div></div>';

  // ── Storico stagioni ────────────────────────────────────────────────
  h += `<div class="card">
    <div class="slbl" style="margin-top:0">📋 Storico Stagioni</div>`;

  if (!history.length) {
    h += '<div style="color:var(--muted);font-size:13px;padding:8px 0">Nessuna stagione completata — i dati appariranno dopo la prima stagione conclusa.</div>';
  } else {
    h += `<table><thead><tr>
      <th>Stag.</th>
      <th>Fascia</th>
      <th>Pos.</th>
      <th>Punti</th>
      <th>V/P/S</th>
      <th>GF/GA</th>
      <th>Playoff/Playout</th>
      <th>Marcatore</th>
      <th>Assistman</th>
    </tr></thead><tbody>`;

    history.slice().reverse().forEach(s => {
      const posColor = s.pos <= 3 ? 'var(--gold)' : s.pos <= 8 ? 'var(--blue)' : 'var(--muted)';
      h += `<tr>
        <td style="font-weight:700;color:var(--muted)">S${s.season}</td>
        <td style="font-weight:800;font-size:14px;color:${({'S':'#ffd700','A':'#00c2ff','B':'#2ecc71','C':'#e74c3c'}[s.tier]||'var(--muted)')}">${s.tier||'?'}</td>
        <td style="font-weight:800;color:${posColor}">${s.pos}°</td>
        <td style="font-weight:700">${s.pts}</td>
        <td style="font-size:12px;color:var(--muted)">${s.w}/${s.d}/${s.l}</td>
        <td style="font-size:12px;color:var(--muted)">${s.gf}/${s.ga}</td>
        <td style="font-size:12px">${s.playoffPhase}</td>
        <td style="font-size:12px">${s.topScorer ? s.topScorer.name + ' <span style="color:var(--gold);font-weight:700">(' + s.topScorer.val + '⚽)</span>' : '—'}</td>
        <td style="font-size:12px">${s.topAssist ? s.topAssist.name + ' <span style="color:var(--blue);font-weight:700">(' + s.topAssist.val + '🤝)</span>' : '—'}</td>
      </tr>`;
    });

    h += '</tbody></table>';
  }
  h += '</div></div>';
  document.getElementById('tab-history').innerHTML = h;
}

// ════════════════════════════════════════════
// CREDITS
// ════════════════════════════════════════════
function renderCredits() {
  // Legge la versione attuale dal footer della pagina (aggiornato ad ogni release)
  const footerEl = document.querySelector('.wp-version-footer');
  const version  = footerEl ? footerEl.textContent.trim() : 'v0.5.17 beta';
  const year     = new Date().getFullYear();

  document.getElementById('tab-credits').innerHTML = `
    <div style="max-width:600px;margin:0 auto">

      <!-- Header -->
      <div class="card" style="padding:28px;text-align:center;margin-bottom:16px">
        <div style="font-size:48px;margin-bottom:12px">🏊</div>
        <div style="font-size:28px;font-weight:700;color:var(--blue);margin-bottom:4px">Waterpolo Manager</div>
        <div style="font-size:14px;color:var(--muted)">Serie A1 Maschile — Stagione 2025/26</div>
        <div style="display:inline-block;margin-top:12px;padding:4px 14px;border-radius:20px;background:rgba(0,194,255,.12);border:1px solid rgba(0,194,255,.3);font-size:13px;color:var(--blue);font-weight:700">${version}</div>
      </div>

      <!-- Sviluppatore -->
      <div class="card" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px">Sviluppatore</div>
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--blue),#0a3a6a);display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0">🤽</div>
          <div>
            <div style="font-size:17px;font-weight:700;color:var(--text)">Sviluppato da Davide Lanza - Grandepinna</div>
          </div>
        </div>
      </div>

      <!-- Licenza -->
      <div class="card" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Licenza</div>
        <div style="font-size:13px;color:var(--text);margin-bottom:6px;font-weight:600">MIT License</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.6">
          Copyright © ${year} Davide Lanza (Grandepinna).<br>
          Il software è distribuito liberamente per uso personale e non commerciale.<br>
          È consentita la modifica e la redistribuzione con attribuzione all'autore originale.
        </div>
      </div>

      <!-- Tecnologie -->
      <div class="card" style="padding:20px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Tecnologie</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
          <div class="irow"><span class="ilbl">Frontend</span><span>HTML5 · CSS3 · JavaScript</span></div>
          <div class="irow"><span class="ilbl">Autenticazione</span><span>Firebase Auth</span></div>
          <div class="irow"><span class="ilbl">Database</span><span>Firebase Realtime DB</span></div>
          <div class="irow"><span class="ilbl">Grafici</span><span>Canvas HTML5</span></div>
          <div class="irow"><span class="ilbl">Hosting</span><span>GitHub Pages</span></div>
          <div class="irow"><span class="ilbl">AI Development</span><span>Claude (Anthropic)</span></div>
        </div>
      </div>

      <!-- Info versione -->
      <div class="card" style="padding:16px;text-align:center">
        <div style="font-size:11px;color:var(--muted)">
          Waterpolo Manager ${version} · ${year}<br>
          <span style="margin-top:4px;display:inline-block">
            Sviluppato da Davide Lanza - Grandepinna · con ❤️ per gli appassionati di pallanuoto italiana
          </span>
        </div>
      </div>

    </div>
  `;
}
