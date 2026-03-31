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
// ── Velocità simulazione (globale, sempre disponibile) ──
function setSpeed(v) {
  if (G.ms) G.ms.speed = v;
  _setSpeedUI(v);
}
function _setSpeedUI(v) {
  document.querySelectorAll('.btn-speed').forEach(b => {
    const bv = parseInt(b.dataset.speed, 10);
    b.style.background  = bv === v ? 'var(--blue)' : '';
    b.style.color       = bv === v ? '#001220'     : '';
    b.style.borderColor = bv === v ? 'var(--blue)' : '';
    b.style.fontWeight  = bv === v ? '700'         : '';
  });
}

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

// ══════════════════════════════════════════════
// MERCATO IN USCITA — logica offerte e morale
// ══════════════════════════════════════════════

// ── Metti un giocatore sul mercato ────────────
function putPlayerOnMarket(rosterIdx, askingPrice) {
  if (!G.transferList) G.transferList = [];
  // Rimuovi se già presente
  G.transferList = G.transferList.filter(e => e.rosterIdx !== rosterIdx);
  G.transferList.push({ rosterIdx, askingPrice });
  // Calo morale: il giocatore sa di essere sul mercato
  const p = G.rosters[G.myId][rosterIdx];
  if (p) {
    p.morale = Math.max(0, p.morale - rnd(8, 15));
    G.msgs.push(p.name + ' messo sul mercato. Morale calato.');
  }
  autoSave();
}

// ── Rimuovi dal mercato ───────────────────────
function removeFromMarket(rosterIdx) {
  if (!G.transferList) return;
  const p = G.rosters[G.myId][rosterIdx];
  G.transferList = G.transferList.filter(e => e.rosterIdx !== rosterIdx);
  if (p) G.msgs.push(p.name + ' ritirato dal mercato.');
  autoSave();
}

// ── Calcola appetibilità di un giocatore ──────
// Restituisce un fattore 0-1 che le squadre usano per offrire
function _playerAttractiveness(p, matchesPlayed) {
  let score = p.overall / 100;               // base: overall
  score *= 0.5 + (p.morale / 200);           // morale: penalizza fino a -50%
  score *= 0.7 + (p.fitness / 333);          // fitness: penalizza fino a -30%
  const presencePenalty = matchesPlayed > 0 && (p.goals + p.assists + p.saves) === 0
    ? 0.80 : 1.0;                            // zero contributo: penalizza 20%
  score *= presencePenalty;
  return Math.min(1, Math.max(0.1, score));
}

// ── Genera offerte a fine giornata ───────────
// Chiamata da simNextRound() e da endMatch() dopo ogni gara giocata
// ── Mercato acquisti persistente ─────────────
// G.marketPool = array di giocatori disponibili con durata giornate rimanenti
// Generato una volta e aggiornato ad ogni giornata

function initMarketPool() {
  if (G.marketPool && G.marketPool.length > 0) return; // già inizializzato
  G.marketPool = [];
  _fillMarketPool(16);
}

function _fillMarketPool(targetSize) {
  if (!G.marketPool) G.marketPool = [];

  // Raccoglie giocatori disponibili da tutte le squadre avversarie
  // Distribuisce per fascia: ~30% fascia bassa (OVR 50-64), ~40% media (65-79), ~30% alta (80+)
  const all = [];
  G.teams.forEach(t => {
    if (t.id === G.myId) return;
    G.rosters[t.id].forEach(p => {
      if (p.overall >= 50) all.push({ ...p, _tid: t.id, _tname: t.name });
    });
  });

  const low    = all.filter(p => p.overall < 65).sort(() => Math.random() - 0.5);
  const mid    = all.filter(p => p.overall >= 65 && p.overall < 80).sort(() => Math.random() - 0.5);
  const high   = all.filter(p => p.overall >= 80).sort(() => Math.random() - 0.5);

  const needed = Math.max(0, targetSize - G.marketPool.length);
  const nLow  = Math.round(needed * 0.30);
  const nHigh = Math.round(needed * 0.30);
  const nMid  = needed - nLow - nHigh;

  const toAdd = [
    ...low.slice(0, nLow),
    ...mid.slice(0, nMid),
    ...high.slice(0, nHigh),
  ];

  // Esclude chi è già nel pool
  const existing = new Set(G.marketPool.map(e => e._pname + e._tid));
  toAdd.forEach(p => {
    const key = p.name + p._tid;
    if (!existing.has(key)) {
      existing.add(key);
      G.marketPool.push({
        player:      p,
        daysLeft:    rnd(1, 5),   // rimane 1-5 giornate
        pendingOffer: null,       // { amount, roundMade } offerta fatta dal giocatore
      });
    }
  });
}

