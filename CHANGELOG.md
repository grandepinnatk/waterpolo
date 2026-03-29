# CHANGELOG

Tutte le modifiche rilevanti al progetto sono documentate in questo file.  
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).  
Versioning: `MAJOR.MINOR patch` — in beta il MAJOR è fisso a 0.

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
- Cambi illimitati (regola ufficiale pallanuoto): pannello con selezione chi esce / chi entra
- Log azioni a scorrimento con colori per tipo evento (gol nostro, gol subito, parata, fallo, cambio)
- Pannello statistiche partita e marcatori in tempo reale
- Liste in campo / panchina con mano dominante visibile

#### Allenamento
- 6 tipologie di sessione: Preparazione Atletica, Allenamento Attacco, Allenamento Difesa, Sessione Tattica, Allenamento Portieri, Riposo e Recupero
- Effetti differenziati su fitness, morale, attributi tecnici (ATT/DEF/SPE/STR)
- Sessione portieri: bonus overall diretto per i POR
- Probabilità 12% per ogni giocatore di guadagnare +1 overall a ogni sessione
- Effetto fatica negativa sulla fitness dopo sessioni intense
- Storico sessioni completate con dettaglio effetti e costo

#### Obiettivi stagionali
- 3 obiettivi per stagione, calibrati sul tier della squadra scelta
  - Tier S: Scudetto, top 2 regular season, 40+ gol
  - Tier A: Qualificazione playoff, top 6, salvezza
  - Tier B: Top 8, salvezza, 10+ vittorie
  - Tier C: Salvezza, non ultimo, 5+ vittorie
- Premi in denaro al raggiungimento (50.000€ – 500.000€)
- Punteggi obiettivo (100–1000 pt) per riepilogo stagionale
- Barre di avanzamento percentuale per obiettivi misurabili
- Schermata riepilogo a stagione conclusa con totale punti e premi incassati

#### Mercato
- Lista dinamica di giocatori disponibili (generata da rose avversarie)
- Acquisto diretto con scalamento budget
- Trasferimento immediato della rosa (giocatore entra nella rosa del giocatore, esce da quella cedente)

#### Salvataggio
- Sistema a 3 slot indipendenti su `localStorage`
- Metadati per slot (team, fase, giornata, posizione, punti, vittorie, budget, data) letti separatamente senza deserializzare l'intero payload
- Auto-save automatico dopo ogni azione rilevante: fine partita, acquisto mercato, sessione allenamento, risultato playoff
- `G._currentSlot` traccia lo slot corrente per evitare prompt ripetuti
- Menu salvataggio in-game (icona 💾 nell'header) con scelta slot
- Bottone ⌂ per tornare alla welcome con auto-save preventivo
- Sovrascrittura slot con `confirm()` nativo del browser
- Eliminazione slot con conferma
- Modal chooser quando tutti e 3 gli slot sono occupati e si avvia una nuova carriera
- Toast di feedback per operazioni di salvataggio/eliminazione (auto-dismiss 3 s)

#### Struttura progetto
- Separazione in 17 file distinti (1 HTML, 1 CSS, 15 JS)
- Layer `data/`: dati statici puri senza logica (teams, positions, training, objectives)
- Layer `engine/`: motore di gioco senza dipendenze DOM (generator, standings, match, save)
- Layer `canvas/`: rendering vasca con stato animazione separato da `G.ms`
- Layer `ui/`: componenti interfaccia che leggono da G e scrivono nel DOM
- `main.js`: stato globale G, utility condivise, logica playoff, auto-save, init

---

## [Non rilasciato]

Funzionalità pianificate per le prossime versioni:

### v0.2 (in pianificazione)
- Storico stagioni con archivio campioni e statistiche pluriennali
- Contratti giocatori con scadenze e rinnovi
- Sistema morale più granulare (influenzato da risultati, stipendio, minuti giocati)
- Schermata allenatore con reputazione e storico personale

### v0.3 (in pianificazione)
- Mercato con trattative: offerte, controfferte, rifiuti
- Giocatori parametro zero e prestiti
- Scout system: scoperta di giocatori giovani nel vivaio

### v0.4 (in pianificazione)
- Competizioni europee: LEN Champions League, Euro Cup, Conference Cup
- Qualificazione europea basata su posizione finale
- Gestione doppio impegno campionato/coppe

### v0.5 (in pianificazione)
- Simulazione intra-stagionale più profonda con infortuni e squalifiche
- Finestre di mercato (gennaio + estate)
- Interfaccia dedicata tablet con touch ottimizzato

### v1.0 (obiettivo stabile)
- Tutorial integrato per nuovi giocatori
- Modalità carriera pluriennale con promozioni/retrocessioni
- Esportazione statistiche stagione
- Salvataggio su file (download/upload JSON) come alternativa a localStorage
