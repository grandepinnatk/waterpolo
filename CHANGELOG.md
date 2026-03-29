# CHANGELOG

Tutte le modifiche rilevanti al progetto sono documentate in questo file.  
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).  
Versioning: `MAJOR.MINOR.PATCH` — in beta il MAJOR è fisso a 0.

---

## [0.1.8-beta] — 2026-03-29

### Aggiunto

#### Convocazioni — numeri maglia manuali
- Ogni convocato ha ora un campo numerico editabile (1–13) direttamente nella lista giocatori
- I numeri sono univoci: se assegni un numero già usato da un altro giocatore, quello viene automaticamente rimosso dal precedente
- Il bottone "Auto-Formazione" assegna i numeri automaticamente (titolari 1–7, riserve 8–13)
- Il pulsante "Inizia Partita" rimane disabilitato finché tutti i convocati non hanno un numero assegnato e non ci sono duplicati

#### Formazione ricordata
- La formazione, i convocati e i numeri di maglia vengono salvati in `G.savedLineup` al momento della conferma
- Alla partita successiva la schermata convocazioni si apre già con la formazione precedente caricata, pronta per le eventuali modifiche
- `savedLineup` è incluso nel payload di salvataggio su slot localStorage e viene ripristinato al caricamento

#### Drag-and-drop
- I giocatori convocati possono essere trascinati (drag) dalla lista direttamente sulle posizioni in campo
- Durante il drag le posizioni mostrano un bordo dorato come feedback visivo del drop target
- Rimane disponibile anche il metodo click-to-place (click su giocatore → click su posizione)
- Doppio click su un giocatore nella lista per rimuoverlo dai convocati

### Modificato
- `ui/lineup.js` — riscritto completamente; rimossa la patch IIFE su `confirmLineup`; `confirmLineup` ora salva in `G.savedLineup`
- `engine/save.js` — aggiunto `savedLineup` al payload `_buildPayload` e ad `applyLoadedSave`
- `ui/welcome.js` — aggiunto `savedLineup: null` allo stato iniziale di gioco

---

## [0.1.7-beta] — 2026-03-29

### Aggiunto
- I giocatori in panchina recuperano gradualmente la stamina durante la partita (tasso: `STAMINA_BENCH_RECOVERY = 0.0012/s`, circa 1/3 del calo base in campo)
- Il recupero è visibile in tempo reale nella barra stamina della lista panchina e nel pannello cambi
- I giocatori espulsi recuperano anch'essi (sono fermi, non giocano)

---

## [0.1.6-beta] — 2026-03-29

### Aggiunto

#### Stamina giocatori
- Ogni giocatore in campo ha una barra stamina visibile (verde >65%, gialla 35-65%, rossa <35%) aggiornata in tempo reale
- La stamina parte dal valore di fitness del giocatore e cala durante la partita
- Il calo dipende da due fattori:
  - **Tattica**: Difesa −30% calo, Bilanciata base, Contropiede +10%, Attacco +30%, Pressing Alto +60%
  - **Forma fisica**: giocatori con fitness bassa si stancano più velocemente
- La stamina è visibile anche nel pannello cambi (badge ⚡%) per aiutare le scelte del coach

#### Efficacia fuori ruolo
- Ogni posizione ha un ruolo nativo (GK→POR, 1→ATT, 2→DIF, 4→DIF, 3→CEN, 5→ATT, 6→CB)
- Se un giocatore copre una posizione fuori dal suo ruolo, la sua efficacia nel motore viene ridotta (fattore 0.35–1.0 da matrice `ROLE_ADJACENCY`)
- Nel pannello cambi appare un avviso ⚠ o ⚠⚠ quando il giocatore entrante è fuori ruolo rispetto alla posizione da coprire

### Corretto

#### Espulsioni temporanee — ribilanciamento
- Nuova architettura: probabilità di fallo = `BASE_FOUL_PROB × TACTIC_FOUL_MULT[tactic]`
- `BASE_FOUL_PROB = 0.050`, moltiplicatori: Difesa×0.40, Bilanciata×0.75, Contropiede×0.90, Attacco×1.00, Pressing×1.10
- Selezione del giocatore che commette fallo pesata: chi ha già 1 giallo pesa 0.35, chi ne ha 2 pesa 0.08 (i giocatori ammoniti giocano più cauti)
- Hard cap a 3 espulsioni definitive per partita: mai scende sotto 4 giocatori in campo
- Calibrato su 200.000 simulazioni Monte Carlo — distribuzione attesa per tattica bilanciata: 72% nessuna esp., 20% una, 8% due o più

