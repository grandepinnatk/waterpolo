// ─────────────────────────────────────────────
// canvas/pool.js — Vasca con immagine reale + animazione pallanuoto
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

// ── Confini di gioco mappati sull'immagine ────
const PLAY = {
  x0: 0.10, x1: 0.90,
  y0: 0.13, y1: 0.87,
  cx: 0.50, cy: 0.50,
  myGoalY:  0.87,
  oppGoalY: 0.13,
  goalX0:   0.38,
  goalX1:   0.62,
};

// ── Posizioni tattiche ─────────────────────────
// Nostri in attacco (verso porta avversaria, alto)
const ATK_POS = {
  GK:  { x: 0.50, y: 0.87 },
  '1': { x: 0.84, y: 0.32 },
  '2': { x: 0.72, y: 0.44 },
  '3': { x: 0.50, y: 0.52 },
  '4': { x: 0.28, y: 0.44 },
  '5': { x: 0.16, y: 0.32 },
  '6': { x: 0.50, y: 0.22 },
};
// Nostri in difesa
const DEF_POS = {
  GK:  { x: 0.50, y: 0.87 },
  '1': { x: 0.82, y: 0.70 },
  '2': { x: 0.70, y: 0.76 },
  '3': { x: 0.50, y: 0.72 },
  '4': { x: 0.30, y: 0.76 },
  '5': { x: 0.18, y: 0.70 },
  '6': { x: 0.50, y: 0.60 },
};
// Avversario in attacco (verso nostra porta, basso)
const OPP_ATK = {
  GK:  { x: 0.50, y: 0.13 },
  '1': { x: 0.16, y: 0.68 },
  '2': { x: 0.28, y: 0.56 },
  '3': { x: 0.50, y: 0.48 },
  '4': { x: 0.72, y: 0.56 },
  '5': { x: 0.84, y: 0.68 },
  '6': { x: 0.50, y: 0.78 },
};
// Avversario in difesa
const OPP_DEF = {
  GK:  { x: 0.50, y: 0.13 },
  '1': { x: 0.84, y: 0.32 },
  '2': { x: 0.72, y: 0.24 },
  '3': { x: 0.50, y: 0.28 },
  '4': { x: 0.28, y: 0.24 },
  '5': { x: 0.16, y: 0.32 },
  '6': { x: 0.50, y: 0.40 },
};

// ── Stato ────────────────────────────────────
let _tokens = {};
let _ball   = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
let _bgImg  = null;
let _bgReady = false;
let _phase  = 'play';
let _attack = 'my';
let _sprintT = 0;
let _microT  = 0;

// ── Carica sfondo ─────────────────────────────
(function() {
  var img = new Image();
  img.onload  = function() { _bgImg = img; _bgReady = true; };
  img.onerror = function() { _bgReady = false; };
  img.src = 'campo-per-pallanuoto.jpg';
})();

// ── Helpers ───────────────────────────────────
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _rnd(lo, hi)      { return lo + Math.random() * (hi - lo); }

function _shortName(p) { return (p && p.name) ? p.name : ''; }

function _jitter(pos, amp) {
  amp = amp || 0.025;
  return {
    x: _clamp(pos.x + _rnd(-amp, amp), PLAY.x0 + 0.02, PLAY.x1 - 0.02),
    y: _clamp(pos.y + _rnd(-amp, amp), PLAY.y0 + 0.02, PLAY.y1 - 0.02),
  };
}

// ── API pubblica ──────────────────────────────
function poolInitTokens(ms) {
  _tokens = {};
  _ball   = { x: PLAY.cx, y: PLAY.cy, tx: PLAY.cx, ty: PLAY.cy };
  _phase  = 'sprint';
  _attack = 'my';
  _sprintT = 0;

  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1];
    var p = ms.myRoster[pi];
    _tokens['my_' + pk] = {
      x: PLAY.cx + _rnd(-0.08, 0.08),
      y: PLAY.cy + 0.04 + _rnd(-0.03, 0.03),
      tx: PLAY.cx, ty: PLAY.cy + 0.04,
      team: 'my', pk: pk, pi: pi,
      posLabel: pk === 'GK' ? 'P' : pk,
      shortName: _shortName(p),
      shirt: ms.shirtNumbers[pi] || '',
      yellows: 0, expelled: false,
    };
  });

  Object.keys(OPP_DEF).forEach(function(pk) {
    var pos = OPP_DEF[pk];
    _tokens['opp_' + pk] = {
      x: PLAY.cx + _rnd(-0.08, 0.08),
      y: PLAY.cy - 0.04 + _rnd(-0.03, 0.03),
      tx: pos.x, ty: pos.y,
      team: 'opp', pk: pk, pi: -1,
      posLabel: pk === 'GK' ? 'P' : pk,
      shortName: '', shirt: '', yellows: 0, expelled: false,
    };
  });
}

