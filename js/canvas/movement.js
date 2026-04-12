// js/canvas/movement.js
var MovementController = (function() {
    var _active = false;
    return {
        init: function() { _active = true; },
        update: function(dt) {
            if (!_active) return;
            let phase = poolGetPhase();
            let tokens = poolGetTokens();
            if (phase === 'sprint') {
                if (tokens['my_3']) tokens['my_3'].tx = 0.5;
                if (tokens['opp_3']) tokens['opp_3'].tx = 0.5;
                // Controllo conquista
                let d = Math.sqrt(Math.pow(tokens['my_3'].x-0.5,2));
                if (d < 0.03) poolSetBallOwner('my_3');
            }
        }
    };
})();