### Modificato
- `engine/match.js` — aggiunte costanti `BASE_FOUL_PROB`, `TACTIC_FOUL_MULT`, `YELLOW_WEIGHTS`, `MAX_EXPELLED`, `POS_NATIVE_ROLE`, `ROLE_ADJACENCY`, `STAMINA_BASE_DRAIN`, `TACTIC_STAMINA_MULT`; nuove funzioni `_drainStamina()`, `_roleEffectiveness()`, `_weightedPick()`; `createMatchState` include `stamina`; `advanceTime` chiama `_drainStamina`; `generateMatchEvent` usa efficacia pesata e foul pesati
- `ui/match.js` — `renderFieldLists` mostra barra stamina per i giocatori in campo; `_renderSubLists` mostra badge ⚡stamina e avviso fuori-ruolo per i giocatori in panchina

---

## [0.1.5-beta] — 2026-03-29

### Corretto
- Ribilanciata la probabilità di espulsione temporanea: da 0.28 a **0.03** per evento neutro
- Risultato: ~5 falli per partita (era ~21), espulsione definitiva in media 1 ogni 4 partite (era 7 per partita), situazione con meno di 5 giocatori in campo quasi improbabile (0.24% dei casi, era 100%)
- La soglia è stata calcolata con simulazione Monte Carlo su 50.000 partite per garantire che la perdita a tavolino per inferiorità numerica rimanga un evento eccezionale

---

## [0.1.4-beta] — 2026-03-29

### Modificato
- Sigla ruolo **CAP** rinominata **CB** (Centroboa) in tutta la codebase per uniformità con la nomenclatura ufficiale della pallanuoto italiana
- Aggiornati: `data/positions.js`, `engine/generator.js`, `ui/tabs_renderers.js`

---

## [0.1.3-beta] — 2026-03-29

### Aggiunto
- Pallini circolari affianco al nome di ogni giocatore per indicare le espulsioni temporanee ricevute: giallo per la 1ª e 2ª, rosso per la 3ª (espulsione definitiva)
- I pallini sono visibili in tutte e tre le viste: lista **In campo**, lista **Panchina**, pannello **Cambio giocatore**
- I giocatori definitivamente espulsi rimangono visibili nelle liste (barrati e in trasparenza) con la dicitura **ESPULSO** per permettere all'allenatore di tenere traccia della situazione

---

## [0.1.2-beta] — 2026-03-29

### Corretto

#### Velocità simulazione
- `setSpeed` spostata in `main.js` (caricato per ultimo): era in `ui/match.js` ma un errore runtime in `pool.js` durante il primo frame interrompeva il caricamento dello script, lasciando la funzione non registrata nel global scope → errore "setSpeed is not defined"
- Rimossi tutti gli usi di `ctx.roundRect()` in `canvas/pool.js`: l'API è disponibile solo da Chrome 99+ / Safari 15.4+; sostituita con `ctx.fillRect()` compatibile con tutti i browser moderni
- Il moltiplicatore di velocità ora scala correttamente sia il timer di gioco (`advanceTime` riceve `rawDt`, moltiplica per `ms.speed` internamente) sia la frequenza degli eventi (il loop accumula `rawDt * speed` per il trigger degli eventi)
- A velocità elevate (10x, 15x, 20x) il loop gestisce ora più eventi per frame con un ciclo `while`, evitando che i secondi scorrano senza azioni visibili nel log

---

## [0.1.1-beta] — 2026-03-29

### Aggiunto

