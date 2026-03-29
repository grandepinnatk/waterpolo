// ─────────────────────────────────────────────
// main.js
// Punto di ingresso: stato globale G, utility,
// logica playoff/playout, auto-save, init.
// ─────────────────────────────────────────────

// ── Stato globale ─────────────────────────────
// G è l'unico oggetto di stato condiviso tra tutti i moduli.
// Viene inizializzato in welcome.js (startNewGame / continueGame)
// e poi aggiornato da engine/* e ui/*.
let G = {};

// ── Utility globali ───────────────────────────
// Disponibili a tutti i moduli senza import (vanilla JS).
function rnd(a, b)  { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick(arr)  { return arr[Math.floor(Math.random() * arr.length)]; }
function cap(n)     { return Math.min(100, Math.max(0, Math.round(n))); }
function formatMoney(n) { return Math.round(n).toLocaleString('it-IT') + '€'; }

function currentRound() {
  const played = G.schedule ? G.schedule.filter(m => m.played) : [];
  return played.length ? Math.max(...played.map(m => m.round)) : 0;
}

// ── Auto-save ─────────────────────────────────
function autoSave() {
  if (G && G.myId) autoSaveToCurrentSlot(G);
}

// ── Simulazione rapida giornata ───────────────
function simNextRound() {
  const r = currentRound() + 1;
  simulateRound(G.schedule, G.stand, G.teams, r, G.myId);
  G.msgs.push('Giornata ' + r + ' simulata.');
  updateHeader(); autoSave(); renderDash();
}

function simEntireSeason() {
  simulateAllRemaining(G.schedule, G.stand, G.teams, G.myId);
  G.msgs.push('Campionato simulato fino alle tue partite rimanenti.');
  updateHeader(); autoSave(); renderDash();
}

// ── Post-season: inizializza playoff/playout ──
function initPostSeason() {
  if (G.phase !== 'regular') return;
  const s = getSortedStandings(G.stand);

  G.poTeams  = s.slice(0, 4).map(t => t.id);   // 1°-4°: playoff
  G.ploTeams = s.slice(10, 13).map(t => t.id);  // 11°-13°: playout
  G.relegated = s[13].id;                        // 14°: retrocessa diretta
  G.phase    = 'playoff';

  G.poBracket = {
    sf: [
      { home: G.poTeams[0], away: G.poTeams[3], scores: [], winner: null, label: 'Semifinale 1' },
      { home: G.poTeams[1], away: G.poTeams[2], scores: [], winner: null, label: 'Semifinale 2' },
    ],
    final: { home: null, away: null, scores: [], winner: null },
    done:  false,
  };
  G.plBracket = {
    m1: { home: G.ploTeams[0], away: G.ploTeams[2], scores: [], winner: null, label: 'Play-out: 11° vs 13°' },
    m2: { home: null, away: G.ploTeams[1],           scores: [], winner: null, label: 'Play-out Finale' },
    done: false, relegated: null,
  };

  const relName = G.teams.find(t => t.id === G.relegated)?.name || '—';
  G.msgs.push('Stagione regolare conclusa! Playoff: ' + G.poTeams.map(id => G.teams.find(t => t.id === id)?.name).join(', '));
  G.msgs.push(relName + ' retrocede direttamente in Serie A2.');
  updateHeader(); autoSave();
}

// ── Simula partita playoff (senza play live) ──
function simPOMatch(type, idx) {
  const pb = G.poBracket;
  const m  = type === 'sf' ? pb.sf[idx] : pb.final;
  const hT = G.teams.find(t => t.id === m.home);
  const aT = G.teams.find(t => t.id === m.away);
  const sc = simulateResult(hT, aT);
  m.scores.push(sc);
  m.winner = sc.home > sc.away ? m.home : sc.away > sc.home ? m.away : (Math.random() < 0.5 ? m.home : m.away);
  if (type === 'sf') {
    if (pb.sf.every(s => s.winner)) { pb.final.home = pb.sf[0].winner; pb.final.away = pb.sf[1].winner; }
  } else {
    pb.done = true;
    const wname = G.teams.find(t => t.id === m.winner)?.name;
    if (m.winner === G.myId) { G.playoffResult = 'champion'; G.msgs.push('HAI VINTO LO SCUDETTO! 🏆'); }
    else G.msgs.push('Campione d\'Italia: ' + wname);
  }
  autoSave(); renderPlayoff();
}

function simPLMatch(key) {
  const plb = G.plBracket;
  const m   = plb[key];
  if (!m.home) m.home = plb.m1.winner;
  const hT   = G.teams.find(t => t.id === m.home);
  const aT   = G.teams.find(t => t.id === m.away);
  const sc   = simulateResult(hT, aT);
  const loser = sc.home > sc.away ? m.away : sc.away > sc.home ? m.home : (Math.random() < 0.5 ? m.away : m.home);
  m.winner   = loser === m.home ? m.away : m.home;
  if (key === 'm1') {
    plb.m2.home = plb.m1.winner;
  } else {
    plb.relegated = loser; plb.done = true;
    if (loser === G.myId) { G.playoffResult = 'relegated'; G.msgs.push('Sei retrocesso in Serie A2!'); }
    else G.msgs.push(G.teams.find(t => t.id === loser)?.name + ' retrocede in Serie A2.');
  }
  autoSave(); renderPlayoff();
}

// ── Avvia playoff live (apre convocazioni) ────
function startPOMatch(type, idx) {
  const pb  = G.poBracket;
  const plb = G.plBracket;
  let m;
  if (type === 'sf')    m = pb.sf[idx];
  else if (type === 'final') m = pb.final;
  else { m = plb[idx]; if (!m.home) m.home = plb.m1.winner; }

  const ih  = m.home === G.myId;
  const opp = G.teams.find(t => t.id === (ih ? m.away : m.home));
  openLineup(m, ih, opp, type, m);
}

// ── Chiusura stagione ─────────────────────────
function closeSeason() {
  G.phase = 'done';
  const reward = finalizeObjectives(G.objectives, G.stand, G.myId, G.playoffResult);
  G.budget += reward;
  G.msgs.push('Stagione conclusa! Budget finale: ' + formatMoney(G.budget));
  updateHeader(); autoSave(); showTab('goals');
}

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildWelcomeScreen();
});

