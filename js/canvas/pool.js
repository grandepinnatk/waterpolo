// ─────────────────────────────────────────────
// canvas/pool.js — Pallanuoto realistica
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

// ── Geometria del campo (rilevata dall'immagine cartoon) ──────────
// Campo giocabile: x[0.10, 0.90]  y[0.12, 0.88]
// Porte: a SINISTRA (nostra, x≈0.08) e DESTRA (avversario, x≈0.92)
// L'immagine mostra la porta a circa x=0.08 con vertici y[0.37, 0.63]
const PLAY = {
  x0: 0.10,  x1: 0.90,      // limiti campo orizzontali
  y0: 0.12,  y1: 0.88,      // limiti campo verticali
  cx: 0.50,  cy: 0.50,      // centro vasca

  // Porta nostra (sinistra)
  myGoalX:  0.08,
  myGoalY0: 0.38,  myGoalY1: 0.62,   // altezza porta

  // Porta avversario (destra)
  oppGoalX:  0.92,
  oppGoalY0: 0.38,  oppGoalY1: 0.62,

  // Area portiere: può muoversi verticalmente tra goalY0 e goalY1
  // e orizzontalmente tra goalX e la linea dei 2m
  my2mX:  0.20,    // linea 2m nostra metà
  opp2mX: 0.80,    // linea 2m avversario

  // Area di vincolo orizzontale del portiere (X fissa vicino alla porta)
  myGKminX:  0.07, myGKmaxX:  0.13,
  oppGKminX: 0.87, oppGKmaxX: 0.93,
};

// ── Posizioni inizio tempo (dai bordi verso il centro) ────────────
// Dalla foto "inizio-di-ogni-tempo": nostra squadra schierata a SX
// in verticale, avversario a DX. Il pos 3 di entrambe fa lo scatto.
//
// Nostra squadra (bianca, porta sx):
//   GK  → vicino alla nostra porta (sx)
//   1   → bordo sx, basso (y≈0.80)
//   2   → bordo sx, medio-basso (y≈0.65)
//   3   → a metà campo (fa lo scatto al centro)
//   4   → bordo sx, medio-alto (y≈0.35)
//   5   → bordo sx, alto (y≈0.18)
//   6   → bordo sx, centro (y≈0.50)
const KICKOFF_MY = {
  GK:  { x: 0.09, y: 0.50 },
  '1': { x: 0.13, y: 0.80 },
  '2': { x: 0.13, y: 0.65 },
  '3': { x: 0.45, y: 0.50 },  // scattista verso centro
  '4': { x: 0.13, y: 0.35 },
  '5': { x: 0.13, y: 0.20 },
  '6': { x: 0.13, y: 0.50 },  // centroboa lato sx
};

// Avversario (blu, porta dx): specchio orizzontale
const KICKOFF_OPP = {
  GK:  { x: 0.91, y: 0.50 },
  '1': { x: 0.87, y: 0.20 },
  '2': { x: 0.87, y: 0.35 },
  '3': { x: 0.55, y: 0.50 },  // scattista verso centro
  '4': { x: 0.87, y: 0.65 },
  '5': { x: 0.87, y: 0.80 },
  '6': { x: 0.87, y: 0.50 },
};

