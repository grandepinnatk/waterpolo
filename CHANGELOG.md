# CHANGELOG

Tutte le modifiche rilevanti al progetto sono documentate in questo file.  
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/).  
Versioning: `MAJOR.MINOR.PATCH` — in beta il MAJOR è fisso a 0.

---

## [0.3.4-beta] — 2026-03-31

### Aggiunto

#### Allenamento Tecnica
- Nuovo tipo di allenamento: **🤽 Allenamento Tecnico** (costo €14.000, fatica 5)
- Migliora l'attributo TEC di tutta la rosa fino a +4 punti a sessione (casuale)
- Ogni giocatore ha un **massimo di Tecnica raggiungibile** (`maxTec`) generato alla creazione della rosa — attributo nascosto, non visibile al giocatore
  - Range: da overall−5 a overall+15, con un bonus extra per i giovani (età < 24: +0/+8)
  - Una volta raggiunto il proprio tetto, ulteriori sessioni tecniche non producono miglioramenti
- I giocatori già a `maxTec` non guadagnano punti dall'allenamento tecnico

---

## [0.3.3-beta] — 2026-03-31

### Aggiunto

#### Attributo Tecnica (TEC)
- Ogni giocatore generato ha ora l'attributo `tec` (0-100) visibile nella scheda giocatore come **TEC**
- **Finalizzazione**: la Tecnica aggiunge un bonus/malus alla probabilità di segnare (±4% rispetto alla media, centrato su tec=50)
- **Assist**: i giocatori con tecnica più alta hanno maggiore probabilità di servire il passaggio decisivo (selezione pesata per tec)
- **Errori di passaggio**: probabilità di perdita palla in costruzione inversamente proporzionale alla tecnica — da ~15% (tec=0) a ~2% (tec=100); l'errore genera l'evento "❌ Palla persa — X sbaglia il passaggio"

---

## [0.3.2-beta] — 2026-03-31

### Modificato
- Scheda giocatore: attributi rinominati — `DEF` → **DIF**, `SPE` → **VEL**, `STR` → **FOR** (ATT rimane invariato)

---

## [0.3.1-beta] — 2026-03-31

### Modificato
- Tabella Rosa: colonne `G` e `A` rinominate in `GOL` e `ASS`

---

## [0.3.0-beta] — 2026-03-31

### Modificato
- Formato nomi giocatori cambiato da "I. Cognome" a **"Cognome I."** (es. "Rossi M.") in tutta la codebase
- Tabelle **In campo** e **Panchina**: mostrano solo il cognome (es. "Rossi") per massima leggibilità nelle colonne strette
- **Vasca** (canvas) e log azioni: mostrano il formato completo "Cognome I."
- Modale Rosa e altre schermate: formato completo "Cognome I."

---

## [0.3.4-beta] — 2026-03-31

### Aggiunto

#### Allenamento Tecnica
- Nuovo tipo di allenamento: **🤽 Allenamento Tecnico** (costo €14.000, fatica 5)
- Migliora l'attributo TEC di tutta la rosa fino a +4 punti a sessione (casuale)
- Ogni giocatore ha un **massimo di Tecnica raggiungibile** (`maxTec`) generato alla creazione della rosa — attributo nascosto, non visibile al giocatore
  - Range: da overall−5 a overall+15, con un bonus extra per i giovani (età < 24: +0/+8)
  - Una volta raggiunto il proprio tetto, ulteriori sessioni tecniche non producono miglioramenti
- I giocatori già a `maxTec` non guadagnano punti dall'allenamento tecnico

---

## [0.3.3-beta] — 2026-03-31

### Aggiunto

