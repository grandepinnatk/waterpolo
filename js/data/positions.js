// ─────────────────────────────────────────────
// data/positions.js  —  posizioni in vasca
// Coordinate normalizzate 0-1 (x, y)
// ─────────────────────────────────────────────

// Definizione tattica delle posizioni
// Pos 1 = RW (ala destra, terminale attacco)
// Pos 2 = DR (difensore destro)
// Pos 3 = ATT centro
// Pos 4 = DL (difensore sinistro)
// Pos 5 = LW (ala sinistra, terminale attacco)
// Pos 6 = CB (centroboa, terminale attacco)
// GK    = Portiere
const POSITIONS = {
  GK: { label:'POR',   desc:'Portiere',          role:'POR', x:0.50, y:0.88 },
  3:  { label:'3·ATT', desc:'Attaccante centro',  role:'ATT', x:0.50, y:0.62 },
  4:  { label:'4·DL',  desc:'Difensore sinistro', role:'DIF', x:0.22, y:0.52 },
  2:  { label:'2·DR',  desc:'Difensore destro',   role:'DIF', x:0.78, y:0.52 },
  5:  { label:'5·LW',  desc:'Ala sinistra',       role:'ATT', x:0.12, y:0.28 },
  6:  { label:'6·CB',  desc:'Centroboa',          role:'CAP', x:0.50, y:0.18 },
  1:  { label:'1·RW',  desc:'Ala destra',         role:'ATT', x:0.88, y:0.28 },
};

// Ordine di riempimento nella schermata convocazioni
const POS_KEYS = ['GK', '5', '6', '1', '4', '2', '3'];

// Posizioni avversario (specchiato verticalmente)
const OPP_POS = {
  GK: { x:0.50, y:0.12 },
  3:  { x:0.50, y:0.38 },
  4:  { x:0.78, y:0.48 },
  2:  { x:0.22, y:0.48 },
  5:  { x:0.88, y:0.72 },
  6:  { x:0.50, y:0.82 },
  1:  { x:0.12, y:0.72 },
};

// Posizioni "base" dei nostri in campo durante la partita
const MY_POS_MAP = {
  GK: { x:0.50, y:0.88 },
  5:  { x:0.12, y:0.28 },
  6:  { x:0.50, y:0.18 },
  1:  { x:0.88, y:0.28 },
  4:  { x:0.22, y:0.52 },
  2:  { x:0.78, y:0.52 },
  3:  { x:0.50, y:0.62 },
};

// Affinità ruolo → posizione (per auto-formazione)
const POS_ROLE_AFFINITY = {
  5: 'ATT',
  6: 'CAP',
  1: 'ATT',
  4: 'DIF',
  2: 'DIF',
  3: 'ATT',
};