// ── Posizioni dopo un GOL ──────────────────────────────────────────
// Dalla foto "dopo-il-goal":
// La squadra che HA SUBITO batte dal centro (attacca verso destra se è la bianca)
// La squadra che HA SEGNATO torna in difesa
//
// Bianca (nostra) ha subito → batte → attacca verso DX
const AFTERGOAL_MY_ATTACK = {   // nostra squadra batte (abbiamo subito)
  GK:  { x: 0.09, y: 0.50 },
  '1': { x: 0.55, y: 0.18 },   // posizioni vicino centro, pronte ad attaccare
  '2': { x: 0.50, y: 0.35 },
  '3': { x: 0.50, y: 0.50 },   // chi batte è al centro con la palla
  '4': { x: 0.50, y: 0.65 },
  '5': { x: 0.55, y: 0.82 },
  '6': { x: 0.60, y: 0.50 },
};
// Avversario (ha segnato) torna in difesa nella propria metà
const AFTERGOAL_OPP_DEFEND = {
  GK:  { x: 0.91, y: 0.50 },
  '1': { x: 0.82, y: 0.20 },
  '2': { x: 0.75, y: 0.35 },
  '3': { x: 0.72, y: 0.50 },
  '4': { x: 0.75, y: 0.65 },
  '5': { x: 0.82, y: 0.80 },
  '6': { x: 0.68, y: 0.50 },
};
// Speculare: avversario ha subito → batte → attacca verso SX
const AFTERGOAL_OPP_ATTACK = {
  GK:  { x: 0.91, y: 0.50 },
  '1': { x: 0.45, y: 0.82 },
  '2': { x: 0.50, y: 0.65 },
  '3': { x: 0.50, y: 0.50 },
  '4': { x: 0.50, y: 0.35 },
  '5': { x: 0.45, y: 0.18 },
  '6': { x: 0.40, y: 0.50 },
};
const AFTERGOAL_MY_DEFEND = {
  GK:  { x: 0.09, y: 0.50 },
  '1': { x: 0.18, y: 0.80 },
  '2': { x: 0.25, y: 0.65 },
  '3': { x: 0.28, y: 0.50 },
  '4': { x: 0.25, y: 0.35 },
  '5': { x: 0.18, y: 0.20 },
  '6': { x: 0.32, y: 0.50 },
};

// ── Posizioni di attacco/difesa durante il gioco ───────────────────
const ATK_POS = {           // Nostra squadra attacca (verso dx, porta avv)
  GK:  { x: 0.09, y: 0.50 },
  '1': { x: 0.80, y: 0.20 },
  '2': { x: 0.65, y: 0.36 },
  '3': { x: 0.58, y: 0.50 },
  '4': { x: 0.65, y: 0.64 },
  '5': { x: 0.80, y: 0.80 },
  '6': { x: 0.88, y: 0.50 },
};
const DEF_POS = {           // Nostra squadra difende
  GK:  { x: 0.09, y: 0.50 },
  '1': { x: 0.26, y: 0.22 },
  '2': { x: 0.33, y: 0.36 },
  '3': { x: 0.36, y: 0.50 },
  '4': { x: 0.33, y: 0.64 },
  '5': { x: 0.26, y: 0.78 },
  '6': { x: 0.45, y: 0.50 },
};
const OPP_ATK = {           // Avversario attacca (verso sx, porta nostra)
  GK:  { x: 0.91, y: 0.50 },
  '1': { x: 0.20, y: 0.80 },
  '2': { x: 0.35, y: 0.64 },
  '3': { x: 0.42, y: 0.50 },
  '4': { x: 0.35, y: 0.36 },
  '5': { x: 0.20, y: 0.20 },
  '6': { x: 0.12, y: 0.50 },
};
const OPP_DEF = {           // Avversario difende
  GK:  { x: 0.91, y: 0.50 },
  '1': { x: 0.74, y: 0.78 },
  '2': { x: 0.67, y: 0.64 },
  '3': { x: 0.64, y: 0.50 },
  '4': { x: 0.67, y: 0.36 },
  '5': { x: 0.74, y: 0.22 },
  '6': { x: 0.55, y: 0.50 },
};

// ── Stato ────────────────────────────────────
var _tokens   = {};
var _ball     = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _bgImg    = null;
var _bgReady  = false;
var _phase    = 'kickoff';  // 'kickoff'|'sprint'|'play'|'goal'
var _attack   = 'my';
var _sprintT  = 0;
var _microT   = 0;
var _goalAnim = null;

// ── Carica sfondo ────────────────────────────
(function() {
  var img = new Image();
  img.onload  = function() { _bgImg = img; _bgReady = true; };
  img.onerror = function() { _bgReady = false; };
  img.src = 'campo-per-pallanuoto.jpg';
})();

// ── Helpers ──────────────────────────────────
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _rnd(lo, hi)      { return lo + Math.random() * (hi - lo); }
function _shortName(p)     { return (p && p.name) ? p.name : ''; }
function _jitter(pos, amp) {
  amp = amp || 0.020;
  return {
    x: _clamp(pos.x + _rnd(-amp, amp), PLAY.x0 + 0.01, PLAY.x1 - 0.01),
    y: _clamp(pos.y + _rnd(-amp, amp), PLAY.y0 + 0.01, PLAY.y1 - 0.01),
  };
}

// Muove verso una posizione assoluta con piccolo jitter
function _moveTo(tok, pos, jAmp) {
  var j = _jitter(pos, jAmp || 0.02);
  tok.tx = j.x; tok.ty = j.y;
}

