// ─────────────────────────────────────────────
// data/training.js  —  tipi di allenamento
// ─────────────────────────────────────────────
const TRAINING_TYPES = [
  {
    id:      'physical',
    name:    'Preparazione Atletica',
    desc:    'Migliora fitness e resistenza di tutta la rosa',
    icon:    '💪',
    cost:    15000,
    eff:     { fitness:8, att:1, def:1 },
    fatigue: 5,
  },
  {
    id:      'attack',
    name:    'Allenamento Attacco',
    desc:    'Sessione offensiva: aumenta pericolosità in attacco',
    icon:    '🎯',
    cost:    12000,
    eff:     { att:4, spe:2 },
    fatigue: 6,
  },
  {
    id:      'defense',
    name:    'Allenamento Difesa',
    desc:    'Migliora copertura difensiva e forza fisica',
    icon:    '🛡️',
    cost:    12000,
    eff:     { def:4, str:2 },
    fatigue: 6,
  },
  {
    id:      'tactics',
    name:    'Sessione Tattica',
    desc:    'Migliora intesa collettiva e movimenti coordinati',
    icon:    '📋',
    cost:    8000,
    eff:     { att:2, def:2, spe:2, str:2 },
    fatigue: 3,
  },
  {
    id:      'gk',
    name:    'Allenamento Portieri',
    desc:    'Sessione specifica: migliora overall dei portieri',
    icon:    '🥅',
    cost:    10000,
    eff:     { gk:5 },
    fatigue: 4,
  },
  {
    id:      'rest',
    name:    'Riposo e Recupero',
    desc:    'Recupero fisico e mentale — migliora fitness e morale',
    icon:    '🏖️',
    cost:    0,
    eff:     { fitness:12, morale:8 },
    fatigue: -10,
  },
];
