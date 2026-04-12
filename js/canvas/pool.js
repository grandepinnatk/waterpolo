// ─────────────────────────────────────────────
// canvas/pool.js — Pallanuoto realistica v3
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

// ── Geometria del campo ───────────────────────
const PLAY = {
  x0: 0.10,  x1: 0.90,
  y0: 0.12,  y1: 0.88,
  cx: 0.50,  cy: 0.50,
  myGoalX:   0.08,  oppGoalX:  0.92,
  myGoalY0:  0.38,  myGoalY1:  0.62,
  oppGoalY0: 0.38,  oppGoalY1: 0.62,
  myGKminX:  0.07,  myGKmaxX:  0.12,
  oppGKminX: 0.88,  oppGKmaxX: 0.93,
  myNetX0:   0.02,  myNetX1:   0.09,
  myNetY0:   0.38,  myNetY1:   0.62,
  oppNetX0:  0.91,  oppNetX1:  0.98,
  oppNetY0:  0.38,  oppNetY1:  0.62,
};

// ── Posizioni kickoff: schierati sui bordi (Lati Corti) ────
const KICKOFF_MY = {
  GK:  { x: 0.09, y: 0.50 },
  '5': { x: 0.10, y: 0.20 },
  '4': { x: 0.10, y: 0.35 },
  '6': { x: 0.10, y: 0.50 },
  '3': { x: 0.10, y: 0.50 }, 
  '2': { x: 0.10, y: 0.65 },
  '1': { x: 0.10, y: 0.80 },
};
const KICKOFF_OPP = {
  GK:  { x: 0.91, y: 0.50 },
  '1': { x: 0.90, y: 0.20 },
  '2': { x: 0.90, y: 0.35 },
  '6': { x: 0.90, y: 0.50 },
  '3': { x: 0.90, y: 0.50 },
  '4': { x: 0.90, y: 0.65 },
  '5': { x: 0.90, y: 0.80 },
};

const MY_SEMICIRCLE_ATK = { GK: {x:0.09,y:0.5}, '5':{x:0.7,y:0.18}, '4':{x:0.62,y:0.32}, '6':{x:0.88,y:0.5}, '3':{x:0.55,y:0.5}, '2':{x:0.62,y:0.68}, '1':{x:0.7,y:0.82} };
const OPP_SEMICIRCLE_ATK = { GK: {x:0.91,y:0.5}, '1':{x:0.3,y:0.18}, '2':{x:0.38,y:0.32}, '6':{x:0.12,y:0.5}, '3':{x:0.45,y:0.5}, '4':{x:0.38,y:0.68}, '5':{x:0.3,y:0.82} };
const MY_DEFENSE = { GK: {x:0.09,y:0.5}, '5':{x:0.24,y:0.22}, '4':{x:0.3,y:0.36}, '6':{x:0.38,y:0.5}, '3':{x:0.3,y:0.5}, '2':{x:0.3,y:0.64}, '1':{x:0.24,y:0.78} };
const OPP_DEFENSE = { GK: {x:0.91,y:0.5}, '1':{x:0.76,y:0.22}, '2':{x:0.7,y:0.36}, '6':{x:0.62,y:0.5}, '3':{x:0.7,y:0.5}, '4':{x:0.7,y:0.64}, '5':{x:0.76,y:0.78} };

// ── Stato ─────────────────────────────────────
var _tokens      = {};
var _tokenSpeeds = {};
var _ball        = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _ballOwner   = null; // Key del token che ha il possesso (es: 'my_3')
var _bgImg       = null;
var _bgReady    = false;
var _phase      = 'idle';
var _attack     = 'my';
var _goalAnim   = null;
var _pendingGoal = null;

// Caricamento immagini (sfondo e palla)
(function() {
  var b=new Image(); b.onload=function(){_bgImg=b;_bgReady=true;}; b.src='campo-per-pallanuoto.jpg';
  var p=new Image(); p.onload=function(){_ballImg=p;_ballReady=true;}; p.src='palla.png';
})();

var _ballImg = null; var _ballReady = false;

// ── Helpers ──────────────────────────────────
function _clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function _rnd(lo, hi)      { return lo + Math.random() * (hi - lo); }

// ── API pubblica ──────────────────────────────
function poolInitTokens(ms) {
  _tokens = {}; _ballOwner = null;
  _ball = { x: PLAY.cx, y: PLAY.cy, tx: PLAY.cx, ty: PLAY.cy };
  _phase = 'idle';
  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1], pos = KICKOFF_MY[pk] || {x:0.1,y:0.5};
    _tokens['my_'+pk] = { x:pos.x, y:pos.y, tx:pos.x, ty:pos.y, team:'my', pk:pk, pi:pi, isGK:pk==='GK', shirt:ms.shirtNumbers[pi]||'', yellows:0, expelled:false, posLabel:pk==='GK'?'P':pk };
  });
  Object.keys(KICKOFF_OPP).forEach(function(pk) {
    var pos = KICKOFF_OPP[pk];
    _tokens['opp_'+pk] = { x:pos.x, y:pos.y, tx:pos.x, ty:pos.y, team:'opp', pk:pk, pi:-1, isGK:pk==='GK', shirt:'', yellows:0, expelled:false, posLabel:pk==='GK'?'P':pk };
  });
}

