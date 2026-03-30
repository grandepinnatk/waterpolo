// ─────────────────────────────────────────────
// js/firebase/firebase.js
// Inizializzazione Firebase SDK (Realtime Database + Auth)
// ─────────────────────────────────────────────

import { initializeApp }          from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, setPersistence,
         browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase }             from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBnP30hw8Qgt265L6Zvb7GQDtv-U2twYxQ",
  authDomain:        "waterpolo-4da0a.firebaseapp.com",
  databaseURL:       "https://waterpolo-4da0a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "waterpolo-4da0a",
  storageBucket:     "waterpolo-4da0a.firebasestorage.app",
  messagingSenderId: "315764607553",
  appId:             "1:315764607553:web:f5f98e3c77955fde3154c0"
};

// Nome app univoco per separare la sessione da altri progetti Firebase (es. scacchideipinci)
export const app  = initializeApp(firebaseConfig, 'waterpolo-app');
export const auth = getAuth(app);
export const db   = getDatabase(app);

// Persistenza locale esplicita (sessione separata per ogni app Firebase)
setPersistence(auth, browserLocalPersistence).catch(e =>
  console.warn('[Firebase] setPersistence error:', e)
);