#### Attributo Tecnica (TEC)
- Ogni giocatore generato ha ora l'attributo `tec` (0-100) visibile nella scheda giocatore come **TEC**
- **Finalizzazione**: la Tecnica aggiunge un bonus/malus alla probabilità di segnare (±4% rispetto alla media, centrato su tec=50)
- **Assist**: i giocatori con tecnica più alta hanno maggiore probabilità di servire il passaggio decisivo (selezione pesata per tec)
- **Errori di passaggio**: probabilità di perdita palla in costruzione inversamente proporzionale alla tecnica — da ~15% (tec=0) a ~2% (tec=100); l'errore genera l'evento "❌ Palla persa — X sbaglia il passaggio"

---

## [0.3.2-beta] — 2026-03-31

### Modificato
- Scheda giocatore: attributi rinominati — `DEF` → **DIF**, `SPE` → **VEL**, `STR` → **FOR** (ATT rimane invariato)

---

## [0.3.1-beta] — 2026-03-31

### Modificato
- Tabella Rosa: colonne `G` e `A` rinominate in `GOL` e `ASS`

---

## [0.3.0-beta] — 2026-03-31

### Aggiunto

#### Marcatori partita in corso
- La lista marcatori nella schermata partita mostra ora **solo i gol segnati nella partita in corso**, non il totale stagionale
- Implementato tracciamento `ms.matchGoals` e `ms.matchAssists` nello stato partita: incrementati ad ogni gol nel motore
- La lista si azzera ad ogni nuova partita

#### Tab Marcatori nella sezione Classifica
- Nuova navigazione a due tab nella sezione Classifica: **🏆 Classifica** e **⚽ Marcatori**
- Il tab Marcatori mostra tutti i giocatori della lega con almeno un gol stagionale, ordinati per gol (a parità: assist)
- Colonne: posizione (con medaglie 🥇🥈🥉 per i primi tre), nome giocatore, squadra, ruolo, gol, assist
- I giocatori della propria squadra sono evidenziati e marcati con ★

### Modificato
- `engine/match.js` — `createMatchState` aggiunge `matchGoals` e `matchAssists`; `generateMatchEvent` incrementa entrambi ad ogni gol
- `ui/match.js` — `refreshMatchUI` usa `ms.matchGoals` per i marcatori invece di `p.goals` stagionale
- `ui/tabs_renderers.js` — `renderStand` divisa in `_buildStandContent(tab)` e `_showStandTab(tab)` con navigazione tab

---

## [0.2.9-beta] — 2026-03-31

### Aggiunto

#### Nomi giocatori
- Lista nomi maschili italiani (149 nomi) e cognomi italiani (188 cognomi) inclusi come file dati `js/data/names.js`
- Fonti: pdesterlich/cognomi.txt (gist GitHub), Max1234-Ita/nomi_italiani_m.txt
- I giocatori vengono ora generati con il formato **I. Cognome** (es. "M. Rossi")
- Lo stesso formato appare in vasca, tabelle In campo/Panchina, pannello cambi e modale Rosa

#### Mano dominante — giocatori ambidestri
- Aggiunta categoria **AMB** (ambidestro): 5% dei giocatori generati
- Distribuzione: 70% Destri (R), 25% Mancini (L), 5% Ambidestri (AMB)
- I giocatori AMB non subiscono nessuna penalità legata alla posizione in campo

#### Penalità mano/posizione nel motore
- **Mancini (L)** in posizione 4 (DL) e 5 (LW): efficacia ×0.82 (braccio dominante a sfavore)
- **Destri (R)** in posizione 1 (RW) e 2 (DR): efficacia ×0.82
- Posizioni 3 (ATT centro) e 6 (CB): indifferente — nessuna penalità per nessuna mano
- Portiere (GK): nessuna penalità

#### Bi-ruolo giocatori
- Il 10% dei giocatori generati ha un ruolo secondario (`secondRole`)
- Mappatura: DIF→CEN, CEN→DIF/ATT, ATT→CEN/CB, CB→ATT
- Nel calcolo efficacia viene usato il migliore tra ruolo primario e secondario
- Il ruolo secondario è visibile nella scheda giocatore (in sviluppo)

### Corretto
- **ATT in posizione 3**: penalizzato (efficacia 0.70 invece di 0.85) — posizione 3 richiede CEN, non un finalizzatore