function poolSetSpeeds(ms) {
  if (!ms) return;
  // REALISMO: lato lungo (0.8 unità) in 10s per spe 100.
  // Vel = Dist/Tempo = 0.8 / 10 = 0.08 unità/sec.
  const BASE_SPEED = 0.08; 
  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1], p = ms.myRoster[pi]; if(!p) return;
    var spe = (p.stats && p.stats.spe) ? p.stats.spe : 50;
    var stamina = (ms.stamina && ms.stamina[pi] !== undefined) ? ms.stamina[pi] : 100;
    _tokenSpeeds['my_'+pk] = BASE_SPEED * (spe/100) * (0.5 + (stamina/100)*0.5);
  });
  ['GK','1','2','3','4','5','6'].forEach(function(pk) { _tokenSpeeds['opp_'+pk] = BASE_SPEED * 0.75; });
}

function poolMoveBall(tx, ty) {
  _ballOwner = null; // Se la palla viene mossa forzatamente, si stacca
  _ball.tx = _clamp(tx, 0.02, 0.98);
  _ball.ty = _clamp(ty, PLAY.y0, PLAY.y1);
}

function poolSetBallOwner(key) {
  _ballOwner = key;
}

function poolShootAndScore(targetX, targetY, scorer, team) {
  _ballOwner = null;
  _ball.tx = targetX;
  _ball.ty = targetY;
  _pendingGoal = { scorer: scorer || '', team: team || 'my' };
}

function poolAnimStep(dt) {
  var f = Math.min(dt, 0.1);

  // Gestione Possesso
  if (_ballOwner && _tokens[_ballOwner]) {
    var owner = _tokens[_ballOwner];
    _ball.x = owner.x; _ball.y = owner.y;
    _ball.tx = owner.x; _ball.ty = owner.y;
  } else {
    // Palla in volo o libera
    _ball.x += (_ball.tx - _ball.x) * Math.min(f * 5, 1);
    _ball.y += (_ball.ty - _ball.y) * Math.min(f * 5, 1);
  }

  // Goal Detection
  if (_pendingGoal) {
    var bx = _ball.x, by = _ball.y;
    if ((bx >= PLAY.oppNetX0 && bx <= PLAY.oppNetX1 && by >= PLAY.oppNetY0 && by <= PLAY.oppNetY1) ||
        (bx >= PLAY.myNetX0 && bx <= PLAY.myNetX1 && by >= PLAY.myNetY0 && by <= PLAY.myNetY1)) {
        poolShowGoal(_pendingGoal.scorer, _pendingGoal.team);
    }
  }

  if (_phase === 'goal') {
     if (_goalAnim) { _goalAnim.timer += dt; if (_goalAnim.timer >= _goalAnim.total) _goalAnim = null; }
     return;
  }

  // Movimento Giocatori proporzionale
  Object.values(_tokens).forEach(function(tok) {
    if (tok.expelled) return;
    var spd = _tokenSpeeds[tok.team + '_' + tok.pk] || 0.04;
    var dx = tok.tx - tok.x, dy = tok.ty - tok.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 0.001) {
      // Movimento lineare costante basato sulla velocità reale calcolata
      tok.x += (dx / dist) * spd * f;
      tok.y += (dy / dist) * spd * f;
    }
  });
}

function poolShowGoal(scorer, team) {
  _pendingGoal = null; _ballOwner = null;
  _goalAnim = { timer: 0, total: 2.5, scorer: scorer, team: team };
  _phase = 'goal';
  // Posiziona palla "dentro" la rete dietro il portiere
  if (team === 'my') { _ball.x = 0.95; _ball.y = 0.5; } else { _ball.x = 0.05; _ball.y = 0.5; }
  setTimeout(function() { _phase = 'play'; _ball.tx = 0.5; _ball.ty = 0.5; }, 2500);
}

function poolGetTokens() { return _tokens; }
function poolGetPhase() { return _phase; }
function poolSyncTokens(ms) { poolSetSpeeds(ms); }

// (Seguono funzioni drawPool e _pill identiche a quelle originali...)
function drawPool(canvas, myTeamAbbr, oppTeamAbbr) {
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = POOL_W, H = POOL_H;
  if (_bgReady && _bgImg) ctx.drawImage(_bgImg, 0, 0, W, H);
  else { ctx.fillStyle = '#1a7fa0'; ctx.fillRect(0, 0, W, H); }

  Object.values(_tokens).forEach(function(tok) {
    if (tok.expelled) return;
    var px = tok.x * W, py = tok.y * H;
    var isMy = tok.team === 'my', isGK = tok.isGK, R = 19;
    ctx.beginPath(); ctx.arc(px, py, R, 0, Math.PI*2);
    if (isGK) { ctx.fillStyle='#cc2222'; ctx.fill(); }
    else if (isMy) { ctx.fillStyle='#ffffff'; ctx.fill(); ctx.strokeStyle='#333'; ctx.stroke(); }
    else { ctx.fillStyle='#1a3faa'; ctx.fill(); ctx.strokeStyle='#4488ff'; ctx.stroke(); }
    ctx.fillStyle = isGK || !isMy ? '#fff' : '#111';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.font='bold 11px sans-serif'; ctx.fillText(isGK ? 'P' : tok.shirt || tok.pk, px, py);
  });

  var bx = _ball.x * W, by = _ball.y * H, BR = 12;
  if (_ballReady && _ballImg) ctx.drawImage(_ballImg, bx-BR, by-BR, BR*2, BR*2);
  else { ctx.beginPath(); ctx.arc(bx, by, BR, 0, Math.PI*2); ctx.fillStyle='#ff0'; ctx.fill(); }

  if (_goalAnim) {
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#fff'; ctx.font='bold 40px sans-serif'; ctx.textAlign='center';
    ctx.fillText("GOAL!!!", W/2, H/2);
  }
}