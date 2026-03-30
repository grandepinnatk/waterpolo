// ─────────────────────────────────────────────
// canvas/pool.js — Rendering vasca + animazione
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

let _tokens = {};
let _ball   = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

// ── Inizializza token dalla formazione ────────
// Ogni token porta: posizione, nome breve, numero maglia, contatore gialli
function poolInitTokens(ms) {
  _tokens = {};
  _ball   = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const p       = ms.myRoster[pi];
    const basePos = MY_POS_MAP[pk] || { x: 0.5, y: 0.5 };
    _tokens['my_' + pk] = {
      x: basePos.x, y: basePos.y, tx: basePos.x, ty: basePos.y,
      team: 'my', pk, pi,
      posLabel: pk === 'GK' ? 'P' : pk,
      shortName: _shortName(p),
      shirt: ms.shirtNumbers[pi] || '',
      yellows: 0,
      expelled: false,
    };
  });

  Object.entries(OPP_POS).forEach(([pk, pos]) => {
    _tokens['opp_' + pk] = {
      x: pos.x, y: pos.y, tx: pos.x, ty: pos.y,
      team: 'opp', pk, pi: -1,
      posLabel: pk === 'GK' ? 'P' : pk,
      shortName: '', shirt: '', yellows: 0, expelled: false,
    };
  });
}

function _shortName(p) {
  if (!p) return '';
  // Se il nome è già nel formato "I. Cognome" (generato dal nuovo generator) restituiscilo diretto
  if (p.name && /^[A-Z]\.\s/.test(p.name)) return p.name;
  // Altrimenti: prima lettera del primo token + cognome
  const parts = p.name.split(' ');
  if (parts.length >= 2) return parts[0][0] + '. ' + parts[parts.length - 1];
  return parts[0];
}

// ── Sincronizza dati token da ms ──────────────
// Chiamato dopo ogni evento per aggiornare gialli ed espulsioni
function poolSyncTokens(ms) {
  Object.entries(ms.onField).forEach(([pk, pi]) => {
    const tok = _tokens['my_' + pk];
    if (!tok) return;
    tok.pi       = pi;
    tok.shirt    = ms.shirtNumbers[pi] || '';
    tok.shortName = _shortName(ms.myRoster[pi]);
    tok.yellows  = ms.tempExp[pi] || 0;
    tok.expelled = ms.expelled.has(pi);
    tok.posLabel  = pk === 'GK' ? 'P' : pk;
  });
}

function poolUpdateToken(key, ms) {
  const tok = _tokens[key]; if (!tok) return;
  const pk  = tok.pk;
  const pi  = ms.onField[pk];
  if (pi === undefined) { tok.expelled = true; return; }
  tok.pi        = pi;
  tok.shirt     = ms.shirtNumbers[pi] || '';
  tok.shortName = _shortName(ms.myRoster[pi]);
  tok.yellows   = ms.tempExp[pi] || 0;
  tok.expelled  = ms.expelled.has(pi);
}

function poolMoveBall(tx, ty)     { _ball.tx = tx; _ball.ty = ty; }
function poolMoveToken(key, tx, ty) { if (_tokens[key]) { _tokens[key].tx = tx; _tokens[key].ty = ty; } }
function poolResetToken(key, delay = 1800) {
  setTimeout(() => {
    if (!_tokens[key]) return;
    const pk   = _tokens[key].pk;
    const base = _tokens[key].team === 'my' ? (MY_POS_MAP[pk] || { x: 0.5, y: 0.5 }) : (OPP_POS[pk] || { x: 0.5, y: 0.5 });
    _tokens[key].tx = base.x; _tokens[key].ty = base.y;
  }, delay);
}

// ── Interpolazione frame ──────────────────────
function poolAnimStep(dt) {
  Object.values(_tokens).forEach(tok => {
    tok.x += (tok.tx - tok.x) * Math.min(dt * 3, 1);
    tok.y += (tok.ty - tok.y) * Math.min(dt * 3, 1);
  });
  _ball.x += (_ball.tx - _ball.x) * Math.min(dt * 4, 1);
  _ball.y += (_ball.ty - _ball.y) * Math.min(dt * 4, 1);
}

