// ─────────────────────────────────────────────
// canvas/pool.js
// Rendering vasca su Canvas HTML5 + animazione token
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

// Stato animazione (separato dallo stato partita)
let _animReq  = null;
let _lastT    = null;
let _tokens   = {}; // { key: { x, y, tx, ty, team, pk } }
let _ball     = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

// ── Inizializza i token dalla formazione ──────
function poolInitTokens(ms) {
  _tokens = {};
  _ball   = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  // Nostri giocatori
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const p       = ms.myRoster[pi];
    const basePos = MY_POS_MAP[pk] || { x: 0.5, y: 0.5 };
    _tokens['my_' + pk] = {
      x: basePos.x, y: basePos.y,
      tx: basePos.x, ty: basePos.y,
      team: 'my', pk,
      label: pk === 'GK' ? 'P' : pk,
    };
  });

  // Avversari (posizioni fisse simulate)
  Object.entries(OPP_POS).forEach(([pk, pos]) => {
    _tokens['opp_' + pk] = {
      x: pos.x, y: pos.y,
      tx: pos.x, ty: pos.y,
      team: 'opp', pk,
      label: pk === 'GK' ? 'P' : pk,
    };
  });
}

// ── Aggiorna token dopo un cambio ────────────
function poolUpdateToken(key, newLabel) {
  if (_tokens[key]) _tokens[key].label = newLabel;
}

// ── Muovi il pallone verso una destinazione ───
function poolMoveBall(tx, ty) {
  _ball.tx = tx; _ball.ty = ty;
}

// ── Muovi un token verso una destinazione ────
function poolMoveToken(key, tx, ty) {
  if (_tokens[key]) { _tokens[key].tx = tx; _tokens[key].ty = ty; }
}

// ── Riporta un token alla posizione base ──────
function poolResetToken(key, delay = 1800) {
  setTimeout(() => {
    if (!_tokens[key]) return;
    const pk = _tokens[key].pk;
    const base = _tokens[key].team === 'my'
      ? (MY_POS_MAP[pk] || { x: 0.5, y: 0.5 })
      : (OPP_POS[pk]    || { x: 0.5, y: 0.5 });
    _tokens[key].tx = base.x;
    _tokens[key].ty = base.y;
  }, delay);
}

// ── Loop di animazione principale ────────────
// Chiamato da main.js con requestAnimationFrame.
// dt: delta time in secondi.
function poolAnimStep(dt) {
  // Interpola token verso target
  Object.values(_tokens).forEach(tok => {
    tok.x += (tok.tx - tok.x) * Math.min(dt * 3, 1);
    tok.y += (tok.ty - tok.y) * Math.min(dt * 3, 1);
  });
  // Interpola pallone
  _ball.x += (_ball.tx - _ball.x) * Math.min(dt * 4, 1);
  _ball.y += (_ball.ty - _ball.y) * Math.min(dt * 4, 1);
}

// ── Disegna la vasca e tutti i token ─────────
function drawPool(canvas, myTeamAbbr, oppTeamAbbr) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = POOL_W, H = POOL_H;

  // ── Sfondo vasca ──────────────────────────
  ctx.fillStyle = '#00a0c4';
  ctx.fillRect(0, 0, W, H);

  // ── Bordo campo ───────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // ── Linea centrale (tratteggiata) ─────────
  ctx.setLineDash([10, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, H / 2); ctx.lineTo(W - 10, H / 2); ctx.stroke();
  ctx.setLineDash([]);

  // ── Arco 2m nostra metà (basso) ───────────
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W / 2, H + 80, H * 0.55, Math.PI + 0.35, -0.35); ctx.stroke();

  // ── Arco 5m nostra metà (basso) ───────────
  ctx.strokeStyle = 'rgba(240,192,64,.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W / 2, H + 20, H * 0.68, Math.PI + 0.25, -0.25); ctx.stroke();

  // ── Arco 2m metà avversario (alto) ────────
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W / 2, -80, H * 0.55, 0.35, Math.PI - 0.35); ctx.stroke();

  // ── Arco 5m metà avversario (alto) ────────
  ctx.strokeStyle = 'rgba(240,192,64,.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W / 2, -20, H * 0.68, 0.25, Math.PI - 0.25); ctx.stroke();

  // ── Porte ─────────────────────────────────
  const gw = 90, gh = 16;
  // Nostra porta (basso)
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.5;
  ctx.strokeRect(W / 2 - gw / 2, H - gh - 4, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(W / 2 - gw / 2, H - gh - 4, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '10px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(myTeamAbbr || '', W / 2, H - gh / 2 - 4 + gh / 2);

  // Porta avversario (alto)
  ctx.strokeStyle = 'rgba(231,76,60,.7)'; ctx.lineWidth = 2.5;
  ctx.strokeRect(W / 2 - gw / 2, 4, gw, gh);
  ctx.fillStyle = 'rgba(231,76,60,.12)';
  ctx.fillRect(W / 2 - gw / 2, 4, gw, gh);
  ctx.fillStyle = 'rgba(231,76,60,.5)';
  ctx.fillText(oppTeamAbbr || '', W / 2, 4 + gh / 2);

  // ── Corsie (guide visive) ─────────────────
  [0.25, 0.5, 0.75].forEach(xr => {
    ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 8]);
    ctx.beginPath(); ctx.moveTo(xr * W, 10); ctx.lineTo(xr * W, H - 10); ctx.stroke();
    ctx.setLineDash([]);
  });

  // ── Token giocatori ───────────────────────
  Object.values(_tokens).forEach(tok => {
    const px = tok.x * W, py = tok.y * H;
    const isMy = tok.team === 'my';

    // Ombra
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(px, py + 18, 13, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Cerchio
    ctx.beginPath(); ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fillStyle   = isMy ? '#185FA5' : '#8B1A1A'; ctx.fill();
    ctx.strokeStyle = isMy ? '#00c2ff' : '#e74c3c'; ctx.lineWidth = 2; ctx.stroke();

    // Etichetta posizione
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(tok.label, px, py);
  });

  // ── Pallone ───────────────────────────────
  const bx = _ball.x * W, by = _ball.y * H;
  ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c040'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  // Cucitura
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.stroke();
}