// ── Torna alla welcome (con aggiornamento slot) ─
function goToWelcome() {
  if (G && G.myId) {
    const ok = confirm('Tornare al menu principale? La partita in corso verrà salvata automaticamente.');
    if (!ok) return;
    autoSave();
  }
  showScreen('sc-welcome');
  buildWelcomeScreen(); // aggiorna i metadati degli slot
}

// ── Menu salvataggio in-game ───────────────────
// Mostra i 3 slot con opzioni salva/sovrascrivi.
function openSaveMenu() {
  const existing = document.getElementById('save-menu-modal');
  if (existing) existing.remove();

  const metas = readAllSlotsMeta();
  const ov    = document.createElement('div');
  ov.id        = 'save-menu-modal';
  ov.className = 'save-menu-overlay';

  const rows = metas.map((meta, i) => {
    const isCurrent = G._currentSlot === i;
    if (meta) {
      const savedDate = new Date(meta.savedAt).toLocaleString('it-IT', {
        day:'2-digit', month:'2-digit', year:'2-digit',
        hour:'2-digit', minute:'2-digit',
      });
      return `
        <div class="save-slot-row" style="border:1px solid ${isCurrent ? 'var(--blue)' : 'transparent'}">
          <div class="slot-team-dot" style="background:${meta.teamCol};width:32px;height:32px;font-size:9px">${meta.teamAbbr}</div>
          <div class="save-slot-info">
            <div class="save-slot-name">${meta.teamName} ${isCurrent ? '<span style="color:var(--blue);font-size:10px">(attivo)</span>' : ''}</div>
            <div class="save-slot-sub">Slot ${i+1} · G${meta.round} · ${meta.position}° posto · ${savedDate}</div>
          </div>
          <button class="btn sm primary" onclick="saveCurrentToSlot(${i});document.getElementById('save-menu-modal').remove()">
            ${isCurrent ? '💾 Aggiorna' : '💾 Salva qui'}
          </button>
        </div>`;
    } else {
      return `
        <div class="save-slot-row">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--muted)">＋</div>
          <div class="save-slot-info">
            <div class="save-slot-name">Slot ${i+1} — Vuoto</div>
          </div>
          <button class="btn sm primary" onclick="saveCurrentToSlot(${i});document.getElementById('save-menu-modal').remove()">
            💾 Salva qui
          </button>
        </div>`;
    }
  }).join('');

  ov.innerHTML = `
    <div class="save-menu-box">
      <div class="save-menu-title">💾 Salva Partita</div>
      ${rows}
      <button class="btn" style="width:100%;margin-top:8px"
              onclick="document.getElementById('save-menu-modal').remove()">Annulla</button>
    </div>`;

  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  document.body.appendChild(ov);
}