// ── API pubblica ──────────────────────────────
function poolInitTokens(ms) {
  _tokens  = {};
  _ball    = { x: PLAY.cx, y: PLAY.cy, tx: PLAY.cx, ty: PLAY.cy };
  _phase   = 'kickoff';
  _attack  = 'my';
  _sprintT = 0;
  _goalAnim = null;

  // Posiziona in formazione kickoff
  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1];
    var p   = ms.myRoster[pi];
    var pos = KICKOFF_MY[pk] || { x: 0.15, y: 0.50 };
    _tokens['my_' + pk] = {
      x: pos.x, y: pos.y, tx: pos.x, ty: pos.y,
      team: 'my', pk: pk, pi: pi,
      isGK: pk === 'GK',
      posLabel: pk === 'GK' ? 'P' : pk,
      shortName: _shortName(p),
      shirt: ms.shirtNumbers[pi] || '',
      yellows: 0, expelled: false,
    };
  });

  Object.keys(KICKOFF_OPP).forEach(function(pk) {
    var pos = KICKOFF_OPP[pk];
    _tokens['opp_' + pk] = {
      x: pos.x, y: pos.y, tx: pos.x, ty: pos.y,
      team: 'opp', pk: pk, pi: -1,
      isGK: pk === 'GK',
      posLabel: pk === 'GK' ? 'P' : pk,
      shortName: '', shirt: '', yellows: 0, expelled: false,
    };
  });

  // Palla al centro, pos 3 ci si avvicina (sprint)
  _sprintT = 0;
  _phase   = 'sprint';
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
  var pk = tok.pk, pi = ms.onField[pk];
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
  _attack = (tx > PLAY.cx) ? 'my' : 'opp';
  if (_phase === 'play') _triggerTactical();
}

function poolMoveToken(key, tx, ty) {
  if (!_tokens[key]) return;
  var tok = _tokens[key];
  if (tok.isGK) {
    // Portiere: vincola X nella propria area, libero su Y nella porta
    tx = tok.team === 'my'
      ? _clamp(tx, PLAY.myGKminX,  PLAY.myGKmaxX)
      : _clamp(tx, PLAY.oppGKminX, PLAY.oppGKmaxX);
    ty = _clamp(ty, PLAY.myGoalY0, PLAY.myGoalY1);
  }
  tok.tx = _clamp(tx, PLAY.x0 + 0.01, PLAY.x1 - 0.01);
  tok.ty = _clamp(ty, PLAY.y0 + 0.01, PLAY.y1 - 0.01);
}

function poolResetToken(key, delay) {
  delay = delay || 1800;
  setTimeout(function() {
    var tok = _tokens[key]; if (!tok || tok.expelled) return;
    var pk = tok.pk;
    var base = tok.team === 'my'
      ? (_attack === 'my' ? ATK_POS[pk] : DEF_POS[pk])
      : (_attack === 'opp' ? OPP_ATK[pk] : OPP_DEF[pk]);
    if (base) _moveTo(tok, base, 0.03);
  }, delay);
}

// ── Inizio periodo (kickoff) ──────────────────
function poolStartPeriod() {
  _phase   = 'kickoff';
  _sprintT = 0;
  _ball.tx = PLAY.cx; _ball.ty = PLAY.cy;
  // Ripristina posizioni kickoff
  Object.values(_tokens).forEach(function(tok) {
    var pos = tok.team === 'my'
      ? KICKOFF_MY[tok.pk]
      : KICKOFF_OPP[tok.pk];
    if (pos) { tok.tx = pos.x; tok.ty = pos.y; }
  });
}

