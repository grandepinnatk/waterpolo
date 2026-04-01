// ─────────────────────────────────────────────
// canvas/pool.js — Campo orizzontale (porte sx/dx)
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

// ── Confini del campo sull'immagine (orientamento orizzontale) ────
// Porte: sinistra (nostra) x≈0.03  porta destra (avversario) x≈0.97
// Corsie verticali definiscono l'altezza di gioco y:[0.13, 0.87]
const PLAY = {
  x0: 0.05,  x1: 0.95,   // limiti orizzontali (tra le porte)
  y0: 0.13,  y1: 0.87,   // limiti verticali (corde laterali)
  cx: 0.50,  cy: 0.50,   // centro vasca
  // Porte (asse X)
  myGoalX:    0.04,       // porta nostra (sinistra)
  oppGoalX:   0.96,       // porta avversario (destra)
  // Larghezza porta (asse Y normalizzato)
  goalY0:     0.38,
  goalY1:     0.62,
  // Linee 2m e 5m
  my2mX:      0.18,
  my5mX:      0.30,
  opp2mX:     0.82,
  opp5mX:     0.70,
};

// ── Posizioni tattiche (campo orizzontale) ─────
// Nostra squadra attacca verso DESTRA (porta avversario)
// x piccolo = vicino nostra porta  |  x grande = vicino porta avv
const ATK_POS = {           // Nostri in attacco
  GK:  { x: 0.06, y: 0.50 },
  '1': { x: 0.78, y: 0.22 }, // ala alta dx
  '2': { x: 0.62, y: 0.38 }, // difensore dx avanzato
  '3': { x: 0.55, y: 0.58 }, // attaccante centro
  '4': { x: 0.62, y: 0.70 }, // difensore sx avanzato
  '5': { x: 0.78, y: 0.82 }, // ala bassa dx
  '6': { x: 0.88, y: 0.50 }, // centroboa sotto porta avv
};
const DEF_POS = {           // Nostri in difesa
  GK:  { x: 0.06, y: 0.50 },
  '1': { x: 0.28, y: 0.22 },
  '2': { x: 0.36, y: 0.35 },
  '3': { x: 0.40, y: 0.50 },
  '4': { x: 0.36, y: 0.65 },
  '5': { x: 0.28, y: 0.78 },
  '6': { x: 0.50, y: 0.50 },
};
const OPP_ATK = {           // Avversario in attacco (verso sinistra)
  GK:  { x: 0.94, y: 0.50 },
  '1': { x: 0.22, y: 0.78 },
  '2': { x: 0.38, y: 0.62 },
  '3': { x: 0.45, y: 0.42 },
  '4': { x: 0.38, y: 0.30 },
  '5': { x: 0.22, y: 0.18 },
  '6': { x: 0.12, y: 0.50 },
};
const OPP_DEF = {           // Avversario in difesa
  GK:  { x: 0.94, y: 0.50 },
  '1': { x: 0.72, y: 0.78 },
  '2': { x: 0.64, y: 0.65 },
  '3': { x: 0.60, y: 0.50 },
  '4': { x: 0.64, y: 0.35 },
  '5': { x: 0.72, y: 0.22 },
  '6': { x: 0.50, y: 0.50 },
};

// ── Stato ────────────────────────────────────
var _tokens  = {};
var _ball    = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _bgImg   = null;
var _bgReady = false;
var _phase   = 'play';   // 'sprint' | 'play' | 'goal'
var _attack  = 'my';
var _sprintT = 0;
var _microT  = 0;
var _goalAnim = null;    // { timer, scorer, team, cx, cy }

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
function _shortName(p)     { return (p && p.name) ? p.name : ''; }

function _jitter(pos, amp) {
  amp = amp || 0.025;
  return {
    x: _clamp(pos.x + _rnd(-amp, amp), PLAY.x0 + 0.02, PLAY.x1 - 0.02),
    y: _clamp(pos.y + _rnd(-amp, amp), PLAY.y0 + 0.02, PLAY.y1 - 0.02),
  };
}

