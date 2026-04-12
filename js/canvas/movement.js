// ─────────────────────────────────────────────
// canvas/movement.js — Logica Sprint e AI
// ─────────────────────────────────────────────

var MovementController = (function() {
  var _ms = null, _active = false;

  function init(ms) { _ms = ms; _active = true; }
  function stop() { _active = false; }

  function update(dt) {
    if (!_active || !_ms) return;
    let phase = poolGetPhase();

    if (phase === 'sprint') {
      let t = poolGetTokens();
      let my3 = t['my_3'], opp3 = t['opp_3'];
      
      // Entrambi puntano la palla al centro
      if (my3) { my3.tx = 0.5; my3.ty = 0.5; }
      if (opp3) { opp3.tx = 0.5; opp3.ty = 0.5; }

      // Chi tocca la palla vince lo sprint
      let dMy = my3 ? Math.sqrt(Math.pow(my3.x-0.5,2)+Math.pow(my3.y-0.5,2)) : 1;
      let dOpp = opp3 ? Math.sqrt(Math.pow(opp3.x-0.5,2)+Math.pow(opp3.y-0.5,2)) : 1;

      if (dMy < 0.03) {
        poolSetBallOwner('my_3');
        _endSprint('my');
      } else if (dOpp < 0.03) {
        poolSetBallOwner('opp_3');
        _endSprint('opp');
      }
    }
  }

  function _endSprint(winner) {
    // Passaggio al numero 4 della stessa squadra
    let receiver = winner + '_4';
    setTimeout(() => {
      let target = poolGetTokens()[receiver];
      if (target) {
        poolMoveBall(target.x, target.y);
        setTimeout(() => poolSetBallOwner(receiver), 800);
      }
    }, 500);
    // Cambia fase (gestito internamente da pool.js o tramite setter)
  }

  function onPeriodStart() {
    poolStartPeriod();
  }

  return { init, stop, update, onPeriodStart };
})();