// ── Goal: palla al centro, squadre si riposizionano ───────────────
function poolShowGoal(scorer, team) {
  _goalAnim = { timer: 0, total: 2.4, scorer: scorer || '', team: team || 'my' };
  _phase = 'goal';

  // Chi ha subito batte dal centro (attacca), chi ha segnato difende
  var mySubito  = (team === 'opp'); // opp ha segnato → noi abbiamo subito
  var oppSubito = (team === 'my');  // noi abbiamo segnato → opp ha subito

  if (mySubito) {
    // Noi battiamo → formazione nostra da AFTERGOAL_MY_ATTACK
    // Avversario difende → AFTERGOAL_OPP_DEFEND
    Object.values(_tokens).forEach(function(tok) {
      if (tok.expired) return;
      var pos = tok.team === 'my'
        ? AFTERGOAL_MY_ATTACK[tok.pk]
        : AFTERGOAL_OPP_DEFEND[tok.pk];
      if (pos) { tok.tx = pos.x + _rnd(-0.015, 0.015); tok.ty = pos.y + _rnd(-0.015, 0.015); }
    });
  } else {
    // Avversario batte → AFTERGOAL_OPP_ATTACK
    // Noi difendiamo → AFTERGOAL_MY_DEFEND
    Object.values(_tokens).forEach(function(tok) {
      if (tok.expelled) return;
      var pos = tok.team === 'my'
        ? AFTERGOAL_MY_DEFEND[tok.pk]
        : AFTERGOAL_OPP_ATTACK[tok.pk];
      if (pos) { tok.tx = pos.x + _rnd(-0.015, 0.015); tok.ty = pos.y + _rnd(-0.015, 0.015); }
    });
  }

  _ball.tx = PLAY.cx; _ball.ty = PLAY.cy;
  _attack = mySubito ? 'my' : 'opp'; // chi batte attacca

  setTimeout(function() {
    _phase = 'play';
    _triggerTactical();
  }, 2600);
}

// ── Logica tattica in gioco ───────────────────
function _triggerTactical() {
  ['1','2','3','4','5','6','GK'].forEach(function(pk) {
    var myTok  = _tokens['my_'  + pk];
    var oppTok = _tokens['opp_' + pk];
    if (myTok && !myTok.expelled) {
      var base = _attack === 'my' ? ATK_POS[pk] : DEF_POS[pk];
      if (base) _moveTo(myTok, base, 0.025);
    }
    if (oppTok) {
      var base2 = _attack === 'opp' ? OPP_ATK[pk] : OPP_DEF[pk];
      if (base2) _moveTo(oppTok, base2, 0.025);
    }
  });
  // Dopo il trigger, aggiorna subito i portieri
  _updateKeepers();
}

// ── Portieri: si muovono SOLO nell'area di porta ──────────────────
// X fissa nella fascia vicino alla propria porta
// Y segue la Y della palla proiettata nell'altezza dello specchio
function _updateKeepers() {
  var by = _ball.y;

  var myGK = _tokens['my_GK'];
  if (myGK && !myGK.expelled) {
    // X: oscillazione minima nell'area portiere (quasi fissa vicino alla porta)
    myGK.tx = _clamp(PLAY.myGoalX + 0.04, PLAY.myGKminX, PLAY.myGKmaxX);
    // Y: specchio di porta — segue la palla ma limitato tra le due traverse
    myGK.ty = _clamp(by, PLAY.myGoalY0 + 0.03, PLAY.myGoalY1 - 0.03);
  }

  var oppGK = _tokens['opp_GK'];
  if (oppGK && !oppGK.expelled) {
    oppGK.tx = _clamp(PLAY.oppGoalX - 0.04, PLAY.oppGKminX, PLAY.oppGKmaxX);
    oppGK.ty = _clamp(by, PLAY.oppGoalY0 + 0.03, PLAY.oppGoalY1 - 0.03);
  }
}

// ── Micro-movimenti (solo giocatori di campo) ─────────────────────
var _microTimer = 0;
function _microMovements(dt) {
  _microTimer += dt;
  if (_microTimer < 1.8) return;
  _microTimer = 0;
  Object.values(_tokens).forEach(function(tok) {
    if (tok.expelled || tok.isGK) return;  // portieri non fanno micro-movimenti
    tok.tx = _clamp(tok.tx + _rnd(-0.020, 0.020), PLAY.x0 + 0.02, PLAY.x1 - 0.02);
    tok.ty = _clamp(tok.ty + _rnd(-0.016, 0.016), PLAY.y0 + 0.02, PLAY.y1 - 0.02);
  });
}