function refreshMarketPool() {
  if (!G.marketPool) { initMarketPool(); return; }

  // Decrementa durata e rimuove scaduti
  G.marketPool = G.marketPool.filter(e => {
    e.daysLeft--;
    return e.daysLeft > 0;
  });

  // Rimpiazza con nuovi giocatori per mantenere ~16 disponibili
  _fillMarketPool(16);

  // Processa le offerte pendenti: risposta nella giornata successiva
  _processMarketOfferResponses();
}

// Meccanismo CPU per accettare offerte:
// La squadra accetta se l'offerta è ≥ 75% del valore del giocatore.
// Tra il 75% e il 100% del valore c'è una probabilità crescente (70% al 75%, 100% al 100%+).
// Questo simula una trattativa realistica: le grandi squadre sono più restie a vendere.
function _processMarketOfferResponses() {
  if (!G.marketPool) return;
  G.marketPool.forEach(entry => {
    if (!entry.pendingOffer) return;
    const p      = entry.player;
    const offer  = entry.pendingOffer.amount;
    const minAcc = p.value * 0.75;   // soglia minima accettazione
    const pct    = offer / p.value;  // rapporto offerta/valore

    let acceptProb;
    if (offer < minAcc) {
      acceptProb = 0;  // rifiuto immediato sotto il 75%
    } else if (pct >= 1.0) {
      acceptProb = 1.0; // accettazione certa sopra il 100%
    } else {
      // Tra 75% e 100%: probabilità lineare da 0.30 a 0.95
      acceptProb = 0.30 + (pct - 0.75) / 0.25 * 0.65;
    }

    const accepted = Math.random() < acceptProb;
    entry.offerResult = accepted ? 'accepted' : 'rejected';
    entry.offerResultAmount = offer;

    if (accepted) {
      G.msgs.push(`✅ Offerta accettata! ${p._tname} accetta ${formatMoney(offer)} per ${p.name}. Vai al Mercato per concludere l'acquisto.`);
    } else if (offer < minAcc) {
      G.msgs.push(`❌ Offerta rifiutata: ${p._tname} ha respinto ${formatMoney(offer)} per ${p.name} (troppo bassa).`);
      entry.pendingOffer = null;
    } else {
      G.msgs.push(`❌ Offerta rifiutata: ${p._tname} ha risposto di no a ${formatMoney(offer)} per ${p.name}.`);
      entry.pendingOffer = null;
    }
  });
}

function generateTransferOffers() {
  if (!G.transferList || !G.transferList.length) return;

  const matchesPlayed = G.schedule.filter(m =>
    (m.home === G.myId || m.away === G.myId) && m.played
  ).length;

  G.transferList.forEach(entry => {
    const p = G.rosters[G.myId][entry.rosterIdx];
    if (!p) return;

    // Ogni giornata c'è ~40% di probabilità che arrivi un'offerta
    if (Math.random() > 0.40) return;

    const attract  = _playerAttractiveness(p, matchesPlayed);
    // Offerta: tra il 60% e il 110% del valore reale, scalata per appetibilità
    const baseOffer = p.value * attract;
    const offerMin  = baseOffer * 0.60;
    const offerMax  = baseOffer * 1.10;
    const offer     = Math.round((offerMin + Math.random() * (offerMax - offerMin)) / 1000) * 1000;

    // Scegli squadra offerente casuale (non la nostra)
    const buyers = G.teams.filter(t => t.id !== G.myId);
    const buyer  = pick(buyers);

    // Salva l'offerta nell'entry
    if (!entry.offers) entry.offers = [];
    entry.offers.push({ teamId: buyer.id, teamName: buyer.name, amount: offer, round: currentRound() });

    const pct = Math.round((offer / entry.askingPrice) * 100);
    const vs  = offer >= entry.askingPrice
      ? `(${pct}% del prezzo richiesto ✓)`
      : `(${pct}% del prezzo richiesto)`;
    G.msgs.push(`💼 ${buyer.name} offre ${formatMoney(offer)} per ${p.name} ${vs}`);
  });
}

