// js/canvas/pool.js
const POOL_W = 760, POOL_H = 430;
const PLAY = { x0: 0.10, x1: 0.90, y0: 0.12, y1: 0.88, cx: 0.50, cy: 0.50 };

var _tokens = {}, _tokenSpeeds = {}, _ballOwner = null;
var _ball = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
var _phase = 'idle';
var _bgImg = new Image(); _bgImg.src = 'campo-per-pallanuoto.jpg';
var _ballImg = new Image(); _ballImg.src = 'palla.png';

function poolInitTokens(ms) {
    _tokens = {}; _ballOwner = null;
    Object.entries(ms.onField).forEach(([pk, pi]) => {
        _tokens['my_'+pk] = { x:0.1, y:0.5, tx:0.1, ty:0.5, team:'my', pk:pk, shirt:ms.shirtNumbers[pi]||pk };
    });
    ['GK','1','2','3','4','5','6'].forEach(pk => {
        _tokens['opp_'+pk] = { x:0.9, y:0.5, tx:0.9, ty:0.5, team:'opp', pk:pk, shirt:pk };
    });
    poolSetSpeeds(ms);
}

function poolSetSpeeds(ms) {
    const BASE = 0.08; // 10 secondi per il lato lungo
    Object.keys(_tokens).forEach(key => {
        let spe = 70;
        if (key.startsWith('my') && ms) {
            let p = ms.myRoster[ms.onField[key.split('_')[1]]];
            if (p && p.stats) spe = p.stats.spe;
        }
        _tokenSpeeds[key] = BASE * (spe / 100);
    });
}

function poolAnimStep(dt) {
    let f = Math.min(dt, 0.1);
    // Movimento Giocatori
    Object.keys(_tokens).forEach(key => {
        let t = _tokens[key];
        let spd = _tokenSpeeds[key] || 0.05;
        let dx = t.tx - t.x, dy = t.ty - t.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if (dist > 0.002) {
            t.x += (dx / dist) * spd * f;
            t.y += (dy / dist) * spd * f;
        }
    });
    // Gestione Palla
    if (_ballOwner && _tokens[_ballOwner]) {
        _ball.x = _tokens[_ballOwner].x; _ball.y = _tokens[_ballOwner].y;
    } else {
        _ball.x += (_ball.tx - _ball.x) * f * 5;
        _ball.y += (_ball.ty - _ball.y) * f * 5;
    }
}

function poolSetBallOwner(key) { _ballOwner = key; }
function poolMoveBall(tx, ty) { _ballOwner = null; _ball.tx = tx; _ball.ty = ty; }
function poolGetTokens() { return _tokens; }
function poolStartSprint() { _phase = 'sprint'; }
function poolGetPhase() { return _phase; }

function drawPool(canvas) {
    let ctx = canvas.getContext('2d');
    ctx.drawImage(_bgImg, 0, 0, POOL_W, POOL_H);
    Object.values(_tokens).forEach(t => {
        ctx.beginPath(); ctx.arc(t.x * POOL_W, t.y * POOL_H, 15, 0, 7);
        ctx.fillStyle = t.team === 'my' ? 'white' : 'blue'; ctx.fill();
        ctx.stroke(); ctx.fillStyle = 'black';
        ctx.textAlign='center'; ctx.fillText(t.shirt, t.x*POOL_W, t.y*POOL_H+5);
    });
    ctx.drawImage(_ballImg, _ball.x*POOL_W-10, _ball.y*POOL_H-10, 20, 20);
}