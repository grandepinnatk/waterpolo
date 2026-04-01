// ─────────────────────────────────────────────
// ui/tabs.js
// Navigazione tra i tab del gioco principale
// ─────────────────────────────────────────────

const TAB_IDS = ['dash','rosa','train','goals','stand','cal','playoff','market','finance'];

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
    finance: renderFinance,
    credits: renderCredits,
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
// Ogni schermata ha il proprio display corretto (flex per quelle centrate)
const SCREEN_DISPLAY = {
  'sc-welcome': 'flex',
  'sc-game':    'block',
  'sc-lineup':  'block',
  'sc-match':   'block',
};
function showScreen(id) {
  Object.keys(SCREEN_DISPLAY).forEach(s => {
    const el = document.getElementById(s);
    if (!el) return;
    el.style.display = s === id ? SCREEN_DISPLAY[s] : 'none';
  });
}
