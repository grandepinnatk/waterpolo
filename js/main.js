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

// ── Ledger finanziario ────────────────────────
// Tipi: 'vittoria' | 'pareggio' | 'ingaggi' | 'acquisto' | 'vendita'
//       'allenamento' | 'obiettivo' | 'playoff'
function addLedger(type, amount, note, round) {
  if (!G.ledger) G.ledger = [];
  G.ledger.push({
    type,
    amount,          // positivo = entrata, negativo = uscita
    note:   note || '',
    round:  round != null ? round : (currentRound ? currentRound() : 0),
    ts:     Date.now(),
  });
}

// ── Monte ingaggi ─────────────────────────────
// Somma annuale degli stipendi diviso le giornate di regular season (26).
const REGULAR_SEASON_ROUNDS = 26;
// Aggiorna il box stelle in topbar
function _updateStarsBox() {
  const el = document.getElementById('bs-stars-val');
  if (el && G) el.textContent = G.stars || 0;
}

function calcWageBill() {
  if (!G.rosters || !G.myId) return 0;
  const total = (G.rosters[G.myId] || []).reduce((s, p) => s + (p.salary || 0), 0);
  return Math.round(total / REGULAR_SEASON_ROUNDS);
}

function currentRound() {
  if (!G.schedule) return 0;
  // Giornata dell'ultima partita DELLA MIA SQUADRA giocata
  const myPlayed = G.schedule.filter(m =>
    m.played && (m.home === G.myId || m.away === G.myId)
  );
  return myPlayed.length ? Math.max(...myPlayed.map(m => m.round)) : 0;
}

// Giornata della prossima partita della mia squadra (round minimo non giocato)
function nextMyRound() {
  if (!G.schedule) return 1;
  const notPlayed = G.schedule.filter(m =>
    !m.played && (m.home === G.myId || m.away === G.myId)
  );
  if (!notPlayed.length) return null;
  return Math.min(...notPlayed.map(m => m.round));
}

// Prossima partita della mia squadra (oggetto match)
function nextMyMatch() {
  if (!G.schedule) return null;
  const r = nextMyRound();
  if (!r) return null;
  return G.schedule.find(m =>
    !m.played && (m.home === G.myId || m.away === G.myId) && m.round === r
  );
}

// ── Auto-save ─────────────────────────────────
function autoSave() {
  if (G && G.myId) autoSaveToCurrentSlot(G);
}

// ── Simulazione rapida giornata ───────────────
function confirmSimNextRound() {
  const ov = document.createElement('div');
  ov.id = 'sim-confirm-popup';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;z-index:500;backdrop-filter:blur(6px)';
  ov.innerHTML = `
    <div style="background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:24px;max-width:380px;width:90%;text-align:center">
      <div style="font-size:22px;margin-bottom:12px">⏩</div>
      <div style="font-weight:700;font-size:15px;margin-bottom:10px;color:var(--text)">Simula Giornata</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;line-height:1.6">
        Hai selezionato di simulare la giornata senza giocare la partita.<br>
        <strong style="color:var(--text)">Confermi la selezione?</strong>
      </div>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn primary" style="padding:10px 28px;font-size:14px"
          onclick="document.getElementById('sim-confirm-popup').remove();simNextRound()">
          Sì
        </button>
        <button class="btn" style="padding:10px 28px;font-size:14px"
          onclick="document.getElementById('sim-confirm-popup').remove()">
          No
        </button>
      </div>
    </div>`;
  document.body.appendChild(ov);
}

// Genera voti simulati per la rosa dopo una partita simulata.
// matchDetails: l'oggetto m.details con { home/away: [{name, goals, assists}] }
// scorerKey: 'home' o 'away' secondo se la mia squadra giocava in casa o fuori
// goalsConceded: gol subiti dalla mia squadra
function _assignSimulatedRatings(roster, goalsConceded, matchDetails, scorerKey) {
  if (!roster) return;

  // Mappa nome → { goals, assists } dai details della partita simulata
  const matchMap = {};
  if (matchDetails && scorerKey && matchDetails[scorerKey]) {
    matchDetails[scorerKey].forEach(s => {
      matchMap[s.name] = { goals: s.goals || 0, assists: s.assists || 0 };
    });
  }

  roster.forEach(p => {
    if (!p) return;
    let rating;

    if (p.role === 'POR') {
      // Portiere: voto basato su gol subiti e parate stimate
      const estSaves = Math.max(0, Math.round(goalsConceded * 0.5 + Math.random() * 1.5));
      rating = 6.0 + estSaves * 0.4 - goalsConceded * 0.3;
      if (goalsConceded === 0)      rating += 1.0;
      else if (goalsConceded <= 3)  rating += 0.3;
    } else {
      // Giocatori di movimento: gol/assist dalla partita + ruolo + piccola varianza
      const contrib  = matchMap[p.name] || { goals: 0, assists: 0 };
      const roleBase = p.role === 'ATT' ? 0.2 : p.role === 'CB' ? 0.15 : p.role === 'CEN' ? 0.1 : 0;
      rating = 6.0
        + contrib.goals   * 1.5
        + contrib.assists  * 0.8
        + roleBase
        + (Math.random() * 0.6 - 0.3); // varianza ±0.3
    }

    rating = Math.max(3.0, Math.min(10.0, rating));
    rating = Math.round(rating * 2) / 2;
    if (!p.lastRatings) p.lastRatings = [];
    p.lastRatings.push(rating);
    if (p.lastRatings.length > 4) p.lastRatings.shift();
  });
}

