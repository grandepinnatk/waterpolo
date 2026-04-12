// ─────────────────────────────────────────────
// canvas/pool.js — VERSIONE CORRETTA E FUNZIONANTE
// ─────────────────────────────────────────────

const POOL_W = 760;
const POOL_H = 430;

const PLAY = {
  x0: 0.10, x1: 0.90, y0: 0.12, y1: 0.88, cx: 0.50, cy: 0.50,
  myGoalX: 0.08, oppGoalX: 0.92,
  myNetX0: 0.02, myNetX1: 0.09, myNetY0: 0.38, myNetY1: 0.62,
  oppNetX0: 0.91, oppNetX1: 0.98, oppNetY0: 0.38, oppNetY1: 0.62
};

// Schieramento iniziale sui bordi
const KICKOFF_MY = { GK:{x:0.09,y:0.5}, '5':{x:0.1,y:0.2}, '4':{x:0.1,y:0.35}, '6':{x:0.1,y:0.5}, '3':{x:0.1,y:0.5}, '2':{x:0.1,y:0.65}, '1':{x:0.1,y:0.8} };
const KICKOFF_OPP = { GK:{x:0.91,y:0.5}, '1':{x:0.9,y:0.2}, '2':{x:0.9,y:0.35}, '6':{x:0.9,y:0.5}, '3':{x:0.9,y:0.5}, '4':{x:0.9,y:0.65}, '5':{x:0.9,y:0.8} };

var _tokens = {}, _tokenSpeeds = {};
var _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _ballOwner = null; 
var _phase = 'idle'; 
var _pendingGoal = null;
var _goalAnim = null;
var _bgImg = new Image(); _bgImg.src = 'campo-per-pallanuoto.jpg';
var _ballImg = new Image(); _ballImg.src = 'palla.png';

function poolInitTokens(ms) {
  _tokens = {}; _ballOwner = null; _phase = 'idle';
  _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
  Object.entries(ms.onField).forEach(function(entry) {
    var pk = entry[0], pi = entry[1], pos = KICKOFF_MY[pk] || {x:0.1,y:0.5};
    _tokens['my_'+pk] = { x:pos.x, y:pos.y, tx:pos.x, ty:pos.y, team:'my', pk:pk, pi:pi, shirt:ms.shirtNumbers[pi]||pk, isGK:pk==='GK' };
  });
  Object.keys(KICKOFF_OPP).forEach(function(pk) {
    var pos = KICKOFF_OPP[pk];
    _tokens['opp_'+pk] = { x:pos.x, y:pos.y, tx:pos.x, ty:pos.y, team:'opp', pk:pk, pi:-1, shirt:pk, isGK:pk==='GK' };
  });
  poolSetSpeeds(ms);
}

function poolSetSpeeds(ms) {
  // Realismo: spe 100 percorre 0.8 unità in 10s -> 0.08 unità/secondo
  const BASE_SPEED = 0.08;
  Object.keys(_tokens).forEach(function(key) {
    var tok = _tokens[key];
    var spe = 70; // default
    if (tok.team === 'my' && ms) {
      var p = ms.myRoster[tok.pi];
      if (p && p.stats) spe = p.stats.spe;
    }
    _tokenSpeeds[key] = BASE_SPEED * (spe / 100);
  });
}

function poolSetBallOwner(key) { _ballOwner = key; }

function poolMoveBall(tx, ty) { 
  _ballOwner = null; 
  _ball.tx = Math.max(0.02, Math.min(0.98, tx)); 
  _ball.ty = Math.max(0.12, Math.min(0.88, ty)); 
}

function poolShootAndScore(tx, ty, scorer, team) {
  poolMoveBall(tx, ty);
  _pendingGoal = { scorer: scorer, team: team };
}

function poolAnimStep(dt) {
  var f = Math.min(dt, 0.1);

  if (_phase === 'goal' && _goalAnim) {
    _goalAnim.timer += dt;
    if (_goalAnim.timer >= 2.5) { _phase = 'play'; _goalAnim = null; }
    return;
  }

  // MOVIMENTO GIOCATORI: Calcolo vettoriale per evitare che restino fermi
  Object.keys(_tokens).forEach(function(key) {
    var t = _tokens[key];
    var spd = _tokenSpeeds[key] || 0.05;
    var dx = t.tx - t.x, dy = t.ty - t.y;
    var dist = Math.sqrt(dx*dx + dy*dy);
    
    if (dist > 0.002) {
      // Muove il segnalino verso il target alla velocità corretta
      t.x += (dx / dist) * spd * f;
      t.y += (dy / dist) * spd * f;
    } else {
      t.x = t.tx; t.y = t.ty;
    }
  });

  // GESTIONE PALLA: Aggancio al possessore o movimento verso target
  if (_ballOwner && _tokens[_ballOwner]) {
    _ball.x = _tokens[_ballOwner].x;
    _ball.y = _tokens[_ballOwner].y;
    _ball.tx = _ball.x; _ball.ty = _ball.y;
  } else {
    // La palla scorre verso il punto indicato (passaggio o tiro)
    _ball.x += (_ball.tx - _ball.x) * f * 6;
    _ball.y += (_ball.ty - _ball.y) * f * 6;
  }

  // Rilevamento Goal
  if (_pendingGoal) {
    var inNet = (_ball.x > 0.91 || _ball.x < 0.09) && (_ball.y > 0.38 && _ball.y < 0.62);
    if (inNet) {
      _phase = 'goal';
      _goalAnim = { timer: 0, scorer: _pendingGoal.scorer };
      _pendingGoal = null;
      _ballOwner = null;
    }
  }
}

function poolGetTokens() { return _tokens; }
function poolGetPhase() { return _phase; }
function poolStartPeriod() { _phase = 'sprint'; }

function drawPool(canvas) {
  var ctx = canvas.getContext('2d');
  ctx.drawImage(_bgImg, 0, 0, POOL_W, POOL_H);
  
  Object.values(_tokens).forEach(function(t) {
    ctx.beginPath(); ctx.arc(t.x * POOL_W, t.y * POOL_H, 18, 0, Math.PI*2);
    ctx.fillStyle = t.isGK ? '#cc2222' : (t.team === 'my' ? '#ffffff' : '#1a3faa');
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = (t.team === 'my' && !t.isGK) ? '#000' : '#fff';
    ctx.textAlign = 'center'; ctx.fillText(t.shirt, t.x * POOL_W, t.y * POOL_H + 5);
  });

  ctx.drawImage(_ballImg, _ball.x * POOL_W - 12, _ball.y * POOL_H - 12, 24, 24);
  
  if (_goalAnim) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,POOL_W,POOL_H);
    ctx.fillStyle = 'yellow'; ctx.font = 'bold 40px sans-serif'; ctx.textAlign='center';
    ctx.fillText("GOAL!!!", POOL_W/2, POOL_H/2);
    if(_goalAnim.scorer) { ctx.font='20px sans-serif'; ctx.fillText(_goalAnim.scorer, POOL_W/2, POOL_H/2 + 40); }
  }
}