// ── Accetta un'offerta ────────────────────────
function acceptOffer(rosterIdx, offerIdx) {
  if (!G.transferList) return;
  const entry = G.transferList.find(e => e.rosterIdx === rosterIdx);
  if (!entry || !entry.offers || !entry.offers[offerIdx]) return;

  const offer = entry.offers[offerIdx];
  const p     = G.rosters[G.myId][rosterIdx];
  if (!p) return;

  // Incassa l'importo
  G.budget += offer.amount;

  // Trasferisce il giocatore alla squadra acquirente
  const buyerRoster = G.rosters[offer.teamId];
  if (buyerRoster) {
    const sold = { ...p };
    delete sold._inTransfer;
    buyerRoster.push(sold);
  }

  // Rimuovi dalla rosa
  G.rosters[G.myId] = G.rosters[G.myId].filter((_, i) => i !== rosterIdx);

  // Rimuovi dalla lista trasferimenti
  G.transferList = G.transferList.filter(e => e.rosterIdx !== rosterIdx);

  // Aggiusta gli indici nella transferList se necessario
  G.transferList.forEach(e => { if (e.rosterIdx > rosterIdx) e.rosterIdx--; });

  G.msgs.push(`✅ ${p.name} ceduto a ${offer.teamName} per ${formatMoney(offer.amount)}!`);
  updateHeader(); autoSave();
}

// ── Rifiuta un'offerta ────────────────────────
function rejectOffer(rosterIdx, offerIdx) {
  const entry = G.transferList && G.transferList.find(e => e.rosterIdx === rosterIdx);
  if (!entry || !entry.offers) return;
  const p     = G.rosters[G.myId][rosterIdx];
  const offer = entry.offers[offerIdx];
  if (offer) G.msgs.push(`❌ Offerta di ${offer.teamName} per ${p ? p.name : '—'} rifiutata.`);
  entry.offers.splice(offerIdx, 1);
  autoSave();
}

// ── Morale: aggiornamenti post-partita ────────
// Chiamata da endMatch() dopo ogni gara
function updateMoraleAfterMatch(ms) {
  const won  = ms.myScore > ms.oppScore;
  const drew = ms.myScore === ms.oppScore;
  const roster = G.rosters[G.myId];

  roster.forEach((p, i) => {
    let delta = 0;
    if (won)       delta += rnd(3, 7);
    else if (drew) delta += rnd(0, 2);
    else           delta -= rnd(2, 5);

    // Gol segnati in questa partita: bonus morale al marcatore
    if (p.goals > 0) delta += rnd(2, 4); // accumulati stagione, ma diamo comunque bonus

    // Minimo garantito per chi è in campo
    const wasOnField = ms.onField && Object.values(ms.onField).includes(i);
    if (wasOnField) delta += 1;

    p.morale = Math.min(100, Math.max(0, p.morale + delta));
  });
}

// ── Hook: genera offerte dopo ogni giornata ───
// Sovrascriviamo simNextRound e il hook di endMatch
const _origSimNextRound = simNextRound;
simNextRound = function() {
  _origSimNextRound();
  generateTransferOffers();
  refreshMarketPool();
  if (G.transferList && G.transferList.length) renderDash();
};
