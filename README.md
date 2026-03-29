# Waterpolo

**Versione:** 0.1 beta  
**Campionato:** Serie A1 Maschile — Stagione 2025/26  
**Piattaforma:** Browser (HTML5 + CSS3 + JavaScript vanilla)  
**Dipendenze:** nessuna — zero librerie esterne, zero build step

---

## Cos'è

Waterpolo è un gioco manageriale di pallanuoto ispirato a Championship Manager. Il giocatore assume il ruolo di allenatore di una delle 14 squadre della Serie A1 italiana e guida il club attraverso una stagione completa: dalla gestione della rosa e degli allenamenti, alle convocazioni prima di ogni partita, fino a playoff e playout.

Le partite sono giocabili in modalità live con una vasca animata su Canvas HTML5, dove i pallini colorati rappresentano i giocatori in movimento e il pallone si sposta in tempo reale seguendo le azioni di gioco.

---

## Come si gioca

1. Aprire `index.html` in un browser moderno (Chrome, Firefox, Safari, Edge).
2. Scegliere una squadra dalla lista e premere **Nuova Carriera**.
3. Prima di ogni partita, accedere a **Convocazioni** per scegliere la formazione.
4. Durante la partita: avviare/mettere in pausa, cambiare tattica, effettuare cambi illimitati.
5. Al termine della regular season (26 giornate), affrontare playoff e playout.

> Il gioco funziona **offline** e non richiede alcun server. Basta il file `index.html` e la cartella `js/` e `css/` nella stessa directory.

---

## Struttura del progetto

```
waterpolo/
├── index.html                  ← Entry point — carica tutto in ordine
├── css/
│   └── styles.css              ← Tutti gli stili (374 righe)
└── js/
    ├── data/                   ← Dati statici, nessuna logica
    │   ├── teams.js            ← 14 squadre con forza, budget, tier
    │   ├── positions.js        ← Posizioni in vasca (1-6 + GK)
    │   ├── training.js         ← Tipi di allenamento e effetti
    │   └── objectives.js       ← Obiettivi stagionali per tier (S/A/B/C)
    ├── engine/                 ← Motore di gioco — logica pura, nessun DOM
    │   ├── generator.js        ← Generazione procedurale: giocatori, rose, calendario
    │   ├── standings.js        ← Classifica, aggiornamento risultati, simulazione
    │   ├── match.js            ← Motore partita: eventi, timer, cambi
    │   └── save.js             ← Sistema salvataggio a 3 slot (localStorage)
    ├── canvas/
    │   └── pool.js             ← Rendering vasca su Canvas HTML5, animazione token
    ├── ui/                     ← Componenti interfaccia — solo DOM, nessuna logica di gioco
    │   ├── tabs.js             ← Navigazione tab, aggiornamento header
    │   ├── welcome.js          ← Schermata iniziale, gestione slot di salvataggio
    │   ├── lineup.js           ← Schermata convocazioni e formazione
    │   ├── match.js            ← Schermata partita live, controlli, cambi
    │   └── tabs_renderers.js   ← Renderer di tutti gli 8 tab del gioco
    └── main.js                 ← Stato globale G, utility, playoff, auto-save, init
```

**Totale:** 17 file · 3.169 righe di codice

---

## Architettura

### Stato globale

Tutta la partita vive nell'oggetto `G`, dichiarato in `main.js` e condiviso tra tutti i moduli senza import/export (JavaScript vanilla con caricamento ordinato degli script).

```
G = {
  myId, myTeam, teams,          // squadre
  rosters,                       // rose { teamId: [player, ...] }
  schedule,                      // calendario { home, away, round, played, score }
  stand,                         // classifica { teamId: { pts, w, d, l, gf, ga } }
  budget, phase, msgs,           // stato generale
  objectives, trainWeeks,        // progressione
  lineup,                        // formazione scelta nelle convocazioni
  poBracket, plBracket,          // bracket playoff/playout
  ms,                            // stato partita live (null fuori dalla partita)
  _currentSlot,                  // slot localStorage attivo
}
```

`G.ms` (match state) non viene mai serializzato: contiene riferimenti al loop di animazione e al canvas che non sono serializzabili in JSON.

### Separazione engine / UI

I file in `engine/` non toccano mai il DOM. Ritornano valori o modificano `G` direttamente. I file in `ui/` leggono da `G` e scrivono `innerHTML` nei contenitori HTML. Il canvas (`canvas/pool.js`) è un caso a parte: mantiene uno stato di animazione interno (`_tokens`, `_ball`) separato da `G.ms`.

### Ordine di caricamento script