---

## [0.2.8-beta] — 2026-03-30

### Aggiunto / Modificato

#### Schermata partita — nuovo layout
- Vasca (sinistra) + colonna destra con Stats, Marcatori, Log azioni — come da mockup
- Stats partita con **barre % attacco e difesa** di entrambe le squadre (aggiornate in tempo reale)
- Marcatori mostrano solo i gol della partita in corso (con numero maglia); lo storico stagionale è nella scheda Rosa
- Pannello cambi spostato in fondo alla pagina, con bordo dorato e titolo "⏸ Partita in pausa"
- Barra controlli (play/pausa/velocità) su sfondo distinto per leggibilità

#### Timer countdown
- Il cronometro mostra ora i **minuti rimanenti nel periodo** (da 08:00 a 00:00) invece del tempo totale trascorso
- Il display usa font monospace e dimensione maggiore per leggibilità

#### Pausa automatica a fine periodo
- Al termine di ogni tempo la partita si mette automaticamente in pausa con messaggio nel log
- L'allenatore può effettuare sostituzioni prima di riprendere premendo ▶

---

## [0.2.7-beta] — 2026-03-30

### Corretto

#### Login
- Sessione Firebase isolata da altri progetti (es. scacchideipinci): l'istanza Firebase è ora nominata `'waterpolo-app'` — questo impedisce la condivisione di token di autenticazione tra app diverse sullo stesso browser
- Aggiunta `setPersistence(browserLocalPersistence)` esplicita per garantire comportamento consistente