#### Vasca animata — nomi e numeri
- Nome del giocatore (cognome) visualizzato affianco al pallino durante la partita, su sfondo semitrasparente per la leggibilità
- Numero di maglia visibile dentro il token (in alto) e nella tabella in campo / panchina
- Numeri maglia assegnati automaticamente in fase di conferma convocazioni: titolari 1–7 (seguendo l'ordine delle posizioni GK→5→6→1→4→2→3), riserve dall'8 in poi

#### Espulsioni temporanee
- Ogni fallo genera un'espulsione temporanea (`🟡`) con contatore visibile nel log (es. "1/3", "2/3")
- Alla terza espulsione temporanea il giocatore riceve la `🔴` espulsione definitiva ed è rimosso dal campo
- Cambio forzato automatico: il motore cerca il primo sostituto disponibile in panchina per la posizione lasciata libera
- Il token del giocatore espulso sparisce dalla vasca
- Nella lista in campo i giocatori espulsi appaiono con dicitura **ESPULSO** in rosso
- Cartellini gialli visibili come rettangoli colorati affianco al nome sia in vasca che nella tabella laterale (diventano rossi al raggiungimento del limite)
- I giocatori espulsi sono disabilitati e non selezionabili nel pannello cambi

#### Velocità di simulazione
- Cinque livelli di velocità selezionabili durante la partita: **1x · 2x · 10x · 15x · 20x**
- Il bottone attivo viene evidenziato in blu
- La velocità agisce sia sul timer che sulla frequenza degli eventi di gioco

### Corretto

#### Pannello cambi
- Premendo "↔ Cambio" la partita viene messa automaticamente in pausa
- Due liste separate e scrollabili: giocatori in campo (esce) e giocatori in panchina (entra)
- Selezione visiva con spunta ✓ sul giocatore scelto
- Numero di maglia, ruolo e mano dominante visibili in entrambe le liste
- Il bottone "Conferma Cambio" si attiva solo dopo aver selezionato entrambi i giocatori
- Il log registra il cambio con i numeri di maglia di entrambi i giocatori
- I giocatori espulsi sono marcati e non selezionabili

### Modificato
- `engine/match.js` — aggiunta costante `MAX_TEMP_EXP`, tracciamento `tempExp` e `expelled` nello stato partita, nuova funzione `forceSubstitutionExpelled()`, velocità `ms.speed` applicata in `advanceTime()`
- `canvas/pool.js` — token ridisegnati con nome, numero maglia e indicatori cartellino; nuove funzioni `poolSyncTokens()` e `poolUpdateToken()` aggiornate per riflettere espulsioni
- `ui/match.js` — riscritto `openSub()` con pausa automatica, `_renderSubLists()` con liste dettagliate, `setSpeed()` e `_setSpeedUI()`, gestione evento espulsione `_handleExpulsion()`
- `ui/lineup.js` — aggiunta assegnazione `shirtNumbers` in `confirmLineup()`, salvata in `G.lineup`

---

## [0.1.0-beta] — 2026-03-29

Prima release pubblica. Gioco funzionante end-to-end: dalla selezione della squadra alla chiusura della stagione con playoff e playout.

### Aggiunto

#### Campionato
- 14 squadre della Serie A1 maschile 2025/26 con dati reali (nome, città, budget, forza relativa, tier S/A/B/C)
- Calendario generato proceduralmente con algoritmo round-robin: girone unico, andata e ritorno (26 giornate)
- Classifica in tempo reale con criteri di ordinamento: punti → differenza reti → gol fatti
- Simulazione rapida singola giornata e simulazione intera stagione
- Fase playoff (top 4): semifinali + finale scudetto, con possibilità di giocare live o simulare
- Fase playout (11°–13°): due turni a eliminazione; retrocessione diretta per il 14°

#### Rosa e giocatori
- Generazione procedurale di rose da 15 giocatori per ciascuna delle 14 squadre
- Composizione standard: 2 POR · 3 DIF · 3 CEN · 4 ATT · 2 CAP · 1 DIF extra
- Attributi per giocatore: nome, età, nazionalità, mano dominante (destro/mancino con ~25% mancini), overall, potenziale, valore, stipendio, fitness, morale
- Attributi tecnici: ATT, DEF, SPE, STR
- Statistiche stagionali per giocatore: gol, assist, parate
- Modale dettaglio giocatore con barre attributi e storico stagionale

#### Posizioni in vasca
- Implementazione delle 7 posizioni ufficiali della pallanuoto italiana
- Pos 1 (RW) e 5 (LW): terminali d'attacco — ale destra e sinistra
- Pos 6 (CB): centroboa — terminale d'attacco centrale
- Pos 2 (DR) e 4 (DL): difensori destro e sinistro
- Pos 3 (ATT): attaccante/centromediano
- GK: portiere

#### Convocazioni e formazione
- Schermata dedicata prima di ogni partita (regular season e playoff)
- Rappresentazione grafica della vasca con 7 slot posizionali cliccabili
- Assegnazione giocatore → posizione per doppio click (posizione poi giocatore o viceversa)
- Auto-formazione con selezione per affinità di ruolo
- Validazione formazione: portiere obbligatorio, tutte le posizioni devono essere coperte
- Indicazione mano dominante (L/R) per ogni giocatore nella lista selezione

#### Partita live
- Vasca animata su Canvas HTML5 (760×430 px) con linee dei 2m e 5m
- Token giocatori colorati (blu = squadra del giocatore, rosso = avversario) con numero di posizione
- Pallone animato con interpolazione fluida verso la destinazione dell'azione
- Timer continuo: 4 periodi da 8 minuti ciascuno (32 minuti totali)
- Modalità play/pausa con bottone avanza-periodo
- 5 tattiche selezionabili in tempo reale: Bilanciata, Attacco, Difesa, Contropiede, Pressione Alta
- Cambi illimitati (regola ufficiale pallanuoto)
- Log azioni a scorrimento con colori per tipo evento
- Pannello statistiche partita e marcatori in tempo reale

#### Allenamento
- 6 tipologie di sessione: Preparazione Atletica, Allenamento Attacco, Allenamento Difesa, Sessione Tattica, Allenamento Portieri, Riposo e Recupero
- Effetti differenziati su fitness, morale, attributi tecnici
- Probabilità 12% per ogni giocatore di guadagnare +1 overall a ogni sessione
- Storico sessioni completate

#### Obiettivi stagionali
- 3 obiettivi per stagione calibrati sul tier della squadra
- Premi in denaro al raggiungimento
- Barre di avanzamento percentuale in tempo reale
- Riepilogo finale a stagione conclusa

#### Mercato
- Lista dinamica di giocatori disponibili da acquistare
- Acquisto diretto con scalamento budget

#### Salvataggio
- Sistema a 3 slot indipendenti su localStorage
- Anteprima slot con metadati (team, fase, giornata, posizione, budget, data)
- Auto-save dopo ogni azione rilevante
- Menu salvataggio in-game (icona 💾 nell'header)
- Sovrascrittura con conferma, eliminazione slot

#### Struttura progetto
- Separazione in 17 file distinti (1 HTML, 1 CSS, 15 JS)
- Layer `data/`: dati statici puri (teams, positions, training, objectives)
- Layer `engine/`: motore di gioco senza dipendenze DOM (generator, standings, match, save)
- Layer `canvas/`: rendering vasca con stato animazione separato da `G.ms`
- Layer `ui/`: componenti interfaccia
- `main.js`: stato globale G, utility condivise, logica playoff, auto-save, init

---

## [Non rilasciato]

### v0.2 (in pianificazione)
- Storico stagioni con archivio campioni e statistiche pluriennali
- Contratti giocatori con scadenze e rinnovi
- Sistema morale più granulare (influenzato da risultati, stipendio, minuti giocati)
- Schermata allenatore con reputazione e storico personale

### v0.3 (in pianificazione)
- Mercato con trattative: offerte, controfferte, rifiuti
- Giocatori parametro zero e prestiti
- Scout system: scoperta di talenti nel vivaio

### v0.4 (in pianificazione)
- Competizioni europee: LEN Champions League, Euro Cup, Conference Cup
- Gestione doppio impegno campionato/coppe

### v0.5 (in pianificazione)
- Infortuni e squalifiche
- Finestre di mercato (gennaio + estate)
- Interfaccia touch ottimizzata per tablet

### v1.0 (obiettivo stabile)
- Tutorial integrato per nuovi giocatori
- Modalità carriera pluriennale con promozioni/retrocessioni
- Salvataggio su file (download/upload JSON) come alternativa a localStorage