// Segna null (= non ha giocato) per i giocatori della rosa NON inclusi nella partita simulata.
// Per la simulazione tutti giocano, quindi non serve qui — ma teniamo il hook per futura convocazione.
// Al momento _assignSimulatedRatings assegna un voto a tutti.

function simNextRound() {
  const r = nextMyRound();
  if (!r) { G.msgs.push('Nessuna giornata rimanente.'); renderDash(); return; }

  // Salva posizione attuale PRIMA di aggiornare la classifica
  G.prevPos = getTeamPosition(G.stand, G.myId);

  // Simula TUTTE le partite della giornata, inclusa quella della mia squadra
  const roundMatches = G.schedule.filter(m => m.round === r && !m.played);
  roundMatches.forEach(m => {
    const hT = G.teams.find(t => t.id === m.home);
    const aT = G.teams.find(t => t.id === m.away);
    m.score  = simulateResult(hT, aT);
    m.played = true;
    updateStandings(G.stand, m.home, m.away, m.score);

    // Distribuisce gol/assist a TUTTI i giocatori (inclusa la nostra squadra)
    // e salva i dettagli (marcatori + parziali) sul match
    const det = simulateMatchStats(G.rosters[m.home], G.rosters[m.away], m.score);
    if (det) m.details = det;

    // Se è la partita della mia squadra, registra risultato e premi
    if (m.home === G.myId || m.away === G.myId) {
      const ih      = m.home === G.myId;
      const opp     = G.teams.find(t => t.id === (ih ? m.away : m.home));
      const myScore = ih ? m.score.home : m.score.away;
      const opScore = ih ? m.score.away : m.score.home;
      const res     = myScore > opScore ? 'VINCE' : myScore < opScore ? 'perde' : 'pareggia';
      const reward  = myScore > opScore ? getMatchReward(myScore, opScore) : 0;
      if (reward) {
        G.budget += reward;
        const tipo = myScore > opScore ? 'vittoria' : 'pareggio';
        addLedger(tipo, reward, `G${r}: ${G.myTeam.name} vs ${opp.name} (${myScore}-${opScore})`, r);
      }
      G.msgs.push(`G${r}: ${G.myTeam.name} ${res} vs ${opp.name} (${myScore}-${opScore})` +
                  (reward ? ` +${formatMoney(reward)}` : ''));

      // Genera voti simulati per i giocatori della mia rosa
      const _sk = ih ? 'home' : 'away';
      _assignSimulatedRatings(G.rosters[G.myId], opScore, m.details, _sk);
    }
  });

  // ── Deduzione monte ingaggi (solo regular season) ──
  if (G.phase === 'regular') {
    const wage = calcWageBill();
    if (wage > 0) {
      G.budget -= wage;
      addLedger('ingaggi', -wage, `Monte ingaggi G${r}`, r);
      G.msgs.push(`💸 Ingaggi G${r}: -${formatMoney(wage)}`);
    }
  }

  // +4 stelle per giornata
  if (G.stars !== undefined) G.stars = (G.stars || 0) + 4;
  refreshMarketPool();
  generateTransferOffers();
  updateHeader(); autoSave(); renderDash();
  _updateStarsBox();
}

function simEntireSeason() {
  simulateAllRemaining(G.schedule, G.stand, G.teams, G.myId, G.rosters);
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
  if (reward) addLedger('obiettivo', reward, 'Bonus obiettivi fine stagione', currentRound());
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
    entry.offerResult       = accepted ? 'accepted' : 'rejected';
    entry.offerResultAmount = offer;
    entry.pendingOffer      = null; // sempre azzerata dopo la risposta

    if (accepted) {
      G.msgs.push(`✅ Offerta accettata! ${p._tname} accetta ${formatMoney(offer)} per ${p.name}. Vai al Mercato per concludere l'acquisto.`);
    } else if (offer < minAcc) {
      G.msgs.push(`❌ Offerta rifiutata: ${p._tname} ha respinto ${formatMoney(offer)} per ${p.name} (troppo bassa).`);
    } else {
      G.msgs.push(`❌ Offerta rifiutata: ${p._tname} ha risposto di no a ${formatMoney(offer)} per ${p.name}.`);
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
  addLedger('vendita', offer.amount, `Venduto ${p.name} a ${offer.teamName}`, currentRound());

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
