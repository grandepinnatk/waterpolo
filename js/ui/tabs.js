// ─────────────────────────────────────────────
// ui/tabs.js
// Navigazione tra i tab del gioco principale
// ─────────────────────────────────────────────

const TAB_IDS = ['dash','rosa','train','goals','stand','cal','playoff','market'];

// ── Mostra un tab e nasconde gli altri ────────
function showTab(tab) {
  TAB_IDS.forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });

  document.querySelectorAll('.nb').forEach(b => {
    const active = b.getAttribute('onclick')?.includes("'" + tab + "'") ?? false;
    b.classList.toggle('active', active);
  });

  // Renderizza il contenuto del tab attivo
  const renderers = {
    dash:    renderDash,
    rosa:    renderRosa,
    train:   renderTrain,
    goals:   renderGoals,
    stand:   renderStand,
    cal:     renderCal,
    playoff: renderPlayoff,
    market:  renderMarket,
  };
  if (renderers[tab]) renderers[tab]();
}

// ── Aggiorna header (team + fase + budget) ────
function updateHeader() {
  document.getElementById('hdr-team').textContent = G.myTeam.name;
  const phaseLabel = {
    regular: `G${Math.min(currentRound() + 1, 26)} Regular Season`,
    playoff: 'PLAYOFF',
    playout: 'PLAY-OUT',
    done:    'Fine Stagione',
  }[G.phase] || G.phase;
  document.getElementById('hdr-info').textContent = phaseLabel + ' · ' + formatMoney(G.budget);
}

// ── Mostra/nasconde le schermate principali ───
function showScreen(id) {
  ['sc-welcome','sc-game','sc-lineup','sc-match'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = s === id ? 'block' : 'none';
  });
}
