// ─────────────────────────────────────────────
// canvas/movement.js — AI e Logica di Gioco
// ─────────────────────────────────────────────

var MovementController = (function() {
  var _ms = null, _active = false;
  var _sprintDone = false;

  function init(ms) { _ms = ms; _active = true; _sprintDone = false; }
  function stop() { _active = false; }

  function update(dt) {
    if (!_active || !_ms || !_ms.running) return;
    var phase = poolGetPhase();

    if (phase === 'idle') return;

    if (phase === 'sprint' && !_sprintDone) {
      _handleSprint();
    } else if (phase === 'play') {
      _handlePlayLogic();
    }
  }

  function _handleSprint() {
    var my3 = _getToken('my_3');
    var opp3 = _getToken('opp_3');
    if (!my3 || !opp3) return;

    // Entrambi i '3' puntano al pallone al centro (0.5, 0.5)
    my3.tx = 0.5; my3.ty = 0.5;
    opp3.tx = 0.5; opp3.ty = 0.5;

    // Chi arriva prima a distanza di contatto (0.02)
    var dMy = Math.sqrt(Math.pow(my3.x-0.5,2)+Math.pow(my3.y-0.5,2));
    var dOpp = Math.sqrt(Math.pow(opp3.x-0.5,2)+Math.pow(opp3.y-0.5,2));

    if (dMy < 0.025) {
      _sprintDone = true;
      poolSetBallOwner('my_3');
      _firstPass('my');
    } else if (dOpp < 0.025) {
      _sprintDone = true;
      poolSetBallOwner('opp_3');
      _firstPass('opp');
    }
  }

  function _firstPass(team) {
    // Dopo aver preso la palla al centro, passala al numero 4
    var receiverKey = team + '_4';
    var receiver = _getToken(receiverKey);
    setTimeout(function() {
       poolSetBallOwner(null); // lancia
       poolMoveBall(receiver.x, receiver.y);
       setTimeout(function() { poolSetBallOwner(receiverKey); }, 600);
    }, 500);
  }

  function _handlePlayLogic() {
    // Qui andrebbe la logica dei tiri e delle parate attivata dal motore di gioco
    // Esempio parata: se il motore rileva parata, chiama poolSetBallOwner('my_GK')
  }

  function _getToken(key) {
    if (typeof poolGetTokens === 'function') return poolGetTokens()[key];
    return null;
  }

  return { init: init, stop: stop, update: update };
})();

window.MovementController = MovementController;