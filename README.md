# Waterpolo

**Versione:** 0.5.25 beta  
**Campionato:** Serie A1 Maschile — Stagione 2025/26  
**Piattaforma:** Browser (HTML5 + CSS3 + JavaScript vanilla)  
**Dipendenze:** nessuna — zero librerie esterne, zero build step

---

## Cos'è

Waterpolo è un gioco manageriale di pallanuoto ispirato a Championship Manager. Il giocatore assume il ruolo di allenatore di una delle 14 squadre della Serie A1 italiana e guida il club attraverso una stagione completa: dalla gestione della rosa e degli allenamenti, alle convocazioni prima di ogni partita, fino a playoff e playout.

Le partite sono giocabili in modalità live con una vasca animata su Canvas HTML5, dove i token colorati mostrano nome, numero di maglia e cartellini del giocatore, e il pallone si sposta in tempo reale seguendo le azioni.

---

## Come si gioca

1. Aprire `index.html` in un browser moderno (Chrome, Firefox, Safari, Edge)
2. Scegliere una squadra e premere **Nuova Carriera**
3. Prima di ogni partita, andare su **Convocazioni** per scegliere formazione e posizioni
4. Durante la partita: avviare/mettere in pausa, scegliere la velocità, cambiare tattica, effettuare cambi
5. Al termine della regular season (26 giornate), affrontare playoff e playout

> Il gioco funziona **offline** e non richiede alcun server. Basta `index.html` con le cartelle `js/` e `css/` nella stessa directory.

---

## Struttura del progetto

```
waterpolo/
├── index.html                  ← Entry point — carica tutto in ordine
├── css/
│   └── styles.css              ← Tutti gli stili (394 righe)
└── js/
    ├── data/                   ← Dati statici, nessuna logica
    │   ├── teams.js            ← 14 squadre con forza, budget, tier
    │   ├── positions.js        ← Posizioni in vasca (1-6 + GK)
    │   ├── training.js         ← Tipi di allenamento e effetti
    │   └── objectives.js       ← Obiettivi stagionali per tier (S/A/B/C)
    ├── engine/                 ← Motore di gioco — logica pura, nessun DOM
    │   ├── generator.js        ← Generazione procedurale: giocatori, rose, calendario
    │   ├── standings.js        ← Classifica, aggiornamento risultati, simulazione
    │   ├── match.js            ← Motore partita: eventi, timer, cambi, espulsioni
    │   └── save.js             ← Sistema salvataggio a 3 slot (localStorage)
    ├── canvas/
    │   └── pool.js             ← Rendering vasca, animazione token con nome/numero/gialli
    ├── ui/                     ← Componenti interfaccia — solo DOM, nessuna logica di gioco
    │   ├── tabs.js             ← Navigazione tab, aggiornamento header
    │   ├── welcome.js          ← Schermata iniziale, gestione slot di salvataggio
    │   ├── lineup.js           ← Convocazioni, formazione, assegnazione numeri maglia
    │   ├── match.js            ← Partita live: controlli, velocità, cambi, espulsioni
    │   └── tabs_renderers.js   ← Renderer degli 8 tab del gioco
    └── main.js                 ← Stato globale G, utility, playoff, auto-save, init
```

**Totale:** 17 file · 3.667 righe di codice

---

## Architettura

### Stato globale

Tutta la partita vive nell'oggetto `G`, dichiarato in `main.js` e condiviso tra tutti i moduli (JavaScript vanilla, caricamento ordinato degli script).

```
G = {
  myId, myTeam, teams,          // squadre
  rosters,                       // rose { teamId: [player, ...] }
  schedule,                      // calendario
  stand,                         // classifica
  budget, phase, msgs,           // stato generale
  objectives, trainWeeks,        // progressione
  lineup: {                      // convocazioni
    formation,                   //   { posKey → rosterIdx }
    convocati,                   //   [rosterIdx, ...]
    shirtNumbers,                //   { rosterIdx → numero }
  },
  poBracket, plBracket,          // bracket playoff/playout
  ms: {                          // stato partita live
    onField, bench,              //   formazione corrente
    tempExp, expelled,           //   espulsioni temporanee / definitive
    shirtNumbers,                //   numeri di maglia
    speed,                       //   moltiplicatore velocità (1/2/10/15/20)
    ...
  },
  _currentSlot,                  // slot localStorage attivo
}
```