// ── API pubblica ──────────────────────────────
function poolInitTokens(ms) {
  _tokens  = {};
  _ball    = { x: PLAY.cx, y: PLAY.cy, tx: PLAY.cx, ty: PLAY.cy };
  _phase   = 'sprint';
  _attack  = 'my';
  _sprintT = 0;
  _goalAnim = null;

  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1];
    var p = ms.myRoster[pi];
    _tokens['my_' + pk] = {
      x: PLAY.cx - 0.06 + _rnd(-0.06, 0.06),
      y: PLAY.cy + _rnd(-0.08, 0.08),
      tx: PLAY.cx - 0.04, ty: PLAY.cy,
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
      x: PLAY.cx + 0.06 + _rnd(-0.06, 0.06),
      y: PLAY.cy + _rnd(-0.08, 0.08),
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
  // Chi attacca: se palla è nella metà destra → nostra squadra attacca
  _attack = tx > PLAY.cx ? 'my' : 'opp';
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

// ── Scatto inizio periodo ─────────────────────
function poolStartPeriod() {
  _phase   = 'sprint';
  _sprintT = 0;
  _ball.tx = PLAY.cx;
  _ball.ty = PLAY.cy;
  Object.values(_tokens).forEach(function(tok) {
    var xOff = tok.team === 'my' ? -0.06 : 0.06;
    tok.tx = PLAY.cx + xOff + _rnd(-0.08, 0.08);
    tok.ty = PLAY.cy + _rnd(-0.10, 0.10);
  });
}

// ── Animazione GOAL ───────────────────────────
// scorer: nome marcatore, team: 'my'|'opp'
function poolShowGoal(scorer, team) {
  _goalAnim = {
    timer:  0,
    total:  2.2,      // durata animazione secondi
    scorer: scorer || '',
    team:   team || 'my',
  };
  _phase = 'goal';
  // La squadra che ha subito torna al centro
  _returnToCenter(team === 'my' ? 'opp' : 'my');
  // Palla torna al centro (rimessa)
  setTimeout(function() {
    _ball.tx = PLAY.cx;
    _ball.ty = PLAY.cy;
  }, 1200);
  setTimeout(function() {
    _phase = 'play';
    _triggerTactical();
  }, 2400);
}

function _returnToCenter(team) {
  // La squadra che subisce torna al centrocampo per la rimessa
  Object.values(_tokens).forEach(function(tok) {
    if (tok.team !== team) return;
    tok.tx = PLAY.cx + (team === 'my' ? -0.05 : 0.05) + _rnd(-0.12, 0.12);
    tok.ty = PLAY.cy + _rnd(-0.15, 0.15);
  });
}

// ── Logica tattica ────────────────────────────
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

// Portieri seguono la palla sullo specchio della porta (asse Y)
function _updateKeepers() {
  var by = _ball.y;
  var myGK = _tokens['my_GK'];
  if (myGK && !myGK.expelled) {
    myGK.tx = PLAY.myGoalX;
    myGK.ty = _clamp(by, PLAY.goalY0 + 0.04, PLAY.goalY1 - 0.04);
  }
  var oppGK = _tokens['opp_GK'];
  if (oppGK) {
    oppGK.tx = PLAY.oppGoalX;
    oppGK.ty = _clamp(by, PLAY.goalY0 + 0.04, PLAY.goalY1 - 0.04);
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

// ── Step animazione ───────────────────────────
function poolAnimStep(dt) {
  var f = Math.min(dt, 0.1);

  if (_phase === 'sprint') {
    _sprintT += dt;
    if (_sprintT > 1.4) {
      _phase  = 'play';
      _attack = Math.random() < 0.5 ? 'my' : 'opp';
      _triggerTactical();
    }
  } else if (_phase === 'goal') {
    if (_goalAnim) {
      _goalAnim.timer += dt;
      if (_goalAnim.timer >= _goalAnim.total) _goalAnim = null;
    }
  } else {
    _updateKeepers();
    _microMovements(dt);
  }

  Object.values(_tokens).forEach(function(tok) {
    tok.x += (tok.tx - tok.x) * Math.min(f * 2.4, 1);
    tok.y += (tok.ty - tok.y) * Math.min(f * 2.4, 1);
  });
  _ball.x += (_ball.tx - _ball.x) * Math.min(f * 3.8, 1);
  _ball.y += (_ball.ty - _ball.y) * Math.min(f * 3.8, 1);
}

// ── Disegno ───────────────────────────────────
function drawPool(canvas, myTeamAbbr, oppTeamAbbr) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = POOL_W, H = POOL_H;

  // 1. Sfondo
  if (_bgReady && _bgImg) {
    ctx.drawImage(_bgImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#1a7fa0';
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Token giocatori
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

    // Cerchio: bianco (ns) o blu (avv)
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);
    if (isMy) {
      ctx.fillStyle   = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#444444';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    } else {
      ctx.fillStyle   = '#1565C0';
      ctx.fill();
      ctx.strokeStyle = '#00c2ff';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    // Cartellini gialli (sopra il cerchio)
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
      ctx.fillStyle = '#666';
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
      ctx.fillStyle = 'rgba(0,0,0,0.58)';
      _pill(ctx, px - tw / 2, py + R + 3, tw, 14, 4);
      ctx.fill();
      ctx.fillStyle    = '#fff';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tok.shortName, px, py + R + 3 + 7);
    }
  });

  // 3. Pallone
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
  g.addColorStop(1, '#f9a825');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#c17900'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, by, 6, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by, 6, Math.PI + 0.4, -0.4); ctx.stroke();

  // 4. Animazione GOAL!!!
  if (_goalAnim) {
    var t = _goalAnim.timer / _goalAnim.total; // 0→1
    var pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 6));
    var alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Overlay semitrasparente
    ctx.fillStyle = _goalAnim.team === 'my'
      ? 'rgba(0, 80, 20, 0.45)'
      : 'rgba(80, 0, 0, 0.45)';
    ctx.fillRect(0, 0, W, H);

    // Testo GOAL!!!
    var fontSize = Math.round(72 + pulse * 20);
    ctx.font      = 'bold ' + fontSize + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Ombra testo
    ctx.shadowColor   = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 3;

    // Colore: giallo per ns gol, rosso per gol subito
    ctx.fillStyle = _goalAnim.team === 'my' ? '#fdd835' : '#ff5252';
    ctx.fillText('GOAL!!!', W / 2, H / 2 - 24);

    // Marcatore sotto
    ctx.shadowBlur = 6;
    ctx.font       = 'bold 22px sans-serif';
    ctx.fillStyle  = '#fff';
    ctx.fillText(_goalAnim.scorer, W / 2, H / 2 + 30);

    // Ripresa dal centro
    ctx.font      = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Rimessa dal centrocampo', W / 2, H / 2 + 62);

    ctx.restore();
  }
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