function poolSyncTokens(ms) {
  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1];
    var tok = _tokens['my_' + pk]; if (!tok) return;
    tok.pi        = pi;
    tok.shirt     = ms.shirtNumbers[pi] || '';
    tok.shortName = _shortName(ms.myRoster[pi]);
    tok.yellows   = ms.tempExp[pi] || 0;
    tok.expelled  = ms.expelled.has(pi);
    tok.posLabel  = pk === 'GK' ? 'P' : pk;
  });
}

function poolUpdateToken(key, ms) {
  var tok = _tokens[key]; if (!tok) return;
  var pk = tok.pk;
  var pi = ms.onField[pk];
  if (pi === undefined) { tok.expelled = true; return; }
  tok.pi        = pi;
  tok.shirt     = ms.shirtNumbers[pi] || '';
  tok.shortName = _shortName(ms.myRoster[pi]);
  tok.yellows   = ms.tempExp[pi] || 0;
  tok.expelled  = ms.expelled.has(pi);
}

function poolMoveBall(tx, ty) {
  _ball.tx = _clamp(tx, PLAY.x0, PLAY.x1);
  _ball.ty = _clamp(ty, PLAY.y0, PLAY.y1);
  _attack  = ty < PLAY.cy ? 'my' : 'opp';
  _triggerTactical();
}

function poolMoveToken(key, tx, ty) {
  if (!_tokens[key]) return;
  _tokens[key].tx = _clamp(tx, PLAY.x0 + 0.01, PLAY.x1 - 0.01);
  _tokens[key].ty = _clamp(ty, PLAY.y0 + 0.01, PLAY.y1 - 0.01);
}

function poolResetToken(key, delay) {
  delay = delay || 1800;
  setTimeout(function() {
    var tok = _tokens[key]; if (!tok) return;
    var pk = tok.pk;
    var base = tok.team === 'my'
      ? (_attack === 'my' ? ATK_POS[pk] : DEF_POS[pk])
      : (_attack === 'opp' ? OPP_ATK[pk] : OPP_DEF[pk]);
    if (base) { var j = _jitter(base, 0.03); tok.tx = j.x; tok.ty = j.y; }
  }, delay);
}

// Chiamata dall'engine match all'inizio di ogni periodo
function poolStartPeriod() {
  _phase   = 'sprint';
  _sprintT = 0;
  _ball.tx = PLAY.cx;
  _ball.ty = PLAY.cy;
  Object.values(_tokens).forEach(function(tok) {
    var yOff = tok.team === 'my' ? 0.05 : -0.05;
    tok.tx = PLAY.cx + _rnd(-0.10, 0.10);
    tok.ty = PLAY.cy + yOff + _rnd(-0.03, 0.03);
  });
}

// ── Logica interna ────────────────────────────
function _triggerTactical() {
  ['1','2','3','4','5','6','GK'].forEach(function(pk) {
    var myTok  = _tokens['my_'  + pk];
    var oppTok = _tokens['opp_' + pk];
    if (myTok && !myTok.expelled) {
      var base = _attack === 'my' ? ATK_POS[pk] : DEF_POS[pk];
      if (base) { var j = _jitter(base, 0.03); myTok.tx = j.x; myTok.ty = j.y; }
    }
    if (oppTok) {
      var base2 = _attack === 'opp' ? OPP_ATK[pk] : OPP_DEF[pk];
      if (base2) { var j2 = _jitter(base2, 0.03); oppTok.tx = j2.x; oppTok.ty = j2.y; }
    }
  });
}

function _updateKeepers() {
  var bx = _ball.x;
  var myGK = _tokens['my_GK'];
  if (myGK && !myGK.expelled) {
    myGK.tx = _clamp(bx, PLAY.goalX0 + 0.03, PLAY.goalX1 - 0.03);
    myGK.ty = PLAY.myGoalY;
  }
  var oppGK = _tokens['opp_GK'];
  if (oppGK) {
    oppGK.tx = _clamp(bx, PLAY.goalX0 + 0.03, PLAY.goalX1 - 0.03);
    oppGK.ty = PLAY.oppGoalY;
  }
}

