/**
 * js/ui/match.js
 * Coordinatore principale del match: lega il motore logico alla visualizzazione su canvas.
 */

var MatchUI = (function() {

  var _ms          = null;   // Riferimento allo stato partita (G.ms)
  var _lastTime    = 0;      // Per il calcolo del delta time
  var _active      = false;
  var _accumulated = 0;      // Accumulatore per scattare eventi di cronaca

  /**
   * Avvia l'interfaccia del match
   */
  function init(ms) {
    _ms = ms;
    if (!_ms) return;

    _active = true;
    _lastTime = performance.now();
    _accumulated = 0;

    // Inizializza i componenti grafici e il controller dei movimenti
    poolInit(_ms);
    MovementController.init(_ms);

    // Imposta le velocità iniziali basate sulle stats reali
    if (typeof poolSetSpeeds === 'function') {
      poolSetSpeeds(_ms);
    }

    // Avvia il loop di animazione
    requestAnimationFrame(_animLoop);
    
    console.log("MatchUI: Inizializzato con successo");
  }

  /**
   * Loop principale (Rendering + Logica UI)
   */
  function _animLoop(now) {
    if (!_active || !_ms || !_ms.running) return;

    // 1. Calcolo del tempo trascorso (Delta Time)
    var dt = (now - _lastTime) / 1000; 
    _lastTime = now;

    // Applichiamo il moltiplicatore di velocità del gioco (se presente in ms)
    var speedMult = _ms.gameSpeed || 1;
    var gameDt = dt * speedMult;

    // 2. Aggiornamento logico dei movimenti (IA e Tattica)
    // MovementController decide DOVE devono andare i giocatori
    MovementController.update(gameDt);

    // 3. Aggiornamento fisico dei segnalini (Animazione fluida)
    // poolAnimStep muove i cerchi verso la destinazione alla velocità corretta
    poolAnimStep(dt); 

    // 4. Gestione della Telecronaca (Eventi)
    _accumulated += gameDt;
    
    // Genera un evento mediamente ogni 8-12 secondi di gioco
    var nextThreshold = 8 + Math.random() * 4;
    if (_accumulated >= nextThreshold) {
      _accumulated = 0;
      _triggerMatchEvent();
    }

    // 5. Rendering su Canvas
    poolDraw();

    // Ciclo continuo
    requestAnimationFrame(_animLoop);
  }

  /**
   * Invoca il motore per generare un testo di cronaca e aggiorna la grafica
   */
  function _triggerMatchEvent() {
    // Chiamata al motore logico (MatchEngine deve essere caricato)
    var event = MatchEngine.generateMatchEvent(_ms);
    
    if (event) {
      // Scrive la telecronaca a video
      _appendLog(event.txt, event.cls);

      // Sincronizzazione fisica: la stamina cala, quindi aggiorniamo le velocità
      if (typeof poolSetSpeeds === 'function') {
        poolSetSpeeds(_ms);
      }

      // Se l'evento prevede un movimento palla specifico (es. tiro o passaggio)
      if (event.ballTarget) {
        if (event.isGoal) {
          poolShootAndScore(event.ballTarget.x, event.ballTarget.y, event.player, event.team);
        } else {
          poolMoveBall(event.ballTarget.x, event.ballTarget.y);
        }
      }

      // Se l'evento cambia il possesso palla
      if (event.possessionChange) {
        MovementController.onPossessChange(event.possessionChange);
      }
    }
  }

  /**
   * Aggiunge un messaggio al log della telecronaca nell'HTML
   */
  function _appendLog(txt, cls) {
    var logEl = document.getElementById('match-log-container');
    if (!logEl) return;

    var div = document.createElement('div');
    div.className = 'log-entry ' + (cls || '');
    
    // Formattazione tempo (es. [02:15])
    var timeStr = _formatMatchTime(_ms.gameTime || 0);
    div.innerHTML = "<strong>[" + timeStr + "]</strong> " + txt;

    logEl.prepend(div); // Il messaggio più recente appare in alto
  }

  function _formatMatchTime(totalSeconds) {
    var m = Math.floor(totalSeconds / 60);
    var s = Math.floor(totalSeconds % 60);
    return (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
  }

  /**
   * Ferma il match
   */
  function stop() {
    _active = false;
    MovementController.stop();
  }

  // API Pubblica
  return {
    init: init,
    stop: stop
  };

})();