`G.ms` non viene mai serializzato: contiene riferimenti al loop di animazione.

### Separazione engine / UI

I file in `engine/` non toccano mai il DOM. I file in `ui/` leggono da `G` e scrivono `innerHTML`. Il canvas (`canvas/pool.js`) mantiene uno stato di animazione interno (`_tokens`, `_ball`) separato da `G.ms`.

### Ordine di caricamento script

```
data/* → engine/* → canvas/* → ui/* → main.js
```

---

## Funzionalità — v0.1.1 beta

### Campionato
- 14 squadre della Serie A1 2025/26
- Girone unico andata e ritorno (26 giornate)
- Playoff scudetto (top 4) + play-out retrocessione (11°–13°) + retrocessione diretta (14°)

### Rosa e giocatori
- 15 giocatori per squadra generati proceduralmente
- Mano dominante (R/L, ~25% mancini), overall, potenziale, attributi tecnici
- Statistiche stagionali: gol, assist, parate

### Posizioni in vasca

| Pos | Ruolo | Zona |
|-----|-------|------|
| GK  | Portiere | Porta nostra |
| 1   | RW — Ala destra | Terminale attacco |
| 2   | DR — Difensore destro | Difesa |
| 3   | ATT centro | Attacco centrale |
| 4   | DL — Difensore sinistro | Difesa |
| 5   | LW — Ala sinistra | Terminale attacco |
| 6   | CB — Centroboa | Terminale attacco |

### Convocazioni e formazione
- Campo visuale interattivo con slot cliccabili
- Assegnazione giocatore → posizione per click
- Auto-formazione per affinità di ruolo
- Numeri di maglia assegnati automaticamente (titolari 1–7, riserve 8+)

### Partita live
- Vasca animata su Canvas HTML5 (760×430 px)
- Token con **cognome**, **numero di maglia** e **indicatori cartellini** visibili in campo
- Pallone animato con interpolazione fluida
- Timer: 4 periodi × 8 minuti
- **5 velocità**: 1x · 2x · 10x · 15x · 20x (funzionanti su tutti i browser moderni)
- 5 tattiche selezionabili in tempo reale
- Cambi illimitati con pannello dedicato (pausa automatica all'apertura)
- Pallini espulsioni temporanee (🟡🟡🔴) affianco al nome in campo, panchina e pannello cambi

### Espulsioni temporanee
- Ogni fallo = espulsione temporanea 🟡 con counter visibile (1/3, 2/3)
- Alla 3ª espulsione: 🔴 espulsione definitiva, cambio forzato automatico
- Giocatori espulsi non selezionabili nei cambi, token rimosso dalla vasca

### Allenamento
- 6 tipi di sessione con effetti su fitness, morale, attributi
- Storico sessioni completate

### Obiettivi stagionali
- 3 obiettivi per tier con premi in denaro e barre avanzamento

### Mercato
- Lista dinamica di giocatori acquistabili

### Salvataggio
- 3 slot indipendenti su localStorage
- Auto-save dopo ogni azione rilevante
- Menu 💾 in-game, bottone ⌂ per tornare al menu

---

## Roadmap

- **v0.2** — Storico stagioni, contratti, sistema morale avanzato
- **v0.3** — Mercato con trattative, prestiti, parametro zero
- **v0.4** — Competizioni europee
- **v0.5** — Infortuni, squalifiche, finestre mercato
- **v1.0** — Tutorial, carriera pluriennale, salvataggio su file

---

## Note tecniche

- Nessun framework, nessun bundler, nessun server necessario
- Compatibile con tutti i browser moderni che supportano Canvas API e localStorage
- `G.ms` non è mai serializzato (contiene handle di animazione)
- La separazione `engine/` vs `ui/` è concettuale (vanilla JS condivide lo scope globale)

---

## Licenza

Progetto sperimentale — uso personale e didattico.  
Dati squadre e classifiche: Serie A1 Pallanuoto FIN 2025/26.