#### Convocazioni — bottone "Inizia partita"
- Corretto bug che impediva di abilitare il bottone con assegnazione manuale dei numeri: la validazione ora controlla correttamente solo i numeri assegnati ai convocati (non all'intera rosa)
- Il bottone si abilita non appena tutti i convocati hanno un numero, la formazione è completa e non ci sono duplicati

#### Convocazioni — numero minimo giocatori
- Ridotto il minimo da 7 a **5 convocati** per avviare la partita (MIN_CONVOCATI = 5)
- Il popup calottine si apre per ogni nuovo convocato senza numero, senza aspettare di raggiungere 13

#### Calottine — colori corretti
- Calottina **#1 sempre rossa** (portiere, regola ufficiale)
- In **casa**: calottine bianche con numero blu scuro
- In **trasferta**: calottine blu con numero bianco

---

## [0.2.6-beta] — 2026-03-30

### Corretto
- Login Google: sostituito il flusso **popup** con **redirect** come metodo principale — più compatibile con GitHub Pages e con browser che bloccano i popup. L'utente viene reindirizzato a Google e poi riportato al gioco automaticamente.

---

## [0.2.5-beta] — 2026-03-30

### Aggiunto
- Login con **Google** disponibile sia nel form di accesso che in quello di registrazione
- In caso di popup bloccato dal browser (es. Safari mobile), viene usato automaticamente il flusso redirect
- `js/firebase/auth.js` — aggiunta funzione `wpLoginGoogle()` con `GoogleAuthProvider`, `signInWithPopup` e fallback `signInWithRedirect`; aggiunta gestione `getRedirectResult` per il ritorno dopo redirect

### Note
- Richiede che **Google Sign-In sia abilitato** in Firebase Console → Authentication → Sign-in method
- Richiede che `grandepinnatk.github.io` sia nei **domini autorizzati** in Firebase Console → Authentication → Settings

---

## [0.2.4-beta] — 2026-03-30

### Corretto
- `lineup.js` — rimossa costante `CAP_TEAM_COL` dichiarata a livello di modulo che leggeva `G.myTeam.col` prima che `G` fosse inizializzato → errore "G is not defined" alla riga 355. Il colore viene ora letto direttamente dentro `_capSVG()` al momento della chiamata.

---

## [0.2.3-beta] — 2026-03-30

### Sicurezza
- Rigenerata la chiave API Firebase in `js/firebase/firebase.js` (la precedente era esposta pubblicamente nel repository GitHub)

---

## [0.2.2-beta] — 2026-03-30

### Aggiunto

#### Sistema di autenticazione Firebase
- Pannello login a schermo intero all'avvio: email+password, registrazione, recupero password via email
- Il gioco è accessibile **solo agli utenti autenticati** — il pannello si chiude automaticamente dopo il login
- Nome utente visibile nell'header di gioco durante la sessione; pulsante logout (⎋)
- Icona ☁️ nell'header quando i salvataggi cloud sono attivi

#### Salvataggi cloud sincronizzati (Firebase Realtime Database)
- I 3 slot di salvataggio vengono sincronizzati automaticamente con il cloud dopo ogni salvataggio
- Al login viene eseguita una sincronizzazione bidirezionale: il dato più recente (basato su `savedAt`) vince
- Se il cloud ha dati e il locale no (nuovo dispositivo) → scarica dal cloud
- Se il locale ha dati e il cloud no → carica sul cloud
- Il salvataggio cloud è **fire-and-forget**: non blocca il gioco in caso di errore di rete
- I dati sono protetti: ogni utente può leggere/scrivere solo i propri slot (`saves/{uid}/slot_N`)

### Struttura nuovi file
- `js/firebase/firebase.js` — inizializzazione Firebase SDK (Auth + Realtime Database)
- `js/firebase/auth.js` — gestione auth state, login/register/logout/reset, aggiornamento UI
- `js/firebase/cloud-save.js` — sync slot localStorage ↔ RTDB, esposto su `window.CloudSave`

### Modificato
- `engine/save.js` — `saveToSlot()` e `deleteSlot()` chiamano `window.CloudSave` in background quando l'utente è loggato
- `index.html` — aggiunto pannello auth overlay, info utente nell'header, script `type="module"` per i moduli Firebase
- `css/styles.css` — stili per il pannello auth (input focus, placeholder)

---

## [0.2.1-beta] — 2026-03-29

### Aggiunto

#### Popup calottine nell'assegnazione numeri
- Quando i 13 convocati sono stati selezionati, si apre automaticamente un popup che mostra le calottine da pallavolo numerate da 1 a 13
- Ogni calottina è disegnata in SVG con il colore della squadra; la **#1 è sempre rossa** (regola ufficiale: il marcatore del centroboa porta la calottina rossa)
- Il popup si apre in sequenza: assegnata una calottina al primo giocatore non numerato, si apre subito per il successivo fino al completamento
- Le calottine già assegnate ad altri giocatori appaiono in trasparenza e non sono cliccabili; viene mostrato il cognome del giocatore che la indossa
- Nella lista convocati, il campo numerico è stato sostituito da una miniatura della calottina SVG: cliccandola si riapre il popup per cambiare il numero

#### Filtro convocati in partita
- In partita (campo + panchina) vengono portati **esclusivamente i giocatori con numero assegnato**
- I giocatori convocati ma senza calottina non vengono inclusi nella panchina disponibile per i cambi

### Modificato
- `ui/lineup.js` — aggiunto `_capSVG()`, `_darken()`, `openCapAssignment()`, `assignCapNumber()`, `_maybeOpenCapPopup()`; `_assignToPos()` e `selectPlayerLu()` chiamano `_maybeOpenCapPopup()` dopo ogni aggiunta; input numerico sostituito con miniatura SVG cliccabile
- `engine/match.js` — `createMatchState` filtra la panchina includendo solo i giocatori presenti in `shirtNumbers`
- `css/styles.css` — stile hover per le calottine nel popup

---

## [0.2.0-beta] — 2026-03-29

### Aggiunto / Modificato

#### Tabelle In campo e Panchina — layout a colonne
- Entrambe le tabelle mostrano ora le informazioni su **colonne distinte** con intestazione: `# | Nome | Ruolo | Stamina | Esp. | OVR`
- Layout CSS Grid (`28px 1fr 38px 72px 52px 36px`) per allineamento preciso su tutte le righe
- La colonna Stamina è presente **anche in panchina** con la barra colorata che mostra il recupero in tempo reale
- Le righe sono ordinate per numero di maglia (portiere sempre primo nell'elenco in campo)
- I giocatori espulsi appaiono barrati e semi-trasparenti in panchina

#### Consumo stamina — fattori aggiuntivi
- **Età**: ogni anno oltre i 30 aumenta il drain del 12% (es. giocatore di 34 anni: +48%)
- **Attributo SPE**: velocità alta riduce l'inefficienza atletica (fino a −10% drain)
- **Posizione in contropiede**: posizioni offensive 1 (RW), 3 (ATT), 5 (LW) consumano il 25–35% in più di stamina rispetto alle posizioni difensive; GK consuma il 20% in meno
- Riepilogo moltiplicatori per posizione in modalità Contropiede: GK×0.80, 2×1.00, 4×1.00, 6×1.10, 3×1.25, 1×1.35, 5×1.35

### Modificato
- `engine/match.js` — aggiunto `COUNTER_POS_MULT`; `_drainStamina` ora calcola `posMult`, `ageFactor`, `fitnessFactor`, `speFactor` per ogni giocatore individualmente
- `ui/match.js` — `renderFieldLists` riscritto con CSS Grid, intestazioni colonna, stamina in panchina, ordinamento per numero maglia

---

## [0.1.9-beta] — 2026-03-29

### Aggiunto

#### Mercato in uscita
- Dal modale di dettaglio giocatore (tab **Rosa**) è ora presente la sezione **Metti in vendita**: si imposta il prezzo richiesto (default = valore del giocatore, minimo 30%) e si conferma
- Il giocatore appare nella **lista in uscita** del tab Mercato con il prezzo richiesto e le offerte ricevute; un badge **VENDITA** compare anche nella lista della Rosa
- A ogni giornata simulata o giocata viene eseguita `generateTransferOffers()`: ogni giocatore in lista ha ~40% di probabilità di ricevere un'offerta da una squadra casuale
- L'importo dell'offerta (60%–110% del valore reale) è pesato dall'appetibilità del giocatore: overall, morale, fitness e presenze
- Dal modale è possibile **Accettare** (incasso immediato, trasferimento) o **Rifiutare** ogni offerta
- Il bottone ✕ nel mercato ritira il giocatore dalla lista senza effetti

#### Sistema morale dinamico
- Un giocatore messo in vendita perde 8–15 punti di morale (sa di non essere nel progetto)
- Un giocatore acquistato guadagna 8–15 punti di morale (entusiasmo per il nuovo club)
- Al termine di ogni partita giocata: +3–7 morale in caso di vittoria, +0–2 pareggio, −2–5 sconfitta; +2–4 bonus aggiuntivo per chi era in campo; +2–4 ulteriore bonus per chi ha segnato almeno un gol stagionale

### Modificato
- `ui/tabs_renderers.js` — `renderRosa` mostra colonna morale e badge VENDITA; `showPlayerModal` aggiunge sezione vendita con `_buildSellSection()`; `renderMarket` ora ha due sezioni (uscite / acquisti); `buyPlayer` applica bonus morale all'acquisto
- `ui/match.js` — `endMatch` chiama `updateMoraleAfterMatch()` e `generateTransferOffers()` dopo ogni partita regular season
- `main.js` — aggiunte `putPlayerOnMarket()`, `removeFromMarket()`, `_playerAttractiveness()`, `generateTransferOffers()`, `acceptOffer()`, `rejectOffer()`, `updateMoraleAfterMatch()`; `simNextRound` ora chiama `generateTransferOffers()` dopo la simulazione
- `engine/save.js` — aggiunto `transferList` al payload e ad `applyLoadedSave`
- `ui/welcome.js` — aggiunto `transferList: []` allo stato iniziale

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