L'ordine degli `<script>` in `index.html` è vincolante:

```
data/* → engine/* → canvas/* → ui/* → main.js
```

`main.js` va sempre per ultimo perché referenzia funzioni definite in tutti gli altri file.

---

## Funzionalità — v0.1 beta

### Campionato
- 14 squadre della Serie A1 2025/26 (dati reali)
- Girone unico andata e ritorno (26 giornate)
- Classifica con differenza reti e gol fatti come criteri di spareggio
- Playoff scudetto (semifinali + finale, top 4)
- Play-out retrocessione (11°–13°, con retrocessione diretta 14°)

### Rosa e giocatori
- Rosa da 15 giocatori generati proceduralmente per ogni squadra
- 2 portieri + 3 DIF + 3 CEN + 4 ATT + 2 CAP + 1 extra
- Attributi: overall, potenziale, età, nazionalità, mano (destro/mancino, ~25% mancini)
- Statistiche stagionali: gol, assist, parate
- Attributi tecnici: ATT, DEF, SPE, STR

### Posizioni in vasca
Le posizioni seguono la numerazione ufficiale della pallanuoto italiana:

| Pos | Ruolo | Zona |
|-----|-------|------|
| GK  | Portiere | Porta nostra |
| 1   | RW — Ala destra | Terminale attacco |
| 2   | DR — Difensore destro | Zona difensiva |
| 3   | ATT centro | Attacco centrale |
| 4   | DL — Difensore sinistro | Zona difensiva |
| 5   | LW — Ala sinistra | Terminale attacco |
| 6   | CB — Centroboa | Terminale attacco |

### Convocazioni e formazione
- Schermata dedicata prima di ogni partita
- Campo visuale interattivo con slot cliccabili
- Assegnazione giocatore → posizione per click (o viceversa)
- Auto-formazione con selezione per affinità di ruolo
- Indicazione mano (L/R) per ogni giocatore

### Partita live
- Vasca animata su Canvas HTML5 (760×430 px)
- Token colorati per giocatori (blu = noi, rosso = avversario) con posizione numerata
- Pallone animato con interpolazione fluida
- Timer continuo: 4 periodi da 8 minuti
- Scorrimento automatico o manuale (pausa / avanza periodo)
- 5 tattiche selezionabili in tempo reale: Bilanciata, Attacco, Difesa, Contropiede, Pressione Alta
- Cambi illimitati (regola ufficiale pallanuoto)
- Log azioni in tempo reale con colori per tipo evento

### Allenamento
- 6 tipi di sessione: Preparazione Atletica, Attacco, Difesa, Tattica, Portieri, Riposo
- Effetti su fitness, morale, attributi tecnici
- Probabilità di crescita overall per i giocatori
- Storico sessioni completate

### Obiettivi stagionali
- Set di 3 obiettivi adattato al tier della squadra scelta
- Premi in denaro al raggiungimento
- Barre di avanzamento in tempo reale
- Riepilogo finale a stagione conclusa

### Mercato
- Lista dinamica di giocatori disponibili da acquistare
- Filtro per budget disponibile
- Trasferimento immediato della rosa

### Salvataggio
- 3 slot indipendenti su localStorage
- Anteprima slot con metadati (team, fase, giornata, posizione, budget)
- Auto-save dopo ogni azione rilevante (fine partita, acquisto, allenamento)
- Menu salvataggio in-game (icona 💾 nell'header)
- Sovrascrittura con conferma, eliminazione slot

---

## Roadmap — versioni future

- **v0.2** — Storico stagioni, statistiche personali allenatore, contratti giocatori
- **v0.3** — Trasferimenti con trattative, prestiti, parametri zero
- **v0.4** — Competizioni europee (Champions League, Euro Cup)
- **v0.5** — Modalità multigiornata con simulazione intrastagionale più profonda
- **v1.0** — Versione stabile con salvataggi multipli, tutorial integrato

---

## Note tecniche

- Nessun framework, nessun bundler, nessun server necessario
- Compatibile con tutti i browser moderni che supportano Canvas API e localStorage
- Lo stato partita live (`G.ms`) non è mai serializzato per evitare problemi con riferimenti a oggetti non serializzabili (canvas context, requestAnimationFrame handle)
- La separazione `engine/` vs `ui/` è concettuale (vanilla JS condivide lo scope globale); in una futura versione ES Modules permetterebbe import/export espliciti senza modificare la logica

---

## Licenza

Progetto sperimentale — uso personale e didattico.  
Dati squadre e classifiche: Serie A1 Pallanuoto FIN 2025/26.
