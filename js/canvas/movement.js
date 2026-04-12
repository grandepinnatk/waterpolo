// js/canvas/movement.js

var MovementController = (function() {
    var _active = false, _ms = null;

    return {
        init: function(ms) { _ms = ms; _active = true; },
        stop: function() { _active = false; },

        // RISOLVE: MovementController.onPossessChange is not a function
        onPossessChange: function(side) {
            console.log("Cambio possesso: " + side);
        },

        update: function(dt) {
            if (!_active) return;
            let phase = poolGetPhase();
            let tokens = poolGetTokens();

            if (phase === 'sprint') {
                // I numeri 3 puntano al centro
                if (tokens['my_3']) { tokens['my_3'].tx = 0.5; tokens['my_3'].ty = 0.5; }
                if (tokens['opp_3']) { tokens['opp_3'].tx = 0.5; tokens['opp_3'].ty = 0.5; }

                // Chi arriva a contatto (0.03) vince lo sprint
                let t3 = tokens['my_3'];
                if (t3 && Math.sqrt(Math.pow(t3.x-0.5,2)+Math.pow(t3.y-0.5,2)) < 0.03) {
                    poolSetBallOwner('my_3');
                    // Simula un passaggio per sbloccare la fase di gioco
                    setTimeout(() => { poolMoveBall(0.7, 0.3); }, 500);
                }
            }
        }
    };
})();