// ── Disegna vasca e token ─────────────────────
function drawPool(canvas, myTeamAbbr, oppTeamAbbr) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = POOL_W, H = POOL_H;

  // Sfondo
  ctx.fillStyle = '#00a0c4'; ctx.fillRect(0, 0, W, H);

  // Bordo
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  // Linea centrale
  ctx.setLineDash([10, 6]); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(10, H / 2); ctx.lineTo(W - 10, H / 2); ctx.stroke();
  ctx.setLineDash([]);

  // Archi 2m e 5m (nostra metà, basso)
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(W / 2, H + 80, H * 0.55, Math.PI + 0.35, -0.35); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,192,64,.4)';
  ctx.beginPath(); ctx.arc(W / 2, H + 20, H * 0.68, Math.PI + 0.25, -0.25); ctx.stroke();

  // Archi 2m e 5m (avversario, alto)
  ctx.strokeStyle = 'rgba(255,255,255,.5)';
  ctx.beginPath(); ctx.arc(W / 2, -80, H * 0.55, 0.35, Math.PI - 0.35); ctx.stroke();
  ctx.strokeStyle = 'rgba(240,192,64,.4)';
  ctx.beginPath(); ctx.arc(W / 2, -20, H * 0.68, 0.25, Math.PI - 0.25); ctx.stroke();

  // Porte
  const gw = 90, gh = 16;
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.5;
  ctx.strokeRect(W / 2 - gw / 2, H - gh - 4, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  ctx.fillRect(W / 2 - gw / 2, H - gh - 4, gw, gh);
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '10px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(myTeamAbbr || '', W / 2, H - gh / 2 - 4 + gh / 2);

  ctx.strokeStyle = 'rgba(231,76,60,.7)'; ctx.lineWidth = 2.5;
  ctx.strokeRect(W / 2 - gw / 2, 4, gw, gh);
  ctx.fillStyle = 'rgba(231,76,60,.12)';
  ctx.fillRect(W / 2 - gw / 2, 4, gw, gh);
  ctx.fillStyle = 'rgba(231,76,60,.5)';
  ctx.fillText(oppTeamAbbr || '', W / 2, 4 + gh / 2);

  // Corsie
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
    ctx.beginPath(); ctx.ellipse(px, py + 20, 13, 4, 0, 0, Math.PI * 2); ctx.fill();

    // Cerchio principale
    const radius = 18;
    ctx.beginPath(); ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fillStyle   = isMy ? '#185FA5' : '#8B1A1A'; ctx.fill();
    ctx.strokeStyle = isMy ? '#00c2ff' : '#e74c3c'; ctx.lineWidth = 2; ctx.stroke();

    if (isMy) {
      // Numero maglia in alto nel cerchio
      ctx.fillStyle = '#fff'; ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tok.shirt, px, py - 5);

      // Posizione in basso nel cerchio
      ctx.font = '7px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.fillText(tok.posLabel, px, py + 5);

      // Nome del giocatore affianco al pallino
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      // Sfondo semitrasparente per leggibilità
      const nameW = ctx.measureText(tok.shortName).width + 6;
      ctx.fillStyle = 'rgba(0,0,30,.55)';
      ctx.fillRect(px + radius + 3, py - 8, nameW, 16);
      ctx.fillStyle = '#fff';
      ctx.fillText(tok.shortName, px + radius + 6, py);

      // Cartellini gialli accanto al nome
      if (tok.yellows > 0) {
        const yw = 9 * tok.yellows + 2;
        const yx = px + radius + 3 + nameW + 3;
        for (let i = 0; i < tok.yellows; i++) {
          ctx.fillStyle = tok.yellows >= MAX_TEMP_EXP ? '#e74c3c' : '#f0c040';
          ctx.fillRect(yx + i * 10, py - 6, 8, 12);
        }
      }
    } else {
      // Avversario: solo etichetta posizione
      ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tok.posLabel, px, py);
    }
  });

  // ── Pallone ───────────────────────────────
  const bx = _ball.x * W, by = _ball.y * H;
  ctx.beginPath(); ctx.arc(bx, by, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#f0c040'; ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(bx, by, 5, 0, Math.PI * 2); ctx.stroke();
}
