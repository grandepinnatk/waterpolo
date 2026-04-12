// js/canvas/pool.js

const POOL_W = 760;
const POOL_H = 430;

const PLAY = {
    x0: 0.10, x1: 0.90, y0: 0.12, y1: 0.88, cx: 0.50, cy: 0.50,
    myNetX0: 0.02, myNetX1: 0.09, myNetY0: 0.38, myNetY1: 0.62,
    oppNetX0: 0.91, oppNetX1: 0.98, oppNetY0: 0.38, oppNetY1: 0.62
};

var _tokens = {}, _tokenSpeeds = {}, _ballOwner = null;
var _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _phase = 'idle';
var _pendingGoal = null;
var _goalAnim = null;

var _bgImg = new Image(); _bgImg.src = 'campo-per-pallanuoto.jpg';
var _ballImg = new Image(); _ballImg.src = 'palla.png';

function poolInitTokens(ms) {
    _tokens = {}; _ballOwner = null; _phase = 'idle'; _pendingGoal = null;
    _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    
    // Schieramento iniziale (Kickoff)
    Object.entries(ms.onField).forEach(([pk, pi]) => {
        _tokens['my_'+pk] = { x:0.1, y:0.5, tx:0.1, ty:0.5, team:'my', pk:pk, pi:pi, shirt:ms.shirtNumbers[pi]||pk, isGK:pk==='GK' };
    });
    ['GK','1','2','3','4','5','6'].forEach(pk => {
        _tokens['opp_'+pk] = { x:0.9, y:0.5, tx:0.9, ty:0.5, team:'opp', pk:pk, shirt:pk, isGK:pk==='GK' };
    });
    poolSetSpeeds(ms);
}

function poolSetSpeeds(ms) {
    const BASE = 0.08; // 10s per 0.8 unità (lato lungo)
    Object.keys(_tokens).forEach(key => {
        let spe = 70;
        let t = _tokens[key];
        if (t.team === 'my' && ms && ms.myRoster[t.pi]) {
            spe = ms.myRoster[t.pi].stats.spe || 70;
        }
        _tokenSpeeds[key] = BASE * (spe / 100);
    });
}

// RISOLVE: ReferenceError poolSyncTokens is not defined
function poolSyncTokens(ms) {
    poolSetSpeeds(ms);
}

function poolAnimStep(dt) {
    let f = Math.min(dt, 0.1);

    if (_phase === 'goal' && _goalAnim) {
        _goalAnim.timer += dt;
        if (_goalAnim.timer >= 2.5) { _phase = 'play'; _goalAnim = null; }
        return;
    }

    // Movimento Giocatori
    Object.keys(_tokens).forEach(key => {
        let t = _tokens[key];
        let spd = _tokenSpeeds[key] || 0.05;
        let dx = t.tx - t.x, dy = t.ty - t.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0.002) {
            t.x += (dx / dist) * spd * f;
            t.y += (dy / dist) * spd * f;
        } else {
            t.x = t.tx; t.y = t.ty;
        }
    });

    // Movimento Palla
    if (_ballOwner && _tokens[_ballOwner]) {
        _ball.x = _tokens[_ballOwner].x; _ball.y = _tokens[_ballOwner].y;
        _ball.tx = _ball.x; _ball.ty = _ball.y;
    } else {
        _ball.x += (_ball.tx - _ball.x) * f * 6;
        _ball.y += (_ball.ty - _ball.y) * f * 6;
    }

    // Check Goal
    if (_pendingGoal) {
        let inNet = (_ball.x > 0.91 || _ball.x < 0.09) && (_ball.y > 0.38 && _ball.y < 0.62);
        if (inNet) {
            _phase = 'goal';
            _goalAnim = { timer: 0, scorer: _pendingGoal.scorer };
            _pendingGoal = null; _ballOwner = null;
        }
    }
}

function poolSetBallOwner(key) { _ballOwner = key; }
function poolMoveBall(tx, ty) { _ballOwner = null; _ball.tx = tx; _ball.ty = ty; }
function poolGetTokens() { return _tokens; }
function poolGetPhase() { return _phase; }
function poolStartPeriod() { _phase = 'sprint'; }

function drawPool(canvas) {
    let ctx = canvas.getContext('2d');
    ctx.drawImage(_bgImg, 0, 0, POOL_W, POOL_H);
    Object.values(_tokens).forEach(t => {
        ctx.beginPath(); ctx.arc(t.x * POOL_W, t.y * POOL_H, 18, 0, 7);
        ctx.fillStyle = t.isGK ? 'red' : (t.team === 'my' ? 'white' : 'blue');
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = (t.team === 'my' && !t.isGK) ? 'black' : 'white';
        ctx.textAlign='center'; ctx.fillText(t.shirt, t.x * POOL_W, t.y * POOL_H + 5);
    });
    ctx.drawImage(_ballImg, _ball.x * POOL_W - 12, _ball.y * POOL_H - 12, 24, 24);
    if (_phase === 'goal') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,POOL_W,POOL_H);
        ctx.fillStyle = 'yellow'; ctx.font = '40px Arial'; ctx.textAlign='center';
        ctx.fillText("GOAL!", POOL_W/2, POOL_H/2);
    }
}