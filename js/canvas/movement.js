// js/canvas/movement.js
var MovementController = (function() {
    var _ms = null, _active = false;

    return {
        init: function(ms) { _ms = ms; _active = true; },
        stop: function() { _active = false; },
        
        // Risolve l'errore: MovementController.onPossessChange is not a function
        onPossessChange: function(side) {
            console.log("Possesso passato a: " + side);
        },

        update: function(dt) {
            if (!_active) return;
            let phase = poolGetPhase();
            let tokens = poolGetTokens();
            
            if (phase === 'sprint') {
                if (tokens['my_3']) tokens['my_3'].tx = 0.5;
                if (tokens['opp_3']) tokens['opp_3'].tx = 0.5;

                let dMy = tokens['my_3'] ? Math.sqrt(Math.pow(tokens['my_3'].x-0.5,2)+Math.pow(tokens['my_3'].y-0.5,2)) : 1;
                if (dMy < 0.03) {
                    poolSetBallOwner('my_3');
                    // Dopo lo sprint passiamo alla fase di gioco
                    setTimeout(() => { if(typeof _phase !== 'undefined') _phase = 'play'; }, 500);
                }
            }
        }
    };
})();