// ─────────────────────────────────────────────
// canvas/movement.js — Logica di Movimento AI
// ─────────────────────────────────────────────

var MovementController = (function() {
  var _ms = null, _active = false;

  function init(ms) { _ms = ms; _active = true; }
  function stop() { _active = false; }

  function update(dt) {
    if (!_active || !_ms) return;
    var phase = poolGetPhase();
    var t = poolGetTokens();

    if (phase === 'sprint') {
      // Entrambi i numeri 3 scattano verso la palla al centro
      var my3 = t['my_3'], opp3 = t['opp_3'];
      if (my3) { my3.tx = 0.5; my3.ty = 0.5; }
      if (opp3) { opp3.tx = 0.5; opp3.ty = 0.5; }

      // Chi tocca la palla (distanza < 0.03) vince il possesso
      if (my3 && _distCenter(my3) < 0.03) {
        poolSetBallOwner('my_3');
        _endSprint('my');
      } else if (opp3 && _distCenter(opp3) < 0.03) {
        poolSetBallOwner('opp_3');
        _endSprint('opp');
      }
    }
  }

  function _distCenter(tok) {
    return Math.sqrt(Math.pow(tok.x - 0.5, 2) + Math.pow(tok.y - 0.5, 2));
  }

  function _endSprint(winnerTeam) {
    // Simula un passaggio immediato dopo la conquista
    var receiver = winnerTeam + '_4';
    setTimeout(function() {
      var target = poolGetTokens()[receiver];
      if (target) {
        poolMoveBall(target.x, target.y);
        setTimeout(function() { poolSetBallOwner(receiver); }, 700);
      }
    }, 400);
    // Nota: lo stato 'play' viene impostato dopo lo sprint
  }

  return { 
    init: init, 
    stop: stop, 
    update: update,
    onPeriodStart: function() { poolStartPeriod(); }
  };
})();

window.MovementController = MovementController;