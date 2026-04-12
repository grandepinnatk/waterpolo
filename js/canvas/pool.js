// js/canvas/pool.js
const POOL_W = 760, POOL_H = 430;
const PLAY = { x0: 0.10, x1: 0.90, y0: 0.12, y1: 0.88, cx: 0.50, cy: 0.50 };

var _tokens = {}, _tokenSpeeds = {}, _ballOwner = null;
var _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _phase = 'idle';
var _bgImg = new Image(); _bgImg.src = 'campo-per-pallanuoto.jpg';
var _ballImg = new Image(); _ballImg.src = 'palla.png';

function poolInitTokens(ms) {
    _tokens = {}; _ballOwner = null; _phase = 'idle';
    _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    Object.entries(ms.onField).forEach(([pk, pi]) => {
        _tokens['my_'+pk] = { x:0.1, y:0.5, tx:0.1, ty:0.5, team:'my', pk:pk, pi:pi, shirt:ms.shirtNumbers[pi]||pk, isGK:pk==='GK' };
    });
    ['GK','1','2','3','4','5','6'].forEach(pk => {
        _tokens['opp_'+pk] = { x:0.9, y:0.5, tx:0.9, ty:0.5, team:'opp', pk:pk, pi:-1, shirt:pk, isGK:pk==='GK' };
    });
    poolSetSpeeds(ms);
}

function poolSetSpeeds(ms) {
    const BASE = 0.08; // 10 secondi per il lato lungo con 100 speed
    Object.keys(_tokens).forEach(key => {
        let spe = 70;
        if (key.startsWith('my') && ms && _tokens[key].pi !== -1) {
            let p = ms.myRoster[_tokens[key].pi];
            if (p && p.stats) spe = p.stats.spe;
        }
        _tokenSpeeds[key] = BASE * (spe / 100);
    });
}

// Questa funzione risolve l'errore: ReferenceError poolSyncTokens
function poolSyncTokens(ms) {
    poolSetSpeeds(ms);
}

function poolAnimStep(dt) {
    let f = Math.min(dt, 0.1);
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

    if (_ballOwner && _tokens[_ballOwner]) {
        _ball.x = _tokens[_ballOwner].x; _ball.y = _tokens[_ballOwner].y;
        _ball.tx = _ball.x; _ball.ty = _ball.y;
    } else {
        _ball.x += (_ball.tx - _ball.x) * f * 6;
        _ball.y += (_ball.ty - _ball.y) * f * 6;
    }
}

function poolSetBallOwner(key) { _ballOwner = key; }
function poolMoveBall(tx, ty) { _ballOwner = null; _ball.tx = tx; _ball.ty = ty; }
function poolGetTokens() { return _tokens; }
function poolStartPeriod() { _phase = 'sprint'; }
function poolGetPhase() { return _phase; }

function drawPool(canvas) {
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, POOL_W, POOL_H);
    ctx.drawImage(_bgImg, 0, 0, POOL_W, POOL_H);
    Object.values(_tokens).forEach(t => {
        ctx.beginPath(); ctx.arc(t.x * POOL_W, t.y * POOL_H, 18, 0, 7);
        ctx.fillStyle = t.isGK ? 'red' : (t.team === 'my' ? 'white' : 'blue');
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = (t.team === 'my' && !t.isGK) ? 'black' : 'white';
        ctx.textAlign='center'; ctx.fillText(t.shirt, t.x * POOL_W, t.y * POOL_H + 5);
    });
    ctx.drawImage(_ballImg, _ball.x * POOL_W - 12, _ball.y * POOL_H - 12, 24, 24);
}