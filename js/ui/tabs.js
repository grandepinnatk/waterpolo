// ─────────────────────────────────────────────
// ui/tabs.js
// Navigazione tra i tab del gioco principale
// ─────────────────────────────────────────────

const TAB_IDS = ['dash','rosa','train','goals','stand','cal','playoff','market','finance','credits'];

// ── Mostra un tab e nasconde gli altri ────────
function showTab(tab) {
  TAB_IDS.forEach(t => {
    document.getElementById('tab-' + t).style.display = t === tab ? 'block' : 'none';
  });

  // Vecchi .nb (retrocompatibilità)
  document.querySelectorAll('.nb').forEach(b => {
    const active = b.getAttribute('onclick')?.includes("'" + tab + "'") ?? false;
    b.classList.toggle('active', active);
  });
  // Nuovi pulsanti sidebar BS
  document.querySelectorAll('.bs-nav-btn').forEach(b => {
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
  const infoEl = document.getElementById('hdr-info');
  if (infoEl) infoEl.textContent = phaseLabel + ' · ' + formatMoney(G.budget);
  // Aggiorna stelle nella topbar
  const starsEl = document.getElementById('bs-stars-val');
  if (starsEl && G) starsEl.textContent = G.stars || 0;
}

// ── Mostra/nasconde le schermate principali ───
// Ogni schermata ha il proprio display corretto (flex per quelle centrate)
const SCREEN_DISPLAY = {
  'sc-welcome': 'flex',
  'sc-game':    'flex',   // flex column — necessario per il layout sidebar fisso
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