// ── Step animazione ───────────────────────────
function poolAnimStep(dt) {
  var f = Math.min(dt, 0.1);

  if (_phase === 'sprint' || _phase === 'kickoff') {
    _sprintT += dt;
    if (_sprintT > 1.6) {
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
    // Fase di gioco: portieri seguono palla, giocatori fanno micro-movimenti
    _updateKeepers();
    _microMovements(dt);
  }

  // Interpolazione posizioni
  Object.values(_tokens).forEach(function(tok) {
    tok.x += (tok.tx - tok.x) * Math.min(f * 2.4, 1);
    tok.y += (tok.ty - tok.y) * Math.min(f * 2.4, 1);
  });
  _ball.x += (_ball.tx - _ball.x) * Math.min(f * 3.8, 1);
  _ball.y += (_ball.ty - _ball.y) * Math.min(f * 3.8, 1);
}

// ── Disegno ──────────────────────────────────
function drawPool(canvas, myTeamAbbr, oppTeamAbbr) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = POOL_W, H = POOL_H;

  // Sfondo
  if (_bgReady && _bgImg) {
    ctx.drawImage(_bgImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = '#1a7fa0'; ctx.fillRect(0, 0, W, H);
  }

  // Token giocatori
  Object.values(_tokens).forEach(function(tok) {
    if (tok.expelled) return;
    var px = tok.x * W, py = tok.y * H;
    var isMy = tok.team === 'my';
    var isGK = tok.isGK;
    var R = 19;

    // Ombra
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(px + 2, py + 3, R, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Cerchio ──
    ctx.beginPath();
    ctx.arc(px, py, R, 0, Math.PI * 2);

    if (isGK) {
      // Portiere: ROSSO (sia il nostro che l'avversario)
      ctx.fillStyle   = '#cc2222';
      ctx.fill();
      ctx.strokeStyle = '#ff6666';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    } else if (isMy) {
      // Nostra squadra: BIANCO con bordo grigio scuro
      ctx.fillStyle   = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#333333';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    } else {
      // Avversario: BLU con bordo celeste
      ctx.fillStyle   = '#1a3faa';
      ctx.fill();
      ctx.strokeStyle = '#4488ff';
      ctx.lineWidth   = 2.5;
      ctx.stroke();
    }

    // Cartellini gialli (sopra il cerchio, solo nostra squadra)
    if (isMy && !isGK && tok.yellows > 0) {
      for (var i = 0; i < tok.yellows; i++) {
        ctx.fillStyle = (tok.yellows >= MAX_TEMP_EXP) ? '#e74c3c' : '#f0c040';
        ctx.fillRect(px - 7 + i * 9, py - R - 9, 7, 10);
      }
    }

    // Testo nel cerchio
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    if (isGK) {
      // Portiere: "P" in bianco, bold
      ctx.fillStyle = '#fff';
      ctx.font      = 'bold 13px sans-serif';
      ctx.fillText('P', px, py);
    } else if (isMy) {
      // Nostra squadra: numero maglia (grande) + posizione (piccola)
      ctx.fillStyle = '#111';
      ctx.font      = 'bold 10px sans-serif';
      ctx.fillText(tok.shirt, px, py - 3);
      ctx.fillStyle = '#666';
      ctx.font      = '7px sans-serif';
      ctx.fillText(tok.posLabel, px, py + 6);
    } else {
      // Avversario: numero posizione in azzurro chiaro
      ctx.fillStyle = '#b3d9ff';
      ctx.font      = 'bold 12px sans-serif';
      ctx.fillText(tok.posLabel, px, py);
    }

    // Nome sotto il cerchio (solo nostra squadra, non portiere)
    if (isMy && !isGK && tok.shortName) {
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
  g.addColorStop(1, '#f9a825');
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#c17900'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(bx, by, 6, 0.4, Math.PI - 0.4); ctx.stroke();
  ctx.beginPath(); ctx.arc(bx, by, 6, Math.PI + 0.4, -0.4); ctx.stroke();

  // Animazione GOAL
  if (_goalAnim) {
    var t = _goalAnim.timer / _goalAnim.total;
    var pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * Math.PI * 6));
    var alpha = t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = _goalAnim.team === 'my'
      ? 'rgba(0,80,20,.45)' : 'rgba(80,0,0,.45)';
    ctx.fillRect(0, 0, W, H);
    var fs = Math.round(72 + pulse * 18);
    ctx.font = 'bold ' + fs + 'px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 12;
    ctx.fillStyle = _goalAnim.team === 'my' ? '#fdd835' : '#ff5252';
    ctx.fillText('GOAL!!!', W / 2, H / 2 - 24);
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 6;
    ctx.fillText(_goalAnim.scorer, W / 2, H / 2 + 30);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.8)';
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
