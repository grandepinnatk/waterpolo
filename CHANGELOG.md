// ─────────────────────────────────────────────
// js/firebase/firebase.js
// Inizializzazione Firebase SDK (Realtime Database + Auth)
// ─────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth }       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase }   from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAN7-_gpjQAD3CktG54G6cuZVrIaRvXGFw",
  authDomain:        "waterpolo-4da0a.firebaseapp.com",
  databaseURL:       "https://waterpolo-4da0a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "waterpolo-4da0a",
  storageBucket:     "waterpolo-4da0a.firebasestorage.app",
  messagingSenderId: "315764607553",
  appId:             "1:315764607553:web:f5f98e3c77955fde3154c0"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getDatabase(app);