function _microMovements(dt) {
  _microT += dt;
  if (_microT < 1.6) return;
  _microT = 0;
  Object.values(_tokens).forEach(function(tok) {
    if (tok.expelled || tok.pk === 'GK') return;
    tok.tx = _clamp(tok.tx + _rnd(-0.022, 0.022), PLAY.x0 + 0.02, PLAY.x1 - 0.02);
    tok.ty = _clamp(tok.ty + _rnd(-0.018, 0.018), PLAY.y0 + 0.02, PLAY.y1 - 0.02);
  });
}

function poolAnimStep(dt) {
  var f = Math.min(dt, 0.1);

  if (_phase === 'sprint') {
    _sprintT += dt;
    if (_sprintT > 1.4) {
      _phase   = 'play';
      _attack  = Math.random() < 0.5 ? 'my' : 'opp';
      _triggerTactical();
    }
  } else {
    _updateKeepers();
    _microMovements(dt);
  }

  Object.values(_tokens).forEach(function(tok) {
    tok.x += (tok.tx - tok.x) * Math.min(f * 2.2, 1);
    tok.y += (tok.ty - tok.y) * Math.min(f * 2.2, 1);
  });
  _ball.x += (_ball.tx - _ball.x) * Math.min(f * 3.5, 1);
  _ball.y += (_ball.ty - _ball.y) * Math.min(f * 3.5, 1);
}

// ── Disegno ───────────────────────────────────
function drawPool(canvas, myTeamAbbr, oppTeamAbbr) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = POOL_W, H = POOL_H;

  // Sfondo
  if (_bgReady && _bgImg) {
    ctx.drawImage(_bgImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#1a7fa0';
    ctx.fillRect(0, 0, W, H);
  }

  // Token
  Object.values(_tokens).forEach(function(tok) {
    if (tok.expelled) return;
    var px = tok.x * W, py = tok.y * H;
    var isMy = tok.team === 'my';
    var R = 18;

    // Ombra
    ctx.save();
    ctx.globalAlpha = 0.20;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(px + 2, py + 3, R, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Cerchio
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    if (isMy) {
      ctx.fillStyle   = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#444';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    } else {
      ctx.fillStyle   = '#1565C0';
      ctx.fill();
      ctx.strokeStyle = '#00c2ff';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    // Cartellini gialli
    if (isMy && tok.yellows > 0) {
      for (var i = 0; i < tok.yellows; i++) {
        ctx.fillStyle = (tok.yellows >= MAX_TEMP_EXP) ? '#e74c3c' : '#f0c040';
        ctx.fillRect(px - 7 + i * 9, py - R - 9, 7, 10);
      }
    }

    // Testo nel cerchio
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (isMy) {
      ctx.fillStyle = '#111';
      ctx.font      = 'bold 10px sans-serif';
      ctx.fillText(tok.shirt, px, py - 3);
      ctx.fillStyle = '#555';
      ctx.font      = '7px sans-serif';
      ctx.fillText(tok.posLabel, px, py + 6);
    } else {
      ctx.fillStyle = '#b3d9ff';
      ctx.font      = 'bold 11px sans-serif';
      ctx.fillText(tok.posLabel, px, py);
    }

    // Nome sotto cerchio (solo nostra squadra)
    if (isMy && tok.shortName) {
      ctx.font = 'bold 9px sans-serif';
      var tw = ctx.measureText(tok.shortName).width + 8;
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      _pill(ctx, px - tw/2, py + R + 3, tw, 14, 4);
      ctx.fill();
      ctx.fillStyle    = '#fff';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tok.shortName, px, py + R + 3 + 7);
    }
  });

  // Pallone
  var bx = _ball.x * W, by = _ball.y * H;
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(bx + 2, by + 4, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(bx, by, 9, 0, Math.PI * 2);
  var g = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 9);
  g.addColorStop(0, '#fff9c4');
  g.addColorStop(0.55, '#fdd835');
  g.addColorStop(1,    '#f9a825');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#c17900';
  ctx.lineWidth   = 1.5;
  ctx.stroke();
  // Striscia
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(bx, by, 6, 0.4, Math.PI - 0.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx, by, 6, Math.PI + 0.4, -0.4);
  ctx.stroke();
}

function _pill(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h,     x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y,         x + r, y);
  ctx.closePath();
}
